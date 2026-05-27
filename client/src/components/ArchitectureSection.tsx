// ============================================================
// STORMMESH -- ArchitectureSection Component
// Design: Technical deep-dive into agent architecture with flow diagram
// ============================================================

const ALERT_PANEL_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663488949635/H8uV2jDz2ia2afExqjD23w/stormmesh-alert-panel_30f4494a.png';

const AGENTS_DETAIL = [
  {
    number: '01',
    name: 'Storm Watcher',
    subtitle: 'The Observer',
    pattern: 'LoopAgent',
    color: '#F59E0B',
    description: 'Continuously polls NOAA NHC and OpenWeatherMap APIs for real-time hurricane data. Uses a LoopAgent pattern to re-evaluate threat severity on every cycle, escalating from monitoring → advisory → warning → critical as conditions deteriorate.',
    capabilities: [
      'NOAA NHC API integration',
      'OpenWeatherMap real-time polling',
      'Severity escalation logic',
      'A2A broadcast to downstream agents',
      'Continuous loop with configurable interval'
    ],
    trigger: 'Autonomous -- polls every 5 minutes',
    output: 'Threat level + storm parameters → Agents 2 & 3'
  },
  {
    number: '02',
    name: 'Vulnerability Mapper',
    subtitle: 'The Analyst',
    pattern: 'ParallelAgent',
    color: '#06B6D4',
    description: 'Activated by Storm Watcher via A2A. Runs in parallel with Resource Coordinator to maximize speed. Pulls FEMA flood zone data, cross-references with census vulnerability metrics (elderly, low-income, mobility-impaired), and generates risk scores for each neighborhood.',
    capabilities: [
      'FEMA flood zone data integration',
      'Census demographic cross-reference',
      'Multi-factor vulnerability scoring',
      'Geospatial risk zone mapping',
      'Parallel execution with Agent 3'
    ],
    trigger: 'A2A signal from Storm Watcher',
    output: 'Vulnerability dataset → Alert Commander'
  },
  {
    number: '03',
    name: 'Resource Coordinator',
    subtitle: 'The Logistics Brain',
    pattern: 'ParallelAgent',
    color: '#10B981',
    description: 'Runs simultaneously with Vulnerability Mapper in a ParallelAgent configuration. Inventories available shelters, supply depots, medical facilities, and evacuation routes. Calculates capacity, pre-positions resources, and generates an allocation matrix optimized for the identified vulnerable populations.',
    capabilities: [
      'Real-time shelter capacity tracking',
      'Supply depot inventory management',
      'Evacuation route optimization',
      'Medical surge capacity planning',
      'Parallel execution with Agent 2'
    ],
    trigger: 'A2A signal from Storm Watcher',
    output: 'Resource allocation matrix → Alert Commander'
  },
  {
    number: '04',
    name: 'Alert Commander',
    subtitle: 'The Actor',
    pattern: 'SelfCorrectingLoopAgent',
    color: '#EF4444',
    description: 'The final actor in the pipeline. Receives vulnerability data from Agent 2 and resource data from Agent 3, then generates a prioritized action plan. The self-correction LoopAgent reviews its own plan for logical errors (capacity conflicts, routing issues) and re-runs if inconsistencies are detected -- earning the bonus points.',
    capabilities: [
      'Multi-source data synthesis',
      'Prioritized alert generation',
      'Self-correction loop (bonus feature)',
      'Targeted SMS/push alert dispatch',
      'Mandatory evacuation order issuance'
    ],
    trigger: 'A2A data from Agents 2 & 3',
    output: 'Targeted alerts → All affected zones'
  }
];

const TECH_STACK = [
  { name: 'Google ADK', desc: 'Agent Development Kit for orchestration', color: '#3B82F6' },
  { name: 'A2A Protocol', desc: 'Agent-to-Agent communication standard', color: '#06B6D4' },
  { name: 'LoopAgent', desc: 'Continuous polling & self-correction', color: '#F59E0B' },
  { name: 'ParallelAgent', desc: 'Simultaneous multi-agent execution', desc2: 'Agents 2 & 3 run concurrently', color: '#10B981' },
  { name: 'NOAA NHC API', desc: 'Real-time hurricane track data', color: '#8B5CF6' },
  { name: 'FEMA Flood API', desc: 'Flood zone & vulnerability data', color: '#EC4899' }
];

