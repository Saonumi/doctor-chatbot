"""
Vector Store - FAISS wrapper thuần, không qua LangChain.
Quản lý: lưu/load index, thêm documents, tìm kiếm similarity.
Metadata (nội dung text, nguồn file...) lưu riêng bằng pickle vì FAISS chỉ lưu vector.
"""
import os
import pickle
import numpy as np
import faiss

from app.config import VECTOR_DB_PATH, FAISS_INDEX_NAME, RETRIEVAL_TOP_K
from app.embedding_service import EmbeddingService


class VectorStore:
    """
    FAISS Vector Store cho Medical RAG.
    - Lưu/load index + metadata từ ổ cứng
    - Thêm documents (text → embed → add vào index)
    - Search similarity (query → embed → tìm top-k gần nhất)
    """

    def __init__(self):
        self.embedder = EmbeddingService()
        self.index = None           # FAISS index (lưu vectors)
        self.metadata = []          # List[dict] song song với index
                                    # Mỗi item: {"content": str, "source": str, "page": int, "type": "text"|"image"}
        self._load_from_disk()

    # ═══════════════════════════════════════════════════════════════
    # LƯU / LOAD TỪ Ổ CỨNG
    # ═══════════════════════════════════════════════════════════════

    def _get_index_path(self):
        return os.path.join(VECTOR_DB_PATH, f"{FAISS_INDEX_NAME}.index")

    def _get_metadata_path(self):
        return os.path.join(VECTOR_DB_PATH, f"{FAISS_INDEX_NAME}.meta")

    def _load_from_disk(self):
        """Load FAISS index + metadata từ ổ cứng nếu đã tồn tại."""
        index_path = self._get_index_path()
        meta_path = self._get_metadata_path()

        if os.path.exists(index_path) and os.path.exists(meta_path):
            try:
                self.index = faiss.read_index(index_path)
                with open(meta_path, "rb") as f:
                    self.metadata = pickle.load(f)
                print(f"✅ Đã load Vector DB: {self.index.ntotal} vectors")
            except Exception as e:
                print(f"❌ Lỗi load Vector DB: {e}")
                self.index = None
                self.metadata = []
        else:
            print("📚 Chưa có Vector DB - cần upload PDF để tạo")

    def save_to_disk(self):
        """Lưu FAISS index + metadata xuống ổ cứng."""
        if self.index is None:
            return

        os.makedirs(VECTOR_DB_PATH, exist_ok=True)
        faiss.write_index(self.index, self._get_index_path())
        with open(self._get_metadata_path(), "wb") as f:
            pickle.dump(self.metadata, f)
        print(f"💾 Đã lưu Vector DB: {self.index.ntotal} vectors")

    # ═══════════════════════════════════════════════════════════════
    # THÊM DOCUMENTS VÀO INDEX
    # ═══════════════════════════════════════════════════════════════

    def add_documents(self, documents: list[dict]):
        """
        Thêm documents vào FAISS index.

        Args:
            documents: List[dict], mỗi dict có:
                - "content": str (nội dung text)
                - "source": str (tên file PDF nguồn)
                - "page": int (số trang)
                - "type": "text" | "image" (loại chunk)

        Returns:
            Số chunks đã thêm
        """
        if not documents:
            return 0

        # 1. Embed tất cả text content
        texts = [doc["content"] for doc in documents]
        vectors = self.embedder.embed_batch(texts)

        # 2. Convert sang float32 (FAISS yêu cầu)
        vectors = np.array(vectors, dtype=np.float32)

        # 3. Tạo index mới nếu chưa có
        if self.index is None:
            # IndexFlatIP = Inner Product (vì đã normalize → tương đương cosine)
            self.index = faiss.IndexFlatIP(self.embedder.dimensions)

        # 4. Add vào FAISS
        self.index.add(vectors)

        # 5. Lưu metadata song song
        self.metadata.extend(documents)

        return len(documents)

    # ═══════════════════════════════════════════════════════════════
    # TÌM KIẾM SIMILARITY
    # ═══════════════════════════════════════════════════════════════

    def search(self, query: str, top_k: int = RETRIEVAL_TOP_K) -> list[dict]:
        """
        Tìm kiếm chunks gần nhất với câu hỏi.

        Args:
            query: Câu hỏi cần tìm kiếm
            top_k: Số kết quả trả về

        Returns:
            List[dict] mỗi item có:
                - "content": nội dung chunk
                - "source": tên file nguồn
                - "page": số trang  
                - "type": "text" | "image"
                - "score": cosine similarity score (0→1, càng cao càng giống)
        """
        if self.index is None or self.index.ntotal == 0:
            return []

        # 1. Embed câu hỏi
        query_vector = self.embedder.embed_text(query)
        query_vector = np.array([query_vector], dtype=np.float32)

        # 2. Search FAISS
        scores, indices = self.index.search(query_vector, min(top_k, self.index.ntotal))

        # 3. Build results
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self.metadata):
                continue
            result = {**self.metadata[idx]}     # Copy metadata
            result["score"] = float(score)      # Thêm score
            results.append(result)

        return results

    @property
    def is_ready(self) -> bool:
        """Kiểm tra Vector DB đã sẵn sàng chưa (có data chưa?)."""
        return self.index is not None and self.index.ntotal > 0

    @property
    def total_vectors(self) -> int:
        """Số vectors đang lưu."""
        return self.index.ntotal if self.index else 0
