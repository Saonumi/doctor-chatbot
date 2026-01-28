from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

# --- SCHEMAS CHO LƯỢT KHÁM ---
class LuotKhamBase(BaseModel):
    TrieuChung: Optional[str] = None
    BenhDanh: Optional[str] = None
    ChungDanh: Optional[str] = None
    BaiThuoc: Optional[str] = None
    ChamCuuXoaBop: Optional[str] = None
    CheDoAnUongSinhHoat: Optional[str] = None
    LoiDanBacSi: Optional[str] = None

class LuotKhamCreate(LuotKhamBase):
    pass

class LuotKhamResponse(LuotKhamBase):
    LuotKhamID: int
    BenhNhanID: int
    NgayKham: datetime

    class Config:
        from_attributes = True

# --- SCHEMAS CHO BỆNH NHÂN ---
class BenhNhanBase(BaseModel):
    # I. THÔNG TIN HÀNH CHÍNH
    HoTen: str
    NgaySinh: Optional[date] = None
    GioiTinh: Optional[str] = None
    CCCD: str  # Required để check trùng
    DiaChi: Optional[str] = None
    SDT: Optional[str] = None
    NgheNghiep: Optional[str] = None
    MaBHYT: Optional[str] = None
    LienHeKhanCap: Optional[str] = None

    # II. TIỀN SỬ
    TienSuBanThan: Optional[str] = None
    TienSuGiaDinh: Optional[str] = None

class BenhNhanCreate(BenhNhanBase):
    # Khi tạo bệnh nhân mới, có thể tạo luôn lượt khám đầu tiên
    LuotKhamDau: Optional[LuotKhamCreate] = None

class BenhNhanUpdate(BenhNhanBase):
    pass

class BenhNhanResponse(BenhNhanBase):
    ID: int
    MaBenhNhan: Optional[str] = None # Có thể null lúc mới insert xong chưa refresh
    NgayTao: datetime
    luot_khams: List[LuotKhamResponse] = []

    class Config:
        from_attributes = True