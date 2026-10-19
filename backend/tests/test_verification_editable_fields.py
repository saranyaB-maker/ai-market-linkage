import io
import uuid
import pytest

def test_artisan_verification_editable_fields_and_lifecycle(client, admin_headers):
    # 1. Register a test artisan
    artisan_email = f"artisan_{uuid.uuid4().hex[:8]}@example.com"
    reg_res = client.post("/api/auth/register", json={
        "email": artisan_email,
        "password": "Password123!",
        "full_name": "Meenakshi Sundaram",
        "role": "seller",
        "phone": "+91 94433 11223"
    })
    assert reg_res.status_code == 201
    token = reg_res.get_json()["token"]
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # 2. Get initial application - should load empty/initial draft
    res = client.get("/api/verification/application", headers=headers)
    assert res.status_code == 200
    app = res.get_json()["application"]
    assert app["status"] in ["not_started", "draft", "in_progress"]

    # 3. Edit Step 1: Artisan Profile with all producer verification fields
    # including production_method, materials_used, craft_category, etc.
    step1_payload = {
        "step": 1,
        "data": {
            "full_name": "Meenakshi Sundaram",
            "phone": "+91 94433 11223",
            "craft_category": "Clay Pottery & Terracotta",
            "years_experience": 18,
            "district": "Madurai",
            "state": "Tamil Nadu",
            "production_method": "Wheel-thrown & Sun-dried",
            "materials_used": "Natural Riverbed Clay, Organic Vegetable Dyes",
            "workshop_details": "Traditional open-air rural pottery studio with wood-fired reduction kiln."
        }
    }
    step1_res = client.post("/api/verification/application/save-step", headers=headers, json=step1_payload)
    assert step1_res.status_code == 200
    assert step1_res.get_json()["current_step"] == 1

    # Reload data from API to verify real persistence in database
    reload_res = client.get("/api/verification/application", headers=headers)
    assert reload_res.status_code == 200
    loaded_profile = reload_res.get_json()["application"]["artisan_profile"]
    assert loaded_profile["craft_category"] == "Clay Pottery & Terracotta"
    assert loaded_profile["production_method"] == "Wheel-thrown & Sun-dried"
    assert loaded_profile["materials_used"] == "Natural Riverbed Clay, Organic Vegetable Dyes"
    assert loaded_profile["years_experience"] == 18

    # 4. Update/modify Step 1 again (making all fields editable at any time)
    step1_payload["data"]["years_experience"] = 19
    step1_payload["data"]["materials_used"] = "Natural Riverbed Clay, Terracotta Slip, Organic Dyes"
    update_res = client.post("/api/verification/application/save-step", headers=headers, json=step1_payload)
    assert update_res.status_code == 200

    reload2 = client.get("/api/verification/application", headers=headers)
    assert reload2.get_json()["application"]["artisan_profile"]["years_experience"] == 19
    assert "Terracotta Slip" in reload2.get_json()["application"]["artisan_profile"]["materials_used"]

    # 5. Upload verification document (Step 2)
    doc_file = (io.BytesIO(b"%PDF-1.4 Mock artisan ID proof card content"), "artisan_id.pdf")
    upload_doc = client.post(
        "/api/verification/upload-evidence",
        headers={"Authorization": f"Bearer {token}"},
        data={"evidence_type": "artisan_card", "notes": "Govt Artisan ID Card", "file": doc_file},
        content_type="multipart/form-data"
    )
    assert upload_doc.status_code == 201
    doc_id = upload_doc.get_json()["evidence"]["id"]

    # 6. Upload craft video (Step 3)
    vid_file = (io.BytesIO(b"RIFF mock webm video bytes of clay spinning"), "wheel_pottery.webm")
    upload_vid = client.post(
        "/api/verification/upload-evidence",
        headers={"Authorization": f"Bearer {token}"},
        data={"evidence_type": "craft_video", "notes": "Artisan working on potter's wheel", "file": vid_file},
        content_type="multipart/form-data"
    )
    assert upload_vid.status_code == 201
    vid_id = upload_vid.get_json()["evidence"]["id"]

    # 7. Check that evidence list loads properly for the artisan
    ev_res = client.get("/api/verification/application", headers=headers)
    ev_list = ev_res.get_json()["evidence"]
    assert len(ev_list) == 2

    # 8. Test Delete Evidence: remove document and re-upload another
    del_res = client.delete(f"/api/verification/evidence/{doc_id}", headers=headers)
    assert del_res.status_code == 200

    ev_res_after_del = client.get("/api/verification/application", headers=headers)
    assert len(ev_res_after_del.get_json()["evidence"]) == 1

    # Upload new document
    new_doc_file = (io.BytesIO(b"%PDF-1.4 Updated artisan handicraft registry"), "updated_registry.pdf")
    new_upload = client.post(
        "/api/verification/upload-evidence",
        headers={"Authorization": f"Bearer {token}"},
        data={"evidence_type": "registration_cert", "notes": "Updated Registry", "file": new_doc_file},
        content_type="multipart/form-data"
    )
    assert new_upload.status_code == 201
    new_doc_id = new_upload.get_json()["evidence"]["id"]

    # 9. Register a second user to test authorization protection
    buyer_email = f"buyer_{uuid.uuid4().hex[:8]}@example.com"
    reg_buyer = client.post("/api/auth/register", json={
        "email": buyer_email,
        "password": "Password123!",
        "full_name": "Unauthorized Buyer",
        "role": "buyer"
    })
    buyer_token = reg_buyer.get_json()["token"]
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}

    # Buyer cannot view artisan's private evidence file
    unauth_doc_get = client.get(f"/api/verification/evidence/{new_doc_id}", headers=buyer_headers)
    assert unauth_doc_get.status_code in [403, 404]

    # Buyer cannot delete artisan's evidence
    unauth_doc_del = client.delete(f"/api/verification/evidence/{new_doc_id}", headers=buyer_headers)
    assert unauth_doc_del.status_code in [403, 404]

    # 10. Submit application for verification
    submit_res = client.post("/api/verification/submit-application", headers=headers, json={
        "declaration": True,
        "notes": "Completed dossier ready for review."
    })
    assert submit_res.status_code == 200
    assert submit_res.get_json()["status"] == "pending"

    # Verify duplicate submission is rejected while pending
    dup_res = client.post("/api/verification/submit-application", headers=headers, json={"declaration": True})
    assert dup_res.status_code == 400

    # 11. Reopen application as draft to allow artisan to update details
    reopen_res = client.post("/api/verification/application/reopen-draft", headers=headers)
    assert reopen_res.status_code == 200
    assert reopen_res.get_json()["verification_status"] == "draft"

    # Check status changed back to draft in DB
    app_reopened = client.get("/api/verification/application", headers=headers).get_json()["application"]
    assert app_reopened["status"] == "draft"

    # Artisan updates profile during draft
    step1_payload["data"]["workshop_details"] = "Expanded solar-powered rural pottery studio with traditional kiln."
    client.post("/api/verification/application/save-step", headers=headers, json=step1_payload)

    # Resubmit after updating
    resubmit_res = client.post("/api/verification/submit-application", headers=headers, json={"declaration": True})
    assert resubmit_res.status_code == 200
    assert resubmit_res.get_json()["status"] == "pending"

    # 12. Admin reviews and approves the application
    artisan_user_id = reg_res.get_json()["user"]["id"]
    admin_review_res = client.post(
        "/api/verification/review",
        headers=admin_headers,
        json={"user_id": artisan_user_id, "decision": "approved", "reason": "Authentic rural clay artisan verified."}
    )
    assert admin_review_res.status_code == 200
    assert admin_review_res.get_json()["new_status"] in ["approved", "verified_producer"]
    assert admin_review_res.get_json()["is_approved"] is True

    # Final check: Application status is now approved in database
    final_app = client.get("/api/verification/application", headers=headers).get_json()["application"]
    assert final_app["status"] in ["approved", "verified_producer"]
