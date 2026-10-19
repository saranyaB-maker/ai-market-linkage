from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from db import get_db, log_audit
from routes.auth_helpers import jwt_required, roles_required

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

@admin_bp.route("/overview-metrics", methods=["GET"])
@jwt_required
@roles_required("admin")
def get_overview_metrics():
    """
    Real database-backed operational metrics for administration.
    """
    db = get_db()
    
    # 1. Users by role
    total_users = db.users.count_documents({})
    sellers_count = db.users.count_documents({"role": "seller"})
    buyers_count = db.users.count_documents({"role": "buyer"})
    suspended_users = db.users.count_documents({"status": "suspended"})
    
    # 2. Verification metrics
    pending_verif = db.seller_verifications.count_documents({"verification_status": "pending"})
    verified_producers = db.seller_verifications.count_documents({"verification_status": "verified_producer"})
    verified_groups = db.seller_verifications.count_documents({"verification_status": "verified_group"})
    verified_resellers = db.seller_verifications.count_documents({"verification_status": "verified_reseller"})
    needs_info = db.seller_verifications.count_documents({"verification_status": "needs_more_information"})
    
    # 3. Product metrics
    active_products = db.products.count_documents({"is_published": True, "is_archived": False})
    total_products = db.products.count_documents({"is_archived": False})
    
    # 4. Duplicate flags queue
    pending_duplicates = db.duplicate_flags.count_documents({"status": "pending_review"})
    confirmed_duplicates = db.duplicate_flags.count_documents({"status": "confirmed_duplicate"})
    
    # 5. Orders & transactions
    total_orders = db.orders.count_documents({})
    completed_orders = db.orders.count_documents({"status": "completed"})
    in_production_orders = db.orders.count_documents({"status": "in_production"})
    disputed_orders = db.orders.count_documents({"status": "disputed"})
    
    # Calculate gross platform volume
    pipeline = [{"$match": {"status": {"$in": ["confirmed", "in_production", "dispatched", "delivered", "completed"]}}},
                {"$group": {"_id": None, "total_gmv": {"$sum": "$total_amount"}}}]
    gmv_res = list(db.orders.aggregate(pipeline))
    total_gmv = round(gmv_res[0]["total_gmv"], 2) if gmv_res else 0.0
    
    # 6. Requirements & Quotations
    open_requirements = db.buyer_requirements.count_documents({"status": "open"})
    total_quotations = db.quotations.count_documents({})
    accepted_quotations = db.quotations.count_documents({"status": "accepted"})
    open_disputes = db.disputes.count_documents({"status": "open"})
    
    return jsonify({
        "metrics": {
            "users": {
                "total": total_users,
                "sellers": sellers_count,
                "buyers": buyers_count,
                "suspended": suspended_users
            },
            "verifications": {
                "pending": pending_verif,
                "verified_producers": verified_producers,
                "verified_groups": verified_groups,
                "verified_resellers": verified_resellers,
                "needs_more_info": needs_info
            },
            "products": {
                "active_published": active_products,
                "total_catalog": total_products,
                "suspected_duplicates_pending": pending_duplicates,
                "confirmed_duplicates": confirmed_duplicates
            },
            "transactions": {
                "total_orders": total_orders,
                "completed": completed_orders,
                "in_production": in_production_orders,
                "disputed": disputed_orders,
                "gross_marketplace_volume_inr": total_gmv
            },
            "marketplace_activity": {
                "open_buyer_requirements": open_requirements,
                "total_quotations": total_quotations,
                "accepted_quotations": accepted_quotations,
                "open_disputes": open_disputes
            },
            # Flat convenience aliases for dashboard widgets
            "total_users": total_users,
            "sellers": sellers_count,
            "buyers": buyers_count,
            "admins": db.users.count_documents({"role": "admin"}),
            "suspended": suspended_users,
            "pending_verifications": pending_verif,
            "verified_producers": verified_producers,
            "verified_groups": verified_groups,
            "verified_resellers": verified_resellers,
            "unverified": db.seller_verifications.count_documents({"verification_status": "unverified"}),
            "active_products": active_products,
            "total_products": total_products,
            "suspected_duplicates": pending_duplicates,
            "total_orders": total_orders,
            "open_requirements": open_requirements,
            "open_disputes": open_disputes,
            "total_gmv": total_gmv
        }
    }), 200

