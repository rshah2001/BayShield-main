// ============================================================
// STORMMESH -- HeroSection Component
// Design: Full-bleed hurricane satellite image with glass data panels
// Includes: LiveTicker, ParticleCanvas, animated stats
// ============================================================

import { WeatherData, ThreatLevel } from '@/lib/stormData';
import LiveTicker from './LiveTicker';
import ParticleCanvas from './ParticleCanvas';

const HERO_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663488949635/H8uV2jDz2ia2afExqjD23w/stormmesh-hero-bg_89bbeb97.png';

interface HeroSectionProps {
  weather: WeatherData;
  threatLevel: ThreatLevel;
  isRunning: boolean;
  onStart: () => void;
  onReset: () => void;
  simulationPhase: number;
  totalPopulationAtRisk: number;
}

const THREAT_COLORS = {
  monitoring: '#10B981',
  advisory: '#06B6D4',
  warning: '#F59E0B',
  critical: '#EF4444'
};

const CAT_COLORS = ['', '#10B981', '#06B6D4', '#F59E0B', '#F97316', '#EF4444'];

export default function HeroSection({
  weather,
  threatLevel,
  isRunning,
  onStart,
  onReset,
  simulationPhase,
  totalPopulationAtRisk
}: HeroSectionProps) {
  const threatColor = THREAT_COLORS[threatLevel];
  const catColor = CAT_COLORS[weather.category] || '#EF4444';

  return (
    <section
      id="dashboard"
      className="relative min-h-screen flex flex-col"
      style={{ paddingTop: '56px' }}
    >
      {/* Full-bleed background */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={HERO_BG}
          alt="Hurricane satellite view"
          className="w-full h-full object-cover"
          style={{ opacity: 0.55 }}
        />
        {/* Gradient overlays */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(2,11,24,0.3) 0%, rgba(2,11,24,0.1) 40%, rgba(2,11,24,0.7) 80%, rgba(2,11,24,1) 100%)'
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, rgba(2,11,24,0.6) 0%, transparent 50%, rgba(2,11,24,0.3) 100%)'
          }}
        />
        {/* Particle overlay */}
        <ParticleCanvas />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col justify-between max-w-[1400px] mx-auto w-full px-6 py-12">
        {/* Top: Title + Description */}
        <div className="max-w-2xl">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-6"
            style={{
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              color: '#60A5FA'
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: '#3B82F6',
                boxShadow: '0 0 6px #3B82F6',
                animation: 'agentPulse 2s ease-in-out infinite'
              }}
            />
            MULTI-AGENT DISASTER RESPONSE SYSTEM -- TAMPA BAY
          </div>

          <h1
            className="text-5xl md:text-7xl font-black mb-4 leading-none tracking-tight"
            style={{
              fontFamily: "'Outfit', sans-serif",
              color: '#F1F5F9'
            }}
          >
            Storm
            <span
              style={{
                color: '#3B82F6',
                textShadow: '0 0 40px rgba(59, 130, 246, 0.6)'
              }}
            >
              Mesh
            </span>
          </h1>

          <p
            className="text-lg md:text-xl font-light mb-8 leading-relaxed"
            style={{ color: '#94A3B8', maxWidth: '520px' }}
          >
            Four specialist AI agents that monitor weather threats, map vulnerable communities,
            coordinate resources, and issue targeted evacuation orders --{' '}
            <em style={{ color: '#CBD5E1' }}>autonomously</em>.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4 mb-8">
            {!isRunning ? (
              <button
                onClick={onStart}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
                  color: '#fff',
                  boxShadow: '0 0 24px rgba(59, 130, 246, 0.4)',
                  border: 'none'
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 40px rgba(59, 130, 246, 0.7)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 24px rgba(59, 130, 246, 0.4)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                }}
              >
                <span>▶</span>
                Launch Simulation
              </button>
            ) : (
              <button
                onClick={onReset}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#EF4444',
                  border: '1px solid rgba(239, 68, 68, 0.4)'
                }}
              >
                <span>↺</span>
                Reset Simulation
              </button>
            )}
            <a
              href="#architecture"
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#CBD5E1',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              View Architecture →
            </a>
          </div>

          {/* Agent status pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { name: 'Storm Watcher', color: '#F59E0B', icon: '🌀' },
              { name: 'Vulnerability Mapper', color: '#06B6D4', icon: '🗺️' },
              { name: 'Resource Coordinator', color: '#10B981', icon: '📦' },
              { name: 'Alert Commander', color: '#EF4444', icon: '🚨' }
            ].map(agent => (
              <div
                key={agent.name}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono"
                style={{
                  background: `${agent.color}12`,
                  border: `1px solid ${agent.color}25`,
                  color: agent.color
                }}
              >
                <span>{agent.icon}</span>
                <span>{agent.name}</span>
                <div
                  className="w-1 h-1 rounded-full"
                  style={{
                    background: isRunning ? agent.color : '#334155',
                    animation: isRunning ? 'agentPulse 1.5s ease-in-out infinite' : 'none'
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Weather + Stats panels */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-16">
          {/* Storm Status */}
          <div
            className="col-span-2 md:col-span-1 p-4 rounded-xl"
            style={{
              background: 'rgba(2, 11, 24, 0.8)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${catColor}40`
            }}
          >
            <div className="text-xs font-mono mb-1" style={{ color: '#64748B' }}>ACTIVE STORM</div>
            <div className="text-lg font-bold mb-1" style={{ color: '#F1F5F9' }}>{weather.stormName}</div>
            <div
              className="text-3xl font-black font-mono"
              style={{ color: catColor, textShadow: `0 0 20px ${catColor}80` }}
            >
              CAT {weather.category}
            </div>
            <div className="text-xs font-mono mt-1" style={{ color: '#64748B' }}>
              {weather.windSpeed} kt sustained winds
            </div>
          </div>

          {/* Threat Level */}
          <div
            className="p-4 rounded-xl"
            style={{
              background: 'rgba(2, 11, 24, 0.8)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${threatColor}40`
            }}
          >
            <div className="text-xs font-mono mb-1" style={{ color: '#64748B' }}>THREAT LEVEL</div>
            <div
              className="text-2xl font-black font-mono uppercase"
              style={{ color: threatColor, textShadow: `0 0 20px ${threatColor}80` }}
            >
              {threatLevel}
            </div>
            <div className="text-xs font-mono mt-1" style={{ color: '#64748B' }}>
              Landfall: {weather.landfall}
            </div>
          </div>

          {/* Population at Risk */}
          <div
            className="p-4 rounded-xl"
            style={{
              background: 'rgba(2, 11, 24, 0.8)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}
          >
            <div className="text-xs font-mono mb-1" style={{ color: '#64748B' }}>POPULATION AT RISK</div>
            <div
              className="text-2xl font-black font-mono"
              style={{ color: '#F59E0B', textShadow: '0 0 20px rgba(245,158,11,0.5)' }}
            >
              {totalPopulationAtRisk > 0 ? totalPopulationAtRisk.toLocaleString() : '---'}
            </div>
            <div className="text-xs font-mono mt-1" style={{ color: '#64748B' }}>
              Surge zone residents
            </div>
          </div>

          {/* Simulation Phase */}
          <div
            className="p-4 rounded-xl"
            style={{
              background: 'rgba(2, 11, 24, 0.8)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}
          >
            <div className="text-xs font-mono mb-1" style={{ color: '#64748B' }}>AGENT PHASE</div>
            <div
              className="text-2xl font-black font-mono"
              style={{ color: '#3B82F6', textShadow: '0 0 20px rgba(59,130,246,0.5)' }}
            >
              {simulationPhase}/9
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(59,130,246,0.15)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(simulationPhase / 9) * 100}%`,
                  background: 'linear-gradient(90deg, #3B82F6, #06B6D4)',
                  boxShadow: '0 0 8px rgba(59,130,246,0.6)'
                }}
              />
            </div>
            <div className="text-xs font-mono mt-1" style={{ color: '#64748B' }}>
              {isRunning ? 'Active' : simulationPhase === 0 ? 'Ready' : 'Complete'}
            </div>
          </div>
        </div>
      </div>

      {/* Live Ticker */}
      <div className="relative z-10">
        <LiveTicker />
      </div>
    </section>
  );
}
