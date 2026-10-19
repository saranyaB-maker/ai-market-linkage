import os
from datetime import datetime, timezone
from PIL import Image
import imagehash
from bson import ObjectId
from config import Config
from db import get_db, log_audit

def compute_image_hashes(image_path: str) -> dict:
    """
    Computes perceptual hashes (pHash, dHash, aHash) for an image file.
    """
    try:
        with Image.open(image_path) as img:
            # Convert to RGB to handle PNG transparency or grayscale
            rgb_img = img.convert("RGB")
            phash_val = str(imagehash.phash(rgb_img))
            dhash_val = str(imagehash.dhash(rgb_img))
            ahash_val = str(imagehash.average_hash(rgb_img))
            return {
                "phash": phash_val,
                "dhash": dhash_val,
                "ahash": ahash_val,
                "success": True
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

def check_duplicate_image(phash_str: str, current_seller_id: str, new_product_id: str = None, image_url: str = None) -> list:
    """
    Compares the perceptual hash against existing images in the catalog.
    Detects exact or near-duplicates across DIFFERENT sellers.
    Flags are saved in duplicate_flags collection for administrative review.
    """
    if not phash_str:
        return []
    
    db = get_db()
    current_hash = imagehash.hex_to_hash(phash_str)
    threshold = Config.DUPLICATE_HAMMING_THRESHOLD
    
    # Query all existing stored hashes (excluding current seller's own listings)
    query = {"seller_id": {"$ne": str(current_seller_id)}}
    existing_hashes = list(db.image_hashes.find(query))
    
    matches = []
    for item in existing_hashes:
        existing_phash_str = item.get("phash")
        if not existing_phash_str:
            continue
        try:
            other_hash = imagehash.hex_to_hash(existing_phash_str)
            distance = current_hash - other_hash  # Hamming distance
            if distance <= threshold:
                # Calculate similarity score percentage (0 distance = 100%, threshold = near match)
                similarity_pct = max(0, round((1.0 - (distance / 64.0)) * 100, 1))
                match_info = {
                    "existing_product_id": item.get("product_id"),
                    "existing_seller_id": item.get("seller_id"),
                    "existing_image_url": item.get("image_url"),
                    "hamming_distance": int(distance),
                    "similarity_score": similarity_pct,
                    "is_exact_duplicate": bool(distance == 0)
                }
                matches.append(match_info)
                
                # Create duplicate flag in database for Admin review
                flag_entry = {
                    "new_product_id": str(new_product_id) if new_product_id else None,
                    "new_seller_id": str(current_seller_id),
                    "new_image_url": image_url,
                    "new_phash": phash_str,
                    "existing_product_id": str(item.get("product_id")),
                    "existing_seller_id": str(item.get("seller_id")),
                    "existing_image_url": item.get("image_url"),
                    "existing_phash": existing_phash_str,
                    "hamming_distance": int(distance),
                    "similarity_score": similarity_pct,
                    "status": "pending_review", # pending_review, confirmed_duplicate, false_positive, dismissed
                    "reviewer_id": None,
                    "reviewer_notes": None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                
                # Check if flag already exists to prevent duplicates
                existing_flag = db.duplicate_flags.find_one({
                    "new_seller_id": str(current_seller_id),
                    "existing_product_id": str(item.get("product_id")),
                    "new_phash": phash_str
                })
                if not existing_flag:
                    db.duplicate_flags.insert_one(flag_entry)
        except Exception:
            continue
            
    return matches

def store_product_image_hash(product_id: str, seller_id: str, image_url: str, hashes: dict):
    db = get_db()
    entry = {
        "product_id": str(product_id),
        "seller_id": str(seller_id),
        "image_url": image_url,
        "phash": hashes.get("phash"),
        "dhash": hashes.get("dhash"),
        "ahash": hashes.get("ahash"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    db.image_hashes.insert_one(entry)
