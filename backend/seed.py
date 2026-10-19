import os
import sys
from datetime import datetime, timezone
from PIL import Image, ImageDraw
import imagehash
from config import Config
from db import init_db, get_db, create_indexes, save_mock_state
from routes.auth_helpers import hash_password

def generate_sample_craft_image(filename: str, color_bg: tuple, text: str) -> tuple:
    """
    Generates a realistic placeholder craft texture image and computes its perceptual hash.
    """
    os.makedirs(Config.PRODUCT_UPLOAD_FOLDER, exist_ok=True)
    filepath = os.path.join(Config.PRODUCT_UPLOAD_FOLDER, filename)
    
    # 400x400 image with subtle craft texture pattern
    img = Image.new("RGB", (400, 400), color=color_bg)
    draw = ImageDraw.Draw(img)
    
    # Draw geometric / craft patterns
    for i in range(0, 400, 40):
        draw.line([(0, i), (400, i)], fill=(color_bg[0]-15, color_bg[1]-15, color_bg[2]-15), width=2)
        draw.line([(i, 0), (i, 400)], fill=(color_bg[0]-15, color_bg[1]-15, color_bg[2]-15), width=2)
        
    draw.rectangle([50, 160, 350, 240], fill=(255, 255, 255, 200), outline=(50, 50, 50), width=2)
    # Save image
    img.save(filepath, format="JPEG")
    
    # Compute perceptual hash
    phash_str = str(imagehash.phash(img))
    dhash_str = str(imagehash.dhash(img))
    ahash_str = str(imagehash.average_hash(img))
    
    return f"/api/products/images/{filename}", phash_str, dhash_str, ahash_str

