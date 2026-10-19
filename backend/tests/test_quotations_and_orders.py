from bson import ObjectId

def test_quotation_and_order_flow(client, seller_headers, buyer_headers, db):
    # Get seeded buyer and seller
    buyer = db.users.find_one({"email": "buyer@marketlink.local"})
    seller = db.users.find_one({"email": "seller@marketlink.local"})
    prod = db.products.find_one({"seller_id": str(seller["_id"])})
    
    # 1. Seller submits quotation
    q_payload = {
        "buyer_id": str(buyer["_id"]),
        "product_id": str(prod["_id"]),
        "quantity": 30,
        "unit_price": 600.00,
        "lead_time_days": 10,
        "notes": "Bulk discount offered for 30 sarees"
    }
    q_res = client.post("/api/quotations", headers=seller_headers, json=q_payload)
    assert q_res.status_code == 201
    q_id = q_res.get_json()["quotation_id"]
    
    # 2. Buyer counteroffers / requests revision
    rev_res = client.post(f"/api/quotations/{q_id}/revise", headers=buyer_headers, json={
        "quantity": 30,
        "unit_price": 580.00,
        "notes": "Counteroffer: Will confirm at ₹580 per unit"
    })
    assert rev_res.status_code == 200
    assert rev_res.get_json()["new_status"] == "revision_requested"

    # 3. Seller accepts counteroffer by revising terms
    seller_rev_res = client.post(f"/api/quotations/{q_id}/revise", headers=seller_headers, json={
        "quantity": 30,
        "unit_price": 580.00,
        "notes": "Accepted ₹580 per unit for 30 units"
    })
    assert seller_rev_res.status_code == 200
    assert seller_rev_res.get_json()["new_status"] == "submitted"

    # 4. Buyer accepts quotation
    accept_res = client.post(f"/api/quotations/{q_id}/respond", headers=buyer_headers, json={"action": "accept"})
    assert accept_res.status_code == 200
    assert accept_res.get_json()["status"] == "accepted"

    # 5. Prevent accepting quotation twice
    double_accept = client.post(f"/api/quotations/{q_id}/respond", headers=buyer_headers, json={"action": "accept"})
    assert double_accept.status_code == 409

    # 6. Create order from quotation
    order_res = client.post("/api/orders/create-from-quotation", headers=buyer_headers, json={
        "quotation_id": q_id,
        "delivery_address": {"city": "Chennai", "state": "Tamil Nadu"}
    })
    assert order_res.status_code in [200, 201]
    order_id = order_res.get_json()["order_id"]
    assert "ORD-" in order_res.get_json()["order_number"]

    # 7. Seller updates production progress
    prog_res = client.post(f"/api/orders/{order_id}/progress", headers=seller_headers, json={
        "stage": "Loom Weaving 50% Completed",
        "percentage": 50,
        "notes": "Saree borders completed"
    })
    assert prog_res.status_code == 200

    # 8. Seller records dispatch
    disp_res = client.post(f"/api/orders/{order_id}/dispatch", headers=seller_headers, json={
        "carrier": "Blue Dart Surface",
        "tracking_number": "BD-88991122"
    })
    assert disp_res.status_code == 200

    # 9. Buyer confirms delivery
    deliv_res = client.post(f"/api/orders/{order_id}/confirm-delivery", headers=buyer_headers)
    assert deliv_res.status_code == 200
    assert deliv_res.get_json()["status"] == "completed"

    # 10. Buyer submits review
    rev_post_res = client.post("/api/reviews", headers=buyer_headers, json={
        "order_id": order_id,
        "rating": 5,
        "comment": "Outstanding handloom craftsmanship and fast delivery."
    })
    assert rev_post_res.status_code == 201

    # 11. Prevent duplicate review for same order
    dup_rev = client.post("/api/reviews", headers=buyer_headers, json={
        "order_id": order_id,
        "rating": 4
    })
    assert dup_rev.status_code == 409
