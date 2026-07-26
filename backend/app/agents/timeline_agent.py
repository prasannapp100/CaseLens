import json
from typing import Any

from .base import BaseAgent


class TimelineAgent(BaseAgent):
    name = "Timeline Agent"
    description = "Reconstructs chronology from extracted claims and transcript evidence."

    def run(self, state: dict[str, Any]) -> dict[str, Any]:
        source = json.dumps(
            {"case": state["case"], "claims": state.get("claims", []), "utterances": state["utterances"]},
            ensure_ascii=False,
            indent=2,
        )
        return self.client.json_completion(
            system_prompt=(
                "You reconstruct legal case timelines. Use only supplied claims and transcript. Never "
                "convert uncertain dates into exact dates. Cite claim IDs and utterance IDs. Return JSON only."
            ),
            user_prompt=f"""Build the chronological timeline:\n{source}\n\nReturn:
{{"timeline":[{{"event_id":"EVT-001","date":"...","date_precision":"EXACT|APPROXIMATE|CONFLICTING|UNKNOWN","event_type":"PAYMENT|MEETING|THREAT|AGREEMENT|PROMISE|COMMUNICATION|OTHER","participants":[],"description":"...","source_claims":["CLM-001"],"source_utterances":["UTT-001"]}}]}}
Order dated events chronologically and place unknown dates last.""",
            max_tokens=1500,
        )
