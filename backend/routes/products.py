import os
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g, send_from_directory
from werkzeug.utils import secure_filename
from bson import ObjectId
from config import Config
from db import get_db, log_audit
from routes.auth_helpers import jwt_required, roles_required
from services.duplicate_detector import compute_image_hashes, check_duplicate_image, store_product_image_hash
from services.ai_service import generate_catalog_suggestion
from services.price_calculator import calculate_fair_price
from services.image_enhancement import enhance_product_image
from services.translation_service import (
    translate_tamil_to_english,
    translate_english_to_tamil,
    get_bilingual_category,
    get_bilingual_unit
)

SELLER_ROLES = ("seller", "artisan", "producer", "artisan_seller", "admin")

products_bp = Blueprint("products", __name__, url_prefix="/api/products")

def has_tamil_chars(text: str) -> bool:
    if not text:
        return False
    return any('\u0b80' <= ch <= '\u0bff' for ch in text)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in Config.ALLOWED_EXTENSIONS

def normalize_images(images):
    if not images:
        return []
    if isinstance(images, str):
        return [images]
    if isinstance(images, list):
        return [str(img) for img in images if img]
    return []

@products_bp.route("", methods=["GET"])
def list_products():
    """
    Public marketplace query endpoint with filtering, search, sorting, and pagination.
    Only returns published, non-archived products from active non-suspended sellers.
    """
    db = get_db()
    
    # Query parameters
    keyword = (request.args.get("q") or "").strip()
    category = (request.args.get("category") or "").strip()
    min_price = request.args.get("min_price", type=float)
    max_price = request.args.get("max_price", type=float)
    max_moq = request.args.get("max_moq", type=int)
    max_lead_days = request.args.get("max_lead_days", type=int)
    verification_filter = (request.args.get("verification") or "").strip() # verified_producer, verified_group, verified_reseller
    sort_by = request.args.get("sort_by", "newest") # newest, price_asc, price_desc
    page = max(1, request.args.get("page", 1, type=int))
    limit = min(50, max(1, request.args.get("limit", 12, type=int)))
    skip = (page - 1) * limit
    
    # 1. Get all active seller IDs
    active_sellers = {str(u["_id"]): u for u in db.users.find({"role": "seller", "status": {"$ne": "suspended"}})}
    seller_ids = list(active_sellers.keys())
    
    # Filter by verification status if requested
    if verification_filter:
        v_docs = db.seller_verifications.find({"user_id": {"$in": seller_ids}, "verification_status": verification_filter})
        seller_ids = [v["user_id"] for v in v_docs]
        
    query = {
        "seller_id": {"$in": seller_ids},
        "is_published": True,
        "is_archived": False
    }
    
    if category and category != "all":
        query["category"] = category
        
    if min_price is not None or max_price is not None:
        query["price_per_unit"] = {}
        if min_price is not None:
            query["price_per_unit"]["$gte"] = min_price
        if max_price is not None:
            query["price_per_unit"]["$lte"] = max_price
            
    if max_moq is not None:
        query["moq"] = {"$lte": max_moq}
        
    if max_lead_days is not None:
        query["lead_time_days"] = {"$lte": max_lead_days}
        
    if keyword:
        # Regex search across title, description, materials
        kw_regex = {"$regex": keyword, "$options": "i"}
        query["$or"] = [
            {"title": kw_regex},
            {"description": kw_regex},
            {"materials": kw_regex},
            {"category": kw_regex}
        ]
        
    # Sort criteria
    sort_spec = [("created_at", -1)]
    if sort_by == "price_asc":
        sort_spec = [("price_per_unit", 1)]
    elif sort_by == "price_desc":
        sort_spec = [("price_per_unit", -1)]
    elif sort_by == "newest":
        sort_spec = [("created_at", -1)]
        
    total_count = db.products.count_documents(query)
    raw_products = list(db.products.find(query).sort(sort_spec).skip(skip).limit(limit))
    
    # Pre-fetch profiles & verifications
    p_seller_ids = list(set(p.get("seller_id") for p in raw_products if p.get("seller_id")))
    seller_profiles = {p["user_id"]: p for p in db.seller_profiles.find({"user_id": {"$in": p_seller_ids}})}
    seller_verifications = {v["user_id"]: v for v in db.seller_verifications.find({"user_id": {"$in": p_seller_ids}})}
    
    target_lang = request.args.get("lang", "en").lower()

    results = []
    for p in raw_products:
        sid = p.get("seller_id")
        user = active_sellers.get(sid, {})
        prof = seller_profiles.get(sid, {})
        verif = seller_verifications.get(sid, {})
        
        orig_title = p.get("title", "")
        orig_desc = p.get("description", "")
        orig_cat = p.get("category", "")
        orig_mat = p.get("materials", "")
        orig_unit = p.get("unit", "piece")

        if target_lang == "ta":
            title_display = p.get("title_ta") or translate_english_to_tamil(orig_title)
            category_display = get_bilingual_category(orig_cat, "ta")
            desc_display = p.get("description_ta") or translate_english_to_tamil(orig_desc)
            mat_display = translate_english_to_tamil(orig_mat)
            unit_display = get_bilingual_unit(orig_unit, "ta")
        else:
            title_display = orig_title
            category_display = orig_cat
            desc_display = orig_desc
            mat_display = orig_mat
            unit_display = orig_unit

        results.append({
            "id": str(p["_id"]),
            "title": title_display,
            "canonical_title": orig_title,
            "category": category_display,
            "canonical_category": orig_cat,
            "description": desc_display,
            "materials": mat_display,
            "dimensions": p.get("dimensions", ""),
            "production_method": p.get("production_method", "Handcrafted"),
            "price_per_unit": p.get("price_per_unit"),
            "unit": unit_display,
            "canonical_unit": orig_unit,
            "stock_quantity": p.get("stock_quantity"),
            "moq": p.get("moq", 1),
            "lead_time_days": p.get("lead_time_days", 14),
            "monthly_capacity": p.get("monthly_capacity"),
            "images": normalize_images(p.get("images", [])),
            "created_at": p.get("created_at"),
            "seller": {
                "id": sid,
                "name": user.get("full_name") or prof.get("organization_name", "Artisan Seller"),
                "seller_type": prof.get("seller_type", "individual_producer"),
                "state": prof.get("state", "Tamil Nadu"),
                "district": prof.get("district", ""),
                "verification_status": verif.get("verification_status", "unverified"),
                "is_producer_verified": verif.get("verification_status") in ["verified_producer", "verified_group"]
            }
        })
        
    return jsonify({
        "products": results,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_count": total_count,
            "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 1
        }
    }), 200

