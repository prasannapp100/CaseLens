import json
from typing import Any

from .base import BaseAgent


class EntityAgent(BaseAgent):
    name = "Entity Agent"
    description = "Identifies people, organisations, locations, documents and aliases."

    def run(self, state: dict[str, Any]) -> dict[str, Any]:
        source = json.dumps(state["utterances"], ensure_ascii=False, indent=2)
        return self.client.json_completion(
            system_prompt=(
                "You are a legal evidence entity extraction specialist. Use only the supplied "
                "transcript. Do not invent entities. Every entity must cite valid utterance IDs. "
                "Return JSON only."
            ),
            user_prompt=f"""Extract entities from this transcript:\n{source}\n\nReturn:
{{"entities":[{{"entity_id":"ENT-001","name":"...","type":"PERSON|ORGANIZATION|LOCATION|PROPERTY|DOCUMENT|MONEY|OTHER","aliases":[],"roles":[],"source_utterances":["UTT-001"]}}]}}
Merge obvious aliases referring to the same entity. Return valid JSON only.""",
            max_tokens=1300,
        )
