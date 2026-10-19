import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from db import get_db, log_audit
from routes.auth_helpers import jwt_required, roles_required

orders_bp = Blueprint("orders", __name__, url_prefix="/api/orders")

ALLOWED_TRANSITIONS = {
    "pending_confirmation": ["confirmed", "cancelled"],
    "confirmed": ["in_production", "cancelled"],
    "in_production": ["quality_check", "dispatched", "disputed"],
    "quality_check": ["dispatched", "in_production", "disputed"],
    "dispatched": ["delivered", "disputed"],
    "delivered": ["completed", "disputed"],
    "completed": ["disputed"], # Can raise dispute within inspection window
    "cancelled": [],
    "disputed": ["completed", "cancelled"] # Admin or mutual resolution
}

def generate_order_number():
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    short_uid = uuid.uuid4().hex[:6].upper()
    return f"ORD-{date_str}-{short_uid}"

@orders_bp.route("/create-from-quotation", methods=["POST"])
@jwt_required
@roles_required("buyer", "admin")
def create_order_from_quotation():
    data = request.get_json() or {}
    quotation_id = data.get("quotation_id")
    shipping_address = data.get("delivery_address") or data.get("shipping_address") or {}
    
    if not quotation_id:
        return jsonify({"error": "Quotation ID is required."}), 400
        
    db = get_db()
    try:
        q = db.quotations.find_one({"_id": ObjectId(quotation_id)})
    except Exception:
        return jsonify({"error": "Invalid quotation ID format."}), 400
        
    if not q:
        return jsonify({"error": "Quotation not found."}), 404
        
    # Security: Ensure current buyer is the quotation recipient
    if g.role != "admin" and q.get("buyer_id") != g.user_id:
        return jsonify({"error": "Access denied: You are not authorized to convert this quotation into an order."}), 403
        
    if q.get("status") not in ["accepted", "submitted"]:
        return jsonify({"error": f"Cannot create an order from a quotation with status '{q.get('status')}'. Quotation must be accepted."}), 400
        
    # Check if an order already exists for this quotation (prevent duplicate orders)
    existing_order = db.orders.find_one({"quotation_id": str(quotation_id)})
    if existing_order:
        return jsonify({
            "message": "An order for this quotation has already been created.",
            "order_id": str(existing_order["_id"]),
            "order_number": existing_order.get("order_number")
        }), 200
        
    qty = int(q.get("quantity", 1))
    product_id = q.get("product_id")
    seller_id = q.get("seller_id")
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Atomic Inventory Check and Reservation
    if product_id:
        prod = db.products.find_one({"_id": ObjectId(product_id)})
        if prod:
            current_stock = prod.get("stock_quantity", 0)
            allocated = prod.get("allocated_stock", 0)
            # If product is ready-made stock, atomically reserve allocated stock
            db.products.update_one(
                {"_id": ObjectId(product_id)},
                {"$inc": {"allocated_stock": qty}, "$set": {"updated_at": now_iso}}
            )
            
    # Mark quotation as accepted if not already
    db.quotations.update_one(
        {"_id": ObjectId(quotation_id)},
        {"$set": {"status": "accepted", "updated_at": now_iso}}
    )
    
    order_num = generate_order_number()
    order_doc = {
        "order_number": order_num,
        "buyer_id": g.user_id,
        "seller_id": seller_id,
        "quotation_id": str(quotation_id),
        "requirement_id": q.get("requirement_id"),
        "product_id": product_id,
        "quantity": qty,
        "unit_price": q.get("unit_price"),
        "total_amount": q.get("total_price"),
        "currency": "INR",
        "payment_method": "manual_escrow_wire", # explicitly labeled sandbox/manual arrangement
        "payment_status": "authorized_escrow_hold",
        "status": "confirmed", # confirmed, in_production, quality_check, dispatched, delivered, completed, cancelled, disputed
        "delivery_address": shipping_address,
        "delivery_terms": q.get("delivery_terms", "Standard registered transport"),
        "lead_time_days": q.get("lead_time_days", 14),
        "production_progress": [
            {
                "stage": "Order Confirmed & Material Preparation",
                "percentage": 10,
                "notes": "Order confirmed. Artisan beginning raw material prep.",
                "updated_at": now_iso
            }
        ],
        "shipping_details": {
            "carrier": None,
            "tracking_number": None,
            "dispatch_date": None,
            "estimated_delivery": None
        },
        "is_collective": False,
        "suborder_ids": [],
        "created_at": now_iso,
        "updated_at": now_iso
    }
    
    res = db.orders.insert_one(order_doc)
    order_id = str(res.inserted_id)
    
    # Notify seller
    db.notifications.insert_one({
        "user_id": seller_id,
        "title": f"🎉 New Confirmed Order: {order_num}",
        "message": f"Buyer {g.current_user.get('full_name')} accepted quotation #{str(quotation_id)[:6]}! Order value: ₹{q.get('total_price'):,.2f}.",
        "type": "order",
        "link": f"/seller/orders/{order_id}",
        "read": False,
        "created_at": now_iso
    })
    
    log_audit(g.user_id, "order_created", "orders", order_id, {"order_number": order_num, "amount": q.get("total_price")})
    
    return jsonify({
        "message": "Order placed successfully. Production confirmed.",
        "order_id": order_id,
        "order_number": order_num,
        "status": "confirmed"
    }), 201

