import { useSimulation } from '@/contexts/SimulationContext';
import { cn } from '@/lib/utils';
import { Zap, Car, Heart, DollarSign, Clock, TrendingUp, CheckCircle2 } from 'lucide-react';
import InfrastructureVulnerabilityMapper from '@/components/InfrastructureVulnerabilityMapper';
import InfrastructureDecisionSupport from '@/components/InfrastructureDecisionSupport';
import IncidentActionBoard from '@/components/IncidentActionBoard';
import AutonomousExecutionPanel from '@/components/AutonomousExecutionPanel';
import MedicalOperationsPanel from '@/components/MedicalOperationsPanel';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';

const RISK_STYLES: Record<string, { text: string; bg: string; border: string; hex: string }> = {
  low:      { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', hex: '#34d399' },
  moderate: { text: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/20',   hex: '#fbbf24' },
  high:     { text: 'text-orange-400',  bg: 'bg-orange-400/10',  border: 'border-orange-400/20',  hex: '#fb923c' },
  critical: { text: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/20',     hex: '#f87171' },
  extreme:  { text: 'text-rose-400',    bg: 'bg-rose-400/10',    border: 'border-rose-400/20',    hex: '#fb7185' },
};

const SEV_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  monitoring: { text: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/20' },
  advisory:   { text: 'text-blue-400',  bg: 'bg-blue-400/10',  border: 'border-blue-400/20' },
  warning:    { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
  critical:   { text: 'text-red-400',   bg: 'bg-red-400/10',   border: 'border-red-400/20' },
};

const TOOLTIP_STYLE = {
  background: 'oklch(0.13 0.014 250)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  fontSize: '11px',
};

export default function Infrastructure() {
  const {
    infraPredictions,
    actionPlans,
    incidentActions,
    incidentDispatches,
    incidentAuditLog,
    isRunning,
    threatLevel,
    vulnerabilityZones,
    agents,
    alerts,
    shelters,
    infrastructureSignals,
    totalPopulationAtRisk,
    weather,
    liveWeather,
    lastLivePoll,
    nextLivePoll,
    updateIncidentAction,
    acknowledgeIncidentDispatch,
  } = useSimulation();

  const chartData = infraPredictions.map(p => ({
    time: p.timeframe,
    power: p.powerOutagePct,
    roads: p.roadClosurePct,
    flood: p.floodDepthFt,
    recovery: p.recoveryDays,
  }));

  const latest = infraPredictions.length > 0 ? infraPredictions[infraPredictions.length - 1] : null;

  return (
    <div className="min-h-full space-y-5 p-4 sm:p-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Infrastructure Risk</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Power outages, road closures, flood depth, and hospital capacity — updated from live NOAA and FL511 feeds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border text-emerald-300 bg-emerald-400/10 border-emerald-400/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse-live" />Live
          </span>
        </div>
      </div>

      <InfrastructureDecisionSupport
        threatLevel={threatLevel}
        weather={weather}
        liveWeather={liveWeather}
        alerts={alerts}
        agents={agents}
        shelters={shelters}
        vulnerabilityZones={vulnerabilityZones}
        totalPopulationAtRisk={totalPopulationAtRisk}
        actionPlans={actionPlans}
        lastDecisionTime={lastLivePoll}
        nextUpdateTime={nextLivePoll}
      />

      <IncidentActionBoard
        incidentActions={incidentActions}
        onAdvanceAction={(actionId) => {
          const current = incidentActions.find(action => action.id === actionId);
          if (!current) return;
          const nextStatus = current.status === 'new'
            ? 'reviewed'
            : current.status === 'reviewed'
              ? 'assigned'
              : current.status === 'assigned'
                ? 'completed'
                : 'completed';
          updateIncidentAction(actionId, { status: nextStatus });
        }}
        onSetOwner={(actionId, owner) => {
          const trimmedOwner = owner.trim();
          const current = incidentActions.find(action => action.id === actionId);
          updateIncidentAction(actionId, {
            owner: trimmedOwner.length > 0 ? trimmedOwner : null,
            status: current?.status === 'new' && trimmedOwner.length > 0 ? 'assigned' : current?.status,
          });
        }}
      />

      <AutonomousExecutionPanel
        dispatches={incidentDispatches}
        auditLog={incidentAuditLog}
        onAcknowledge={acknowledgeIncidentDispatch}
      />

      {infrastructureSignals && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/70">FL511 Transport Feed</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {infrastructureSignals.roadIncidentsTotal} incidents
            </p>
            <p className="mt-1 text-xs text-slate-300">
              {infrastructureSignals.roadClosuresTotal} closures and {infrastructureSignals.bridgeClosuresTotal} bridge disruptions in the latest Tampa Bay feed.
            </p>
          </div>
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200/70">Utility Outage Feed</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {infrastructureSignals.dukeCustomersOut.toLocaleString()} customers out
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Duke official county feed covers {infrastructureSignals.dukeCountyCount} Tampa Bay county records. TECO remains modeled until a stable public feed is available.
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-card/70 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Feed Reliability</p>
            <p className="mt-2 text-lg font-semibold text-white capitalize">{infrastructureSignals.feedStatus}</p>
            <div className="mt-2 space-y-1">
              {infrastructureSignals.sourceSummary.slice(0, 3).map(summary => (
                <p key={summary} className="text-xs text-muted-foreground">{summary}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      <MedicalOperationsPanel
        threatLevel={threatLevel}
        infrastructureSignals={infrastructureSignals}
      />

      {/* Current snapshot */}
      {latest ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Power Outage',    value: `${latest.powerOutagePct}%`,       icon: Zap,         risk: latest.powerOutagePct > 70 ? 'critical' : latest.powerOutagePct > 40 ? 'high' : 'moderate' },
            { label: 'Road Closures',   value: `${latest.roadClosurePct}%`,       icon: Car,         risk: latest.roadClosurePct > 60 ? 'critical' : latest.roadClosurePct > 30 ? 'high' : 'moderate' },
            { label: 'Hospital Risk',   value: latest.hospitalRisk,               icon: Heart,       risk: latest.hospitalRisk },
            { label: 'Damage Estimate', value: latest.damageEstimate,             icon: DollarSign,  risk: 'critical' },
          ].map(({ label, value, icon: Icon, risk }) => {
            const s = RISK_STYLES[risk] ?? RISK_STYLES.moderate;
            return (
              <div key={label} className="bg-card border border-border/50 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                    <p className={cn('text-xl font-semibold capitalize', s.text)}>{value}</p>
                  </div>
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', s.bg)}>
                    <Icon className={cn('w-4 h-4', s.text)} />
                  </div>
                </div>
                <span className={cn('mt-2 text-[10px] px-1.5 py-0.5 rounded border inline-block font-mono uppercase', s.bg, s.border, s.text)}>
                  {risk} risk
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-xl p-16 text-center">
          <TrendingUp className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No predictions yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Forecast data will appear here once conditions are assessed by the live weather feed.</p>
        </div>
      )}

      <InfrastructureVulnerabilityMapper
        threatLevel={threatLevel}
        latestPrediction={latest}
        vulnerabilityZones={vulnerabilityZones}
      />

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="bg-card border border-border/50 rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Power Outage & Road Closures (%)</h2>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-mono text-cyan-200">
              Signals: NWS + NOAA + shelters + polygons
            </span>
          </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="pG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#fbbf24" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f87171" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94a3b8' }} />
                <ReferenceLine y={40} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: 'Operational concern', position: 'insideTopLeft', fill: '#fbbf24', fontSize: 10 }} />
                <ReferenceLine y={70} stroke="#f87171" strokeDasharray="4 4" label={{ value: 'Critical threshold', position: 'insideTopRight', fill: '#f87171', fontSize: 10 }} />
                <Area type="monotone" dataKey="power" stroke="#fbbf24" strokeWidth={1.5} fill="url(#pG)" name="Power (%)" />
                <Area type="monotone" dataKey="roads" stroke="#f87171" strokeWidth={1.5} fill="url(#rG)" name="Roads (%)" />
              </AreaChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted-foreground">
              Threshold lines show when outages start disrupting daily life (40%) and when conditions become critical (70%).
            </p>
          </div>

          <div className="bg-card border border-border/50 rounded-xl p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">Flood Depth (ft) & Recovery (days)</h2>
              <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-mono text-sky-200">
                Live forecast
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94a3b8' }} />
                <ReferenceLine y={6} stroke="#38bdf8" strokeDasharray="4 4" label={{ value: 'Flood watch', position: 'insideTopLeft', fill: '#38bdf8', fontSize: 10 }} />
                <ReferenceLine y={14} stroke="#a78bfa" strokeDasharray="4 4" label={{ value: 'Long recovery zone', position: 'insideTopRight', fill: '#a78bfa', fontSize: 10 }} />
                <Bar dataKey="flood"    fill="#38bdf8" name="Flood (ft)"  radius={[2, 2, 0, 0]} />
                <Bar dataKey="recovery" fill="#a78bfa" name="Recovery (d)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted-foreground">
              Projected flood depth and estimated days to full recovery based on current conditions.
            </p>
          </div>
        </div>
      )}

      {/* Prediction table */}
      {infraPredictions.length > 0 && (
        <div className="bg-card border border-border/50 rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Operational Impact Timeline</h2>
            <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-slate-300">
              Updated each live cycle
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30">
                  {['Timeframe', 'Power Out', 'Roads Closed', 'Flood Depth', 'Hospital Risk', 'Wind Risk', 'Damage Est.', 'Recovery'].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {infraPredictions.map(p => {
                  const hr = RISK_STYLES[p.hospitalRisk] ?? RISK_STYLES.moderate;
                  const wr = RISK_STYLES[p.windDamageRisk] ?? RISK_STYLES.moderate;
                  const isLandfall = p.timeframe === 'Landfall';
                  return (
                    <tr key={p.id} className={cn('border-b border-border/20', isLandfall && 'bg-red-400/5')}>
                      <td className={cn('py-2 px-2 font-mono font-semibold', isLandfall ? 'text-red-400' : 'text-foreground')}>
                        {p.timeframe}
                        {isLandfall && <span className="ml-1 text-[9px] bg-red-400/20 text-red-400 px-1 rounded">PEAK</span>}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1 bg-border/40 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${p.powerOutagePct}%` }} />
                          </div>
                          <span className="font-mono text-amber-400">{p.powerOutagePct}%</span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1 bg-border/40 rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full" style={{ width: `${p.roadClosurePct}%` }} />
                          </div>
                          <span className="font-mono text-red-400">{p.roadClosurePct}%</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 font-mono text-sky-400">{p.floodDepthFt} ft</td>
                      <td className="py-2 px-2">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-mono capitalize', hr.text, hr.bg, hr.border)}>{p.hospitalRisk}</span>
                      </td>
                      <td className="py-2 px-2">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-mono capitalize', wr.text, wr.bg, wr.border)}>{p.windDamageRisk}</span>
                      </td>
                      <td className="py-2 px-2 font-mono font-semibold">{p.damageEstimate}</td>
                      <td className="py-2 px-2 font-mono text-violet-400">{p.recoveryDays}d</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Plans */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium">Action Plans</h2>
        {actionPlans.length === 0 ? (
          <div className="bg-card border border-border/50 rounded-xl p-8 text-center">
            <Clock className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No action plans right now — all conditions within normal range</p>
          </div>
        ) : (
          actionPlans.map(plan => {
            const ss = SEV_STYLES[plan.severity] ?? SEV_STYLES.monitoring;
            return (
              <div key={plan.id} className="bg-card border border-border/50 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold">{plan.title}</h3>
                      <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-mono uppercase', ss.bg, ss.border, ss.text)}>
                        {plan.severity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{plan.summary}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] text-muted-foreground font-mono">{plan.agentSource}</p>
                    <p className="text-xs font-semibold mt-0.5">{plan.populationCovered.toLocaleString()} covered</p>
                  </div>
                </div>
                <div className="mb-3 grid grid-cols-1 gap-1.5 xl:grid-cols-2">
                  {plan.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-foreground/80">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{rec}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {plan.zonesAffected.map(z => (
                    <span key={z} className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 border border-border/30 text-muted-foreground font-mono">{z}</span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
