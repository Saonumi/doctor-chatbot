"""
Script giám sát và xử lý tự động các PDF files
Tự động phát hiện PDF mới trong storage/pdfs và nạp vào AI
"""
import os
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from app.rag_service import RAGService

PDF_DIR = os.path.join("storage", "pdfs")

class PDFHandler(FileSystemEventHandler):
    """Handler để theo dõi thay đổi trong folder PDFs"""
    def __init__(self):
        self.rag = RAGService()
        
    def on_created(self, event):
        """Khi có file mới được tạo"""
        if event.is_directory:
            return
        
        if event.src_path.endswith('.pdf'):
            print(f"\n🆕 Phát hiện PDF mới: {os.path.basename(event.src_path)}")
            # Đợi file được copy xong (nếu đang upload)
            time.sleep(2)
            
            try:
                chunks = self.rag.ingest_pdf(event.src_path)
                print(f"✅ Đã nạp thành công: {chunks} chunks")
            except Exception as e:
                print(f"❌ Lỗi khi nạp PDF: {str(e)}")

def watch_pdf_folder():
    """Theo dõi folder PDF và tự động xử lý file mới"""
    if not os.path.exists(PDF_DIR):
        os.makedirs(PDF_DIR)
        print(f"✅ Đã tạo thư mục: {PDF_DIR}")
    
    event_handler = PDFHandler()
    observer = Observer()
    observer.schedule(event_handler, PDF_DIR, recursive=False)
    observer.start()
    
    print(f"👁️  Đang theo dõi thư mục: {PDF_DIR}")
    print("📂 Mọi PDF mới sẽ được tự động nạp vào AI")
    print("Nhấn Ctrl+C để dừng...\n")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\n⏹️  Đã dừng theo dõi")
    
    observer.join()

if __name__ == "__main__":
    watch_pdf_folder()
