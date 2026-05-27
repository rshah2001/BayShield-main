// ============================================================
// STORMMESH -- StormIntensityChart Component
// Design: Recharts area chart showing storm intensity over time
// ============================================================

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const STORM_DATA = [
  { time: '-48h', windSpeed: 65, pressure: 990, category: 1 },
  { time: '-36h', windSpeed: 85, pressure: 975, category: 2 },
  { time: '-24h', windSpeed: 110, pressure: 962, category: 3 },
  { time: '-18h', windSpeed: 125, pressure: 955, category: 4 },
  { time: '-12h', windSpeed: 135, pressure: 948, category: 4 },
  { time: '-6h', windSpeed: 145, pressure: 942, category: 4 },
  { time: 'NOW', windSpeed: 145, pressure: 942, category: 4 },
  { time: '+6h', windSpeed: 150, pressure: 938, category: 4 },
  { time: '+12h', windSpeed: 158, pressure: 935, category: 5 },
  { time: '+18h', windSpeed: 160, pressure: 932, category: 5 },
  { time: '+24h', windSpeed: 145, pressure: 940, category: 4 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="p-3 rounded-lg"
        style={{
          background: 'rgba(2, 11, 24, 0.95)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          fontFamily: "'JetBrains Mono', monospace"
        }}
      >
        <div className="text-xs mb-1" style={{ color: '#60A5FA' }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} className="text-xs" style={{ color: p.color }}>
            {p.name}: {p.value}{p.name === 'windSpeed' ? ' kt' : ' mb'}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function StormIntensityChart() {
  return (
    <div
      className="p-5 rounded-xl"
      style={{
        background: 'rgba(10, 22, 40, 0.7)',
        border: '1px solid rgba(59, 130, 246, 0.15)'
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-mono font-semibold" style={{ color: '#94A3B8' }}>
            STORM INTENSITY TRACK
          </div>
          <div className="text-xs font-mono mt-0.5" style={{ color: '#475569' }}>
            Hurricane Helena -- Wind Speed (kt)
          </div>
        </div>
        <div
          className="text-xs font-mono px-2 py-1 rounded"
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#EF4444',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}
        >
          CAT 4 → 5 TREND
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={STORM_DATA} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="windGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="pressureGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.08)" />
          <XAxis
            dataKey="time"
            tick={{ fill: '#475569', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            axisLine={{ stroke: 'rgba(59,130,246,0.15)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#475569', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="windSpeed"
            stroke="#EF4444"
            strokeWidth={2}
            fill="url(#windGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#EF4444', stroke: 'rgba(239,68,68,0.4)', strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
