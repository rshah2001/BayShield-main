"""
BayShield ADK Orchestration Pipeline

Execution order:
  Phase 1: Storm Watcher (LoopAgent) — serial, must complete first
  Phase 2: VulnerabilityMapper + ResourceCoordinator (ParallelAgent) — concurrent
  Phase 3: AlertCommander (SelfCorrectingLoopAgent) — serial, uses Phase 2 outputs

This mirrors the Google ADK ParallelAgent + LoopAgent pattern required by the challenge.
"""
import asyncio
import uuid
from datetime import datetime
from typing import AsyncGenerator

from models.types import (
    AgentMessage, AgentTrace, PipelineResult, ThreatLevel
)
from agents.storm_watcher import StormWatcherAgent
from agents.parallel_agents import VulnerabilityMapperAgent, ResourceCoordinatorAgent
from agents.alert_commander import AlertCommanderAgent


async def run_pipeline(mode: str = "live") -> PipelineResult:
    """
    Execute the full BayShield agent pipeline.
    Returns a complete PipelineResult with all traces, messages, and outputs.
    """
    run_id = str(uuid.uuid4())
    all_messages: list[AgentMessage] = []
    all_traces: list[AgentTrace] = []

    # ── Phase 1: Storm Watcher (LoopAgent) ──────────────────────────────────
    print(f"[Pipeline] Phase 1: Storm Watcher starting (run_id={run_id})")
    watcher = StormWatcherAgent(run_id)
    watcher_result = await watcher.run()

    all_messages.extend(watcher_result["messages"])
    if watcher_result["trace"]:
        all_traces.append(watcher_result["trace"])

    threat_level = ThreatLevel(watcher_result["threat_level"])
    observation = watcher_result["observation"]
    alerts = watcher_result["alerts"]
    storms = watcher_result["storms"]

    print(f"[Pipeline] Phase 1 complete. Threat: {threat_level.value}, "
          f"Alerts: {len(alerts)}, Storms: {len(storms)}")

    # ── Phase 2: ParallelAgent — VulnerabilityMapper + ResourceCoordinator ──
    print("[Pipeline] Phase 2: Parallel agents starting (VulnerabilityMapper + ResourceCoordinator)")
    mapper = VulnerabilityMapperAgent(run_id)
    coordinator = ResourceCoordinatorAgent(run_id)

    # asyncio.gather = ParallelAgent pattern — both run simultaneously
    mapper_result, coordinator_result = await asyncio.gather(
        mapper.run(threat_level, alerts),
        coordinator.run(threat_level),
    )

    all_messages.extend(mapper_result["messages"])
    all_messages.extend(coordinator_result["messages"])
    all_traces.append(mapper_result["trace"])
    all_traces.append(coordinator_result["trace"])

    zones = mapper_result["zones"]
    shelters = coordinator_result["shelters"]
    total_at_risk = mapper_result["total_at_risk"]

    print(f"[Pipeline] Phase 2 complete. Zones: {len(zones)}, "
          f"Shelters: {len(shelters)}, At risk: {total_at_risk:,}")

    # ── Phase 3: Alert Commander (SelfCorrectingLoopAgent) ──────────────────
    print("[Pipeline] Phase 3: Alert Commander starting (SelfCorrectingLoopAgent)")
    commander = AlertCommanderAgent(run_id)
    commander_result = await commander.run(threat_level, zones, shelters)

    all_messages.extend(commander_result["messages"])
    all_traces.append(commander_result["trace"])

    action_plans = commander_result["action_plans"]
    correction_applied = commander_result["correction_applied"]
    correction_details = commander_result["correction_details"]

    print(f"[Pipeline] Phase 3 complete. Plans: {len(action_plans)}, "
          f"Correction: {correction_applied}")

    # ── Assemble final result ────────────────────────────────────────────────
    return PipelineResult(
        run_id=run_id,
        threat_level=threat_level,
        weather=observation,
        active_storm=storms[0] if storms else None,
        nws_alerts=alerts,
        vulnerability_zones=zones,
        shelters=shelters,
        action_plans=action_plans,
        agent_traces=all_traces,
        messages=all_messages,
        total_population_at_risk=total_at_risk,
        self_correction_applied=correction_applied,
        correction_details=correction_details,
        completed_at=datetime.utcnow(),
    )


