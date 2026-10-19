from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from db import get_db, log_audit
from routes.auth_helpers import jwt_required, roles_required

quotations_bp = Blueprint("quotations", __name__, url_prefix="/api/quotations")

SELLER_ROLES = {"seller", "artisan", "producer", "artisan_seller", "admin"}

@quotations_bp.route("", methods=["POST"])
@jwt_required
@roles_required(*SELLER_ROLES)
def submit_quotation():
    """
    Submits a formal wholesale quotation from an authenticated artisan seller
    for a buyer's bulk requirement.
    """
    # Account standing check
    if g.current_user.get("status") == "suspended":
        return jsonify({"error": "Forbidden: Your artisan seller account has been suspended by administration."}), 403

    data = request.get_json() or {}
    req_id = (data.get("requirement_id") or "").strip()
    buyer_id = (data.get("buyer_id") or "").strip()
    product_id = (data.get("product_id") or "").strip()

    # 3. Derive artisan identity strictly from authenticated server-side session (not client payload)
    seller_id = str(g.user_id)
    db = get_db()
    req_doc = None

    # 4. Verify target requirement and enforce ownership rules
    if req_id:
        try:
            req_doc = db.buyer_requirements.find_one({"_id": ObjectId(req_id)})
        except Exception:
            return jsonify({"error": "Invalid requirement ID format."}), 400

        if not req_doc:
            return jsonify({"error": "Target wholesale buyer requirement was not found."}), 404

        # Requirement must be open for quotations
        if req_doc.get("status") not in ["open", "in_negotiation"]:
            return jsonify({
                "error": f"Cannot submit quotation: This requirement has status '{req_doc.get('status')}' and is no longer accepting quotations."
            }), 400

        target_buyer_id = str(req_doc.get("buyer_id"))

        # Ownership guard: An artisan seller cannot submit a quotation on their own requirement
        if target_buyer_id == seller_id:
            return jsonify({
                "error": "Forbidden: You cannot submit a quotation for your own requirement."
            }), 403

        buyer_id = target_buyer_id
    elif buyer_id:
        try:
            b_user = db.users.find_one({"_id": ObjectId(buyer_id)})
        except Exception:
            return jsonify({"error": "Invalid buyer ID format."}), 400

        if not b_user:
            return jsonify({"error": "Target buyer account was not found."}), 404

        if str(buyer_id) == seller_id:
            return jsonify({"error": "Forbidden: You cannot submit a quotation to yourself."}), 403
    else:
        return jsonify({"error": "A valid requirement_id or buyer_id is required to submit a wholesale quotation."}), 400

    # 5. Validate quotation payload
    try:
        quantity = int(data.get("quantity") or 0)
    except (ValueError, TypeError):
        return jsonify({"error": "Quotation quantity must be a valid integer."}), 400

    try:
        unit_price = float(data.get("unit_price") or 0)
    except (ValueError, TypeError):
        return jsonify({"error": "Quotation unit price must be a valid numeric amount."}), 400

    try:
        lead_time_days = int(data.get("lead_time_days") or 14)
    except (ValueError, TypeError):
        lead_time_days = 14

    if quantity <= 0:
        return jsonify({"error": "Quotation quantity must be greater than zero."}), 400

    if unit_price <= 0:
        return jsonify({"error": "Quotation unit price must be greater than ₹0."}), 400

    if lead_time_days <= 0:
        return jsonify({"error": "Estimated production lead time must be at least 1 day."}), 400

    delivery_terms = (data.get("delivery_terms") or "Ex-workshop with insured surface dispatch").strip()
    notes = (data.get("notes") or "").strip()
    now_iso = datetime.now(timezone.utc).isoformat()
    total_price = round(quantity * unit_price, 2)

    # 6. Save quotation in database with audit revisions
    quotation_doc = {
        "requirement_id": str(req_id) if req_id else None,
        "seller_id": seller_id,
        "buyer_id": str(buyer_id),
        "product_id": str(product_id) if product_id else None,
        "quantity": quantity,
        "unit_price": unit_price,
        "total_price": total_price,
        "currency": "INR",
        "lead_time_days": lead_time_days,
        "delivery_terms": delivery_terms,
        "notes": notes,
        "status": "submitted",
        "revisions": [
            {
                "revision_num": 1,
                "quantity": quantity,
                "unit_price": unit_price,
                "total_price": total_price,
                "lead_time_days": lead_time_days,
                "notes": notes,
                "modified_by": seller_id,
                "role": getattr(g, "role", "seller"),
                "timestamp": now_iso
            }
        ],
        "created_at": now_iso,
        "updated_at": now_iso
    }

    res = db.quotations.insert_one(quotation_doc)
    q_id = str(res.inserted_id)

    # 7. Update requirement status to in_negotiation if it was open
    if req_id and req_doc and req_doc.get("status") == "open":
        db.buyer_requirements.update_one(
            {"_id": ObjectId(req_id)},
            {"$set": {"status": "in_negotiation", "updated_at": now_iso}}
        )

    # 8. Notify the buyer
    seller_name = g.current_user.get("full_name") or "Artisan Producer"
    db.notifications.insert_one({
        "user_id": str(buyer_id),
        "title": "New Wholesale Quotation Received",
        "message": f"Artisan {seller_name} submitted a quotation of ₹{total_price:,.2f} for {quantity} units.",
        "type": "quotation",
        "link": f"/buyer/quotations/{q_id}",
        "read": False,
        "created_at": now_iso
    })

    log_audit(seller_id, "quotation_submitted", "quotations", q_id, {
        "requirement_id": req_id,
        "buyer_id": buyer_id,
        "total_price": total_price,
        "quantity": quantity,
        "unit_price": unit_price
    })

    return jsonify({
        "message": "Quotation submitted successfully.",
        "quotation_id": q_id,
        "total_price": total_price,
        "status": "submitted"
    }), 201

