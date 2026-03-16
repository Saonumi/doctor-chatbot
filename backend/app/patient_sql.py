"""
Patient Text-to-SQL - Tra cứu bệnh nhân bằng ngôn ngữ tự nhiên.
- Gemini sinh SELECT query từ câu hỏi tiếng Việt
- Validate SQL (chỉ cho phép SELECT)
- Execute trên SQL Server (read-only)
- Format kết quả thành câu trả lời tự nhiên

KHÔNG BAO GIỜ thực hiện UPDATE/DELETE/INSERT/DROP.
"""
import re
import time
from sqlalchemy import text

from app.config import GEMINI_MODEL, GEMINI_TEMPERATURE, SQL_MAX_ROWS, SQL_TIMEOUT_SECONDS
from app.gemini_client import generate_text
from app.database import SessionLocal
from app.logger_service import log_sql, log_llm_call, log_error


# ── Database Schema (đưa vào prompt cho LLM) ──────────────────────
DB_SCHEMA = """
Bạn có 2 bảng SQL Server:

1. BenhNhan (Bệnh nhân):
   - ID (INT, Primary Key, tự tăng)
   - MaBenhNhan (VARCHAR, computed: 'BN00001', 'BN00002'...)
   - HoTen (NVARCHAR, Họ và tên)
   - NgaySinh (DATE, Ngày sinh)
   - GioiTinh (NVARCHAR, 'Nam' hoặc 'Nữ')
   - CCCD (VARCHAR, Căn cước công dân, unique)
   - DiaChi (NVARCHAR, Địa chỉ)
   - SDT (VARCHAR, Số điện thoại)
   - NgheNghiep (NVARCHAR, Nghề nghiệp)
   - MaBHYT (VARCHAR, Mã bảo hiểm y tế)
   - LienHeKhanCap (NVARCHAR, Liên hệ khẩn cấp)
   - TienSuBanThan (NVARCHAR(MAX), Tiền sử bệnh bản thân)
   - TienSuGiaDinh (NVARCHAR(MAX), Tiền sử bệnh gia đình)
   - NgayTao (DATETIME, Ngày tạo hồ sơ)

2. LuotKham (Lượt khám bệnh, mỗi bệnh nhân có thể nhiều lượt):
   - LuotKhamID (INT, Primary Key)
   - BenhNhanID (INT, Foreign Key → BenhNhan.ID)
   - TrieuChung (NVARCHAR(MAX), Triệu chứng)
   - BenhDanh (NVARCHAR, Tên bệnh theo Đông Y)
   - ChungDanh (NVARCHAR, Chứng danh / Bát cương)
   - BaiThuoc (NVARCHAR(MAX), Bài thuốc kê đơn)
   - ChamCuuXoaBop (NVARCHAR(MAX), Châm cứu / Xoa bóp)
   - CheDoAnUongSinhHoat (NVARCHAR(MAX), Chế độ ăn uống)
   - LoiDanBacSi (NVARCHAR(MAX), Lời dặn)
   - NgayKham (DATETIME, Ngày khám)

Quan hệ: BenhNhan.ID = LuotKham.BenhNhanID (1-N)
"""


# ── Danh sách SQL keywords bị cấm ─────────────────────────────────
BLOCKED_KEYWORDS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE",
    "TRUNCATE", "EXEC", "EXECUTE", "xp_", "sp_",
    "GRANT", "REVOKE", "DENY", "MERGE", "INTO"
]