@products_bp.route("/<product_id>", methods=["GET"])
def get_product(product_id):
    db = get_db()
    try:
        p = db.products.find_one({"_id": ObjectId(product_id), "is_archived": False})
    except Exception:
        return jsonify({"error": "Invalid product ID format."}), 400
        
    if not p:
        return jsonify({"error": "Product listing not found or archived."}), 404
        
    seller_id = p.get("seller_id")
    seller_user = db.users.find_one({"_id": ObjectId(seller_id)}) or {}
    s_profile = db.seller_profiles.find_one({"user_id": seller_id}) or {}
    s_verif = db.seller_verifications.find_one({"user_id": seller_id}) or {}
    
    target_lang = request.args.get("lang", "en").lower()

    # Fetch similar products from the same category
    similar_cursor = db.products.find({
        "_id": {"$ne": p["_id"]},
        "category": p.get("category"),
        "is_published": True,
        "is_archived": False
    }).limit(4)
    similar_list = []
    for sp in similar_cursor:
        sp_title = sp.get("title_ta") or translate_english_to_tamil(sp.get("title", "")) if target_lang == "ta" else sp.get("title")
        similar_list.append({
            "id": str(sp["_id"]),
            "title": sp_title,
            "price_per_unit": sp.get("price_per_unit"),
            "images": sp.get("images", []),
            "moq": sp.get("moq", 1)
        })

    orig_title = p.get("title", "")
    orig_desc = p.get("description", "")
    orig_cat = p.get("category", "")
    orig_mat = p.get("materials", "")
    orig_dim = p.get("dimensions", "")
    orig_method = p.get("production_method", "Handcrafted")
    orig_unit = p.get("unit", "piece")

    if target_lang == "ta":
        title_val = p.get("title_ta") or translate_english_to_tamil(orig_title)
        desc_val = p.get("description_ta") or translate_english_to_tamil(orig_desc)
        cat_val = get_bilingual_category(orig_cat, "ta")
        mat_val = translate_english_to_tamil(orig_mat)
        dim_val = translate_english_to_tamil(orig_dim) if orig_dim else ""
        method_val = translate_english_to_tamil(orig_method)
        unit_val = get_bilingual_unit(orig_unit, "ta")
        workshop_val = translate_english_to_tamil(s_profile.get("workshop_details", "")) if s_profile.get("workshop_details") else ""
        craft_desc_val = translate_english_to_tamil(s_profile.get("craft_description", "")) if s_profile.get("craft_description") else ""
    else:
        title_val = orig_title
        desc_val = orig_desc
        cat_val = orig_cat
        mat_val = orig_mat
        dim_val = orig_dim
        method_val = orig_method
        unit_val = orig_unit
        workshop_val = s_profile.get("workshop_details", "")
        craft_desc_val = s_profile.get("craft_description", "")

    product_data = {
        "id": str(p["_id"]),
        "title": title_val,
        "canonical_title": orig_title,
        "category": cat_val,
        "canonical_category": orig_cat,
        "description": desc_val,
        "canonical_description": orig_desc,
        "materials": mat_val,
        "canonical_materials": orig_mat,
        "dimensions": dim_val,
        "canonical_dimensions": orig_dim,
        "production_method": method_val,
        "canonical_production_method": orig_method,
        "price_per_unit": p.get("price_per_unit"),
        "unit": unit_val,
        "canonical_unit": orig_unit,
        "stock_quantity": p.get("stock_quantity"),
        "moq": p.get("moq", 1),
        "lead_time_days": p.get("lead_time_days", 14),
        "monthly_capacity": p.get("monthly_capacity"),
        "images": normalize_images(p.get("images", [])),
        "is_published": p.get("is_published", True),
        "created_at": p.get("created_at"),
        "seller": {
            "id": seller_id,
            "name": seller_user.get("full_name") or s_profile.get("organization_name", "Artisan"),
            "seller_type": s_profile.get("seller_type", "individual_producer"),
            "craft_description": craft_desc_val,
            "state": s_profile.get("state", "Tamil Nadu"),
            "district": s_profile.get("district", ""),
            "workshop_details": workshop_val,
            "verification_status": s_verif.get("verification_status", "unverified"),
            "is_producer_verified": s_verif.get("verification_status") in ["verified_producer", "verified_group", "approved"],
            "identity_verified": s_verif.get("identity_verified", False),
            "producer_evidence_reviewed": s_verif.get("producer_evidence_reviewed", False)
        },
        "similar_products": similar_list
    }
    return jsonify({"product": product_data}), 200

