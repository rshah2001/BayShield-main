// ============================================================
// BAYSHIELD -- System Monitor Page
// Live service health (SSE), pipeline streaming, and architecture overview
// ============================================================
import { cn } from '@/lib/utils';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { usePipelineStream } from '@/hooks/usePipelineStream';
import {
  Activity, Wifi, WifiOff, Server, Database, Cloud,
  Cpu, Play, Square, RotateCcw, CheckCircle2, AlertCircle,
  Clock, Zap, GitBranch, ArrowRight
} from 'lucide-react';

const SERVICE_ICONS: Record<string, React.ElementType> = {
  node_server: Server,
  python_adk: Cpu,
  database: Database,
  noaa_api: Cloud,
  llm_service: Zap,
  shelter_feed: Activity,
  routing_service: GitBranch,
};

const EVENT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  pipeline_start:    { text: 'text-slate-400',   bg: 'bg-slate-400/10',   border: 'border-slate-400/20' },
  agent_start:       { text: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/20' },
  agent_complete:    { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  parallel_start:    { text: 'text-cyan-400',    bg: 'bg-cyan-400/10',    border: 'border-cyan-400/20' },
  parallel_complete: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  pipeline_complete: { text: 'text-purple-400',  bg: 'bg-purple-400/10',  border: 'border-purple-400/20' },
  error:             { text: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/20' },
  done:              { text: 'text-slate-400',   bg: 'bg-slate-400/10',   border: 'border-slate-400/20' },
};

const AGENT_ICONS: Record<string, string> = {
  'storm-watcher': '🌀',
  'vulnerability-mapper': '🗺️',
  'resource-coordinator': '📦',
  'alert-commander': '🚨',
};

function ServiceCard({ id, service }: { id: string; service: { status: string; label: string; version?: string; agents?: number; tables?: number; endpoints?: number; note?: string } }) {
  const Icon = SERVICE_ICONS[id] ?? Server;
  const isEstimated = service.status === 'estimated';
  const isOnline = service.status === 'online';
  const isOffline = service.status === 'offline';

  const statusColor = isEstimated
    ? { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', dot: 'bg-amber-400', label: 'ESTIMATED' }
    : isOnline
    ? { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', dot: 'bg-emerald-400 animate-pulse', label: 'ONLINE' }
    : { text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', dot: 'bg-red-400', label: 'OFFLINE' };

  return (
    <div className={cn(
      'bg-card border rounded-xl p-4 transition-all',
      isOffline ? 'border-red-400/20' : isEstimated ? 'border-amber-400/20' : 'border-emerald-400/20'
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', statusColor.bg)}>
          <Icon className={cn('w-4 h-4', statusColor.text)} />
        </div>
        <div className={cn(
          'flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border font-mono',
          statusColor.text, statusColor.bg, statusColor.border
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', statusColor.dot)} />
          {statusColor.label}
        </div>
      </div>
      <p className="text-sm font-medium text-foreground">{service.label}</p>
      <div className="mt-1.5 space-y-0.5">
        {service.version && <p className="text-[11px] text-muted-foreground">Version: {service.version}</p>}
        {service.agents !== undefined && service.agents > 0 && <p className="text-[11px] text-muted-foreground">{service.agents} agents loaded</p>}
        {service.tables !== undefined && <p className="text-[11px] text-muted-foreground">{service.tables} tables migrated</p>}
        {service.endpoints !== undefined && <p className="text-[11px] text-muted-foreground">{service.endpoints} live endpoints</p>}
        {service.note && <p className="text-[11px] text-muted-foreground/70 italic">{service.note}</p>}
      </div>
    </div>
  );
}

function EventRow({ ev }: { ev: { event: string; agent?: string; phase?: number; pattern?: string; threat_level?: string; plans?: number; correction_applied?: boolean; total_at_risk?: number; message?: string; agents?: string[]; messages?: unknown[] } }) {
  const style = EVENT_COLORS[ev.event] ?? EVENT_COLORS.pipeline_start;
  const icon = ev.agent ? (AGENT_ICONS[ev.agent] ?? '⚙️') : '📡';

  const getDescription = () => {
    switch (ev.event) {
      case 'pipeline_start': return 'Pipeline execution started';
      case 'agent_start': return `${ev.agent?.replace(/-/g, ' ')} starting (${ev.pattern})`;
      case 'agent_complete': return `${ev.agent?.replace(/-/g, ' ')} complete — threat: ${ev.threat_level ?? 'N/A'}`;
      case 'parallel_start': return `Parallel agents starting: ${ev.agents?.join(', ')}`;
      case 'parallel_complete': return `Parallel phase complete`;
      case 'pipeline_complete': return `Pipeline complete — ${ev.total_at_risk?.toLocaleString() ?? 0} at risk, ${ev.plans ?? 0} plans`;
      case 'error': return ev.message ?? 'Stream error';
      case 'done': return 'Stream closed';
      default: return ev.event;
    }
  };

  return (
    <div className={cn('flex items-center gap-3 py-2 px-3 rounded-lg border', style.bg, style.border)}>
      <span className="text-base leading-none flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', style.bg, style.border, style.text)}>
            {ev.event.replace(/_/g, ' ').toUpperCase()}
          </span>
          {ev.phase && <span className="text-[10px] text-muted-foreground">Phase {ev.phase}</span>}
          {ev.correction_applied && (
            <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">
              Corrected
            </span>
          )}
        </div>
        <p className="text-xs text-foreground/80 mt-0.5">{getDescription()}</p>
      </div>
    </div>
  );
}

export default function SystemMonitor() {
  const { health, isConnected, lastUpdated, allOnline, onlineCount, totalCount } = useSystemHealth();
  const {
    isStreaming, events, currentPhase, currentAgent,
    isComplete, error, threatLevel, totalAtRisk,
    startStream, stopStream, reset,
  } = usePipelineStream();
  const degradedServices = health
    ? Object.values(health.services).filter(service => (service as { status: string }).status !== 'online').length
    : 0;
  const feedHealth = health?.services?.noaa_api?.status ?? 'unknown';
  const dbHealth = health?.services?.database?.status ?? 'unknown';

  return (
    <div className="min-h-full space-y-5 p-4 sm:p-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            System Monitor
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live service health and pipeline execution stream
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-xs text-cyan-300 bg-cyan-400/10 border border-cyan-400/20 px-2.5 py-1 rounded-lg">
              <Wifi className="w-3 h-3" />HEALTH STREAM OK
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-lg">
              <WifiOff className="w-3 h-3" />HEALTH STREAM DEGRADED
            </span>
          )}
          {lastUpdated && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastUpdated.toLocaleTimeString('en-US', { hour12: false })}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {[
          {
            title: 'System Monitor = Platform Health',
            body: 'Use this page to verify whether BayShield itself is healthy: feeds, backend services, pipeline execution, and streaming infrastructure.',
            tone: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
          },
          {
            title: 'Best For',
            body: 'Diagnosing stale data, failed services, broken SSE streams, or pipeline runs that stop early or return incomplete outputs.',
            tone: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
          },
          {
            title: 'Not For',
            body: 'Operational decisions, route planning, or resource staging. This page answers whether the machine is healthy, not whether Tampa Bay is safe.',
            tone: 'border-white/10 bg-white/5 text-slate-200',
          },
        ].map(card => (
          <div key={card.title} className={cn('rounded-xl border p-4', card.tone)}>
            <p className="text-xs font-semibold">{card.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-current/80">{card.body}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Degraded Services', value: degradedServices, sub: health ? `${onlineCount}/${totalCount} online` : 'Awaiting health probe', text: degradedServices > 0 ? 'text-amber-400' : 'text-emerald-400', bg: degradedServices > 0 ? 'bg-amber-400/10' : 'bg-emerald-400/10', icon: AlertCircle },
          { label: 'Feed Status', value: String(feedHealth).toUpperCase(), sub: 'NOAA/NWS/NHC data plane', text: feedHealth === 'online' ? 'text-emerald-400' : 'text-amber-400', bg: feedHealth === 'online' ? 'bg-emerald-400/10' : 'bg-amber-400/10', icon: Cloud },
          { label: 'Database State', value: String(dbHealth).toUpperCase(), sub: 'Persistence and run history', text: dbHealth === 'online' ? 'text-emerald-400' : 'text-amber-400', bg: dbHealth === 'online' ? 'bg-emerald-400/10' : 'bg-amber-400/10', icon: Database },
          { label: 'Stream Health', value: isConnected ? 'CONNECTED' : 'DEGRADED', sub: error ? error : isStreaming ? 'Pipeline SSE active' : 'Awaiting stream', text: isConnected ? 'text-cyan-400' : 'text-red-400', bg: isConnected ? 'bg-cyan-400/10' : 'bg-red-400/10', icon: Wifi },
        ].map(({ label, value, sub, text, bg, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border/50 bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className={cn('mt-1 text-lg font-semibold', text)}>{value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
              </div>
              <div className={cn('rounded-lg p-2', bg)}>
                <Icon className={cn('h-4 w-4', text)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Service Health Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">Service Health</h2>
          <div className={cn(
            'text-xs px-2.5 py-1 rounded-lg border font-mono',
            allOnline
              ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
              : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
          )}>
            {onlineCount}/{totalCount} ONLINE
          </div>
        </div>

        {health ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
            {Object.entries(health.services).map(([id, service]) => (
              <ServiceCard key={id} id={id} service={service as { status: string; label: string; version?: string; agents?: number; tables?: number; endpoints?: number; note?: string }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
            {['node_server', 'python_adk', 'database', 'noaa_api', 'llm_service', 'shelter_feed', 'routing_service'].map(id => {
              const Icon = SERVICE_ICONS[id] ?? Server;
              return (
                <div key={id} className="bg-card border border-border/50 rounded-xl p-4 animate-pulse">
                  <div className="w-9 h-9 rounded-lg bg-white/5 mb-3" />
                  <div className="h-3 bg-white/5 rounded w-3/4 mb-2" />
                  <div className="h-2 bg-white/5 rounded w-1/2" />
                  <Icon className="hidden" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pipeline Stream */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Controls */}
        <div className="space-y-3">
          <div className="bg-card border border-border/50 rounded-xl p-4">
            <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Pipeline Stream
            </h2>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Stream real-time agent execution events via SSE as the 4-agent pipeline runs.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => startStream('live')}
                disabled={isStreaming}
                className={cn(
                  'w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg border transition-all',
                  isStreaming
                    ? 'text-muted-foreground border-border/30 cursor-not-allowed'
                    : 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20 hover:bg-cyan-400/20'
                )}
              >
                <Play className="w-3 h-3" />
                {isStreaming ? 'Streaming...' : 'Start Live Stream'}
              </button>
              <button
                onClick={() => startStream('simulation')}
                disabled={isStreaming}
                className={cn(
                  'w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg border transition-all',
                  isStreaming
                    ? 'text-muted-foreground border-border/30 cursor-not-allowed'
                    : 'text-amber-400 bg-amber-400/10 border-amber-400/20 hover:bg-amber-400/20'
                )}
              >
                <Zap className="w-3 h-3" />
                {isStreaming ? 'Streaming...' : 'Start Simulation Stream'}
              </button>
              {isStreaming && (
                <button
                  onClick={stopStream}
                  className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg border text-red-400 bg-red-400/10 border-red-400/20 hover:bg-red-400/20 transition-all"
                >
                  <Square className="w-3 h-3" />Stop Stream
                </button>
              )}
              {(events.length > 0 || error) && !isStreaming && (
                <button
                  onClick={reset}
                  className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg border text-slate-400 bg-slate-400/10 border-slate-400/20 hover:bg-slate-400/20 transition-all"
                >
                  <RotateCcw className="w-3 h-3" />Reset
                </button>
              )}
            </div>
          </div>

          {/* Status summary */}
          {(isStreaming || events.length > 0) && (
            <div className="bg-card border border-border/50 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-medium">Stream Status</h3>
              {[
                { label: 'Phase', value: currentPhase > 0 ? `${currentPhase}/3` : '—' },
                { label: 'Agent', value: currentAgent ? (AGENT_ICONS[currentAgent] + ' ' + currentAgent.replace(/-/g, ' ')) : '—' },
                { label: 'Threat', value: threatLevel ?? '—' },
                { label: 'At Risk', value: totalAtRisk > 0 ? totalAtRisk.toLocaleString() : '—' },
                { label: 'Events', value: events.length },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                  <span className="text-[11px] text-foreground font-mono">{value}</span>
                </div>
              ))}
              {isComplete && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />Pipeline complete
                </div>
              )}
            </div>
          )}
        </div>

        {/* Event log */}
        <div className="bg-card border border-border/50 rounded-xl p-4 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">Live Event Log</h2>
            {isStreaming && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                STREAMING
              </span>
            )}
          </div>

          {error && (
            <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-4 flex items-start gap-3 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-400">Python ADK Service Not Running</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  cd python-agents && python3 server.py
                </p>
              </div>
            </div>
          )}

          {events.length === 0 && !error ? (
            <div className="text-center py-16">
              <GitBranch className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {isStreaming ? 'Waiting for pipeline events...' : 'Start a pipeline stream to see live events'}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Requires Python ADK service running on port 8000
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
              {events.map((ev, i) => (
                <EventRow key={i} ev={ev} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Architecture diagram */}
      <div className="bg-card border border-border/50 rounded-xl p-4">
        <h2 className="text-sm font-medium mb-4">BayShield Architecture</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {[
            { label: 'NOAA/NWS APIs', sub: 'Live data source', icon: '🌐', color: 'text-slate-400' },
            null,
            { label: 'Python ADK Service', sub: 'FastAPI + asyncio', icon: '🐍', color: 'text-yellow-400' },
            null,
            { label: 'Storm Watcher', sub: 'LoopAgent', icon: '🌀', color: 'text-cyan-400' },
            null,
            { label: 'VM + RC', sub: 'ParallelAgent ×2', icon: '⚡', color: 'text-emerald-400' },
            null,
            { label: 'Alert Commander', sub: 'SelfCorrectingLoop', icon: '🚨', color: 'text-red-400' },
            null,
            { label: 'Node.js tRPC', sub: 'Backend API', icon: '⚙️', color: 'text-blue-400' },
            null,
            { label: 'MySQL DB', sub: '7 tables', icon: '🗄️', color: 'text-purple-400' },
            null,
            { label: 'React Frontend', sub: 'SSE + tRPC', icon: '🖥️', color: 'text-pink-400' },
          ].map((item, i) =>
            item === null ? (
              <ArrowRight key={i} className="w-4 h-4 text-border flex-shrink-0" />
            ) : (
              <div key={i} className="flex-shrink-0 bg-background/50 border border-border/30 rounded-xl px-3 py-2 text-center min-w-[90px]">
                <p className="text-lg">{item.icon}</p>
                <p className={cn('text-[11px] font-medium', item.color)}>{item.label}</p>
                <p className="text-[9px] text-muted-foreground">{item.sub}</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
