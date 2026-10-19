def test_verification_and_admin_workflow(client, seller_headers, admin_headers, db):
    seller = db.users.find_one({"email": "seller@marketlink.local"})
    seller_id = str(seller["_id"])

    # 1. Admin reviews verification
    review_res = client.post("/api/verification/review", headers=admin_headers, json={
        "user_id": seller_id,
        "decision": "verified_producer",
        "reason": "Workshop physical photos and pitloom setup verified by field coordinator.",
        "identity_verified": True
    })
    assert review_res.status_code == 200
    assert review_res.get_json()["new_status"] == "verified_producer"
    assert review_res.get_json()["history_entry"]["reason"] != ""

    # 2. Check updated verification status
    status_res = client.get(f"/api/verification/status?user_id={seller_id}", headers=admin_headers)
    assert status_res.status_code == 200
    assert status_res.get_json()["verification"]["verification_status"] == "verified_producer"
    assert len(status_res.get_json()["verification"]["decision_history"]) > 0

    # 3. Admin suspends an account with recorded reason
    user_to_suspend = db.users.find_one({"email": "kaveri_shg@marketlink.local"})
    susp_res = client.put(f"/api/admin/users/{str(user_to_suspend['_id'])}/status", headers=admin_headers, json={
        "status": "suspended",
        "reason": "Temporary suspension pending reverification of registered address."
    })
    assert susp_res.status_code == 200
    assert susp_res.get_json()["status"] == "suspended"

    # 4. Reinstate account
    reinstate_res = client.put(f"/api/admin/users/{str(user_to_suspend['_id'])}/status", headers=admin_headers, json={
        "status": "active"
    })
    assert reinstate_res.status_code == 200
    assert reinstate_res.get_json()["status"] == "active"
