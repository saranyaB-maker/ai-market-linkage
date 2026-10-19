from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from db import get_db, log_audit
from routes.auth_helpers import jwt_required, roles_required

disputes_bp = Blueprint("disputes", __name__, url_prefix="/api/disputes")

@disputes_bp.route("", methods=["POST"])
@jwt_required
def raise_dispute():
    data = request.get_json() or {}
    order_id = data.get("order_id")
    reason = (data.get("reason") or "").strip()
    description = (data.get("description") or "").strip()
    evidence_urls = data.get("evidence_urls", [])
    
    if not order_id or not reason or not description:
        return jsonify({"error": "Order ID, reason, and detailed description are required."}), 400
        
    db = get_db()
    try:
        order = db.orders.find_one({"_id": ObjectId(order_id)})
    except Exception:
        return jsonify({"error": "Invalid order ID"}), 400
        
    if not order:
        return jsonify({"error": "Order not found."}), 404
        
    # User must be party to the order
    if g.role != "admin" and order.get("buyer_id") != g.user_id and order.get("seller_id") != g.user_id:
        return jsonify({"error": "You can only dispute orders to which you are an active party."}), 403
        
    respondent_id = order.get("seller_id") if g.user_id == order.get("buyer_id") else order.get("buyer_id")
    now_iso = datetime.now(timezone.utc).isoformat()
    
    dispute_doc = {
        "order_id": str(order_id),
        "order_number": order.get("order_number"),
        "raised_by_id": g.user_id,
        "raised_by_role": g.role,
        "respondent_id": respondent_id,
        "reason": reason, # quality_mismatch, missing_quantity, delivery_delay, damaged_goods, other
        "description": description,
        "evidence_urls": evidence_urls,
        "status": "open", # open, under_review, resolved_refund, resolved_replacement, resolved_dismissed
        "admin_resolution": None,
        "created_at": now_iso,
        "updated_at": now_iso
    }
    
    res = db.disputes.insert_one(dispute_doc)
    dispute_id = str(res.inserted_id)
    
    # Mark order status as disputed
    db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"status": "disputed", "updated_at": now_iso}}
    )
    
    # Notify respondent and admin
    db.notifications.insert_one({
        "user_id": respondent_id,
        "title": f"⚠️ Dispute Raised on Order {order.get('order_number')}",
        "message": f"{g.current_user.get('full_name')} raised a dispute regarding '{reason}'. Platform admin is mediating.",
        "type": "dispute",
        "link": f"/disputes/{dispute_id}",
        "read": False,
        "created_at": now_iso
    })
    
    log_audit(g.user_id, "dispute_raised", "disputes", dispute_id, {"order_id": order_id, "reason": reason})
    
    return jsonify({
        "message": "Dispute registered. Our administrative arbitration team has been alerted.",
        "dispute_id": dispute_id
    }), 201

@disputes_bp.route("", methods=["GET"])
@jwt_required
def list_disputes():
    db = get_db()
    query = {}
    if g.role != "admin":
        query["$or"] = [{"raised_by_id": g.user_id}, {"respondent_id": g.user_id}]
        
    items = list(db.disputes.find(query).sort("created_at", -1))
    results = []
    for d in items:
        results.append({
            "id": str(d["_id"]),
            "order_id": d.get("order_id"),
            "order_number": d.get("order_number"),
            "raised_by_id": d.get("raised_by_id"),
            "raised_by_role": d.get("raised_by_role"),
            "respondent_id": d.get("respondent_id"),
            "reason": d.get("reason"),
            "description": d.get("description"),
            "status": d.get("status"),
            "admin_resolution": d.get("admin_resolution"),
            "created_at": d.get("created_at")
        })
    return jsonify({"disputes": results}), 200

@disputes_bp.route("/<dispute_id>/resolve", methods=["POST"])
@jwt_required
@roles_required("admin")
def resolve_dispute(dispute_id):
    """
    Administrative Arbitration:
    Sets resolution type (refund, replacement, dismissed), records reason and updates order.
    """
    data = request.get_json() or {}
    resolution_type = data.get("resolution_type") # resolved_refund, resolved_replacement, resolved_dismissed
    notes = (data.get("notes") or "").strip()
    
    if resolution_type not in ["resolved_refund", "resolved_replacement", "resolved_dismissed"]:
        return jsonify({"error": "Invalid resolution type."}), 400
        
    if not notes:
        return jsonify({"error": "Arbitration notes and reasons are required."}), 400
        
    db = get_db()
    try:
        dispute = db.disputes.find_one({"_id": ObjectId(dispute_id)})
    except Exception:
        return jsonify({"error": "Invalid dispute ID"}), 400
        
    if not dispute:
        return jsonify({"error": "Dispute not found."}), 404
        
    now_iso = datetime.now(timezone.utc).isoformat()
    resolution_doc = {
        "resolved_by": g.user_id,
        "resolved_by_email": g.current_user.get("email"),
        "resolution_type": resolution_type,
        "notes": notes,
        "timestamp": now_iso
    }
    
    db.disputes.update_one(
        {"_id": ObjectId(dispute_id)},
        {"$set": {
            "status": resolution_type,
            "admin_resolution": resolution_doc,
            "updated_at": now_iso
        }}
    )
    
    # If dismissed or replacement agreed, set order back to completed or in_production
    target_order_status = "completed" if resolution_type in ["resolved_refund", "resolved_dismissed"] else "in_production"
    db.orders.update_one(
        {"_id": ObjectId(dispute.get("order_id"))},
        {"$set": {"status": target_order_status, "updated_at": now_iso}}
    )
    
    log_audit(g.user_id, "dispute_resolved", "disputes", dispute_id, resolution_doc)
    
    return jsonify({
        "message": "Dispute resolved and decision recorded.",
        "resolution": resolution_doc
    }), 200