class PatientSQL:
    """
    Text-to-SQL pipeline: câu hỏi tiếng Việt → SQL SELECT → kết quả → câu trả lời.
    """

    def query(self, question: str) -> dict:
        """
        Tra cứu bệnh nhân bằng ngôn ngữ tự nhiên.

        Pipeline:
            1. Gemini sinh SQL SELECT từ câu hỏi
            2. Validate SQL (whitelist SELECT only)
            3. Execute trên SQL Server
            4. Format kết quả thành câu trả lời tiếng Việt

        Args:
            question: Câu hỏi về bệnh nhân (VD: "Ai bị chứng Tý?")

        Returns:
            dict: {"answer": str, "sql": str, "row_count": int}
        """
        start_time = time.time()

        # ── BƯỚC 1: SINH SQL ───────────────────────────────────────
        sql_start = time.time()
        generated_sql = self._generate_sql(question)
        sql_gen_ms = (time.time() - sql_start) * 1000

        if not generated_sql:
            return {
                "answer": "Xin lỗi, tôi không thể tạo truy vấn từ câu hỏi này.",
                "sql": "",
                "row_count": 0
            }

        # ── BƯỚC 2: VALIDATE SQL ───────────────────────────────────
        is_valid, error_msg = self._validate_sql(generated_sql)

        if not is_valid:
            total_ms = (time.time() - start_time) * 1000
            log_sql(question, generated_sql, False, 0, total_ms)
            return {
                "answer": f"Xin lỗi, truy vấn không an toàn và đã bị chặn. ({error_msg})",
                "sql": generated_sql,
                "row_count": 0
            }

        # ── BƯỚC 3: EXECUTE SQL ────────────────────────────────────
        try:
            rows, columns = self._execute_sql(generated_sql)
        except Exception as e:
            total_ms = (time.time() - start_time) * 1000
            log_sql(question, generated_sql, True, 0, total_ms)
            log_error("patient_sql", e, f"SQL: {generated_sql}")
            return {
                "answer": f"Xin lỗi, đã xảy ra lỗi khi truy vấn database: {str(e)}",
                "sql": generated_sql,
                "row_count": 0
            }

        # ── BƯỚC 4: FORMAT KẾT QUẢ ────────────────────────────────
        answer = self._format_results(question, rows, columns, generated_sql)

        total_ms = (time.time() - start_time) * 1000
        log_sql(question, generated_sql, True, len(rows), total_ms)

        return {
            "answer": answer,
            "sql": generated_sql,
            "row_count": len(rows)
        }

    # ═══════════════════════════════════════════════════════════════
    # SINH SQL TỪ CÂU HỎI
    # ═══════════════════════════════════════════════════════════════

    def _generate_sql(self, question: str) -> str:
        """Dùng Gemini sinh SQL SELECT từ câu hỏi tiếng Việt."""
        prompt = f"""Bạn là chuyên gia SQL Server. Nhiệm vụ: sinh 1 câu SQL SELECT duy nhất.

QUY TẮC BẮT BUỘC:
- Chỉ SELECT, KHÔNG BAO GIỜ dùng INSERT/UPDATE/DELETE/DROP
- Dùng TOP {SQL_MAX_ROWS} để giới hạn kết quả
- Dùng NVARCHAR literal: N'giá_trị' cho text tiếng Việt
- Dùng LIKE cho tìm kiếm gần đúng
- JOIN BenhNhan với LuotKham khi cần thông tin khám
- ORDER BY NgayKham DESC cho kết quả mới nhất
- Chỉ trả về đúng 1 câu SQL, không giải thích gì thêm

{DB_SCHEMA}

Câu hỏi: "{question}"

SQL:"""

        try:
            llm_start = time.time()
            sql = generate_text(prompt, temperature=0.1)
            llm_ms = (time.time() - llm_start) * 1000
            log_llm_call(prompt[:200], len(sql), GEMINI_MODEL, llm_ms)

            # Clean up: bỏ markdown code block nếu có
            sql = sql.replace("```sql", "").replace("```", "").strip()

            # Lấy chỉ câu SQL đầu tiên (phòng trường hợp LLM nói thêm)
            lines = [l.strip() for l in sql.split("\n") if l.strip()]
            sql_lines = []
            for line in lines:
                sql_lines.append(line)
                if line.rstrip().endswith(";"):
                    break
            sql = " ".join(sql_lines).rstrip(";")

            return sql

        except Exception as e:
            log_error("patient_sql", e, "SQL generation failed")
            return ""

    # ═══════════════════════════════════════════════════════════════
    # VALIDATE SQL (BẢO MẬT)
    # ═══════════════════════════════════════════════════════════════

    def _validate_sql(self, sql: str) -> tuple[bool, str]:
        """
        Kiểm tra SQL có an toàn không.

        Rules:
        1. Phải bắt đầu bằng SELECT
        2. Không chứa keywords nguy hiểm (INSERT, DROP, DELETE...)
        3. Không chứa dấu chấm phẩy kép (multi-statement)

        Returns:
            (is_valid: bool, error_message: str)
        """
        sql_upper = sql.upper().strip()

        # Rule 1: Phải SELECT
        if not sql_upper.startswith("SELECT"):
            return False, "Query phải bắt đầu bằng SELECT"

        # Rule 2: Check blocked keywords
        for keyword in BLOCKED_KEYWORDS:
            # Tìm keyword đứng riêng (word boundary) để tránh false positive
            pattern = r'\b' + keyword + r'\b'
            if re.search(pattern, sql_upper):
                return False, f"Query chứa keyword bị cấm: {keyword}"

        # Rule 3: Không multi-statement
        if ";" in sql and sql.index(";") < len(sql) - 1:
            return False, "Không cho phép multi-statement"

        return True, ""

    # ═══════════════════════════════════════════════════════════════
    # EXECUTE SQL
    # ═══════════════════════════════════════════════════════════════

    def _execute_sql(self, sql: str) -> tuple[list[dict], list[str]]:
        """
        Thực thi SQL trên database (read-only).

        Returns:
            (rows: list[dict], columns: list[str])
        """
        db = SessionLocal()
        try:
            result = db.execute(text(sql))
            columns = list(result.keys())
            rows = [dict(zip(columns, row)) for row in result.fetchall()]
            return rows, columns
        finally:
            db.close()

    # ═══════════════════════════════════════════════════════════════
    # FORMAT KẾT QUẢ
    # ═══════════════════════════════════════════════════════════════

    def _format_results(self, question: str, rows: list[dict],
                         columns: list[str], sql: str) -> str:
        """Format kết quả SQL thành câu trả lời tiếng Việt tự nhiên."""
        if not rows:
            return "Không tìm thấy kết quả phù hợp với câu hỏi."

        # Chuyển rows thành text table
        rows_text = ""
        for i, row in enumerate(rows[:SQL_MAX_ROWS], 1):
            row_str = " | ".join(
                f"{col}: {str(val)}" for col, val in row.items()
                if val is not None
            )
            rows_text += f"{i}. {row_str}\n"

        prompt = f"""Dữ liệu tra cứu được từ hệ thống (chỉ đọc, không chỉnh sửa):

{rows_text}

Câu hỏi gốc: "{question}"

Hãy trả lời bằng tiếng Việt trống gọn, dễ hiểu. Trình bày thông tin bệnh nhân rõ ràng.
Nếu có nhiều kết quả, liệt kê dạng danh sách.
Tổng số kết quả: {len(rows)} bản ghi."""

        try:
            llm_start = time.time()
            answer = generate_text(prompt, temperature=GEMINI_TEMPERATURE)
            llm_ms = (time.time() - llm_start) * 1000
            log_llm_call(prompt[:200], len(answer), GEMINI_MODEL, llm_ms)
            return answer
        except Exception as e:
            log_error("patient_sql", e, "Format results failed")
            # Fallback: trả raw data
            return f"Tìm thấy {len(rows)} kết quả:\n{rows_text}"
