import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from .mock_data import MOCK_CASE, MOCK_UTTERANCES
from .orchestrator import CaseManager
from .retrieval_service import RetrievalService
from .schemas import QuestionRequest

app = FastAPI(title="AI Case Intelligence Multi-Agent POC", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE_FILE = Path(__file__).resolve().parent.parent / "generated_analysis.json"


def load_analysis() -> dict[str, Any] | None:
    if not CACHE_FILE.exists():
        return None
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def save_analysis(data: dict[str, Any]) -> None:
    CACHE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def citation_details(ids: list[str]) -> list[dict[str, Any]]:
    by_id = {item["utterance_id"]: item for item in MOCK_UTTERANCES}
    return [
        {
            "utterance_id": item["utterance_id"],
            "recording_id": item["recording_id"],
            "speaker": item["speaker"],
            "text": item["text"],
            "start_time": item["start_time"],
            "end_time": item["end_time"],
        }
        for utterance_id in ids
        if (item := by_id.get(utterance_id))
    ]


@app.get("/health")
def health():
    return {
        "status": "ok",
        "architecture": "multi-agent",
        "sarvam_configured": bool(os.getenv("SARVAM_API_KEY", "").strip()),
    }


@app.get("/api/case")
def get_case():
    return MOCK_CASE


@app.get("/api/transcript")
def get_transcript():
    return MOCK_UTTERANCES


@app.get("/api/analysis")
def get_analysis():
    analysis = load_analysis()
    return {"generated": analysis is not None, "analysis": analysis}


@app.post("/api/analyze")
def analyze_case():
    try:
        result = CaseManager().run(MOCK_CASE, MOCK_UTTERANCES)
        save_analysis(result)
        return result
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/ask")
def ask_case(request: QuestionRequest):
    analysis = load_analysis()
    if analysis is None:
        raise HTTPException(status_code=409, detail="Run the multi-agent analysis first.")
    try:
        result = RetrievalService().answer(
            request.question, MOCK_CASE, MOCK_UTTERANCES, analysis
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "answer": result.get("answer", "The evidence is insufficient."),
        "citations": citation_details(result.get("citation_ids", [])),
        "related_claim_ids": result.get("related_claim_ids", []),
        "warning": result.get("warning", "Review the original evidence."),
        "answered": bool(result.get("answered", False)),
    }
