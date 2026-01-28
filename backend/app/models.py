from sqlalchemy import Column, Integer, String, Date, DateTime, Text
from datetime import datetime
from .database import Base

from sqlalchemy import Column, Integer, String, Date, DateTime, Text, ForeignKey, Computed, Unicode, UnicodeText
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class BenhNhan(Base):
    __tablename__ = "BenhNhan"

    # ID tự tăng
    ID = Column(Integer, primary_key=True, index=True)
    
    # MaBenhNhan là computed column trong DB (BNxxxxx)
    # Chúng ta map nó để đọc, nhưng không insert/update
    MaBenhNhan = Column(String(20), Computed(''), nullable=True) 
    
    # I. THÔNG TIN HÀNH CHÍNH
    HoTen = Column(Unicode(100), nullable=False)
    NgaySinh = Column(Date)
    GioiTinh = Column(Unicode(10))
    CCCD = Column(String(20), unique=True, nullable=False)
    DiaChi = Column(Unicode(255))
    SDT = Column(String(20)) # SĐT is numbers, String is fine but Unicode doesn't hurt.
    NgheNghiep = Column(Unicode(100))
    MaBHYT = Column(String(25))
    LienHeKhanCap = Column(Unicode(255))

    # II. TIỀN SỬ (Gắn liền với bệnh nhân)
    TienSuBanThan = Column(UnicodeText)
    TienSuGiaDinh = Column(UnicodeText)
    
    NgayTao = Column(DateTime, default=datetime.now)

    # Relationship với LuotKham
    luot_khams = relationship("LuotKham", back_populates="benh_nhan")

class LuotKham(Base):
    __tablename__ = "LuotKham"

    LuotKhamID = Column(Integer, primary_key=True, index=True)
    BenhNhanID = Column(Integer, ForeignKey("BenhNhan.ID"), nullable=False)

    # III. CHẨN ĐOÁN ĐÔNG Y
    TrieuChung = Column(UnicodeText)
    BenhDanh = Column(Unicode(255))
    ChungDanh = Column(Unicode(255))

    # IV. ĐIỀU TRỊ
    BaiThuoc = Column(Text)
    ChamCuuXoaBop = Column(Text)
    CheDoAnUongSinhHoat = Column(Text)

    # V. THEO DÕI
    LoiDanBacSi = Column(Text)
    NgayKham = Column(DateTime, default=datetime.now)

    # Relationship ngược lại
    benh_nhan = relationship("BenhNhan", back_populates="luot_khams")