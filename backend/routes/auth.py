from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone
from bson import ObjectId
from db import get_db, log_audit
from routes.auth_helpers import (
    hash_password, verify_password, create_jwt_token,
    validate_email, validate_indian_phone, jwt_required, check_rate_limit
)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    
    # Rate limit check by client IP
    client_ip = request.remote_addr or "127.0.0.1"
    if not check_rate_limit(f"reg_{client_ip}", max_attempts=10, window_seconds=60):
        return jsonify({"error": "Too many registration attempts. Please wait a minute."}), 429

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = (data.get("role") or "").strip().lower()
    full_name = (data.get("full_name") or "").strip()
    phone = (data.get("phone") or "").strip()
    preferred_language = data.get("preferred_language", "en")
    
    # 1. Reject attempts to create admin via public endpoint
    if role == "admin" or data.get("is_admin"):
        return jsonify({"error": "Public registration of administrator accounts is strictly forbidden."}), 403
        
    if role not in ["seller", "buyer"]:
        return jsonify({"error": "Invalid role. Role must be 'seller' or 'buyer'."}), 400
        
    if not validate_email(email):
        return jsonify({"error": "Please provide a valid email address."}), 400
        
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long."}), 400
        
    if not full_name:
        return jsonify({"error": "Full name is required."}), 400
        
    if phone and not validate_indian_phone(phone):
        return jsonify({"error": "Please enter a valid 10-digit Indian phone number."}), 400
        
    db = get_db()
    existing_user = db.users.find_one({"email": email})
    if existing_user:
        return jsonify({"error": "An account with this email address already exists."}), 409
        
    now_iso = datetime.now(timezone.utc).isoformat()
    pwd_hash = hash_password(password)
    
    user_doc = {
        "email": email,
        "password_hash": pwd_hash,
        "role": role,
        "full_name": full_name,
        "phone": phone,
        "status": "active",
        "preferred_language": preferred_language,
        "created_at": now_iso,
        "updated_at": now_iso
    }
    user_res = db.users.insert_one(user_doc)
    user_id = str(user_res.inserted_id)
    
    # Role-specific profile initialization
    if role == "seller":
        seller_type = data.get("seller_type", "individual_producer")
        seller_profile = {
            "user_id": user_id,
            "organization_name": data.get("organization_name") or full_name,
            "seller_type": seller_type, # individual_producer, producer_group, self_help_group, cooperative, reseller
            "craft_category": data.get("craft_category", "Handloom & Textiles"),
            "craft_description": data.get("craft_description", ""),
            "address": data.get("address", ""),
            "district": data.get("district", ""),
            "state": data.get("state", "Tamil Nadu"),
            "pincode": data.get("pincode", ""),
            "artisan_id_number": data.get("artisan_id_number", ""),
            "annual_production_capacity": int(data.get("annual_production_capacity") or 500),
            "workshop_details": data.get("workshop_details", ""),
            "created_at": now_iso,
            "updated_at": now_iso
        }
        db.seller_profiles.insert_one(seller_profile)
        
        # Initialize verification state
        verification_doc = {
            "user_id": user_id,
            "verification_status": "unverified",
            "identity_verified": False,
            "producer_evidence_reviewed": False,
            "decision_history": [],
            "created_at": now_iso,
            "updated_at": now_iso
        }
        db.seller_verifications.insert_one(verification_doc)
        
    elif role == "buyer":
        buyer_profile = {
            "user_id": user_id,
            "buyer_type": data.get("buyer_type", "business"), # individual, wholesaler, retailer, business, institution, exporter
            "business_name": data.get("business_name") or full_name,
            "gstin": data.get("gstin", ""),
            "address": data.get("address", ""),
            "city": data.get("city", ""),
            "state": data.get("state", "Tamil Nadu"),
            "pincode": data.get("pincode", ""),
            "intended_categories": data.get("intended_categories", []),
            "created_at": now_iso,
            "updated_at": now_iso
        }
        db.buyer_profiles.insert_one(buyer_profile)
        
    log_audit(user_id, "user_register", "users", user_id, {"role": role, "email": email}, client_ip)
    
    token = create_jwt_token(user_id, role, email)
    return jsonify({
        "message": "Account created successfully",
        "token": token,
        "user": {
            "id": user_id,
            "email": email,
            "role": role,
            "full_name": full_name,
            "preferred_language": preferred_language
        }
    }), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    client_ip = request.remote_addr or "127.0.0.1"
    
    # Rate limit check
    if not check_rate_limit(f"login_{client_ip}", max_attempts=15, window_seconds=60):
        return jsonify({"error": "Too many login attempts. Please wait a minute before retrying."}), 429
        
    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400
        
    db = get_db()
    user = db.users.find_one({"email": email})
    if not user or not verify_password(user.get("password_hash", ""), password):
        log_audit(None, "login_failed", "users", None, {"email": email}, client_ip)
        return jsonify({"error": "Invalid email or password."}), 401
        
    if user.get("status") == "suspended":
        return jsonify({"error": "Your account has been suspended by administration. Please contact support."}), 403
        
    user_id = str(user["_id"])
    role = user.get("role", "buyer")
    token = create_jwt_token(user_id, role, email)
    
    log_audit(user_id, "login_success", "users", user_id, {"email": email}, client_ip)
    
    # Fetch additional profile information
    profile_data = {}
    verification_status = "unverified"
    now_iso = datetime.now(timezone.utc).isoformat()
    if role == "seller":
        s_profile = db.seller_profiles.find_one({"user_id": user_id})
        if not s_profile:
            s_profile = {
                "user_id": user_id,
                "organization_name": user.get("full_name", "Artisan Producer"),
                "seller_type": "individual_producer",
                "craft_category": "Handloom & Textiles",
                "craft_description": "",
                "address": "",
                "district": "",
                "state": "Tamil Nadu",
                "pincode": "",
                "annual_production_capacity": 500,
                "workshop_details": "",
                "created_at": now_iso,
                "updated_at": now_iso
            }
            db.seller_profiles.insert_one(s_profile)
            
        v_doc = db.seller_verifications.find_one({"user_id": user_id})
        if not v_doc:
            v_doc = {
                "user_id": user_id,
                "verification_status": "unverified",
                "current_step": 1,
                "identity_verified": False,
                "producer_evidence_reviewed": False,
                "decision_history": [],
                "created_at": now_iso,
                "updated_at": now_iso
            }
            db.seller_verifications.insert_one(v_doc)
            
        verification_status = v_doc.get("verification_status", "unverified")
        profile_data = {
            "seller_type": s_profile.get("seller_type"),
            "organization_name": s_profile.get("organization_name"),
            "craft_category": s_profile.get("craft_category"),
            "verification_status": verification_status
        }
    elif role == "buyer":
        b_profile = db.buyer_profiles.find_one({"user_id": user_id})
        if not b_profile:
            b_profile = {
                "user_id": user_id,
                "buyer_type": "business",
                "business_name": user.get("full_name", "Wholesale Buyer"),
                "created_at": now_iso,
                "updated_at": now_iso
            }
            db.buyer_profiles.insert_one(b_profile)
        profile_data = {
            "buyer_type": b_profile.get("buyer_type"),
            "business_name": b_profile.get("business_name")
        }

    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user_id,
            "email": user["email"],
            "role": role,
            "full_name": user.get("full_name", ""),
            "phone": user.get("phone", ""),
            "preferred_language": user.get("preferred_language", "en"),
            "verification_status": verification_status,
            **profile_data
        }
    }), 200

