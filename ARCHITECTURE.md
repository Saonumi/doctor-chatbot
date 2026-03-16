# 🏗️ Kiến trúc Hệ thống Trợ Lý Đông Y

## Tổng quan

Hệ thống **Trợ Lý Đông Y** là ứng dụng hỗ trợ lâm sàng cho bác sĩ Đông Y, tích hợp AI để tra cứu kiến thức y văn và quản lý hồ sơ bệnh nhân. Kiến trúc sử dụng mô hình **Agentic RAG** (Retrieval-Augmented Generation), kết hợp nhiều kỹ thuật AI để xử lý câu hỏi theo đúng ngữ cảnh.

### Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ ChatInterface│  │ PatientForm  │  │ PDFUpload             │  │
│  │ + Pipeline   │  │ + PatientList│  │ (Upload tài liệu PDF) │  │
│  │   Graph      │  │ (CRUD)       │  │                       │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘  │
│         │ SSE              │ REST                 │ REST        │
└─────────┼──────────────────┼─────────────────────┼──────────────┘
          │                  │                     │
          ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI + Python)                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    AI SERVICE (Orchestrator)                │  │
│  │  - Nhận câu hỏi → Intent Router → Route đúng pipeline      │  │
│  │  - SSE streaming real-time → Frontend Pipeline Graph        │  │
│  └────────────┬──────────────┬──────────────┬─────────────────┘  │
│               │              │              │                    │
│        ┌──────▼──────┐ ┌────▼────┐  ┌──────▼──────┐            │
│        │ Medical RAG │ │Text2SQL │  │ General Chat│            │
│        │ (Y học)     │ │(B.nhân) │  │ (Chung)    │            │
│        └──────┬──────┘ └────┬────┘  └──────┬──────┘            │
│               │              │              │                    │
│        ┌──────▼──────┐ ┌────▼──────┐  ┌────▼────┐              │
│        │ FAISS Index │ │ SQL Server│  │ Gemini  │              │
│        │ (Vector DB) │ │ (Database)│  │ LLM     │              │
│        └─────────────┘ └───────────┘  └─────────┘              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     PDF PROCESSOR                          │  │
│  │  PDF → PyMuPDF → OCR (EasyOCR) → Semantic Chunking → FAISS│  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1. Intent Router — Phân loại câu hỏi

**File**: `intent_router.py`

### Kỹ thuật
- **LLM Classification**: Gọi Gemini LLM với **few-shot prompting** (`temperature=0.0`, `max_output_tokens=10`) để phân loại câu hỏi thành 1 trong 3 intent.
- **Keyword Fallback**: Khi LLM trả rỗng hoặc lỗi → sử dụng **keyword matching** đơn giản làm backup.

### Pipeline

```
Câu hỏi user
    │
    ▼
┌──────────────────────────┐
│ Gemini LLM (temp=0.0)    │ ← Few-shot prompt:
│ max_output_tokens=10     │   "Chữa đau đầu" → MEDICAL
│                          │   "Bệnh nhân Nguyễn Văn A" → PATIENT
└──────────┬───────────────┘   "Xin chào" → GENERAL
           │
           ▼
    ┌──────┴──────┐
    │ Normalize   │ → Chỉ nhận: MEDICAL | PATIENT | GENERAL
    └──────┬──────┘
           │ (nếu rỗng/lỗi)
           ▼
    ┌──────────────┐
    │ Keyword      │ → Danh sách keyword tiếng Việt
    │ Fallback     │   medical: đau, bệnh, thuốc, châm cứu...
    └──────────────┘   patient: bệnh nhân, hồ sơ, CCCD...
```

### Output
- `"MEDICAL"` → Route đến Medical RAG
- `"PATIENT"` → Route đến Text-to-SQL
- `"GENERAL"` → Route đến General Chat (Gemini trực tiếp)

---

## 2. PDF Processing Pipeline — Xử lý tài liệu y văn

**File**: `pdf_processor.py`

