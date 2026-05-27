// ============================================================
// BAYSHIELD -- Landing Page
// Apple-level premium design, BayShield branding
// ============================================================
import { Link } from 'wouter';
import { Zap, Eye, MapPin, Cpu, Radio, Shield, GitBranch, ArrowRight, ChevronRight } from 'lucide-react';
import ParticleCanvas from '@/components/ParticleCanvas';
import LiveTicker from '@/components/LiveTicker';

const HERO_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663488949635/H8uV2jDz2ia2afExqjD23w/stormmesh-hero-bg_89bbeb97.png';
const AGENT_NETWORK_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663488949635/H8uV2jDz2ia2afExqjD23w/stormmesh-agent-network_dffd50bb.png';

const AGENTS = [
  { name: 'Storm Watcher',        subtitle: 'The Observer',        icon: '🌀', color: '#fbbf24', pattern: 'LoopAgent',               desc: 'Continuously polls NOAA NHC and OpenWeatherMap APIs. Uses a LoopAgent to re-evaluate threat severity on every cycle and escalate when thresholds are crossed.' },
  { name: 'Vulnerability Mapper', subtitle: 'The Analyst',         icon: '🗺️', color: '#38bdf8', pattern: 'ParallelAgent',           desc: 'Pulls FEMA flood zone data, cross-references with census vulnerability metrics -- elderly, low-income, mobility-impaired. Runs in parallel with Agent 3.' },
  { name: 'Resource Coordinator', subtitle: 'The Logistics Brain', icon: '📦', color: '#34d399', pattern: 'ParallelAgent',           desc: 'Inventories available shelters, supply depots, and evacuation routes. Runs simultaneously with Vulnerability Mapper, halving total analysis time.' },
  { name: 'Alert Commander',      subtitle: 'The Actor',           icon: '🚨', color: '#f87171', pattern: 'SelfCorrectingLoopAgent', desc: 'Synthesizes all outputs, generates prioritized action plans. A self-correction loop reviews every plan for logical errors and re-runs if conflicts are found.' },
];

const FEATURES = [
  { icon: Eye,       title: 'Real-Time Monitoring',  desc: 'Continuous weather API polling with automatic threat escalation from MONITORING to CRITICAL.',  color: '#fbbf24' },
  { icon: GitBranch, title: 'A2A Protocol',           desc: 'Structured agent-to-agent communication with typed messages, event types, and payload inspection.', color: '#60a5fa' },
  { icon: Cpu,       title: 'Parallel Execution',    desc: 'Agents 2 & 3 run simultaneously via ParallelAgent, halving the total analysis time.',            color: '#34d399' },
  { icon: Radio,     title: 'Self-Correction',       desc: 'Alert Commander reviews its own action plans and re-runs the loop when logical conflicts are detected.', color: '#f87171' },
  { icon: MapPin,    title: 'Vulnerability Mapping', desc: 'FEMA flood zones cross-referenced with population demographics to prioritize the most at-risk.', color: '#38bdf8' },
  { icon: Shield,    title: 'Action Plans',          desc: 'Automated evacuation orders with resource allocation matrices and zone-level priority scoring.',  color: '#a78bfa' },
];