@quotations_bp.route("", methods=["GET"])
@jwt_required
def list_quotations():
    """
    Returns quotations where user is either the buyer, the seller, or an administrator.
    """
    db = get_db()
    user_id = g.user_id
    role = g.role
    
    query = {}
    if role in ["seller", "artisan", "producer", "artisan_seller"]:
        query["seller_id"] = user_id
    elif role == "buyer":
        query["buyer_id"] = user_id
    # admin can view all
    
    status_filter = request.args.get("status")
    if status_filter:
        query["status"] = status_filter
        
    req_filter = request.args.get("requirement_id")
    if req_filter:
        query["requirement_id"] = req_filter
        
    items = list(db.quotations.find(query).sort("created_at", -1))
    
    # Pre-fetch participant data
    all_sids = list(set(q.get("seller_id") for q in items if q.get("seller_id")))
    all_bids = list(set(q.get("buyer_id") for q in items if q.get("buyer_id")))
    all_pids = list(set(q.get("product_id") for q in items if q.get("product_id")))
    
    seller_users = {str(u["_id"]): u for u in db.users.find({"_id": {"$in": [ObjectId(s) for s in all_sids if ObjectId.is_valid(s)]}})}
    buyer_users = {str(u["_id"]): u for u in db.users.find({"_id": {"$in": [ObjectId(b) for b in all_bids if ObjectId.is_valid(b)]}})}
    products_map = {str(p["_id"]): p for p in db.products.find({"_id": {"$in": [ObjectId(p) for p in all_pids if ObjectId.is_valid(p)]}})}
    
    results = []
    for q in items:
        sid = q.get("seller_id")
        bid = q.get("buyer_id")
        pid = q.get("product_id")
        s_user = seller_users.get(sid, {})
        b_user = buyer_users.get(bid, {})
        prod = products_map.get(pid, {})
        
        results.append({
            "id": str(q["_id"]),
            "requirement_id": q.get("requirement_id"),
            "seller": {"id": sid, "name": s_user.get("full_name", "Artisan Producer")},
            "buyer": {"id": bid, "name": b_user.get("full_name", "Buyer")},
            "product": {"id": pid, "title": prod.get("title", "Custom Craft Requirement"), "images": prod.get("images", [])},
            "quantity": q.get("quantity"),
            "unit_price": q.get("unit_price"),
            "total_price": q.get("total_price"),
            "currency": q.get("currency", "INR"),
            "lead_time_days": q.get("lead_time_days"),
            "delivery_terms": q.get("delivery_terms"),
            "notes": q.get("notes"),
            "status": q.get("status"),
            "revisions_count": len(q.get("revisions", [])),
            "created_at": q.get("created_at"),
            "updated_at": q.get("updated_at")
        })
        
    return jsonify({"quotations": results}), 200