@products_bp.route("", methods=["POST"])
@products_bp.route("/", methods=["POST"])
@jwt_required
@roles_required(*SELLER_ROLES)
def create_product():
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    category = (data.get("category") or "").strip()
    price = data.get("price_per_unit") if data.get("price_per_unit") is not None else data.get("unit_price")
    
    if not title or not category or price is None:
        return jsonify({"error": "Title, category, and unit price are required."}), 400
        
    try:
        price_val = float(price)
        if price_val <= 0:
            return jsonify({"error": "Price per unit must be greater than zero."}), 400
    except ValueError:
        return jsonify({"error": "Invalid price format."}), 400
        
    db = get_db()
    seller_id = g.user_id
    now_iso = datetime.now(timezone.utc).isoformat()
    
    images = data.get("images", [])
    primary_hash = data.get("primary_image_hash", "")
    
    # Check duplicate flags before publishing if an image hash is supplied
    duplicate_warnings = []
    if primary_hash:
        duplicate_matches = check_duplicate_image(primary_hash, seller_id, image_url=images[0] if images else None)
        if duplicate_matches:
            duplicate_warnings = duplicate_matches
            
    # Verification status check - unverified artisans are fully allowed to publish listings,
    # Ensure canonical database records are stored in English
    canonical_title = title
    title_ta = data.get("title_ta", "")
    if has_tamil_chars(title):
        title_ta = title
        canonical_title = translate_tamil_to_english(title)
        
    canonical_category = get_bilingual_category(category, "en")
    
    raw_desc = data.get("description", "")
    canonical_desc = raw_desc
    desc_ta = data.get("description_ta", "")
    if has_tamil_chars(raw_desc):
        desc_ta = raw_desc
        canonical_desc = translate_tamil_to_english(raw_desc)

    raw_mat = data.get("materials", "")
    canonical_mat = translate_tamil_to_english(raw_mat) if has_tamil_chars(raw_mat) else raw_mat
    
    raw_method = data.get("production_method", "Handcrafted")
    canonical_method = translate_tamil_to_english(raw_method) if has_tamil_chars(raw_method) else raw_method
    
    raw_dim = data.get("dimensions", "")
    canonical_dim = translate_tamil_to_english(raw_dim) if has_tamil_chars(raw_dim) else raw_dim

    is_published_requested = bool(data.get("is_published", True))
    
    product_doc = {
        "seller_id": seller_id,
        "title": canonical_title,
        "title_ta": title_ta,
        "category": canonical_category,
        "description": canonical_desc,
        "description_ta": desc_ta,
        "materials": canonical_mat,
        "dimensions": canonical_dim,
        "production_method": canonical_method or "Handcrafted",
        "price_per_unit": price_val,
        "unit": (data.get("unit") or "piece").strip(),
        "stock_quantity": max(0, int(data.get("stock_quantity") or 0)),
        "allocated_stock": 0,
        "moq": max(1, int(data.get("moq") or 1)),
        "monthly_capacity": max(10, int(data.get("monthly_capacity") or 100)),
        "lead_time_days": max(1, int(data.get("lead_time_days") or 14)),
        "images": normalize_images(images),
        "primary_image_hash": primary_hash,
        "is_published": is_published_requested,
        "is_archived": False,
        "ai_generated": bool(data.get("ai_generated", False)),
        "created_at": now_iso,
        "updated_at": now_iso
    }
    
    res = db.products.insert_one(product_doc)
    new_id = str(res.inserted_id)
    
    # Store hashes into image_hashes index
    if primary_hash and images:
        store_product_image_hash(new_id, seller_id, images[0], {"phash": primary_hash})
        
    log_audit(seller_id, "product_created", "products", new_id, {"title": title, "price": price_val})
    
    return jsonify({
        "message": "Product listing created successfully",
        "product_id": new_id,
        "product": {
            "id": new_id,
            "title": title,
            "is_published": is_published_requested
        },
        "duplicate_warnings": duplicate_warnings
    }), 201

