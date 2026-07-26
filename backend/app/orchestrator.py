from datetime import datetime, timezone
from time import perf_counter
from typing import Any

from .agents import (
    CaseBriefAgent,
    ClaimAgent,
    ContradictionAgent,
    EntityAgent,
    EvidenceGapAgent,
    TimelineAgent,
)
from .services.sarvam_client import SarvamClient


class CaseManager:
    def __init__(self) -> None:
        client = SarvamClient()
        self.agents = [
            EntityAgent(client),
            ClaimAgent(client),
            TimelineAgent(client),
            ContradictionAgent(client),
            EvidenceGapAgent(client),
            CaseBriefAgent(client),
        ]

    def run(self, case: dict[str, Any], utterances: list[dict[str, Any]]) -> dict[str, Any]:
        state: dict[str, Any] = {
            "case": case,
            "utterances": utterances,
            "entities": [],
            "claims": [],
            "timeline": [],
            "contradictions": [],
            "evidence_gaps": [],
            "follow_up_questions": [],
            "brief": {},
            "agent_runs": [],
        }

        output_keys = {
            "Entity Agent": ["entities"],
            "Claim Extraction Agent": ["claims"],
            "Timeline Agent": ["timeline"],
            "Contradiction Agent": ["contradictions"],
            "Evidence Gap Agent": ["evidence_gaps", "follow_up_questions"],
            "Case Brief Agent": ["brief"],
        }

        for agent in self.agents:
            started = datetime.now(timezone.utc).isoformat()
            timer = perf_counter()
            run_log = {
                "agent": agent.name,
                "description": agent.description,
                "status": "running",
                "started_at": started,
            }
            try:
                result = agent.run(state)
                if agent.name == "Case Brief Agent":
                    state["brief"] = result
                else:
                    for key in output_keys[agent.name]:
                        state[key] = result.get(key, [])
                run_log.update(
                    {
                        "status": "completed",
                        "duration_ms": round((perf_counter() - timer) * 1000),
                        "output_count": self._output_count(agent.name, state),
                    }
                )
            except Exception as exc:
                run_log.update(
                    {
                        "status": "failed",
                        "duration_ms": round((perf_counter() - timer) * 1000),
                        "error": str(exc),
                    }
                )
                state["agent_runs"].append(run_log)
                raise RuntimeError(f"{agent.name} failed: {exc}") from exc
            state["agent_runs"].append(run_log)

        state["summary"] = state.get("brief", {}).get("summary", "")
        return state

    @staticmethod
    def _output_count(agent_name: str, state: dict[str, Any]) -> int:
        mapping = {
            "Entity Agent": "entities",
            "Claim Extraction Agent": "claims",
            "Timeline Agent": "timeline",
            "Contradiction Agent": "contradictions",
            "Evidence Gap Agent": "evidence_gaps",
            "Case Brief Agent": "brief",
        }
        value = state.get(mapping[agent_name])
        return len(value) if isinstance(value, list) else int(bool(value))
