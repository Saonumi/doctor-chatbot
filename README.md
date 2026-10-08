# Hệ thống Quản lý Phòng khám Đông Y
### TCM Clinic Management System

Hệ thống quản lý bệnh nhân tích hợp **AI Chatbot tư vấn Y học Đông Y**, sử dụng kiến trúc **Agentic RAG** (Retrieval-Augmented Generation) với Google Gemini và SQL Server.

---

## ✨ Tính năng

- **Quản lý Bệnh nhân**: Thêm, xem, sửa, xóa hồ sơ bệnh nhân (auto-generated patient ID)
- **Lịch sử Khám bệnh**: Theo dõi đầy đủ từng lượt khám của bệnh nhân
- **AI Chatbot Đông Y**: Tư vấn y học dựa trên sách Đông Y (RAG-powered)
- **Agentic RAG**: Intent Router tự động phân loại câu hỏi → route đúng nhánh xử lý
- **Text-to-SQL**: Tra cứu bệnh nhân bằng ngôn ngữ tự nhiên
- **Pipeline Visualization**: Hiển thị realtime quy trình xử lý AI qua SSE
- **Document Management**: Upload và quản lý tài liệu PDF y học
- **Smart Search**: Tìm kiếm bệnh nhân theo tên, CCCD, triệu chứng
- **Persistent Chat**: Lưu lịch sử chat tự động với localStorage
- **Markdown Support**: Hiển thị response từ AI với format markdown
- **Tiếng Việt**: Full support tiếng Việt

---

## Tech Stack

### Backend
| Thành phần | Công nghệ |
|---|---|
| **Framework** | FastAPI |
| **Database** | SQL Server (SQLAlchemy ORM + pyodbc) |
| **LLM** | Google Gemini 2.5 Flash (hỗ trợ custom proxy) |
| **Embedding** | sentence-transformers (paraphrase-multilingual-MiniLM-L12-v2, 384d, local) |
| **Vector DB** | FAISS (IndexFlatIP, cosine similarity) |
| **PDF Reader** | PyMuPDF (fitz) |
| **Vision** | Gemini Vision (mô tả ảnh y học) |
| **Chunking** | Semantic Chunking tự viết (embedding-based) |
| **Python** | 3.11+ |

### Frontend
| Thành phần | Công nghệ |
|---|---|
| **Framework** | React 18+ với Vite |
| **Routing** | React Router v6 |
| **Styling** | Tailwind CSS |
| **Icons** | Lucide React |
| **HTTP Client** | Axios |
| **Markdown** | react-markdown + remark-gfm |

---

## Kiến trúc AI Pipeline

## Prerequisites

