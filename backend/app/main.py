"""
FastAPI Application - API endpoints cho hệ thống quản lý phòng khám Đông Y.
Tích hợp AI Service (Agentic RAG + Text-to-SQL + Vision PDF).
"""
import os
import shutil
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel

# Import các module
from app.database import engine, Base, get_db
from app import models, schemas
from app.ai_service import AIService
from app.config import PDF_DIR

# 1. Khởi tạo Database
models.Base.metadata.create_all(bind=engine)

# 2. Khởi tạo App FastAPI
app = FastAPI(title="TCM Doctor Chatbot", description="API hỗ trợ chẩn đoán Đông Y - Agentic RAG + Text-to-SQL")

# 3. Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Khởi tạo AI Service (thay thế RAGService cũ)
ai_service = AIService()

# Tạo folder lưu PDF nếu chưa có
os.makedirs(PDF_DIR, exist_ok=True)

# Mount PDF files để frontend có thể mở PDF trực tiếp
app.mount("/pdfs", StaticFiles(directory=PDF_DIR), name="pdfs")


# ==========================================
# SCHEMAS CHO CHAT API
# ==========================================

class ChatRequest(BaseModel):
    """Schema cho request chat."""
    question: str
    chat_history: Optional[list] = None


# ==========================================
# CÁC API ENDPOINTS
# ==========================================

@app.get("/")
def read_root():
    """API kiểm tra server."""
    return {"message": "Server đang chạy! Truy cập /docs để xem hướng dẫn."}


# --- 1. API Chat với AI (SSE Streaming) ---
@app.post("/api/chat")
async def chat_with_ai(body: ChatRequest):
    """
    Chat với AI - SSE Streaming.
    Stream từng bước xử lý (intent → retrieval/sql → llm → complete).
    Frontend nhận events để visualize pipeline.
    """
    return StreamingResponse(
        ai_service.chat_stream(body.question, body.chat_history),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# --- 2. API Upload tài liệu PDF ---
@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload file sách PDF để AI học (Semantic Chunking + Vision)."""
    try:
        file_path = os.path.join(PDF_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        num_chunks = ai_service.ingest_pdf(file_path)

        return {
            "filename": file.filename,
            "status": "Thành công",
            "message": f"Đã học xong tài liệu. Chia thành {num_chunks} đoạn kiến thức (Semantic Chunking + Vision)."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi upload: {str(e)}")


# --- 3. API QUẢN LÝ BỆNH NHÂN & KHÁM BỆNH ---
# (Giữ nguyên logic cũ, không thay đổi)

@app.get("/api/patients/check", response_model=Optional[schemas.BenhNhanResponse])
def check_patient(cccd: str, db: Session = Depends(get_db)):
    """Kiểm tra bệnh nhân đã có trong hệ thống chưa (theo CCCD)."""
    patient = db.query(models.BenhNhan).filter(models.BenhNhan.CCCD == cccd).first()
    if patient:
        return patient
    return None


@app.post("/api/patients", response_model=schemas.BenhNhanResponse)
def create_patient(payload: schemas.BenhNhanCreate, db: Session = Depends(get_db)):
    """Tạo hồ sơ bệnh nhân mới + Lượt khám đầu tiên."""
    existing = db.query(models.BenhNhan).filter(models.BenhNhan.CCCD == payload.CCCD).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bệnh nhân với CCCD này đã tồn tại.")

    patient_data = payload.model_dump(exclude={'LuotKhamDau'})
    new_patient = models.BenhNhan(**patient_data)
    db.add(new_patient)
    db.flush()
    db.refresh(new_patient)

    if payload.LuotKhamDau:
        visit_data = payload.LuotKhamDau.model_dump()
        new_visit = models.LuotKham(BenhNhanID=new_patient.ID, **visit_data)
        db.add(new_visit)

    db.commit()
    db.refresh(new_patient)
    return new_patient


@app.put("/api/patients/{patient_id}", response_model=schemas.BenhNhanResponse)
def update_patient(patient_id: int, payload: schemas.BenhNhanUpdate, db: Session = Depends(get_db)):
    """Cập nhật thông tin bệnh nhân."""
    patient = db.query(models.BenhNhan).filter(models.BenhNhan.ID == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh nhân")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(patient, key, value)

    db.commit()
    db.refresh(patient)
    return patient


@app.delete("/api/patients/{patient_id}")
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    """Xóa bệnh nhân và các lượt khám liên quan."""
    patient = db.query(models.BenhNhan).filter(models.BenhNhan.ID == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh nhân")

    db.query(models.LuotKham).filter(models.LuotKham.BenhNhanID == patient_id).delete()
    db.delete(patient)
    db.commit()
    return {"message": "Đã xóa bệnh nhân thành công"}


@app.post("/api/visits", response_model=schemas.LuotKhamResponse)
def create_visit(benh_nhan_id: int, payload: schemas.LuotKhamCreate, db: Session = Depends(get_db)):
    """Thêm lượt khám mới cho bệnh nhân đã có."""
    patient = db.query(models.BenhNhan).filter(models.BenhNhan.ID == benh_nhan_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh nhân.")

    new_visit = models.LuotKham(BenhNhanID=benh_nhan_id, **payload.model_dump())
    db.add(new_visit)
    db.commit()
    db.refresh(new_visit)
    return new_visit


@app.get("/api/patients", response_model=List[schemas.BenhNhanResponse])
def get_patients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Lấy danh sách bệnh nhân."""
    patients = db.query(models.BenhNhan)\
        .order_by(desc(models.BenhNhan.NgayTao))\
        .offset(skip).limit(limit).all()
    return patients


@app.get("/api/patients/{id}", response_model=schemas.BenhNhanResponse)
def get_patient_detail(id: int, db: Session = Depends(get_db)):
    """Lấy chi tiết bệnh nhân + lịch sử khám."""
    patient = db.query(models.BenhNhan).filter(models.BenhNhan.ID == id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh nhân.")
    return patient


@app.get("/api/search", response_model=List[schemas.BenhNhanResponse])
def search_patients(q: str, db: Session = Depends(get_db)):
    """Tìm kiếm bệnh nhân theo tên, CCCD, SĐT, địa chỉ."""
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
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)