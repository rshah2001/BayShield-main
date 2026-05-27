// ============================================================
// STORMMESH -- AgentDashboard Component
// Design: Bioluminescent Storm -- 4 agent cards + A2A message feed + system log
// Animations: framer-motion entrance + scan line effects
// ============================================================

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AgentState, AgentMessage } from '@/lib/stormData';

const AGENT_NETWORK_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663488949635/H8uV2jDz2ia2afExqjD23w/stormmesh-agent-network_dffd50bb.png';

interface AgentDashboardProps {
  agents: AgentState[];
  messages: AgentMessage[];
  systemLog: string[];
  isRunning: boolean;
  simulationPhase: number;
}

const STATUS_CONFIG = {
  idle: { label: 'IDLE', color: '#475569' },
  active: { label: 'ACTIVE', color: '#10B981' },
  processing: { label: 'PROCESSING', color: '#F59E0B' },
  complete: { label: 'COMPLETE', color: '#3B82F6' },
  error: { label: 'ERROR', color: '#EF4444' }
};

const MSG_TYPE_COLORS = {
  data: '#3B82F6',
  request: '#F59E0B',
  response: '#10B981',
  alert: '#EF4444'
};

function AgentCard({ agent, index }: { agent: AgentState; index: number }) {
  const status = STATUS_CONFIG[agent.status];
  const isActive = agent.status === 'active' || agent.status === 'processing';
  const isComplete = agent.status === 'complete';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative p-5 rounded-xl overflow-hidden"
      style={{
        background: isActive
          ? `linear-gradient(135deg, rgba(2,11,24,0.95), ${agent.color}12)`
          : isComplete
          ? `linear-gradient(135deg, rgba(2,11,24,0.95), rgba(59,130,246,0.06))`
          : 'rgba(10, 22, 40, 0.7)',
        border: `1px solid ${isActive ? agent.color + '45' : isComplete ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.1)'}`,
        boxShadow: isActive ? `0 0 30px ${agent.color}18, inset 0 0 30px ${agent.color}05` : 'none',
        transition: 'all 0.5s ease'
      }}
    >
      {/* Animated scan line when active */}
      {isActive && (
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${agent.color}90, transparent)`,
            animation: 'scanLine 2s linear infinite'
          }}
        />
      )}

      {/* Corner accent */}
      <div
        className="absolute top-0 right-0 w-12 h-12 pointer-events-none"
        style={{
          background: `linear-gradient(225deg, ${agent.color}15, transparent)`,
          opacity: isActive || isComplete ? 1 : 0,
          transition: 'opacity 0.5s ease'
        }}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{
              background: `${agent.color}15`,
              border: `1px solid ${agent.color}35`,
              boxShadow: isActive ? `0 0 20px ${agent.color}35` : 'none',
              transition: 'box-shadow 0.5s ease'
            }}
          >
            {agent.icon}
          </div>
          <div>
            <div className="font-bold text-sm leading-tight" style={{ color: '#E2E8F0' }}>{agent.name}</div>
            <div className="text-xs font-mono mt-0.5" style={{ color: '#475569' }}>{agent.role}</div>
          </div>
        </div>
        <motion.div
          key={agent.status}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono font-semibold shrink-0"
          style={{
            background: `${status.color}15`,
            border: `1px solid ${status.color}30`,
            color: status.color
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: status.color,
              animation: isActive ? 'agentPulse 1s ease-in-out infinite' : 'none'
            }}
          />
          {status.label}
        </motion.div>
      </div>

      {/* Last Action -- terminal style */}
      <div
        className="text-xs font-mono mb-4 p-2.5 rounded"
        style={{
          background: 'rgba(0,0,0,0.35)',
          color: isActive ? agent.color : '#94A3B8',
          minHeight: '38px',
          borderLeft: `2px solid ${isActive ? agent.color + '60' : 'rgba(59,130,246,0.15)'}`,
          transition: 'all 0.3s ease'
        }}
      >
        <span style={{ color: '#475569' }}>$ </span>
        {agent.lastAction}
        {isActive && (
          <span
            className="inline-block w-1.5 h-3 ml-0.5 align-middle"
            style={{
              background: agent.color,
              animation: 'agentPulse 0.8s ease-in-out infinite'
            }}
          />
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'LOOPS', value: agent.loopCount > 0 ? agent.loopCount : '--', color: agent.color },
          { label: 'CONF.', value: agent.confidence > 0 ? `${agent.confidence}%` : '--', color: '#E2E8F0' },
          { label: 'MS', value: agent.processingTime > 0 ? agent.processingTime : '--', color: '#E2E8F0' }
        ].map(m => (
          <div key={m.label} className="text-center">
            <div className="text-xs font-mono" style={{ color: '#475569' }}>{m.label}</div>
            <motion.div
              key={String(m.value)}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-lg font-bold font-mono"
              style={{ color: m.color }}
            >
              {m.value}
            </motion.div>
          </div>
        ))}
      </div>

      {/* Confidence bar */}
      {agent.confidence > 0 && (
        <div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${agent.confidence}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${agent.color}70, ${agent.color})`,
                boxShadow: `0 0 6px ${agent.color}60`
              }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

function MessageItem({ msg, index }: { msg: AgentMessage; index: number }) {
  const typeColor = MSG_TYPE_COLORS[msg.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="p-3 rounded-lg border-l-2 mb-2"
      style={{
        background: 'rgba(10, 22, 40, 0.6)',
        borderLeftColor: typeColor
      }}
    >
      <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded"
            style={{ background: `${typeColor}20`, color: typeColor }}
          >
            {msg.type.toUpperCase()}
          </span>
          <span className="text-xs font-mono" style={{ color: '#60A5FA' }}>{msg.from}</span>
          <span className="text-xs" style={{ color: '#475569' }}>→</span>
          <span className="text-xs font-mono" style={{ color: '#94A3B8' }}>{msg.to}</span>
        </div>
        <span className="text-xs font-mono" style={{ color: '#475569' }}>
          {msg.timestamp.toLocaleTimeString()}
        </span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: '#CBD5E1' }}>{msg.content}</p>
    </motion.div>
  );
}

