"""
Medical RAG - Pipeline RAG cho chẩn đoán Đông Y.
- Ingest: xử lý PDF → semantic chunk → embed → lưu FAISS
- Query: embed câu hỏi → FAISS search → Gemini generate answer

Dùng gemini_client (hỗ trợ custom proxy).
"""
import time

from app.config import GEMINI_MODEL, RETRIEVAL_TOP_K, CHAT_HISTORY_MAX_TURNS
from app.gemini_client import generate_text
from app.vector_store import VectorStore
from app.pdf_processor import PDFProcessor
from app.logger_service import log_retrieval, log_llm_call, log_error


class MedicalRAG:
    """
    RAG pipeline cho tư vấn Y học Đông Y.
    - ingest_pdf(): nạp sách PDF vào vector store
    - query(): hỏi đáp dựa trên kiến thức đã nạp
    """

    def __init__(self, vector_store: VectorStore):
        self.vector_store = vector_store
        self.pdf_processor = PDFProcessor()

    # ═══════════════════════════════════════════════════════════════
    # INGEST PDF
    # ═══════════════════════════════════════════════════════════════

    def ingest_pdf(self, file_path: str, skip_images: bool = False) -> int:
        """
        Xử lý PDF và nạp vào vector store.

        Pipeline:
            PDF → PyMuPDF trích text(+ảnh) → Semantic Chunk → Embed → FAISS index → Lưu ổ cứng

        Args:
            file_path: Đường dẫn file PDF
            skip_images: Bỏ qua Gemini Vision mô tả ảnh (nhanh hơn cho auto-load)

        Returns:
            Số chunks đã nạp
        """
        # 1. PDF Processor: trích text (+ ảnh nếu không skip) → chunks
        chunks = self.pdf_processor.process_pdf(file_path, skip_images=skip_images)
        if not chunks:
            return 0

        # 2. Add vào vector store
        num_added = self.vector_store.add_documents(chunks)

        # 3. Lưu xuống ổ cứng
        self.vector_store.save_to_disk()

        return num_added

    # ═══════════════════════════════════════════════════════════════
    # QUERY (HỎI ĐÁP)
    # ═══════════════════════════════════════════════════════════════

    def query(self, question: str, chat_history: list = None) -> dict:
        """
        Hỏi đáp Y học Đông Y dựa trên sách đã nạp.

        Pipeline:
            1. Embed câu hỏi → FAISS search → top-k chunks
            2. Build prompt (system + context + history + question)
            3. Gọi Gemini → trả câu trả lời

        Args:
            question: Câu hỏi của user
            chat_history: Lịch sử chat gần nhất (conversation memory)

        Returns:
            dict: {"answer": str, "sources": list[str], "chunks_found": int, "scores": list[float]}
        """
        if not self.vector_store.is_ready:
            return {
                "answer": "Xin lỗi, tôi chưa được học tài liệu nào. Vui lòng upload PDF trước.",
                "sources": [],
                "chunks_found": 0,
                "scores": []
            }

        # ── BƯỚC 1: RETRIEVAL ──────────────────────────────────────
        retrieval_start = time.time()
        results = self.vector_store.search(question, top_k=RETRIEVAL_TOP_K)
        retrieval_ms = (time.time() - retrieval_start) * 1000

        scores = [r["score"] for r in results]
        log_retrieval(question, len(results), scores, retrieval_ms)

        # Build context + citations từ retrieved chunks
        context_parts = []
        citations = []
        for i, r in enumerate(results, 1):
            chunk_type = "📷 Ảnh" if r["type"] == "image" else "📄 Text"
            context_parts.append(
                f"[Nguồn {i} - {chunk_type} - {r['source']} trang {r['page']}]:\n{r['content']}"
            )
            # Build citation object cho frontend
            snippet = r['content'][:200] + ('...' if len(r['content']) > 200 else '')
            citations.append({
                "id": i,
                "source": r['source'],
                "page": r['page'],
                "type": r['type'],
                "snippet": snippet,
                "score": round(r['score'], 4)
            })
        context = "\n\n".join(context_parts)

        # ── BƯỚC 2: BUILD PROMPT ───────────────────────────────────
        prompt = self._build_prompt(question, context, chat_history)

        # ── BƯỚC 3: GỌI GEMINI ────────────────────────────────────
        llm_start = time.time()
        try:
            answer = generate_text(prompt)
        except Exception as e:
            log_error("medical_rag", e, f"Question: {question}")
            answer = "Xin lỗi, đã xảy ra lỗi khi xử lý câu hỏi. Vui lòng thử lại."

        llm_ms = (time.time() - llm_start) * 1000
        log_llm_call(prompt[:200], len(answer), GEMINI_MODEL, llm_ms)

        # ── BƯỚC 4: EXTRACT SOURCES ───────────────────────────────
        sources = list(set(r["source"] for r in results))

        return {
            "answer": answer,
            "sources": sources,
            "citations": citations,
            "chunks_found": len(results),
            "scores": scores
        }

    def _build_prompt(self, question: str, context: str,
                       chat_history: list = None) -> str:
        """
        Build prompt cho Gemini với system role + context + history.
        """
        # System instruction — CHỈ TRẢ LỜI TỪ TÀI LIỆU, KHÔNG BỊA
        prompt = """BẠN LÀ HỆ THỐNG TRA CỨU TÀI LIỆU Y HỌC ĐÔNG Y cho bác sĩ.

QUY TẮC TUYỆT ĐỐI:
1. CHỈ trả lời dựa trên tài liệu bên dưới. KHÔNG ĐƯỢC bịa hay thêm kiến thức ngoài tài liệu.
2. Nếu tài liệu không có → nói thẳng: "Trong tài liệu hiện có không có thông tin về vấn đề này."
3. LUÔN ghi trích dẫn [1], [2], [3] sau mỗi thông tin lấy từ tài liệu.
4. Người hỏi là BÁC SĨ. Không nói "hãy đến phòng khám" hay "nên gặp bác sĩ".
5. Trả lời TRỰC TIẾP, NGẮN GỌN, ĐÚNG TRỌNG TÂM. Không hỏi ngược lại nhiều.

<Tài liệu tham khảo>
{context}
</Tài liệu tham khảo>

""".format(context=context)

        # Conversation history (nếu có)
        if chat_history:
            recent = chat_history[-CHAT_HISTORY_MAX_TURNS:]
            prompt += "Lịch sử hội thoại:\n"
            for msg in recent:
                role = "Bác sĩ" if msg.get("role") == "user" else "Hệ thống"
                prompt += f"{role}: {msg.get('content', '')}\n"
            prompt += "\n"

        # Question + format instruction
        prompt += f"""Bác sĩ hỏi: "{question}"

CÁCH TRẢ LỜI:
- Nếu bác sĩ hỏi về TRIỆU CHỨNG → Liệt kê các bệnh có thể xảy ra (từ tài liệu), kèm triệu chứng đi kèm của từng bệnh [trích dẫn].
- Nếu bác sĩ xác nhận bệnh hoặc hỏi cách chữa → Đưa phác đồ điều trị: pháp trị, bài thuốc (vị thuốc + liều lượng), huyệt vị châm cứu [trích dẫn].
- Nếu hỏi về bài thuốc cụ thể → Liệt kê thành phần, liều lượng, cách dùng [trích dẫn].
- Nếu hỏi chung → Trả lời ngắn gọn từ tài liệu [trích dẫn].

TRÍCH DẪN BẮT BUỘC: Mỗi thông tin PHẢI có [số nguồn] đi kèm. VD: "Đau đầu do phong hàn, triệu chứng: sợ lạnh, gáy cổ cứng [1]"

NHỚ: Tuyệt đối KHÔNG bịa. Chỉ dùng thông tin có trong tài liệu trên."""

        return prompt
