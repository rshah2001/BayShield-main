"""
BayShield ADK Agent Service — FastAPI server
Exposes the agent pipeline via REST and Server-Sent Events (SSE).
Runs on port 8001 by default (ADK_PORT env var), proxied by the Node.js backend.
"""
import asyncio
import json
import sys
import os
from datetime import datetime
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Add parent directory to path for imports
BASE_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.dirname(BASE_DIR)
sys.path.insert(0, BASE_DIR)

load_dotenv(os.path.join(PROJECT_ROOT, ".env.local"), override=False)
load_dotenv(os.path.join(PROJECT_ROOT, ".env"), override=False)

from orchestration.pipeline import run_pipeline, stream_pipeline
from sdk.llm_client import sdk_status
from tools.noaa_tools import (
    fetch_ktpa_observations, fetch_nws_alerts,
    fetch_nhc_active_storms, compute_threat_level
)

app = FastAPI(
    title="BayShield ADK Agent Service",
    description="Multi-agent disaster response pipeline for Tampa Bay",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PipelineRequest(BaseModel):
    mode: str = "live"


@app.get("/health")
async def health():
    llm = sdk_status()
    return {
        "status": "ok",
        "service": "BayShield ADK Agent Service",
        "version": "3.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "agents": [
            "storm-watcher (LoopAgent)",
            "vulnerability-mapper (ParallelAgent)",
            "resource-coordinator (ParallelAgent)",
            "alert-commander (SelfCorrectingLoopAgent)"
        ],
        "llm_sdk": llm,
    }


@app.get("/live-data")
async def get_live_data():
    """Fetch current NOAA/NWS data without running the full pipeline."""
    obs_task = asyncio.create_task(fetch_ktpa_observations())
    alerts_task = asyncio.create_task(fetch_nws_alerts())
    storms_task = asyncio.create_task(fetch_nhc_active_storms())
    results = await asyncio.gather(obs_task, alerts_task, storms_task,
                                   return_exceptions=True)

    observation = results[0] if not isinstance(results[0], Exception) else None
    alerts = results[1] if not isinstance(results[1], Exception) else []
    storms = results[2] if not isinstance(results[2], Exception) else []

    threat_level = compute_threat_level(observation, alerts, storms)

    return {
        "threat_level": threat_level.value,
        "observation": {
            "station": observation.station,
            "temperature_c": observation.temperature_c,
            "temperature_f": round(observation.temperature_c * 9/5 + 32, 1),
            "wind_speed_ms": observation.wind_speed_ms,
            "wind_speed_kt": round(observation.wind_speed_ms * 1.94384, 1),
            "wind_direction": observation.wind_direction,
            "pressure_pa": observation.pressure_pa,
            "description": observation.description,
            "timestamp": observation.timestamp.isoformat(),
        } if observation else None,
        "alerts": [
            {"id": a.id, "event": a.event, "severity": a.severity,
             "area_desc": a.area_desc, "headline": a.headline,
             "affected_counties": a.affected_counties,
             "polygon": a.polygon,
             "centroid_lat": a.centroid_lat,
             "centroid_lng": a.centroid_lng}
            for a in alerts
        ],
        "storms": [
            {"name": s.name, "category": s.category, "wind_kt": s.wind_kt,
             "distance_miles": s.distance_miles, "lat": s.lat, "lng": s.lng}
            for s in storms
        ],
        "fetched_at": datetime.utcnow().isoformat(),
        "sources": ["KTPA (NWS)", "NWS Alerts API", "NHC RSS"]
    }


