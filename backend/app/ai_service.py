"""
AI Service - Orchestrator chính cho toàn bộ hệ thống AI.
Thay thế rag_service.py.

Nhiệm vụ:
1. Nhận câu hỏi → Intent Router → Route đúng nhánh
2. Stream SSE events cho frontend (pipeline visualization)
3. Quản lý ingest PDF

SSE Events:
  intent_start → intent_done → retrieval_start → retrieval_done
  → llm_start → llm_done → complete
"""
import json
import time
import asyncio

from app.config import GEMINI_MODEL
from app.gemini_client import generate_text
from app.vector_store import VectorStore
from app.medical_rag import MedicalRAG
from app.patient_sql import PatientSQL
from app.intent_router import IntentRouter
from app.logger_service import log_llm_call, log_error


class AIService:
    """
    Entry point duy nhất cho mọi AI functionality.
    - chat_stream(): SSE streaming cho frontend
    - chat(): non-streaming (fallback)
    - ingest_pdf(): nạp sách PDF
    """

    def __init__(self):
        print("🧠 Đang khởi tạo AI Service...")
        self.vector_store = VectorStore()
        self.medical_rag = MedicalRAG(self.vector_store)
        self.patient_sql = PatientSQL()
        self.router = IntentRouter()

        # Auto-load PDFs nếu Vector DB trống nhưng có file PDF sẵn
        if not self.vector_store.is_ready:
            self._auto_load_pdfs()

        print("✅ AI Service sẵn sàng!")

    def _auto_load_pdfs(self):
        """Tự động nạp tất cả PDF có sẵn trong storage/pdfs khi khởi động lần đầu."""
        import os
        from app.config import PDF_DIR

        if not os.path.exists(PDF_DIR):
            print("❌ Không tìm thấy thư mục storage/pdfs")
            return

        pdf_files = [f for f in os.listdir(PDF_DIR) if f.lower().endswith('.pdf')]
        if not pdf_files:
            print("📁 Không có file PDF nào trong storage/pdfs")
            return

        print(f"🔍 Tìm thấy {len(pdf_files)} file PDF, đang tự động nạp...")
        total_chunks = 0
        for pdf_file in pdf_files:
            pdf_path = os.path.join(PDF_DIR, pdf_file)
            try:
                chunks = self.medical_rag.ingest_pdf(pdf_path, skip_images=True)
                total_chunks += chunks
                print(f"  ✅ {pdf_file}: {chunks} chunks")
            except Exception as e:
                print(f"  ❌ {pdf_file}: Lỗi - {str(e)}")

        print(f"🎉 Đã auto-load {total_chunks} chunks từ {len(pdf_files)} file PDF!")

    # ═══════════════════════════════════════════════════════════════
    # SSE STREAMING CHAT
    # ═══════════════════════════════════════════════════════════════

    async def chat_stream(self, question: str, chat_history: list = None):
        """
        Chat với SSE streaming — stream từng bước cho frontend.

        Yields:
            Chuỗi SSE events dạng "data: {json}\n\n"

        Events:
            intent_start, intent_done, retrieval_start, retrieval_done,
            sql_start, sql_done, llm_start, llm_done, complete
        """
        try:
            # ── BƯỚC 1: INTENT ROUTER ──────────────────────────────
            yield self._sse_event({"step": "intent_start"})
            await asyncio.sleep(0.05)  # Nhỏ delay cho frontend render

            intent = self.router.classify(question)

            yield self._sse_event({
                "step": "intent_done",
                "intent": intent
            })
            await asyncio.sleep(0.05)

            # ── BƯỚC 2: ROUTE THEO INTENT ──────────────────────────
            if intent == "MEDICAL":
                async for event in self._handle_medical_stream(question, chat_history):
                    yield event

            elif intent == "PATIENT":
                async for event in self._handle_patient_stream(question):
                    yield event

            else:  # GENERAL
                async for event in self._handle_general_stream(question):
                    yield event

        except Exception as e:
            log_error("ai_service", e, f"Question: {question}")
            yield self._sse_event({
                "step": "complete",
                "answer": "Xin lỗi, đã xảy ra lỗi. Vui lòng thử lại.",
                "sources": [],
                "intent": "ERROR"
            })

    # ── MEDICAL ROUTE ──────────────────────────────────────────────

    async def _handle_medical_stream(self, question: str, chat_history: list = None):
        """Xử lý câu hỏi y học với SSE events."""
        # Retrieval
        yield self._sse_event({"step": "retrieval_start"})
        await asyncio.sleep(0.05)

        # Chạy query (synchronous nhưng wrap)
        result = await asyncio.to_thread(
            self.medical_rag.query, question, chat_history
        )

        yield self._sse_event({
            "step": "retrieval_done",
            "chunks": result.get("chunks_found", 0)
        })
        await asyncio.sleep(0.05)

        # LLM (đã chạy trong medical_rag.query, chỉ signal)
        yield self._sse_event({"step": "llm_start"})
        await asyncio.sleep(0.05)

        yield self._sse_event({"step": "llm_done"})
        await asyncio.sleep(0.05)

        # Complete
        yield self._sse_event({
            "step": "complete",
            "answer": result.get("answer", ""),
            "sources": result.get("sources", []),
            "citations": result.get("citations", []),
            "intent": "MEDICAL"
        })

    # ── PATIENT ROUTE ──────────────────────────────────────────────

    async def _handle_patient_stream(self, question: str):
        """Xử lý câu hỏi bệnh nhân với SSE events."""
        # SQL Generation
        yield self._sse_event({"step": "sql_start"})
        await asyncio.sleep(0.05)

        result = await asyncio.to_thread(self.patient_sql.query, question)

        yield self._sse_event({
            "step": "sql_done",
            "row_count": result.get("row_count", 0)
        })
        await asyncio.sleep(0.05)

        # LLM formatting
        yield self._sse_event({"step": "llm_start"})
        await asyncio.sleep(0.05)

        yield self._sse_event({"step": "llm_done"})
        await asyncio.sleep(0.05)

        # Complete
        yield self._sse_event({
            "step": "complete",
            "answer": result.get("answer", ""),
            "sources": [],
            "intent": "PATIENT"
        })

    # ── GENERAL ROUTE ──────────────────────────────────────────────

    async def _handle_general_stream(self, question: str):
        """Xử lý câu hỏi chung (chào hỏi, etc.)."""
        yield self._sse_event({"step": "llm_start"})
        await asyncio.sleep(0.05)

        try:
            llm_start = time.time()
            prompt = f"Bạn là hệ thống hỗ trợ lâm sàng dành cho BÁC SĨ ĐÔNG Y. Người hỏi là bác sĩ. Trả lời ngắn gọn, chuyên nghiệp. Nếu họ chào hỏi, giới thiệu bạn có thể hỗ trợ: tra cứu bệnh lý Đông Y, gợi ý phác đồ điều trị, hoặc tra cứu hồ sơ bệnh nhân.\n\nBác sĩ: {question}"
            answer = await asyncio.to_thread(generate_text, prompt)
            llm_ms = (time.time() - llm_start) * 1000
            log_llm_call("general_chat", len(answer), GEMINI_MODEL, llm_ms)
        except Exception as e:
            log_error("ai_service", e, "General chat failed")
            answer = "Xin chào Bác sĩ! Tôi là hệ thống hỗ trợ lâm sàng Đông Y. Bác sĩ có thể hỏi về bệnh lý, phác đồ điều trị, hoặc tra cứu hồ sơ bệnh nhân."

        yield self._sse_event({"step": "llm_done"})
        await asyncio.sleep(0.05)

        yield self._sse_event({
            "step": "complete",
            "answer": answer,
            "sources": [],
            "intent": "GENERAL"
        })

    # ═══════════════════════════════════════════════════════════════
    # NON-STREAMING CHAT (FALLBACK)
    # ═══════════════════════════════════════════════════════════════

    def chat(self, question: str, chat_history: list = None) -> dict:
        """Non-streaming chat — trả kết quả 1 lần."""
        intent = self.router.classify(question)

        if intent == "MEDICAL":
            result = self.medical_rag.query(question, chat_history)
            result["intent"] = "MEDICAL"
            return result

        elif intent == "PATIENT":
            result = self.patient_sql.query(question)
            result["intent"] = "PATIENT"
            result["sources"] = []
            return result

        else:
            try:
                prompt = f"Bạn là hệ thống hỗ trợ lâm sàng dành cho BÁC SĨ ĐÔNG Y. Người hỏi là bác sĩ. Trả lời ngắn gọn, chuyên nghiệp.\n\nBác sĩ: {question}"
                answer = generate_text(prompt)
                return {
                    "answer": answer,
                    "sources": [],
                    "intent": "GENERAL"
                }
            except Exception:
                return {
                    "answer": "Xin chào! Tôi sẵn sàng hỗ trợ bạn.",
                    "sources": [],
                    "intent": "GENERAL"
                }

    # ═══════════════════════════════════════════════════════════════
    # INGEST PDF
    # ═══════════════════════════════════════════════════════════════

    def ingest_pdf(self, file_path: str) -> int:
        """Nạp PDF vào vector store (skip_images=True, bật lại sau)."""
        return self.medical_rag.ingest_pdf(file_path, skip_images=True)

    # ═══════════════════════════════════════════════════════════════
    # HELPER
    # ═══════════════════════════════════════════════════════════════

    @staticmethod
    def _sse_event(data: dict) -> str:
        """Format SSE event string."""
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