@admin_bp.route("/users", methods=["GET"])
@jwt_required
@roles_required("admin")
def list_users():
    db = get_db()
    role_filter = request.args.get("role")
    status_filter = request.args.get("status")
    keyword = (request.args.get("q") or "").strip()
    page = max(1, request.args.get("page", 1, type=int))
    limit = min(50, request.args.get("limit", 20, type=int))
    skip = (page - 1) * limit
    
    query = {}
    if role_filter and role_filter != "all":
        query["role"] = role_filter
    if status_filter and status_filter != "all":
        query["status"] = status_filter
    if keyword:
        regex = {"$regex": keyword, "$options": "i"}
        query["$or"] = [{"email": regex}, {"full_name": regex}, {"phone": regex}]
        
    total = db.users.count_documents(query)
    raw_users = list(db.users.find(query).sort("created_at", -1).skip(skip).limit(limit))
    
    results = []
    for u in raw_users:
        uid = str(u["_id"])
        verif = db.seller_verifications.find_one({"user_id": uid}) if u["role"] == "seller" else None
        results.append({
            "id": uid,
            "email": u.get("email"),
            "full_name": u.get("full_name"),
            "phone": u.get("phone"),
            "role": u.get("role"),
            "status": u.get("status", "active"),
            "suspension_reason": u.get("suspension_reason"),
            "verification_status": verif.get("verification_status") if verif else None,
            "created_at": u.get("created_at")
        })
        
    return jsonify({
        "users": results,
        "pagination": {"page": page, "limit": limit, "total_count": total}
    }), 200

@admin_bp.route("/users/<user_id>/status", methods=["PUT"])
@jwt_required
@roles_required("admin")
def set_user_status(user_id):
    """
    Suspend or reinstate a user account with a recorded administrative reason.
    """
    data = request.get_json() or {}
    new_status = data.get("status") # active, suspended
    reason = (data.get("reason") or "").strip()
    
    if new_status not in ["active", "suspended"]:
        return jsonify({"error": "Status must be 'active' or 'suspended'."}), 400
        
    if new_status == "suspended" and not reason:
        return jsonify({"error": "A recorded reason is mandatory when suspending an artisan or buyer account."}), 400
        
    db = get_db()
    try:
        user = db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return jsonify({"error": "Invalid user ID"}), 400
        
    if not user:
        return jsonify({"error": "User not found."}), 404
        
    if user.get("role") == "admin":
        return jsonify({"error": "Root administrators cannot be suspended via this interface."}), 403
        
    now_iso = datetime.now(timezone.utc).isoformat()
    db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "status": new_status,
            "suspension_reason": reason if new_status == "suspended" else None,
            "status_updated_at": now_iso
        }}
    )
    
    log_audit(g.user_id, f"user_{new_status}", "users", user_id, {"reason": reason, "target_email": user.get("email")})
    
    return jsonify({
        "message": f"Account status updated to '{new_status}'.",
        "user_id": user_id,
        "status": new_status
    }), 200

@admin_bp.route("/verifications/pending", methods=["GET"])
@jwt_required
@roles_required("admin")
def list_pending_verifications():
    db = get_db()
    v_docs = list(db.seller_verifications.find({"verification_status": {"$in": ["pending", "needs_more_information"]}}).sort("updated_at", -1))
    
    results = []
    for v in v_docs:
        uid = v.get("user_id")
        user = db.users.find_one({"_id": ObjectId(uid)}) if ObjectId.is_valid(uid) else {}
        profile = db.seller_profiles.find_one({"user_id": uid}) or {}
        evidence_count = db.verification_evidence.count_documents({"user_id": uid})
        
        results.append({
            "user_id": uid,
            "seller_name": user.get("full_name") or profile.get("organization_name", "Artisan Producer"),
            "email": user.get("email"),
            "phone": user.get("phone"),
            "seller_type": profile.get("seller_type"),
            "craft_category": profile.get("craft_category"),
            "district": profile.get("district"),
            "state": profile.get("state"),
            "verification_status": v.get("verification_status"),
            "identity_verified": v.get("identity_verified", False),
            "evidence_count": evidence_count,
            "submission_notes": v.get("submission_notes", ""),
            "updated_at": v.get("updated_at")
        })
        
    return jsonify({"pending_verifications": results}), 200

