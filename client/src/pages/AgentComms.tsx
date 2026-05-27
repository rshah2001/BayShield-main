// ============================================================
// BAYSHIELD -- Agent Communications Page
// Real-time A2A message bus, event types, payload inspector, pipeline viz
// ============================================================
import { useState } from 'react';
import { useSimulation } from '@/contexts/SimulationContext';
import { cn } from '@/lib/utils';
import { ArrowRight, MessageSquare, Zap, GitBranch, RotateCcw, CheckCircle2, Filter } from 'lucide-react';
import ADKPipelinePanel from '@/components/ADKPipelinePanel';

const MSG_TYPE_STYLES: Record<string, { bg: string; border: string; text: string; barColor: string }> = {
  alert:    { bg: 'bg-red-400/8',     border: 'border-red-400/20',    text: 'text-red-400',    barColor: '#f87171' },
  request:  { bg: 'bg-amber-400/8',   border: 'border-amber-400/20',  text: 'text-amber-400',  barColor: '#fbbf24' },
  data:     { bg: 'bg-emerald-400/8', border: 'border-emerald-400/20',text: 'text-emerald-400',barColor: '#34d399' },
  response: { bg: 'bg-blue-400/8',    border: 'border-blue-400/20',   text: 'text-blue-400',   barColor: '#60a5fa' },
};

const AGENT_COLORS: Record<string, string> = {
  'Storm Watcher': 'text-cyan-400', 'Vulnerability Mapper': 'text-emerald-400',
  'Resource Coordinator': 'text-amber-400', 'Alert Commander': 'text-red-400',
  'System': 'text-slate-400', 'All Zones': 'text-purple-400',
};
const AGENT_ICONS: Record<string, string> = {
  'Storm Watcher': '🌀', 'Vulnerability Mapper': '🗺️',
  'Resource Coordinator': '📦', 'Alert Commander': '🚨',
  'System': '⚙️', 'All Zones': '📡',
};