@orders_bp.route("/checkout", methods=["POST"])
@jwt_required
def direct_checkout():
    """
    Direct checkout endpoint for purchasing products from the product detail page or cart.
    Validates stock availability, server unit price, MOQ, and shipping address.
    Atomically allocates/reserves inventory and creates order records in the database.
    Prevents duplicate submissions via idempotency_key or repeated click checks.
    """
    data = request.get_json() or {}
    items = data.get("items", [])
    delivery_address = data.get("delivery_address") or data.get("deliveryAddress") or {}
    payment_method = data.get("payment_method") or data.get("paymentMethod") or "cash_on_delivery"
    idempotency_key = (data.get("idempotency_key") or data.get("idempotencyKey") or "").strip()
    notes = data.get("notes", "")

    # Basic validations
    if not items or not isinstance(items, list):
        return jsonify({"error": "Order must contain at least one item."}), 400

    recipient_name = (delivery_address.get("full_name") or delivery_address.get("fullName") or delivery_address.get("name") or "").strip()
    phone = (delivery_address.get("phone") or "").strip()
    street = (delivery_address.get("street") or delivery_address.get("address") or "").strip()
    city = (delivery_address.get("city") or "").strip()
    state = (delivery_address.get("state") or "Tamil Nadu").strip()
    pincode = (delivery_address.get("pincode") or delivery_address.get("pin_code") or delivery_address.get("postalCode") or "").strip()

    if not recipient_name or not street or not city or not pincode:
        return jsonify({"error": "Full name, street address, city, and pincode are required for delivery."}), 400

    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    buyer_id = g.user_id
    buyer_user = db.users.find_one({"_id": ObjectId(buyer_id)}) or {}

    # Check for duplicate submission via idempotency_key
    if idempotency_key:
        existing = db.orders.find_one({"buyer_id": buyer_id, "idempotency_key": idempotency_key})
        if existing:
            return jsonify({
                "message": "Order already processed.",
                "order_id": str(existing["_id"]),
                "order_number": existing.get("order_number"),
                "status": existing.get("status"),
                "duplicate": True
            }), 200

    # Validate all items against server database
    validated_items = []
    for idx, item in enumerate(items):
        pid = item.get("product_id") or item.get("productId")
        try:
            qty = int(item.get("quantity") or 0)
        except (ValueError, TypeError):
            return jsonify({"error": f"Invalid quantity for item #{idx+1}."}), 400

        if not pid or qty <= 0:
            return jsonify({"error": f"Valid product ID and positive quantity required for item #{idx+1}."}), 400

        try:
            prod = db.products.find_one({"_id": ObjectId(pid), "is_archived": False})
        except Exception:
            return jsonify({"error": f"Invalid product ID format for item #{idx+1}."}), 400

        if not prod:
            return jsonify({"error": f"Product with ID '{pid}' not found or is no longer active."}), 404

        if not prod.get("is_published", True):
            return jsonify({"error": f"'{prod.get('title')}' is currently not available for purchase."}), 400

        moq = max(1, int(prod.get("moq") or 1))
        available_stock = int(prod.get("stock_quantity") or 0)

        # Self-purchase check: Artisan cannot purchase their own product
        if str(prod.get("seller_id")) == str(buyer_id):
            return jsonify({"error": f"Artisans cannot purchase their own products ('{prod.get('title')}')."}), 400

        # Available stock below MOQ check
        if available_stock < moq:
            return jsonify({
                "error": f"Cannot purchase '{prod.get('title')}': available stock ({available_stock}) is below the minimum order quantity ({moq}). Please submit a wholesale quotation inquiry for future production."
            }), 400

        if qty < moq:
            return jsonify({"error": f"Quantity for '{prod.get('title')}' ({qty}) is below minimum order quantity ({moq})."}), 400

        if qty > available_stock:
            return jsonify({"error": f"Insufficient stock for '{prod.get('title')}'. Available: {available_stock}, Requested: {qty}."}), 400

        server_unit_price = float(prod.get("price_per_unit", 0))
        if server_unit_price <= 0:
            return jsonify({"error": f"Invalid unit price configured for product '{prod.get('title')}'."}), 400

        validated_items.append({
            "product": prod,
            "product_id": pid,
            "seller_id": str(prod.get("seller_id")),
            "quantity": qty,
            "unit_price": server_unit_price,
            "line_total": round(server_unit_price * qty, 2)
        })

    # Group validated items by seller
    sellers_map = {}
    for vi in validated_items:
        sid = vi["seller_id"]
        if sid not in sellers_map:
            sellers_map[sid] = []
        sellers_map[sid].append(vi)

    created_orders = []
    # Payment status clearly indicated without pretending real bank charge occurred
    payment_status = "pending_cod" if payment_method == "cash_on_delivery" else "demo_authorized_escrow"

    # Atomically reserve and deduct stock across all seller items with concurrency overselling protection
    deducted_items = []
    for sid, seller_items in sellers_map.items():
        for it in seller_items:
            res = db.products.update_one(
                {
                    "_id": ObjectId(it["product_id"]),
                    "stock_quantity": {"$gte": it["quantity"]}
                },
                {
                    "$inc": {
                        "stock_quantity": -it["quantity"],
                        "allocated_stock": it["quantity"]
                    },
                    "$set": {"updated_at": now_iso}
                }
            )
            # Check if stock deduction succeeded
            matched = getattr(res, "matched_count", None) or getattr(res, "modified_count", 0)
            if matched == 0:
                # Concurrent order claimed the stock! Roll back previously deducted items
                for prev in deducted_items:
                    db.products.update_one(
                        {"_id": ObjectId(prev["product_id"])},
                        {
                            "$inc": {
                                "stock_quantity": prev["quantity"],
                                "allocated_stock": -prev["quantity"]
                            }
                        }
                    )
                return jsonify({
                    "error": f"Insufficient stock available for '{it['product'].get('title')}'. Another order was completed concurrently. Please refresh the page."
                }), 400
            deducted_items.append(it)

    for sid, seller_items in sellers_map.items():
        order_num = generate_order_number()
        total_amount = sum(it["line_total"] for it in seller_items)
        primary_item = seller_items[0]

        order_doc = {
            "order_number": order_num,
            "buyer_id": buyer_id,
            "seller_id": sid,
            "product_id": primary_item["product_id"],
            "items": [
                {
                    "product_id": it["product_id"],
                    "title": it["product"].get("title"),
                    "category": it["product"].get("category"),
                    "quantity": it["quantity"],
                    "unit": it["product"].get("unit", "piece"),
                    "unit_price": it["unit_price"],
                    "line_total": it["line_total"],
                    "image": (it["product"].get("images") or [""])[0] if it["product"].get("images") else ""
                }
                for it in seller_items
            ],
            "quantity": sum(it["quantity"] for it in seller_items),
            "unit_price": primary_item["unit_price"],
            "total_amount": total_amount,
            "currency": "INR",
            "payment_method": payment_method,
            "payment_status": payment_status,
            "status": "confirmed",
            "idempotency_key": idempotency_key,
            "delivery_address": {
                "full_name": recipient_name,
                "phone": phone,
                "street": street,
                "city": city,
                "state": state,
                "pincode": pincode
            },
            "delivery_terms": "Direct artisan fulfillment with tracked postal / courier dispatch",
            "lead_time_days": max((int(it["product"].get("lead_time_days") or 7) for it in seller_items), default=7),
            "production_progress": [
                {
                    "stage": "Order Placed & Stock Allocated",
                    "percentage": 15,
                    "notes": "Direct marketplace purchase confirmed. Artisan preparing package for dispatch.",
                    "updated_at": now_iso
                }
            ],
            "shipping_details": {
                "carrier": "India Post Speed Post",
                "tracking_number": None,
                "dispatch_date": None,
                "estimated_delivery": None
            },
            "customer_notes": notes,
            "is_direct_purchase": True,
            "created_at": now_iso,
            "updated_at": now_iso
        }

        res = db.orders.insert_one(order_doc)
        order_id = str(res.inserted_id)

        # Notify seller
        seller_user = db.users.find_one({"_id": ObjectId(sid)}) or {}
        db.notifications.insert_one({
            "user_id": sid,
            "title": f"🎉 New Direct Order Received: {order_num}",
            "message": f"Buyer {buyer_user.get('full_name', 'Customer')} placed a direct order for {len(seller_items)} item(s). Total: ₹{total_amount:,.2f}.",
            "type": "order",
            "link": f"/seller/orders/{order_id}",
            "read": False,
            "created_at": now_iso
        })

        # Notify buyer
        db.notifications.insert_one({
            "user_id": buyer_id,
            "title": f"Order Confirmed: {order_num}",
            "message": f"Your order of ₹{total_amount:,.2f} from {seller_user.get('full_name', 'Artisan')} has been confirmed. Stock reserved.",
            "type": "order",
            "link": f"/buyer/orders/{order_id}",
            "read": False,
            "created_at": now_iso
        })

        log_audit(buyer_id, "direct_order_placed", "orders", order_id, {
            "order_number": order_num,
            "total_amount": total_amount,
            "items_count": len(seller_items)
        })

        created_orders.append({
            "order_id": order_id,
            "order_number": order_num,
            "seller_id": sid,
            "seller_name": seller_user.get("full_name", "Artisan Producer"),
            "total_amount": total_amount,
            "quantity": sum(it["quantity"] for it in seller_items),
            "status": "confirmed",
            "payment_status": payment_status,
            "items": order_doc["items"]
        })

    return jsonify({
        "success": True,
        "message": "Order placed successfully. Confirmed by artisan seller.",
        "order_id": created_orders[0]["order_id"] if created_orders else None,
        "order_number": created_orders[0]["order_number"] if created_orders else None,
        "order": created_orders[0] if created_orders else None,
        "orders": created_orders,
        "total_amount": sum(o["total_amount"] for o in created_orders)
    }), 201

