import json
from typing import Any

from .base import BaseAgent


class ClaimAgent(BaseAgent):
    name = "Claim Extraction Agent"
    description = "Breaks statements into atomic, evidence-linked legal claims."

    def run(self, state: dict[str, Any]) -> dict[str, Any]:
        source = json.dumps(
            {"utterances": state["utterances"], "entities": state.get("entities", [])},
            ensure_ascii=False,
            indent=2,
        )
        return self.client.json_completion(
            system_prompt=(
                "You extract atomic claims from legal conversations. Split compound statements into "
                "separate claims. Treat statements as allegations unless the transcript clearly shows "
                "an admission, denial or independent corroboration. Cite only valid utterance IDs. Return JSON only."
            ),
            user_prompt=f"""Extract atomic claims:\n{source}\n\nReturn:
{{"claims":[{{"claim_id":"CLM-001","category":"PAYMENT|AGREEMENT|POSSESSION|THREAT|WITNESS|MEETING|COMMUNICATION|OTHER","subject":"...","predicate":"...","object":"...","statement":"...","status":"ALLEGED|DISPUTED|ADMITTED|DENIED|CORROBORATED","qualifiers":{{}},"source_utterances":["UTT-001"],"confidence":0.8}}]}}
Do not combine unrelated facts in one claim.""",
            max_tokens=1900,
        )
