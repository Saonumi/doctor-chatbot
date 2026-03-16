"""
Logger Service - Structured logging cho toàn bộ AI pipeline.
Ghi log input/output/thời gian xử lý của mỗi component.
Output: console + file (storage/logs/ai_YYYY-MM-DD.log)
"""
import os
import json
import logging
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler

from app.config import LOG_DIR


def setup_logger():
    """
    Khởi tạo logger với 2 handler:
    1. Console handler: hiển thị log trên terminal
    2. File handler: ghi log vào file, rotate theo ngày
    """
    logger = logging.getLogger("ai_pipeline")

    # Tránh tạo handler trùng nếu gọi lại
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)

    # ── FORMAT ─────────────────────────────────────────────────────
    # Console: đơn giản, dễ đọc
    console_fmt = logging.Formatter(
        "%(asctime)s │ %(levelname)-7s │ %(message)s",
        datefmt="%H:%M:%S"
    )

    # File: JSON structured, dễ parse
    class JSONFormatter(logging.Formatter):
        def format(self, record):
            log_data = {
                "timestamp": datetime.now().isoformat(),
                "level": record.levelname,
                "component": getattr(record, "component", "system"),
                "message": record.getMessage(),
            }
            # Thêm extra fields nếu có
            for key in ["input", "output", "duration_ms", "intent",
                         "chunks_found", "scores", "generated_sql",
                         "validated", "row_count", "filename",
                         "pages", "text_chunks", "images_found",
                         "images_described", "error", "context_info",
                         "prompt_length", "response_length", "model"]:
                val = getattr(record, key, None)
                if val is not None:
                    log_data[key] = val
            return json.dumps(log_data, ensure_ascii=False)

    # ── CONSOLE HANDLER ────────────────────────────────────────────
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(console_fmt)

    # ── FILE HANDLER (rotate theo ngày) ────────────────────────────
    log_file = os.path.join(LOG_DIR, "ai_pipeline.log")
    file_handler = TimedRotatingFileHandler(
        log_file,
        when="midnight",
        interval=1,
        backupCount=30,             # Giữ log 30 ngày
        encoding="utf-8"
    )
    file_handler.suffix = "%Y-%m-%d"
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(JSONFormatter())

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger


# ── Singleton logger instance ──────────────────────────────────────
_logger = setup_logger()


# ═══════════════════════════════════════════════════════════════════
# CÁC HÀM LOG CHO TỪNG COMPONENT
# ═══════════════════════════════════════════════════════════════════

def log_intent(question: str, intent: str, duration_ms: float):
    """Log kết quả phân loại intent."""
    _logger.info(
        f"🔀 Router: '{question[:80]}...' → {intent} ({duration_ms:.0f}ms)",
        extra={
            "component": "intent_router",
            "input": question,
            "output": intent,
            "intent": intent,
            "duration_ms": round(duration_ms),
        }
    )


def log_retrieval(query: str, chunks_found: int, scores: list, duration_ms: float):
    """Log kết quả tìm kiếm FAISS."""
    _logger.info(
        f"🔍 Retrieval: tìm {chunks_found} chunks ({duration_ms:.0f}ms)",
        extra={
            "component": "medical_rag",
            "input": query,
            "chunks_found": chunks_found,
            "scores": [round(s, 4) for s in scores[:5]],
            "duration_ms": round(duration_ms),
        }
    )


def log_llm_call(prompt_summary: str, response_length: int,
                  model: str, duration_ms: float):
    """Log một lần gọi LLM (Gemini)."""
    _logger.info(
        f"🤖 LLM ({model}): prompt={len(prompt_summary)}chars → response={response_length}chars ({duration_ms:.0f}ms)",
        extra={
            "component": "llm",
            "prompt_length": len(prompt_summary),
            "response_length": response_length,
            "model": model,
            "duration_ms": round(duration_ms),
        }
    )


def log_sql(question: str, generated_sql: str, validated: bool,
            row_count: int, duration_ms: float):
    """Log Text-to-SQL pipeline."""
    status = "✅" if validated else "❌ BLOCKED"
    _logger.info(
        f"📊 SQL {status}: {row_count} rows ({duration_ms:.0f}ms)",
        extra={
            "component": "patient_sql",
            "input": question,
            "generated_sql": generated_sql,
            "validated": validated,
            "row_count": row_count,
            "duration_ms": round(duration_ms),
        }
    )


def log_pdf_processing(filename: str, pages: int, text_chunks: int,
                        images_found: int, images_described: int,
                        duration_ms: float):
    """Log xử lý PDF (text + vision)."""
    _logger.info(
        f"📖 PDF: {filename} → {pages} pages, {text_chunks} text chunks, "
        f"{images_described}/{images_found} images ({duration_ms:.0f}ms)",
        extra={
            "component": "pdf_processor",
            "pdf_filename": filename,
            "pages": pages,
            "text_chunks": text_chunks,
            "images_found": images_found,
            "images_described": images_described,
            "duration_ms": round(duration_ms),
        }
    )


def log_error(component: str, error: Exception, context_info: str = ""):
    """Log lỗi của bất kỳ component nào."""
    _logger.error(
        f"❌ [{component}] {str(error)} | Context: {context_info}",
        extra={
            "component": component,
            "error": str(error),
            "context_info": context_info,
        },
        exc_info=True
    )
