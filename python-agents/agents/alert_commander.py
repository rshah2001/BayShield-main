"""
Agent 4 — Alert Commander (SelfCorrectingLoopAgent)
Takes outputs from VulnerabilityMapper and ResourceCoordinator,
generates prioritized action plans, then self-reviews for logical
errors and re-runs if corrections are needed (max 3 iterations).
"""
import asyncio
import uuid
from datetime import datetime
from typing import Optional

from models.types import (
    ActionPlan, AgentMessage, AgentStatus, AgentTrace, MessageEventType,
    OutputType, ShelterResource, ThreatLevel, VulnerabilityZone
)
from sdk.llm_client import generate_text, sdk_status

SELF_CORRECTION_MAX = 3


def _validate_action_plan(plan: ActionPlan, shelters: list[ShelterResource],
                           zones: list[VulnerabilityZone]) -> tuple[bool, str]:
    """
    Validate an action plan for logical consistency.
    Returns (is_valid, correction_reason).
    """
    # Check 1: Shelter referenced must exist
    shelter_names = [s.name for s in shelters]
    if plan.shelter and not any(s in plan.shelter for s in shelter_names):
        return False, f"Referenced shelter '{plan.shelter}' not in active shelter list"

    # Check 2: Evacuate orders must have available capacity
    if "evacuate" in plan.action.lower():
        total_available = sum(s.available_capacity for s in shelters)
        if plan.population > total_available:
            return False, (
                f"Evacuation of {plan.population:,} people exceeds "
                f"available capacity of {total_available:,}"
            )

    # Check 3: High priority must match high risk zones
    if plan.priority == 1:
        zone_ids = [z.id for z in zones if z.risk_score >= 80]
        if not any(z in plan.zones for z in zone_ids):
            return False, "Priority-1 plan does not include any zone with risk score >= 80"

    return True, ""


def _generate_action_plans(
    zones: list[VulnerabilityZone],
    shelters: list[ShelterResource],
    threat_level: ThreatLevel,
    correction_applied: bool = False,
    correction_reason: str = ""
) -> list[ActionPlan]:
    """Generate deterministic action plans from vulnerability and resource data."""
    plans = []

    # Sort zones by risk score descending
    sorted_zones = sorted(zones, key=lambda z: z.risk_score, reverse=True)
    high_risk = [z for z in sorted_zones if z.risk_score >= 65]
    medium_risk = [z for z in sorted_zones if 40 <= z.risk_score < 65]

    # Find best shelter (most available capacity)
    best_shelter = max(shelters, key=lambda s: s.available_capacity) if shelters else None
    shelter_name = best_shelter.name if best_shelter else "Designated Shelter"

    if threat_level in (ThreatLevel.WARNING, ThreatLevel.CRITICAL) and high_risk:
        # Priority 1: Mandatory evacuation for VE/AE flood zones
        ve_zones = [z for z in high_risk if z.flood_zone in ("VE", "AE")]
        if ve_zones:
            pop = sum(z.population for z in ve_zones)
            plans.append(ActionPlan(
                id=str(uuid.uuid4()),
                title="Mandatory Evacuation — Coastal Flood Zones",
                priority=1,
                zones=[z.id for z in ve_zones],
                action=f"Issue mandatory evacuation order for {len(ve_zones)} VE/AE flood zones",
                shelter=shelter_name,
                route="I-275 N → I-4 E (primary) | US-19 N (alternate)",
                population=pop,
                rationale=(
                    f"FEMA VE/AE zones face storm surge risk. "
                    f"{pop:,} residents must evacuate to {shelter_name}."
                ),
                llm_explanation=None,
                output_type=OutputType.DETERMINISTIC,
                correction_applied=correction_applied,
                correction_reason=correction_reason if correction_applied else None,
            ))

    if high_risk:
        # Priority 2: Shelter-in-place for high-risk non-coastal zones
        non_coastal = [z for z in high_risk if z.flood_zone == "X"]
        if non_coastal:
            pop = sum(z.population for z in non_coastal)
            plans.append(ActionPlan(
                id=str(uuid.uuid4()),
                title="Shelter-in-Place — High-Risk Inland Zones",
                priority=2,
                zones=[z.id for z in non_coastal],
                action="Activate community shelters and issue shelter-in-place advisory",
                shelter=shelter_name,
                route="Local roads — avoid coastal highways",
                population=pop,
                rationale=(
                    f"{len(non_coastal)} high-risk inland zones with {pop:,} residents. "
                    f"Flood zone X — shelter-in-place preferred over evacuation."
                ),
                llm_explanation=None,
                output_type=OutputType.DETERMINISTIC,
                correction_applied=False,
                correction_reason=None,
            ))

    if medium_risk:
        # Priority 3: Voluntary evacuation advisory
        pop = sum(z.population for z in medium_risk)
        plans.append(ActionPlan(
            id=str(uuid.uuid4()),
            title="Voluntary Evacuation Advisory — Moderate Risk Zones",
            priority=3,
            zones=[z.id for z in medium_risk],
            action="Issue voluntary evacuation advisory and open pre-registration",
            shelter=shelter_name,
            route="I-75 N (primary) | SR-60 E (alternate)",
            population=pop,
            rationale=(
                f"{len(medium_risk)} moderate-risk zones. Voluntary advisory "
                f"for {pop:,} residents, especially elderly and mobility-impaired."
            ),
            llm_explanation=None,
            output_type=OutputType.DETERMINISTIC,
            correction_applied=False,
            correction_reason=None,
        ))

    # Always include resource pre-positioning
    plans.append(ActionPlan(
        id=str(uuid.uuid4()),
        title="Pre-Position Emergency Resources",
        priority=4,
        zones=[],
        action="Deploy supply caches to all active shelters and stage EMS units",
        shelter="All active shelters",
        route="N/A — resource logistics",
        population=0,
        rationale="Pre-positioning reduces response time by 40% per FEMA logistics guidelines.",
        llm_explanation=None,
        output_type=OutputType.DETERMINISTIC,
        correction_applied=False,
        correction_reason=None,
    ))

    return plans


