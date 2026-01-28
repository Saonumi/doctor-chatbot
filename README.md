# Hệ thống Quản lý Phòng khám Đông Y - TCM Clinic Management System

Hệ thống quản lý bệnh nhân tích hợp AI chatbot tư vấn Y học Đông Y, sử dụng RAG (Retrieval-Augmented Generation) với Google Gemini và SQL Server database.

## Tính năng

- 🏥 **Quản lý Bệnh nhân**: Thêm, xem, tìm kiếm hồ sơ bệnh nhân với auto-generated patient ID
- 📋 **Lịch sử Khám bệnh**: Theo dõi đầy đủ lịch sử khám của từng bệnh nhân
- 🤖 **AI Chatbot Đông Y**: Tư vấn y học dựa trên kiến thức từ sách Đông Y (RAG-powered)
- 💬 **Persistent Chat**: Lưu lịch sử chat tự động với localStorage
- 📚 **Document Management**: Upload và quản lý tài liệu PDF y học
- 🔍 **Smart Search**: Tìm kiếm bệnh nhân theo tên, CCCD, triệu chứng từ tất cả lịch sử
- ✨ **Markdown Support**: Hiển thị response từ AI với format markdown đẹp mắt
- 🌐 **Tiếng Việt**: Full support tiếng Việt

## Tech Stack

### Backend
- **Framework**: FastAPI 0.115.x - Modern, fast Python web framework
- **Database**: SQL Server - Structured patient data storage
- **AI/ML Stack**:
  - **LangChain** - RAG pipeline orchestration
  - **Google Gemini 2.5 Flash** - Large Language Model
  - **HuggingFace Embeddings** - `paraphrase-multilingual-MiniLM-L12-v2`
  - **FAISS** - Vector store for document embeddings
- **ORM**: SQLAlchemy - Database ORM
- **Driver**: pyodbc - SQL Server connectivity
- **Python**: 3.11+

### Frontend
- **Framework**: React 18+ với Vite
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **Markdown**: react-markdown + remark-gfm

## Prerequisites

Trước khi bắt đầu, đảm bảo bạn đã cài đặt:

- **Python 3.11 hoặc cao hơn**
- **Node.js 18+ và npm**
- **SQL Server** (hoặc SQL Server Express)
- **ODBC Driver 17 for SQL Server** ([Download](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server))
- **Google Gemini API Key** ([Get it here](https://aistudio.google.com/apikey))

## Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd dotor_chatbot
```

### 2. Database Setup

1. **Tạo Database trong SQL Server**
2. **Import Schema**:
   ```bash
   # Chạy script SQL trong SQL Server Management Studio
   backend/storage/tcm_clinic.sql
   ```

### 3. Backend Setup

```bash
cd backend

# Tạo virtual environment
python -m venv venv

# Activate virtual environment
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Tạo file .env
copy .env.example .env  # Windows
# cp .env.example .env  # Linux/Mac

# Cập nhật .env với database connection và API key (xem phần Environment Variables)
```

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend sẽ chạy tại `http://localhost:5173`

### 5. Ingest PDF Documents (Optional)

Để chatbot học từ sách y học:

```bash
cd backend

# Đặt PDF files vào backend/storage/pdfs/
# Sau đó chạy:
python load_pdfs.py
```

### 6. Start Backend Server

```bash
cd backend
python -m app.main
```

Backend API sẽ chạy tại `http://localhost:8000`

### 7. Access Application

Mở browser và truy cập `http://localhost:5173`

## Environment Variables

Tạo file `backend/.env` với các biến sau:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_API_KEY` | Google Gemini API key | `AIzaSy...` |
| `DATABASE_URL` | SQL Server connection string | `mssql+pyodbc://sa:password@localhost/tcm_clinic?driver=ODBC+Driver+17+for+SQL+Server` |

### SQL Server Connection String Format

```
mssql+pyodbc://username:password@server:port/database?driver=ODBC+Driver+17+for+SQL+Server
```

**Ví dụ:**
- Local SQL Server: `mssql+pyodbc://sa:YourPassword@localhost:1433/tcm_clinic?driver=ODBC+Driver+17+for+SQL+Server`
- Remote SQL Server: `mssql+pyodbc://user:pass@192.168.1.100:1433/clinic_db?driver=ODBC+Driver+17+for+SQL+Server`

**Lưu ý:** Nếu password chứa ký tự đặc biệt, cần URL encode (ví dụ: `@` → `%40`, `#` → `%23`)

### Example .env File

```env
# Google Gemini API
GOOGLE_API_KEY=AIzaSyA...your_key_here

# SQL Server Database
DATABASE_URL=mssql+pyodbc://sa:YourPassword@localhost:1433/tcm_clinic?driver=ODBC+Driver+17+for+SQL+Server
```

## Project Structure

```
dotor_chatbot/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI application & API endpoints
│   │   ├── config.py            # Configuration management
│   │   ├── database.py          # Database connection & session
│   │   ├── models.py            # SQLAlchemy ORM models
│   │   ├── schemas.py           # Pydantic schemas (request/response)
│   │   └── rag_service.py       # RAG service với LangChain
│   ├── storage/
│   │   ├── pdfs/                # PDF documents cho RAG
│   │   ├── vector_db/           # FAISS vector store (auto-generated)
│   │   └── tcm_clinic.sql       # Database schema
│   ├── load_pdfs.py             # Script để ingest PDFs vào vector DB
│   ├── requirements.txt         # Python dependencies
│   └── .env                     # Environment variables (không commit!)
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── ChatInterface.jsx    # AI chat interface
    │   │   ├── PatientForm.jsx      # Form thêm bệnh nhân
    │   │   ├── PatientList.jsx      # Danh sách & tìm kiếm bệnh nhân
    │   │   ├── PDFUpload.jsx        # Upload tài liệu PDF
    │   │   └── Sidebar.jsx          # Navigation sidebar
    │   ├── services/
    │   │   └── api.js               # API client functions
    │   ├── App.jsx                  # Root component
    │   └── main.jsx                 # Entry point
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.js
```

## API Documentation

### Patient Management

#### GET /api/next-patient-id

Lấy mã bệnh nhân tiếp theo (auto-increment).

**Response:**
```json
{
  "next_patient_id": "BN00050"
}
```

#### GET /api/records

Lấy danh sách bệnh nhân (unique, latest visit only).

**Query Parameters:**
- `skip` (optional): Number of records to skip (default: 0)
- `limit` (optional): Max records to return (default: 100)

**Response:**
```json
[
  {
    "ID": 1,
    "MaBenhNhan": "BN00049",
    "HoTen": "Nguyễn Văn A",
    "CCCD": "001234567890",
    "NgayKham": "2026-01-28",
    "TrieuChung": "Đau đầu, chóng mặt",
    "ChanDoan": "Huyết áp cao",
    "LanKham": 3
  }
]
```

#### GET /api/history/{cccd}

Lấy lịch sử khám đầy đủ của bệnh nhân theo CCCD.

**Response:**
```json
[
  {
    "ID": 3,
    "LanKham": 3,
    "NgayKham": "2026-01-28",
    ...
  },
  {
    "ID": 2,
    "LanKham": 2,
    "NgayKham": "2026-01-15",
    ...
  }
]
```

#### GET /api/search

Tìm kiếm bệnh nhân.

**Query Parameters:**
- `q` (required): Search query

**Response:** Giống `/api/records`

#### POST /api/diagnose

Thêm/cập nhật hồ sơ khám bệnh.

**Request Body:**
```json
{
  "MaBenhNhan": "BN00050",
  "HoTen": "Nguyễn Văn B",
  "NgaySinh": "1990-01-01",
  "GioiTinh": "Nam",
  "CCCD": "001234567891",
  "DiaChi": "Hà Nội",
  "SDT": "0909123456",
  "TrieuChung": "Ho, sốt",
  "ChanDoan": "Cảm cúm",
  "PhuongPhapDieuTri": "Uống thuốc Đông Y",
  "DonThuoc": "Bài Ngũ hổ thang",
  "LoiDanBacSi": "Kiêng gió lạnh"
}
```

**Response:**
```json
{
  "ID": 10,
  "MaBenhNhan": "BN00050",
  "LanKham": 1,
  ...
}
```

### AI Chatbot

#### POST /api/chat

Chat với AI Đông Y.

**Request Body:**
```json
{
  "question": "Chữa ho như thế nào?"
}
```

**Response:**
```json
{
  "answer": "Dựa trên y học cổ truyền, ho có thể điều trị bằng...",
  "sources": ["16_GT Y SY_ Y Hoc Co Truyen.pdf"],
  "status": "success"
}
```

### Document Management

#### POST /api/upload

Upload PDF document.

**Request:**
- Content-Type: `multipart/form-data`
- Field: `file` (PDF file)

**Response:**
```json
{
  "filename": "BeenhDocDTDY.pdf",
  "status": "Thành công",
  "message": "Đã học xong tài liệu. Chia thành 250 đoạn kiến thức."
}
```

## Usage Guide

### 1. Quản lý Bệnh nhân

**Thêm bệnh nhân mới:**
1. Click menu **Khám mới**
2. Mã bệnh nhân sẽ tự động load (VD: BN00050)
3. Điền thông tin bệnh nhân
4. Nhập triệu chứng, chẩn đoán
5. Click **Lưu Hồ sơ**

**Xem danh sách:**
1. Click menu **Bệnh nhân**
2. Mỗi bệnh nhân hiển thị 1 dòng với thông tin mới nhất
3. Click **Chi tiết** (icon mắt) để xem toàn bộ lịch sử

**Tìm kiếm:**
1. Nhập từ khóa vào ô search (tên, CCCD, triệu chứng)
2. Hệ thống tìm kiếm trong TẤT CẢ lịch sử khám
3. Hiển thị bệnh nhân khớp với thông tin mới nhất

### 2. Sử dụng AI Chatbot

**Hỏi chatbot:**
1. Click menu **Tư vấn AI**
2. Nhập câu hỏi về Y học Đông Y
3. AI sẽ trả lời dựa trên sách đã học

**Ví dụ câu hỏi:**
- "Cách chữa đau đầu theo Đông Y?"
- "Bài thuốc điều trị ho?"
- "Huyệt vị châm cứu chữa mất ngủ?"

**Xóa lịch sử:**
- Click icon **thùng rác** (góc phải) để reset chat

**Lưu ý:**
- Lịch sử chat được lưu tự động
- Chuyển tab không mất lịch sử
- Chỉ xóa khi click nút reset

### 3. Upload Tài liệu

1. Click menu **Tài liệu**
2. Chọn file PDF (sách Y học Đông Y)
3. Click **Upload**
4. Đợi hệ thống xử lý (có thể mất vài phút)
5. Chatbot sẽ học từ tài liệu mới

## Development

### Running Backend in Development

```bash
cd backend
python -m app.main
```

Server auto-reload khi code thay đổi (uvicorn reload mode).

### Running Frontend in Development

```bash
cd frontend
npm run dev
```

Vite dev server với Hot Module Replacement (HMR).

### Code Quality

**Backend:**
```bash
# Format code
black app/

# Lint
flake8 app/

# Type check
mypy app/
```

**Frontend:**
```bash
# Lint
npm run lint

# Format
npm run format
```

## Troubleshooting

### Common Issues

**1. "DATABASE_URL not found"**
- Kiểm tra file `.env` tồn tại trong `backend/`
- Verify `DATABASE_URL` đã được set
- Restart backend server

**2. "Cannot connect to SQL Server"**
- Kiểm tra SQL Server đang chạy
- Test connection với SSMS
- Verify connection string format
- Đảm bảo ODBC Driver 17 đã cài

**3. "GOOGLE_API_KEY invalid"**
- Kiểm tra API key tại [Google AI Studio](https://aistudio.google.com/apikey)
- Đảm bảo key chưa hết quota
- Thử tạo key mới

**4. "Vector store not found" / Chatbot không trả lời**
- Chạy: `python load_pdfs.py`
- Đảm bảo có PDF trong `storage/pdfs/`
- Kiểm tra logs khi load PDFs

**5. "Module not found" errors**
- Activate venv: `venv\Scripts\activate`
- Reinstall: `pip install -r requirements.txt`

**6. Frontend không connect backend**
- Kiểm tra backend chạy tại port 8000
- Verify `vite.config.js` proxy settings
- Check browser console for CORS errors

**7. Chat history bị mất khi chuyển tab**
- Đã fix - nếu vẫn gặp, clear browser cache
- Kiểm tra localStorage trong DevTools

**8. Mã bệnh nhân không tự động**
- Restart backend server
- Check endpoint `/api/next-patient-id`
- Verify database connection

### Performance Issues

**Chatbot response chậm:**
- Giảm số documents retrieval (hiện tại: k=5)
- Sử dụng PDF nhẹ hơn
- Kiểm tra Gemini API quota

**Database query chậm:**
- Thêm indexes vào bảng `HoSoKhamBenh`
- Optimize search queries
- Giảm `limit` trong `/api/records`

### Debug Mode

**Enable backend logging:**

```python
# app/main.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Check RAG retrieval:**

```python
# Test với script:
python -c "from app.rag_service import RAGService; rag = RAGService(); print(rag.chat('đau đầu'))"
```

## Production Deployment

### Security Checklist

- [ ] Thay đổi database password mạnh
- [ ] Sử dụng HTTPS
- [ ] Enable CORS restrictions trong FastAPI
- [ ] Không commit file `.env`
- [ ] Set proper file permissions cho `.env`
- [ ] Use environment variables, không hardcode secrets
- [ ] Enable rate limiting
- [ ] Validate tất cả user inputs
- [ ] Regular security updates: `pip install --upgrade`

### Deployment Steps

**Backend:**
1. Set production database connection
2. Disable debug mode
3. Use production ASGI server (Gunicorn + Uvicorn)
4. Set up reverse proxy (Nginx)
5. Configure SSL certificates

**Frontend:**
1. Build production bundle: `npm run build`
2. Serve từ `dist/` folder
3. Configure proper API endpoints
4. Enable compression
5. Set up CDN (optional)

### Monitoring

- Monitor API response times
- Track database query performance
- Monitor Gemini API usage & quota
- Log all errors với proper stack traces
- Set up health check endpoints

## Known Issues & Limitations

- **PDF Encoding**: Một số PDF tiếng Việt có thể có vấn đề encoding
- **Gemini Quota**: Free tier có giới hạn requests/minute
- **Vector Search**: Accuracy phụ thuộc vào chất lượng PDF
- **Browser Compatibility**: Cần browser hỗ trợ localStorage

## Roadmap

- [ ] Thêm authentication & authorization
- [ ] Export báo cáo PDF
- [ ] Dashboard analytics
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Voice input cho chatbot
- [ ] Appointment scheduling
- [ ] Payment integration

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License

©Saonumi - Đông Y Việt Nam

## Support

Nếu gặp vấn đề, vui lòng:
1. Check phần Troubleshooting
2. Search existing issues
3. Create new issue với:
   - OS & versions
   - Error messages
   - Steps to reproduce
