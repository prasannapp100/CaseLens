from __future__ import annotations

import re
from typing import Any

from .base import BaseAgent


class GraphAgent(BaseAgent):
    name = "Case Graph Agent"
    description = "Connects entities, claims, events, evidence and gaps into a traceable case graph."

    def run(self, state: dict[str, Any]) -> dict[str, Any]:
        case = state.get("case", {})
        entities = state.get("entities", [])
        claims = state.get("claims", [])
        timeline = state.get("timeline", [])
        contradictions = state.get("contradictions", [])
        evidence_gaps = state.get("evidence_gaps", [])
        utterances = state.get("utterances", [])

        nodes: list[dict[str, Any]] = []
        edges: list[dict[str, Any]] = []
        node_ids: set[str] = set()
        edge_ids: set[str] = set()

        def add_node(node: dict[str, Any]) -> None:
            node_id = str(node["id"])
            if node_id not in node_ids:
                node_ids.add(node_id)
                nodes.append(node)

        def add_edge(source: str, target: str, relationship: str, **extra: Any) -> None:
            if source not in node_ids or target not in node_ids:
                return
            base_id = f"{source}::{relationship}::{target}"
            edge_id = base_id
            counter = 2
            while edge_id in edge_ids:
                edge_id = f"{base_id}::{counter}"
                counter += 1
            edge_ids.add(edge_id)
            edges.append(
                {
                    "id": edge_id,
                    "source": source,
                    "target": target,
                    "relationship": relationship,
                    **extra,
                }
            )

        case_id = str(case.get("case_id") or "CASE-001")
        add_node(
            {
                "id": case_id,
                "kind": "CASE",
                "label": case.get("title", "Active matter"),
                "subtitle": case.get("matter_type", "Legal matter"),
                "status": "ACTIVE",
                "source_ids": [],
                "data": case,
            }
        )

        for entity in entities:
            entity_id = str(entity.get("entity_id", ""))
            if not entity_id:
                continue
            add_node(
                {
                    "id": entity_id,
                    "kind": "ENTITY",
                    "subkind": entity.get("type", "OTHER"),
                    "label": entity.get("name", entity_id),
                    "subtitle": ", ".join(entity.get("roles", [])) or entity.get("type", "Entity"),
                    "status": "IDENTIFIED",
                    "source_ids": entity.get("source_utterances", []),
                    "data": entity,
                }
            )
            add_edge(case_id, entity_id, "HAS_ENTITY")

        for claim in claims:
            claim_id = str(claim.get("claim_id", ""))
            if not claim_id:
                continue
            confidence = float(claim.get("confidence", 0) or 0)
            add_node(
                {
                    "id": claim_id,
                    "kind": "CLAIM",
                    "subkind": claim.get("category", "OTHER"),
                    "label": claim.get("statement", claim_id),
                    "subtitle": claim.get("status", "ALLEGED"),
                    "status": claim.get("status", "ALLEGED"),
                    "confidence": max(0, min(confidence, 1)),
                    "source_ids": claim.get("source_utterances", []),
                    "data": claim,
                }
            )
            add_edge(case_id, claim_id, "HAS_CLAIM")

        for event in timeline:
            event_id = str(event.get("event_id", ""))
            if not event_id:
                continue
            add_node(
                {
                    "id": event_id,
                    "kind": "EVENT",
                    "subkind": event.get("event_type", "OTHER"),
                    "label": event.get("description", event_id),
                    "subtitle": event.get("date") or "Date unknown",
                    "status": event.get("date_precision", "UNKNOWN"),
                    "date": event.get("date", ""),
                    "source_ids": event.get("source_utterances", []),
                    "data": event,
                }
            )
            add_edge(case_id, event_id, "HAS_EVENT")
            for claim_id in event.get("source_claims", []):
                add_edge(str(claim_id), event_id, "FORMS_EVENT")

        for utterance in utterances:
            utterance_id = str(utterance.get("utterance_id", ""))
            if not utterance_id:
                continue
            add_node(
                {
                    "id": utterance_id,
                    "kind": "EVIDENCE",
                    "subkind": "TRANSCRIPT",
                    "label": utterance.get("text", utterance_id),
                    "subtitle": f'{utterance.get("recording_id", "Recording")} · {utterance.get("speaker", "Speaker")}',
                    "status": "SOURCE",
                    "source_ids": [utterance_id],
                    "data": utterance,
                }
            )

        for gap in evidence_gaps:
            gap_id = str(gap.get("gap_id", ""))
            if not gap_id:
                continue
            add_node(
                {
                    "id": gap_id,
                    "kind": "GAP",
                    "subkind": "MISSING_EVIDENCE",
                    "label": gap.get("missing_item", gap_id),
                    "subtitle": gap.get("priority", "MEDIUM"),
                    "status": gap.get("priority", "MEDIUM"),
                    "source_ids": [],
                    "data": gap,
                }
            )
            add_edge(case_id, gap_id, "HAS_GAP")
            for claim_id in gap.get("related_claims", []):
                add_edge(gap_id, str(claim_id), "MISSING_FOR")

        # Evidence provenance edges.
        for claim in claims:
            claim_id = str(claim.get("claim_id", ""))
            for utterance_id in claim.get("source_utterances", []):
                add_edge(claim_id, str(utterance_id), "SUPPORTED_BY")

        for event in timeline:
            event_id = str(event.get("event_id", ""))
            for utterance_id in event.get("source_utterances", []):
                add_edge(event_id, str(utterance_id), "SUPPORTED_BY")

        # Link entities to claims using normalized names, aliases and structured claim fields.
        for entity in entities:
            entity_id = str(entity.get("entity_id", ""))
            names = [entity.get("name", ""), *entity.get("aliases", [])]
            names = [self._normalize(value) for value in names if value]
            for claim in claims:
                claim_id = str(claim.get("claim_id", ""))
                searchable = " ".join(
                    str(claim.get(key, ""))
                    for key in ("subject", "predicate", "object", "statement")
                )
                searchable += " " + " ".join(str(value) for value in claim.get("qualifiers", {}).values())
                normalized_claim = self._normalize(searchable)
                if any(name and self._contains_term(normalized_claim, name) for name in names):
                    add_edge(entity_id, claim_id, "PARTICIPATES_IN")

        # Contradictions are edges between the best matching claim nodes.
        for contradiction in contradictions:
            claim_a = self._claim_for_source(contradiction.get("source_a"), claims)
            claim_b = self._claim_for_source(contradiction.get("source_b"), claims, exclude=claim_a)
            if claim_a and claim_b:
                add_edge(
                    claim_a,
                    claim_b,
                    "CONTRADICTS",
                    severity=contradiction.get("severity", "MEDIUM"),
                    label=contradiction.get("topic", "Possible contradiction"),
                    contradiction_id=contradiction.get("contradiction_id"),
                    data=contradiction,
                )

        relationship_counts: dict[str, int] = {}
        kind_counts: dict[str, int] = {}
        for node in nodes:
            kind_counts[node["kind"]] = kind_counts.get(node["kind"], 0) + 1
        for edge in edges:
            relationship = edge["relationship"]
            relationship_counts[relationship] = relationship_counts.get(relationship, 0) + 1

        return {
            "graph": {
                "nodes": nodes,
                "edges": edges,
                "stats": {
                    "node_count": len(nodes),
                    "edge_count": len(edges),
                    "kind_counts": kind_counts,
                    "relationship_counts": relationship_counts,
                },
            }
        }

    @staticmethod
    def _normalize(value: Any) -> str:
        return re.sub(r"[^a-z0-9₹]+", " ", str(value).lower()).strip()

    @staticmethod
    def _contains_term(text: str, term: str) -> bool:
        return bool(term) and (term in text or all(part in text for part in term.split()))

    @staticmethod
    def _claim_for_source(source_id: Any, claims: list[dict[str, Any]], exclude: str | None = None) -> str | None:
        for claim in claims:
            claim_id = str(claim.get("claim_id", ""))
            if claim_id == exclude:
                continue
            if source_id in claim.get("source_utterances", []):
                return claim_id
        return None
