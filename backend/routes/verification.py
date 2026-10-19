import os
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g, send_from_directory
from werkzeug.utils import secure_filename
from bson import ObjectId
from config import Config
from db import get_db, log_audit, save_mock_state
from routes.auth_helpers import jwt_required, roles_required

SELLER_ROLES = ("seller", "artisan", "producer", "artisan_seller", "admin")

verification_bp = Blueprint("verification", __name__, url_prefix="/api/verification")

ALLOWED_DOC_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "pdf"}
ALLOWED_VIDEO_EXTENSIONS = {"mp4", "webm", "mov", "mkv"}
ALLOWED_EXTENSIONS = ALLOWED_DOC_EXTENSIONS.union(ALLOWED_VIDEO_EXTENSIONS)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def is_video_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_VIDEO_EXTENSIONS

@verification_bp.route("/application", methods=["GET"])
@jwt_required
def get_verification_application():
    """
    Retrieves full 4-step verification application for the seller.
    Admins can supply ?user_id=<seller_id> to inspect an applicant's dossier.
    Non-admins can only inspect their own application dossier.
    """
    target_user_id = request.args.get("user_id")
    if target_user_id and target_user_id != g.user_id:
        if g.role != "admin":
            return jsonify({"error": "Access denied: You are not authorized to view another user's verification application."}), 403
        user_id = target_user_id
    else:
        user_id = g.user_id
        
    db = get_db()
    user = db.users.find_one({"_id": ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None
    if not user:
        return jsonify({"error": "User account not found."}), 404
        
    s_profile = db.seller_profiles.find_one({"user_id": user_id}) or {}
    verif = db.seller_verifications.find_one({"user_id": user_id})
    
    now_iso = datetime.now(timezone.utc).isoformat()
    if not verif:
        verif = {
            "user_id": user_id,
            "verification_status": "not_started",
            "current_step": 1,
            "artisan_profile": {
                "full_name": user.get("full_name", ""),
                "phone": user.get("phone", ""),
                "email": user.get("email", ""),
                "address": s_profile.get("address", ""),
                "district": s_profile.get("district", ""),
                "state": s_profile.get("state", "Tamil Nadu"),
                "pincode": s_profile.get("pincode", ""),
                "craft_category": s_profile.get("craft_category", "Handloom & Textiles"),
                "production_method": s_profile.get("production_method", "Handcrafted"),
                "materials_used": s_profile.get("materials_used", "Natural materials"),
                "years_of_experience": s_profile.get("years_of_experience", 5),
                "workshop_details": s_profile.get("workshop_details", ""),
                "seller_type": s_profile.get("seller_type", "individual_producer"),
                "annual_production_capacity": s_profile.get("annual_production_capacity", 500)
            },
            "identity_verified": False,
            "producer_evidence_reviewed": False,
            "submission_notes": "",
            "decision_history": [],
            "created_at": now_iso,
            "updated_at": now_iso
        }
        db.seller_verifications.insert_one(verif)
        
    # Get all evidence items
    evidence_docs = list(db.verification_evidence.find({"user_id": user_id}).sort("created_at", -1))
    
    documents = []
    craft_video = None
    
    for doc in evidence_docs:
        doc_id = str(doc["_id"])
        item = {
            "id": doc_id,
            "evidence_type": doc.get("evidence_type", "artisan_id_card"),
            "description": doc.get("description", ""),
            "original_filename": doc.get("original_filename", "evidence_file"),
            "file_url": f"/api/verification/evidence/{doc_id}",
            "file_size": doc.get("file_size", 0),
            "is_video": doc.get("is_video", False),
            "created_at": doc.get("created_at")
        }
        if doc.get("is_video") or doc.get("evidence_type") == "craft_video":
            if not craft_video:
                craft_video = item
            else:
                documents.append(item)
        else:
            documents.append(item)
            
    # Resolve status
    raw_status = verif.get("verification_status", "not_started")
    normalized_status = raw_status
    if raw_status in ["verified_producer", "verified_group", "approved"]:
        normalized_status = "approved"
    elif raw_status in ["pending", "under_review"]:
        normalized_status = "pending"
    elif raw_status in ["unverified"]:
        normalized_status = "not_started" if verif.get("current_step", 1) == 1 and len(evidence_docs) == 0 else "draft"
        
    # Get default profile values if empty
    profile = verif.get("artisan_profile") or {}
    if not profile.get("full_name"):
        profile["full_name"] = user.get("full_name", "")
    if not profile.get("phone"):
        profile["phone"] = user.get("phone", "")
    if not profile.get("email"):
        profile["email"] = user.get("email", "")
    if not profile.get("state"):
        profile["state"] = s_profile.get("state", "Tamil Nadu")
    if not profile.get("craft_category"):
        profile["craft_category"] = s_profile.get("craft_category", "Handloom & Textiles")
    if not profile.get("production_method"):
        profile["production_method"] = s_profile.get("production_method", "Handcrafted")
    if not profile.get("materials_used"):
        profile["materials_used"] = s_profile.get("materials_used", "Natural materials")
    if not profile.get("seller_type"):
        profile["seller_type"] = s_profile.get("seller_type", "individual_producer")
        
    all_evidence = list(documents)
    if craft_video:
        all_evidence.append(craft_video)
        
    clean_seller_profile = dict(s_profile)
    if "_id" in clean_seller_profile:
        clean_seller_profile["id"] = str(clean_seller_profile.pop("_id"))

    return jsonify({
        "application": {
            "user_id": user_id,
            "status": normalized_status,
            "verification_status": normalized_status,
            "raw_status": raw_status,
            "current_step": verif.get("current_step", 1),
            "artisan_profile": profile,
            "documents": documents,
            "craft_video": craft_video,
            "submission_notes": verif.get("submission_notes", ""),
            "submitted_at": verif.get("submitted_at"),
            "reviewed_at": verif.get("reviewed_at"),
            "rejection_reason": verif.get("rejection_reason", ""),
            "decision_history": verif.get("decision_history", []),
            "updated_at": verif.get("updated_at")
        },
        "seller_profile": clean_seller_profile,
        "user": {
            "id": user_id,
            "full_name": user.get("full_name", ""),
            "email": user.get("email", ""),
            "role": user.get("role", "seller")
        },
        "evidence": all_evidence
    }), 200

@verification_bp.route("/status", methods=["GET"])
@jwt_required
def get_verification_status():
    """
    Backwards-compatible lightweight endpoint returning verification state.
    """
    user_id = request.args.get("user_id") if g.role == "admin" else g.user_id
    db = get_db()
    verif = db.seller_verifications.find_one({"user_id": user_id})
    if not verif:
        return jsonify({"verification": {"verification_status": "unverified", "evidence_list": []}}), 200
        
    evidence_docs = list(db.verification_evidence.find({"user_id": user_id}))
    evidence_list = []
    for doc in evidence_docs:
        evidence_list.append({
            "id": str(doc["_id"]),
            "evidence_type": doc.get("evidence_type"),
            "description": doc.get("description"),
            "original_filename": doc.get("original_filename"),
            "file_url": f"/api/verification/evidence/{doc['_id']}",
            "created_at": doc.get("created_at")
        })
        
    res = {
        "user_id": user_id,
        "verification_status": verif.get("verification_status", "unverified"),
        "identity_verified": verif.get("identity_verified", False),
        "producer_evidence_reviewed": verif.get("producer_evidence_reviewed", False),
        "decision_history": verif.get("decision_history", []),
        "evidence_list": evidence_list,
        "updated_at": verif.get("updated_at")
    }
    return jsonify({"verification": res}), 200

@verification_bp.route("/application/save-step", methods=["POST"])
@jwt_required
@roles_required(*SELLER_ROLES)
def save_application_step():
    """
    Saves progress for a specific step (1: Profile, 2: Documents, 3: Video, 4: Notes)
    """
    data = request.get_json() or {}
    step = int(data.get("step") or 1)
    db = get_db()
    user_id = g.user_id
    now_iso = datetime.now(timezone.utc).isoformat()
    
    verif = db.seller_verifications.find_one({"user_id": user_id}) or {}
    current_status = verif.get("verification_status", "not_started")
    
    update_fields = {
        "current_step": step,
        "updated_at": now_iso
    }
    
    # Transition not_started -> draft; if user specifically asks to reopen_draft or revise, do so
    if current_status in ["not_started", "unverified"]:
        update_fields["verification_status"] = "draft"
    elif data.get("action") in ["reopen_draft", "revise"]:
        update_fields["verification_status"] = "draft"
        
    if "artisan_profile" in data or ("data" in data and step == 1):
        prof = data.get("artisan_profile") or data.get("data") or {}
        update_fields["artisan_profile"] = prof
        # Sync back essential fields to seller_profile
        db.seller_profiles.update_one(
            {"user_id": user_id},
            {"$set": {
                "organization_name": prof.get("full_name") or g.current_user.get("full_name"),
                "seller_type": prof.get("seller_type", "individual_producer"),
                "craft_category": prof.get("craft_category", "Handloom & Textiles"),
                "production_method": prof.get("production_method", "Handcrafted"),
                "materials_used": prof.get("materials_used", ""),
                "craft_description": prof.get("workshop_details", ""),
                "workshop_details": prof.get("workshop_details", ""),
                "address": prof.get("address", ""),
                "district": prof.get("district", ""),
                "state": prof.get("state", "Tamil Nadu"),
                "pincode": prof.get("pincode", ""),
                "years_of_experience": prof.get("years_of_experience") or prof.get("years_experience", 5),
                "annual_production_capacity": prof.get("annual_production_capacity", 500),
                "updated_at": now_iso
            }},
            upsert=True
        )
        
    if "submission_notes" in data:
        update_fields["submission_notes"] = data["submission_notes"]
    elif "data" in data and step == 4:
        update_fields["submission_notes"] = data["data"].get("notes", "")
        
    db.seller_verifications.update_one(
        {"user_id": user_id},
        {"$set": update_fields},
        upsert=True
    )
    save_mock_state()
    
    status_val = update_fields.get("verification_status", current_status)
    return jsonify({
        "message": f"Step {step} saved successfully.",
        "current_step": step,
        "verification_status": status_val,
        "application": {
            "current_step": step,
            "status": status_val,
            "verification_status": status_val
        }
    }), 200

@verification_bp.route("/application/reopen-draft", methods=["POST"])
@jwt_required
@roles_required(*SELLER_ROLES)
def reopen_verification_draft():
    """
    Allows an artisan to reopen a submitted or pending application as a draft to revise details.
    """
    user_id = g.user_id
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    verif = db.seller_verifications.find_one({"user_id": user_id})
    if not verif:
        return jsonify({"error": "No verification application found."}), 404

    db.seller_verifications.update_one(
        {"user_id": user_id},
        {"$set": {"verification_status": "draft", "updated_at": now_iso}}
    )
    save_mock_state()
    return jsonify({
        "message": "Application reopened as draft. You can now edit and resubmit.",
        "verification_status": "draft"
    }), 200

@verification_bp.route("/upload-evidence", methods=["POST"])
@jwt_required
@roles_required(*SELLER_ROLES)
def upload_evidence():
    """
    Handles uploading supporting documents and craft-proof videos.
    Saves to persistent Config.EVIDENCE_UPLOAD_FOLDER with UUID.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded in form data."}), 400
        
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file."}), 400
        
    if not allowed_file(file.filename):
        return jsonify({"error": "Unsupported file format. Allowed: PNG, JPG, JPEG, WEBP, PDF, MP4, WEBM, MOV."}), 400
        
    evidence_type = request.form.get("evidence_type", "artisan_id_card")
    description = request.form.get("description", "")
    
    is_video = is_video_file(file.filename) or evidence_type == "craft_video"
    ext = file.filename.rsplit(".", 1)[1].lower()
    safe_filename = f"evid_{'vid_' if is_video else 'doc_'}{uuid.uuid4().hex[:12]}.{ext}"
    
    os.makedirs(Config.EVIDENCE_UPLOAD_FOLDER, exist_ok=True)
    save_path = os.path.join(Config.EVIDENCE_UPLOAD_FOLDER, safe_filename)
    file.save(save_path)
    file_size = os.path.getsize(save_path) if os.path.exists(save_path) else 0
    
    now_iso = datetime.now(timezone.utc).isoformat()
    db = get_db()
    
    # If uploading a new craft video, delete existing video to prevent clutter
    if is_video:
        existing_vids = list(db.verification_evidence.find({
            "user_id": g.user_id,
            "$or": [{"is_video": True}, {"evidence_type": "craft_video"}]
        }))
        for ev in existing_vids:
            try:
                old_path = os.path.join(Config.EVIDENCE_UPLOAD_FOLDER, ev.get("file_name", ""))
                if os.path.exists(old_path):
                    os.remove(old_path)
            except Exception:
                pass
            db.verification_evidence.delete_one({"_id": ev["_id"]})
            
    doc = {
        "user_id": g.user_id,
        "evidence_type": evidence_type,
        "description": description,
        "original_filename": file.filename,
        "file_name": safe_filename,
        "file_size": file_size,
        "is_video": is_video,
        "is_private": True,
        "created_at": now_iso
    }
    res = db.verification_evidence.insert_one(doc)
    doc_id = str(res.inserted_id)
    
    # Mark status as draft if not started
    db.seller_verifications.update_one(
        {"user_id": g.user_id},
        {"$set": {"updated_at": now_iso}},
        upsert=True
    )
    
    log_audit(g.user_id, "evidence_uploaded", "verification_evidence", doc_id, {"type": evidence_type, "is_video": is_video})
    
    evidence_obj = {
        "id": doc_id,
        "evidence_id": doc_id,
        "file_url": f"/api/verification/evidence/{doc_id}",
        "original_filename": file.filename,
        "evidence_type": evidence_type,
        "is_video": is_video,
        "file_size": file_size
    }
    return jsonify({
        "message": "File uploaded successfully.",
        "evidence_id": doc_id,
        "evidence": evidence_obj,
        "file_url": f"/api/verification/evidence/{doc_id}",
        "original_filename": file.filename,
        "evidence_type": evidence_type,
        "is_video": is_video,
        "file_size": file_size
    }), 201

@verification_bp.route("/evidence/<evidence_id>", methods=["DELETE"])
@jwt_required
@roles_required(*SELLER_ROLES)
def delete_evidence(evidence_id):
    """
    Deletes an uploaded document or video from the application before submission.
    """
    db = get_db()
    try:
        doc = db.verification_evidence.find_one({"_id": ObjectId(evidence_id)})
    except Exception:
        return jsonify({"error": "Invalid evidence ID format."}), 400
        
    if not doc:
        return jsonify({"error": "Evidence item not found."}), 404
        
    if doc.get("user_id") != g.user_id and g.role != "admin":
        return jsonify({"error": "Permission denied."}), 403
        
    # Remove file from disk
    file_name = doc.get("file_name")
    if file_name:
        path = os.path.join(Config.EVIDENCE_UPLOAD_FOLDER, file_name)
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass
                
    db.verification_evidence.delete_one({"_id": ObjectId(evidence_id)})
    save_mock_state()
    log_audit(g.user_id, "evidence_deleted", "verification_evidence", evidence_id)
    
    return jsonify({"message": "Evidence removed successfully."}), 200

@verification_bp.route("/evidence/<evidence_id>", methods=["GET"])
@jwt_required
def get_private_evidence(evidence_id):
    """
    Secure file access: Strictly authorized only to document owner or authorized administrators.
    """
    db = get_db()
    try:
        doc = db.verification_evidence.find_one({"_id": ObjectId(evidence_id)})
    except Exception:
        return jsonify({"error": "Invalid evidence ID format."}), 400
        
    if not doc:
        return jsonify({"error": "Evidence document not found."}), 404
        
    if g.role != "admin" and doc.get("user_id") != g.user_id:
        return jsonify({"error": "Access denied: Verification documents are strictly confidential."}), 403
        
    filename = doc.get("file_name")
    if not filename or not os.path.exists(os.path.join(Config.EVIDENCE_UPLOAD_FOLDER, filename)):
        return jsonify({"error": "File not found on server storage."}), 404
        
    return send_from_directory(Config.EVIDENCE_UPLOAD_FOLDER, filename)

@verification_bp.route("/submit-application", methods=["POST"])
@jwt_required
@roles_required(*SELLER_ROLES)
def submit_verification_application():
    """
    Submits the 4-step artisan verification application for admin review.
    Validates complete profile, at least 1 document, and craft video.
    Allows updating/resubmitting if already pending or rejected.
    """
    data = request.get_json() or {}
    db = get_db()
    user_id = g.user_id
    now_iso = datetime.now(timezone.utc).isoformat()
    
    verif = db.seller_verifications.find_one({"user_id": user_id}) or {}
    current_status = verif.get("verification_status", "not_started")
    if current_status == "pending":
        return jsonify({"error": "Your application has already been submitted and is currently pending review. You can reopen it as a draft if you need to make changes."}), 400
    if current_status == "approved":
        return jsonify({"error": "Your producer profile is already verified and approved."}), 400
    is_resubmission = current_status in ["rejected", "needs_more_information"]
        
    # Profile validation
    profile = data.get("artisan_profile") or verif.get("artisan_profile") or {}
    full_name = (profile.get("full_name") or g.current_user.get("full_name") or "").strip()
    phone = (profile.get("phone") or g.current_user.get("phone") or "").strip()
    craft_category = (profile.get("craft_category") or "").strip()
    district = (profile.get("district") or "").strip()
    state = (profile.get("state") or "Tamil Nadu").strip()
    workshop_details = (profile.get("workshop_details") or "").strip()
    
    if not full_name:
        return jsonify({"error": "Artisan full name is required in Step 1."}), 400
    if not phone:
        return jsonify({"error": "Contact phone number is required in Step 1."}), 400
    if not craft_category:
        return jsonify({"error": "Craft category is required in Step 1."}), 400
    if not district or not state:
        return jsonify({"error": "District and State are required in Step 1."}), 400
    if not workshop_details or len(workshop_details) < 15:
        return jsonify({"error": "Please provide a descriptive explanation of your workshop and crafting setup (at least 15 characters) in Step 1."}), 400
        
    # Document evidence validation (at least 1 document)
    doc_count = db.verification_evidence.count_documents({
        "user_id": user_id,
        "is_video": False,
        "evidence_type": {"$ne": "craft_video"}
    })
    if doc_count < 1:
        return jsonify({"error": "Please upload at least one valid identity or producer supporting document in Step 2."}), 400
        
    # Craft video validation (at least 1 video)
    video_count = db.verification_evidence.count_documents({
        "user_id": user_id,
        "$or": [{"is_video": True}, {"evidence_type": "craft_video"}]
    })
    if video_count < 1:
        return jsonify({"error": "Please record or upload a craft-making process video in Step 3."}), 400
        
    notes = (data.get("notes") or verif.get("submission_notes") or "").strip()
    
    update_doc = {
        "verification_status": "pending",
        "current_step": 4,
        "artisan_profile": profile,
        "submission_notes": notes,
        "submitted_at": now_iso,
        "rejection_reason": "",
        "updated_at": now_iso
    }
    
    db.seller_verifications.update_one(
        {"user_id": user_id},
        {"$set": update_doc},
        upsert=True
    )
    
    # Also update user document verification_status
    db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"verification_status": "pending", "updated_at": now_iso}}
    )

    # Sync back essential fields to seller_profile
    db.seller_profiles.update_one(
        {"user_id": user_id},
        {"$set": {
            "organization_name": full_name,
            "seller_type": profile.get("seller_type", "individual_producer"),
            "craft_category": craft_category,
            "production_method": profile.get("production_method", "Handcrafted"),
            "materials_used": profile.get("materials_used", ""),
            "craft_description": workshop_details,
            "workshop_details": workshop_details,
            "address": profile.get("address", ""),
            "district": district,
            "state": state,
            "pincode": profile.get("pincode", ""),
            "years_of_experience": profile.get("years_of_experience") or 5,
            "annual_production_capacity": profile.get("annual_production_capacity", 500),
            "updated_at": now_iso
        }},
        upsert=True
    )
    save_mock_state()
    
    # Notify administrators
    admin_users = list(db.users.find({"role": "admin"}))
    for adm in admin_users:
        db.notifications.insert_one({
            "user_id": str(adm["_id"]),
            "title": "🔍 New Artisan Verification Dossier Submitted",
            "message": f"Artisan '{full_name}' ({craft_category}, {district}, {state}) has submitted complete verification evidence including craft video.",
            "type": "verification",
            "link": f"/admin",
            "read": False,
            "created_at": now_iso
        })
        
    log_audit(user_id, "verification_submitted", "seller_verifications", user_id, {
        "full_name": full_name,
        "craft_category": craft_category,
        "documents_count": doc_count,
        "video_count": video_count
    })
    
    return jsonify({
        "success": True,
        "message": "Your verification application has been submitted successfully! Platform administrators will review your craft dossier.",
        "status": "pending",
        "verification_status": "pending",
        "submitted_at": now_iso
    }), 200

# Legacy compatibility route for submit
@verification_bp.route("/submit", methods=["POST"])
@jwt_required
@roles_required("seller")
def submit_verification_request():
    return submit_verification_application()

@verification_bp.route("/review", methods=["POST"])
@jwt_required
@roles_required("admin")
def admin_review_verification():
    """
    Authorized Administrator Verification Decision:
    Records Reviewer ID, Decision (verified_producer, approved, rejected, needs_more_information),
    Reason, Timestamp, Previous status, New status.
    """
    data = request.get_json() or {}
    seller_user_id = data.get("user_id")
    raw_decision = data.get("decision")
    reason = (data.get("reason") or "").strip()
    
    if not seller_user_id:
        return jsonify({"error": "Target seller user_id is required."}), 400
        
    # Normalize decision
    decision_map = {
        "approved": "verified_producer",
        "verified_producer": "verified_producer",
        "verified_group": "verified_group",
        "verified_reseller": "verified_reseller",
        "rejected": "rejected",
        "needs_more_information": "needs_more_information"
    }
    decision = decision_map.get(raw_decision)
    if not decision:
        return jsonify({"error": f"Invalid decision. Must be one of: approved, verified_producer, verified_group, rejected, needs_more_information"}), 400
        
    if decision in ["rejected", "needs_more_information"] and not reason:
        return jsonify({"error": "A specific explanatory reason must be provided when rejecting or requesting more information."}), 400
        
    db = get_db()
    seller = db.users.find_one({"_id": ObjectId(seller_user_id)})
    if not seller:
        return jsonify({"error": "Seller account not found."}), 404
        
    verif = db.seller_verifications.find_one({"user_id": seller_user_id}) or {}
    prev_status = verif.get("verification_status", "not_started")
    now_iso = datetime.now(timezone.utc).isoformat()
    
    is_approved = decision in ["verified_producer", "verified_group", "verified_reseller"]
    
    history_entry = {
        "reviewer_id": g.user_id,
        "reviewer_email": g.current_user.get("email"),
        "decision": decision,
        "reason": reason or ("Application approved based on authentic craft process and workshop verification." if is_approved else ""),
        "previous_status": prev_status,
        "new_status": decision,
        "timestamp": now_iso
    }
    
    update_doc = {
        "verification_status": decision,
        "identity_verified": is_approved,
        "producer_evidence_reviewed": is_approved,
        "reviewed_at": now_iso,
        "rejection_reason": reason if not is_approved else "",
        "updated_at": now_iso
    }
    
    db.seller_verifications.update_one(
        {"user_id": seller_user_id},
        {
            "$set": update_doc,
            "$push": {"decision_history": history_entry}
        },
        upsert=True
    )
    
    # Update user record
    db.users.update_one(
        {"_id": ObjectId(seller_user_id)},
        {"$set": {
            "verification_status": decision,
            "is_verified": is_approved,
            "updated_at": now_iso
        }}
    )
    
    # Notify seller
    status_label = "Approved (Verified Producer)" if is_approved else ("Rejected" if decision == "rejected" else "More Information Needed")
    db.notifications.insert_one({
        "user_id": seller_user_id,
        "title": f"Verification Decision: {status_label}",
        "message": f"Your artisan verification review has concluded. Status: {status_label}. {('Reviewer notes: ' + reason) if reason else ''}",
        "type": "verification",
        "link": "/seller/verification",
        "read": False,
        "created_at": now_iso
    })
    save_mock_state()
    
    log_audit(g.user_id, "admin_verification_decision", "seller_verifications", seller_user_id, history_entry)
    
    return jsonify({
        "message": f"Verification decision '{decision}' recorded successfully.",
        "new_status": decision,
        "is_approved": is_approved,
        "history_entry": history_entry
    }), 200
