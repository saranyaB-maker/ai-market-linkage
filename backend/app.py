import os
import logging
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from config import Config
from db import init_db, is_mock_db

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("market_linkage")

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Configure CORS for frontend access
    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "*"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"]
        }
    })
    
    # Ensure upload directories exist
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["PRODUCT_UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["EVIDENCE_UPLOAD_FOLDER"], exist_ok=True)
    
    # Initialize MongoDB connection and indexes
    with app.app_context():
        init_db(app)

    # Register blueprints
    from routes.auth import auth_bp
    from routes.products import products_bp
    from routes.verification import verification_bp
    from routes.matching import matching_bp
    from routes.quotations import quotations_bp
    from routes.orders import orders_bp
    from routes.messaging import messaging_bp
    from routes.notifications import notifications_bp
    from routes.admin import admin_bp
    from routes.reviews import reviews_bp
    from routes.disputes import disputes_bp
    from routes.analytics import analytics_bp
    from routes.voice_assistant import voice_assistant_bp
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(verification_bp)
    app.register_blueprint(matching_bp)
    app.register_blueprint(quotations_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(messaging_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(reviews_bp)
    app.register_blueprint(disputes_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(voice_assistant_bp)

    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "service": "AI Market Linkage API",
            "version": "1.0.0",
            "environment": app.config["ENVIRONMENT"],
            "database_mock_fallback": is_mock_db(),
            "ai_configured": bool(app.config.get("GEMINI_API_KEY"))
        }), 200

    @app.route("/api/translate", methods=["POST"])
    def global_translate():
        from flask import request
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

    # Centralized error handlers
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Bad Request", "message": str(e)}), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({"error": "Unauthorized", "message": "Authentication required"}), 401

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({"error": "Forbidden", "message": "You do not have permission"}), 403

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not Found", "message": "Resource does not exist"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method Not Allowed"}), 405

    @app.errorhandler(500)
    def server_error(e):
        logger.error(f"Internal server error: {e}")
        return jsonify({"error": "Internal Server Error", "message": "An unexpected error occurred"}), 500

    return app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    logger.info(f"Starting AI Market Linkage Flask server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)