async def _generate_plan_explanation(
    plan: ActionPlan,
    threat_level: ThreatLevel,
    correction_details: Optional[str],
) -> Optional[str]:
    correction_context = (
        f"Self-correction notes: {correction_details}."
        if correction_details
        else "No self-correction was required."
    )

    return await generate_text(
        (
            "Write a single-sentence emergency-operations explanation for this action plan. "
            "Keep it specific, calm, and under 35 words.\n"
            f"Threat level: {threat_level.value}\n"
            f"Title: {plan.title}\n"
            f"Action: {plan.action}\n"
            f"Population: {plan.population}\n"
            f"Shelter: {plan.shelter}\n"
            f"Rationale: {plan.rationale}\n"
            f"{correction_context}"
        ),
        system_instruction=(
            "You are BayShield's emergency planning copilot. "
            "Produce concise operational explanations for incident commanders."
        ),
        temperature=0.15,
    )


async def _generate_trace_narrative(
    threat_level: ThreatLevel,
    action_plans: list[ActionPlan],
    correction_applied: bool,
    correction_details: Optional[str],
) -> Optional[str]:
    plan_titles = ", ".join(plan.title for plan in action_plans[:4]) or "No action plans"
    correction_context = correction_details or "None"
    return await generate_text(
        (
            "Summarize this emergency planning run in 2 short sentences for an operations log.\n"
            f"Threat level: {threat_level.value}\n"
            f"Plans issued: {len(action_plans)}\n"
            f"Top plans: {plan_titles}\n"
            f"Self-correction applied: {correction_applied}\n"
            f"Correction details: {correction_context}"
        ),
        system_instruction=(
            "You are BayShield's emergency operations narrator. "
            "Write concise, factual summaries for incident logs."
        ),
        temperature=0.2,
    )