### Kỹ thuật
1. **PyMuPDF (fitz)** — Đọc PDF, trích text + render ảnh
2. **EasyOCR** — OCR cho PDF scan (ảnh chụp sách), hỗ trợ tiếng Việt + Anh
3. **Semantic Chunking** — Cắt text theo nghĩa bằng embedding similarity
4. *(Tùy chọn)* **Gemini Vision** — Mô tả ảnh y học bằng LLM

### Pipeline chi tiết

```
PDF File
  │
  ▼
┌──────────────────────────────┐
│ PyMuPDF (fitz)               │
│ doc = fitz.open(file_path)   │
│ Đọc từng trang: page.get_text("text")
└──────────┬───────────────────┘
           │
     ┌─────┴─────┐
     │            │
  Có text      Trống (PDF scan)
     │            │
     ▼            ▼
  ┌─────┐   ┌──────────────────────┐
  │Text │   │ EasyOCR              │
  │     │   │ - Render trang 300DPI│
  │     │   │ - Reader(['vi','en'])│
  │     │   │ - readtext(img)      │
  └──┬──┘   └──────────┬───────────┘
     │                 │
     └────────┬────────┘
              ▼
     ┌────────────────────────┐
     │ TÁCH CÂU               │
     │ Regex: [.!?\n]          │
     │ Lọc: len(câu) > 5       │
     └────────┬───────────────┘
              ▼
     ┌────────────────────────────────┐
     │ EMBED TỪNG CÂU                 │
     │ Model: MiniLM-L12-v2 (local)   │
     │ Output: vector 384 dimensions   │
     └────────┬───────────────────────┘
              ▼
     ┌────────────────────────────────┐
     │ COSINE SIMILARITY              │
     │ So sánh embedding câu i và i+1 │
     │ similarity[i] = cos(emb[i], emb[i+1])
     └────────┬───────────────────────┘
              ▼
     ┌────────────────────────────────┐
     │ CẮT CHUNK                      │
     │ if similarity < 0.5 → CẮT ✂️   │
     │ Constraints:                    │
     │   - Max 1500 chars/chunk        │
     │   - Min 100 chars/chunk         │
     │   - Chunk quá ngắn → merge      │
     └────────┬───────────────────────┘
              ▼
     ┌────────────────────────────────┐
     │ OUTPUT: List[dict]              │
     │ {                               │
     │   "content": "Đau đầu do...",   │
     │   "source": "sach_dong_y.pdf",  │
     │   "page": 42,                   │
     │   "type": "text"                │
     │ }                               │
     └────────────────────────────────┘
```

### Semantic Chunking vs Fixed-size Chunking

| Tiêu chí | Fixed-size (500 chars) | Semantic Chunking (hệ thống này) |
|---|---|---|
| Cách cắt | Cứ mỗi 500 ký tự cắt 1 lần | Cắt khi nghĩa thay đổi (cosine < 0.5) |
| Ưu điểm | Đơn giản | Giữ nguyên ngữ cảnh, chunk có nghĩa |
| Nhược điểm | Cắt giữa câu, mất ngữ cảnh | Chậm hơn (phải embed từng câu) |
| Ví dụ | "...Quy tỳ thang gồm Đảng‖sâm 12g, Bạch truật..." | "Quy tỳ thang gồm Đảng sâm 12g, Bạch truật 12g, Hoàng kỳ 12g..." (trọn vẹn) |

### EasyOCR

| Thông số | Giá trị |
|---|---|
| **Thư viện** | `easyocr` (pip install) |
| **Ngôn ngữ** | Vietnamese (`vi`) + English (`en`) |
| **Backend** | PyTorch (CPU mode, `gpu=False`) |
| **Render DPI** | 300 DPI (tối ưu cho OCR) |
| **Model size** | ~100MB (tải lần đầu, cache sau) |
| **Chế độ** | `paragraph=True` (gom text thành đoạn) |

---

## 3. Embedding & Vector Store — Lưu trữ và tìm kiếm

### Embedding Service

**File**: `embedding_service.py`

| Thông số | Giá trị |
|---|---|
| **Model** | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| **Dimensions** | 384 |
| **Đa ngôn ngữ** | Hỗ trợ 50+ ngôn ngữ, bao gồm tiếng Việt |
| **Chạy trên** | CPU (local, miễn phí, không rate limit) |
| **Pattern** | Singleton — model chỉ load 1 lần vào RAM |
| **Batch encode** | `model.encode(texts, batch_size=32, normalize_embeddings=True)` |

