import os
import shutil
from typing import List, Optional

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

# --- 2. API QUẢN LÝ BỆNH NHÂN & KHÁM BỆNH ---

# A. Kiểm tra bệnh nhân tồn tại hay chưa
@app.get("/api/patients/check", response_model=Optional[schemas.BenhNhanResponse])
def check_patient(cccd: str, db: Session = Depends(get_db)):
    """Kiểm tra xem bệnh nhân đã có trong hệ thống chưa (theo CCCD)"""
    patient = db.query(models.BenhNhan).filter(models.BenhNhan.CCCD == cccd).first()
    if patient:
        return patient
    return None

# B. Tạo Bệnh nhân mới (kèm Lượt khám đầu tiên)
@app.post("/api/patients", response_model=schemas.BenhNhanResponse)
def create_patient(payload: schemas.BenhNhanCreate, db: Session = Depends(get_db)):
    """Tạo hồ sơ bệnh nhân mới + Lượt khám đầu tiên (nếu có)"""
    # 1. Check duplicate CCCD again just to be safe
    existing = db.query(models.BenhNhan).filter(models.BenhNhan.CCCD == payload.CCCD).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bệnh nhân với CCCD này đã tồn tại.")

    # 2. Tạo Bệnh nhân
    patient_data = payload.model_dump(exclude={'LuotKhamDau'})
    new_patient = models.BenhNhan(**patient_data)
    db.add(new_patient)
    db.flush() # Để lấy ID và MaBenhNhan (computed)
    db.refresh(new_patient) # Lấy lại data từ DB (bao gồm MaBenhNhan)

    # 3. Tạo Lượt khám đầu tiên (nếu có)
    if payload.LuotKhamDau:
        visit_data = payload.LuotKhamDau.model_dump()
        new_visit = models.LuotKham(BenhNhanID=new_patient.ID, **visit_data)
        db.add(new_visit)
    
    db.commit()
    db.refresh(new_patient)
    return new_patient

@app.put("/api/patients/{patient_id}", response_model=schemas.BenhNhanResponse)
def update_patient(patient_id: int, payload: schemas.BenhNhanUpdate, db: Session = Depends(get_db)):
    """Cập nhật thông tin bệnh nhân"""
    patient = db.query(models.BenhNhan).filter(models.BenhNhan.ID == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh nhân")
    
    # Update data
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(patient, key, value)
    
    db.commit()
    db.refresh(patient)
    return patient

@app.delete("/api/patients/{patient_id}")
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    """Xóa bệnh nhân và các lượt khám liên quan"""
    patient = db.query(models.BenhNhan).filter(models.BenhNhan.ID == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh nhân")
    
    # Xóa các lượt khám trước (Cascade manual if needed, but relationship cascade usually handles it if configured)
    # But for safety in current model setup (no cascade delete configured in models.py yet? default is none)
    # Let's check models.py: relationship("LuotKham", back_populates="benh_nhan")
    # It does not have cascade="all, delete-orphan".
    # So we should manually delete visits first to avoid Foreign Key constraint error.
    db.query(models.LuotKham).filter(models.LuotKham.BenhNhanID == patient_id).delete()
    
    db.delete(patient)
    db.commit()
    return {"message": "Đã xóa bệnh nhân thành công"}

# C. Thêm lượt khám mới cho Bệnh nhân cũ
@app.post("/api/visits", response_model=schemas.LuotKhamResponse)
def create_visit(benh_nhan_id: int, payload: schemas.LuotKhamCreate, db: Session = Depends(get_db)):
    """Thêm lượt khám mới cho bệnh nhân đã có"""
    # Check patient exists
    patient = db.query(models.BenhNhan).filter(models.BenhNhan.ID == benh_nhan_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh nhân.")

    new_visit = models.LuotKham(BenhNhanID=benh_nhan_id, **payload.model_dump())
    db.add(new_visit)
    db.commit()
    db.refresh(new_visit)
    return new_visit

# D. Lấy danh sách bệnh nhân (cho trang danh sách)
@app.get("/api/patients", response_model=List[schemas.BenhNhanResponse])
def get_patients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Lấy danh sách bệnh nhân (có kèm lượt khám mới nhất)"""
    patients = db.query(models.BenhNhan)\
        .order_by(desc(models.BenhNhan.NgayTao))\
        .offset(skip).limit(limit).all()
    return patients

# E. Lấy chi tiết bệnh nhân + Lịch sử khám
@app.get("/api/patients/{id}", response_model=schemas.BenhNhanResponse)
def get_patient_detail(id: int, db: Session = Depends(get_db)):
    patient = db.query(models.BenhNhan).filter(models.BenhNhan.ID == id).first()
    if not patient:
         raise HTTPException(status_code=404, detail="Không tìm thấy bệnh nhân.")
    return patient

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
# --- 6. API Tìm kiếm bệnh nhân (Nâng cấp) ---
@app.get("/api/search", response_model=List[schemas.BenhNhanResponse])
def search_patients(q: str, db: Session = Depends(get_db)):
    """
    Tìm kiếm bệnh nhân theo:
    - Tên (HoTen)
    - CCCD
    - SĐT
    - Địa chỉ
    """
    # Tìm kiếm trong bảng BenhNhan
    patients = db.query(models.BenhNhan)\
        .filter(
            (models.BenhNhan.HoTen.contains(q)) |
            (models.BenhNhan.CCCD.contains(q)) |
            (models.BenhNhan.SDT.contains(q)) |
            (models.BenhNhan.DiaChi.contains(q))
        )\
        .order_by(desc(models.BenhNhan.NgayTao))\
        .all()
        
    return patients

if __name__ == "__main__":
    import uvicorn
    # Chạy server với uvicorn khi file được execute trực tiếp
    # Reload=True giúp tự động restart khi sửa code
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)