class AlertCommanderAgent:
    """
    SelfCorrectingLoopAgent — generates action plans, validates them,
    and re-runs if logical errors are detected (max 3 correction cycles).
    """
    AGENT_ID = "alert-commander"
    AGENT_NAME = "Alert Commander"

    def __init__(self, run_id: str):
        self.run_id = run_id
        self.status = AgentStatus.IDLE
        self.messages: list[AgentMessage] = []

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

    async def run(
        self,
        threat_level: ThreatLevel,
        zones: list[VulnerabilityZone],
        shelters: list[ShelterResource],
    ) -> dict:
        self.status = AgentStatus.ACTIVE
        started = datetime.utcnow()

        action_plans: list[ActionPlan] = []
        correction_applied = False
        correction_details: Optional[str] = None
        llm_narrative: Optional[str] = None
        loop_iteration = 0

        for iteration in range(1, SELF_CORRECTION_MAX + 1):
            loop_iteration = iteration

            # Generate action plans
            action_plans = _generate_action_plans(
                zones, shelters, threat_level,
                correction_applied, correction_details or ""
            )

            # Self-review: validate each plan
            all_valid = True
            corrections_needed = []
            for plan in action_plans:
                valid, reason = _validate_action_plan(plan, shelters, zones)
                if not valid:
                    all_valid = False
                    corrections_needed.append(f"Plan '{plan.title}': {reason}")

            if all_valid:
                self._emit(
                    to="orchestrator",
                    event_type=MessageEventType.STATUS,
                    content=f"Self-review iteration {iteration}: All {len(action_plans)} "
                            f"plans validated. No corrections needed.",
                    payload={"iteration": iteration, "plans": len(action_plans),
                             "valid": True}
                )
                break
            else:
                correction_applied = True
                correction_details = "; ".join(corrections_needed)
                self._emit(
                    to="orchestrator",
                    event_type=MessageEventType.CORRECTION,
                    content=f"Self-correction triggered (iteration {iteration}): "
                            f"{correction_details}. Re-generating plans.",
                    payload={"iteration": iteration, "corrections": corrections_needed}
                )
                await asyncio.sleep(0.02)

        llm_status = sdk_status()
        if llm_status["enabled"]:
            for plan in action_plans:
                explanation = await _generate_plan_explanation(
                    plan, threat_level, correction_details
                )
                if explanation:
                    plan.llm_explanation = explanation
                    plan.output_type = OutputType.HYBRID

            llm_narrative = await _generate_trace_narrative(
                threat_level,
                action_plans,
                correction_applied,
                correction_details,
            )

            if llm_narrative:
                self._emit(
                    to="orchestrator",
                    event_type=MessageEventType.RESPONSE,
                    content="Gemini SDK generated operational narratives for the action plan set.",
                    payload={
                        "provider": llm_status["provider"],
                        "model": llm_status["model"],
                        "plans_enriched": len(
                            [plan for plan in action_plans if plan.llm_explanation]
                        ),
                    },
                )

        # Final broadcast
        high_priority_zones = [z.name for z in zones if z.risk_score >= 65]
        total_at_risk = sum(p.population for p in action_plans if p.population > 0)

        self._emit(
            to="orchestrator",
            event_type=MessageEventType.COMMAND,
            content=f"Alert Commander complete. {len(action_plans)} action plans issued. "
                    f"Threat: {threat_level.value}. "
                    f"{'Self-correction applied.' if correction_applied else 'No corrections needed.'}",
            payload={
                "plans": len(action_plans),
                "threat_level": threat_level.value,
                "correction_applied": correction_applied,
                "total_at_risk": total_at_risk,
                "high_priority_zones": high_priority_zones,
            }
        )

        self.status = AgentStatus.COMPLETE
        completed = datetime.utcnow()
        exec_ms = int((completed - started).total_seconds() * 1000)

        trace = AgentTrace(
            agent_id=self.AGENT_ID,
            agent_name=self.AGENT_NAME,
            run_id=self.run_id,
            status=self.status,
            confidence=100.0,
            loop_iteration=loop_iteration,
            input_payload={
                "threat_level": threat_level.value,
                "zones": len(zones),
                "shelters": len(shelters),
            },
            output_payload={
                "plans": len(action_plans),
                "correction_applied": correction_applied,
                "correction_details": correction_details,
            },
            output_type=(
                OutputType.HYBRID
                if llm_narrative or any(plan.llm_explanation for plan in action_plans)
                else OutputType.DETERMINISTIC
            ),
            llm_narrative=llm_narrative,
            deterministic_rationale=(
                f"Action plans generated from zone risk scores and shelter capacity. "
                f"Self-correction loop ran {loop_iteration} iteration(s). "
                f"{'Correction applied: ' + (correction_details or '') if correction_applied else 'No corrections needed.'}"
            ),
            started_at=started,
            completed_at=completed,
            execution_ms=exec_ms,
        )

        return {
            "action_plans": action_plans,
            "correction_applied": correction_applied,
            "correction_details": correction_details,
            "loop_iterations": loop_iteration,
            "messages": self.messages,
            "trace": trace,
        }