### Vector Store (FAISS)

**File**: `vector_store.py`

| Thông số | Giá trị |
|---|---|
| **Engine** | Facebook FAISS (`faiss-cpu`) |
| **Index type** | `IndexFlatIP` (Inner Product ≈ Cosine Similarity khi vectors đã normalize) |
| **Retrieval** | Top-K = 5 (trả về 5 chunks gần nhất) |
| **Metadata** | Lưu song song bằng `pickle` (FAISS chỉ lưu vector) |
| **Persistence** | `tcm_index.index` + `tcm_index.meta` trong `storage/vector_db/` |

### Pipeline tìm kiếm

```
Query: "Đau đầu do phong hàn"
         │
         ▼
┌──────────────────────────┐
│ Embed query              │ → vector 384d
│ MiniLM-L12-v2            │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ FAISS IndexFlatIP.search │
│ - So sánh với tất cả     │
│   vectors trong index    │
│ - Trả top-5 gần nhất     │
│ - Score: cosine similarity│
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Top-5 results:           │
│ ┌─────────────────────┐  │
│ │ score=0.82 page=42  │  │
│ │ "Đau đầu do phong   │  │
│ │  hàn, triệu chứng..."│ │
│ └─────────────────────┘  │
│ ┌─────────────────────┐  │
│ │ score=0.76 page=15  │  │
│ │ "Phong hàn xâm nhập │  │
│ │  kinh Thái dương..." │  │
│ └─────────────────────┘  │
│ ... (3 kết quả nữa)     │
└──────────────────────────┘
```

---

## 4. Medical RAG — Tra cứu y văn

**File**: `medical_rag.py`

### Kỹ thuật
- **Retrieval-Augmented Generation (RAG)**: Kết hợp tìm kiếm vector + LLM sinh câu trả lời
- **Grounded Generation**: Prompt buộc LLM chỉ dùng thông tin từ tài liệu, không bịa
- **Inline Citations**: LLM bắt buộc ghi [1], [2], [3] sau mỗi thông tin

### Pipeline

```
Câu hỏi bác sĩ: "Bệnh nhân đau đầu, sợ lạnh, mạch phù khẩn"
         │
         ▼
┌───────────────────────────┐
│ BƯỚC 1: RETRIEVAL         │
│ - Embed câu hỏi (MiniLM)  │
│ - FAISS search top-5       │
│ - Trả về 5 chunks + scores │
└──────────┬────────────────┘
           │
           ▼
┌───────────────────────────┐
│ BƯỚC 2: BUILD CONTEXT     │
│ [Nguồn 1 - sach.pdf tr.42]│
│ "Đau đầu do phong hàn..." │
│                            │
│ [Nguồn 2 - sach.pdf tr.15]│
│ "Phong hàn xâm nhập..."   │
│ ... (5 nguồn)             │
└──────────┬────────────────┘
           │
           ▼
┌───────────────────────────────────────────┐
│ BƯỚC 3: GEMINI LLM                        │
│ Model: gemini-2.5-flash (temperature=0.3) │
│                                            │
│ System Prompt:                             │
│ "BẠN LÀ HỆ THỐNG TRA CỨU TÀI LIỆU      │
│  Y HỌC ĐÔNG Y cho bác sĩ.                │
│  CHỈ trả lời dựa trên tài liệu.          │
│  KHÔNG ĐƯỢC bịa.                          │
│  LUÔN ghi trích dẫn [1], [2], [3]."       │
│                                            │
│ + Context (5 chunks) + Chat History        │
└──────────┬────────────────────────────────┘
           │
           ▼
┌───────────────────────────────────────────┐
│ BƯỚC 4: OUTPUT                             │
│ {                                          │
│   "answer": "Đau đầu do phong hàn [1],   │
│              triệu chứng: sợ lạnh... [2]" │
│   "citations": [                           │
│     {id:1, source:"sach.pdf", page:42,    │
│      snippet:"Đau đầu do phong hàn..."},  │
│     {id:2, source:"sach.pdf", page:15,    │
│      snippet:"Phong hàn xâm nhập..."}     │
│   ],                                      │
│   "sources": ["sach.pdf"],                 │
│   "chunks_found": 5,                      │
│   "scores": [0.82, 0.76, 0.71, 0.65, 0.58]│
│ }                                          │
└────────────────────────────────────────────┘
```

