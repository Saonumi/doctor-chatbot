"""
Gemini Client - Centralized Gemini API client.
Hỗ trợ cả Google API chính thức lẫn custom proxy (GEMINI_BASE_URL).

Sử dụng google-genai SDK mới (thay thế google.generativeai đã deprecated).
Tất cả module khác import từ đây, không import trực tiếp SDK.
"""
from google import genai
from google.genai import types

from app.config import GOOGLE_API_KEY, GEMINI_BASE_URL, GEMINI_MODEL, GEMINI_TEMPERATURE


def _create_client() -> genai.Client:
    """Tạo Gemini client — hỗ trợ custom proxy nếu có GEMINI_BASE_URL."""
    if GEMINI_BASE_URL:
        print(f"🔗 Gemini proxy: {GEMINI_BASE_URL}")
        return genai.Client(
            api_key=GOOGLE_API_KEY,
            http_options=types.HttpOptions(base_url=GEMINI_BASE_URL),
        )
    else:
        print("🔗 Gemini: official Google API")
        return genai.Client(api_key=GOOGLE_API_KEY)


# ── Singleton client ──────────────────────────────────────────────
client = _create_client()


def generate_text(
    prompt: str,
    temperature: float = GEMINI_TEMPERATURE,
    max_output_tokens: int | None = None,
    model: str = GEMINI_MODEL,
) -> str:
    """
    Gọi Gemini generate text — wrapper đơn giản.

    Args:
        prompt: Prompt text
        temperature: 0.0–1.0
        max_output_tokens: Giới hạn output (None = không giới hạn)
        model: Tên model

    Returns:
        Text response (stripped)
    """
    config = types.GenerateContentConfig(temperature=temperature)
    if max_output_tokens:
        config.max_output_tokens = max_output_tokens

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=config,
    )
    text = response.text
    return text.strip() if text else ""


def generate_with_image(prompt: str, image, model: str = GEMINI_MODEL) -> str:
    """
    Gọi Gemini Vision — gửi prompt + ảnh (PIL Image).

    Args:
        prompt: Prompt text mô tả yêu cầu
        image: PIL Image object
        model: Tên model

    Returns:
        Text response (stripped)
    """
    response = client.models.generate_content(
        model=model,
        contents=[prompt, image],
        config=types.GenerateContentConfig(temperature=GEMINI_TEMPERATURE),
    )
    text = response.text
    return text.strip() if text else ""