@auth_bp.route("/me", methods=["GET"])
@jwt_required
def get_current_user():
    user = g.current_user
    user_id = str(user["_id"])
    role = user["role"]
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    
    resp_user = {
        "id": user_id,
        "email": user["email"],
        "role": role,
        "full_name": user.get("full_name", ""),
        "phone": user.get("phone", ""),
        "preferred_language": user.get("preferred_language", "en"),
        "status": user.get("status", "active"),
        "created_at": user.get("created_at")
    }
    
    if role == "seller":
        profile = db.seller_profiles.find_one({"user_id": user_id})
        if not profile:
            profile = {
                "user_id": user_id,
                "organization_name": user.get("full_name", "Artisan Producer"),
                "seller_type": "individual_producer",
                "craft_category": "Handloom & Textiles",
                "craft_description": "",
                "address": "",
                "district": "",
                "state": "Tamil Nadu",
                "pincode": "",
                "annual_production_capacity": 500,
                "workshop_details": "",
                "created_at": now_iso,
                "updated_at": now_iso
            }
            db.seller_profiles.insert_one(profile)
            
        v_doc = db.seller_verifications.find_one({"user_id": user_id})
        if not v_doc:
            v_doc = {
                "user_id": user_id,
                "verification_status": "unverified",
                "current_step": 1,
                "identity_verified": False,
                "producer_evidence_reviewed": False,
                "decision_history": [],
                "created_at": now_iso,
                "updated_at": now_iso
            }
            db.seller_verifications.insert_one(v_doc)
            
        v_status = v_doc.get("verification_status", "unverified")
        resp_user["verification_status"] = v_status
        resp_user["seller_type"] = profile.get("seller_type")
        resp_user["organization_name"] = profile.get("organization_name")
        resp_user["craft_category"] = profile.get("craft_category")
        
        profile.pop("_id", None)
        v_doc.pop("_id", None)
        resp_user["profile"] = profile
        resp_user["verification"] = v_doc
    elif role == "buyer":
        profile = db.buyer_profiles.find_one({"user_id": user_id})
        if not profile:
            profile = {
                "user_id": user_id,
                "buyer_type": "business",
                "business_name": user.get("full_name", "Wholesale Buyer"),
                "created_at": now_iso,
                "updated_at": now_iso
            }
            db.buyer_profiles.insert_one(profile)
        resp_user["buyer_type"] = profile.get("buyer_type")
        resp_user["business_name"] = profile.get("business_name")
        profile.pop("_id", None)
        resp_user["profile"] = profile
        
    return jsonify({"user": resp_user}), 200

@auth_bp.route("/change-password", methods=["POST"])
@jwt_required
def change_password():
    data = request.get_json() or {}
    old_pwd = data.get("old_password") or ""
    new_pwd = data.get("new_password") or ""
    
    if len(new_pwd) < 8:
        return jsonify({"error": "New password must be at least 8 characters long."}), 400
        
    user = g.current_user
    if not verify_password(user.get("password_hash", ""), old_pwd):
        return jsonify({"error": "Current password is incorrect."}), 400
        
    db = get_db()
    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_hash": hash_password(new_pwd),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    log_audit(g.user_id, "password_changed", "users", g.user_id)
    return jsonify({"message": "Password changed successfully."}), 200

@auth_bp.route("/logout", methods=["POST"])
def logout():
    # Client will discard the JWT token
    return jsonify({"message": "Logged out successfully"}), 200