### Trích dẫn nguồn (Citations)

Mỗi citation gồm:
| Field | Mô tả |
|---|---|
| `id` | Số thứ tự [1], [2]... |
| `source` | Tên file PDF gốc |
| `page` | Số trang trong PDF |
| `snippet` | 200 ký tự đầu của chunk |
| `score` | Cosine similarity score |

Frontend hiển thị: badge số + tên file + trang + snippet. **Click vào → mở PDF đúng trang** (qua StaticFiles endpoint).

---

## 5. Text-to-SQL — Tra cứu bệnh nhân

**File**: `patient_sql.py`

### Kỹ thuật
- **Text-to-SQL**: LLM sinh SELECT query từ câu hỏi tự nhiên tiếng Việt
- **SQL Validation**: Chỉ cho phép SELECT, chặn mọi mutation (UPDATE/DELETE/INSERT/DROP)
- **Result Formatting**: LLM format kết quả SQL thành câu trả lời tự nhiên

### Pipeline

```
Câu hỏi: "Bệnh nhân Nguyễn Văn A bị bệnh gì?"
         │
         ▼
┌────────────────────────────────┐
│ BƯỚC 1: SINH SQL               │
│ Gemini LLM + Database Schema   │
│                                 │
│ Prompt: Schema 2 bảng          │
│   BenhNhan (14 cột)            │
│   LuotKham (11 cột)            │
│ + Câu hỏi tiếng Việt           │
│                                 │
│ Output: "SELECT bn.HoTen,      │
│   lk.BenhDanh, lk.TrieuChung   │
│   FROM BenhNhan bn              │
│   JOIN LuotKham lk ON ..."      │
└──────────┬─────────────────────┘
           │
           ▼
┌────────────────────────────────┐
│ BƯỚC 2: VALIDATE SQL           │
│ - Regex check: chỉ cho SELECT  │
│ - Chặn: UPDATE, DELETE, INSERT │
│   DROP, ALTER, EXEC, xp_, sp_  │
│ - Thêm TOP 20 nếu chưa có     │
│ - Timeout: 5 giây              │
└──────────┬─────────────────────┘
           │
           ▼
┌────────────────────────────────┐
│ BƯỚC 3: EXECUTE                │
│ SQLAlchemy + pyodbc            │
│ → SQL Server                   │
│ Trả về: List[dict] (max 20)   │
└──────────┬─────────────────────┘
           │
           ▼
┌────────────────────────────────┐
│ BƯỚC 4: FORMAT KẾT QUẢ        │
│ Gemini LLM format bảng → text  │
│ "Bệnh nhân Nguyễn Văn A có   │
│  2 lượt khám: ... "            │
└────────────────────────────────┘
```

### Bảo mật SQL

| Biện pháp | Chi tiết |
|---|---|
| **Whitelist** | Chỉ cho phép `SELECT` |
| **Blacklist** | Chặn: `UPDATE`, `DELETE`, `INSERT`, `DROP`, `ALTER`, `EXEC`, `xp_`, `sp_`, `;` |
| **Giới hạn kết quả** | `TOP 20` tự động thêm |
| **Timeout** | 5 giây (chống query nặng) |
| **Read-only session** | Không commit transaction |

---

## 6. Gemini Client — LLM API

**File**: `gemini_client.py`

### Kỹ thuật
- **SDK**: `google-genai` (SDK mới, thay thế `google-generativeai` deprecated)
- **Dual Mode**: Hỗ trợ cả Google API chính thức lẫn **custom proxy** (nginx reverse proxy)
- **Singleton**: Client khởi tạo 1 lần, tất cả module import từ đây

### Cấu hình

