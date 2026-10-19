import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    ENVIRONMENT = os.getenv("FLASK_ENV", "development")
    SECRET_KEY = os.getenv("SECRET_KEY", "market-linkage-secure-dev-secret-key-2026")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "market-linkage-jwt-dev-secret-2026")
    JWT_EXPIRATION = timedelta(hours=int(os.getenv("JWT_EXPIRATION_HOURS", "24")))
    
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/ai_market_linkage")
    DB_NAME = os.getenv("DB_NAME", "ai_market_linkage")
    
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    PRODUCT_UPLOAD_FOLDER = os.path.join(UPLOAD_FOLDER, "products")
    EVIDENCE_UPLOAD_FOLDER = os.path.join(UPLOAD_FOLDER, "evidence")
    
    # 10MB max upload size
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "pdf"}
    
    # AI configuration
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    
    # Perceptual hash threshold: hamming distance <= 10 is considered highly similar / suspected duplicate
    DUPLICATE_HAMMING_THRESHOLD = int(os.getenv("DUPLICATE_HAMMING_THRESHOLD", "10"))
    
    # Demo seed allowed only in non-production
    ALLOW_DEMO_SEED = ENVIRONMENT != "production" and os.getenv("ALLOW_DEMO_SEED", "true").lower() == "true"

class TestingConfig(Config):
    ENVIRONMENT = "testing"
    TESTING = True
    DB_NAME = "ai_market_linkage_test"
    ALLOW_DEMO_SEED = True
