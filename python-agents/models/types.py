"""Shared data models for the BayShield ADK agent service."""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class ThreatLevel(str, Enum):
    NONE = "NONE"
    MONITORING = "MONITORING"
    WATCH = "WATCH"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class AgentStatus(str, Enum):
    IDLE = "idle"
    ACTIVE = "active"
    COMPLETE = "complete"
    ERROR = "error"


class MessageEventType(str, Enum):
    ALERT = "ALERT"
    DATA = "DATA"
    RESPONSE = "RESPONSE"
    CORRECTION = "CORRECTION"
    COMMAND = "COMMAND"
    STATUS = "STATUS"


class OutputType(str, Enum):
    DETERMINISTIC = "deterministic"
    LLM = "llm"
    HYBRID = "hybrid"
    ESTIMATED = "estimated"


@dataclass
class WeatherObservation:
    station: str
    temperature_c: float
    wind_speed_ms: float
    wind_direction: str
    pressure_pa: float
    description: str
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ActiveStorm:
    name: str
    category: int
    wind_kt: float
    distance_miles: float
    bearing: str
    movement_mph: float
    lat: float
    lng: float


@dataclass
class NWSAlert:
    id: str
    event: str
    severity: str
    area_desc: str
    headline: str
    expires: Optional[str] = None
    affected_counties: list[str] = field(default_factory=list)
    polygon: list[list[list[float]]] = field(default_factory=list)
    centroid_lat: Optional[float] = None
    centroid_lng: Optional[float] = None


@dataclass
class VulnerabilityZone:
    id: str
    name: str
    flood_zone: str
    risk_score: int
    population: int
    elderly_pct: float
    low_income_pct: float
    mobility_impaired_pct: float
    lat: float
    lng: float
    status: str = "safe"
    source: str = "baseline"
    event: Optional[str] = None
    expires: Optional[str] = None
    affected_counties: list[str] = field(default_factory=list)
    polygons: list[list[list[float]]] = field(default_factory=list)


@dataclass
class ShelterResource:
    id: str
    name: str
    address: str
    capacity: int
    current_occupancy: int
    lat: float
    lng: float
    status: str = "open"
    source: str = "estimated"

    @property
    def available_capacity(self) -> int:
        return max(0, self.capacity - self.current_occupancy)

    @property
    def occupancy_pct(self) -> float:
        return round(self.current_occupancy / self.capacity * 100, 1)


@dataclass
class AgentMessage:
    id: str
    from_agent: str
    to_agent: str
    event_type: MessageEventType
    content: str
    payload: dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.utcnow)
    status: str = "sent"


@dataclass
class AgentTrace:
    agent_id: str
    agent_name: str
    run_id: str
    status: AgentStatus
    confidence: float
    loop_iteration: int
    input_payload: dict[str, Any]
    output_payload: dict[str, Any]
    output_type: OutputType
    llm_narrative: Optional[str]
    deterministic_rationale: str
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    execution_ms: Optional[int] = None


@dataclass
class ActionPlan:
    id: str
    title: str
    priority: int
    zones: list[str]
    action: str
    shelter: str
    route: str
    population: int
    rationale: str
    llm_explanation: Optional[str]
    output_type: OutputType
    correction_applied: bool = False
    correction_reason: Optional[str] = None


@dataclass
class PipelineResult:
    run_id: str
    threat_level: ThreatLevel
    weather: Optional[WeatherObservation]
    active_storm: Optional[ActiveStorm]
    nws_alerts: list[NWSAlert]
    vulnerability_zones: list[VulnerabilityZone]
    shelters: list[ShelterResource]
    action_plans: list[ActionPlan]
    agent_traces: list[AgentTrace]
    messages: list[AgentMessage]
    total_population_at_risk: int
    self_correction_applied: bool
    correction_details: Optional[str]
    completed_at: datetime = field(default_factory=datetime.utcnow)