export default function ArchitectureSection() {
  return (
    <section
      id="architecture"
      className="py-20"
      style={{ background: 'linear-gradient(to bottom, #020B18, #030D1A)' }}
    >
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Section Header */}
        <div className="mb-16">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono mb-4"
            style={{
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              color: '#A78BFA'
            }}
          >
            AGENT ARCHITECTURE
          </div>
          <h2
            className="text-4xl font-black mb-3"
            style={{ color: '#F1F5F9', fontFamily: "'Outfit', sans-serif" }}
          >
            How the Mesh Works
          </h2>
          <p className="text-base" style={{ color: '#64748B', maxWidth: '600px' }}>
            A pipeline of specialist agents communicating via the A2A protocol, with parallel
            execution and self-correction built into the design.
          </p>
        </div>

        {/* Flow Diagram */}
        <div
          className="mb-16 p-6 rounded-2xl"
          style={{
            background: 'rgba(10, 22, 40, 0.6)',
            border: '1px solid rgba(59,130,246,0.15)'
          }}
        >
          <div className="text-xs font-mono font-semibold mb-6" style={{ color: '#475569' }}>
            AGENT COMMUNICATION FLOW
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Agent 1 */}
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2"
                style={{
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  boxShadow: '0 0 20px rgba(245,158,11,0.2)'
                }}
              >
                🌀
              </div>
              <div className="text-xs font-bold" style={{ color: '#F59E0B' }}>Storm Watcher</div>
              <div className="text-xs font-mono" style={{ color: '#475569' }}>LoopAgent</div>
            </div>

            {/* Arrow + A2A label */}
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs font-mono" style={{ color: '#3B82F6' }}>A2A</div>
              <div className="flex items-center gap-1">
                <div className="w-8 md:w-16 h-px" style={{ background: 'rgba(59,130,246,0.4)' }} />
                <div style={{ color: '#3B82F6', fontSize: '10px' }}>▶</div>
              </div>
              <div className="text-xs font-mono" style={{ color: '#475569' }}>broadcast</div>
            </div>

            {/* Agents 2 & 3 in parallel */}
            <div className="flex flex-col gap-3">
              <div
                className="px-3 py-1.5 rounded-lg text-center"
                style={{
                  background: 'rgba(6,182,212,0.1)',
                  border: '1px solid rgba(6,182,212,0.3)'
                }}
              >
                <div className="text-xs font-bold" style={{ color: '#06B6D4' }}>🗺️ Vulnerability Mapper</div>
                <div className="text-xs font-mono" style={{ color: '#475569' }}>ParallelAgent</div>
              </div>
              <div
                className="text-center text-xs font-mono"
                style={{ color: '#334155' }}
              >
                ⟵ PARALLEL ⟶
              </div>
              <div
                className="px-3 py-1.5 rounded-lg text-center"
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.3)'
                }}
              >
                <div className="text-xs font-bold" style={{ color: '#10B981' }}>📦 Resource Coordinator</div>
                <div className="text-xs font-mono" style={{ color: '#475569' }}>ParallelAgent</div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs font-mono" style={{ color: '#3B82F6' }}>A2A</div>
              <div className="flex items-center gap-1">
                <div className="w-8 md:w-16 h-px" style={{ background: 'rgba(59,130,246,0.4)' }} />
                <div style={{ color: '#3B82F6', fontSize: '10px' }}>▶</div>
              </div>
              <div className="text-xs font-mono" style={{ color: '#475569' }}>merged data</div>
            </div>

            {/* Agent 4 */}
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2"
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  boxShadow: '0 0 20px rgba(239,68,68,0.2)'
                }}
              >
                🚨
              </div>
              <div className="text-xs font-bold" style={{ color: '#EF4444' }}>Alert Commander</div>
              <div className="text-xs font-mono" style={{ color: '#475569' }}>SelfCorrectingLoop</div>
            </div>

            {/* Arrow to output */}
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs font-mono" style={{ color: '#EF4444' }}>OUTPUT</div>
              <div className="flex items-center gap-1">
                <div className="w-8 md:w-16 h-px" style={{ background: 'rgba(239,68,68,0.4)' }} />
                <div style={{ color: '#EF4444', fontSize: '10px' }}>▶</div>
              </div>
            </div>

            {/* Output */}
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)'
                }}
              >
                📢
              </div>
              <div className="text-xs font-bold" style={{ color: '#F87171' }}>Targeted Alerts</div>
              <div className="text-xs font-mono" style={{ color: '#475569' }}>All Zones</div>
            </div>
          </div>
        </div>

        {/* Agent Detail Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {AGENTS_DETAIL.map(agent => (
            <div
              key={agent.number}
              className="p-6 rounded-2xl"
              style={{
                background: 'rgba(10, 22, 40, 0.7)',
                border: `1px solid ${agent.color}25`
              }}
            >
              <div className="flex items-start gap-4 mb-4">
                <div
                  className="text-5xl font-black font-mono leading-none"
                  style={{ color: `${agent.color}30` }}
                >
                  {agent.number}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>{agent.name}</h3>
                    <span className="text-sm" style={{ color: '#64748B' }}>-- {agent.subtitle}</span>
                  </div>
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{
                      background: `${agent.color}15`,
                      color: agent.color,
                      border: `1px solid ${agent.color}30`
                    }}
                  >
                    {agent.pattern}
                  </span>
                </div>
              </div>

              <p className="text-sm leading-relaxed mb-4" style={{ color: '#94A3B8' }}>
                {agent.description}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div
                  className="p-3 rounded-lg"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                >
                  <div className="text-xs font-mono mb-1" style={{ color: '#475569' }}>TRIGGER</div>
                  <div className="text-xs" style={{ color: '#CBD5E1' }}>{agent.trigger}</div>
                </div>
                <div
                  className="p-3 rounded-lg"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                >
                  <div className="text-xs font-mono mb-1" style={{ color: '#475569' }}>OUTPUT</div>
                  <div className="text-xs" style={{ color: '#CBD5E1' }}>{agent.output}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-mono mb-2" style={{ color: '#475569' }}>CAPABILITIES</div>
                <div className="flex flex-wrap gap-1.5">
                  {agent.capabilities.map(cap => (
                    <span
                      key={cap}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        background: `${agent.color}10`,
                        color: '#94A3B8',
                        border: `1px solid ${agent.color}20`
                      }}
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tech Stack + Alert Panel Image */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Tech Stack */}
          <div>
            <h3
              className="text-2xl font-black mb-6"
              style={{ color: '#F1F5F9', fontFamily: "'Outfit', sans-serif" }}
            >
              Technology Stack
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {TECH_STACK.map(tech => (
                <div
                  key={tech.name}
                  className="p-4 rounded-xl"
                  style={{
                    background: 'rgba(10, 22, 40, 0.7)',
                    border: `1px solid ${tech.color}20`
                  }}
                >
                  <div
                    className="text-sm font-bold mb-1"
                    style={{ color: tech.color }}
                  >
                    {tech.name}
                  </div>
                  <div className="text-xs" style={{ color: '#64748B' }}>{tech.desc}</div>
                </div>
              ))}
            </div>

            {/* Key Design Decisions */}
            <div
              className="mt-6 p-5 rounded-xl"
              style={{
                background: 'rgba(10, 22, 40, 0.7)',
                border: '1px solid rgba(59,130,246,0.15)'
              }}
            >
              <div className="text-sm font-bold mb-3" style={{ color: '#E2E8F0' }}>
                Key Design Decisions
              </div>
              {[
                { title: 'Parallel Execution', desc: 'Agents 2 & 3 run simultaneously -- halving analysis time from ~4s to ~2s', color: '#10B981' },
                { title: 'Self-Correction Loop', desc: 'Alert Commander reviews its own plan and re-runs if capacity conflicts are detected', color: '#EF4444' },
                { title: 'A2A Protocol', desc: 'Structured message passing between agents with typed payloads and acknowledgment', color: '#3B82F6' },
                { title: 'Graceful Degradation', desc: 'Each agent can operate independently if upstream agents fail', color: '#F59E0B' }
              ].map(d => (
                <div key={d.title} className="flex gap-3 mb-3">
                  <div
                    className="w-1 rounded-full shrink-0 mt-1"
                    style={{ background: d.color, height: '40px' }}
                  />
                  <div>
                    <div className="text-xs font-semibold mb-0.5" style={{ color: '#CBD5E1' }}>{d.title}</div>
                    <div className="text-xs" style={{ color: '#64748B' }}>{d.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alert Panel Image */}
          <div>
            <h3
              className="text-2xl font-black mb-6"
              style={{ color: '#F1F5F9', fontFamily: "'Outfit', sans-serif" }}
            >
              Command Center Vision
            </h3>
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                border: '1px solid rgba(59,130,246,0.2)',
                height: '340px'
              }}
            >
              <img
                src={ALERT_PANEL_IMG}
                alt="StormMesh command center"
                className="w-full h-full object-cover"
              />
            </div>
            <div
              className="mt-4 p-4 rounded-xl"
              style={{
                background: 'rgba(10, 22, 40, 0.7)',
                border: '1px solid rgba(59,130,246,0.15)'
              }}
            >
              <div className="text-sm font-bold mb-2" style={{ color: '#E2E8F0' }}>
                Why This Architecture Wins
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
                StormMesh demonstrates the full spectrum of multi-agent patterns: a LoopAgent for
                continuous monitoring, a ParallelAgent for simultaneous analysis, and a
                SelfCorrectingLoopAgent for robust action planning. The A2A protocol ensures
                every agent communicates with structured, typed messages -- not just function calls.
                This is production-grade disaster response AI.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