const PIPELINE_STEPS = [
  { label: 'Storm Watcher',        role: 'LoopAgent',               icon: '🌀', desc: 'Polls NOAA every 30s, escalates severity levels' },
  { label: 'Vulnerability Mapper', role: 'ParallelAgent',           icon: '🗺️', desc: 'Flood zones + population vulnerability analysis' },
  { label: 'Resource Coordinator', role: 'ParallelAgent',           icon: '📦', desc: 'Shelters, routes, supply depot inventory' },
  { label: 'Alert Commander',      role: 'SelfCorrectingLoopAgent', icon: '🚨', desc: 'Generates + self-corrects prioritized action plans' },
];

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function AgentComms() {
  const { messages, agents, isRunning } = useSimulation();
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const agentMap = Object.fromEntries(agents.map(a => [a.name, a]));

  const filtered = filterAgent === 'all' ? messages : messages.filter(m => m.from === filterAgent || m.to === filterAgent);
  const alertCount = messages.filter(m => m.type === 'alert').length;
  const requestCount = messages.filter(m => m.type === 'request').length;
  const responseCount = messages.filter(m => m.type === 'response').length;
  const selfCorrections = messages.filter(m => m.eventType?.includes('SELF_CORRECTION')).length;
  const handoffCount = requestCount + responseCount;
  const payloadCoverage = messages.filter(m => m.payload && m.payload !== '{}' && m.payload !== 'null').length;
  const topTalker = Object.entries(
    messages.reduce<Record<string, number>>((acc, message) => {
      acc[message.from] = (acc[message.from] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="min-h-full space-y-5 p-4 sm:p-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Agent Communications</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time A2A message bus -- agent-to-agent protocol</p>
        </div>
        {isRunning && (
          <span className="flex items-center gap-1.5 text-xs text-violet-300 bg-violet-400/10 border border-violet-400/20 px-2.5 py-1 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-300 animate-pulse" />MESSAGE BUS ACTIVE
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {[
          {
            title: 'Agent Comms = Why The System Decided Something',
            body: 'Use this page to inspect agent-to-agent traffic, payloads, and self-correction logic when you need to understand or debug BayShield autonomy.',
            tone: 'border-violet-400/20 bg-violet-400/10 text-violet-100',
          },
          {
            title: 'Best For',
            body: 'Tracing pipeline reasoning, confirming which agent produced a plan, and reviewing raw message payloads during anomalies.',
            tone: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
          },
          {
            title: 'Not For',
            body: 'Shelter capacity management, map operations, or executive summary. This page is the internal nerve bus, not the command summary.',
            tone: 'border-white/10 bg-white/5 text-slate-200',
          },
        ].map(card => (
          <div key={card.title} className={cn('rounded-xl border p-4', card.tone)}>
            <p className="text-xs font-semibold">{card.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-current/80">{card.body}</p>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Exchange Volume', value: messages.length, sub: `${payloadCoverage} messages carried payloads`, icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { label: 'Active Handoffs', value: handoffCount, sub: `${requestCount} requests / ${responseCount} responses`, icon: GitBranch, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
          { label: 'Alert Traffic', value: alertCount, sub: `${selfCorrections} self-correction loops`, icon: Zap, color: 'text-red-400', bg: 'bg-red-400/10' },
          { label: 'Top Talker', value: topTalker ? `${topTalker[0]} (${topTalker[1]})` : 'No traffic yet', sub: 'most frequent sender in the current log', icon: RotateCcw, color: 'text-amber-400', bg: 'bg-amber-400/10' },
        ].map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border/50 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                <p className={cn('text-lg font-semibold', color)}>{value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
              </div>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', bg)}>
                <Icon className={cn('w-4 h-4', color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <div className="bg-card border border-border/50 rounded-xl p-4">
        <h2 className="text-sm font-medium mb-4">Agent Pipeline Architecture</h2>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch xl:gap-0">
          {PIPELINE_STEPS.map((step, i) => {
            const agent = agentMap[step.label];
            const isActive = agent?.status !== 'idle';
            const isParallel = step.role === 'ParallelAgent';
            const isSelfCorrect = step.role.includes('SelfCorrect');
            return (
              <div key={step.label} className="flex flex-1 flex-col xl:flex-row xl:items-center">
                <div className={cn('flex-1 rounded-xl p-3 border transition-all duration-500',
                  isActive ? 'bg-primary/8 border-primary/25' : 'bg-background/50 border-border/30'
                )}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg leading-none">{step.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-tight truncate">{step.label}</p>
                      <p className={cn('text-[10px] font-mono',
                        isParallel ? 'text-emerald-400' : isSelfCorrect ? 'text-amber-400' : 'text-blue-400'
                      )}>{step.role}</p>
                    </div>
                    {isActive && <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{step.desc}</p>
                  {agent && agent.confidence > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="flex-1 h-0.5 bg-border/40 rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full transition-all duration-700" style={{ width: `${agent.confidence}%` }} />
                      </div>
                      <span className="text-[9px] text-muted-foreground font-mono">{agent.confidence}%</span>
                    </div>
                  )}
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className="flex items-center justify-center py-1 xl:flex-col xl:px-1.5 xl:py-0">
                    <ArrowRight className={cn('h-4 w-4 rotate-90 xl:rotate-0', isActive ? 'text-primary' : 'text-border')} />
                    {i === 1 && <span className="ml-1 text-[9px] font-mono text-emerald-400 xl:ml-0 xl:mt-0.5">parallel</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ADK Backend Panel */}
      <ADKPipelinePanel />

      {/* Message log */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {/* Sidebar filter */}
        <div className="space-y-3">
          <div className="bg-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <h2 className="text-sm font-medium">Filter</h2>
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setFilterAgent('all')}
                className={cn('w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors',
                  filterAgent === 'all' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground'
                )}
              >All Messages ({messages.length})</button>
              {Object.keys(AGENT_ICONS).filter(n => !['System', 'All Zones'].includes(n)).map(name => {
                const count = messages.filter(m => m.from === name || m.to === name).length;
                return (
                  <button
                    key={name}
                    onClick={() => setFilterAgent(filterAgent === name ? 'all' : name)}
                    className={cn('w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5',
                      filterAgent === name ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span>{AGENT_ICONS[name]}</span>
                    <span className="truncate flex-1">{name}</span>
                    <span className="text-[10px] opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type legend */}
          <div className="bg-card border border-border/50 rounded-xl p-4">
            <h2 className="text-sm font-medium mb-3">Message Types</h2>
            <div className="space-y-1.5">
              {Object.entries(MSG_TYPE_STYLES).map(([type, s]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: s.barColor }} />
                  <span className={cn('text-xs font-mono uppercase', s.text)}>{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Message feed */}
        <div className="bg-card border border-border/50 rounded-xl p-4 xl:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">A2A Message Log</h2>
            <div className="flex items-center gap-2">
              {filterAgent !== 'all' && (
                <button onClick={() => setFilterAgent('all')} className="text-[11px] text-primary hover:opacity-80 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              )}
              <span className="text-[11px] text-muted-foreground font-mono">{filtered.length} messages</span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {isRunning ? 'Waiting for first agent message...' : 'Start the live pipeline to see A2A messages'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
              {[...filtered].reverse().map((msg, i) => {
                const ts = MSG_TYPE_STYLES[msg.type] ?? MSG_TYPE_STYLES.data;
                let parsedPayload: Record<string, unknown> | null = null;
                try { parsedPayload = JSON.parse(msg.payload ?? '{}'); } catch { /* ignore */ }
                return (
                  <div key={msg.id} className={cn('rounded-xl border p-3 transition-all', ts.bg, ts.border,
                    i === 0 && isRunning && 'ring-1 ring-primary/20'
                  )}>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-[10px] font-mono text-muted-foreground">{fmtTime(msg.timestamp)}</span>
                      <span className={cn('text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase', ts.bg, ts.border, ts.text)}>
                        {msg.type}
                      </span>
                      {msg.eventType && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded border border-border/30">
                          {msg.eventType}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-sm leading-none">{AGENT_ICONS[msg.from] ?? '⚙️'}</span>
                      <span className={cn('text-xs font-semibold', AGENT_COLORS[msg.from] ?? 'text-foreground')}>{msg.from}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm leading-none">{AGENT_ICONS[msg.to] ?? '⚙️'}</span>
                      <span className={cn('text-xs font-semibold', AGENT_COLORS[msg.to] ?? 'text-foreground')}>{msg.to}</span>
                    </div>
                    <p className="text-[11px] text-foreground/80 leading-relaxed mb-2">{msg.content}</p>
                    {parsedPayload && Object.keys(parsedPayload).length > 0 && (
                      <div className="bg-background/60 rounded-lg p-2 border border-border/30">
                        <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider mb-1">Payload</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {Object.entries(parsedPayload).map(([k, v]) => (
                            <span key={k} className="text-[10px] font-mono">
                              <span className="text-muted-foreground">{k}:</span>{' '}
                              <span className="text-primary/80">{Array.isArray(v) ? `[${(v as unknown[]).length}]` : String(v)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