@quotations_bp.route("/<quotation_id>", methods=["GET"])
@jwt_required
def get_quotation(quotation_id):
    db = get_db()
    try:
        q = db.quotations.find_one({"_id": ObjectId(quotation_id)})
    except Exception:
        return jsonify({"error": "Invalid quotation ID"}), 400
        
    if not q:
        return jsonify({"error": "Quotation not found"}), 404
        
    # Security: check authorization
    if g.role != "admin" and q.get("seller_id") != g.user_id and q.get("buyer_id") != g.user_id:
        return jsonify({"error": "Access denied: You are not a party to this quotation."}), 403
        
    s_user = db.users.find_one({"_id": ObjectId(q.get("seller_id"))}) or {}
    b_user = db.users.find_one({"_id": ObjectId(q.get("buyer_id"))}) or {}
    prod = db.products.find_one({"_id": ObjectId(q.get("product_id"))}) if q.get("product_id") else {}
    req_doc = db.buyer_requirements.find_one({"_id": ObjectId(q.get("requirement_id"))}) if q.get("requirement_id") else {}
    
    res = {
        "id": str(q["_id"]),
        "requirement_id": q.get("requirement_id"),
        "requirement_title": req_doc.get("title", ""),
        "seller": {"id": q.get("seller_id"), "name": s_user.get("full_name", ""), "email": s_user.get("email", "")},
        "buyer": {"id": q.get("buyer_id"), "name": b_user.get("full_name", ""), "email": b_user.get("email", "")},
        "product": {"id": str(prod.get("_id", "")), "title": prod.get("title", ""), "images": prod.get("images", [])},
        "quantity": q.get("quantity"),
        "unit_price": q.get("unit_price"),
        "total_price": q.get("total_price"),
        "currency": q.get("currency", "INR"),
        "lead_time_days": q.get("lead_time_days"),
        "delivery_terms": q.get("delivery_terms"),
        "notes": q.get("notes"),
        "status": q.get("status"),
        "revisions": q.get("revisions", []),
        "created_at": q.get("created_at"),
        "updated_at": q.get("updated_at")
    }
    return jsonify({"quotation": res}), 200

@quotations_bp.route("/<quotation_id>/revise", methods=["POST"])
@jwt_required
def revise_quotation(quotation_id):
    """
    Submits a counteroffer or revision (either Buyer requesting revision or Seller submitting revised terms).
    """
    data = request.get_json() or {}
    db = get_db()
    
    try:
        q = db.quotations.find_one({"_id": ObjectId(quotation_id)})
    except Exception:
        return jsonify({"error": "Invalid quotation ID"}), 400
        
    if not q:
        return jsonify({"error": "Quotation not found"}), 404
        
    if g.role != "admin" and q.get("seller_id") != g.user_id and q.get("buyer_id") != g.user_id:
        return jsonify({"error": "Permission denied."}), 403
        
    if q.get("status") in ["accepted", "rejected", "withdrawn"]:
        return jsonify({"error": f"Cannot revise a quotation that is already '{q.get('status')}'."}), 400
        
    new_qty = int(data.get("quantity") or q.get("quantity"))
    new_price = float(data.get("unit_price") or q.get("unit_price"))
    new_lead = int(data.get("lead_time_days") or q.get("lead_time_days"))
    rev_notes = (data.get("notes") or "").strip()
    
    now_iso = datetime.now(timezone.utc).isoformat()
    rev_num = len(q.get("revisions", [])) + 1
    new_total = round(new_qty * new_price, 2)
    
    revision_entry = {
        "revision_num": rev_num,
        "quantity": new_qty,
        "unit_price": new_price,
        "total_price": new_total,
        "lead_time_days": new_lead,
        "notes": rev_notes,
        "modified_by": g.user_id,
        "role": g.role,
        "timestamp": now_iso
    }
    
    # If buyer requested revision, status is 'revision_requested'; if seller updated, status is 'submitted'
    new_status = "revision_requested" if g.user_id == q.get("buyer_id") else "submitted"
    
    db.quotations.update_one(
        {"_id": ObjectId(quotation_id)},
        {
            "$set": {
                "quantity": new_qty,
                "unit_price": new_price,
                "total_price": new_total,
                "lead_time_days": new_lead,
                "status": new_status,
                "updated_at": now_iso
            },
            "$push": {"revisions": revision_entry}
        }
    )
    
    # Notify counterparty
    recipient_id = q.get("seller_id") if g.user_id == q.get("buyer_id") else q.get("buyer_id")
    db.notifications.insert_one({
        "user_id": recipient_id,
        "title": f"Quotation Revision #{rev_num}",
        "message": f"{g.current_user.get('full_name')} proposed revised terms: {new_qty} units @ ₹{new_price}/unit.",
        "type": "quotation",
        "link": f"/buyer/quotations/{quotation_id}" if recipient_id == q.get("buyer_id") else f"/seller/quotations/{quotation_id}",
        "read": False,
        "created_at": now_iso
    })
    
    log_audit(g.user_id, "quotation_revised", "quotations", quotation_id, revision_entry)
    
    return jsonify({
        "message": "Quotation revised successfully.",
        "new_status": new_status,
        "revision_num": rev_num,
        "total_price": new_total
    }), 200

