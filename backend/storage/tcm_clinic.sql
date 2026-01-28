USE master;
GO

-- 1. THIẾT LẬP LẠI DATABASE
IF EXISTS (SELECT * FROM sys.databases WHERE name = 'TCM_Clinic')
BEGIN
    ALTER DATABASE TCM_Clinic SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE TCM_Clinic;
END
GO

CREATE DATABASE TCM_Clinic;
GO

USE TCM_Clinic;
GO

-- 2. TẠO BẢNG 1: DANH SÁCH BỆNH NHÂN
CREATE TABLE BenhNhan (
    ID INT IDENTITY(1,1) PRIMARY KEY, -- ID tự tăng làm gốc
    -- Cột MaBenhNhan tự động sinh: BN00001, BN00002...
    MaBenhNhan AS ('BN' + RIGHT('00000' + CAST(ID AS VARCHAR(5)), 5)) PERSISTED, 
    
    HoTen NVARCHAR(100) NOT NULL,
    NgaySinh DATE,
    GioiTinh NVARCHAR(10),
    CCCD VARCHAR(20) UNIQUE NOT NULL, -- Định danh duy nhất để tra cứu
    DiaChi NVARCHAR(255),
    SDT VARCHAR(20),
    NgheNghiep NVARCHAR(100),
    MaBHYT VARCHAR(25),
    LienHeKhanCap NVARCHAR(255),
    TienSuBanThan NVARCHAR(MAX),
    TienSuGiaDinh NVARCHAR(MAX),
    NgayTao DATETIME DEFAULT GETDATE()
);

-- 3. TẠO BẢNG 2: LỊCH SỬ LƯỢT KHÁM
CREATE TABLE LuotKham (
    LuotKhamID INT IDENTITY(1,1) PRIMARY KEY,
    BenhNhanID INT NOT NULL, -- Nối với cột ID của bảng BenhNhan
    
    TrieuChung NVARCHAR(MAX),
    BenhDanh NVARCHAR(255),
    ChungDanh NVARCHAR(255),
    BaiThuoc NVARCHAR(MAX),
    ChamCuuXoaBop NVARCHAR(MAX),
    CheDoAnUongSinhHoat NVARCHAR(MAX),
    LoiDanBacSi NVARCHAR(MAX),
    NgayKham DATETIME DEFAULT GETDATE(),
    
    CONSTRAINT FK_LuotKham_BenhNhan FOREIGN KEY (BenhNhanID) REFERENCES BenhNhan(ID)
);
GO

-- 4. CHÈN 100 BẢN GHI MẪU (Dữ liệu thật, không trùng lặp)
DECLARE @i INT = 1;
DECLARE @CurrentBN_ID INT;

-- Danh sách tên mẫu để random
CREATE TABLE #Ho (H NVARCHAR(20)); INSERT INTO #Ho VALUES (N'Nguyễn'), (N'Trần'), (N'Lê'), (N'Phạm'), (N'Hoàng'), (N'Phan'), (N'Vũ'), (N'Đặng'), (N'Bùi'), (N'Đỗ'), (N'Hồ'), (N'Ngô'), (N'Dương'), (N'Lý'), (N'Trịnh');
CREATE TABLE #Dem (D NVARCHAR(20)); INSERT INTO #Dem VALUES (N'Văn'), (N'Thị'), (N'Minh'), (N'Đức'), (N'Hồng'), (N'Ngọc'), (N'Bảo'), (N'Quốc'), (N'Thành'), (N'Anh');
CREATE TABLE #Ten (T NVARCHAR(20)); INSERT INTO #Ten VALUES (N'An'), (N'Bình'), (N'Cường'), (N'Dũng'), (N'Giang'), (N'Hương'), (N'Lan'), (N'Minh'), (N'Nam'), (N'Phúc'), (N'Sơn'), (N'Tùng'), (N'Uyên'), (N'Vinh'), (N'Yến'), (N'Trang'), (N'Thắng'), (N'Hùng'), (N'Kiên'), (N'Hà');

