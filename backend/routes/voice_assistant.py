import os
from flask import Blueprint, request, jsonify, g
from routes.auth_helpers import jwt_required, roles_required

SELLER_ROLES = ("seller", "artisan", "producer", "artisan_seller", "admin")
from services.voice_service import process_voice_field_answer, get_fair_price_suggestion

voice_assistant_bp = Blueprint("voice_assistant_bp", __name__, url_prefix="/api/voice")

VOICE_QUESTIONS = [
    {
        "id": "title",
        "order": 1,
        "required": True,
        "question_en": "What is the name of your product?",
        "question_ta": "உங்கள் பொருளின் பெயர் என்ன?",
        "hint_en": "For example: Handcrafted Terracotta Water Jug, Pure Silk Saree, Jute Bag",
        "hint_ta": "உதாரணமாக: தண்ணீர் குடம், பட்டு சேலை, சணல் பை, மர பொம்மை",
        "tts_text_en": "What is the name of your handcrafted product?",
        "tts_text_ta": "வணக்கம்! உங்கள் கைவினைப் பொருளின் பெயர் என்ன?"
    },
    {
        "id": "category",
        "order": 2,
        "required": True,
        "question_en": "What craft category does this belong to?",
        "question_ta": "இது எந்த வகையைச் சேர்ந்த பொருள்?",
        "hint_en": "E.g. Household Goods & Water Jugs, Pottery & Terracotta, Handloom & Textiles, Bags",
        "hint_ta": "உதா: தண்ணீர் குடம், மண்பாண்டம், கைத்தறி, சணல் பை, மர வேலைப்பாடு",
        "tts_text_en": "What craft category does this product belong to?",
        "tts_text_ta": "இது எந்த கைவினைப் பிரிவைச் சேர்ந்த பொருள்?"
    },
    {
        "id": "materials",
        "order": 3,
        "required": True,
        "question_en": "What primary materials are used to make this?",
        "question_ta": "இது என்ன பொருட்களால் செய்யப்பட்டது?",
        "hint_en": "E.g. Terracotta clay, Pure mulberry silk, Golden jute fiber, Teak wood, Solid brass",
        "hint_ta": "உதா: களிமண், சுடுமண், பட்டு, பருத்தி, சணல், தேக்கு மரம், பித்தளை",
        "tts_text_en": "What primary raw materials were used to create this item?",
        "tts_text_ta": "இது என்ன மூலப்பொருட்களால் செய்யப்பட்டது?"
    },
    {
        "id": "price_per_unit",
        "order": 4,
        "required": True,
        "question_en": "What is your selling price per piece in Rupees?",
        "question_ta": "ஒரு பொருளின் விலை எவ்வளவு?",
        "hint_en": "E.g. 350 rupees, 500, 1200 rupees",
        "hint_ta": "உதா: 350 ரூபாய், 500, அல்லது 1200",
        "tts_text_en": "How much is your selling price per piece in Rupees?",
        "tts_text_ta": "ஒரு பொருளின் விற்பனை விலை எத்தனை ரூபாய்?"
    },
    {
        "id": "stock_quantity",
        "order": 5,
        "required": True,
        "question_en": "How many ready pieces do you have in stock?",
        "question_ta": "எத்தனை பொருட்கள் விற்பனைக்கு தயார் நிலையில் உள்ளன?",
        "hint_en": "E.g. 10 items, 25 pieces, 50 units",
        "hint_ta": "உதா: 10 பொருட்கள், 25 எண்ணம், 50",
        "tts_text_en": "How many ready items do you currently have available in stock?",
        "tts_text_ta": "எத்தனை பொருட்கள் இப்போது விற்பனைக்கு கையிருப்பில் உள்ளன?"
    },
    {
        "id": "description",
        "order": 6,
        "required": False,
        "question_en": "Would you like to describe anything more about your craft?",
        "question_ta": "உங்கள் பொருளைப் பற்றி மேலும் ஏதாவது சொல்ல விரும்புகிறீர்களா?",
        "hint_en": "E.g. Natural cooling benefits, traditional weaving style, eco-friendly materials",
        "hint_ta": "உதா: இயற்கையான குளிர்ச்சி தரும் குடம், பாரம்பரிய கைத்தறி வேலைப்பாடு",
        "tts_text_en": "Would you like to share anything special about the craft technique, design, or artisan tradition?",
        "tts_text_ta": "உங்கள் கைவினைப் பொருளின் சிறப்பு அல்லது சிறப்பம்சங்களைப் பற்றி கூற விரும்புகிறீர்களா?"
    },
    {
        "id": "moq",
        "order": 7,
        "required": False,
        "question_en": "What is the minimum wholesale order quantity?",
        "question_ta": "குறைந்தபட்ச மொத்த ஆர்டர் அளவு எத்தனை?",
        "hint_en": "E.g. 1 piece, 5 pieces, 10 units",
        "hint_ta": "உதா: 1 பொருள், 5 அல்லது 10",
        "tts_text_en": "What is the minimum order quantity for wholesale orders?",
        "tts_text_ta": "மொத்த விற்பனைக்கான குறைந்தபட்ச ஆர்டர் அளவு எத்தனை?"
    },
    {
        "id": "lead_time_days",
        "order": 8,
        "required": False,
        "question_en": "How many days do you need to produce a bulk batch?",
        "question_ta": "மொத்தமாக செய்ய எத்தனை நாட்கள் கால அவகாசம் தேவை?",
        "hint_en": "E.g. 7 days, 14 days",
        "hint_ta": "உதா: 7 நாட்கள் அல்லது 14 நாட்கள்",
        "tts_text_en": "How many days of production lead time are required?",
        "tts_text_ta": "தயாரித்து அனுப்ப எத்தனை நாட்கள் அவகாசம் தேவை?"
    }
]

