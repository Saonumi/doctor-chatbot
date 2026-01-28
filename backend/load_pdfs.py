"""
Script để load tất cả PDF có sẵn vào Vector Database
Chạy script này 1 lần để import tất cả tài liệu
"""
import os
from app.rag_service import RAGService

PDF_DIR = os.path.join("storage", "pdfs")

def load_all_pdfs():
    """Load tất cả PDF files vào vector database"""
    rag = RAGService()
    
    # Lấy danh sách file PDF
    pdf_files = [f for f in os.listdir(PDF_DIR) if f.endswith('.pdf')]
    
    if not pdf_files:
        print("❌ Không tìm thấy file PDF nào trong storage/pdfs/")
        return
    
    print(f"📚 Tìm thấy {len(pdf_files)} file PDF:")
    for pdf in pdf_files:
        print(f"  - {pdf}")
    
    print("\n" + "="*60)
    print("🚀 Bắt đầu xử lý...")
    print("="*60 + "\n")
    
    total_chunks = 0
    for idx, pdf_file in enumerate(pdf_files, 1):
        pdf_path = os.path.join(PDF_DIR, pdf_file)
        file_size = os.path.getsize(pdf_path) / (1024 * 1024)  # MB
        
        print(f"\n📖 [{idx}/{len(pdf_files)}] Đang xử lý: {pdf_file}")
        print(f"   Kích thước: {file_size:.2f} MB")
        
        try:
            chunks = rag.ingest_pdf(pdf_path)
            total_chunks += chunks
            print(f"   ✅ Hoàn thành: {chunks} đoạn kiến thức")
        except Exception as e:
            print(f"   ❌ Lỗi: {str(e)}")
    
    print("\n" + "="*60)
    print(f"🎉 HOÀN TẤT!")
    print(f"📊 Tổng cộng: {total_chunks} đoạn kiến thức từ {len(pdf_files)} file PDF")
    print("="*60)

if __name__ == "__main__":
    load_all_pdfs()
