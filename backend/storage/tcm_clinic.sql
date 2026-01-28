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

-- 2. TẠO BẢNG HỒ SƠ KHÁM BỆNH
CREATE TABLE HoSoKhamBenh (
    ID INT IDENTITY(1,1) PRIMARY KEY,   -- Số thứ tự lượt khám (duy nhất toàn hệ thống)
    
    -- I. Hành chính
    MaBenhNhan VARCHAR(20) NOT NULL,    -- Mã bệnh nhân (Duy nhất cho 1 người)
    HoTen NVARCHAR(100) NOT NULL,
    NgaySinh DATE,
    GioiTinh NVARCHAR(10),
    CCCD VARCHAR(20) NOT NULL,
    DiaChi NVARCHAR(255),
    SDT VARCHAR(20),
    NgheNghiep NVARCHAR(100),
    MaBHYT VARCHAR(25),
    LienHeKhanCap NVARCHAR(255),

    -- II. Tiền sử
    TienSuBanThan NVARCHAR(MAX),
    TienSuGiaDinh NVARCHAR(MAX),

    -- III. Chẩn đoán Đông Y (Theo từng lần khám)
    TrieuChung NVARCHAR(MAX),          -- Tứ chẩn chi tiết
    BenhDanh NVARCHAR(255),            -- Ví dụ: Đầu thống, Vị quản thống...
    ChungDanh NVARCHAR(255),           -- Ví dụ: Can khí uất kết, Tỳ vị hư hàn...

    -- IV. Điều trị
    BaiThuoc NVARCHAR(MAX),            -- Thành phần bài thuốc
    ChamCuuXoaBop NVARCHAR(MAX),       -- Phương pháp bổ trợ
    CheDoAnUongSinhHoat NVARCHAR(MAX),

    -- V. Theo dõi
    LoiDanBacSi NVARCHAR(MAX),
    NgayKham DATETIME DEFAULT GETDATE()
);
GO

-- 3. CHÈN 100 BẢN GHI VỚI TÊN KHÁC NHAU VÀ LOGIC KHÁM NHIỀU LẦN
DECLARE @i INT = 1;
DECLARE @BN_Count INT = 1;

-- Bảng chứa Họ
CREATE TABLE #Ho (H NVARCHAR(20));
INSERT INTO #Ho VALUES (N'Nguyễn'), (N'Trần'), (N'Lê'), (N'Phạm'), (N'Hoàng'), (N'Phan'), (N'Vũ'), (N'Đặng'), (N'Bùi'), (N'Đỗ'), (N'Hồ'), (N'Ngô');
-- Bảng chứa Tên Đệm
CREATE TABLE #Dem (D NVARCHAR(20));
INSERT INTO #Dem VALUES (N'Văn'), (N'Thị'), (N'Minh'), (N'Đức'), (N'Thành'), (N'Hồng'), (N'Khánh'), (N'Ngọc'), (N'Bảo'), (N'Quốc');
-- Bảng chứa Tên
CREATE TABLE #Ten (T NVARCHAR(20));
INSERT INTO #Ten VALUES (N'An'), (N'Bình'), (N'Cường'), (N'Dũng'), (N'Em'), (N'Giang'), (N'Hương'), (N'Khanh'), (N'Lan'), (N'Minh'), (N'Nam'), (N'Oanh'), (N'Phúc'), (N'Quang'), (N'Sơn'), (N'Tùng'), (N'Uyên'), (N'Vinh'), (N'Xuân'), (N'Yến');

-- Bảng chứa mẫu bệnh lý chuẩn Đông Y
CREATE TABLE #Samples (
    BD NVARCHAR(100), CD NVARCHAR(100), TC NVARCHAR(MAX), BT NVARCHAR(MAX)
);
INSERT INTO #Samples VALUES 
(N'Chứng Tý (Đau xương khớp)', N'Phong hàn thấp tý', N'Vọng: Sắc mặt nhợt. Văn: Tiếng thở nhỏ. Vấn: Đau khớp cố định, sợ lạnh. Thiết: Mạch nhu hoãn.', N'Độc hoạt ký sinh thang gia giảm: Độc hoạt 12g, Phòng phong 10g...'),
(N'Thất miên (Mất ngủ)', N'Tâm tỳ lưỡng hư', N'Vọng: Lưỡi nhợt bệu. Vấn: Khó ngủ, ngủ mơ, hay quên, hồi hộp. Thiết: Mạch tế nhược.', N'Quy tỳ thang: Đảng sâm 12g, Bạch truật 12g, Toan táo nhân 15g...'),
(N'Vị quản thống (Dạ dày)', N'Tỳ vị hư hàn', N'Vấn: Đau bụng âm ỉ, thích xoa ấm, nôn ra nước trong. Thiết: Mạch trầm trì.', N'Lý trung thang: Đảng sâm 12g, Can khương 8g, Bạch truật 12g...'),
(N'Đầu thống (Đau đầu)', N'Can dương thượng cang', N'Vọng: Mặt đỏ, mắt đỏ. Vấn: Đau căng đầu, hay cáu gắt, tai ù. Thiết: Mạch huyền sác.', N'Thiên ma câu đằng ẩm: Câu đằng 15g, Thiên ma 10g...'),
(N'Huyết áp cao', N'Can hỏa thượng viêm', N'Vọng: Chất lưỡi đỏ. Vấn: Nhức đầu, chóng mặt, táo bón, nước tiểu vàng. Thiết: Mạch huyền.', N'Long đởm tả can thang gia giảm.');

