import json
import re
from typing import Any

from app.services.sarvam_client import SarvamClient


class BaseAgent:
    name = "Base Agent"
    description = "Performs a specialist case-analysis task."

    def __init__(self, client: SarvamClient) -> None:
        self.client = client

    @staticmethod
    def parse_json(content: str) -> dict[str, Any]:
        if not content or not isinstance(content, str):
            raise RuntimeError("Sarvam returned an empty response.")

        cleaned = content.strip()

        cleaned = re.sub(
            r"^```(?:json)?\s*",
            "",
            cleaned,
            flags=re.IGNORECASE,
        )
        cleaned = re.sub(r"\s*```$", "", cleaned)

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"Sarvam did not return valid JSON: {cleaned[:1000]}"
            ) from exc

        if not isinstance(parsed, dict):
            raise RuntimeError("Agent response must be a JSON object.")

        return parsed

    def call_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2000,
    ) -> dict[str, Any]:
        first_response = self.client.chat(
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
            max_tokens=max_tokens,
        )

        try:
            return self.parse_json(first_response)

        except RuntimeError:
            retry_prompt = f"""
Your previous response was incomplete or invalid JSON.

Return the same result again as one complete, compact JSON object.

Requirements:
- Use shorter descriptions.
- Remove low-priority items.
- Return no more than 5 items in any array.
- Do not use Markdown.
- Do not explain anything outside the JSON.

Original task:

{user_prompt}
""".strip()

            retry_response = self.client.chat(
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": retry_prompt,
                    },
                ],
                max_tokens=min(max_tokens + 500, 3500),
            )

            return self.parse_json(retry_response)