@voice_assistant_bp.route("/questions", methods=["GET"])
def get_questions():
    """
    Returns the guided question-and-answer curriculum for the voice assistant.
    """
    language = request.args.get("language", "ta").lower()
    return jsonify({
        "success": True,
        "language": language,
        "questions": VOICE_QUESTIONS,
        "total_questions": len(VOICE_QUESTIONS)
    }), 200

@voice_assistant_bp.route("/process-answer", methods=["POST"])
def process_answer():
    """
    Processes an artisan's spoken response.
    Translates Tamil to English, extracts numbers, and maps categories accurately.
    """
    data = request.get_json() or {}
    field = data.get("field", "")
    spoken_text = data.get("spoken_text", "")
    language = data.get("language", "ta")
    current_product = data.get("current_product", {})

    if not field:
        return jsonify({"success": False, "error": "Field identifier is required"}), 400

    result = process_voice_field_answer(field, spoken_text, language=language, current_product=current_product)
    
    # If the artisan confirmed a title, also generate an indicative price suggestion
    if field == "title" and result.get("is_valid"):
        price_info = get_fair_price_suggestion(
            result.get("associated_category", ""),
            result.get("associated_materials", ""),
            result.get("english_value", "")
        )
        result["price_suggestion"] = price_info

    result["success"] = True
    return jsonify(result), 200

@voice_assistant_bp.route("/suggest-price", methods=["POST"])
def suggest_price():
    """
    Returns an indicative fair wholesale price recommendation based on product attributes.
    """
    data = request.get_json() or {}
    category = data.get("category", "")
    materials = data.get("materials", "")
    title = data.get("title", "")
    
    suggestion = get_fair_price_suggestion(category, materials, title)
    suggestion["success"] = True
    return jsonify(suggestion), 200

@voice_assistant_bp.route("/translate", methods=["POST"])
def translate_text():
    """
    Translates dynamic text between Tamil and English on the fly.
    """
    from services.translation_service import translate_tamil_to_english, translate_english_to_tamil
    data = request.get_json() or {}
    text = data.get("text", "")
    source_lang = data.get("source_lang", "ta").lower()
    target_lang = data.get("target_lang", "en").lower()

    if not text:
        return jsonify({"success": True, "translated_text": "", "original_text": ""}), 200

    if target_lang == "ta":
        translated = translate_english_to_tamil(text)
    else:
        translated = translate_tamil_to_english(text)

    return jsonify({
        "success": True,
        "original_text": text,
        "translated_text": translated,
        "source_lang": source_lang,
        "target_lang": target_lang
    }), 200