@admin_bp.route("/duplicate-flags", methods=["GET"])
@jwt_required
@roles_required("admin")
def list_duplicate_flags():
    """
    Duplicate Image Review Queue:
    Presents flagged listings with similarity scores and side-by-side comparison details.
    """
    db = get_db()
    status_filter = request.args.get("status", "pending_review")
    
    query = {}
    if status_filter != "all":
        query["status"] = status_filter
        
    flags = list(db.duplicate_flags.find(query).sort("created_at", -1))
    results = []
    
    for f in flags:
        # Pre-fetch new seller & existing seller
        new_seller = db.users.find_one({"_id": ObjectId(f.get("new_seller_id"))}) if f.get("new_seller_id") else {}
        old_seller = db.users.find_one({"_id": ObjectId(f.get("existing_seller_id"))}) if f.get("existing_seller_id") else {}
        new_prod = db.products.find_one({"_id": ObjectId(f.get("new_product_id"))}) if f.get("new_product_id") else {}
        old_prod = db.products.find_one({"_id": ObjectId(f.get("existing_product_id"))}) if f.get("existing_product_id") else {}
        
        results.append({
            "id": str(f["_id"]),
            "status": f.get("status", "pending_review"),
            "similarity_score": f.get("similarity_score"),
            "hamming_distance": f.get("hamming_distance"),
            "new_product": {
                "id": f.get("new_product_id"),
                "title": new_prod.get("title", "Newly Created Listing"),
                "image_url": f.get("new_image_url"),
                "seller_name": new_seller.get("full_name", "Seller 1"),
                "seller_id": f.get("new_seller_id")
            },
            "existing_product": {
                "id": f.get("existing_product_id"),
                "title": old_prod.get("title", "Existing Catalog Listing"),
                "image_url": f.get("existing_image_url"),
                "seller_name": old_seller.get("full_name", "Seller 2"),
                "seller_id": f.get("existing_seller_id")
            },
            "reviewer_notes": f.get("reviewer_notes"),
            "created_at": f.get("created_at")
        })
        
    return jsonify({"duplicate_flags": results}), 200

@admin_bp.route("/duplicate-flags/<flag_id>/review", methods=["POST"])
@jwt_required
@roles_required("admin")
def review_duplicate_flag(flag_id):
    """
    Reviewer resolves flagged image as 'confirmed_duplicate', 'false_positive', or 'dismissed'.
    Does NOT automatically ban or suspend without explicit justification.
    """
    data = request.get_json() or {}
    decision = data.get("decision") # confirmed_duplicate, false_positive, dismissed
    notes = (data.get("notes") or "").strip()
    
    if decision not in ["confirmed_duplicate", "false_positive", "dismissed"]:
        return jsonify({"error": "Decision must be 'confirmed_duplicate', 'false_positive', or 'dismissed'."}), 400
        
    db = get_db()
    try:
        flag = db.duplicate_flags.find_one({"_id": ObjectId(flag_id)})
    except Exception:
        return jsonify({"error": "Invalid flag ID"}), 400
        
    if not flag:
        return jsonify({"error": "Duplicate flag not found."}), 404
        
    now_iso = datetime.now(timezone.utc).isoformat()
    db.duplicate_flags.update_one(
        {"_id": ObjectId(flag_id)},
        {"$set": {
            "status": decision,
            "reviewer_id": g.user_id,
            "reviewer_notes": notes,
            "updated_at": now_iso
        }}
    )
    
    log_audit(g.user_id, "duplicate_flag_reviewed", "duplicate_flags", flag_id, {"decision": decision, "notes": notes})
    
    return jsonify({"message": f"Flag marked as '{decision}'.", "status": decision}), 200

@admin_bp.route("/audit-logs", methods=["GET"])
@jwt_required
@roles_required("admin")
def get_audit_logs():
    db = get_db()
    limit = min(100, request.args.get("limit", 40, type=int))
    logs = list(db.audit_logs.find({}).sort("timestamp", -1).limit(limit))
    
    results = []
    for entry in logs:
        results.append({
            "id": str(entry["_id"]),
            "user_id": entry.get("user_id"),
            "action": entry.get("action"),
            "resource_type": entry.get("resource_type"),
            "resource_id": entry.get("resource_id"),
            "details": entry.get("details", {}),
            "ip_address": entry.get("ip_address"),
            "timestamp": entry.get("timestamp")
        })
    return jsonify({"audit_logs": results}), 200
