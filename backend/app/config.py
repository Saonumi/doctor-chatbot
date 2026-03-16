"""
Config tập trung - Quản lý mọi biến môi trường và hằng số hệ thống.
Tất cả cấu hình nằm ở đây, không rải rác trong các file khác.
"""
import os
from dotenv import load_dotenv

# ── Load .env ──────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))

# ── Google Gemini API ──────────────────────────────────────────────
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL")  # Custom proxy URL (nếu có)
GEMINI_MODEL = "gemini-2.5-flash"       # Model chính cho LLM calls
GEMINI_TEMPERATURE = 0.3                # Thấp → trả lời chính xác, ít sáng tạo

# ── Database ───────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")

# ── Embedding Model ────────────────────────────────────────────────
# Model đa ngôn ngữ, hỗ trợ tiếng Việt tốt
# 384 dimensions, chạy local trên CPU, miễn phí
EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
EMBEDDING_DIMENSIONS = 384

# ── Semantic Chunking ──────────────────────────────────────────────
# Ngưỡng cosine similarity để quyết định cắt chunk mới
# Khi similarity giữa 2 câu liền kề < threshold → cắt
CHUNK_SIMILARITY_THRESHOLD = 0.5
CHUNK_MAX_CHARS = 1500              # Giới hạn max chars/chunk
CHUNK_MIN_CHARS = 100               # Chunk quá ngắn sẽ merge với chunk kế

# ── Retrieval ──────────────────────────────────────────────────────
RETRIEVAL_TOP_K = 5                 # Số chunks trả về khi search FAISS

# ── Paths ──────────────────────────────────────────────────────────
VECTOR_DB_PATH = os.path.join(BASE_DIR, "storage", "vector_db")
PDF_DIR = os.path.join(BASE_DIR, "storage", "pdfs")
LOG_DIR = os.path.join(BASE_DIR, "storage", "logs")
FAISS_INDEX_NAME = "tcm_index"

# ── Text-to-SQL Safety ────────────────────────────────────────────
SQL_MAX_ROWS = 20                   # Giới hạn kết quả trả về
SQL_TIMEOUT_SECONDS = 5             # Timeout cho SQL query

# ── Conversation Memory ───────────────────────────────────────────
CHAT_HISTORY_MAX_TURNS = 5          # Số turn gần nhất gửi cho LLM

# ── Vision PDF ─────────────────────────────────────────────────────
MIN_IMAGE_SIZE = 100                # Bỏ qua ảnh < 100x100 px (icon, bullet...)

# ── Tạo thư mục cần thiết ─────────────────────────────────────────
for _dir in [VECTOR_DB_PATH, PDF_DIR, LOG_DIR]:
    os.makedirs(_dir, exist_ok=True)
