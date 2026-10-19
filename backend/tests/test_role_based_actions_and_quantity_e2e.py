import pytest
from bson import ObjectId
from routes.auth_helpers import create_jwt_token

@pytest.fixture
def other_seller_headers(db):
    other_seller = db.users.find_one({"email": "artisan2@craftcoop.local"})
    if not other_seller:
        # Create a second seller user
        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()
        res = db.users.insert_one({
            "email": "other_artisan@marketlink.local",
            "full_name": "Ramanathan Master Weaver",
            "role": "seller",
            "status": "active",
            "created_at": now_iso
        })
        other_seller = db.users.find_one({"_id": res.inserted_id})
    token = create_jwt_token(str(other_seller["_id"]), other_seller["role"], other_seller["email"])
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def test_role_based_product_editing_permissions(client, seller_headers, other_seller_headers, admin_headers, db):
    # 1. Primary seller creates a product
    prod_payload = {
        "title": "Authentic Madurai Brass Diya Lamp",
        "category": "Metal & Bell Metal Crafts",
        "description": "Hand-cast traditional solid brass diya for pooja and decor.",
        "materials": "Solid Brass",
        "price_per_unit": 850.0,
        "stock_quantity": 25,
        "moq": 2,
        "monthly_capacity": 100,
        "lead_time_days": 10
    }
    res_create = client.post("/api/products", headers=seller_headers, json=prod_payload)
    assert res_create.status_code == 201
    prod_id = res_create.get_json()["product_id"]

    try:
        # 2. Other seller attempts to edit this product -> MUST BE REJECTED with 403 Forbidden
        res_unauthorized = client.put(f"/api/products/{prod_id}", headers=other_seller_headers, json={
            "title": "Hacked Title by Competitor",
            "price_per_unit": 100.0
        })
        assert res_unauthorized.status_code == 403
        assert "permission" in res_unauthorized.get_json()["error"].lower()

        # 3. Non-owner quick stock update -> MUST BE REJECTED with 403 Forbidden
        res_stock_unauth = client.patch(f"/api/products/{prod_id}/stock", headers=other_seller_headers, json={
            "stock_quantity": 999
        })
        assert res_stock_unauth.status_code == 403

        # 4. True owner edits product -> SUCCEEDS
        res_owner_edit = client.put(f"/api/products/{prod_id}", headers=seller_headers, json={
            "title": "Mastercrafted Madurai Brass Diya Lamp (Temple Grade)",
            "price_per_unit": 920.0,
            "stock_quantity": 30,
            "moq": 3,
            "dimensions": "8 inches height, 500g"
        })
        assert res_owner_edit.status_code == 200
        data = res_owner_edit.get_json()["product"]
        assert data["price_per_unit"] == 920.0
        assert data["stock_quantity"] == 30
        assert data["moq"] == 3

        # 5. True owner uses quick stock update -> SUCCEEDS
        res_stock_owner = client.patch(f"/api/products/{prod_id}/stock", headers=seller_headers, json={
            "stock_quantity": 40
        })
        assert res_stock_owner.status_code == 200
        assert res_stock_owner.get_json()["stock_quantity"] == 40

        # 6. Admin edits product -> SUCCEEDS (Admin override privilege)
        res_admin_edit = client.put(f"/api/products/{prod_id}", headers=admin_headers, json={
            "price_per_unit": 950.0
        })
        assert res_admin_edit.status_code == 200
        assert res_admin_edit.get_json()["product"]["price_per_unit"] == 950.0

    finally:
        client.delete(f"/api/products/{prod_id}", headers=seller_headers)

def test_self_purchase_prevention(client, seller_headers, buyer_headers, db):
    # Create product owned by seller
    prod_payload = {
        "title": "Toda Hand-Embroidered Shawl",
        "category": "Handloom & Textiles",
        "description": "Distinctive red and black geometric embroidery on unbleached cotton.",
        "materials": "Cotton, Wool",
        "price_per_unit": 2200.0,
        "stock_quantity": 15,
        "moq": 1,
        "lead_time_days": 7
    }
    res_create = client.post("/api/products", headers=seller_headers, json=prod_payload)
    assert res_create.status_code == 201
    prod_id = res_create.get_json()["product_id"]

    try:
        # Seller attempts to purchase their own product via direct checkout -> MUST FAIL with 400
        checkout_payload = {
            "items": [
                {
                    "product_id": prod_id,
                    "quantity": 2
                }
            ],
            "delivery_address": {
                "full_name": "Artisan Self",
                "phone": "9876543210",
                "street": "12 Weaver Colony",
                "city": "Ooty",
                "state": "Tamil Nadu",
                "pincode": "643001"
            }
        }
        res_self_purchase = client.post("/api/orders/checkout", headers=seller_headers, json=checkout_payload)
        assert res_self_purchase.status_code == 400
        assert "cannot purchase their own products" in res_self_purchase.get_json()["error"]

        # Legitimate wholesale buyer purchases the item -> MUST SUCCEED
        res_buyer_purchase = client.post("/api/orders/checkout", headers=buyer_headers, json=checkout_payload)
        assert res_buyer_purchase.status_code == 201
        assert res_buyer_purchase.get_json()["success"] is True

    finally:
        client.delete(f"/api/products/{prod_id}", headers=seller_headers)

