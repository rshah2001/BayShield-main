"""Optional LLM helper for BayShield Python agents."""
import asyncio
import os
from functools import lru_cache
from typing import Optional

import httpx

try:
    from google import genai
    from google.genai import types
except Exception:  # pragma: no cover - optional dependency
    genai = None
    types = None


DEFAULT_MODEL = (
    os.getenv("GOOGLE_GENAI_MODEL")
    or os.getenv("GEMINI_MODEL")
    or os.getenv("OPENAI_MODEL")
    or "gemini-2.5-flash"
)


def _resolve_api_key() -> str:
    return (
        os.getenv("GOOGLE_API_KEY")
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("OPENAI_API_KEY")
        or ""
    )


def _resolve_provider() -> str:
    if os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"):
        return "google-genai"
    if os.getenv("OPENAI_API_KEY"):
        return "openai-compatible"
    return "unavailable"


def _resolve_openai_base_url() -> str:
    base_url = os.getenv("OPENAI_BASE_URL") or os.getenv("OPENAI_API_BASE") or "https://api.openai.com"
    return base_url.rstrip("/")


def sdk_status() -> dict[str, object]:
    api_key = _resolve_api_key()
    provider = _resolve_provider()
    enabled = False
    if provider == "google-genai":
        enabled = bool(genai and api_key)
    elif provider == "openai-compatible":
        enabled = bool(api_key)

    return {
        "enabled": enabled,
        "provider": provider,
        "model": DEFAULT_MODEL,
        "has_api_key": bool(api_key),
    }


@lru_cache(maxsize=1)
def _get_client():
    if not genai:
        return None

    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    return genai.Client(api_key=api_key)


async def generate_text(
    prompt: str,
    *,
    system_instruction: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.2,
    response_mime_type: str = "text/plain",
) -> Optional[str]:
    provider = _resolve_provider()
    if provider == "openai-compatible":
        return await _generate_text_openai(
            prompt,
            system_instruction=system_instruction,
            model=model,
            temperature=temperature,
        )

    client = _get_client()
    if client is None:
        return None

    resolved_model = model or DEFAULT_MODEL

    def _call() -> Optional[str]:
        config = None
        if types is not None:
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=temperature,
                response_mime_type=response_mime_type,
            )

        response = client.models.generate_content(
            model=resolved_model,
            contents=prompt,
            config=config,
        )

        text = getattr(response, "text", None)
        if isinstance(text, str) and text.strip():
            return text.strip()

        candidates = getattr(response, "candidates", None) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            parts = getattr(content, "parts", None) or []
            collected = []
            for part in parts:
                value = getattr(part, "text", None)
                if isinstance(value, str) and value.strip():
                    collected.append(value.strip())
            if collected:
                return "\n".join(collected)

        return None

    try:
        return await asyncio.to_thread(_call)
    except Exception:
        return None


async def _generate_text_openai(
    prompt: str,
    *,
    system_instruction: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.2,
) -> Optional[str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    base_url = _resolve_openai_base_url()
    endpoint = (
        f"{base_url}/chat/completions"
        if base_url.endswith("/v1")
        else f"{base_url}/v1/chat/completions"
    )

    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                endpoint,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model or DEFAULT_MODEL,
                    "messages": messages,
                    "temperature": temperature,
                },
            )
            response.raise_for_status()
            payload = response.json()
            choices = payload.get("choices") or []
            if not choices:
                return None

            message = choices[0].get("message") or {}
            content = message.get("content")
            if isinstance(content, str) and content.strip():
                return content.strip()

            return None
    except Exception:
        return None