@quotations_bp.route("/<quotation_id>/respond", methods=["POST"])
@jwt_required
def respond_quotation(quotation_id):
    """
    Accept, Reject, or Withdraw a quotation.
    Crucial guard: Prevents accepting the same quotation twice!
    """
    data = request.get_json() or {}
    action = data.get("action") # accept, reject, withdraw
    reason = (data.get("reason") or "").strip()
    
    if action not in ["accept", "reject", "withdraw"]:
        return jsonify({"error": "Action must be 'accept', 'reject', or 'withdraw'."}), 400
        
    db = get_db()
    try:
        q = db.quotations.find_one({"_id": ObjectId(quotation_id)})
    except Exception:
        return jsonify({"error": "Invalid quotation ID"}), 400
        
    if not q:
        return jsonify({"error": "Quotation not found"}), 404
        
    # Permission checks
    if action == "accept":
        # Only the buyer can accept the quotation
        if g.role != "admin" and q.get("buyer_id") != g.user_id:
            return jsonify({"error": "Only the buyer can accept a quotation."}), 403
        if q.get("status") == "accepted":
            return jsonify({"error": "This quotation has already been accepted and processed."}), 409
        if q.get("status") in ["rejected", "expired", "withdrawn"]:
            return jsonify({"error": f"Cannot accept a quotation in status '{q.get('status')}'."}), 400
            
    elif action == "withdraw":
        # Only the seller can withdraw
        if g.role != "admin" and q.get("seller_id") != g.user_id:
            return jsonify({"error": "Only the seller can withdraw their quotation."}), 403
            
    new_status = "accepted" if action == "accept" else ("rejected" if action == "reject" else "withdrawn")
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Atomic status update
    res = db.quotations.update_one(
        {"_id": ObjectId(quotation_id), "status": {"$ne": "accepted"} if action == "accept" else {"$exists": True}},
        {"$set": {
            "status": new_status,
            "status_reason": reason,
            "updated_at": now_iso
        }}
    )
    
    if action == "accept" and res.modified_count == 0:
        return jsonify({"error": "Concurrent acceptance conflict: Quotation already processed."}), 409
        
    # Notify other party
    other_party_id = q.get("seller_id") if g.user_id == q.get("buyer_id") else q.get("buyer_id")
    db.notifications.insert_one({
        "user_id": other_party_id,
        "title": f"Quotation {action.title()}ed",
        "message": f"Your quotation for {q.get('quantity')} units was {new_status} by {g.current_user.get('full_name')}.",
        "type": "quotation",
        "link": f"/seller/quotations/{quotation_id}" if other_party_id == q.get("seller_id") else f"/buyer/quotations/{quotation_id}",
        "read": False,
        "created_at": now_iso
    })
    
    log_audit(g.user_id, f"quotation_{new_status}", "quotations", quotation_id, {"reason": reason})
    
    return jsonify({
        "message": f"Quotation {new_status} successfully.",
        "status": new_status,
        "quotation_id": quotation_id
    }), 200
