// ============================================================
// STORMMESH -- NavBar Component
// Design: Bioluminescent Storm -- glass panel nav with threat level indicator
// ============================================================

import { ThreatLevel } from '@/lib/stormData';

interface NavBarProps {
  threatLevel: ThreatLevel;
  isRunning: boolean;
}

const THREAT_CONFIG = {
  monitoring: { label: 'MONITORING', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' },
  advisory: { label: 'ADVISORY', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)' },
  warning: { label: 'WARNING', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' },
  critical: { label: 'CRITICAL', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' }
};

export default function NavBar({ threatLevel, isRunning }: NavBarProps) {
  const threat = THREAT_CONFIG[threatLevel];

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(2, 11, 24, 0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(59, 130, 246, 0.12)'
      }}
    >
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(6, 182, 212, 0.2))',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              boxShadow: '0 0 16px rgba(59, 130, 246, 0.3)'
            }}
          >
            ⚡
          </div>
          <div>
            <span
              className="text-lg font-bold tracking-tight"
              style={{ color: '#E2E8F0', fontFamily: "'Outfit', sans-serif" }}
            >
              Storm<span style={{ color: '#3B82F6' }}>Mesh</span>
            </span>
          </div>
          <div
            className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono"
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              color: '#60A5FA'
            }}
          >
            <span>v2.4.1</span>
          </div>
        </div>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-6">
          {['Dashboard', 'Architecture', 'Alerts', 'About'].map(link => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              className="text-sm font-medium transition-colors duration-200"
              style={{ color: '#94A3B8' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#E2E8F0')}
              onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
            >
              {link}
            </a>
          ))}
        </div>

        {/* Threat Level + Status */}
        <div className="flex items-center gap-3">
          {isRunning && (
            <div className="hidden sm:flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: '#10B981',
                  boxShadow: '0 0 6px #10B981',
                  animation: 'agentPulse 1.5s ease-in-out infinite'
                }}
              />
              <span className="text-xs font-mono" style={{ color: '#10B981' }}>LIVE</span>
            </div>
          )}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold"
            style={{
              background: threat.bg,
              border: `1px solid ${threat.border}`,
              color: threat.color
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: threat.color,
                animation: threatLevel !== 'monitoring' ? 'agentPulse 1s ease-in-out infinite' : 'none'
              }}
            />
            {threat.label}
          </div>
        </div>
      </div>
    </nav>
  );
}
