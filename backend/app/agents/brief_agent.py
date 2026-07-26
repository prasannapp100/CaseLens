import json
from typing import Any

from .base import BaseAgent


class CaseBriefAgent(BaseAgent):
    name = "Case Brief Agent"
    description = "Synthesizes specialist outputs into a proof-grounded case overview."

    def run(self, state: dict[str, Any]) -> dict[str, Any]:
        source = json.dumps(
            {
                "case": state["case"],
                "entities": state.get("entities", []),
                "claims": state.get("claims", []),
                "timeline": state.get("timeline", []),
                "contradictions": state.get("contradictions", []),
                "evidence_gaps": state.get("evidence_gaps", []),
            },
            ensure_ascii=False,
            indent=2,
        )
        return self.client.json_completion(
            system_prompt=(
                "You synthesize outputs produced by specialist legal evidence agents. Do not introduce "
                "new facts. Distinguish allegations, disputes and missing proof. Return JSON only."
            ),
            user_prompt=f"""Create a concise case brief from this structured state:\n{source}\n\nReturn:
{{"summary":"...","material_facts":[],"disputed_facts":[],"key_people":[],"lawyer_attention_items":[]}}
Every material or disputed fact should include its supporting claim IDs where possible.""",
            max_tokens=1300,
        )