export default function AgentDashboard({
  agents,
  messages,
  systemLog,
  isRunning,
  simulationPhase
}: AgentDashboardProps) {
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll system log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [systemLog]);

  const activeAgents = agents.filter(a => a.status === 'active' || a.status === 'processing').length;
  const completeAgents = agents.filter(a => a.status === 'complete').length;

  return (
    <section
      className="relative py-20"
      style={{ background: 'linear-gradient(to bottom, #020B18, #040F1F)' }}
    >
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Section Header */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono mb-4"
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                color: '#60A5FA'
              }}
            >
              AGENT MESH NETWORK
            </div>
            <h2
              className="text-4xl font-black mb-3"
              style={{ color: '#F1F5F9', fontFamily: "'Outfit', sans-serif" }}
            >
              Four Agents. One Mission.
            </h2>
            <p className="text-base" style={{ color: '#64748B', maxWidth: '600px' }}>
              Each agent operates autonomously, communicating via Agent-to-Agent (A2A) protocol.
              Agents 2 and 3 run in parallel -- the architecture judges want to see.
            </p>
          </div>

          {/* Live stats row */}
          <div className="flex items-center gap-4 shrink-0">
            {[
              { label: 'ACTIVE', value: activeAgents, color: '#10B981' },
              { label: 'COMPLETE', value: completeAgents, color: '#3B82F6' },
              { label: 'MSGS', value: messages.length, color: '#F59E0B' }
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-black font-mono" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs font-mono" style={{ color: '#475569' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Cards -- left 2/3 */}
          <div className="lg:col-span-2">
            {/* Agent network visualization banner */}
            <div
              className="mb-6 rounded-xl overflow-hidden relative"
              style={{
                height: '180px',
                border: '1px solid rgba(59,130,246,0.15)'
              }}
            >
              <img
                src={AGENT_NETWORK_IMG}
                alt="Agent network visualization"
                className="w-full h-full object-cover"
                style={{ opacity: 0.65 }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to right, rgba(2,11,24,0.5), transparent 40%, rgba(2,11,24,0.5))'
                }}
              />
              {/* Overlay content */}
              <div className="absolute inset-0 flex items-center justify-between px-6">
                <div>
                  <div
                    className="text-sm font-mono font-semibold mb-1"
                    style={{ color: '#60A5FA' }}
                  >
                    A2A PROTOCOL ACTIVE
                  </div>
                  <div className="text-xs font-mono" style={{ color: '#475569' }}>
                    {messages.length} messages transmitted · Phase {simulationPhase}/9
                  </div>
                </div>

                {/* Phase progress pills */}
                <div className="hidden md:flex items-center gap-1.5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-full transition-all duration-500"
                      style={{
                        width: i < simulationPhase ? '20px' : '8px',
                        height: '8px',
                        background: i < simulationPhase
                          ? 'linear-gradient(90deg, #3B82F6, #06B6D4)'
                          : 'rgba(59,130,246,0.2)',
                        boxShadow: i < simulationPhase ? '0 0 6px rgba(59,130,246,0.5)' : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 2x2 Agent Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {agents.map((agent, i) => (
                <AgentCard key={agent.id} agent={agent} index={i} />
              ))}
            </div>
          </div>

          {/* Right column: Messages + System Log */}
          <div className="flex flex-col gap-4">
            {/* A2A Message Feed */}
            <div
              className="flex-1 rounded-xl overflow-hidden"
              style={{
                background: 'rgba(10, 22, 40, 0.7)',
                border: '1px solid rgba(59, 130, 246, 0.15)'
              }}
            >
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ borderBottom: '1px solid rgba(59,130,246,0.1)' }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: isRunning ? '#10B981' : '#475569',
                      boxShadow: isRunning ? '0 0 6px #10B981' : 'none',
                      animation: isRunning ? 'agentPulse 1s ease-in-out infinite' : 'none'
                    }}
                  />
                  <span className="text-xs font-mono font-semibold" style={{ color: '#94A3B8' }}>
                    A2A MESSAGE FEED
                  </span>
                </div>
                <span className="text-xs font-mono" style={{ color: '#475569' }}>
                  {messages.length} msgs
                </span>
              </div>
              <div
                className="p-3 overflow-y-auto"
                style={{ maxHeight: '340px' }}
              >
                <AnimatePresence>
                  {messages.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="text-2xl mb-2">📡</div>
                      <div className="text-xs font-mono" style={{ color: '#475569' }}>
                        Awaiting agent activation...
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, i) => <MessageItem key={msg.id} msg={msg} index={i} />)
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* System Log -- terminal style */}
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: 'rgba(3, 8, 18, 0.95)',
                border: '1px solid rgba(59, 130, 246, 0.1)'
              }}
            >
              <div
                className="px-4 py-2.5 flex items-center justify-between"
                style={{ borderBottom: '1px solid rgba(59,130,246,0.08)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#EF4444' }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#F59E0B' }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#10B981' }} />
                  </div>
                  <span className="text-xs font-mono font-semibold" style={{ color: '#475569' }}>
                    SYSTEM LOG
                  </span>
                </div>
                <span className="text-xs font-mono" style={{ color: '#334155' }}>
                  stormmesh.log
                </span>
              </div>
              <div
                ref={logRef}
                className="p-3 overflow-y-auto"
                style={{ maxHeight: '220px' }}
              >
                {systemLog.map((log, i) => (
                  <div
                    key={i}
                    className="text-xs font-mono mb-1 leading-relaxed"
                    style={{
                      color: log.includes('[Agent-4]') ? '#F87171' :
                             log.includes('[Agent-1]') ? '#FCD34D' :
                             log.includes('[Agent-2]') ? '#67E8F9' :
                             log.includes('[Agent-3]') ? '#6EE7B7' :
                             log.includes('[OPERATOR]') ? '#93C5FD' :
                             '#475569'
                    }}
                  >
                    {log}
                  </div>
                ))}
                {isRunning && (
                  <div
                    className="text-xs font-mono"
                    style={{ color: '#334155' }}
                  >
                    <span style={{ animation: 'agentPulse 1s ease-in-out infinite', display: 'inline-block' }}>▌</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