def seed_database(force=False):
    # Security requirement: Refuse default dev demo credentials in production mode!
    if os.getenv("FLASK_ENV") == "production" and not force:
        print("ERROR: Development seeding with default demo credentials is strictly prohibited in production mode.")
        sys.exit(1)
        
    print("Initializing database connection for seeding...")
    db = init_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    
    print("Clearing previous demo records for idempotent seed...")
    db.users.delete_many({"email": {"$regex": "@marketlink\\.local$"}})
    db.seller_profiles.delete_many({})
    db.buyer_profiles.delete_many({})
    db.seller_verifications.delete_many({})
    db.products.delete_many({})
    db.image_hashes.delete_many({})
    db.duplicate_flags.delete_many({})
    db.buyer_requirements.delete_many({})
    db.quotations.delete_many({})
    db.orders.delete_many({})
    db.notifications.delete_many({})
    db.conversations.delete_many({})
    db.messages.delete_many({})
    db.reviews.delete_many({})
    db.disputes.delete_many({})
    
    # 1. CREATE DEMO ACCOUNTS
    print("Creating core demo accounts (Admin, Seller, Buyer)...")
    
    # A. ADMIN
    admin_user = {
        "email": "admin@marketlink.local",
        "password_hash": hash_password("Admin@12345"),
        "role": "admin",
        "full_name": "Platform Administrator",
        "phone": "9876543210",
        "status": "active",
        "preferred_language": "en",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    admin_id = str(db.users.insert_one(admin_user).inserted_id)
    
    # B. PRIMARY SELLER
    seller_user = {
        "email": "seller@marketlink.local",
        "password_hash": hash_password("Seller@12345"),
        "role": "seller",
        "full_name": "Ramanathan Natarajan",
        "phone": "9842156789",
        "status": "active",
        "preferred_language": "ta",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    seller_id = str(db.users.insert_one(seller_user).inserted_id)
    
    seller_profile = {
        "user_id": seller_id,
        "organization_name": "Thanjavur Art & Handloom Weavers",
        "seller_type": "producer_group",
        "craft_category": "Handloom & Textiles",
        "craft_description": "Generational master weavers specializing in pure cotton and silk handloom sarees, stoles, and yardage.",
        "address": "45 Sannadhi Street, Near Big Temple",
        "district": "Thanjavur",
        "state": "Tamil Nadu",
        "pincode": "613001",
        "artisan_id_number": "TN-THJ-ART-8821",
        "annual_production_capacity": 2400,
        "workshop_details": "12 traditional pit looms operating under registered rural weaver society.",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    db.seller_profiles.insert_one(seller_profile)
    
    seller_verif = {
        "user_id": seller_id,
        "verification_status": "verified_producer",
        "identity_verified": True,
        "producer_evidence_reviewed": True,
        "decision_history": [
            {
                "reviewer_id": admin_id,
                "reviewer_email": "admin@marketlink.local",
                "decision": "verified_producer",
                "reason": "Artisan registry card verified, workshop pitlooms inspected, and sample fabric passed quality standards.",
                "previous_status": "pending",
                "new_status": "verified_producer",
                "timestamp": now_iso
            }
        ],
        "created_at": now_iso,
        "updated_at": now_iso
    }
    db.seller_verifications.insert_one(seller_verif)
    
    # C. PRIMARY BUYER
    buyer_user = {
        "email": "buyer@marketlink.local",
        "password_hash": hash_password("Buyer@12345"),
        "role": "buyer",
        "full_name": "Anita Venkatesh",
        "phone": "9884012345",
        "status": "active",
        "preferred_language": "en",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    buyer_id = str(db.users.insert_one(buyer_user).inserted_id)
    
    buyer_profile = {
        "user_id": buyer_id,
        "buyer_type": "wholesaler",
        "business_name": "Heritage Crafts & Eco Living Boutique",
        "gstin": "33AABCH1234F1ZX",
        "address": "12 TTK Road, Alwarpet",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "pincode": "600018",
        "intended_categories": ["Handloom & Textiles", "Pottery & Terracotta", "Jute & Natural Fiber Crafts"],
        "created_at": now_iso,
        "updated_at": now_iso
    }
    db.buyer_profiles.insert_one(buyer_profile)

    # D. SECONDARY SELLER (Self-Help Group for Collective Pooling)
    shg_user = {
        "email": "kaveri_shg@marketlink.local",
        "password_hash": hash_password("Seller@12345"),
        "role": "seller",
        "full_name": "Kaveri Women Artisan SHG",
        "phone": "9789123456",
        "status": "active",
        "preferred_language": "ta",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    shg_id = str(db.users.insert_one(shg_user).inserted_id)
    
    db.seller_profiles.insert_one({
        "user_id": shg_id,
        "organization_name": "Kaveri Women Jute & Natural Fiber Federation",
        "seller_type": "self_help_group",
        "craft_category": "Jute & Natural Fiber Crafts",
        "craft_description": "Rural women self-help collective crafting eco-friendly jute bags, palm leaf containers, and decorative mats.",
        "address": "Rural Livelihood Center, Main Road",
        "district": "Madurai",
        "state": "Tamil Nadu",
        "pincode": "625001",
        "artisan_id_number": "TN-MDU-SHG-4412",
        "annual_production_capacity": 6000,
        "workshop_details": "40 artisan women members with pedal-operated sewing machines and natural fiber dyeing units.",
        "created_at": now_iso,
        "updated_at": now_iso
    })
    
    db.seller_verifications.insert_one({
        "user_id": shg_id,
        "verification_status": "verified_group",
        "identity_verified": True,
        "producer_evidence_reviewed": True,
        "decision_history": [
            {
                "reviewer_id": admin_id,
                "reviewer_email": "admin@marketlink.local",
                "decision": "verified_group",
                "reason": "District Rural Development Agency (DRDA) SHG registration verified and cooperative resolution reviewed.",
                "previous_status": "pending",
                "new_status": "verified_group",
                "timestamp": now_iso
            }
        ],
        "created_at": now_iso,
        "updated_at": now_iso
    })
    
    # E. THIRD SELLER (Pottery Cluster)
    pottery_user = {
        "email": "manamadurai@marketlink.local",
        "password_hash": hash_password("Seller@12345"),
        "role": "seller",
        "full_name": "Manamadurai Terracotta Society",
        "phone": "9443219876",
        "status": "active",
        "preferred_language": "ta",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    pottery_id = str(db.users.insert_one(pottery_user).inserted_id)
    
    db.seller_profiles.insert_one({
        "user_id": pottery_id,
        "organization_name": "Manamadurai GI-Tagged Pottery Cooperative",
        "seller_type": "cooperative",
        "craft_category": "Pottery & Terracotta",
        "craft_description": "Famed Manamadurai clay pots and ornamental terracotta handicrafts crafted from Vaigai riverbed clay.",
        "address": "Kambar Street, Potter Colony",
        "district": "Sivagangai",
        "state": "Tamil Nadu",
        "pincode": "630606",
        "artisan_id_number": "TN-SVG-GI-0192",
        "annual_production_capacity": 12000,
        "workshop_details": "Cooperative wood-fired kilns and traditional potter wheels.",
        "created_at": now_iso,
        "updated_at": now_iso
    })
    
    db.seller_verifications.insert_one({
        "user_id": pottery_id,
        "verification_status": "verified_producer",
        "identity_verified": True,
        "producer_evidence_reviewed": True,
        "decision_history": [
            {
                "reviewer_id": admin_id,
                "reviewer_email": "admin@marketlink.local",
                "decision": "verified_producer",
                "reason": "Geographical Indication (GI) artisan certificate confirmed.",
                "previous_status": "pending",
                "new_status": "verified_producer",
                "timestamp": now_iso
            }
        ],
        "created_at": now_iso,
        "updated_at": now_iso
    })

    # 2. GENERATE SAMPLE CRAFT PRODUCTS WITH REAL HASHES
    print("Generating sample craft catalog with perceptual hashes...")
    
    # Product 1: Handloom Sarees (Seller 1)
    img1_url, phash1, dhash1, ahash1 = generate_sample_craft_image("handloom_saree_01.jpg", (180, 70, 70), "Handloom Saree")
    prod1 = {
        "seller_id": seller_id,
        "title": "Thanjavur Pure Cotton Handloom Saree",
        "category": "Handloom & Textiles",
        "description": "Exquisite hand-woven pure cotton saree featuring traditional geometric temple border (korvai technique). Dyed using certified AZO-free skin-friendly natural colors.",
        "materials": "100% Combed Cotton, Natural Vegetable Dye",
        "dimensions": "6.2 meters with blouse piece",
        "production_method": "Traditional Frame Loom",
        "price_per_unit": 650.00,
        "stock_quantity": 80,
        "allocated_stock": 0,
        "moq": 10,
        "monthly_capacity": 250,
        "lead_time_days": 12,
        "images": [img1_url],
        "primary_image_hash": phash1,
        "is_published": True,
        "is_archived": False,
        "ai_generated": False,
        "created_at": now_iso,
        "updated_at": now_iso
    }
    p1_id = str(db.products.insert_one(prod1).inserted_id)
    db.image_hashes.insert_one({"product_id": p1_id, "seller_id": seller_id, "image_url": img1_url, "phash": phash1, "dhash": dhash1, "ahash": ahash1, "created_at": now_iso})

    # Product 2: Jute Bags (Kaveri SHG)
    img2_url, phash2, dhash2, ahash2 = generate_sample_craft_image("jute_gift_bag_02.jpg", (195, 160, 110), "Jute Bag")
    prod2 = {
        "seller_id": shg_id,
        "title": "Eco-Friendly Braided Jute Conference & Gift Bag",
        "category": "Jute & Natural Fiber Crafts",
        "description": "Sturdy handmade jute tote bag with reinforced cotton webbing handles. Ideal for wholesale corporate gifting, retail branding, and eco-friendly packaging.",
        "materials": "100% Golden Jute, Cotton Twill Lining",
        "dimensions": "14 x 12 x 5 inches",
        "production_method": "Hand-stitched & Loom-woven",
        "price_per_unit": 135.00,
        "stock_quantity": 450,
        "allocated_stock": 0,
        "moq": 50,
        "monthly_capacity": 1500,
        "lead_time_days": 14,
        "images": [img2_url],
        "primary_image_hash": phash2,
        "is_published": True,
        "is_archived": False,
        "ai_generated": False,
        "created_at": now_iso,
        "updated_at": now_iso
    }
    p2_id = str(db.products.insert_one(prod2).inserted_id)
    db.image_hashes.insert_one({"product_id": p2_id, "seller_id": shg_id, "image_url": img2_url, "phash": phash2, "dhash": dhash2, "ahash": ahash2, "created_at": now_iso})

    # Product 3: Terracotta Pottery (Manamadurai Cooperative)
    img3_url, phash3, dhash3, ahash3 = generate_sample_craft_image("terracotta_pot_03.jpg", (200, 95, 55), "Terracotta Pot")
    prod3 = {
        "seller_id": pottery_id,
        "title": "Natural Clay Alkaline Water Pot with Lid",
        "category": "Pottery & Terracotta",
        "description": "Hand-thrown porous terracotta clay water pitcher tested for natural cooling properties. Fired in traditional biomass wood kilns.",
        "materials": "Natural Riverbed Clay, Red Ochre Finish",
        "dimensions": "Capacity: 3.5 Liters, Height: 11 inches",
        "production_method": "Wheel-thrown & Hand-beaten",
        "price_per_unit": 220.00,
        "stock_quantity": 300,
        "allocated_stock": 0,
        "moq": 25,
        "monthly_capacity": 1000,
        "lead_time_days": 10,
        "images": [img3_url],
        "primary_image_hash": phash3,
        "is_published": True,
        "is_archived": False,
        "ai_generated": False,
        "created_at": now_iso,
        "updated_at": now_iso
    }
    p3_id = str(db.products.insert_one(prod3).inserted_id)
    db.image_hashes.insert_one({"product_id": p3_id, "seller_id": pottery_id, "image_url": img3_url, "phash": phash3, "dhash": dhash3, "ahash": ahash3, "created_at": now_iso})

    # Product 4: Another Jute Product by Seller 1 for Collective Pooling demo
    img4_url, phash4, dhash4, ahash4 = generate_sample_craft_image("jute_pouch_04.jpg", (190, 150, 100), "Jute Pouch")
    prod4 = {
        "seller_id": seller_id,
        "title": "Drawstring Natural Jute Favor Pouch",
        "category": "Jute & Natural Fiber Crafts",
        "description": "Small artisan jute drawstring pouches suitable for jewelry, dry fruits packaging, and artisanal soap hampers.",
        "materials": "Treated Soft Jute, Cotton Cord",
        "dimensions": "8 x 6 inches",
        "production_method": "Handloom Fabric & Hand-stitched",
        "price_per_unit": 45.00,
        "stock_quantity": 600,
        "allocated_stock": 0,
        "moq": 100,
        "monthly_capacity": 2000,
        "lead_time_days": 7,
        "images": [img4_url],
        "primary_image_hash": phash4,
        "is_published": True,
        "is_archived": False,
        "ai_generated": False,
        "created_at": now_iso,
        "updated_at": now_iso
    }
    p4_id = str(db.products.insert_one(prod4).inserted_id)
    db.image_hashes.insert_one({"product_id": p4_id, "seller_id": seller_id, "image_url": img4_url, "phash": phash4, "dhash": dhash4, "ahash": ahash4, "created_at": now_iso})

    # 3. CREATE SAMPLE BUYER REQUIREMENT
    print("Creating sample wholesale buyer requirement...")
    sample_req = {
        "buyer_id": buyer_id,
        "title": "Wholesale Order for 500 Handmade Jute Gift Bags",
        "category": "Jute & Natural Fiber Crafts",
        "description": "Looking for 500 units of high-grade natural jute gift bags for corporate Diwali and New Year kits. Deliverable to Chennai within 20 days. Maximum budget ₹150 per bag.",
        "quantity": 500,
        "target_unit_price": 140.00,
        "max_budget": 75000.00,
        "destination_city": "Chennai",
        "destination_state": "Tamil Nadu",
        "delivery_deadline": "2026-11-20",
        "max_lead_time_days": 20,
        "quality_specifications": "Double-stitched seams, clean hemmed edges, biodegradable drawstring closure.",
        "status": "open",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    req_res = db.buyer_requirements.insert_one(sample_req)
    req_id = str(req_res.inserted_id)

    # 4. CREATE SAMPLE COMPLETED ORDER & REVIEW FOR SOCIAL IMPACT METRICS
    print("Creating sample completed order and verified review...")
    order_doc = {
        "order_number": "ORD-20261018-DEMO01",
        "buyer_id": buyer_id,
        "seller_id": seller_id,
        "product_id": p1_id,
        "quantity": 25,
        "unit_price": 650.00,
        "total_amount": 16250.00,
        "currency": "INR",
        "payment_method": "manual_escrow_wire",
        "payment_status": "escrow_released",
        "status": "completed",
        "delivery_address": {"city": "Chennai", "state": "Tamil Nadu", "pincode": "600018"},
        "delivery_terms": "Delivered via express road carrier",
        "lead_time_days": 10,
        "production_progress": [
            {"stage": "Weaving complete", "percentage": 100, "notes": "Passed final hand inspection", "updated_at": now_iso}
        ],
        "shipping_details": {"carrier": "TN State Logistics", "tracking_number": "TN-EXP-8991"},
        "created_at": now_iso,
        "updated_at": now_iso
    }
    order_id = str(db.orders.insert_one(order_doc).inserted_id)

    # Review for this completed order
    db.reviews.insert_one({
        "order_id": order_id,
        "buyer_id": buyer_id,
        "buyer_name": "Anita Venkatesh",
        "seller_id": seller_id,
        "product_id": p1_id,
        "rating": 5,
        "craftsmanship_rating": 5,
        "delivery_rating": 5,
        "communication_rating": 5,
        "comment": "Superb authentic handloom weave. The traditional border and drape exceeded expectations for our boutique collection.",
        "created_at": now_iso
    })

    save_mock_state()

    print("\n" + "="*60)
    print("SUCCESS: Database seeded successfully with demo accounts!")
    print("="*60)
    print("ADMIN LOGIN:  admin@marketlink.local  / Admin@12345")
    print("SELLER LOGIN: seller@marketlink.local / Seller@12345")
    print("BUYER LOGIN:  buyer@marketlink.local  / Buyer@12345")
    print("="*60 + "\n")

if __name__ == "__main__":
    force_flag = "--force" in sys.argv
    seed_database(force=force_flag)
