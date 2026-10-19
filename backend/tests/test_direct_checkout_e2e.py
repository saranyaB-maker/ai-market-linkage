import requests
import json
import sys

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_URL = "http://localhost:5000/api"

def run_tests():
    print("=== STARTING DIRECT PURCHASING & ORDER VERIFICATION SUITE ===")

    # 1. Login as Buyer
    s_buyer = requests.Session()
    res_b = s_buyer.post(f"{BASE_URL}/auth/login", json={
        "email": "buyer@marketlink.local",
        "password": "Buyer@12345"
    })
    assert res_b.status_code == 200, f"Buyer login failed: {res_b.text}"
    buyer_data = res_b.json()
    buyer_user = buyer_data["user"]
    s_buyer.headers.update({"Authorization": f"Bearer {buyer_data['token']}"})
    print(f"[OK] Buyer logged in: {buyer_user['full_name']} ({buyer_user['id']})")

    # 2. Login as Seller
    s_seller = requests.Session()
    res_s = s_seller.post(f"{BASE_URL}/auth/login", json={
        "email": "seller@marketlink.local",
        "password": "Seller@12345"
    })
    assert res_s.status_code == 200, f"Seller login failed: {res_s.text}"
    seller_data = res_s.json()
    seller_user = seller_data["user"]
    s_seller.headers.update({"Authorization": f"Bearer {seller_data['token']}"})
    print(f"[OK] Seller logged in: {seller_user['full_name']} ({seller_user['id']})")

    # 3. Get available marketplace products
    res_prod = s_buyer.get(f"{BASE_URL}/products?status=published")
    assert res_prod.status_code == 200, f"Failed to get products: {res_prod.text}"
    products = res_prod.json().get("products", [])
    assert len(products) > 0, "No published products found in marketplace"
    
    # Pick a product with positive stock
    target_product = None
    for p in products:
        if p.get("stock_quantity", 0) > 0:
            target_product = p
            break
    assert target_product is not None, "No product with positive stock found"

    prod_id = target_product["id"]
    initial_stock = target_product["stock_quantity"]
    moq = target_product.get("moq", 1)
    unit_price = target_product["price_per_unit"]
    print(f"[OK] Target product selected: '{target_product['title']}' (ID: {prod_id})")
    print(f"     Initial Stock: {initial_stock}, MOQ: {moq}, Unit Price: ₹{unit_price}")

    # 4. Test validation: quantity < moq should fail if moq > 1
    if moq > 1:
        bad_res = s_buyer.post(f"{BASE_URL}/orders/checkout", json={
            "items": [{"productId": prod_id, "quantity": 1}],
            "deliveryAddress": {
                "fullName": "Buyer Test",
                "phone": "9876543210",
                "street": "123 Craft Lane",
                "city": "Chennai",
                "state": "Tamil Nadu",
                "pincode": "600001"
            },
            "paymentMethod": "cod"
        })
        assert bad_res.status_code == 400, f"Expected 400 for qty < moq, got {bad_res.status_code}: {bad_res.text}"
        print(f"[OK] Server rejected quantity below MOQ (status 400: {bad_res.json()['error']})")

    # 5. Test validation: quantity > stock should fail
    bad_res2 = s_buyer.post(f"{BASE_URL}/orders/checkout", json={
        "items": [{"productId": prod_id, "quantity": initial_stock + 999}],
        "deliveryAddress": {
            "fullName": "Buyer Test",
            "phone": "9876543210",
            "street": "123 Craft Lane",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "pincode": "600001"
        },
        "paymentMethod": "cod"
    })
    assert bad_res2.status_code == 400, f"Expected 400 for qty > stock, got {bad_res2.status_code}: {bad_res2.text}"
    print(f"[OK] Server rejected quantity exceeding inventory (status 400: {bad_res2.json()['error']})")

    # 6. Execute successful direct checkout
    order_qty = moq
    expected_subtotal = unit_price * order_qty
    checkout_payload = {
        "items": [{
            "productId": prod_id,
            "quantity": order_qty
        }],
        "deliveryAddress": {
            "fullName": "Priya Sharma",
            "phone": "9876543210",
            "street": "42 Artisan Boulevard, Alwarpet",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "pincode": "600018"
        },
        "paymentMethod": "demo_escrow",
        "notes": "Please pack with extra cushioning for fragile craft item."
    }

    res_checkout = s_buyer.post(f"{BASE_URL}/orders/checkout", json=checkout_payload)
    assert res_checkout.status_code == 201, f"Checkout failed: {res_checkout.status_code} {res_checkout.text}"
    checkout_data = res_checkout.json()
    order = checkout_data.get("order") or checkout_data["orders"][0]
    order_id = order.get("order_id") or order.get("id")
    order_number = order["order_number"]
    print(f"[OK] Order placed successfully: {order_number} (ID: {order_id})")
    print(f"     Status: {order['status']}, Payment: {order['payment_status']}, Total: ₹{order['total_amount']}")
    assert order["total_amount"] == expected_subtotal, f"Total amount mismatch: expected {expected_subtotal}, got {order['total_amount']}"

    # 7. Verify inventory deduction in database
    res_prod_after = s_buyer.get(f"{BASE_URL}/products/{prod_id}")
    assert res_prod_after.status_code == 200
    updated_prod = res_prod_after.json()["product"]
    new_stock = updated_prod["stock_quantity"]
    expected_stock = initial_stock - order_qty
    assert new_stock == expected_stock, f"Stock decrement mismatch: expected {expected_stock}, got {new_stock}"
    print(f"[OK] Inventory accurately updated: {initial_stock} -> {new_stock} (-{order_qty} units)")

    # 8. Verify order in Buyer's dashboard orders list
    res_b_orders = s_buyer.get(f"{BASE_URL}/orders")
    assert res_b_orders.status_code == 200
    buyer_orders = res_b_orders.json().get("orders", [])
    found_in_buyer = any(o["id"] == order_id for o in buyer_orders)
    assert found_in_buyer, "Order was not found in Buyer's orders list!"
    print(f"[OK] Order verified in Buyer's order history ({len(buyer_orders)} total orders)")

    # 9. Verify order in Seller's dashboard orders list
    res_s_orders = s_seller.get(f"{BASE_URL}/orders")
    assert res_s_orders.status_code == 200
    seller_orders = res_s_orders.json().get("orders", [])
    found_in_seller = any(o["id"] == order_id for o in seller_orders)
    assert found_in_seller, "Order was not found in Seller's orders list!"
    print(f"[OK] Order verified in Seller's orders list ({len(seller_orders)} total orders)")

    # 10. Verify wholesale quotation flow is still 100% operational (preserve 403 fix)
    # Check open requirements
    res_req = s_seller.get(f"{BASE_URL}/matching/requirements?status=open")
    assert res_req.status_code == 200
    open_reqs = res_req.json().get("requirements", [])
    if open_reqs:
        test_req = open_reqs[0]
        # Test quotation submission
        quot_payload = {
            "requirement_id": test_req["id"],
            "unit_price": 450,
            "quantity_offered": test_req.get("quantity", 50),
            "lead_time_days": 14,
            "delivery_terms": "Ex-factory / Buyer arranges courier",
            "payment_terms": "50% advance, 50% on dispatch",
            "artisan_notes": "Automated regression verification quotation"
        }
        res_quot = s_seller.post(f"{BASE_URL}/quotations", json=quot_payload)
        # Should be 201 (or 400 if already submitted or requirement closed, but NOT 403 Forbidden)
        assert res_quot.status_code != 403, f"Quotation returned 403 Forbidden! Regression occurred: {res_quot.text}"
        print(f"[OK] Wholesale quotation API responded with code {res_quot.status_code} (Non-403: No authorization regression)")

    print("\n=== ALL DIRECT PURCHASING AND ORDER WORKFLOW TESTS PASSED! ===")

if __name__ == "__main__":
    run_tests()
