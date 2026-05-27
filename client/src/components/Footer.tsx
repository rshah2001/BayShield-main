// ============================================================
// STORMMESH -- Footer Component
// Design: Minimal dark footer with system status indicators
// ============================================================

export default function Footer() {
  return (
    <footer
      id="about"
      className="py-12"
      style={{
        background: 'rgba(2, 11, 24, 0.95)',
        borderTop: '1px solid rgba(59, 130, 246, 0.1)'
      }}
    >
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(6,182,212,0.2))',
                  border: '1px solid rgba(59,130,246,0.4)'
                }}
              >
                ⚡
              </div>
              <span
                className="text-lg font-bold"
                style={{ color: '#E2E8F0', fontFamily: "'Outfit', sans-serif" }}
              >
                Storm<span style={{ color: '#3B82F6' }}>Mesh</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>
              A multi-agent AI system for autonomous disaster response coordination.
              Built with Google ADK, A2A Protocol, and real-time weather intelligence.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#10B981', boxShadow: '0 0 4px #10B981' }}
              />
              <span className="text-xs font-mono" style={{ color: '#10B981' }}>
                System Operational
              </span>
            </div>
          </div>

          {/* System Status */}
          <div>
            <div className="text-xs font-mono font-semibold mb-3" style={{ color: '#475569' }}>
              SYSTEM STATUS
            </div>
            {[
              { name: 'NOAA NHC API', status: 'Connected', color: '#10B981' },
              { name: 'OpenWeatherMap', status: 'Connected', color: '#10B981' },
              { name: 'FEMA Flood API', status: 'Connected', color: '#10B981' },
              { name: 'Agent Mesh Network', status: 'Online (4/4)', color: '#10B981' },
              { name: 'Tampa Bay EOC Link', status: 'Active', color: '#10B981' }
            ].map(item => (
              <div key={item.name} className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono" style={{ color: '#64748B' }}>{item.name}</span>
                <span className="text-xs font-mono" style={{ color: item.color }}>{item.status}</span>
              </div>
            ))}
          </div>

          {/* Coverage */}
          <div>
            <div className="text-xs font-mono font-semibold mb-3" style={{ color: '#475569' }}>
              COVERAGE AREA
            </div>
            <div className="text-xs font-mono mb-2" style={{ color: '#64748B' }}>
              Tampa Bay Metropolitan Area
            </div>
            {[
              'Hillsborough County',
              'Pinellas County',
              'Pasco County',
              'Manatee County',
              'Sarasota County'
            ].map(county => (
              <div key={county} className="flex items-center gap-2 mb-1">
                <div className="w-1 h-1 rounded-full" style={{ background: '#3B82F6' }} />
                <span className="text-xs font-mono" style={{ color: '#475569' }}>{county}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ borderTop: '1px solid rgba(59,130,246,0.08)' }}
        >
          <div className="text-xs font-mono" style={{ color: '#334155' }}>
            StormMesh v2.4.1 -- Multi-Agent Disaster Response Coordinator for Tampa Bay
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono" style={{ color: '#334155' }}>
              Built with Google ADK · A2A Protocol · NOAA APIs
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
