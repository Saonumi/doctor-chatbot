"""
PDF Processor - Xử lý PDF: trích text + OCR cho PDF scan.
- Text PDF: PyMuPDF get_text() → Semantic Chunking
- Scan PDF: PyMuPDF render → Tesseract OCR → Semantic Chunking
- Ảnh (tùy chọn): Gemini Vision mô tả → text chunk

Hỗ trợ cả PDF text thật lẫn PDF scan (ảnh chụp sách).
"""
import os
import io
import time
import re
import numpy as np
from PIL import Image

import fitz  # PyMuPDF

# OCR cho PDF scan
try:
    import easyocr
    HAS_OCR = True
except ImportError:
    HAS_OCR = False
    print("⚠️ easyocr chưa cài — PDF scan sẽ không đọc được text")

from app.config import (
    CHUNK_SIMILARITY_THRESHOLD, CHUNK_MAX_CHARS, CHUNK_MIN_CHARS,
    MIN_IMAGE_SIZE
)
from app.gemini_client import generate_with_image
from app.embedding_service import EmbeddingService
from app.logger_service import log_pdf_processing, log_error


class PDFProcessor:
    """
    Xử lý PDF sách Đông Y:
    1. Trích text từ mỗi trang (PyMuPDF)
    2. Nếu trang trống → OCR bằng Tesseract (hỗ trợ tiếng Việt)
    3. Semantic Chunking: nhóm câu cùng chủ đề
    4. (Tùy chọn) Trích ảnh → Gemini Vision mô tả → text chunk
    """

    def __init__(self):
        self.embedder = EmbeddingService()
        # OCR reader (tạo 1 lần, dùng lại)
        self._ocr_reader = None

    def process_pdf(self, file_path: str, skip_images: bool = False) -> list[dict]:
        """
        Xử lý 1 file PDF → danh sách chunks.

        Args:
            file_path: Đường dẫn file PDF
            skip_images: Bỏ qua xử lý ảnh (nhanh hơn nhiều, dùng khi auto-load)

        Returns:
            List[dict], mỗi item:
                - "content": str (nội dung text)
                - "source": str (tên file)
                - "page": int (số trang)
                - "type": "text" | "image"
        """
        start_time = time.time()
        filename = os.path.basename(file_path)
        all_chunks = []
        total_images_found = 0
        total_images_described = 0
        ocr_pages = 0

        print(f"📖 Đang xử lý: {filename}" + (" (text only)" if skip_images else ""))

        try:
            doc = fitz.open(file_path)
            total_pages = len(doc)
            print(f"📄 Đã mở PDF: {total_pages} trang")

            for page_num in range(total_pages):
                page = doc[page_num]

                # Progress log mỗi 20 trang
                if (page_num + 1) % 20 == 0 or page_num == 0:
                    print(f"  📃 Trang {page_num + 1}/{total_pages}...")

                # ── 1. TRÍCH TEXT (thử trực tiếp trước) ────────────
                page_text = page.get_text("text")

                # ── 2. NẾU TRỐNG → OCR (PDF scan) ─────────────────
                if (not page_text or len(page_text.strip()) <= 10) and HAS_OCR:
                    page_text = self._ocr_page(page)
                    if page_text and len(page_text.strip()) > 10:
                        ocr_pages += 1

                # ── 3. SEMANTIC CHUNK TEXT ──────────────────────────
                if page_text and len(page_text.strip()) > 10:
                    text_chunks = self._semantic_chunk(page_text, filename, page_num + 1)
                    all_chunks.extend(text_chunks)

                # ── 4. TRÍCH VÀ MÔ TẢ ẢNH (bỏ qua nếu skip_images) ──
                if not skip_images:
                    image_chunks, found, described = self._process_page_images(
                        page, filename, page_num + 1
                    )
                    all_chunks.extend(image_chunks)
                    total_images_found += found
                    total_images_described += described

            doc.close()

            duration_ms = (time.time() - start_time) * 1000
            text_chunk_count = sum(1 for c in all_chunks if c["type"] == "text")

            log_pdf_processing(
                filename=filename,
                pages=total_pages,
                text_chunks=text_chunk_count,
                images_found=total_images_found,
                images_described=total_images_described,
                duration_ms=duration_ms
            )

            ocr_msg = f", {ocr_pages} trang OCR" if ocr_pages > 0 else ""
            print(f"✅ Xong: {len(all_chunks)} chunks "
                  f"({text_chunk_count} text + {total_images_described} image{ocr_msg}) "
                  f"[{duration_ms/1000:.1f}s]")
            return all_chunks

        except Exception as e:
            log_error("pdf_processor", e, f"File: {file_path}")
            print(f"❌ Lỗi xử lý PDF: {e}")
            return []

    # ═══════════════════════════════════════════════════════════════
    # OCR CHO PDF SCAN
    # ═══════════════════════════════════════════════════════════════

    def _ocr_page(self, page) -> str:
        """
        OCR 1 trang PDF scan bằng EasyOCR.
        Render trang → ảnh 300 DPI → EasyOCR (tiếng Việt + Anh).

        Args:
            page: PyMuPDF page object

        Returns:
            Text trích xuất từ OCR (hoặc chuỗi rỗng nếu lỗi)
        """
        try:
            # Lazy init OCR reader (tải model lần đầu ~100MB)
            if self._ocr_reader is None:
                print("🔤 Đang tải EasyOCR model (lần đầu)...")
                self._ocr_reader = easyocr.Reader(['vi', 'en'], gpu=False, verbose=False)
                print("✅ EasyOCR sẵn sàng")

            # Render trang thành ảnh 300 DPI
            mat = fitz.Matrix(300 / 72, 300 / 72)
            pix = page.get_pixmap(matrix=mat)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

            # Chuyển PIL Image → numpy array cho EasyOCR
            img_array = np.array(img)

            # Chạy OCR
            results = self._ocr_reader.readtext(img_array, detail=0, paragraph=True)

            return "\n".join(results).strip() if results else ""

        except Exception as e:
            return ""

    # ═══════════════════════════════════════════════════════════════
    # SEMANTIC CHUNKING
    # ═══════════════════════════════════════════════════════════════

    def _semantic_chunk(self, text: str, source: str, page: int) -> list[dict]:
        """
        Semantic Chunking: cắt text theo nghĩa.

        Thuật toán:
        1. Tách text thành các câu
        2. Embed mỗi câu
        3. Tính cosine similarity giữa câu liền kề
        4. Khi similarity drop < threshold → cắt chunk mới
        5. Mỗi chunk = nhóm câu cùng chủ đề
        """
        # 1. Tách thành câu
        sentences = self._split_sentences(text)
        if not sentences:
            return []

        # Nếu ít câu quá, gom thành 1 chunk
        if len(sentences) <= 3:
            content = " ".join(sentences).strip()
            if len(content) >= CHUNK_MIN_CHARS:
                return [{"content": content, "source": source,
                         "page": page, "type": "text"}]
            return []

        # 2. Embed tất cả câu
        embeddings = self.embedder.embed_batch(sentences)

        # 3. Tính cosine similarity giữa câu liền kề
        similarities = []
        for i in range(len(embeddings) - 1):
            sim = float(np.dot(embeddings[i], embeddings[i + 1]))
            similarities.append(sim)

        # 4. Tìm điểm cắt (similarity < threshold)
        split_points = [0]  # Bắt đầu chunk đầu tiên
        for i, sim in enumerate(similarities):
            if sim < CHUNK_SIMILARITY_THRESHOLD:
                split_points.append(i + 1)

        # 5. Tạo chunks từ các nhóm câu
        chunks = []
        for i in range(len(split_points)):
            start = split_points[i]
            end = split_points[i + 1] if i + 1 < len(split_points) else len(sentences)

            chunk_text = " ".join(sentences[start:end]).strip()

            # Nếu chunk quá dài, cắt lại theo max chars
            if len(chunk_text) > CHUNK_MAX_CHARS:
                sub_chunks = self._split_long_chunk(chunk_text, source, page)
                chunks.extend(sub_chunks)
            elif len(chunk_text) >= CHUNK_MIN_CHARS:
                chunks.append({
                    "content": chunk_text,
                    "source": source,
                    "page": page,
                    "type": "text"
                })

        # Merge chunks quá ngắn vào chunk trước
        chunks = self._merge_short_chunks(chunks)

        return chunks

    def _split_sentences(self, text: str) -> list[str]:
        """Tách text thành câu (hỗ trợ tiếng Việt)."""
        # Tách theo: dấu chấm, chấm hỏi, chấm than, xuống dòng kép
        sentences = re.split(r'(?<=[.!?])\s+|\n\n+', text)
        # Lọc câu rỗng, quá ngắn
        return [s.strip() for s in sentences if s.strip() and len(s.strip()) > 5]

    def _split_long_chunk(self, text: str, source: str, page: int) -> list[dict]:
        """Cắt chunk dài thành nhiều chunk nhỏ hơn (fallback)."""
        chunks = []
        words = text.split()
        current = []
        current_len = 0

        for word in words:
            current.append(word)
            current_len += len(word) + 1
            if current_len >= CHUNK_MAX_CHARS * 0.8:
                chunks.append({
                    "content": " ".join(current),
                    "source": source,
                    "page": page,
                    "type": "text"
                })
                current = []
                current_len = 0

        if current and current_len >= CHUNK_MIN_CHARS:
            chunks.append({
                "content": " ".join(current),
                "source": source,
                "page": page,
                "type": "text"
            })

        return chunks

    def _merge_short_chunks(self, chunks: list[dict]) -> list[dict]:
        """Merge chunks quá ngắn vào chunk liền kề."""
        if len(chunks) <= 1:
            return chunks

        merged = [chunks[0]]
        for chunk in chunks[1:]:
            if len(merged[-1]["content"]) < CHUNK_MIN_CHARS:
                # Merge vào chunk trước
                merged[-1]["content"] += " " + chunk["content"]
            else:
                merged.append(chunk)

        return merged

    # ═══════════════════════════════════════════════════════════════
    # XỬ LÝ ẢNH BẰNG GEMINI VISION
    # ═══════════════════════════════════════════════════════════════

    def _process_page_images(self, page, source: str, page_num: int) -> tuple:
        """
        Trích ảnh từ 1 trang PDF → mô tả bằng Gemini Vision.

        Returns:
            (image_chunks, images_found, images_described)
        """
        image_chunks = []
        images_found = 0
        images_described = 0

        try:
            image_list = page.get_images(full=True)
        except Exception:
            return [], 0, 0

        for img_info in image_list:
            try:
                xref = img_info[0]
                base_image = page.parent.extract_image(xref)
                if not base_image:
                    continue

                image_bytes = base_image["image"]
                img = Image.open(io.BytesIO(image_bytes))
                width, height = img.size

                # Bỏ qua ảnh quá nhỏ (icon, bullet, border...)
                if width < MIN_IMAGE_SIZE or height < MIN_IMAGE_SIZE:
                    continue

                images_found += 1

                # Gọi Gemini Vision mô tả ảnh
                description = self._describe_image(img)
                if description:
                    image_chunks.append({
                        "content": f"[MÔ TẢ HÌNH ẢNH - Trang {page_num}]: {description}",
                        "source": source,
                        "page": page_num,
                        "type": "image"
                    })
                    images_described += 1

            except Exception as e:
                continue  # Bỏ qua ảnh lỗi, không dừng pipeline

        return image_chunks, images_found, images_described

    @staticmethod
    def _resize_image(image: Image.Image, max_size: int = 800) -> Image.Image:
        """
        Resize ảnh để tránh lỗi 413 Request Entity Too Large từ proxy.
        Giữ nguyên tỷ lệ, max 800px cạnh dài nhất, convert sang RGB.
        """
        # Convert sang RGB (bỏ alpha channel nếu có)
        if image.mode in ("RGBA", "P", "LA"):
            image = image.convert("RGB")

        w, h = image.size
        if max(w, h) > max_size:
            ratio = max_size / max(w, h)
            new_size = (int(w * ratio), int(h * ratio))
            image = image.resize(new_size, Image.LANCZOS)

        return image

    def _describe_image(self, image: Image.Image) -> str:
        """
        Gọi Gemini Vision để mô tả 1 ảnh y học.
        Ảnh được resize trước khi gửi để tránh lỗi 413.

        Args:
            image: PIL Image object

        Returns:
            Text mô tả ảnh (tiếng Việt)
        """
        try:
            # Resize để tránh 413 từ nginx proxy
            image = self._resize_image(image)

            prompt = (
                "Bạn là chuyên gia Y học Đông Y. "
                "Hãy mô tả chi tiết hình ảnh y học này bằng tiếng Việt. "
                "Nêu rõ: tên bệnh, vị thuốc, huyệt vị, cây thuốc, "
                "hoặc bất kỳ thông tin y học nào có trong ảnh. "
                "Nếu ảnh không liên quan y học, mô tả ngắn gọn nội dung."
            )
            return generate_with_image(prompt, image)
        except Exception as e:
            print(f"⚠️ Không thể mô tả ảnh: {e}")
            return ""
