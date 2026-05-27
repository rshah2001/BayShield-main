/**
 * ADKPipelinePanel — Shows real Python ADK agent execution traces
 * Displays agent status, execution times, A2A messages, and LLM summaries
 * from the backend pipeline.
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useBayShieldBackend } from '@/hooks/useBayShieldBackend';
import { AIChatBox, type Message as ChatMessage } from '@/components/AIChatBox';
import {
  Activity, Zap, GitBranch, RotateCcw, Play, AlertCircle,
  CheckCircle2, Clock, ChevronDown, ChevronRight, Cpu, Wifi, WifiOff
} from 'lucide-react';

const AGENT_CONFIG: Record<string, { icon: string; color: string; pattern: string }> = {
  'storm-watcher':        { icon: '🌀', color: 'text-cyan-400',    pattern: 'LoopAgent' },
  'vulnerability-mapper': { icon: '🗺️', color: 'text-emerald-400', pattern: 'ParallelAgent' },
  'resource-coordinator': { icon: '📦', color: 'text-amber-400',   pattern: 'ParallelAgent' },
  'alert-commander':      { icon: '🚨', color: 'text-red-400',     pattern: 'SelfCorrectingLoopAgent' },
};

const EVENT_COLORS: Record<string, string> = {
  ALERT:      'text-red-400 bg-red-400/10 border-red-400/20',
  DATA:       'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  STATUS:     'text-blue-400 bg-blue-400/10 border-blue-400/20',
  CORRECTION: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  COMMAND:    'text-purple-400 bg-purple-400/10 border-purple-400/20',
  RESPONSE:   'text-slate-400 bg-slate-400/10 border-slate-400/20',
};

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg border border-border/30 bg-black/20 p-3 text-[10px] leading-relaxed text-slate-300">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function AgentTraceCard({ trace }: { trace: {
  agent_id: string; agent_name: string; status: string;
  confidence: number; loop_iteration: number; output_type: string;
  deterministic_rationale: string; execution_ms: number;
  llm_narrative?: string | null;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  started_at?: string | null;
  completed_at?: string | null;
}}) {
  const [expanded, setExpanded] = useState(true);
  const cfg = AGENT_CONFIG[trace.agent_id] ?? { icon: '⚙️', color: 'text-slate-400', pattern: 'Agent' };

  return (
    <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/3 transition-colors text-left"
      >
        <span className="text-lg">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-medium', cfg.color)}>{trace.agent_name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-muted-foreground font-mono">
              {cfg.pattern}
            </span>
            {trace.output_type === 'estimated' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/20 font-mono">
                ESTIMATED
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              {trace.confidence}% confidence
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {trace.execution_ms}ms
            </span>
            <span>Loop #{trace.loop_iteration}</span>
          </div>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/30 pt-3">
          <div className="space-y-3">
            {trace.started_at && (
              <div className="grid grid-cols-1 gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                <div>Started: <span className="font-mono text-foreground">{new Date(trace.started_at).toLocaleTimeString('en-US', { hour12: false })}</span></div>
                <div>Completed: <span className="font-mono text-foreground">{trace.completed_at ? new Date(trace.completed_at).toLocaleTimeString('en-US', { hour12: false }) : '—'}</span></div>
              </div>
            )}
            {trace.llm_narrative && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wide text-cyan-300">LLM Narrative</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{trace.llm_narrative}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wide text-foreground">Deterministic Rationale</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{trace.deterministic_rationale}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wide text-foreground">Input Payload</p>
              <JsonBlock value={trace.input_payload} />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wide text-foreground">Output Payload</p>
              <JsonBlock value={trace.output_payload} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageRow({ msg }: { msg: {
  id: string; from_agent: string; to_agent: string;
  event_type: string; content: string; timestamp: string;
  payload: Record<string, unknown>;
}}) {
  const [expanded, setExpanded] = useState(false);
  const fromCfg = AGENT_CONFIG[msg.from_agent];
  const toCfg = AGENT_CONFIG[msg.to_agent];
  const evStyle = EVENT_COLORS[msg.event_type] ?? EVENT_COLORS.STATUS;
  const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour12: false });

  return (
    <div className="border-b border-border/20 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full gap-3 py-2.5 text-left"
      >
        <div className="flex-shrink-0 w-16 text-right">
          <span className="text-[10px] text-muted-foreground font-mono">{time}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium">
              {fromCfg?.icon ?? '⚙️'} {msg.from_agent.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
            <span className="text-muted-foreground text-xs">→</span>
            <span className="text-xs text-muted-foreground">
              {toCfg?.icon ?? '⚙️'} {msg.to_agent.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-mono ml-auto', evStyle)}>
              {msg.event_type}
            </span>
            {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground leading-snug">{msg.content}</p>
          {expanded && <JsonBlock value={msg.payload} />}
        </div>
      </button>
    </div>
  );
}

function RawRunPanel({ result }: { result: unknown }) {
  return (
    <div className="bg-card border border-border/50 rounded-xl p-4">
      <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Raw Pipeline JSON</p>
      <JsonBlock value={result} />
    </div>
  );
}

export default function ADKPipelinePanel() {
  const {
    isAdkAvailable, lastPipelineResult, isRunningPipeline,
    pipelineError, latestRun, runPipeline, generateSummary,
    isGeneratingSummary, askBayShield, isChatting,
  } = useBayShieldBackend();

  const [llmSummary, setLlmSummary] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'traces' | 'messages' | 'plans' | 'raw'>('traces');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Ask about the latest pipeline run, BayShield agents, evacuation planning, or how the system works. Responses are grounded in project docs and the most recent saved run when available.',
    },
  ]);

  const result = lastPipelineResult;
  const dbRun = latestRun?.run;

  const handleRunPipeline = async () => {
    await runPipeline('live');
  };

  const handleGenerateSummary = async () => {
    if (!result) return;
    const summary = await generateSummary({
      threatLevel: result.threat_level,
      totalAtRisk: result.total_at_risk,
      planCount: result.action_plans.length,
      correctionApplied: result.self_correction_applied,
    });
    setLlmSummary(summary);
  };

  const handleSendMessage = (content: string) => {
    const nextMessages: ChatMessage[] = [...chatMessages, { role: 'user', content }];
    setChatMessages(nextMessages);

    askBayShield(nextMessages)
      .then(response => {
        setChatMessages(current => [...current, {
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
        }]);
      })
      .catch(error => {
        setChatMessages(current => [
          ...current,
          {
            role: 'assistant',
            content: `I couldn't answer that from BayShield right now. ${error instanceof Error ? error.message : 'Unknown error.'}`,
            sources: [{ title: 'BayShield runtime error', source: 'Runtime' }],
          },
        ]);
      });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            Python ADK Agent Service
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real agent execution traces from the backend pipeline
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* ADK service status */}
          <div className={cn(
            'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border',
            isAdkAvailable
              ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
              : 'text-slate-400 bg-slate-400/10 border-slate-400/20'
          )}>
            {isAdkAvailable ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isAdkAvailable ? 'ADK Online' : 'ADK Offline'}
          </div>
          <button
            onClick={handleRunPipeline}
            disabled={isRunningPipeline || !isAdkAvailable}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all',
              isRunningPipeline || !isAdkAvailable
                ? 'text-muted-foreground border-border/30 cursor-not-allowed'
                : 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20 hover:bg-cyan-400/20'
            )}
          >
            {isRunningPipeline ? (
              <><Activity className="w-3 h-3 animate-pulse" />Running...</>
            ) : (
              <><Play className="w-3 h-3" />Run Pipeline</>
            )}
          </button>
        </div>
      </div>

      {/* ADK Offline notice */}
      {!isAdkAvailable && (
        <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-400">Python ADK Service Not Running</p>
            <p className="text-xs text-muted-foreground mt-1">
              Start the service with: <code className="font-mono bg-white/5 px-1 py-0.5 rounded">cd python-agents && python3 server.py</code>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              The simulation mode above uses the same 4-agent architecture implemented in Python.
            </p>
          </div>
        </div>
      )}

      {/* Pipeline error */}
      {pipelineError && (
        <div className="bg-red-400/5 border border-red-400/20 rounded-xl p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <p className="text-xs text-red-400">{pipelineError}</p>
        </div>
      )}

      {/* Last run summary */}
      {(result || dbRun) && (
        <div className="bg-card border border-border/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-foreground">Last Pipeline Run</h3>
            <div className="flex items-center gap-2">
              {(result?.self_correction_applied || dbRun?.selfCorrectionApplied) && (
                <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                  <RotateCcw className="w-2.5 h-2.5" />Self-Correction Applied
                </span>
              )}
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded-full border font-mono font-semibold',
                (result?.threat_level || dbRun?.threatLevel) === 'CRITICAL' ? 'text-red-400 bg-red-400/10 border-red-400/20' :
                (result?.threat_level || dbRun?.threatLevel) === 'WARNING' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' :
                'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
              )}>
                {result?.threat_level || dbRun?.threatLevel || 'NONE'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'At Risk', value: (result?.total_at_risk || dbRun?.totalAtRisk || 0).toLocaleString(), icon: '👥' },
              { label: 'Action Plans', value: result?.action_plans?.length ?? '—', icon: '📋' },
              { label: 'A2A Messages', value: result?.messages?.length ?? '—', icon: '📡' },
            ].map(({ label, value, icon }) => (
              <div key={label} className="text-center">
                <p className="text-lg">{icon}</p>
                <p className="text-sm font-semibold text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* LLM Summary */}
          {llmSummary ? (
            <div className="mt-3 p-3 bg-purple-400/5 border border-purple-400/20 rounded-lg">
              <p className="text-[10px] text-purple-400 font-mono mb-1">LLM BRIEFING</p>
              <p className="text-xs text-foreground leading-relaxed">{llmSummary}</p>
            </div>
          ) : result && (
            <button
              onClick={handleGenerateSummary}
              disabled={isGeneratingSummary}
              className="mt-3 w-full text-xs text-purple-400 bg-purple-400/10 border border-purple-400/20 rounded-lg py-2 hover:bg-purple-400/20 transition-colors"
            >
              {isGeneratingSummary ? 'Generating LLM Briefing...' : '✨ Generate LLM Emergency Briefing'}
            </button>
          )}
        </div>
      )}

      <div className="bg-card border border-border/50 rounded-xl p-4">
        <div className="mb-3">
          <h3 className="text-xs font-medium text-foreground">BayShield RAG Assistant</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Grounded answers from BayShield docs and the latest pipeline record.
          </p>
        </div>
        <AIChatBox
          messages={chatMessages}
          onSendMessage={handleSendMessage}
          isLoading={isChatting}
          height={360}
          emptyStateMessage="Ask BayShield about the current disaster-response context"
          suggestedPrompts={[
            'What does Alert Commander do in the pipeline?',
            'Summarize the latest pipeline run in plain English.',
            'How is the evacuation routing score calculated?',
          ]}
        />
      </div>

      {/* Tabs */}
      {result && (
        <>
          <div className="flex gap-1 bg-white/3 rounded-lg p-1">
            {(['traces', 'messages', 'plans', 'raw'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 text-xs py-1.5 rounded-md transition-colors capitalize',
                  activeTab === tab
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab === 'traces' ? `Agent Traces (${result.agent_traces.length})` :
                 tab === 'messages' ? `A2A Messages (${result.messages.length})` :
                 tab === 'plans' ? `Action Plans (${result.action_plans.length})` :
                 'Raw JSON'}
              </button>
            ))}
          </div>

          {/* Agent Traces */}
          {activeTab === 'traces' && (
            <div className="space-y-2">
              {result.agent_traces.map((trace, i) => (
                <AgentTraceCard key={i} trace={trace} />
              ))}
            </div>
          )}

          {/* A2A Messages */}
          {activeTab === 'messages' && (
            <div className="bg-card border border-border/50 rounded-xl p-4">
              <div className="divide-y divide-border/20">
                {result.messages.map((msg, i) => (
                  <MessageRow key={i} msg={msg} />
                ))}
              </div>
            </div>
          )}

          {/* Action Plans */}
          {activeTab === 'plans' && (
            <div className="space-y-2">
              {result.action_plans.map((plan) => (
                <div key={plan.id} className="bg-card border border-border/50 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-mono font-bold',
                        plan.priority === 1 ? 'text-red-400 bg-red-400/10' :
                        plan.priority === 2 ? 'text-amber-400 bg-amber-400/10' :
                        'text-blue-400 bg-blue-400/10'
                      )}>P{plan.priority}</span>
                      <span className="text-xs font-medium">{plan.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {plan.correction_applied && (
                        <span className="text-[9px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">
                          Corrected
                        </span>
                      )}
                      <span className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded border font-mono',
                        plan.output_type === 'deterministic'
                          ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                          : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                      )}>
                        {plan.output_type.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1.5">{plan.action}</p>
                  {plan.population > 0 && (
                    <p className="text-[11px] text-foreground">
                      <span className="text-muted-foreground">Population: </span>
                      {plan.population.toLocaleString()} people
                    </p>
                  )}
                  {plan.shelter && plan.shelter !== 'All active shelters' && (
                    <p className="text-[11px] text-foreground">
                      <span className="text-muted-foreground">Shelter: </span>
                      {plan.shelter}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1.5 italic leading-snug">
                    {plan.rationale}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'raw' && <RawRunPanel result={result} />}
        </>
      )}
    </div>
  );
}
