from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from db import get_db, log_audit
from routes.auth_helpers import jwt_required, roles_required, decode_jwt_token
from services.matching_engine import find_bulk_matches
from services.collective_pooling import plan_collective_pool
from services.ai_service import parse_natural_language_buyer_query

matching_bp = Blueprint("matching", __name__, url_prefix="/api/matching")

@matching_bp.route("/requirements", methods=["POST"])
@jwt_required
@roles_required("buyer", "admin")
def create_requirement():
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    category = (data.get("category") or "").strip()
    quantity = int(data.get("quantity") or 0)
    
    if not title or not category or quantity <= 0:
        return jsonify({"error": "Title, category, and a positive quantity are required."}), 400
        
    db = get_db()
    buyer_id = g.user_id
    now_iso = datetime.now(timezone.utc).isoformat()
    
    req_doc = {
        "buyer_id": buyer_id,
        "title": title,
        "category": category,
        "description": data.get("description", ""),
        "quantity": quantity,
        "unit": (data.get("unit") or "units").strip(),
        "target_unit_price": float(data.get("target_unit_price") or 0),
        "max_budget": float(data.get("max_budget") or 0),
        "destination_city": data.get("destination_city", ""),
        "destination_state": data.get("destination_state", "Tamil Nadu"),
        "delivery_deadline": data.get("delivery_deadline", ""),
        "max_lead_time_days": int(data.get("max_lead_time_days") or 30),
        "quality_specifications": data.get("quality_specifications", ""),
        "status": "open", # open, in_negotiation, fulfilled, cancelled
        "created_at": now_iso,
        "updated_at": now_iso
    }
    res = db.buyer_requirements.insert_one(req_doc)
    req_id = str(res.inserted_id)
    
    log_audit(buyer_id, "requirement_created", "buyer_requirements", req_id, {"title": title, "quantity": quantity})
    
    # Run immediate matching to give instant supplier recommendations
    matches = find_bulk_matches(req_doc, limit=5)
    
    return jsonify({
        "message": "Bulk purchase requirement posted successfully.",
        "requirement_id": req_id,
        "initial_matches": matches
    }), 201

@matching_bp.route("/requirements", methods=["GET"])
def list_requirements():
    db = get_db()
    status_filter = request.args.get("status", "open")
    buyer_filter = request.args.get("buyer_id")
    category = request.args.get("category")
    my_filter = request.args.get("my")
    
    # Check for authenticated buyer token if my=true
    if my_filter in ["true", "1", True]:
        auth_header = request.headers.get("Authorization", "")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                token = auth_header.split(" ")[1]
                payload = decode_jwt_token(token)
                buyer_filter = str(payload.get("sub", ""))
            except Exception:
                pass

    query = {}
    if status_filter and status_filter != "all":
        query["status"] = status_filter
    if buyer_filter:
        query["buyer_id"] = buyer_filter
    if category and category != "all":
        query["category"] = category
        
    items = list(db.buyer_requirements.find(query).sort("created_at", -1).limit(50))
    results = []
    
    buyer_ids = list(set(item.get("buyer_id") for item in items if item.get("buyer_id")))
    buyer_users = {str(u["_id"]): u for u in db.users.find({"_id": {"$in": [ObjectId(b) for b in buyer_ids if ObjectId.is_valid(b)]}})}
    buyer_profiles = {b["user_id"]: b for b in db.buyer_profiles.find({"user_id": {"$in": buyer_ids}})}
    
    for item in items:
        bid = item.get("buyer_id")
        user = buyer_users.get(bid, {})
        prof = buyer_profiles.get(bid, {})
        
        results.append({
            "id": str(item["_id"]),
            "title": item.get("title"),
            "category": item.get("category"),
            "description": item.get("description"),
            "quantity": item.get("quantity"),
            "unit": item.get("unit", "units"),
            "target_unit_price": item.get("target_unit_price"),
            "max_budget": item.get("max_budget"),
            "destination_city": item.get("destination_city"),
            "destination_state": item.get("destination_state"),
            "delivery_deadline": item.get("delivery_deadline"),
            "max_lead_time_days": item.get("max_lead_time_days"),
            "quality_specifications": item.get("quality_specifications"),
            "status": item.get("status", "open"),
            "created_at": item.get("created_at"),
            "buyer_id": bid,
            "buyer": {
                "id": bid,
                "name": user.get("full_name") or prof.get("business_name", "Enterprise Buyer"),
                "buyer_type": prof.get("buyer_type", "business"),
                "city": prof.get("city", "")
            }
        })
        
    return jsonify({"requirements": results}), 200