- **Python 3.11+**
- **Node.js 18+ và npm**
- **SQL Server** (hoặc SQL Server Express)
- **ODBC Driver 17 for SQL Server** ([Download](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server))
- **Google Gemini API Key** ([Lấy tại đây](https://aistudio.google.com/apikey)) hoặc custom Gemini proxy

---

## Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd dotor_chatbot
```

### 2. Database Setup

1. Mở SQL Server Management Studio (SSMS)
2. Tạo database mới hoặc chạy script:
   ```
   backend/storage/tcm_clinic.sql
   ```

### 3. Backend Setup

```bash
cd backend

# Tạo virtual environment
python -m venv venv

# Activate
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Tạo file .env (xem phần Environment Variables bên dưới)
```

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy tại `http://localhost:5173`

### 5. Start Backend

```bash
cd backend
python -m app.main
```

Backend API chạy tại `http://localhost:8000`

> **Lưu ý:** Lần đầu chạy, hệ thống sẽ tự động tải model embedding (~120MB) và nạp PDF từ `storage/pdfs/` vào Vector DB.

---

## ⚙️ Environment Variables

Tạo file `backend/.env`:

### Cách 1: Dùng Google API trực tiếp

```env
DATABASE_URL=mssql+pyodbc://user:password@SERVER/TCM_Clinic?driver=ODBC+Driver+17+for+SQL+Server
GOOGLE_API_KEY=AIzaSy...your_key_here
```

### Cách 2: Dùng Custom Proxy

```env
DATABASE_URL=mssql+pyodbc://user:password@SERVER/TCM_Clinic?driver=ODBC+Driver+17+for+SQL+Server
GEMINI_BASE_URL=https://your-proxy.example.com/gemini
GEMINI_API_KEY=your_proxy_key
```

> Hệ thống tự động phát hiện: nếu có `GEMINI_BASE_URL` → dùng proxy, nếu không → dùng Google API chính thức.

---

## 📁 Project Structure

```
dotor_chatbot/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app & API endpoints
│   │   ├── config.py            # Cấu hình tập trung
│   │   ├── database.py          # Database connection & session
│   │   ├── models.py            # SQLAlchemy ORM models
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── gemini_client.py     # Gemini client (proxy support)
│   │   ├── ai_service.py        # Orchestrator + SSE streaming
│   │   ├── intent_router.py     # Phân loại câu hỏi (few-shot)
│   │   ├── medical_rag.py       # RAG pipeline cho y học
│   │   ├── patient_sql.py       # Text-to-SQL cho bệnh nhân
│   │   ├── pdf_processor.py     # Semantic Chunking + Vision
│   │   ├── embedding_service.py # Local embedding model
│   │   ├── vector_store.py      # FAISS vector store
│   │   └── logger_service.py    # Structured logging
│   ├── storage/
│   │   ├── pdfs/                # PDF tài liệu y học
│   │   ├── vector_db/           # FAISS index (auto-generated)
│   │   ├── logs/                # Log files (JSON, rotate daily)
│   │   └── tcm_clinic.sql       # Database schema
│   ├── requirements.txt
│   └── .env                     # Config (không commit!)
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── ChatInterface.jsx    # Chat AI + Pipeline Graph
    │   │   ├── PipelineGraph.jsx    # Visualize AI pipeline
    │   │   ├── PatientForm.jsx      # Form thêm bệnh nhân
    │   │   ├── PatientList.jsx      # Danh sách + Sửa/Xóa
    │   │   ├── PDFUpload.jsx        # Upload tài liệu PDF
    │   │   └── Sidebar.jsx          # Navigation sidebar
    │   ├── services/
    │   │   └── api.js               # API client functions
    │   ├── App.jsx
    │   └── main.jsx
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.js
```

---

## 📖 Hướng dẫn sử dụng

### 1. Quản lý Bệnh nhân

**Thêm bệnh nhân mới:**
1. Click menu **Khám mới** (sidebar trái)
2. Mã bệnh nhân tự động load (VD: BN00050)
3. Điền đầy đủ thông tin (tất cả các ô đều bắt buộc)
4. Click **Lưu Hồ sơ**

**Xem / Sửa / Xóa:**
1. Click menu **Bệnh nhân**
2. Mỗi bệnh nhân hiển thị 1 dòng với thông tin mới nhất
3. Click 👁️ **Chi tiết** để xem lịch sử khám
4. Click ✏️ **Sửa** để chỉnh sửa thông tin
5. Click 🗑️ **Xóa** để xóa bệnh nhân (có xác nhận)

**Tìm kiếm:**
- Nhập từ khóa vào ô search (tên, CCCD, triệu chứng)
- Hệ thống tìm kiếm trong tất cả lịch sử khám

### 2. Sử dụng AI Chatbot

**Hỏi chatbot:**
1. Click menu **Tư vấn AI**
2. Nhập câu hỏi → Enter hoặc click gửi
3. Theo dõi **Pipeline Graph** bên phải (hiển thị realtime từng bước xử lý)

**Ví dụ câu hỏi:**
- 🏥 Y học: *"Cách chữa đau đầu theo Đông Y?"*, *"Bài thuốc Quy tỳ thang gồm gì?"*
- 👤 Bệnh nhân: *"Bệnh nhân Nguyễn Văn A?"*, *"Ai bị chứng Tý?"*
- 💬 Chung: *"Xin chào"*, *"Bạn là ai?"*

**Xóa lịch sử:** Click icon 🗑️ góc phải để reset chat

### 3. Upload Tài liệu

1. Click menu **Tài liệu**
2. Chọn file PDF (sách Y học Đông Y)
3. Click **Upload** → đợi hệ thống xử lý
4. Chatbot sẽ tự động học từ tài liệu mới

> **Lưu ý:** Khi backend khởi động, nếu chưa có Vector DB, hệ thống tự động nạp tất cả PDF từ `storage/pdfs/`.

---

## 📊 Logging

Log được ghi ở **2 nơi**:

| Đầu ra | Đường dẫn | Format |
|---|---|---|
| Console | Terminal | `HH:MM:SS │ INFO │ 🔀 Router: ...` |
| File | `storage/logs/ai_pipeline.log` | JSON structured, rotate 30 ngày |

Các loại log: Intent Router, FAISS Retrieval, LLM Call, Text-to-SQL, PDF Processing, Errors.

---

## 🔧 Troubleshooting

| Lỗi | Giải pháp |
|---|---|
| `DATABASE_URL not found` | Kiểm tra file `.env` trong `backend/` |
| `Cannot connect to SQL Server` | Verify connection string, ODBC Driver 17 |
| `413 Request Entity Too Large` | Proxy nginx limit — ảnh PDF đã tự resize (800px) |
| `Vector store not found` | Đặt PDF vào `storage/pdfs/` → restart backend |
| `Module not found` | `venv\Scripts\activate` → `pip install -r requirements.txt` |
| Frontend không connect | Backend phải chạy port 8000, check `vite.config.js` proxy |

---

## ⚠️ Limitations & Future Work

### Limitations
- **Bảo mật dữ liệu bệnh nhân**: Thông tin bệnh nhân được gửi lên Gemini API qua cloud khi sử dụng Text-to-SQL. Chưa đạt chuẩn HIPAA cho triển khai y tế thực tế.
- **Phụ thuộc API bên ngoài**: Phụ thuộc Gemini API, có thể bị rate limit hoặc gián đoạn.
- **PDF Encoding**: Một số PDF tiếng Việt có thể gặp vấn đề encoding.

### Future Work
- Ẩn danh hóa dữ liệu bệnh nhân trước khi gửi lên LLM
- Tích hợp LLM local (Ollama) cho luồng bệnh nhân
- Authentication & Authorization
- Export báo cáo PDF
- Dashboard analytics
- Mobile app (React Native)
- Voice input cho chatbot

---

## 📄 License

©Saonumi - Đông Y Việt Nam

**Tác giả:** Nguyễn Ngọc Sáng
