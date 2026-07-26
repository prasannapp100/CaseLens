import json
from typing import Any

from .services.sarvam_client import SarvamClient


class RetrievalService:
    def __init__(self) -> None:
        self.client = SarvamClient()

    def answer(
        self,
        question: str,
        case: dict[str, Any],
        utterances: list[dict[str, Any]],
        analysis: dict[str, Any],
    ) -> dict[str, Any]:
        context = json.dumps(
            {
                "case": case,
                "utterances": utterances,
                "entities": analysis.get("entities", []),
                "claims": analysis.get("claims", []),
                "timeline": analysis.get("timeline", []),
                "contradictions": analysis.get("contradictions", []),
                "evidence_gaps": analysis.get("evidence_gaps", []),
            },
            ensure_ascii=False,
            indent=2,
        )
        return self.client.json_completion(
            system_prompt=(
                "You are the retrieval agent for a legal case workspace. Answer only from supplied "
                "evidence and structured agent outputs. Every factual answer must cite valid utterance IDs. "
                "Distinguish allegations from verified facts. Return JSON only."
            ),
            user_prompt=f"""Context:\n{context}\n\nQuestion: {question}\n\nReturn:
{{"answer":"...","citation_ids":["UTT-001"],"related_claim_ids":["CLM-001"],"warning":"...","answered":true}}
If evidence is insufficient, set answered=false and citation_ids=[].""",
            max_tokens=1100,
        )
