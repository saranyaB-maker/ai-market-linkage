def test_demo_logins(client):
    # Admin
    res_admin = client.post("/api/auth/login", json={"email": "admin@marketlink.local", "password": "Admin@12345"})
    assert res_admin.status_code == 200
    assert res_admin.get_json()["user"]["role"] == "admin"
    assert "token" in res_admin.get_json()

    # Seller
    res_seller = client.post("/api/auth/login", json={"email": "seller@marketlink.local", "password": "Seller@12345"})
    assert res_seller.status_code == 200
    assert res_seller.get_json()["user"]["role"] == "seller"
    assert res_seller.get_json()["user"]["verification_status"] == "verified_producer"

    # Buyer
    res_buyer = client.post("/api/auth/login", json={"email": "buyer@marketlink.local", "password": "Buyer@12345"})
    assert res_buyer.status_code == 200
    assert res_buyer.get_json()["user"]["role"] == "buyer"

def test_invalid_login(client):
    res = client.post("/api/auth/login", json={"email": "buyer@marketlink.local", "password": "WrongPassword"})
    assert res.status_code == 401
    assert "Invalid email or password" in res.get_json()["error"]

def test_prevent_public_admin_registration(client):
    res = client.post("/api/auth/register", json={
        "email": "hacker_admin@test.local",
        "password": "Password@123",
        "role": "admin",
        "full_name": "Attempted Admin",
        "phone": "9876543210"
    })
    assert res.status_code == 403
    assert "strictly forbidden" in res.get_json()["error"].lower()

def test_registration_validation(client):
    # Bad email
    res1 = client.post("/api/auth/register", json={
        "email": "not-an-email",
        "password": "Password@123",
        "role": "seller",
        "full_name": "Test Artisan"
    })
    assert res1.status_code == 400

    # Short password
    res2 = client.post("/api/auth/register", json={
        "email": "artisan2@test.local",
        "password": "123",
        "role": "seller",
        "full_name": "Test Artisan"
    })
    assert res2.status_code == 400

def test_rbac_restrictions(client, buyer_headers, seller_headers):
    # Buyer trying to create a product (seller-only) -> 403
    res_buyer_prod = client.post("/api/products", headers=buyer_headers, json={
        "title": "Unauthorized Product",
        "category": "Pottery & Terracotta",
        "price_per_unit": 200
    })
    assert res_buyer_prod.status_code == 403

    # Seller trying to access admin overview metrics -> 403
    res_seller_admin = client.get("/api/admin/overview-metrics", headers=seller_headers)
    assert res_seller_admin.status_code == 403

    # Unauthenticated access -> 401
    res_unauth = client.get("/api/admin/overview-metrics")
    assert res_unauth.status_code == 401
