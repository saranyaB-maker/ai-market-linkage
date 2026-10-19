"""
Unit and integration tests for Tamil-English Voice Assistant:
- Bilingual question flow (ta, en)
- Spoken answer interpretation and craft mapping
- Guardrails: Water jug ("தண்ணீர் குடம்") is NEVER classified as textiles
- Tamil numerals and mixed-script price/stock parsing
- Fair indicative price recommendation
- Creation of product listings from voice workflow data
"""
import pytest
from app import create_app
from services.voice_service import (
    extract_numeric_value,
    process_voice_field_answer,
    get_fair_price_suggestion
)

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_extract_numeric_value_tamil_and_english():
    # Digits in text
    assert extract_numeric_value("500 ரூபாய்") == 500.0
    assert extract_numeric_value("Rs 350 only") == 350.0
    assert extract_numeric_value("25 items in stock") == 25.0
    
    # Tamil numeral words
    assert extract_numeric_value("ஐநூறு") == 500.0
    assert extract_numeric_value("ஆயிரம் ரூபாய்") == 1000.0
    assert extract_numeric_value("நூறு") == 100.0
    assert extract_numeric_value("இருநூறு") == 200.0
    assert extract_numeric_value("ஐம்பது") == 50.0

def test_water_jug_never_classified_as_textile():
    # Water jug in Tamil
    result = process_voice_field_answer("title", "தண்ணீர் குடம்", "ta")
    category = result.get("associated_category", "")
    eng_val = result.get("english_value", "")
    assert "textile" not in category.lower()
    assert "jug" in category.lower() or "pottery" in category.lower() or "household" in category.lower()
    assert "jug" in eng_val.lower() or "pot" in eng_val.lower()
    
    # Terracotta clay pot
    result_pot = process_voice_field_answer("title", "மண் பானை", "ta")
    cat_pot = result_pot.get("associated_category", "")
    assert "textile" not in cat_pot.lower()
    assert "pottery" in cat_pot.lower() or "household" in cat_pot.lower()

def test_jute_bag_mapping():
    result = process_voice_field_answer("title", "சணல் பை", "ta")
    eng_val = result.get("english_value", "")
    category = result.get("associated_category", "")
    assert "bag" in eng_val.lower() or "jute" in eng_val.lower()
    assert "bag" in category.lower() or "fiber" in category.lower()

def test_get_voice_questions_api(client):
    # Tamil questions
    res_ta = client.get('/api/voice/questions?language=ta')
    assert res_ta.status_code == 200
    data_ta = res_ta.get_json()
    assert data_ta['success'] is True
    assert len(data_ta['questions']) >= 6
    assert any("பொருளின் பெயர்" in q.get('question_ta', '') for q in data_ta['questions'])
    
    # English questions
    res_en = client.get('/api/voice/questions?language=en')
    assert res_en.status_code == 200
    data_en = res_en.get_json()
    assert data_en['success'] is True
    assert any("name of your" in q.get('question_en', '').lower() for q in data_en['questions'])

def test_process_voice_answer_api(client):
    # Process title "தண்ணீர் குடம்"
    res = client.post('/api/voice/process-answer', json={
        "field": "title",
        "spoken_text": "தண்ணீர் குடம்",
        "language": "ta"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data['success'] is True
    assert "Jug" in data['english_value']
    assert "Household Goods, Water Jugs & Pitchers" == data['associated_category']
    assert "Terracotta" in data['associated_materials']

    # Process price "ஐநூறு ரூபாய்"
    res_price = client.post('/api/voice/process-answer', json={
        "field": "price",
        "spoken_text": "ஐநூறு ரூபாய்",
        "language": "ta"
    })
    assert res_price.status_code == 200
    data_price = res_price.get_json()
    assert data_price['success'] is True
    assert data_price['parsed_number'] == 500.0

    # Process stock quantity
    res_stock = client.post('/api/voice/process-answer', json={
        "field": "stock",
        "spoken_text": "20 தயார் பொருட்கள்",
        "language": "ta"
    })
    assert res_stock.status_code == 200
    data_stock = res_stock.get_json()
    assert data_stock['success'] is True
    assert data_stock['parsed_number'] == 20.0

def test_suggest_fair_price_api(client):
    res = client.post('/api/voice/suggest-price', json={
        "category": "Household Goods, Water Jugs & Pitchers",
        "materials": "Natural Terracotta Clay",
        "title": "Handcrafted Terracotta Water Jug"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data['success'] is True
    assert data['suggested_price'] > 0
    assert data['price_range_min'] <= data['suggested_price'] <= data['price_range_max']
    assert data['is_estimate'] is True