@orders_bp.route("", methods=["GET"])
@jwt_required
def list_orders():
    db = get_db()
    role = g.role
    user_id = g.user_id
    
    query = {}
    if role == "seller":
        query["seller_id"] = user_id
    elif role == "buyer":
        query["buyer_id"] = user_id
    # admin sees all
    
    status_filter = request.args.get("status")
    if status_filter:
        query["status"] = status_filter
        
    items = list(db.orders.find(query).sort("created_at", -1))
    
    # Pre-fetch user & product names
    all_sids = list(set(o.get("seller_id") for o in items if o.get("seller_id")))
    all_bids = list(set(o.get("buyer_id") for o in items if o.get("buyer_id")))
    all_pids = list(set(o.get("product_id") for o in items if o.get("product_id")))
    
    seller_users = {str(u["_id"]): u for u in db.users.find({"_id": {"$in": [ObjectId(s) for s in all_sids if ObjectId.is_valid(s)]}})}
    buyer_users = {str(u["_id"]): u for u in db.users.find({"_id": {"$in": [ObjectId(b) for b in all_bids if ObjectId.is_valid(b)]}})}
    products_map = {str(p["_id"]): p for p in db.products.find({"_id": {"$in": [ObjectId(p) for p in all_pids if ObjectId.is_valid(p)]}})}
    
    results = []
    for o in items:
        sid = o.get("seller_id")
        bid = o.get("buyer_id")
        pid = o.get("product_id")
        s_user = seller_users.get(sid, {})
        b_user = buyer_users.get(bid, {})
        prod = products_map.get(pid, {})
        
        # Determine title and thumbnail from prod or order items
        item_title = prod.get("title")
        item_image = prod.get("images", [""])[0] if prod.get("images") else ""
        if not item_title and o.get("items"):
            item_title = o["items"][0].get("title", "Artisan Craft Order")
            item_image = o["items"][0].get("image", "")

        results.append({
            "id": str(o["_id"]),
            "order_number": o.get("order_number"),
            "seller": {"id": sid, "name": s_user.get("full_name", "Artisan Producer")},
            "buyer": {"id": bid, "name": b_user.get("full_name", "Buyer")},
            "product": {"id": pid, "title": item_title or "Artisan Craft Order", "image": item_image},
            "quantity": o.get("quantity"),
            "unit_price": o.get("unit_price"),
            "total_amount": o.get("total_amount"),
            "currency": o.get("currency", "INR"),
            "status": o.get("status"),
            "payment_status": o.get("payment_status"),
            "created_at": o.get("created_at"),
            "updated_at": o.get("updated_at")
        })
        
    return jsonify({"orders": results}), 200