@matching_bp.route("/requirements/<req_id>", methods=["GET"])
def get_requirement(req_id):
    db = get_db()
    try:
        r = db.buyer_requirements.find_one({"_id": ObjectId(req_id)})
    except Exception:
        return jsonify({"error": "Invalid requirement ID"}), 400
        
    if not r:
        return jsonify({"error": "Requirement not found"}), 404
        
    bid = r.get("buyer_id")
    buyer_user = db.users.find_one({"_id": ObjectId(bid)}) or {}
    b_profile = db.buyer_profiles.find_one({"user_id": bid}) or {}
    
    # Run bulk matching for this requirement
    matches = find_bulk_matches(r, limit=8)
    
    result = {
        "id": str(r["_id"]),
        "title": r.get("title"),
        "category": r.get("category"),
        "description": r.get("description"),
        "quantity": r.get("quantity"),
        "unit": r.get("unit", "units"),
        "target_unit_price": r.get("target_unit_price"),
        "max_budget": r.get("max_budget"),
        "destination_city": r.get("destination_city"),
        "destination_state": r.get("destination_state"),
        "delivery_deadline": r.get("delivery_deadline"),
        "max_lead_time_days": r.get("max_lead_time_days"),
        "quality_specifications": r.get("quality_specifications"),
        "status": r.get("status", "open"),
        "created_at": r.get("created_at"),
        "buyer": {
            "id": bid,
            "name": buyer_user.get("full_name") or b_profile.get("business_name", "Wholesale Buyer"),
            "buyer_type": b_profile.get("buyer_type", "business"),
            "city": b_profile.get("city", "")
        },
        "matches": matches
    }
    return jsonify({"requirement": result}), 200

@matching_bp.route("/find-suppliers", methods=["POST"])
def api_find_suppliers():
    data = request.get_json() or {}
    req_id = data.get("requirement_id")
    
    if req_id:
        db = get_db()
        req_doc = db.buyer_requirements.find_one({"_id": ObjectId(req_id)})
        if not req_doc:
            return jsonify({"error": "Requirement not found"}), 404
        matches = find_bulk_matches(req_doc, limit=int(data.get("limit", 10)))
        return jsonify({"matches": matches, "requirement_id": req_id}), 200
    else:
        # Ad-hoc criteria search
        matches = find_bulk_matches(data, limit=int(data.get("limit", 10)))
        return jsonify({"matches": matches}), 200

@matching_bp.route("/nlp-search", methods=["POST"])
def api_nlp_search():
    """
    Natural Language Search Assistant:
    Parses conversational queries into structured parameters and executes the matching engine.
    """
    data = request.get_json() or {}
    query_text = (data.get("query") or "").strip()
    if not query_text:
        return jsonify({"error": "Query text cannot be empty."}), 400
        
    parsed = parse_natural_language_buyer_query(query_text)
    structured_criteria = {
        "category": parsed["extracted_filters"]["category"],
        "quantity": parsed["extracted_filters"]["quantity"] or 100,
        "target_unit_price": parsed["extracted_filters"]["max_unit_budget_inr"],
        "max_lead_time_days": parsed["extracted_filters"]["max_lead_time_days"] or 30,
        "title": query_text,
        "description": parsed["extracted_filters"]["material"] or ""
    }
    
    matches = find_bulk_matches(structured_criteria, limit=10)
    
    return jsonify({
        "original_query": query_text,
        "parsed_filters": parsed["extracted_filters"],
        "ai_powered": parsed["ai_powered"],
        "matching_method": "Multi-Factor Weighted Artisan Engine",
        "matches_count": len(matches),
        "results": matches
    }), 200

@matching_bp.route("/collective-pool-plan", methods=["POST"])
@jwt_required
def api_collective_pool_plan():
    data = request.get_json() or {}
    req_id = data.get("requirement_id")
    qty = int(data.get("quantity") or 0)
    max_budget = float(data.get("max_budget_per_unit") or 0)
    
    if not req_id or qty <= 0:
        return jsonify({"error": "Requirement ID and a positive quantity are required."}), 400
        
    plan = plan_collective_pool(req_id, qty, max_budget_per_unit=max_budget if max_budget > 0 else None)
    return jsonify({"plan": plan}), 200
