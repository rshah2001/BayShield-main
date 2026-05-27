import { useEffect, useRef, useState } from 'react';
import { useSimulation } from '@/contexts/SimulationContext';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Users, Building2, MapPin,
  Wind, Clock, ArrowRight,
  TrendingUp, Activity, ChevronRight, Thermometer, Gauge, BellRing, ShieldCheck, AlertOctagon
} from 'lucide-react';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, ReferenceLine, ReferenceDot
} from 'recharts';
import LiveSyncBadge from '@/components/LiveSyncBadge';
import ActionCard from '@/components/ActionCard';
import TideGauges from '@/components/TideGauges';

const THREAT_STYLES: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  monitoring: { text: 'text-slate-400',  bg: 'bg-slate-400/10',  border: 'border-slate-400/20',  dot: 'bg-slate-400' },
  advisory:   { text: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/20',   dot: 'bg-blue-400' },
  warning:    { text: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/20',  dot: 'bg-amber-400' },
  critical:   { text: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/20',    dot: 'bg-red-400' },
};

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/20',
  warning:  'text-amber-400 bg-amber-400/10 border-amber-400/20',
  advisory: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  info:     'text-slate-400 bg-slate-400/10 border-slate-400/20',
};

const AGENT_BADGE: Record<string, string> = {
  idle:       'text-slate-500 bg-slate-500/10 border-slate-500/20',
  active:     'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  processing: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  complete:   'text-blue-400 bg-blue-400/10 border-blue-400/20',
  error:      'text-red-400 bg-red-400/10 border-red-400/20',
};

const AGENT_BAR: Record<string, string> = {
  idle: 'bg-slate-600', active: 'bg-emerald-400', processing: 'bg-amber-400', complete: 'bg-blue-400', error: 'bg-red-400'
};

const MAP_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663488949635/H8uV2jDz2ia2afExqjD23w/stormmesh-map-overlay_d3cce59a.png';

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getFreshness(lastLivePoll: Date | null) {
  if (!lastLivePoll) return { label: 'Connecting', tone: 'text-amber-300 bg-amber-400/10 border-amber-400/20' };
  const ageMinutes = (Date.now() - lastLivePoll.getTime()) / 60_000;
  if (ageMinutes <= 3) return { label: 'Fresh', tone: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20' };
  if (ageMinutes <= 8) return { label: 'Aging', tone: 'text-amber-300 bg-amber-400/10 border-amber-400/20' };
  return { label: 'Stale', tone: 'text-red-300 bg-red-400/10 border-red-400/20' };
}

type Snapshot = {
  alerts: number;
  shelterPct: number;
  zonesMonitoredValue: number;
  totalPopulationAtRisk: number;
  threatLevel: string;
};


export default function Dashboard() {
  const {
    agents, messages, weather, alerts, threatLevel,
    totalPopulationAtRisk, simulationPhase, totalPhases, systemLog, isRunning,
    shelters, shelterFeedSource, vulnerabilityZones,
    liveWeather, lastLivePoll, nextLivePoll,
    incidentDispatches,
  } = useSimulation();

  const ts = THREAT_STYLES[threatLevel] ?? THREAT_STYLES.monitoring;

  const openShelters = shelters.filter(shelter => shelter.status !== 'closed');
  const totalCap = shelters.reduce((s, r) => s + r.capacity, 0);
  const totalOcc  = shelters.reduce((s, r) => s + r.currentOccupancy, 0);
  const shelterPct = totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0;
  const shelterSourceLabel = shelterFeedSource === 'live_public' ? 'Florida Live' : 'Fallback';
  const shelterSub = totalCap > 0
    ? `${totalOcc.toLocaleString()} / ${totalCap.toLocaleString()}`
    : openShelters.length === 0
      ? '0 open shelters right now'
      : 'No capacity data';

  const critCount = alerts.filter(a => a.priority === 'critical').length;
  const officialPolygonZones = vulnerabilityZones.filter(zone => zone.source === 'nws-alert-polygon');
  const hasOfficialPolygons = officialPolygonZones.length > 0;
  const hasCensusBlockExposure = vulnerabilityZones.some(zone => zone.populationSource === 'census-2020-blocks');
  const zonesMonitoredValue = hasOfficialPolygons ? officialPolygonZones.length : 0;
  const populationSourceLabel = hasCensusBlockExposure ? 'Census Blocks' : 'No live exposure';
  const zoneSourceLabel = hasOfficialPolygons ? 'Official NWS' : 'No polygons';
  const evacuateCount = officialPolygonZones.filter(z => z.status === 'evacuate').length;

  const obs = liveWeather?.observation;
  const liveChartData = liveWeather?.windHistory ?? [];
  const freshness = getFreshness(lastLivePoll);
  const windDelta = liveChartData.length >= 2
    ? Math.round((liveChartData[liveChartData.length - 1]?.wind ?? 0) - (liveChartData[Math.max(0, liveChartData.length - 3)]?.wind ?? 0))
    : 0;
  const deliveredDispatchCount = incidentDispatches.filter(dispatch => dispatch.status === 'delivered').length;
  const acknowledgedDispatchCount = incidentDispatches.filter(dispatch => dispatch.status === 'acknowledged').length;
  const localOnlyDispatchCount = incidentDispatches.filter(dispatch => dispatch.status === 'local_only').length;
  const pendingDispatchCount = incidentDispatches.filter(dispatch => dispatch.status === 'pending').length;
  const [previousSnapshot, setPreviousSnapshot] = useState<Snapshot | null>(null);
  const snapshotRef = useRef<Snapshot | null>(null);

  useEffect(() => {
    const snapshot: Snapshot = {
      alerts: alerts.length,
      shelterPct,
      zonesMonitoredValue,
      totalPopulationAtRisk,
      threatLevel,
    };

    if (lastLivePoll && snapshotRef.current) {
      setPreviousSnapshot(snapshotRef.current);
    }
    snapshotRef.current = snapshot;
  }, [alerts.length, lastLivePoll, shelterPct, threatLevel, totalPopulationAtRisk, zonesMonitoredValue]);

  const changeItems = [
    {
      id: 'alerts',
      label: 'Alerts',
      value: alerts.length,
      delta: previousSnapshot ? alerts.length - previousSnapshot.alerts : 0,
      detail: alerts.length > 0 ? `${critCount} critical active` : 'No active alerts',
      accent: alerts.length > (previousSnapshot?.alerts ?? 0) ? 'text-red-300' : 'text-slate-300',
    },
    {
      id: 'population',
      label: 'Population at Risk',
      value: totalPopulationAtRisk,
      delta: previousSnapshot ? totalPopulationAtRisk - previousSnapshot.totalPopulationAtRisk : 0,
      detail: hasCensusBlockExposure ? 'Census block intersection' : 'No live exposure',
      accent: totalPopulationAtRisk > (previousSnapshot?.totalPopulationAtRisk ?? 0) ? 'text-amber-300' : 'text-slate-300',
    },
    {
      id: 'zones',
      label: 'Zones Monitored',
      value: zonesMonitoredValue,
      delta: previousSnapshot ? zonesMonitoredValue - previousSnapshot.zonesMonitoredValue : 0,
      detail: hasOfficialPolygons ? 'Official polygons active' : 'No official polygons',
      accent: zonesMonitoredValue > (previousSnapshot?.zonesMonitoredValue ?? 0) ? 'text-cyan-300' : 'text-slate-300',
    },
    {
      id: 'shelters',
      label: 'Shelter Usage',
      value: shelterPct,
      delta: previousSnapshot ? shelterPct - previousSnapshot.shelterPct : 0,
      detail: shelterSub,
      accent: shelterPct > (previousSnapshot?.shelterPct ?? 0) ? 'text-amber-300' : 'text-emerald-300',
    },
  ];

  const subtitle = liveWeather?.isLoading
    ? 'Loading NOAA data...'
    : obs
      ? `Tampa Bay -- ${obs.conditions ?? 'Current Conditions'} -- ${obs.tempF ?? '--'}°F -- ${obs.windSpeedMph ?? '--'} mph ${obs.windDirectionText ?? ''}`
      : 'Tampa Bay -- Live NOAA Feed';

  return (
    <div className="min-h-full space-y-4 p-4 sm:p-5">
      {/* What to do now */}
      <ActionCard threatLevel={threatLevel} />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">Situation Overview</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold border text-emerald-400 bg-emerald-400/10 border-emerald-400/20">
              LIVE
            </span>
          </div>
          <p className="mt-0.5 max-w-xl text-xs text-muted-foreground sm:truncate">{subtitle}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-shrink-0 sm:items-end">
          <LiveSyncBadge
            lastPoll={lastLivePoll}
            nextPoll={nextLivePoll}
            isLoading={liveWeather?.isLoading ?? false}
            variant="compact"
          />
          <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold', ts.bg, ts.border, ts.text)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', ts.dot, threatLevel !== 'monitoring' && 'animate-pulse')} />
            {threatLevel.toUpperCase()}
            <span className="text-muted-foreground font-normal ml-1">· Live</span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Active Alerts',
            value: alerts.length,
            sub: `${critCount} critical`,
            context: critCount > 0 ? 'Protective actions should remain elevated.' : 'No critical alerts are currently driving escalation.',
            icon: AlertTriangle,
            accent: critCount > 0 ? '#f87171' : '#64748b',
            source: 'NWS Live',
            updated: lastLivePoll ? fmtTime(lastLivePoll) : '--',
          },
          {
            label: 'Population at Risk',
            value: totalPopulationAtRisk > 0 ? totalPopulationAtRisk.toLocaleString() : '0',
            sub: `${evacuateCount} zones evacuating`,
            context: hasCensusBlockExposure ? 'Exposure is from live polygon-to-census block overlap.' : 'No official live polygon exposure is active.',
            icon: Users,
            accent: '#fbbf24',
            source: populationSourceLabel,
            updated: lastLivePoll ? fmtTime(lastLivePoll) : '--',
          },
          {
            label: 'Shelter Capacity',
            value: `${shelterPct}%`,
            sub: shelterSub,
            context: shelterPct >= 90 ? 'Critical shelter saturation.' : shelterPct >= 75 ? 'Buffer is tightening.' : 'Capacity buffer remains workable.',
            icon: Building2,
            accent: shelterPct > 80 ? '#f87171' : '#34d399',
            source: shelterSourceLabel,
            updated: lastLivePoll ? fmtTime(lastLivePoll) : '--',
          },
          {
            label: 'Zones Monitored',
            value: zonesMonitoredValue,
            sub: hasOfficialPolygons ? 'Official alert polygons' : 'No active NWS polygons',
            context: hasOfficialPolygons ? 'Live map overlays are using official NWS geometry.' : 'The live map is clear because no official polygon is active.',
            icon: MapPin,
            accent: '#60a5fa',
            source: zoneSourceLabel,
            updated: lastLivePoll ? fmtTime(lastLivePoll) : '--',
          },
        ].map(({ label, value, sub, context, icon: Icon, accent, source, updated }) => (
          <div key={label} className="bg-card border border-border/50 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
                  <span className={cn(
                    'text-[9px] px-1 py-0.5 rounded font-mono',
                    source === 'NWS Live' || source === 'Florida Live' || source === 'Official NWS' || source === 'Census Blocks'
                      ? 'text-emerald-400 bg-emerald-400/10'
                      : source === 'Fallback' || source === 'No polygons' || source === 'No live exposure'
                        ? 'text-amber-400 bg-amber-400/10'
                      : source === 'Simulation'
                        ? 'text-amber-400 bg-amber-400/10'
                        : 'text-slate-500 bg-slate-500/10'
                  )}>{source}</span>
                  <span className={cn('text-[9px] px-1 py-0.5 rounded border font-mono', freshness.tone)}>{freshness.label}</span>
                </div>
                <p className="text-2xl font-semibold tracking-tight" style={{ color: accent }}>{value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
                <p className="text-[11px] text-foreground/70 mt-1">{context}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Updated {updated}</p>
              </div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}15` }}>
                <Icon className="w-4 h-4" style={{ color: accent }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="bg-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-medium">What Changed</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Changes since the last update cycle — quickly see what moved.
                </p>
              </div>
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', freshness.tone)}>
                {freshness.label}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {changeItems.map(item => (
                <div key={item.id} className="rounded-lg border border-border/30 bg-background/50 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                  </p>
                  <p className={cn('mt-1 text-xs font-medium', item.accent)}>
                    {item.delta === 0 ? 'No change' : `${item.delta > 0 ? '↑' : '↓'} ${Math.abs(item.delta).toLocaleString()} since last cycle`}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-medium">Dispatch Status</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Status of automated alerts BayShield sent during this session.
                </p>
              </div>
              <BellRing className="w-4 h-4 text-cyan-300" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Delivered', value: deliveredDispatchCount, icon: ShieldCheck, tone: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20' },
                { label: 'Acknowledged', value: acknowledgedDispatchCount, icon: Activity, tone: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20' },
                { label: 'Local Only', value: localOnlyDispatchCount, icon: AlertOctagon, tone: 'text-amber-300 bg-amber-400/10 border-amber-400/20' },
                { label: 'Pending', value: pendingDispatchCount, icon: Clock, tone: 'text-slate-300 bg-slate-400/10 border-slate-400/20' },
              ].map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="rounded-lg border border-border/30 bg-background/50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                    <div className={cn('rounded-md border p-1', tone)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              {localOnlyDispatchCount > 0
                ? `${localOnlyDispatchCount} alert${localOnlyDispatchCount === 1 ? '' : 's'} saved locally — no push notification permission granted yet.`
                : 'All alerts delivered successfully.'}
            </p>
          </div>
        </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Left 2/3 */}
        <div className="space-y-4 xl:col-span-2">

          {/* Storm / Weather data */}
          <div className="bg-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium">Live Conditions — Tampa Bay</h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-400/10 border-emerald-400/20">
                  NOAA NWS · KTPA · NHC
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  icon: Wind,
                  label: 'Storm Status',
                  value: weather.stormName,
                  sub: `${weather.category > 0 ? `Category ${weather.category}` : 'No active storm'} · NOAA NHC`,
                },
                {
                  icon: TrendingUp,
                  label: 'Wind Speed',
                  value: obs ? `${obs.windSpeedMph ?? '--'} mph` : `${weather.windSpeed} kt`,
                  sub: obs ? `${obs.windDirectionText ?? ''} · ${obs.windSpeedKt ?? '--'} kt · NOAA KTPA · ${windDelta >= 0 ? '+' : ''}${windDelta} kt trend` : 'Sustained',
                },
                {
                  icon: Thermometer,
                  label: 'Temperature',
                  value: obs ? `${obs.tempF ?? '--'}°F` : '--',
                  sub: obs ? `Humidity ${obs.humidity ?? '--'}% · NOAA KTPA` : 'KTPA station',
                },
                {
                  icon: Gauge,
                  label: 'Pressure',
                  value: obs ? `${obs.pressureInHg ?? '--'} inHg` : '--',
                  sub: obs ? `${obs.conditions ?? 'Loading...'} · NOAA KTPA` : 'KTPA station',
                },
              ].map(({ icon: Icon, label, value, sub }) => (
                <div key={label} className="bg-background/60 rounded-lg p-3 border border-border/30">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
                    <span className={cn('ml-auto text-[9px] px-1 py-0.5 rounded border font-mono', freshness.tone)}>{freshness.label}</span>
                  </div>
                  <p className="text-sm font-semibold leading-tight">{value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="bg-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-medium">Wind Speed — Last 24h (KTPA)</h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {obs ? (
                    <>Current: <span className="font-semibold text-emerald-400">{obs.windSpeedKt ?? '--'} kt ({obs.windSpeedMph ?? '--'} mph)</span> {obs.windDirectionText ?? ''}</>
                  ) : 'Loading current reading...'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {obs && (
                  <span className="text-lg font-bold text-emerald-400">{obs.windSpeedKt ?? '--'}<span className="text-[10px] font-normal text-muted-foreground ml-0.5">kt</span></span>
                )}
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-400/10 border-emerald-400/20">
                  KTPA Live
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={liveChartData} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'oklch(0.13 0.014 250)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '11px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <ReferenceLine y={34} stroke="#f87171" strokeDasharray="4 2" strokeWidth={1} label={{ value: 'Gale', fill: '#f87171', fontSize: 9 }} />
                <Line type="monotone" dataKey="wind" stroke="#34d399" strokeWidth={2} dot={{ r: 2, fill: '#34d399' }} name="Wind (kt)" />
                {obs?.windSpeedKt != null && (
                  <ReferenceDot
                    x="Now"
                    y={obs.windSpeedKt}
                    r={6}
                    fill="#34d399"
                    stroke="white"
                    strokeWidth={2}
                    label={{ value: `${obs.windSpeedKt} kt`, position: 'top', fill: '#34d399', fontSize: 10, fontWeight: 700 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tide gauges */}
          <TideGauges />

          {/* Map */}
          <div className="bg-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium">Tampa Bay Threat Map</h2>
              <Link href="/map">
                <span className="text-[11px] text-primary hover:opacity-80 transition-opacity flex items-center gap-1 cursor-pointer">
                  Full Map View <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
            <div className="relative rounded-lg overflow-hidden">
              <img src={MAP_IMG} alt="Tampa Bay" className="h-44 w-full object-cover opacity-75 sm:h-36" />
              <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />
              {threatLevel === 'monitoring' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                    <span className="text-emerald-400 text-xs font-semibold">All Clear — No Active Threats</span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                {officialPolygonZones.slice(0, 6).map(z => (
                  <span key={z.id} className={cn('text-[10px] px-1.5 py-0.5 rounded font-mono',
                    z.status === 'evacuate' ? 'bg-red-500/75 text-white' :
                    z.status === 'warning'  ? 'bg-amber-500/75 text-white' :
                                              'bg-blue-500/75 text-white'
                  )}>{z.name}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right 1/3 */}
        <div className="space-y-4">

          <LiveSyncBadge
            lastPoll={lastLivePoll}
            nextPoll={nextLivePoll}
            isLoading={liveWeather?.isLoading ?? false}
            variant="full"
          />

          {/* Agents */}
          <div className="bg-card border border-border/50 rounded-xl p-4">
            <h2 className="text-sm font-medium mb-3">Agent Status</h2>
            <div className="space-y-2">
              {agents.map(agent => (
                <div key={agent.id} className="p-2.5 rounded-lg bg-background/60 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm leading-none">{agent.icon}</span>
                    <span className="text-xs font-medium flex-1 truncate">{agent.name}</span>
                    <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-mono uppercase', AGENT_BADGE[agent.status] ?? AGENT_BADGE.idle)}>
                      {agent.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{agent.lastAction}</p>
                  {agent.confidence > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="flex-1 h-0.5 bg-border/40 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700', AGENT_BAR[agent.status] ?? 'bg-slate-600')}
                          style={{ width: `${agent.confidence}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground font-mono">{agent.confidence}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="bg-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium">Activity Feed</h2>
            </div>
            <div className="space-y-2">
              {messages.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-3">
                  {isRunning ? 'Waiting for agents...' : 'Live mode active — agents monitoring'}
                </p>
              ) : (
                messages.slice(0, 5).map(msg => (
                  <div key={msg.id} className="border-l-2 border-border/50 pl-2 py-0.5">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                      <span className="font-mono">{fmtTime(msg.timestamp)}</span>
                      <span>·</span>
                      <span className="text-primary/80">{msg.from}</span>
                    </div>
                    <p className="text-[10px] text-foreground/80 leading-relaxed line-clamp-2">{msg.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* System Log */}
          <div className="bg-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-3.5 h-3.5 text-muted-foreground" />
              <h2 className="text-sm font-medium">System Log</h2>
              <span className="ml-auto text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {systemLog.slice(-8).reverse().map((e, i) => (
                <p key={i} className="text-[10px] font-mono text-muted-foreground leading-relaxed">{e}</p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-card border border-border/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">Active Alerts</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-400/10 border-emerald-400/20">
                NWS Live
              </span>
              <span className="text-[11px] text-muted-foreground">{alerts.length} total</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {alerts.slice(0, 4).map(alert => (
              <div key={alert.id} className={cn('flex items-start gap-2.5 p-3 rounded-lg border', PRIORITY_BADGE[alert.priority])}>
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-medium truncate">{alert.zone}</span>
                    <span className="text-[10px] opacity-60 font-mono flex-shrink-0">{fmtTime(alert.timestamp)}</span>
                  </div>
                  <p className="text-[11px] opacity-75 leading-relaxed line-clamp-2">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {threatLevel === 'monitoring' && alerts.length === 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-emerald-400 text-sm">✓</span>
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-400">All Clear — Tampa Bay</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              No active NWS alerts for Florida. NHC confirms no active Atlantic storms. All 4 agents monitoring on standby.
              {lastLivePoll && ` Last verified: ${lastLivePoll.toLocaleTimeString()}.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
