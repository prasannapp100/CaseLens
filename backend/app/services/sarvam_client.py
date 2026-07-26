import json
import os
import re
from typing import Any

import httpx

SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions"


class SarvamClient:
    def __init__(self) -> None:
        self.api_key = os.getenv("SARVAM_API_KEY", "").strip()
        self.model = os.getenv("SARVAM_CHAT_MODEL", "sarvam-30b").strip()
        if not self.api_key:
            raise RuntimeError("SARVAM_API_KEY is not configured in backend/.env")

    def json_completion(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 1800,
    ) -> dict[str, Any]:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
            "max_tokens": min(max_tokens, 4000),
            "reasoning_effort": None,
            "response_format": {"type": "json_object"},
        }
        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=180.0) as client:
                response = client.post(SARVAM_CHAT_URL, headers=headers, json=payload)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"Sarvam API returned {exc.response.status_code}: {exc.response.text[:1500]}"
            ) from exc
        except httpx.TimeoutException as exc:
            raise RuntimeError("Sarvam API request timed out.") from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Could not connect to Sarvam API: {exc}") from exc

        try:
            data = response.json()
            message = data["choices"][0]["message"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"Unexpected Sarvam response: {response.text[:1500]}") from exc

        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError(
                "Sarvam returned empty content. "
                f"Response: {json.dumps(data, ensure_ascii=False)[:1500]}"
            )

        cleaned = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Sarvam did not return valid JSON: {cleaned[:1000]}") from exc
        if not isinstance(parsed, dict):
            raise RuntimeError("Sarvam response must be a JSON object.")
        return parsed