@products_bp.route("/<product_id>", methods=["PUT"])
@jwt_required
@roles_required(*SELLER_ROLES)
def update_product(product_id):
    data = request.get_json() or {}
    db = get_db()
    
    try:
        prod = db.products.find_one({"_id": ObjectId(product_id)})
    except Exception:
        return jsonify({"error": "Invalid product ID format."}), 400
        
    if not prod:
        return jsonify({"error": "Product not found."}), 404
        
    # Only seller owner or admin can edit
    if g.role != "admin" and str(prod.get("seller_id")) != str(g.user_id):
        return jsonify({"error": "You do not have permission to edit this product. Only the owning artisan or an administrator can edit it."}), 403
        
    update_doc = {"updated_at": datetime.now(timezone.utc).isoformat()}

    # Title and Tamil translation
    if "title" in data:
        raw_t = (data.get("title") or "").strip()
        if not raw_t:
            return jsonify({"error": "Product title cannot be empty."}), 400
        if has_tamil_chars(raw_t):
            update_doc["title_ta"] = raw_t
            update_doc["title"] = translate_tamil_to_english(raw_t)
        else:
            update_doc["title"] = raw_t

    # Category
    if "category" in data:
        raw_c = (data.get("category") or "").strip()
        if not raw_c:
            return jsonify({"error": "Product category cannot be empty."}), 400
        update_doc["category"] = get_bilingual_category(raw_c, "en")

    # Description and Tamil translation
    if "description" in data:
        raw_d = (data.get("description") or "").strip()
        if has_tamil_chars(raw_d):
            update_doc["description_ta"] = raw_d
            update_doc["description"] = translate_tamil_to_english(raw_d)
        else:
            update_doc["description"] = raw_d

    # Materials
    if "materials" in data:
        raw_m = data.get("materials") or ""
        if isinstance(raw_m, str) and has_tamil_chars(raw_m):
            update_doc["materials"] = translate_tamil_to_english(raw_m)
        else:
            update_doc["materials"] = raw_m

    # Dimensions
    if "dimensions" in data:
        raw_dim = data.get("dimensions") or ""
        if has_tamil_chars(raw_dim):
            update_doc["dimensions"] = translate_tamil_to_english(raw_dim)
        else:
            update_doc["dimensions"] = raw_dim

    # Production Method
    if "production_method" in data:
        raw_pm = data.get("production_method") or ""
        if has_tamil_chars(raw_pm):
            update_doc["production_method"] = translate_tamil_to_english(raw_pm)
        else:
            update_doc["production_method"] = raw_pm

    # Price validation
    if "price_per_unit" in data and data["price_per_unit"] is not None:
        try:
            p_val = float(data["price_per_unit"])
            if p_val <= 0:
                return jsonify({"error": "Price per unit must be greater than zero."}), 400
            update_doc["price_per_unit"] = p_val
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid price format."}), 400

    # Stock validation
    if "stock_quantity" in data and data["stock_quantity"] is not None:
        try:
            s_val = int(data["stock_quantity"])
            if s_val < 0:
                return jsonify({"error": "Stock quantity cannot be negative."}), 400
            update_doc["stock_quantity"] = s_val
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid stock quantity format."}), 400

    # MOQ validation
    if "moq" in data and data["moq"] is not None:
        try:
            m_val = int(data["moq"])
            if m_val < 1:
                return jsonify({"error": "Minimum order quantity must be at least 1."}), 400
            update_doc["moq"] = m_val
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid minimum order quantity format."}), 400

    # Monthly capacity validation
    if "monthly_capacity" in data and data["monthly_capacity"] is not None:
        try:
            mc_val = int(data["monthly_capacity"])
            if mc_val < 1:
                return jsonify({"error": "Monthly production capacity must be at least 1."}), 400
            update_doc["monthly_capacity"] = mc_val
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid monthly capacity format."}), 400

    # Lead time days validation
    if "lead_time_days" in data and data["lead_time_days"] is not None:
        try:
            lt_val = int(data["lead_time_days"])
            if lt_val < 1:
                return jsonify({"error": "Lead time days must be at least 1."}), 400
            update_doc["lead_time_days"] = lt_val
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid lead time days format."}), 400

    # Unit
    if "unit" in data:
        update_doc["unit"] = (data.get("unit") or "piece").strip()

    # Images (preserve existing if empty or not provided)
    if "images" in data and data["images"]:
        update_doc["images"] = normalize_images(data["images"])

    # Publication status
    if "is_published" in data:
        update_doc["is_published"] = bool(data["is_published"])

    db.products.update_one({"_id": ObjectId(product_id)}, {"$set": update_doc})
    log_audit(g.user_id, "product_updated", "products", product_id, update_doc)
    
    # Return updated product
    updated_prod = db.products.find_one({"_id": ObjectId(product_id)})
    return jsonify({
        "message": "Product listing updated successfully.",
        "product": {
            "id": str(updated_prod["_id"]),
            "title": updated_prod.get("title"),
            "category": updated_prod.get("category"),
            "price_per_unit": updated_prod.get("price_per_unit"),
            "stock_quantity": updated_prod.get("stock_quantity"),
            "moq": updated_prod.get("moq"),
            "is_published": updated_prod.get("is_published")
        }
    }), 200

