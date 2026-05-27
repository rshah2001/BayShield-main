import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  RadioTower,
  ShieldAlert,
  Siren,
  Users,
  Waves,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  ActionPlan,
  AgentState,
  Alert,
  Resource,
  ThreatLevel,
  WeatherData,
} from '@/lib/stormData';
import type { LiveWeatherData } from '@/hooks/useLiveWeather';

type LiveZone = {
  id: string;
  name: string;
  floodZone: string;
  riskScore: number;
  population: number;
  elderlyPct: number;
  lowIncomePct: number;
  mobilityImpairedPct: number;
  lat: number;
  lng: number;
  status: string;
  source?: string;
  event?: string | null;
  expires?: string | null;
  affectedCounties?: string[];
  polygons?: number[][][];
};

type Severity = 'stable' | 'watch' | 'critical';

type RecommendedAction = {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
};

type KpiCard = {
  id: string;
  label: string;
  value: string;
  trendText: string;
  trendDirection: 'up' | 'down';
  status: string;
  context: string;
  severity: Severity;
  icon: LucideIcon;
};

type AgentInsight = {
  id: string;
  name: string;
  decision: string;
  confidence: number;
  reason: string;
};

type FeedInsight = {
  alertCount: number;
  alertTypes: string[];
  reliabilityLabel: string;
  reliabilityTone: Severity;
  lastUpdatedLabel: string;
  nextUpdateLabel: string;
};

const PANEL_TONES: Record<Severity, { border: string; bg: string; text: string; accent: string }> = {
  stable: {
    border: 'border-emerald-400/20',
    bg: 'bg-emerald-400/10',
    text: 'text-emerald-200',
    accent: '#34d399',
  },
  watch: {
    border: 'border-amber-400/20',
    bg: 'bg-amber-400/10',
    text: 'text-amber-200',
    accent: '#fbbf24',
  },
  critical: {
    border: 'border-red-400/20',
    bg: 'bg-red-400/10',
    text: 'text-red-200',
    accent: '#f87171',
  },
};

