from sqlalchemy import Column, Integer, String, Date, DateTime, Text
from datetime import datetime
from .database import Base

class HoSoKhamBenh(Base):
    __tablename__ = "HoSoKhamBenh" # Tên bảng trong SQL Server

    # Khai báo các cột y hệt trong Database
    ID = Column(Integer, primary_key=True, index=True)
    
    # I. THÔNG TIN HÀNH CHÍNH
    MaBenhNhan = Column(String(20), nullable=False)
    HoTen = Column(String(100), nullable=False)
    NgaySinh = Column(Date)
    GioiTinh = Column(String(10))
    CCCD = Column(String(20))
    DiaChi = Column(String(255))
    SDT = Column(String(20))
    NgheNghiep = Column(String(100))
    MaBHYT = Column(String(25))
    LienHeKhanCap = Column(String(255))

    # II. TIỀN SỬ
    TienSuBanThan = Column(Text)
    TienSuGiaDinh = Column(Text)

    # III. CHẨN ĐOÁN ĐÔNG Y
    TrieuChung = Column(Text)
    BenhDanh = Column(String(255))
    ChungDanh = Column(String(255))

    # IV. ĐIỀU TRỊ
    BaiThuoc = Column(Text)
    ChamCuuXoaBop = Column(Text)
    CheDoAnUongSinhHoat = Column(Text)

    # V. THEO DÕI & LỜI DẶN
    NgayKham = Column(DateTime, default=datetime.now)
    LoiDanBacSi = Column(Text)