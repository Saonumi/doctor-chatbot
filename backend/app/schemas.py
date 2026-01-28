from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

# Model dùng để tạo hồ sơ khám mới (Input)
# Model dùng để tạo hồ sơ khám mới (Input)
class HoSoCreate(BaseModel):
    # I. THÔNG TIN HÀNH CHÍNH
    MaBenhNhan: str
    HoTen: str
    NgaySinh: Optional[date] = None
    GioiTinh: Optional[str] = None
    CCCD: Optional[str] = None
    DiaChi: Optional[str] = None
    SDT: Optional[str] = None
    NgheNghiep: Optional[str] = None
    MaBHYT: Optional[str] = None
    LienHeKhanCap: Optional[str] = None

    # II. TIỀN SỬ
    TienSuBanThan: Optional[str] = None
    TienSuGiaDinh: Optional[str] = None

    # III. CHẨN ĐOÁN ĐÔNG Y
    TrieuChung: Optional[str] = None
    BenhDanh: Optional[str] = None
    ChungDanh: Optional[str] = None

    # IV. ĐIỀU TRỊ
    BaiThuoc: Optional[str] = None
    ChamCuuXoaBop: Optional[str] = None
    CheDoAnUongSinhHoat: Optional[str] = None

    # V. THEO DÕI & LỜI DẶN
    # LanKham duoc tinh tu dong
    NgayKham: Optional[datetime] = None
    # HenTaiKham da xoa khoi DB
    LoiDanBacSi: Optional[str] = None

# Model dùng để trả về dữ liệu cho Frontend (Output)
class HoSoResponse(HoSoCreate):
    ID: int
    LanKham: int # Field nay se duoc tinh toan

    class Config:
        from_attributes = True # Để đọc được dữ liệu từ SQLAlchemy model