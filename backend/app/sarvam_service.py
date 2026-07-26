import json
import os
import re
from typing import Any

import httpx

SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions"


class SarvamService:
    def __init__(self) -> None:
        self.api_key = os.getenv("SARVAM_API_KEY", "").strip()
        self.model = os.getenv("SARVAM_CHAT_MODEL", "sarvam-30b")
        if not self.api_key:
            raise RuntimeError("SARVAM_API_KEY is not configured in backend/.env")

    def _chat(self, messages: list[dict[str, str]], *, max_tokens: int = 5000) -> str:
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.1,
            "max_tokens": max_tokens,
            "reasoning_effort": "medium",
            "response_format": {"type": "json_object"},
        }
        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json",
        }
        try:
            with httpx.Client(timeout=120.0) as client:
                response = client.post(SARVAM_CHAT_URL, headers=headers, json=payload)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:1000]
            raise RuntimeError(f"Sarvam API returned {exc.response.status_code}: {detail}") from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Could not connect to Sarvam API: {exc}") from exc

        data = response.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError("Sarvam returned an unexpected response format") from exc

    @staticmethod
    def _parse_json(content: str) -> dict[str, Any]:
        content = content.strip()
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Sarvam did not return valid JSON: {content[:500]}") from exc
        if not isinstance(parsed, dict):
            raise RuntimeError("Sarvam response must be a JSON object")
        return parsed

    def analyze_case(self, case: dict[str, Any], utterances: list[dict[str, Any]]) -> dict[str, Any]:
        source = json.dumps({"case": case, "utterances": utterances}, ensure_ascii=False, indent=2)
        system = """You are an evidence-analysis assistant for lawyers. Analyze only the supplied mock transcript. Do not invent facts. Treat every speaker statement as an allegation unless independently supported. Every extracted item must cite valid utterance IDs from the input. Detect possible inconsistencies, but never accuse anyone of lying. Return JSON only."""
        user = f"""Analyze this case material:\n{source}\n\nReturn exactly one JSON object with these keys:
- summary: concise case summary
- entities: array of objects with entity_id, name, type, roles, source_utterances
- claims: array with claim_id, category, statement, status, source_utterances, confidence
- timeline: array with event_id, date, date_precision, event_type, description, source_utterances
- contradictions: array with contradiction_id, topic, severity, statement_a, statement_b, source_a, source_b, possible_explanation, requires_review
- missing_evidence: array of strings
- follow_up_questions: array of strings

Rules:
1. Use IDs such as ENT-001, CLM-001, EVT-001, CON-001.
2. Confidence must be a number from 0 to 1.
3. date_precision must be EXACT, APPROXIMATE, CONFLICTING, or UNKNOWN.
4. status must be ALLEGED, DISPUTED, ADMITTED, DENIED, or CORROBORATED.
5. source_a and source_b must be utterance IDs.
6. Output valid JSON and nothing else."""
        return self._parse_json(self._chat([
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]))

    def answer_question(
        self,
        question: str,
        case: dict[str, Any],
        utterances: list[dict[str, Any]],
        analysis: dict[str, Any],
    ) -> dict[str, Any]:
        context = json.dumps(
            {"case": case, "utterances": utterances, "analysis": analysis},
            ensure_ascii=False,
            indent=2,
        )
        system = """You answer questions for a lawyer using only supplied case evidence. Never use outside facts. Every factual sentence must be supported by cited utterance IDs. Distinguish allegations, contradictions, and missing proof. Return JSON only."""
        user = f"""Case context:\n{context}\n\nQuestion: {question}\n\nReturn one JSON object:
{{
  "answer": "concise grounded answer",
  "citation_ids": ["UTT-..."],
  "warning": "uncertainty, contradiction, or missing-proof note",
  "answered": true
}}
If the evidence cannot answer the question, set answered to false, answer to a clear statement that the evidence is insufficient, citation_ids to [], and explain what is missing in warning. Do not cite IDs that are absent from the transcript."""
        return self._parse_json(self._chat([
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ], max_tokens=1800))