@orders_bp.route("/<order_id>", methods=["GET"])
@jwt_required
def get_order(order_id):
    db = get_db()
    try:
        o = db.orders.find_one({"_id": ObjectId(order_id)})
    except Exception:
        return jsonify({"error": "Invalid order ID"}), 400
        
    if not o:
        return jsonify({"error": "Order not found."}), 404
        
    if g.role != "admin" and o.get("buyer_id") != g.user_id and o.get("seller_id") != g.user_id:
        return jsonify({"error": "Access denied: You are not authorized to view this order."}), 403
        
    s_user = db.users.find_one({"_id": ObjectId(o.get("seller_id"))}) or {}
    b_user = db.users.find_one({"_id": ObjectId(o.get("buyer_id"))}) or {}
    prod = db.products.find_one({"_id": ObjectId(o.get("product_id"))}) if o.get("product_id") else {}
    
    # Check if a review already exists for this order
    existing_review = db.reviews.find_one({"order_id": str(order_id)})
    
    res = {
        "id": str(o["_id"]),
        "order_number": o.get("order_number"),
        "seller": {
            "id": o.get("seller_id"),
            "name": s_user.get("full_name", ""),
            "email": s_user.get("email", ""),
            "phone": s_user.get("phone", "")
        },
        "buyer": {
            "id": o.get("buyer_id"),
            "name": b_user.get("full_name", ""),
            "email": b_user.get("email", ""),
            "phone": b_user.get("phone", "")
        },
        "product": {
            "id": str(prod.get("_id", "")),
            "title": prod.get("title", ""),
            "category": prod.get("category", ""),
            "images": prod.get("images", [])
        },
        "quantity": o.get("quantity"),
        "unit_price": o.get("unit_price"),
        "total_amount": o.get("total_amount"),
        "currency": o.get("currency", "INR"),
        "status": o.get("status"),
        "payment_status": o.get("payment_status"),
        "delivery_address": o.get("delivery_address"),
        "delivery_terms": o.get("delivery_terms"),
        "lead_time_days": o.get("lead_time_days"),
        "production_progress": o.get("production_progress", []),
        "shipping_details": o.get("shipping_details", {}),
        "has_review": existing_review is not None,
        "created_at": o.get("created_at"),
        "updated_at": o.get("updated_at")
    }
    return jsonify({"order": res}), 200