function formatDateLabel(value: Date | null) {
  if (!value) return 'Awaiting first live decision';
  return value.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCountdown(target: Date | null, now: number) {
  if (!target) return 'Pending';
  const deltaMs = target.getTime() - now;
  if (deltaMs <= 0) return 'Syncing now';
  const minutes = Math.floor(deltaMs / 60_000);
  const seconds = Math.floor((deltaMs % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getFeedReliability(liveWeather: LiveWeatherData | null, lastDecisionTime: Date | null): { label: string; tone: Severity } {
  if (liveWeather?.error) {
    return { label: 'Degraded feed', tone: 'critical' };
  }
  if (!lastDecisionTime) {
    return { label: 'Connecting', tone: 'watch' };
  }
  const ageMinutes = (Date.now() - lastDecisionTime.getTime()) / 60_000;
  if (ageMinutes <= 3) return { label: 'High reliability', tone: 'stable' };
  if (ageMinutes <= 8) return { label: 'Monitoring latency', tone: 'watch' };
  return { label: 'Stale snapshot', tone: 'critical' };
}

function deriveDecisionSupport(input: {
  threatLevel: ThreatLevel;
  weather: WeatherData;
  liveWeather: LiveWeatherData | null;
  alerts: Alert[];
  agents: AgentState[];
  shelters: Resource[];
  vulnerabilityZones: LiveZone[];
  totalPopulationAtRisk: number;
  actionPlans: ActionPlan[];
  lastDecisionTime: Date | null;
  nextUpdateTime: Date | null;
}) {
  const { alerts, agents, shelters, vulnerabilityZones, threatLevel, weather, liveWeather, totalPopulationAtRisk, actionPlans, lastDecisionTime, nextUpdateTime } = input;

  const shelterResources = shelters.filter(resource => resource.type === 'shelter');
  const totalShelterCapacity = shelterResources.reduce((sum, shelter) => sum + shelter.capacity, 0);
  const totalShelterOccupancy = shelterResources.reduce((sum, shelter) => sum + shelter.currentOccupancy, 0);
  const shelterBufferPct = totalShelterCapacity > 0
    ? Math.round(((totalShelterCapacity - totalShelterOccupancy) / totalShelterCapacity) * 100)
    : 0;

  const sortedZones = vulnerabilityZones.slice().sort((a, b) => b.riskScore - a.riskScore);
  const topZone = sortedZones[0] ?? null;
  const hotZones = sortedZones.filter(zone => zone.status === 'evacuate' || zone.riskScore >= 80);
  const watchZones = sortedZones.filter(zone => zone.status === 'warning' || zone.riskScore >= 65);
  const windMph = liveWeather?.observation?.windSpeedMph ?? Math.round(weather.windSpeed * 1.15078);
  const windThresholdMph = 34;
  const windThresholdPct = Math.round((windMph / windThresholdMph) * 100);
  const alertTypes = Array.from(new Set(alerts.map(alert => alert.message.split(':')[0] || alert.zone))).slice(0, 4);

  const recommendedActions: RecommendedAction[] = [];

  if (hotZones.length === 0 && alerts.length === 0 && windMph < 20) {
    recommendedActions.push({
      id: 'all-clear',
      title: 'No evacuation required',
      detail: 'No official Tampa Bay alert polygons are active, winds remain below operational thresholds, and shelter posture can stay in monitoring mode.',
      severity: 'stable',
    });
  }

  if (topZone && (topZone.status === 'evacuate' || topZone.riskScore >= 80)) {
    recommendedActions.push({
      id: 'zone-priority',
      title: `Prioritize ${topZone.name}`,
      detail: `${topZone.population.toLocaleString()} people sit inside the highest-risk footprint. Pre-stage transport, comms, and ingress control before conditions tighten.`,
      severity: 'critical',
    });
  }

  if (shelterBufferPct < 10) {
    recommendedActions.push({
      id: 'capacity-buffer',
      title: 'Pre-stage overflow shelter resources',
      detail: `Only ${shelterBufferPct}% capacity remains across active shelters. Open overflow options and validate staffing before new alerts trigger arrivals.`,
      severity: 'critical',
    });
  } else if (shelterBufferPct < 25) {
    recommendedActions.push({
      id: 'buffer-watch',
      title: 'Protect shelter capacity buffer',
      detail: `${shelterBufferPct}% capacity remains. Hold back non-critical allocations and prepare overflow routing if another zone escalates.`,
      severity: 'watch',
    });
  }

  if (windMph >= 20) {
    recommendedActions.push({
      id: 'wind-escalation',
      title: 'Monitor wind escalation',
      detail: `${windMph} mph sustained winds are at ${windThresholdPct}% of tropical-storm threshold. Stage field teams inland and watch for alert severity upgrades.`,
      severity: windMph >= 28 ? 'critical' : 'watch',
    });
  }

  if (alerts.length > 0 && actionPlans.length === 0) {
    recommendedActions.push({
      id: 'alert-review',
      title: 'Convert active alerts into incident tasks',
      detail: `${alerts.length} alert${alerts.length === 1 ? '' : 's'} are active but no explicit infrastructure plan is published yet. Assign an operator to validate protective actions and shelter routing.`,
      severity: 'watch',
    });
  }

  const dedupedActions = recommendedActions
    .filter((action, index, arr) => arr.findIndex(candidate => candidate.id === action.id) === index)
    .slice(0, 3);

  const kpis: KpiCard[] = [
    {
      id: 'population',
      label: 'Population Exposed',
      value: totalPopulationAtRisk.toLocaleString(),
      trendText: hotZones.length > 0 ? `↑ ${hotZones.length} hotspot${hotZones.length === 1 ? '' : 's'} above action line` : '↓ below action threshold',
      trendDirection: hotZones.length > 0 ? 'up' : 'down',
      status: hotZones.length > 0 ? 'Action required' : 'Below action threshold',
      context: topZone
        ? `${topZone.name} is the lead footprint at ${topZone.riskScore}/100.`
        : 'No active official polygon is elevating population exposure.',
      severity: hotZones.length > 0 ? 'critical' : watchZones.length > 0 ? 'watch' : 'stable',
      icon: Users,
    },
    {
      id: 'shelter-buffer',
      label: 'Shelter Capacity Buffer',
      value: `${shelterBufferPct}%`,
      trendText: shelterBufferPct < 10 ? `↓ ${Math.abs(shelterBufferPct - 10)} pts below safe reserve` : `↑ ${shelterBufferPct - 10} pts above critical floor`,
      trendDirection: shelterBufferPct < 10 ? 'down' : 'up',
      status: shelterBufferPct < 10 ? 'Critical (<10%)' : shelterBufferPct < 25 ? 'Watch (reserve shrinking)' : 'Healthy reserve',
      context: `${(totalShelterCapacity - totalShelterOccupancy).toLocaleString()} spaces remain across ${shelterResources.length} shelters.`,
      severity: shelterBufferPct < 10 ? 'critical' : shelterBufferPct < 25 ? 'watch' : 'stable',
      icon: ShieldAlert,
    },
    {
      id: 'wind-signal',
      label: 'Wind Signal',
      value: `${windMph} mph`,
      trendText: windMph >= 20 ? `↑ ${windThresholdPct}% of storm-watch threshold` : `↓ ${100 - windThresholdPct}% below storm-watch threshold`,
      trendDirection: windMph >= 20 ? 'up' : 'down',
      status: windMph >= 28 ? 'Escalating' : windMph >= 20 ? 'Monitoring' : 'Stable',
      context: `${weather.movement || 'No organized storm motion'} • current threat ${threatLevel}.`,
      severity: windMph >= 28 ? 'critical' : windMph >= 20 ? 'watch' : 'stable',
      icon: Waves,
    },
    {
      id: 'alerts',
      label: 'NOAA Alert Burden',
      value: String(alerts.length),
      trendText: alerts.length > 0 ? `↑ ${alertTypes.length} active alert type${alertTypes.length === 1 ? '' : 's'}` : '↓ no live alert types',
      trendDirection: alerts.length > 0 ? 'up' : 'down',
      status: alerts.length > 2 ? 'Multi-alert incident' : alerts.length > 0 ? 'Active monitoring' : 'No active alerts',
      context: alertTypes.length > 0 ? alertTypes.join(' • ') : 'NWS feed is clear for Tampa Bay.',
      severity: alerts.length > 2 ? 'critical' : alerts.length > 0 ? 'watch' : 'stable',
      icon: RadioTower,
    },
  ];

  const agentInsights: AgentInsight[] = agents.map(agent => {
    if (agent.id === 'storm-watcher') {
      return {
        id: agent.id,
        name: agent.name,
        decision: `Threat level ${threatLevel.toUpperCase()}`,
        confidence: agent.confidence,
        reason: agent.lastAction,
      };
    }
    if (agent.id === 'vulnerability-mapper') {
      return {
        id: agent.id,
        name: agent.name,
        decision: topZone ? `Focus ${topZone.name}` : 'No hotspot polygon',
        confidence: agent.confidence,
        reason: topZone
          ? `${hotZones.length} zone${hotZones.length === 1 ? '' : 's'} above action threshold. ${topZone.name} leads at ${topZone.riskScore}/100.`
          : agent.lastAction,
      };
    }
    if (agent.id === 'resource-coordinator') {
      return {
        id: agent.id,
        name: agent.name,
        decision: `Hold ${shelterBufferPct}% shelter reserve`,
        confidence: agent.confidence,
        reason: `${(totalShelterCapacity - totalShelterOccupancy).toLocaleString()} beds remain. ${agent.lastAction}`,
      };
    }
    return {
      id: agent.id,
      name: agent.name,
      decision: dedupedActions[0]?.title ?? actionPlans[0]?.title ?? 'Continue live monitoring',
      confidence: agent.confidence,
      reason: agent.lastAction,
    };
  });

  const feedReliability = getFeedReliability(liveWeather, lastDecisionTime);
  const feedInsight: FeedInsight = {
    alertCount: alerts.length,
    alertTypes,
    reliabilityLabel: feedReliability.label,
    reliabilityTone: feedReliability.tone,
    lastUpdatedLabel: formatDateLabel(lastDecisionTime),
    nextUpdateLabel: formatDateLabel(nextUpdateTime),
  };

  const signalChartData = sortedZones.slice(0, 6).map(zone => ({
    name: zone.name.replace(' — ', ' '),
    risk: zone.riskScore,
    status: zone.status,
  }));

  const topSignal = signalChartData[0];
  const chartAnnotation = topSignal
    ? topSignal.risk >= 80
      ? `${topSignal.name} is above evacuation threshold`
      : topSignal.risk >= 65
        ? `${topSignal.name} is above action threshold`
        : `${topSignal.name} is below action threshold`
    : 'Awaiting live vulnerability zones';

  return {
    recommendedActions: dedupedActions,
    kpis,
    agentInsights,
    feedInsight,
    signalChartData,
    chartAnnotation,
  };
}

function StatusDot({ severity }: { severity: Severity }) {
  const tone = PANEL_TONES[severity];
  return <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tone.accent }} />;
}

function TrendArrow({ direction, severity }: { direction: 'up' | 'down'; severity: Severity }) {
  const tone = PANEL_TONES[severity];
  const Icon = direction === 'up' ? ArrowUpRight : ArrowDownRight;
  return <Icon className="h-3.5 w-3.5" style={{ color: tone.accent }} />;
}

export default function InfrastructureDecisionSupport(props: {
  threatLevel: ThreatLevel;
  weather: WeatherData;
  liveWeather: LiveWeatherData | null;
  alerts: Alert[];
  agents: AgentState[];
  shelters: Resource[];
  vulnerabilityZones: LiveZone[];
  totalPopulationAtRisk: number;
  actionPlans: ActionPlan[];
  lastDecisionTime: Date | null;
  nextUpdateTime: Date | null;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const insights = useMemo(() => deriveDecisionSupport(props), [props]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,18,33,0.96),rgba(13,30,52,0.88))] p-5 shadow-[0_0_0_1px_rgba(56,189,248,0.06),0_24px_60px_rgba(2,6,23,0.28)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-300/70">Recommended Actions</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Operational Decision Support</h2>
            <p className="mt-1 text-sm text-slate-300/80">
              BayShield is converting live weather, alert, shelter, and zone signals into concrete next actions for the command center.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Mode</p>
              <p className="mt-1 text-sm font-semibold text-white">LIVE</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Last decision</p>
              <p className="mt-1 text-sm font-semibold text-white">{formatDateLabel(props.lastDecisionTime)}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Next update</p>
              <p className="mt-1 text-sm font-semibold text-white">{formatCountdown(props.nextUpdateTime, now)}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
          {insights.recommendedActions.map(action => {
            const tone = PANEL_TONES[action.severity];
            return (
              <div
                key={action.id}
                className={cn('rounded-2xl border px-4 py-4', tone.border, tone.bg)}
              >
                <div className="flex items-center gap-2">
                  <StatusDot severity={action.severity} />
                  <p className={cn('text-[11px] font-mono uppercase tracking-[0.18em]', tone.text)}>
                    {action.severity === 'stable' ? 'Stable' : action.severity === 'watch' ? 'Watch' : 'Critical'}
                  </p>
                </div>
                <h3 className="mt-2 text-base font-semibold text-white">{action.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300/85">{action.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        {insights.kpis.map(kpi => {
          const tone = PANEL_TONES[kpi.severity];
          const Icon = kpi.icon;
          return (
            <div key={kpi.id} className="rounded-2xl border border-white/8 bg-card/70 p-4" title={kpi.context}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{kpi.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{kpi.value}</p>
                </div>
                <div className={cn('rounded-xl border px-2.5 py-2', tone.border, tone.bg)}>
                  <Icon className="h-4 w-4" style={{ color: tone.accent }} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px]">
                <TrendArrow direction={kpi.trendDirection} severity={kpi.severity} />
                <span className="font-medium" style={{ color: tone.accent }}>{kpi.trendText}</span>
              </div>
              <p className="mt-2 text-xs font-medium text-slate-200">{kpi.status}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{kpi.context}</p>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-white/8 bg-card/70 p-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-cyan-300" />
            <h3 className="text-sm font-semibold">Agent Insights</h3>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {insights.agentInsights.map(agent => (
              <div key={agent.id} className="rounded-xl border border-white/8 bg-background/35 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{agent.name}</p>
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-mono text-cyan-200">
                    {agent.confidence}%
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-200">{agent.decision}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{agent.reason}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-card/70 p-4">
            <div className="flex items-center gap-2">
              <DatabaseZap className="h-4 w-4 text-sky-300" />
              <h3 className="text-sm font-semibold">NOAA Feed Insight</h3>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/8 bg-background/35 px-3 py-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Active alerts</p>
                  <p className="mt-1 text-lg font-semibold text-white">{insights.feedInsight.alertCount}</p>
                </div>
                <div className={cn('rounded-full px-2 py-1 text-[10px] font-mono', PANEL_TONES[insights.feedInsight.reliabilityTone].bg, PANEL_TONES[insights.feedInsight.reliabilityTone].text)}>
                  {insights.feedInsight.reliabilityLabel}
                </div>
              </div>

              <div className="rounded-xl border border-white/8 bg-background/35 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Alert types</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {insights.feedInsight.alertTypes.length > 0 ? insights.feedInsight.alertTypes.map(type => (
                    <span key={type} className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-200">
                      {type}
                    </span>
                  )) : (
                    <span className="text-xs text-muted-foreground">No active alert types in the current feed.</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/8 bg-background/35 p-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    Last updated
                  </div>
                  <p className="mt-2 text-sm font-medium text-white">{insights.feedInsight.lastUpdatedLabel}</p>
                </div>
                <div className="rounded-xl border border-white/8 bg-background/35 p-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <Siren className="h-3.5 w-3.5" />
                    Next refresh
                  </div>
                  <p className="mt-2 text-sm font-medium text-white">{formatCountdown(props.nextUpdateTime, now)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-card/70 p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-fuchsia-300" />
              <h3 className="text-sm font-semibold">Zone Signal Chart</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{insights.chartAnnotation}</p>
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.signalChartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{
                      background: 'oklch(0.13 0.014 250)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                    }}
                  />
                  <ReferenceLine y={65} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: 'Action threshold', position: 'insideTopRight', fill: '#fbbf24', fontSize: 10 }} />
                  <ReferenceLine y={80} stroke="#f87171" strokeDasharray="4 4" label={{ value: 'Evacuate threshold', position: 'insideTopLeft', fill: '#f87171', fontSize: 10 }} />
                  <Bar dataKey="risk" radius={[6, 6, 0, 0]}>
                    {insights.signalChartData.map(item => (
                      <Cell
                        key={item.name}
                        fill={item.risk >= 80 ? '#f87171' : item.risk >= 65 ? '#fbbf24' : '#38bdf8'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><StatusDot severity="critical" /> evacuation trigger</span>
              <span className="flex items-center gap-1.5"><StatusDot severity="watch" /> action trigger</span>
              <span className="flex items-center gap-1.5"><StatusDot severity="stable" /> below threshold</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
