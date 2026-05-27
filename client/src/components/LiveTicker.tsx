// ============================================================
// BAYSHIELD -- LiveTicker Component
// Always live: no threat → calm state, active threat → NWS alert text
// ============================================================

import { useMemo } from 'react';
import { useSimulation } from '@/contexts/SimulationContext';

const NO_THREAT_ITEMS = [
  '✅ NO ACTIVE THREATS — TAMPA BAY REGION CLEAR',
  '🌤️ BAYSHIELD MONITORING: ALL 4 AGENTS ON STANDBY',
  '📡 NOAA NHC: NO ACTIVE ATLANTIC STORMS',
  '🏖️ TAMPA BAY CONDITIONS: NORMAL — NO WATCHES OR WARNINGS IN EFFECT',
  '🔄 NEXT NOAA SYNC IN PROGRESS — DATA REFRESHES EVERY 2 MINUTES',
  '📍 MONITORING 8 VULNERABILITY ZONES — ALL CLEAR',
];

export default function LiveTicker() {
  const { alerts, threatLevel, weather, liveWeather } = useSimulation();
  const obs = liveWeather?.observation;

  const hasActiveThreat = threatLevel !== 'monitoring' || alerts.length > 0;

  const items = useMemo(() => {
    if (!hasActiveThreat) return NO_THREAT_ITEMS;

    const built: string[] = [];
    if (weather.stormName && weather.stormName !== 'No Active Storm') {
      built.push(`🌀 ${weather.stormName.toUpperCase()}${weather.category > 0 ? ` — CATEGORY ${weather.category}` : ''} — ${weather.windSpeed} KT WINDS`);
    }
    if (obs) {
      built.push(`🌡️ TAMPA BAY: ${obs.conditions?.toUpperCase() ?? 'CLOUDY'} — ${obs.tempF ?? '--'}°F — ${obs.windSpeedMph ?? '--'} MPH ${obs.windDirectionText?.toUpperCase() ?? ''}`);
    }
    alerts.slice(0, 4).forEach(a => {
      built.push(`⚠️ ${a.zone.toUpperCase()}: ${a.message.toUpperCase().slice(0, 80)}`);
    });
    built.push('⚡ BAYSHIELD AGENTS ACTIVE: 4/4 ONLINE — CONTINUOUS MONITORING');
    built.push('📡 NOAA NWS LIVE FEED — DATA REFRESHES EVERY 2 MINUTES');
    return built.length > 2 ? built : NO_THREAT_ITEMS;
  }, [hasActiveThreat, weather, obs, alerts]);

  const scheme = hasActiveThreat
    ? { bar: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', badge: 'rgba(251,191,36,0.9)', text: '#FDE68A' }
    : { bar: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.15)', badge: 'rgba(16,185,129,0.85)', text: '#6EE7B7' };

  const speed = items.length <= 6 ? 45 : 60;

  return (
    <div
      className="relative overflow-hidden flex-shrink-0"
      style={{
        background: scheme.bar,
        borderTop: `1px solid ${scheme.border}`,
        borderBottom: `1px solid ${scheme.border}`,
        height: '34px',
      }}
    >
      {/* Badge */}
      <div
        className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 gap-2"
        style={{ background: scheme.badge, minWidth: '72px' }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full bg-white"
          style={{ animation: 'tickerPulse 1s ease-in-out infinite' }}
        />
        <span className="text-[11px] font-mono font-bold text-white tracking-wider">LIVE</span>
      </div>

      {/* Scrolling track */}
      <div className="flex items-center h-full" style={{ paddingLeft: '80px' }}>
        <div
          style={{
            display: 'flex',
            gap: '80px',
            animation: `tickerScroll ${speed}s linear infinite`,
            whiteSpace: 'nowrap',
          }}
        >
          {[...items, ...items].map((item, i) => (
            <span key={i} className="text-[11px] font-mono tracking-wide" style={{ color: scheme.text }}>
              {item}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes tickerPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