async def stream_pipeline(mode: str = "live") -> AsyncGenerator[dict, None]:
    """
    Stream pipeline progress as Server-Sent Events.
    Yields status updates as each phase completes.
    """
    run_id = str(uuid.uuid4())
    all_messages: list[AgentMessage] = []
    all_traces: list[AgentTrace] = []

    yield {"event": "pipeline_start", "run_id": run_id, "mode": mode,
           "timestamp": datetime.utcnow().isoformat()}

    # Phase 1
    yield {"event": "agent_start", "agent": "storm-watcher",
           "phase": 1, "pattern": "LoopAgent"}
    watcher = StormWatcherAgent(run_id)
    watcher_result = await watcher.run()
    all_messages.extend(watcher_result["messages"])
    if watcher_result["trace"]:
        all_traces.append(watcher_result["trace"])

    threat_level = ThreatLevel(watcher_result["threat_level"])
    observation = watcher_result["observation"]
    alerts = watcher_result["alerts"]
    storms = watcher_result["storms"]

    yield {
        "event": "agent_complete",
        "agent": "storm-watcher",
        "phase": 1,
        "threat_level": threat_level.value,
        "loop_iterations": watcher_result["loop_iterations"],
        "alert_count": len(alerts),
        "storm_count": len(storms),
        "confidence": 100,
        "messages": [
            {"from": m.from_agent, "to": m.to_agent,
             "event_type": m.event_type.value, "content": m.content,
             "payload": m.payload}
            for m in watcher_result["messages"]
        ],
    }

    # Phase 2 — parallel
    yield {"event": "parallel_start", "agents": ["vulnerability-mapper", "resource-coordinator"],
           "phase": 2, "pattern": "ParallelAgent"}

    mapper = VulnerabilityMapperAgent(run_id)
    coordinator = ResourceCoordinatorAgent(run_id)
    mapper_result, coordinator_result = await asyncio.gather(
        mapper.run(threat_level, alerts),
        coordinator.run(threat_level),
    )
    all_messages.extend(mapper_result["messages"])
    all_messages.extend(coordinator_result["messages"])
    all_traces.append(mapper_result["trace"])
    all_traces.append(coordinator_result["trace"])

    zones = mapper_result["zones"]
    shelters = coordinator_result["shelters"]

    yield {
        "event": "parallel_complete",
        "phase": 2,
        "vulnerability_mapper": {
            "zones": len(zones),
            "high_risk": len(mapper_result["high_risk_zones"]),
            "total_at_risk": mapper_result["total_at_risk"],
            "confidence": 100,
            "messages": [
                {"from": m.from_agent, "to": m.to_agent,
                 "event_type": m.event_type.value, "content": m.content}
                for m in mapper_result["messages"]
            ],
        },
        "resource_coordinator": {
            "shelters": len(shelters),
            "available_capacity": coordinator_result["available_capacity"],
            "confidence": 100,
            "messages": [
                {"from": m.from_agent, "to": m.to_agent,
                 "event_type": m.event_type.value, "content": m.content}
                for m in coordinator_result["messages"]
            ],
        },
    }

    # Phase 3
    yield {"event": "agent_start", "agent": "alert-commander",
           "phase": 3, "pattern": "SelfCorrectingLoopAgent"}
    commander = AlertCommanderAgent(run_id)
    commander_result = await commander.run(threat_level, zones, shelters)
    all_messages.extend(commander_result["messages"])
    all_traces.append(commander_result["trace"])

    yield {
        "event": "agent_complete",
        "agent": "alert-commander",
        "phase": 3,
        "plans": len(commander_result["action_plans"]),
        "correction_applied": commander_result["correction_applied"],
        "correction_details": commander_result["correction_details"],
        "loop_iterations": commander_result["loop_iterations"],
        "confidence": 100,
        "messages": [
            {"from": m.from_agent, "to": m.to_agent,
             "event_type": m.event_type.value, "content": m.content}
            for m in commander_result["messages"]
        ],
    }

    # Final result
    yield {
        "event": "pipeline_complete",
        "run_id": run_id,
        "threat_level": threat_level.value,
        "total_at_risk": mapper_result["total_at_risk"],
        "action_plans": len(commander_result["action_plans"]),
        "self_correction_applied": commander_result["correction_applied"],
        "agent_count": 4,
        "message_count": len(all_messages),
        "completed_at": datetime.utcnow().isoformat(),
    }