@products_bp.route("/<product_id>/stock", methods=["PATCH"])
@jwt_required
@roles_required(*SELLER_ROLES)
def quick_update_stock(product_id):
    data = request.get_json() or {}
    if "stock_quantity" not in data or data["stock_quantity"] is None:
        return jsonify({"error": "stock_quantity is required."}), 400
    try:
        new_stock = int(data["stock_quantity"])
        if new_stock < 0:
            return jsonify({"error": "Stock quantity cannot be negative."}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid stock quantity format."}), 400

    db = get_db()
    try:
        prod = db.products.find_one({"_id": ObjectId(product_id)})
    except Exception:
        return jsonify({"error": "Invalid product ID format."}), 400

    if not prod:
        return jsonify({"error": "Product not found."}), 404

    if g.role != "admin" and str(prod.get("seller_id")) != str(g.user_id):
        return jsonify({"error": "You do not have permission to manage stock for this product."}), 403

    now_iso = datetime.now(timezone.utc).isoformat()
    db.products.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": {"stock_quantity": new_stock, "updated_at": now_iso}}
    )
    log_audit(g.user_id, "product_stock_updated", "products", product_id, {"new_stock": new_stock})
    return jsonify({
        "message": "Stock quantity updated successfully.",
        "stock_quantity": new_stock
    }), 200

