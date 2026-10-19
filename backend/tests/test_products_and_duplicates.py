from services.duplicate_detector import check_duplicate_image
from services.ai_service import generate_catalog_suggestion

def test_product_lifecycle(client, seller_headers, db):
    # 1. Create product
    new_prod = {
        "title": "Kanchipuram Silk Stole with Zari Border",
        "category": "Handloom & Textiles",
        "description": "Artisan woven pure silk stole with subtle gold zari borders.",
        "materials": "Pure Mulberry Silk, Silver-plated Zari",
        "price_per_unit": 1200.00,
        "stock_quantity": 40,
        "moq": 5,
        "monthly_capacity": 150,
        "lead_time_days": 15
    }
    create_res = client.post("/api/products", headers=seller_headers, json=new_prod)
    assert create_res.status_code == 201
    prod_id = create_res.get_json()["product_id"]

    # 2. Get product
    get_res = client.get(f"/api/products/{prod_id}")
    assert get_res.status_code == 200
    assert get_res.get_json()["product"]["title"] == new_prod["title"]
    assert get_res.get_json()["product"]["price_per_unit"] == 1200.00

    # 3. Update product
    update_res = client.put(f"/api/products/{prod_id}", headers=seller_headers, json={
        "price_per_unit": 1150.00,
        "stock_quantity": 45
    })
    assert update_res.status_code == 200

    # 4. Check updated
    get_res2 = client.get(f"/api/products/{prod_id}")
    assert get_res2.get_json()["product"]["price_per_unit"] == 1150.00

    # 5. Archive product
    del_res = client.delete(f"/api/products/{prod_id}", headers=seller_headers)
    assert del_res.status_code == 200

def test_duplicate_image_detection(client, db):
    # Find existing hash in catalog (seeded)
    existing_hash_doc = db.image_hashes.find_one({})
    assert existing_hash_doc is not None
    phash_val = existing_hash_doc["phash"]
    other_seller_id = existing_hash_doc["seller_id"]

    # Check against a different seller
    new_seller_id = "test_seller_9999"
    matches = check_duplicate_image(phash_val, current_seller_id=new_seller_id)
    assert len(matches) > 0
    assert matches[0]["is_exact_duplicate"] is True
    assert matches[0]["similarity_score"] == 100.0

    # Verify flag was queued for admin review
    flag = db.duplicate_flags.find_one({"new_seller_id": new_seller_id})
    assert flag is not None
    assert flag["status"] == "pending_review"

def test_catalog_generation_deterministic_fallback(client, seller_headers):
    res = client.post("/api/products/ai-catalog-generate", headers=seller_headers, json={
        "title": "Handmade Clay Terracotta Cup",
        "notes": "Natural clay fired cups"
    })
    assert res.status_code == 200
    data = res.get_json()["suggestion"]
    assert data["success"] is True
    assert data["ai_powered"] is False
    assert "deterministic" in data["source"]
    assert data["category"] == "Pottery & Terracotta"
    assert "Terracotta" in data["title"]
