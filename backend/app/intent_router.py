"""
Intent Router - Phân loại câu hỏi user → route đúng nhánh AI.
- MEDICAL: hỏi về y học Đông Y (triệu chứng, bài thuốc, huyệt vị...)
- PATIENT: hỏi về bệnh nhân cụ thể (tìm kiếm, lịch sử khám...)
- GENERAL: chào hỏi, câu hỏi chung, không liên quan

Dùng 1 LLM call nhẹ (Gemini) với few-shot examples.
"""
import time

from app.gemini_client import generate_text
from app.logger_service import log_intent, log_error


# ── Prompt phân loại (few-shot) ────────────────────────────────────
ROUTER_PROMPT = """Phân loại câu hỏi sau vào 1 trong 3 nhóm. CHỈ TRẢ LỜI ĐÚNG 1 TỪ.

Các nhóm:
- MEDICAL: Câu hỏi về y học, triệu chứng bệnh, bài thuốc, huyệt vị, phương pháp điều trị, châm cứu, cây thuốc, Đông Y, Tây Y
- PATIENT: Câu hỏi tìm kiếm hoặc tra cứu thông tin bệnh nhân cụ thể, lịch sử khám, ai bị bệnh gì, danh sách bệnh nhân
- GENERAL: Chào hỏi, giới thiệu, câu hỏi không liên quan y học hoặc bệnh nhân

Ví dụ:
"Chữa đau đầu thế nào?" → MEDICAL
"Bài thuốc Quy tỳ thang gồm những gì?" → MEDICAL
"Huyệt Hợp cốc nằm ở đâu?" → MEDICAL
"Triệu chứng can dương thượng cang?" → MEDICAL
"Bệnh nhân Nguyễn Văn A?" → PATIENT
"Ai bị chứng Tý tuần trước?" → PATIENT
"Danh sách bệnh nhân khám hôm nay?" → PATIENT
"Lịch sử khám của BN00012?" → PATIENT
"Bệnh nhân nào uống Quy tỳ thang?" → PATIENT
"Xin chào" → GENERAL
"Bạn là ai?" → GENERAL
"Cảm ơn bác sĩ" → GENERAL

Câu hỏi: "{question}"
Phân loại:"""


class IntentRouter:
    """
    Phân loại intent câu hỏi user.
    1 LLM call, output 1 từ: MEDICAL / PATIENT / GENERAL.
    """

    def classify(self, question: str) -> str:
        """
        Phân loại câu hỏi.

        Args:
            question: Câu hỏi user

        Returns:
            "MEDICAL" | "PATIENT" | "GENERAL"
        """
        start_time = time.time()

        try:
            prompt = ROUTER_PROMPT.format(question=question)
            response = generate_text(prompt, temperature=0.0, max_output_tokens=10)
            intent = response.strip().upper() if response else ""

            # Normalize: chỉ nhận 3 giá trị hợp lệ
            if intent not in ("MEDICAL", "PATIENT", "GENERAL"):
                # Fallback: kiểm tra xem response có chứa keyword không
                if "MEDICAL" in intent:
                    intent = "MEDICAL"
                elif "PATIENT" in intent:
                    intent = "PATIENT"
                else:
                    # LLM trả rỗng hoặc lạ → fallback keyword
                    intent = self._keyword_fallback(question)

            duration_ms = (time.time() - start_time) * 1000
            log_intent(question, intent, duration_ms)

            return intent

        except Exception as e:
            log_error("intent_router", e, f"Question: {question}")
            # Fallback keyword khi LLM lỗi
            return self._keyword_fallback(question)

    def _keyword_fallback(self, question: str) -> str:
        """Phân loại bằng keyword khi LLM không trả lời được."""
        q = question.lower()
        medical_kw = ['đau', 'bệnh', 'thuốc', 'chữa', 'triệu chứng', 'điều trị',
                       'châm cứu', 'huyệt', 'tạng', 'phủ', 'kinh lạc', 'bài thuốc',
                       'phương', 'hàn', 'nhiệt', 'hư', 'thực', 'âm', 'dương',
                       'sốt', 'ho', 'mất ngủ', 'đông y', 'y học']
        patient_kw = ['bệnh nhân', 'hồ sơ', 'bn', 'cccd', 'khám', 'nguyễn', 'trần',
                       'lê', 'phạm', 'ai bị', 'danh sách']

        if any(kw in q for kw in patient_kw):
            return "PATIENT"
        if any(kw in q for kw in medical_kw):
            return "MEDICAL"
        return "GENERAL"