def test_stock_below_moq_and_quantity_selector_enforcement(client, seller_headers, buyer_headers):
    # Scenario: Available stock is 2, but Minimum Order Quantity is 50 (exact screenshot case)
    mismatched_prod = {
        "title": "Handcrafted Terracotta Water Jug (Batch Inconsistency Case)",
        "category": "Household Goods, Water Jugs & Pitchers",
        "description": "Natural cooling earthenware water pot.",
        "materials": "Terracotta Clay",
        "price_per_unit": 350.0,
        "stock_quantity": 2,  # Stock = 2
        "moq": 50,             # MOQ = 50
        "lead_time_days": 14
    }
    res_create = client.post("/api/products", headers=seller_headers, json=mismatched_prod)
    assert res_create.status_code == 201
    prod_id = res_create.get_json()["product_id"]

    try:
        checkout_address = {
            "full_name": "Priya Sundaram",
            "phone": "9876543211",
            "street": "44 Bazaar Street",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "pincode": "600001"
        }

        # 1. Buyer attempts to buy quantity = 2 (which is below MOQ of 50) -> REJECTED
        res_order_qty2 = client.post("/api/orders/checkout", headers=buyer_headers, json={
            "items": [{"product_id": prod_id, "quantity": 2}],
            "delivery_address": checkout_address
        })
        assert res_order_qty2.status_code == 400
        err_msg = res_order_qty2.get_json()["error"]
        assert "below the minimum order quantity" in err_msg or "below minimum order quantity" in err_msg

        # 2. Buyer attempts to buy quantity = 50 (which exceeds available stock of 2) -> REJECTED
        res_order_qty50 = client.post("/api/orders/checkout", headers=buyer_headers, json={
            "items": [{"product_id": prod_id, "quantity": 50}],
            "delivery_address": checkout_address
        })
        assert res_order_qty50.status_code == 400
        assert "below the minimum order quantity" in res_order_qty50.get_json()["error"] or "insufficient stock" in res_order_qty50.get_json()["error"].lower()

        # 3. Seller fixes the inventory values: updates stock to 60 units (stock >= MOQ)
        res_fix = client.patch(f"/api/products/{prod_id}/stock", headers=seller_headers, json={
            "stock_quantity": 60
        })
        assert res_fix.status_code == 200

        # 4. Now valid order with quantity = 50 (moq <= 50 <= 60) -> SUCCEEDS
        res_success = client.post("/api/orders/checkout", headers=buyer_headers, json={
            "items": [{"product_id": prod_id, "quantity": 50}],
            "delivery_address": checkout_address
        })
        assert res_success.status_code == 201
        assert res_success.get_json()["success"] is True

        # Check stock was decremented properly from 60 to 10
        res_prod = client.get(f"/api/products/{prod_id}")
        assert res_prod.status_code == 200
        assert res_prod.get_json()["product"]["stock_quantity"] == 10

    finally:
        client.delete(f"/api/products/{prod_id}", headers=seller_headers)

def test_atomic_overselling_protection(client, seller_headers, buyer_headers, db):
    # Test atomic rejection when requested quantity exceeds available stock
    prod_payload = {
        "title": "Rare Sandalwood Hand Fan",
        "category": "Woodwork & Carving",
        "description": "Finely carved pure aromatic sandalwood folding fan.",
        "materials": "Sandalwood",
        "price_per_unit": 1500.0,
        "stock_quantity": 5,
        "moq": 1,
        "lead_time_days": 5
    }
    res_create = client.post("/api/products", headers=seller_headers, json=prod_payload)
    assert res_create.status_code == 201
    prod_id = res_create.get_json()["product_id"]

    try:
        checkout_address = {
            "full_name": "Kavitha Buyer",
            "phone": "9876543212",
            "street": "18 Gandhi Road",
            "city": "Salem",
            "state": "Tamil Nadu",
            "pincode": "636001"
        }

        # First buyer takes 4 units
        res1 = client.post("/api/orders/checkout", headers=buyer_headers, json={
            "items": [{"product_id": prod_id, "quantity": 4}],
            "delivery_address": checkout_address
        })
        assert res1.status_code == 201

        # Only 1 unit left in stock. Next order requests 3 units -> MUST BE REJECTED (Overselling blocked)
        res2 = client.post("/api/orders/checkout", headers=buyer_headers, json={
            "items": [{"product_id": prod_id, "quantity": 3}],
            "delivery_address": checkout_address
        })
        assert res2.status_code == 400
        assert "insufficient stock" in res2.get_json()["error"].lower()

        # Check stock was NOT decremented to negative
        res_check = client.get(f"/api/products/{prod_id}")
        assert res_check.get_json()["product"]["stock_quantity"] == 1

    finally:
        client.delete(f"/api/products/{prod_id}", headers=seller_headers)