-- Mẫu bệnh lý Đông Y
CREATE TABLE #Samples (BD NVARCHAR(100), CD NVARCHAR(100), TC NVARCHAR(MAX), BT NVARCHAR(MAX));
INSERT INTO #Samples VALUES 
(N'Chứng Tý', N'Phong hàn thấp tý', N'Đau mỏi các khớp, sợ lạnh, rêu lưỡi trắng.', N'Độc hoạt ký sinh thang.'),
(N'Thất miên', N'Tâm tỳ lưỡng hư', N'Mất ngủ, hay quên, hồi hộp, ăn kém.', N'Quy tỳ thang.'),
(N'Vị quản thống', N'Can khí phạm vị', N'Đau vùng thượng vị lan sườn, ợ hơi.', N'Sài hồ sơ can tán.'),
(N'Đầu thống', N'Can dương thượng cang', N'Đau đầu căng giật, mắt đỏ, hay cáu gắt.', N'Thiên ma câu đằng ẩm.'),
(N'Hư lao', N'Thận âm hư', N'Đau lưng, mồ hôi trộm, lòng bàn tay chân nóng.', N'Lục vị địa hoàng hoàn.');

WHILE @i <= 100
BEGIN
    -- Tạo thông tin Bệnh nhân mới
    DECLARE @HoTen NVARCHAR(100) = (SELECT TOP 1 H FROM #Ho ORDER BY NEWID()) + ' ' + (SELECT TOP 1 D FROM #Dem ORDER BY NEWID()) + ' ' + (SELECT TOP 1 T FROM #Ten ORDER BY NEWID());
    DECLARE @CCCD VARCHAR(20) = CAST(CAST(ABS(CHECKSUM(NEWID())) % 1000000000000 AS BIGINT) AS VARCHAR(20));
    
    INSERT INTO BenhNhan (HoTen, NgaySinh, GioiTinh, CCCD, DiaChi, SDT, TienSuBanThan)
    VALUES (@HoTen, '1980-01-01', CASE WHEN @HoTen LIKE N'%Thị%' THEN N'Nữ' ELSE N'Nam' END, @CCCD, N'Hà Nội', '09' + CAST(@i+10000000 AS VARCHAR), N'Không dị ứng');
    
    -- Lấy ID của bệnh nhân vừa chèn
    SET @CurrentBN_ID = SCOPE_IDENTITY();

    -- Cho bệnh nhân này đi khám từ 1-3 lần
    DECLARE @v INT = 1;
    DECLARE @MaxV INT = (ABS(CHECKSUM(NEWID())) % 3) + 1;
    WHILE @v <= @MaxV AND @i <= 100
    BEGIN
        DECLARE @BD NVARCHAR(100), @CD NVARCHAR(100), @TC NVARCHAR(MAX), @BT NVARCHAR(MAX);
        SELECT TOP 1 @BD=BD, @CD=CD, @TC=TC, @BT=BT FROM #Samples ORDER BY NEWID();

        INSERT INTO LuotKham (BenhNhanID, TrieuChung, BenhDanh, ChungDanh, BaiThuoc, NgayKham)
        VALUES (@CurrentBN_ID, @TC, @BD, @CD, @BT, DATEADD(DAY, -@i, GETDATE()));

        SET @v = @v + 1;
        SET @i = @i + 1;
    END
END

DROP TABLE #Ho; DROP TABLE #Dem; DROP TABLE #Ten; DROP TABLE #Samples;
GO

-- KIỂM TRA
SELECT b.MaBenhNhan, b.HoTen, b.CCCD, l.LuotKhamID, l.BenhDanh, l.NgayKham
FROM BenhNhan b
JOIN LuotKham l ON b.ID = l.BenhNhanID
ORDER BY b.ID, l.NgayKham;