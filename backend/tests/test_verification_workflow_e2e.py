import io
import json
import pytest

import uuid

def test_full_artisan_verification_lifecycle(client, admin_headers, db):
    test_email = f"saranya_{uuid.uuid4().hex[:8]}@test.local"
    # 1. Register a brand new artisan seller
    reg_res = client.post("/api/auth/register", json={
        "email": test_email,
        "password": "Password123!",
        "full_name": "Saranya B",
        "role": "seller",
        "phone": "+91 98765 43210"
    })
    assert reg_res.status_code == 201, reg_res.get_json()
    saranya_user = reg_res.get_json()["user"]
    saranya_token = reg_res.get_json()["token"]
    saranya_headers = {
        "Authorization": f"Bearer {saranya_token}",
        "Content-Type": "application/json"
    }
    saranya_id = saranya_user["id"]

    # 2. Check initial verification application status
    app_res = client.get("/api/verification/application", headers=saranya_headers)
    assert app_res.status_code == 200
    app_data = app_res.get_json()
    assert app_data["application"]["status"] in ["not_started", "in_progress"]

    # 3. Product publication enforcement check
    # 3. Product publication check:
    # 3a. Unverified sellers can now directly publish products to the marketplace (status 201)
    pub_res = client.post("/api/products/", headers=saranya_headers, json={
        "title": "Authentic Silk Handloom Saree",
        "description": "Pure mulberry silk saree with zari borders",
        "category": "Textiles & Handlooms",
        "unit_price": 4500,
        "inventory_count": 5,
        "is_published": True
    })
    assert pub_res.status_code == 201, pub_res.get_json()
    assert pub_res.get_json()["product"]["is_published"] is True

    # 3b. Saving draft product while unverified must succeed (201)
    draft_res = client.post("/api/products/", headers=saranya_headers, json={
        "title": "Draft Silk Saree Listing",
        "description": "Draft listing under preparation",
        "category": "Textiles & Handlooms",
        "unit_price": 4500,
        "inventory_count": 5,
        "is_published": False
    })
    assert draft_res.status_code == 201
    draft_product_id = draft_res.get_json()["product"]["id"]

    # 4. Step 1: Save Profile
    step1_res = client.post("/api/verification/application/save-step", headers=saranya_headers, json={
        "step": 1,
        "data": {
            "full_name": "Saranya B",
            "phone": "+91 98765 43210",
            "craft_category": "Textiles & Handlooms",
            "years_experience": 12,
            "district": "Kanchipuram",
            "state": "Tamil Nadu",
            "workshop_details": "Family-run handloom weaving unit with 3 traditional pit looms."
        }
    })
    assert step1_res.status_code == 200
    assert step1_res.get_json()["application"]["current_step"] >= 1

    # 5. Step 2: Upload Identity Document
    doc_file = (io.BytesIO(b"%PDF-1.4 mock artisan weaver identity card"), "weaver_card.pdf")
    upload_doc_res = client.post(
        "/api/verification/upload-evidence",
        headers={"Authorization": f"Bearer {saranya_token}"},
        data={
            "evidence_type": "artisan_card",
            "notes": "Govt Weaver Card #TN-2024-8891",
            "file": doc_file
        },
        content_type="multipart/form-data"
    )
    assert upload_doc_res.status_code == 201, upload_doc_res.get_json()
    doc_evidence_id = upload_doc_res.get_json()["evidence"]["id"]

    # 6. Step 3: Upload Craft Video
    vid_file = (io.BytesIO(b"RIFF mock webm video craft proof weaving action"), "pitloom_craft.webm")
    upload_vid_res = client.post(
        "/api/verification/upload-evidence",
        headers={"Authorization": f"Bearer {saranya_token}"},
        data={
            "evidence_type": "craft_video",
            "notes": "Live craft video showing shuttle throw and pitloom operation",
            "file": vid_file
        },
        content_type="multipart/form-data"
    )
    assert upload_vid_res.status_code == 201, upload_vid_res.get_json()
    vid_evidence_id = upload_vid_res.get_json()["evidence"]["id"]

    # Save step 3 metadata
    step3_res = client.post("/api/verification/application/save-step", headers=saranya_headers, json={
        "step": 3,
        "data": {
            "video_evidence_id": vid_evidence_id,
            "technique_description": "Traditional shuttle loom hand-weaving"
        }
    })
    assert step3_res.status_code == 200

    # 7. Step 4: Submit Application for Review
    submit_res = client.post("/api/verification/submit-application", headers=saranya_headers, json={
        "declaration": True,
        "notes": "Please review my artisan weaving dossier."
    })
    assert submit_res.status_code == 200, submit_res.get_json()
    assert submit_res.get_json()["status"] == "pending"

    # Verify duplicate submission is rejected while pending
    dup_submit_res = client.post("/api/verification/submit-application", headers=saranya_headers, json={
        "declaration": True
    })
    assert dup_submit_res.status_code == 400

    # 8. Evidence Security Check: Another seller cannot access Saranya's evidence
    other_seller_res = client.post("/api/auth/register", json={
        "email": f"intruder_{uuid.uuid4().hex[:8]}@test.local",
        "password": "Password123!",
        "full_name": "Intruder Seller",
        "role": "seller"
    })
    assert other_seller_res.status_code == 201
    intruder_token = other_seller_res.get_json()["token"]
    intruder_headers = {"Authorization": f"Bearer {intruder_token}"}

    sec_res = client.get(f"/api/verification/evidence/{doc_evidence_id}", headers=intruder_headers)
    assert sec_res.status_code == 403

    # Admin CAN access Saranya's evidence
    admin_ev_res = client.get(f"/api/verification/evidence/{doc_evidence_id}", headers=admin_headers)
    assert admin_ev_res.status_code == 200

    # 9. Admin Inspects Application Dossier
    admin_dossier_res = client.get(f"/api/verification/application?user_id={saranya_id}", headers=admin_headers)
    assert admin_dossier_res.status_code == 200
    dossier = admin_dossier_res.get_json()
    assert dossier["application"]["status"] == "pending"
    assert len(dossier["evidence"]) >= 2

    # 10. Admin Rejection with specific feedback
    # Missing reason must return 400
    fail_reject_res = client.post("/api/verification/review", headers=admin_headers, json={
        "user_id": saranya_id,
        "decision": "rejected",
        "reason": ""
    })
    assert fail_reject_res.status_code == 400

    # Rejection with specific actionable reason
    reject_res = client.post("/api/verification/review", headers=admin_headers, json={
        "user_id": saranya_id,
        "decision": "rejected",
        "reason": "Please provide higher resolution video of the pitloom pedal action."
    })
    assert reject_res.status_code == 200
    assert reject_res.get_json()["new_status"] == "rejected"

    # Seller sees rejection and feedback
    seller_check_res = client.get("/api/verification/application", headers=saranya_headers)
    assert seller_check_res.get_json()["application"]["status"] == "rejected"
    assert "pitloom pedal action" in seller_check_res.get_json()["application"]["rejection_reason"]

    # 11. Seller Resubmits after correction
    resubmit_res = client.post("/api/verification/submit-application", headers=saranya_headers, json={
        "declaration": True,
        "notes": "Added clearer close-up video of weaving."
    })
    assert resubmit_res.status_code == 200
    assert resubmit_res.get_json()["status"] == "pending"

    # 12. Admin Approves Application
    approve_res = client.post("/api/verification/review", headers=admin_headers, json={
        "user_id": saranya_id,
        "decision": "verified_producer",
        "reason": "Artisan craft authenticity and pitloom setup verified successfully."
    })
    assert approve_res.status_code == 200
    assert approve_res.get_json()["new_status"] == "verified_producer"

    # 13. Verified Seller can now publish products!
    live_product_res = client.post("/api/products/", headers=saranya_headers, json={
        "title": "Authentic Silk Handloom Saree",
        "description": "Pure mulberry silk saree with zari borders",
        "category": "Textiles & Handlooms",
        "unit_price": 4500,
        "inventory_count": 5,
        "is_published": True
    })
    assert live_product_res.status_code == 201, live_product_res.get_json()
    assert live_product_res.get_json()["product"]["is_published"] is True
