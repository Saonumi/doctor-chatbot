import os
import shutil
from typing import List

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc

# Import các module đã làm
from app.database import engine, Base, get_db
from app import models, schemas
from app.rag_service import RAGService

# 1. Khởi tạo Database
# Lệnh này sẽ tạo bảng nếu chưa có (nhưng bạn đã chạy SQL script rồi nên nó sẽ bỏ qua)
models.Base.metadata.create_all(bind=engine)

# 2. Khởi tạo App FastAPI
app = FastAPI(title="TCM Doctor Chatbot", description="API hỗ trợ chẩn đoán Đông Y")

# 3. Cấu hình CORS (Để Frontend React gọi được API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Cho phép mọi nguồn (trong thực tế nên giới hạn localhost:5173)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Khởi tạo Bộ não AI (RAG)
rag_service = RAGService()

# Tạo folder lưu PDF nếu chưa có
PDF_DIR = os.path.join("storage", "pdfs")
os.makedirs(PDF_DIR, exist_ok=True)

# ==========================================
# CÁC API ENDPOINTS
# ==========================================

@app.get("/")
def read_root():
    """API kiểm tra server sống hay chết"""
    return {"message": "Server đang chạy ngon lành! Truy cập /docs để xem hướng dẫn."}

# --- 1. API Upload tài liệu PDF ---
@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload file sách PDF để AI học"""
    try:
        # Lưu file vào ổ cứng
        file_path = os.path.join(PDF_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Gọi RAG Service để học
        num_chunks = rag_service.ingest_pdf(file_path)
        
        return {
            "filename": file.filename,
            "status": "Thành công",
            "message": f"Đã học xong tài liệu. Chia thành {num_chunks} đoạn kiến thức."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi upload: {str(e)}")

# --- NEW: API Lấy mã bệnh nhân tiếp theo ---
@app.get("/api/next-patient-id")
def get_next_patient_id(db: Session = Depends(get_db)):
    """Tự động tạo mã bệnh nhân tiếp theo"""
    # Lấy mã bệnh nhân lớn nhất hiện tại
    last_record = db.query(models.HoSoKhamBenh)\
        .order_by(desc(models.HoSoKhamBenh.MaBenhNhan))\
        .first()
    
    if last_record and last_record.MaBenhNhan:
        # Extract number from BN-00049 -> 49
        try:
            last_num = int(last_record.MaBenhNhan.replace('BN-', ''))
            next_num = last_num + 1
            next_id = f"BN-{next_num:05d}"  # BN-00050
        except:
            next_id = "BN-00001"
    else:
        next_id = "BN-00001"
    
    return {"next_patient_id": next_id}


# --- 2. API Lấy danh sách hồ sơ khám ---
@app.get("/api/records", response_model=List[schemas.HoSoResponse])
def get_all_records(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Lấy danh sách 100 lần khám gần nhất"""
    records = db.query(models.HoSoKhamBenh)\
        .order_by(desc(models.HoSoKhamBenh.NgayKham))\
        .all() # Lấy hết để lọc unique phía Python (Dataset nhỏ)
        
    unique_patients = {}
    for rec in records:
        if rec.CCCD not in unique_patients:
            unique_patients[rec.CCCD] = rec
            
    # Convert back to list and slice
    final_records = list(unique_patients.values())
    
    # Tính toán LanKham cho view này (Optional, vì view tổng quan không cần quá chính xác số lần khám, nhưng nếu cần:
    # Logic cũ đếm count_prev rất chậm. Ở view tổng quan có thể tạm chấp nhận LanKham của record mới nhất = Tổng số lần khám)
    for rec in final_records:
        total_visits = db.query(models.HoSoKhamBenh).filter(models.HoSoKhamBenh.CCCD == rec.CCCD).count()
        rec.LanKham = total_visits

    return final_records[skip : skip + limit]

# --- 3. API Tìm kiếm lịch sử theo CCCD ---
@app.get("/api/history/{cccd}", response_model=List[schemas.HoSoResponse])
def get_history_by_cccd(cccd: str, db: Session = Depends(get_db)):
    """Xem lịch sử khám của 1 bệnh nhân cụ thể"""
    records = db.query(models.HoSoKhamBenh)\
        .filter(models.HoSoKhamBenh.CCCD == cccd)\
        .order_by(models.HoSoKhamBenh.NgayKham.asc()) \
        .all()
    
    # Đánh số lần khám (Cũ nhất là 1, Mới nhất là N)
    for i, rec in enumerate(records):
        rec.LanKham = i + 1
        
    # Trả về danh sách đảo ngược (Mới nhất lên đầu) để hiển thị đẹp
    return records[::-1]