WHILE @i <= 100
BEGIN
    -- 1. Tạo 1 bệnh nhân mới với các thông tin cá nhân duy nhất
    DECLARE @HoTen NVARCHAR(100) = (SELECT TOP 1 H FROM #Ho ORDER BY NEWID()) + ' ' + (SELECT TOP 1 D FROM #Dem ORDER BY NEWID()) + ' ' + (SELECT TOP 1 T FROM #Ten ORDER BY NEWID());
    DECLARE @MaBN VARCHAR(20) = 'BN-' + RIGHT('0000' + CAST(@BN_Count AS VARCHAR(5)), 5);
    DECLARE @CCCD VARCHAR(20) = '0' + CAST(CAST(ABS(CHECKSUM(NEWID())) % 100000000000 AS BIGINT) + 100000000000 AS VARCHAR(20));
    DECLARE @SDT VARCHAR(20) = '09' + CAST(CAST(ABS(CHECKSUM(NEWID())) % 90000000 AS BIGINT) + 10000000 AS VARCHAR(10));
    DECLARE @Nghe NVARCHAR(100) = (SELECT TOP 1 N FROM (VALUES (N'Giáo viên'), (N'Văn phòng'), (N'Lao động tự do'), (N'Hưu trí'), (N'Kinh doanh')) AS T(N) ORDER BY NEWID());

    -- 2. Cho bệnh nhân này đi khám từ 1 đến 3 lần
    DECLARE @v INT = 1;
    DECLARE @MaxV INT = (ABS(CHECKSUM(NEWID())) % 3) + 1;

    WHILE @v <= @MaxV AND @i <= 100
    BEGIN
        DECLARE @BD NVARCHAR(100), @CD NVARCHAR(100), @TC NVARCHAR(MAX), @BT NVARCHAR(MAX);
        SELECT TOP 1 @BD=BD, @CD=CD, @TC=TC, @BT=BT FROM #Samples ORDER BY NEWID();

        INSERT INTO HoSoKhamBenh (
            MaBenhNhan, HoTen, NgaySinh, GioiTinh, CCCD, DiaChi, SDT, NgheNghiep, MaBHYT, LienHeKhanCap,
            TienSuBanThan, TienSuGiaDinh, TrieuChung, BenhDanh, ChungDanh, BaiThuoc, ChamCuuXoaBop, CheDoAnUongSinhHoat,
            LoiDanBacSi, NgayKham
        )
        VALUES (
            @MaBN, @HoTen, DATEADD(DAY, - (ABS(CHECKSUM(NEWID())) % 15000 + 7000), GETDATE()), 
            CASE WHEN @HoTen LIKE N'%Thị%' THEN N'Nữ' ELSE N'Nam' END,
            @CCCD, N'Hà Nội', @SDT, @Nghe, 'BHYT-' + LEFT(@CCCD, 8), N'Người thân - ' + @SDT,
            N'Tiền sử: Khỏe mạnh. Dị ứng: Không.', N'Gia đình: Không có bệnh di truyền.',
            @TC + CASE WHEN @v > 1 THEN N' (Tái khám: Triệu chứng đã giảm nhiều)' ELSE '' END,
            @BD, @CD, @BT, N'Châm cứu huyệt đạo tương ứng.', N'Ăn ấm, uống sôi, tránh đồ sống lạnh.',
            N'Uống thuốc ngày 2 lần.', DATEADD(DAY, -((100-@i)*3), GETDATE())
        );
        SET @v = @v + 1;
        SET @i = @i + 1;
    END
    SET @BN_Count = @BN_Count + 1;
END

-- Dọn dẹp bảng tạm
DROP TABLE #Ho; DROP TABLE #Dem; DROP TABLE #Ten; DROP TABLE #Samples;
GO

-- KIỂM TRA: Xem danh sách 100 bản ghi
SELECT MaBenhNhan, HoTen, CCCD, ID as LuotKhamID, NgayKham, BenhDanh, ChungDanh 
FROM HoSoKhamBenh 
ORDER BY MaBenhNhan, NgayKham;