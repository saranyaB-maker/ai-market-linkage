import pytest
from services.translation_service import (
    translate_tamil_to_english,
    translate_english_to_tamil,
    translate_product_data
)

def test_colloquial_tamil_voice_understanding():
    """
    Test colloquial Tamil / Tanglish:
    'Stronger இருக்கும், நிறைய லிட்டர் தண்ணி பிடிக்கும்.' ->
    Translates to natural English with durability/strength and water holding capacity.
    """
    tamil_input = "Stronger இருக்கும், நிறைய லிட்டர் தண்ணி பிடிக்கும்."
    result = translate_tamil_to_english(tamil_input)
    assert result is not None
    result_lower = result.lower()
    
    # Must capture durability/strength and water-holding capacity
    assert "durable" in result_lower or "strong" in result_lower
    assert "water" in result_lower
    assert "capacity" in result_lower or "hold" in result_lower or "liters" in result_lower or "litres" in result_lower

def test_translation_service_craft_mappings():
    # Test craft term translations
    ta_jug = translate_english_to_tamil("Terracotta Water Jug")
    assert any(term in ta_jug for term in ["மண்", "தண்ணீர்", "குடம்", "பானை", "Terracotta"])

    # Test category translation
    cat_ta = translate_english_to_tamil("Household Goods, Water Jugs & Pitchers")
    assert cat_ta != ""

def test_api_translate_endpoints(client):
    # Test POST /api/translate
    res = client.post('/api/translate', json={
        "text": "Handcrafted Clay Water Pot",
        "source_lang": "en",
        "target_lang": "ta"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data['success'] is True
    assert len(data['translated_text']) > 0

    # Test POST /api/voice/translate
    res_voice = client.post('/api/voice/translate', json={
        "text": "மண் குடம்",
        "target_lang": "en"
    })
    assert res_voice.status_code == 200
    data_voice = res_voice.get_json()
    assert data_voice['success'] is True
    assert "pot" in data_voice['translated_text'].lower() or "jug" in data_voice['translated_text'].lower() or "clay" in data_voice['translated_text'].lower()

def test_voice_assistant_features_and_curriculum(client):
    # Process features field with colloquial Tamil
    res = client.post('/api/voice/process-answer', json={
        "field": "features",
        "spoken_text": "Stronger இருக்கும், நிறைய லிட்டர் தண்ணி பிடிக்கும்.",
        "language": "ta"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data['success'] is True
    eng_val = data['english_value'].lower()
    assert "durable" in eng_val or "strong" in eng_val
    assert "water" in eng_val

def test_dynamic_product_translation_preserves_canonical_english(client, seller_headers, db):
    """
    Verify that GET /api/products/<id>?lang=ta returns dynamically translated
    Tamil fields, while the MongoDB document strictly preserves canonical English.
    """
    # 1. Create a canonical English product in the test DB
    product_payload = {
        "title": "Artisan Terracotta Water Jug",
        "description": "Handcrafted natural clay water jug that cools water naturally and stays durable.",
        "category": "Household Goods, Water Jugs & Pitchers",
        "materials": "Natural Clay, Terracotta",
        "price_per_unit": 450.0,
        "stock_quantity": 30,
        "moq": 2,
        "lead_time_days": 5,
        "is_published": True
    }
    create_res = client.post("/api/products", headers=seller_headers, json=product_payload)
    assert create_res.status_code == 201
    prod_id = create_res.get_json()["product_id"]

    try:
        # 2. Query in English: GET /api/products/<id>?lang=en
        res_en = client.get(f'/api/products/{prod_id}?lang=en')
        assert res_en.status_code == 200
        data_en = res_en.get_json()['product']
        assert data_en['title'] == "Artisan Terracotta Water Jug"
        assert "Handcrafted natural clay" in data_en['description']

        # 3. Query in Tamil: GET /api/products/<id>?lang=ta
        res_ta = client.get(f'/api/products/{prod_id}?lang=ta')
        assert res_ta.status_code == 200
        data_ta = res_ta.get_json()['product']
        # The title and description should be translated to Tamil
        assert data_ta['title'] != data_en['title']
        assert any(c in data_ta['title'] for c in ["மண்", "தண்ணீர்", "குடம்", "பானை", "Terracotta"])
        assert "canonical_title" in data_ta or "title_en" in data_ta
        assert (data_ta.get("canonical_title") or data_ta.get("title_en")) == "Artisan Terracotta Water Jug"

        # 4. Verify canonical database record was NOT mutated
        from bson import ObjectId
        persisted = db.products.find_one({"_id": ObjectId(prod_id)})
        assert persisted["title"] == "Artisan Terracotta Water Jug"
        assert "Handcrafted natural clay" in persisted["description"]

    finally:
        # Cleanup
        client.delete(f"/api/products/{prod_id}", headers=seller_headers)

def test_product_creation_translates_tamil_to_canonical_english():
    """
    Test translate_product_data function that translates Tamil fields
    to canonical English before saving to database.
    """
    tamil_payload = {
        "title": "பாரம்பரிய மண் குடம்",
        "description": "இயற்கையான களிமண்ணால் செய்யப்பட்டது. தண்ணீர் குளிர்ச்சியாக இருக்கும்.",
        "category": "Household Goods, Water Jugs & Pitchers",
        "materials": "இயற்கை களிமண்"
    }

    canonical = translate_product_data(tamil_payload)
    assert canonical['title'] != "பாரம்பரிய மண் குடம்"
    assert "pot" in canonical['title'].lower() or "jug" in canonical['title'].lower() or "clay" in canonical['title'].lower()
    assert canonical['title_ta'] == "பாரம்பரிய மண் குடம்"
    assert canonical['description_ta'] == "இயற்கையான களிமண்ணால் செய்யப்பட்டது. தண்ணீர் குளிர்ச்சியாக இருக்கும்."
    assert "clay" in canonical['description'].lower() or "water" in canonical['description'].lower()
