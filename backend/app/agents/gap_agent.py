import json
from typing import Any

from .base import BaseAgent


class EvidenceGapAgent(BaseAgent):
    name = "Evidence Gap Agent"
    description = (
        "Identifies missing proof and prepares targeted follow-up questions."
    )

    def run(self, state: dict[str, Any]) -> dict[str, Any]:
        claims = state.get("claims", [])
        contradictions = state.get("contradictions", [])
        timeline = state.get("timeline", [])
        entities = state.get("entities", [])

        source = json.dumps(
            {
                "claims": claims,
                "contradictions": contradictions,
                "timeline": timeline,
                "entities": entities,
                "available_evidence": [
                    "Mock lawyer-client call transcripts"
                ],
            },
            ensure_ascii=False,
        )

        system_prompt = """
You are an Evidence Gap Agent assisting a lawyer.

Your responsibility is to identify important missing evidence needed to
verify, disprove, or clarify material claims.

Rules:
- Use only the supplied case intelligence.
- Do not invent facts or evidence.
- Do not decide legal admissibility.
- Do not provide definitive legal advice.
- Do not create a gap for every claim.
- Merge overlapping evidence gaps.
- Focus on material payments, agreements, threats, witnesses, dates,
  possession promises, and disputed statements.
- Return no more than 5 evidence gaps.
- Return no more than 5 follow-up questions.
- Keep all descriptions concise.
- Return valid JSON only.
""".strip()

        user_prompt = f"""
Review this case intelligence:

{source}

Return exactly one JSON object with this structure:

{{
  "evidence_gaps": [
    {{
      "gap_id": "GAP-001",
      "related_claims": ["CLM-001"],
      "missing_item": "Concise description of missing evidence",
      "reason": "Concise explanation of why it matters",
      "priority": "HIGH"
    }}
  ],
  "follow_up_questions": [
    {{
      "question_id": "Q-001",
      "target": "Client",
      "question": "Concise question to ask",
      "reason": "Why this question is necessary",
      "related_claims": ["CLM-001"],
      "related_contradictions": ["CON-001"]
    }}
  ]
}}

Requirements:

1. Return at most 5 evidence gaps.
2. Return at most 5 follow-up questions.
3. priority must be HIGH, MEDIUM, or LOW.
4. target must be Client, Witness, Opposing Party, or Other.
5. Use only claim IDs present in the supplied claims.
6. Use only contradiction IDs present in the supplied contradictions.
7. missing_item must contain no more than 20 words.
8. reason must contain no more than 30 words.
9. Exclude minor or speculative gaps.
10. Return JSON only, with no Markdown.
""".strip()

        result = self.client.json_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=2200,
        )

        # Defensive defaults ensure downstream agents always receive
        # the expected structure.
        if not isinstance(result, dict):
            raise RuntimeError(
                "Evidence Gap Agent returned an invalid response type."
            )

        evidence_gaps = result.get("evidence_gaps", [])
        follow_up_questions = result.get("follow_up_questions", [])

        if not isinstance(evidence_gaps, list):
            evidence_gaps = []

        if not isinstance(follow_up_questions, list):
            follow_up_questions = []

        return {
            "evidence_gaps": evidence_gaps[:5],
            "follow_up_questions": follow_up_questions[:5],
        }