| Thông số | Giá trị |
|---|---|
| **Model** | `gemini-2.5-flash` |
| **Temperature** | 0.3 (chính xác, ít sáng tạo) |
| **Proxy** | Nếu có `GEMINI_BASE_URL` → dùng proxy, không → Google API |
| **Functions** | `generate_text(prompt, temperature, max_output_tokens)` |
| | `generate_with_image(prompt, image, model)` |

### Proxy Detection

```python
if GEMINI_BASE_URL:  # VD: https://proxy.example.com/gemini
    client = genai.Client(
        api_key=API_KEY,
        http_options=types.HttpOptions(base_url=GEMINI_BASE_URL)
    )
else:
    client = genai.Client(api_key=API_KEY)  # Google API trực tiếp
```

---

## 7. SSE Streaming — Real-time Pipeline Visualization

**File**: `ai_service.py` (backend) + `PipelineGraph.jsx` (frontend)

### Kỹ thuật
- **Server-Sent Events (SSE)**: Backend gửi từng step qua `text/event-stream`
- **React State Machine**: Frontend nhận events → update node states → render graph
- **Intent-aware Edges**: Chỉ highlight đúng path đang chạy

### SSE Events

```
data: {"step": "intent_start"}             ← Router bắt đầu
data: {"step": "intent_done", "intent": "MEDICAL"} ← Phân loại xong
data: {"step": "retrieval_start"}          ← FAISS search bắt đầu
data: {"step": "retrieval_done", "chunks": 5}  ← Tìm được 5 chunks
data: {"step": "llm_start"}               ← Gemini bắt đầu
data: {"step": "llm_done"}                ← Gemini trả xong
data: {"step": "complete", "answer": "...", "citations": [...]} ← Hoàn thành
```

### Pipeline Graph States

| State | Màu | Mô tả |
|---|---|---|
| `idle` | Xám | Chưa chạy |
| `active` | Xanh dương (pulse) | Đang chạy |
| `completed` | Xanh lá (✓) | Hoàn thành |
| `skipped` | Xám nhạt (nét đứt) | Bỏ qua (không thuộc route) |

---

## 8. Logging — Structured Logging

**File**: `logger_service.py`

### Kỹ thuật
- **Dual Output**: Console (emoji format) + File (JSON structured)
- **Log Rotation**: File tối đa 10MB, giữ 30 ngày
- **Component-based**: Mỗi log gắn `component` tag

### Log Types

| Function | Component | Ghi lại |
|---|---|---|
| `log_intent(q, intent, ms)` | intent_router | Câu hỏi → intent + thời gian |
| `log_retrieval(q, chunks, scores, ms)` | retrieval | Query → số chunks + scores |
| `log_llm_call(prompt, len, model, ms)` | llm | Model + prompt length + thời gian |
| `log_sql(q, sql, valid, rows, ms)` | text_to_sql | SQL generated + validation + rows |
| `log_pdf_processing(file, pages, chunks, ms)` | pdf_processor | File + pages + chunks |
| `log_error(component, error, ctx)` | any | Error + traceback |

---

## 9. Frontend — React + Vite

### Tech Stack

| Thành phần | Công nghệ |
|---|---|
| **Framework** | React 18 + Vite |
| **Styling** | Tailwind CSS |
| **Routing** | React Router v6 |
| **HTTP** | Axios (REST) + EventSource (SSE) |
| **Icons** | Lucide React |
| **Markdown** | react-markdown + remark-gfm |

### Components

| Component | Chức năng |
|---|---|
| `ChatInterface.jsx` | Chat + SSE streaming + Citations Panel |
| `PipelineGraph.jsx` | SVG graph animation (6 nodes, intent-aware edges) |
| `PatientForm.jsx` | Form thêm bệnh nhân (auto-gen mã BN) |
| `PatientList.jsx` | Danh sách + Sửa/Xóa + Tìm kiếm |
| `PDFUpload.jsx` | Upload tài liệu PDF y học |
| `Sidebar.jsx` | Navigation sidebar |

---

## 10. Database — SQL Server

### Schema