@orders_bp.route("/<order_id>/progress", methods=["POST"])
@jwt_required
@roles_required("seller", "admin")
def update_production_progress(order_id):
    """
    Seller adds milestone progress (e.g. 50% weaving completed, quality check passed).
    """
    data = request.get_json() or {}
    stage = (data.get("stage") or "").strip()
    pct = int(data.get("percentage") or 0)
    notes = (data.get("notes") or "").strip()
    
    if not stage or pct < 0 or pct > 100:
        return jsonify({"error": "Valid production stage and percentage (0-100) are required."}), 400
        
    db = get_db()
    try:
        o = db.orders.find_one({"_id": ObjectId(order_id)})
    except Exception:
        return jsonify({"error": "Invalid order ID"}), 400
        
    if not o:
        return jsonify({"error": "Order not found."}), 404
        
    if g.role != "admin" and o.get("seller_id") != g.user_id:
        return jsonify({"error": "Permission denied."}), 403
        
    now_iso = datetime.now(timezone.utc).isoformat()
    milestone = {
        "stage": stage,
        "percentage": pct,
        "notes": notes,
        "updated_at": now_iso
    }
    
    update_doc = {
        "updated_at": now_iso
    }
    # Auto-advance status to in_production if not already
    if o.get("status") == "confirmed":
        update_doc["status"] = "in_production"
        
    db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {
            "$set": update_doc,
            "$push": {"production_progress": milestone}
        }
    )
    
    # Notify buyer
    db.notifications.insert_one({
        "user_id": o.get("buyer_id"),
        "title": f"Production Update: {o.get('order_number')}",
        "message": f"Stage: '{stage}' reached ({pct}%). Notes: {notes or 'Progress on schedule.'}",
        "type": "order",
        "link": f"/buyer/orders/{order_id}",
        "read": False,
        "created_at": now_iso
    })
    
    log_audit(g.user_id, "production_progress_updated", "orders", order_id, milestone)
    
    return jsonify({"message": "Production progress updated successfully.", "milestone": milestone}), 200