@products_bp.route("/<product_id>", methods=["DELETE"])
@jwt_required
@roles_required("seller", "admin")
def archive_product(product_id):
    db = get_db()
    try:
        prod = db.products.find_one({"_id": ObjectId(product_id)})
    except Exception:
        return jsonify({"error": "Invalid product ID."}), 400
        
    if not prod:
        return jsonify({"error": "Product not found."}), 404
        
    if g.role != "admin" and prod.get("seller_id") != g.user_id:
        return jsonify({"error": "Permission denied."}), 403
        
    db.products.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": {"is_archived": True, "is_published": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    log_audit(g.user_id, "product_archived", "products", product_id)
    return jsonify({"message": "Product listing archived successfully."}), 200

@products_bp.route("/upload-image", methods=["POST"])
@jwt_required
@roles_required(*SELLER_ROLES)
def upload_product_image():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided in request."}), 400
        
    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty filename."}), 400
        
    if not allowed_file(file.filename):
        return jsonify({"error": "File type not supported. Allowed: PNG, JPG, JPEG, WEBP."}), 400
        
    ext = file.filename.rsplit(".", 1)[1].lower()
    safe_name = f"prod_{uuid.uuid4().hex[:12]}.{ext}"
    os.makedirs(Config.PRODUCT_UPLOAD_FOLDER, exist_ok=True)
    save_path = os.path.join(Config.PRODUCT_UPLOAD_FOLDER, safe_name)
    file.save(save_path)
    
    # Compute perceptual hashes
    hashes = compute_image_hashes(save_path)
    image_url = f"/api/products/images/{safe_name}"
    
    duplicate_matches = []
    if hashes.get("success"):
        # Check against existing images
        duplicate_matches = check_duplicate_image(hashes["phash"], g.user_id, image_url=image_url)
        
    return jsonify({
        "message": "Image uploaded successfully",
        "image_url": image_url,
        "hashes": hashes,
        "is_duplicate_suspected": len(duplicate_matches) > 0,
        "duplicate_matches": duplicate_matches
    }), 201

@products_bp.route("/images/<filename>", methods=["GET"])
def serve_product_image(filename):
    safe_name = secure_filename(filename)
    return send_from_directory(Config.PRODUCT_UPLOAD_FOLDER, safe_name)

@products_bp.route("/enhance-background", methods=["POST"])
@jwt_required
@roles_required(*SELLER_ROLES)
def api_enhance_background():
    """
    Removes background from artisan product photo and places it on a clean
    warm-white studio background with natural contact shadow.
    Preserves authentic handmade details, shape, colors, and textures.
    """
    backdrop_style = request.form.get("backdrop_style") or "warm_studio"
    save_path = None
    original_image_url = ""

    if "image" in request.files:
        file = request.files["image"]
        if file and allowed_file(file.filename):
            ext = file.filename.rsplit(".", 1)[1].lower()
            safe_name = f"orig_{uuid.uuid4().hex[:10]}.{ext}"
            os.makedirs(Config.PRODUCT_UPLOAD_FOLDER, exist_ok=True)
            save_path = os.path.join(Config.PRODUCT_UPLOAD_FOLDER, safe_name)
            file.save(save_path)
            original_image_url = f"/api/products/images/{safe_name}"
    else:
        data = request.get_json(silent=True) or request.form.to_dict() or {}
        image_url = data.get("image_url", "")
        backdrop_style = data.get("backdrop_style", backdrop_style)
        if image_url:
            filename = os.path.basename(image_url)
            candidate_path = os.path.join(Config.PRODUCT_UPLOAD_FOLDER, filename)
            if os.path.exists(candidate_path):
                save_path = candidate_path
                original_image_url = image_url

    if not save_path or not os.path.exists(save_path):
        return jsonify({"error": "No valid product image provided or file not found."}), 400

    result = enhance_product_image(save_path, backdrop_style=backdrop_style)
    if not result.get("success"):
        return jsonify({
            "success": False,
            "message": result.get("message", "Background removal service is not configured. Original photo preserved without blur."),
            "original_image_url": original_image_url
        }), 200

    return jsonify({
        "success": True,
        "original_image_url": original_image_url,
        "enhanced_image_url": result.get("enhanced_image_url"),
        "service_used": result.get("service_used"),
        "backdrop_style": result.get("backdrop_style"),
        "craft_fidelity": result.get("craft_fidelity"),
        "disclaimer": result.get("disclaimer")
    }), 200