```
┌──────────────────────┐       ┌──────────────────────────┐
│      BenhNhan         │       │       LuotKham            │
├──────────────────────┤       ├──────────────────────────┤
│ ID (PK, auto)        │──┐    │ LuotKhamID (PK)          │
│ MaBenhNhan (computed) │  │    │ BenhNhanID (FK) ─────────┤
│ HoTen                 │  └───→│ TrieuChung               │
│ NgaySinh              │       │ BenhDanh                 │
│ GioiTinh              │       │ ChungDanh                │
│ CCCD (unique)         │       │ BaiThuoc                 │
│ DiaChi                │       │ ChamCuuXoaBop            │
│ SDT                   │       │ CheDoAnUongSinhHoat      │
│ NgheNghiep            │       │ LoiDanBacSi              │
│ MaBHYT                │       │ NgayKham                 │
│ LienHeKhanCap         │       └──────────────────────────┘
│ TienSuBanThan         │       (1 bệnh nhân → nhiều lượt khám)
│ TienSuGiaDinh         │
│ NgayTao               │
└──────────────────────┘
```

### ORM
- **SQLAlchemy** + pyodbc + ODBC Driver 17 for SQL Server
- Connection string: `mssql+pyodbc://user:pass@server/DB?driver=ODBC+Driver+17+for+SQL+Server`

---

## 11. Cấu hình tập trung

**File**: `config.py`

| Nhóm | Variable | Giá trị | Mô tả |
|---|---|---|---|
| **LLM** | GEMINI_MODEL | `gemini-2.5-flash` | Model chính |
| | GEMINI_TEMPERATURE | `0.3` | Thấp → chính xác |
| | GEMINI_BASE_URL | *(env)* | Custom proxy URL |
| **Embedding** | EMBEDDING_MODEL | `paraphrase-multilingual-MiniLM-L12-v2` | Model đa ngôn ngữ |
| | EMBEDDING_DIMENSIONS | `384` | Số chiều vector |
| **Chunking** | CHUNK_SIMILARITY_THRESHOLD | `0.5` | Ngưỡng cắt chunk |
| | CHUNK_MAX_CHARS | `1500` | Max chars/chunk |
| | CHUNK_MIN_CHARS | `100` | Min chars/chunk |
| **Retrieval** | RETRIEVAL_TOP_K | `5` | Số chunks trả về |
| **SQL** | SQL_MAX_ROWS | `20` | Giới hạn kết quả |
| | SQL_TIMEOUT_SECONDS | `5` | Timeout query |
| **Chat** | CHAT_HISTORY_MAX_TURNS | `5` | Số turn gửi cho LLM |

---

## 12. Luồng dữ liệu End-to-End

### Ví dụ: Bác sĩ hỏi "Đau đầu do phong hàn chữa thế nào?"

```
[1] Frontend: POST /api/chat {question, chat_history}
         │
[2]      ▼ SSE stream bắt đầu
    ai_service.chat_stream()
         │
[3]      ▼ event: {step: "intent_start"}
    intent_router.classify("Đau đầu do phong hàn chữa thế nào?")
    → Gemini LLM → "MEDICAL"
         │
[4]      ▼ event: {step: "intent_done", intent: "MEDICAL"}
         │ (Frontend: RAG path sáng, SQL path mờ)
         │
[5]      ▼ event: {step: "retrieval_start"}
    medical_rag.query()
    → embedding_service.embed("Đau đầu do phong hàn chữa thế nào?")
    → vector_store.search(query_vector, top_k=5)
    → FAISS IndexFlatIP.search() → 5 chunks + scores
         │
[6]      ▼ event: {step: "retrieval_done", chunks: 5}
         │
[7]      ▼ event: {step: "llm_start"}
    → Build context từ 5 chunks
    → Gemini LLM (gemini-2.5-flash, temp=0.3)
    → System prompt: "CHỈ dùng tài liệu, KHÔNG bịa, ghi trích dẫn [1][2]"
    → Response: "Đau đầu do phong hàn [1], pháp trị: Tân ôn giải biểu [2]..."
         │
[8]      ▼ event: {step: "llm_done"}
         │
[9]      ▼ event: {step: "complete", answer: "...", citations: [...]}
         │
[10] Frontend: Render markdown + CitationsPanel
     Click citation → window.open('/pdfs/sach.pdf#page=42')
```

---

## Tác giả

**Nguyễn Ngọc Sáng** — ©Saonumi