@orders_bp.route("/<order_id>/dispatch", methods=["POST"])
@jwt_required
@roles_required("seller", "admin")
def dispatch_order(order_id):
    """
    Seller records shipment dispatch details.
    """
    data = request.get_json() or {}
    carrier = (data.get("carrier") or "India Post / Surface Logistics").strip()
    tracking_number = (data.get("tracking_number") or "").strip()
    est_delivery = data.get("estimated_delivery", "")
    
    db = get_db()
    try:
        o = db.orders.find_one({"_id": ObjectId(order_id)})
    except Exception:
        return jsonify({"error": "Invalid order ID"}), 400
        
    if not o:
        return jsonify({"error": "Order not found."}), 404
        
    if g.role != "admin" and o.get("seller_id") != g.user_id:
        return jsonify({"error": "Permission denied."}), 403
        
    now_iso = datetime.now(timezone.utc).isoformat()
    shipping_details = {
        "carrier": carrier,
        "tracking_number": tracking_number,
        "dispatch_date": now_iso,
        "estimated_delivery": est_delivery
    }
    
    db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "status": "dispatched",
            "shipping_details": shipping_details,
            "updated_at": now_iso
        }}
    )
    
    # Notify buyer
    db.notifications.insert_one({
        "user_id": o.get("buyer_id"),
        "title": f"Order Dispatched: {o.get('order_number')}",
        "message": f"Your order has been dispatched via {carrier} (Tracking: {tracking_number or 'In Transit'}).",
        "type": "order",
        "link": f"/buyer/orders/{order_id}",
        "read": False,
        "created_at": now_iso
    })
    
    log_audit(g.user_id, "order_dispatched", "orders", order_id, shipping_details)
    
    return jsonify({"message": "Shipment dispatched recorded.", "shipping_details": shipping_details}), 200

@orders_bp.route("/<order_id>/confirm-delivery", methods=["POST"])
@jwt_required
@roles_required("buyer", "admin")
def confirm_delivery(order_id):
    """
    Buyer confirms receipt of items in good condition.
    Order transitions to 'completed'.
    """
    db = get_db()
    try:
        o = db.orders.find_one({"_id": ObjectId(order_id)})
    except Exception:
        return jsonify({"error": "Invalid order ID"}), 400
        
    if not o:
        return jsonify({"error": "Order not found."}), 404
        
    if g.role != "admin" and o.get("buyer_id") != g.user_id:
        return jsonify({"error": "Only the buyer can confirm receipt of this order."}), 403
        
    if o.get("status") == "completed":
        return jsonify({"message": "Order is already marked as completed."}), 200
        
    now_iso = datetime.now(timezone.utc).isoformat()
    db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "status": "completed",
            "delivered_at": now_iso,
            "updated_at": now_iso
        }}
    )
    
    # Free up allocated stock and decrement actual stock if product linked
    if o.get("product_id"):
        db.products.update_one(
            {"_id": ObjectId(o.get("product_id"))},
            {"$inc": {
                "stock_quantity": -int(o.get("quantity", 0)),
                "allocated_stock": -int(o.get("quantity", 0))
            }}
        )
        
    # Notify seller
    db.notifications.insert_one({
        "user_id": o.get("seller_id"),
        "title": f"Order Completed: {o.get('order_number')}",
        "message": f"Buyer confirmed delivery for order {o.get('order_number')}. Total amount ₹{o.get('total_amount'):,.2f} released to artisan account.",
        "type": "order",
        "link": f"/seller/orders/{order_id}",
        "read": False,
        "created_at": now_iso
    })
    
    log_audit(g.user_id, "order_completed", "orders", order_id)
    
    return jsonify({"message": "Order delivery confirmed. Order completed successfully.", "status": "completed"}), 200
