"""
Agent 1 — Storm Watcher (LoopAgent)
Monitors NOAA/NWS APIs in a continuous loop, escalates threat levels,
and triggers downstream agents when a threshold is crossed.
"""
import asyncio
import uuid
from datetime import datetime
from typing import Optional

from models.types import (
    AgentMessage, AgentStatus, AgentTrace, MessageEventType,
    OutputType, ThreatLevel, WeatherObservation, ActiveStorm, NWSAlert
)
from tools.noaa_tools import (
    compute_threat_level, fetch_ktpa_observations,
    fetch_nhc_active_storms, fetch_nws_alerts
)

LOOP_MAX_ITERATIONS = 4
ESCALATION_THRESHOLD = ThreatLevel.WATCH


class StormWatcherAgent:
    """
    LoopAgent — continuously polls NOAA/NWS APIs and escalates severity.
    Loop terminates when threat level stabilises or max iterations reached.
    """
    AGENT_ID = "storm-watcher"
    AGENT_NAME = "Storm Watcher"

    def __init__(self, run_id: str):
        self.run_id = run_id
        self.status = AgentStatus.IDLE
        self.loop_iteration = 0
        self.messages: list[AgentMessage] = []
        self.trace: Optional[AgentTrace] = None

    def _emit(self, to: str, event_type: MessageEventType,
              content: str, payload: dict) -> AgentMessage:
        msg = AgentMessage(
            id=str(uuid.uuid4()),
            from_agent=self.AGENT_ID,
            to_agent=to,
            event_type=event_type,
            content=content,
            payload=payload,
        )
        self.messages.append(msg)
        return msg

    async def run(self) -> dict:
        """Execute the LoopAgent — up to LOOP_MAX_ITERATIONS poll cycles."""
        self.status = AgentStatus.ACTIVE
        started = datetime.utcnow()

        observation: Optional[WeatherObservation] = None
        alerts: list[NWSAlert] = []
        storms: list[ActiveStorm] = []
        threat_level = ThreatLevel.NONE
        prev_threat = ThreatLevel.NONE

        for i in range(1, LOOP_MAX_ITERATIONS + 1):
            self.loop_iteration = i

            # Parallel fetch all three NOAA sources simultaneously
            obs_task = asyncio.create_task(fetch_ktpa_observations())
            alerts_task = asyncio.create_task(fetch_nws_alerts())
            storms_task = asyncio.create_task(fetch_nhc_active_storms())
            results = await asyncio.gather(obs_task, alerts_task, storms_task,
                                           return_exceptions=True)

            observation = results[0] if not isinstance(results[0], Exception) else observation
            alerts = results[1] if not isinstance(results[1], Exception) else alerts
            storms = results[2] if not isinstance(results[2], Exception) else storms

            threat_level = compute_threat_level(observation, alerts, storms)

            wind_kt = round((observation.wind_speed_ms * 1.94384), 1) if observation else 0.0
            temp_f = round((observation.temperature_c * 9/5) + 32, 1) if observation else 0.0

            self._emit(
                to="orchestrator",
                event_type=MessageEventType.STATUS,
                content=f"Loop {i}: {threat_level.value} — {wind_kt}kt winds, "
                        f"{len(alerts)} Tampa Bay alerts, {len(storms)} active storms",
                payload={
                    "loop": i,
                    "threat_level": threat_level.value,
                    "wind_kt": wind_kt,
                    "temp_f": temp_f,
                    "alert_count": len(alerts),
                    "storm_count": len(storms),
                    "source": "NOAA/NWS"
                }
            )

            # Escalation detected — trigger downstream agents immediately
            if threat_level.value != prev_threat.value and i > 1:
                self._emit(
                    to="vulnerability-mapper",
                    event_type=MessageEventType.ALERT,
                    content=f"ESCALATION: {prev_threat.value} → {threat_level.value}. "
                            f"Triggering vulnerability analysis.",
                    payload={"threat_level": threat_level.value, "loop": i}
                )

            prev_threat = threat_level

            # Terminate loop early if threat is stable and above threshold
            if i >= 2 and threat_level == prev_threat:
                break

            if i < LOOP_MAX_ITERATIONS:
                await asyncio.sleep(0.1)  # Brief pause between loop iterations

        # Final broadcast to all downstream agents
        self._emit(
            to="vulnerability-mapper",
            event_type=MessageEventType.DATA,
            content=f"Storm Watcher complete. Final threat: {threat_level.value}. "
                    f"Passing data to parallel analysis agents.",
            payload={
                "threat_level": threat_level.value,
                "observation": {
                    "station": observation.station if observation else "KTPA",
                    "temp_c": observation.temperature_c if observation else None,
                    "wind_ms": observation.wind_speed_ms if observation else None,
                    "description": observation.description if observation else "Unknown",
                } if observation else None,
                "alert_count": len(alerts),
                "storm_count": len(storms),
                "alerts": [{"event": a.event, "severity": a.severity,
                             "area": a.area_desc} for a in alerts[:5]],
                "storms": [{"name": s.name, "category": s.category,
                             "wind_kt": s.wind_kt,
                             "distance_miles": s.distance_miles} for s in storms],
            }
        )

        self.status = AgentStatus.COMPLETE
        completed = datetime.utcnow()
        exec_ms = int((completed - started).total_seconds() * 1000)

        self.trace = AgentTrace(
            agent_id=self.AGENT_ID,
            agent_name=self.AGENT_NAME,
            run_id=self.run_id,
            status=self.status,
            confidence=100.0,
            loop_iteration=self.loop_iteration,
            input_payload={"mode": "live", "sources": ["KTPA", "NWS", "NHC"]},
            output_payload={
                "threat_level": threat_level.value,
                "loop_iterations": self.loop_iteration,
                "alerts": len(alerts),
                "storms": len(storms),
            },
            output_type=OutputType.DETERMINISTIC,
            llm_narrative=None,
            deterministic_rationale=(
                f"Threat level computed from {len(alerts)} NWS alerts, "
                f"{len(storms)} NHC storms, KTPA wind={wind_kt}kt using "
                f"compute_threat_level() thresholds."
            ),
            started_at=started,
            completed_at=completed,
            execution_ms=exec_ms,
        )

        return {
            "threat_level": threat_level.value,
            "observation": observation,
            "alerts": alerts,
            "storms": storms,
            "loop_iterations": self.loop_iteration,
            "messages": self.messages,
            "trace": self.trace,
        }
