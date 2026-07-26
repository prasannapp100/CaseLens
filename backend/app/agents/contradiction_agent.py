import json
from typing import Any

from .base import BaseAgent


class ContradictionAgent(BaseAgent):
    name = "Contradiction Agent"
    description = "Finds potentially conflicting claims without alleging deception."

    def run(self, state: dict[str, Any]) -> dict[str, Any]:
        source = json.dumps(
            {"claims": state.get("claims", []), "timeline": state.get("timeline", [])},
            ensure_ascii=False,
            indent=2,
        )
        return self.client.json_completion(
            system_prompt=(
                "You compare legal claims for possible inconsistencies. Flag only meaningful conflicts. "
                "A difference may refer to separate events, approximation or correction, so never accuse "
                "a speaker of lying. Return JSON only."
            ),
            user_prompt=f"""Compare these claims and events:\n{source}\n\nReturn:
{{"contradictions":[{{"contradiction_id":"CON-001","topic":"...","severity":"LOW|MEDIUM|HIGH","claim_a":"CLM-001","claim_b":"CLM-002","statement_a":"...","statement_b":"...","source_a":"UTT-001","source_b":"UTT-002","difference":{{}},"possible_explanations":[],"requires_review":true}}]}}
Return an empty array when there is no meaningful conflict.""",
            max_tokens=1300,
        )