@products_bp.route("/ai-catalog-generate", methods=["POST"])
@jwt_required
@roles_required(*SELLER_ROLES)
def ai_catalog_generate():
    """
    Analyzes an uploaded image (or takes an existing uploaded filename) to generate
    structured craft catalog fields, and automatically enhances studio background.
    """
    data = request.form.to_dict() if request.form else (request.get_json() or {})
    user_notes = data.get("notes", "")
    auto_enhance = str(data.get("auto_enhance", "true")).lower() == "true"
    
    # If image file uploaded directly
    if "image" in request.files:
        file = request.files["image"]
        if file and allowed_file(file.filename):
            ext = file.filename.rsplit(".", 1)[1].lower()
            safe_name = f"catalog_tmp_{uuid.uuid4().hex[:8]}.{ext}"
            os.makedirs(Config.PRODUCT_UPLOAD_FOLDER, exist_ok=True)
            save_path = os.path.join(Config.PRODUCT_UPLOAD_FOLDER, safe_name)
            file.save(save_path)
            
            catalog_suggestion = generate_catalog_suggestion(save_path, file.filename, user_notes)
            hashes = compute_image_hashes(save_path)
            image_url = f"/api/products/images/{safe_name}"
            
            enhanced_info = None
            if auto_enhance:
                enh_res = enhance_product_image(save_path)
                if enh_res.get("success"):
                    enhanced_info = enh_res
            
            dup_matches = []
            if hashes.get("success"):
                dup_matches = check_duplicate_image(hashes["phash"], g.user_id, image_url=image_url)
                
            return jsonify({
                "suggestion": catalog_suggestion,
                "image_url": image_url,
                "enhanced_image": enhanced_info,
                "hashes": hashes,
                "duplicate_warnings": dup_matches
            }), 200
            
    # Or reference an existing image URL
    image_url = data.get("image_url", "")
    if image_url:
        filename = os.path.basename(image_url)
        filepath = os.path.join(Config.PRODUCT_UPLOAD_FOLDER, filename)
        if os.path.exists(filepath):
            catalog_suggestion = generate_catalog_suggestion(filepath, filename, user_notes)
            enhanced_info = None
            if auto_enhance:
                enh_res = enhance_product_image(filepath)
                if enh_res.get("success"):
                    enhanced_info = enh_res
            return jsonify({
                "suggestion": catalog_suggestion,
                "image_url": image_url,
                "enhanced_image": enhanced_info
            }), 200
            
    # Fallback with text only
    fallback = generate_catalog_suggestion("", data.get("title", ""), user_notes)
    return jsonify({"suggestion": fallback}), 200

@products_bp.route("/calculate-fair-price", methods=["POST"])
def api_calculate_fair_price():
    data = request.get_json() or {}
    result = calculate_fair_price(data)
    if not result.get("success"):
        return jsonify({"error": "Calculation validation failed", "details": result.get("errors")}), 400
    return jsonify(result), 200

@products_bp.route("/seller-inventory", methods=["GET"])
@jwt_required
@roles_required(*SELLER_ROLES)
def seller_inventory():
    seller_id = request.args.get("seller_id") if g.role == "admin" else g.user_id
    db = get_db()
    items = list(db.products.find({"seller_id": seller_id, "is_archived": False}).sort("created_at", -1))
    
    result = []
    for p in items:
        result.append({
            "id": str(p["_id"]),
            "title": p.get("title"),
            "category": p.get("category"),
            "price_per_unit": p.get("price_per_unit"),
            "unit": p.get("unit", "piece"),
            "stock_quantity": p.get("stock_quantity"),
            "allocated_stock": p.get("allocated_stock", 0),
            "available_stock": max(0, p.get("stock_quantity", 0) - p.get("allocated_stock", 0)),
            "moq": p.get("moq", 1),
            "lead_time_days": p.get("lead_time_days", 14),
            "images": normalize_images(p.get("images", [])),
            "is_published": p.get("is_published", True),
            "created_at": p.get("created_at")
        })
    return jsonify({"products": result}), 200
