"""
Embedding Service - Wrapper cho sentence-transformers.
Không dùng LangChain, gọi trực tiếp sentence_transformers.
Singleton pattern: model chỉ load 1 lần vào RAM.
"""
import numpy as np
from sentence_transformers import SentenceTransformer

from app.config import EMBEDDING_MODEL, EMBEDDING_DIMENSIONS


class EmbeddingService:
    """
    Quản lý model embedding.
    - Load model paraphrase-multilingual-MiniLM-L12-v2 (384 dims)
    - Embed text đơn lẻ hoặc batch
    - Singleton: chỉ tạo 1 instance duy nhất
    """

    _instance = None

    def __new__(cls):
        """Singleton pattern - chỉ load model 1 lần."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        print(f"📥 Đang tải model embedding: {EMBEDDING_MODEL}...")
        self.model = SentenceTransformer(EMBEDDING_MODEL)
        self.dimensions = EMBEDDING_DIMENSIONS
        print(f"✅ Model embedding đã sẵn sàng ({self.dimensions} dimensions)")
        self._initialized = True

    def embed_text(self, text: str) -> np.ndarray:
        """
        Embed 1 đoạn text → vector numpy.

        Args:
            text: Đoạn text cần embed (VD: câu hỏi user, 1 chunk sách)

        Returns:
            numpy array shape (384,) - vector embedding
        """
        return self.model.encode(text, normalize_embeddings=True)

    def embed_batch(self, texts: list[str]) -> np.ndarray:
        """
        Embed nhiều đoạn text cùng lúc (nhanh hơn gọi từng cái).

        Args:
            texts: Danh sách text cần embed

        Returns:
            numpy array shape (N, 384) - ma trận embedding
        """
        if not texts:
            return np.array([])
        return self.model.encode(texts, normalize_embeddings=True,
                                  show_progress_bar=len(texts) > 50)