export default function Landing() {
  return (
    <div className="min-h-screen" style={{ background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex flex-col">
        <div className="absolute inset-0 overflow-hidden">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover" style={{ opacity: 0.45 }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(8,15,26,0.25), rgba(8,15,26,0.05) 35%, rgba(8,15,26,0.75) 75%, #080f1a)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(8,15,26,0.82), rgba(8,15,26,0.42) 42%, rgba(8,15,26,0.16) 66%, rgba(8,15,26,0.72))' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 70% 45%, rgba(56,189,248,0.12), transparent 26%)' }} />
          <ParticleCanvas />
        </div>

        {/* Nav */}
        <nav className="relative z-20 mx-auto mt-4 flex w-[calc(100%-1.5rem)] max-w-[1360px] items-center justify-between gap-3 rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03)),rgba(10,18,34,0.44)] px-4 py-3 shadow-[0_20px_60px_rgba(2,6,23,0.28),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.25), rgba(56,189,248,0.15))', border: '1px solid rgba(96,165,250,0.35)' }}>
              <Shield className="w-4 h-4" style={{ color: '#60a5fa' }} />
            </div>
            <span className="truncate text-base font-semibold tracking-tight sm:text-lg" style={{ color: '#f1f5f9' }}>
              Bay<span style={{ color: '#60a5fa' }}>Shield</span>
            </span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>v3.0</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="#architecture" className="hidden rounded-full border border-transparent px-3 py-1.5 text-sm text-slate-300/90 transition-all hover:border-white/10 hover:bg-white/6 hover:text-white md:block">Architecture</a>
            <a href="#features" className="hidden rounded-full border border-transparent px-3 py-1.5 text-sm text-slate-300/90 transition-all hover:border-white/10 hover:bg-white/6 hover:text-white md:block">Features</a>
            <Link href="/dashboard">
              <span className="flex cursor-pointer items-center gap-1.5 rounded-full border border-cyan-300/22 bg-[linear-gradient(180deg,rgba(96,165,250,0.24),rgba(56,189,248,0.12))] px-3 py-2 text-sm font-medium text-sky-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_10px_24px_rgba(14,165,233,0.16)] transition-all hover:border-cyan-200/30 hover:bg-[linear-gradient(180deg,rgba(96,165,250,0.28),rgba(56,189,248,0.16))] sm:px-4">
                <span className="hidden sm:inline">Dashboard</span>
                <span className="sm:hidden">Open</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-center px-4 pb-20 sm:px-6 sm:pb-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-6" style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              MULTI-AGENT DISASTER RESPONSE · TAMPA BAY
            </div>
            <h1 className="mb-5 text-4xl font-semibold leading-none tracking-tight sm:text-5xl md:text-7xl" style={{ color: '#f1f5f9' }}>
              Bay<span style={{ color: '#60a5fa' }}>Shield</span>
            </h1>
            <p className="mb-8 text-base font-light leading-relaxed sm:text-lg md:text-xl" style={{ color: '#94a3b8', maxWidth: '520px' }}>
              Four specialist AI agents that monitor weather threats, map vulnerable communities, coordinate resources, and issue targeted evacuation orders --{' '}
              <em style={{ color: '#cbd5e1', fontStyle: 'normal', fontWeight: 500 }}>autonomously</em>.
            </p>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link href="/dashboard">
                <span className="flex cursor-pointer items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium" style={{ background: '#2563eb', color: '#fff' }}>
                  Launch Dashboard <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
              <a href="#architecture" className="flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium" style={{ background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)' }}>
                View Architecture
              </a>
            </div>
          </div>

          {/* Agent pills */}
          <div className="mt-8 flex flex-wrap gap-2 sm:mt-10">
            {AGENTS.map(a => (
              <div key={a.name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono" style={{ background: `${a.color}10`, border: `1px solid ${a.color}20`, color: a.color }}>
                <span>{a.icon}</span> {a.name}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10"><LiveTicker /></div>
      </section>

      {/* ===== ARCHITECTURE ===== */}
      <section id="architecture" className="py-24" style={{ background: 'rgba(8,15,26,0.62)' }}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono mb-4" style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa' }}>AGENT ARCHITECTURE</div>
            <h2 className="text-3xl font-semibold mb-3" style={{ color: '#f1f5f9' }}>How the Mesh Works</h2>
            <p className="text-base" style={{ color: '#64748b', maxWidth: '560px' }}>A pipeline of specialist agents communicating via the A2A protocol, with parallel execution and self-correction built in.</p>
          </div>

          {/* Flow Diagram */}
          <div className="mb-12 rounded-2xl p-4 sm:p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[11px] font-mono text-slate-500 mb-6 uppercase tracking-wider">Agent Communication Flow</p>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Storm Watcher */}
              <div className="text-center">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl mx-auto mb-2" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}>🌀</div>
                <p className="text-xs font-semibold" style={{ color: '#fbbf24' }}>Storm Watcher</p>
                <p className="text-[10px] font-mono text-slate-500">LoopAgent</p>
              </div>
              {/* Arrow */}
              <div className="flex flex-col items-center gap-1">
                <p className="text-[10px] font-mono text-blue-400">A2A</p>
                <div className="flex items-center gap-1">
                  <div className="w-8 md:w-12 h-px bg-blue-400/30" />
                  <ChevronRight className="w-3 h-3 text-blue-400" />
                </div>
                <p className="text-[10px] font-mono text-slate-500">broadcast</p>
              </div>
              {/* Parallel agents */}
              <div className="flex flex-col gap-2">
                <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)' }}>
                  <p className="text-xs font-semibold" style={{ color: '#38bdf8' }}>🗺️ Vulnerability Mapper</p>
                  <p className="text-[10px] font-mono text-slate-500">ParallelAgent</p>
                </div>
                <p className="text-center text-[10px] font-mono text-emerald-400">⟵ PARALLEL ⟶</p>
                <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <p className="text-xs font-semibold" style={{ color: '#34d399' }}>📦 Resource Coordinator</p>
                  <p className="text-[10px] font-mono text-slate-500">ParallelAgent</p>
                </div>
              </div>
              {/* Arrow */}
              <div className="flex flex-col items-center gap-1">
                <p className="text-[10px] font-mono text-blue-400">A2A</p>
                <div className="flex items-center gap-1">
                  <div className="w-8 md:w-12 h-px bg-blue-400/30" />
                  <ChevronRight className="w-3 h-3 text-blue-400" />
                </div>
                <p className="text-[10px] font-mono text-slate-500">merged data</p>
              </div>
              {/* Alert Commander */}
              <div className="text-center">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl mx-auto mb-2" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)' }}>🚨</div>
                <p className="text-xs font-semibold" style={{ color: '#f87171' }}>Alert Commander</p>
                <p className="text-[10px] font-mono text-slate-500">SelfCorrectingLoop</p>
              </div>
              {/* Arrow */}
              <div className="flex flex-col items-center gap-1">
                <p className="text-[10px] font-mono text-red-400">OUTPUT</p>
                <div className="flex items-center gap-1">
                  <div className="w-8 md:w-12 h-px bg-red-400/30" />
                  <ChevronRight className="w-3 h-3 text-red-400" />
                </div>
              </div>
              {/* Output */}
              <div className="text-center">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl mx-auto mb-2" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>📢</div>
                <p className="text-xs font-semibold" style={{ color: '#fca5a5' }}>Targeted Alerts</p>
                <p className="text-[10px] font-mono text-slate-500">All Zones</p>
              </div>
            </div>
          </div>

          {/* Agent Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
            {AGENTS.map((agent, i) => (
              <div key={agent.name} className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${agent.color}18` }}>
                <div className="flex items-start gap-4 mb-3">
                  <div className="text-4xl font-semibold font-mono leading-none" style={{ color: `${agent.color}20` }}>0{i + 1}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>{agent.name}</h3>
                      <span className="text-xs" style={{ color: '#64748b' }}>-- {agent.subtitle}</span>
                    </div>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${agent.color}12`, color: agent.color, border: `1px solid ${agent.color}25` }}>{agent.pattern}</span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{agent.desc}</p>
              </div>
            ))}
          </div>

          {/* Agent Network Image */}
          <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.07)', height: 'min(320px, 52vw)' }}>
            <img src={AGENT_NETWORK_IMG} alt="Agent network visualization" className="w-full h-full object-cover opacity-80" />
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="py-24" style={{ background: 'rgba(6,13,24,0.64)' }}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono mb-4" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>CAPABILITIES</div>
            <h2 className="text-3xl font-semibold mb-3" style={{ color: '#f1f5f9' }}>Built for Real Emergencies</h2>
            <p className="text-base" style={{ color: '#64748b', maxWidth: '560px' }}>Every feature designed for production-grade disaster response coordination.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${f.color}12` }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4" style={{ background: `${f.color}12`, border: `1px solid ${f.color}25` }}>
                    <Icon className="w-4 h-4" style={{ color: f.color }} />
                  </div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: '#e2e8f0' }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-24" style={{ background: 'rgba(8,15,26,0.62)' }}>
        <div className="mx-auto max-w-[1400px] px-4 text-center sm:px-6">
          <h2 className="text-3xl font-semibold mb-4" style={{ color: '#f1f5f9' }}>Ready to Coordinate?</h2>
          <p className="text-base mb-8 mx-auto" style={{ color: '#64748b', maxWidth: '480px' }}>Enter the command center and run the full Hurricane Helena simulation across all 9 phases.</p>
          <Link href="/dashboard">
            <span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-sm cursor-pointer" style={{ background: '#2563eb', color: '#fff' }}>
              Enter Command Center <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-6" style={{ background: 'rgba(8,15,26,0.78)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 px-4 md:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium" style={{ color: '#475569' }}>BayShield v3.0</span>
          </div>
          <p className="text-xs font-mono" style={{ color: '#334155' }}>Built with Google ADK · A2A Protocol · LoopAgent · ParallelAgent · SelfCorrectingLoopAgent</p>
        </div>
      </footer>
    </div>
  );
}
