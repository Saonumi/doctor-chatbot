"""
Script để load tất cả PDF có sẵn vào Vector Database.
Sử dụng AI Service mới (Semantic Chunking + Vision).
Chạy: python load_pdfs.py
"""
import os
from app.ai_service import AIService
from app.config import PDF_DIR


def load_all_pdfs():
    """Load tất cả PDF files vào vector database."""
    ai = AIService()

    # Lấy danh sách file PDF
    pdf_files = [f for f in os.listdir(PDF_DIR) if f.endswith('.pdf')]

    if not pdf_files:
        print("❌ Không tìm thấy file PDF nào trong storage/pdfs/")
        return

    print(f"📚 Tìm thấy {len(pdf_files)} file PDF:")
    for pdf in pdf_files:
        print(f"  - {pdf}")

    print("\n" + "=" * 60)
    print("🚀 Bắt đầu xử lý (Semantic Chunking + Gemini Vision)...")
    print("=" * 60 + "\n")

    total_chunks = 0
    for idx, pdf_file in enumerate(pdf_files, 1):
        pdf_path = os.path.join(PDF_DIR, pdf_file)
        file_size = os.path.getsize(pdf_path) / (1024 * 1024)

        print(f"\n📖 [{idx}/{len(pdf_files)}] Đang xử lý: {pdf_file}")
        print(f"   Kích thước: {file_size:.2f} MB")

        try:
            chunks = ai.ingest_pdf(pdf_path)
            total_chunks += chunks
            print(f"   ✅ Hoàn thành: {chunks} đoạn kiến thức")
        except Exception as e:
            print(f"   ❌ Lỗi: {str(e)}")

    print("\n" + "=" * 60)
    print(f"🎉 HOÀN TẤT!")
    print(f"📊 Tổng cộng: {total_chunks} đoạn kiến thức từ {len(pdf_files)} file PDF")
    print(f"📝 Log chi tiết: storage/logs/ai_pipeline.log")
    print("=" * 60)


if __name__ == "__main__":
    load_all_pdfs()