# --- 4. API Chẩn đoán & Lưu hồ sơ (QUAN TRỌNG NHẤT) ---
@app.post("/api/diagnose", response_model=schemas.HoSoResponse)
def diagnose_and_save(
    record_in: schemas.HoSoCreate, 
    db: Session = Depends(get_db)
):
    """
    1. Nhận thông tin bệnh nhân đầy đủ.
    2. Tự động tính số lần khám (LanKham).
    3. Lưu vào Database SQL Server.
    """
    
    # Bước 1: Tính số lần khám (LanKham)
    # Đếm số lượng hồ sơ hiện có của bệnh nhân này
    count_prev = db.query(models.HoSoKhamBenh).filter(models.HoSoKhamBenh.CCCD == record_in.CCCD).count()
    new_lan_kham = count_prev + 1

    # Bước 2: Tạo bản ghi mới
    db_record = models.HoSoKhamBenh(
        # I. HÀNH CHÍNH
        MaBenhNhan=record_in.MaBenhNhan,
        HoTen=record_in.HoTen,
        NgaySinh=record_in.NgaySinh,
        GioiTinh=record_in.GioiTinh,
        CCCD=record_in.CCCD,
        DiaChi=record_in.DiaChi,
        SDT=record_in.SDT,
        NgheNghiep=record_in.NgheNghiep,
        MaBHYT=record_in.MaBHYT,
        LienHeKhanCap=record_in.LienHeKhanCap,
        
        # II. TIỀN SỬ
        TienSuBanThan=record_in.TienSuBanThan,
        TienSuGiaDinh=record_in.TienSuGiaDinh,
        
        # III. CHUYÊN MÔN
        TrieuChung=record_in.TrieuChung,
        BenhDanh=record_in.BenhDanh,
        ChungDanh=record_in.ChungDanh,
        
        # IV. ĐIỀU TRỊ
        BaiThuoc=record_in.BaiThuoc,
        ChamCuuXoaBop=record_in.ChamCuuXoaBop,
        CheDoAnUongSinhHoat=record_in.CheDoAnUongSinhHoat,
        
        # V. THEO DÕI
        # LanKham & HenTaiKham da xoa khoi DB, khong luu nua
        LoiDanBacSi=record_in.LoiDanBacSi
    )
    
    # Bước 3: Lưu vào DB
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    # Gán LanKham thủ công để trả về cho Frontend
    db_record.LanKham = new_lan_kham
    
    return db_record

# --- 5. API Chat với AI (Không lưu vào DB) ---
@app.post("/api/chat")
async def chat_with_ai(question: str = Form(...)):
    """
    Chat với AI về Y học Đông Y
    Không lưu vào database, chỉ trả về câu trả lời + tài liệu tham khảo
    """
    try:
        result = rag_service.chat(question)
        # result là dict có keys: answer, sources
        if isinstance(result, dict):
            return {
                "question": question,
                "answer": result.get("answer", ""),
                "sources": result.get("sources", []),
                "status": "success"
            }
        else:
            # Fallback nếu trả về string
            return {
                "question": question,
                "answer": result,
                "sources": [],
                "status": "success"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi AI: {str(e)}")

# --- 6. API Tìm kiếm bệnh nhân (Nâng cấp) ---
@app.get("/api/search", response_model=List[schemas.HoSoResponse])
def search_patients(q: str, db: Session = Depends(get_db)):
    """
    Tìm kiếm bệnh nhân theo nhiều trường:
    - Tên (HoTen)
    - CCCD
    - SĐT
    - Triệu chứng (TrieuChung)
    - Chẩn đoán (ChanDoan)
    - Ngày sinh (NgaySinh)
    Query parameter: q (search query)
    """
    # Tìm kiếm toàn diện
    # Logic tìm kiếm:
    # 1. Tìm tất cả record match query
    matching_records = db.query(models.HoSoKhamBenh)\
        .filter(
            (models.HoSoKhamBenh.HoTen.contains(q)) |
            (models.HoSoKhamBenh.CCCD.contains(q)) |
            (models.HoSoKhamBenh.SDT.contains(q)) |
            (models.HoSoKhamBenh.TrieuChung.contains(q)) |
            (models.HoSoKhamBenh.ChanDoan.contains(q)) |
            (models.HoSoKhamBenh.DiaChi.contains(q)) |
            (models.HoSoKhamBenh.BenhDanh.contains(q)) |
            (models.HoSoKhamBenh.ChungDanh.contains(q))
        )\
        .order_by(desc(models.HoSoKhamBenh.NgayKham))\
        .all()
        
    # 2. Lấy danh sách CCCD unique từ kết quả tìm kiếm
    matched_cccds = set(rec.CCCD for rec in matching_records)
    
    # 3. Với mỗi CCCD tìm được, lấy record MỚI NHẤT của họ để hiển thị
    final_results = []
    
    # Để tối ưu, ta query lấy latest record cho từng CCCD
    # Hoặc query all in CCCD list and grouping python
    if matched_cccds:
         all_related_records = db.query(models.HoSoKhamBenh)\
            .filter(models.HoSoKhamBenh.CCCD.in_(matched_cccds))\
            .order_by(desc(models.HoSoKhamBenh.NgayKham))\
            .all()
            
         unique_map = {}
         for rec in all_related_records:
             if rec.CCCD not in unique_map:
                 unique_map[rec.CCCD] = rec
                 
         final_results = list(unique_map.values())

    # Tính LanKham = Tổng số lần khám
    for rec in final_results:
        total_visits = db.query(models.HoSoKhamBenh).filter(models.HoSoKhamBenh.CCCD == rec.CCCD).count()
        rec.LanKham = total_visits

    return final_results

if __name__ == "__main__":
    import uvicorn
    # Chạy server với uvicorn khi file được execute trực tiếp
    # Reload=True giúp tự động restart khi sửa code
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)