@app.post("/run")
async def run_full_pipeline(req: PipelineRequest):
    """Run the full 4-agent pipeline and return complete results."""
    try:
        result = await run_pipeline(req.mode)
        return {
            "run_id": result.run_id,
            "threat_level": result.threat_level.value,
            "total_at_risk": result.total_population_at_risk,
            "self_correction_applied": result.self_correction_applied,
            "correction_details": result.correction_details,
            "weather": {
                "station": result.weather.station,
                "temperature_c": result.weather.temperature_c,
                "temperature_f": round(result.weather.temperature_c * 9/5 + 32, 1),
                "wind_speed_ms": result.weather.wind_speed_ms,
                "wind_speed_kt": round(result.weather.wind_speed_ms * 1.94384, 1),
                "wind_direction": result.weather.wind_direction,
                "pressure_pa": result.weather.pressure_pa,
                "description": result.weather.description,
                "timestamp": result.weather.timestamp.isoformat(),
            } if result.weather else None,
            "active_storm": {
                "name": result.active_storm.name,
                "category": result.active_storm.category,
                "wind_kt": result.active_storm.wind_kt,
                "distance_miles": result.active_storm.distance_miles,
                "bearing": result.active_storm.bearing,
                "movement_mph": result.active_storm.movement_mph,
                "lat": result.active_storm.lat,
                "lng": result.active_storm.lng,
            } if result.active_storm else None,
            "nws_alerts": [
                {
                    "id": a.id,
                    "event": a.event,
                    "severity": a.severity,
                    "area_desc": a.area_desc,
                    "headline": a.headline,
                    "expires": a.expires,
                    "affected_counties": a.affected_counties,
                    "polygon": a.polygon,
                    "centroid_lat": a.centroid_lat,
                    "centroid_lng": a.centroid_lng,
                }
                for a in result.nws_alerts
            ],
            "vulnerability_zones": [
                {
                    "id": z.id,
                    "name": z.name,
                    "flood_zone": z.flood_zone,
                    "risk_score": z.risk_score,
                    "population": z.population,
                    "elderly_pct": z.elderly_pct,
                    "low_income_pct": z.low_income_pct,
                    "mobility_impaired_pct": z.mobility_impaired_pct,
                    "lat": z.lat,
                    "lng": z.lng,
                    "status": z.status,
                    "source": z.source,
                    "event": z.event,
                    "expires": z.expires,
                    "affected_counties": z.affected_counties,
                    "polygons": z.polygons,
                }
                for z in result.vulnerability_zones
            ],
            "shelters": [
                {
                    "id": s.id,
                    "name": s.name,
                    "address": s.address,
                    "capacity": s.capacity,
                    "current_occupancy": s.current_occupancy,
                    "available_capacity": s.available_capacity,
                    "lat": s.lat,
                    "lng": s.lng,
                    "status": s.status,
                    "source": s.source,
                }
                for s in result.shelters
            ],
            "action_plans": [
                {
                    "id": p.id,
                    "title": p.title,
                    "priority": p.priority,
                    "action": p.action,
                    "shelter": p.shelter,
                    "route": p.route,
                    "population": p.population,
                    "rationale": p.rationale,
                    "llm_explanation": p.llm_explanation,
                    "output_type": p.output_type.value,
                    "correction_applied": p.correction_applied,
                }
                for p in result.action_plans
            ],
            "agent_traces": [
                {
                    "agent_id": t.agent_id,
                    "agent_name": t.agent_name,
                    "status": t.status.value,
                    "confidence": t.confidence,
                    "loop_iteration": t.loop_iteration,
                    "input_payload": t.input_payload,
                    "output_payload": t.output_payload,
                    "output_type": t.output_type.value,
                    "llm_narrative": t.llm_narrative,
                    "deterministic_rationale": t.deterministic_rationale,
                    "started_at": t.started_at.isoformat() if t.started_at else None,
                    "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                    "execution_ms": t.execution_ms,
                }
                for t in result.agent_traces
            ],
            "messages": [
                {
                    "id": m.id,
                    "from_agent": m.from_agent,
                    "to_agent": m.to_agent,
                    "event_type": m.event_type.value,
                    "content": m.content,
                    "payload": m.payload,
                    "timestamp": m.timestamp.isoformat(),
                }
                for m in result.messages
            ],
            "completed_at": result.completed_at.isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stream")
async def stream_pipeline_sse(mode: str = "live"):
    """
    Stream the pipeline execution as Server-Sent Events.
    The frontend connects to this endpoint to receive live agent updates.
    """
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            async for event in stream_pipeline(mode):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"
        yield "data: {\"event\": \"done\"}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


if __name__ == "__main__":
    import uvicorn
    adk_port = int(os.environ.get("ADK_PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=adk_port, log_level="info")
