import { cn } from '@/lib/utils';
import { useTideData } from '@/hooks/useTideData';
import { Waves, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

const FLOOD_THRESHOLDS = { minor: 1.5, moderate: 3.0, major: 4.5 };

function levelColor(ft: number | null) {
  if (ft === null) return 'text-slate-500';
  if (ft >= FLOOD_THRESHOLDS.major) return 'text-red-400';
  if (ft >= FLOOD_THRESHOLDS.moderate) return 'text-amber-400';
  if (ft >= FLOOD_THRESHOLDS.minor) return 'text-yellow-400';
  return 'text-emerald-400';
}

function TrendIcon({ trend }: { trend: 'rising' | 'falling' | 'stable' }) {
  if (trend === 'rising')  return <TrendingUp  className="h-3 w-3 text-amber-400" />;
  if (trend === 'falling') return <TrendingDown className="h-3 w-3 text-emerald-400" />;
  return <Minus className="h-3 w-3 text-slate-400" />;
}

function floodLabel(ft: number | null): { label: string; cls: string } {
  if (ft === null) return { label: 'No data', cls: 'text-slate-500' };
  if (ft >= FLOOD_THRESHOLDS.major)    return { label: 'Major flood risk', cls: 'text-red-400' };
  if (ft >= FLOOD_THRESHOLDS.moderate) return { label: 'Moderate risk', cls: 'text-amber-400' };
  if (ft >= FLOOD_THRESHOLDS.minor)    return { label: 'Minor risk', cls: 'text-yellow-400' };
  return { label: 'Normal', cls: 'text-emerald-400' };
}

export default function TideGauges() {
  const { readings, loading } = useTideData();

  return (
    <div className="bg-card border border-border/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-medium">
            <Waves className="h-4 w-4 text-cyan-400" />
            Tide & Water Level — Tampa Bay
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            NOAA CO-OPS real-time gauges · Storm surge watch: minor ≥1.5 ft, moderate ≥3 ft, major ≥4.5 ft
          </p>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border text-cyan-400 bg-cyan-400/10 border-cyan-400/20">
          NOAA Live
        </span>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-white/6 bg-white/4" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {readings.map(r => {
            const { label, cls } = floodLabel(r.currentLevel);
            const chartData = r.history.map((h, i) => ({ i, v: h.v }));
            const domainMin = r.history.length ? Math.min(...r.history.map(h => h.v)) - 0.2 : 0;
            const domainMax = r.history.length ? Math.max(...r.history.map(h => h.v)) + 0.2 : 2;

            return (
              <div key={r.stationId} className="rounded-xl border border-white/8 bg-white/4 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-slate-300">{r.stationName}</span>
                  <div className="flex items-center gap-1">
                    <TrendIcon trend={r.trend} />
                    <span className="text-[10px] text-slate-500 capitalize">{r.trend}</span>
                  </div>
                </div>

                {r.error ? (
                  <p className="text-[11px] text-slate-500 mt-2">Data unavailable</p>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className={cn('text-xl font-bold tabular-nums', levelColor(r.currentLevel))}>
                        {r.currentLevel?.toFixed(2) ?? '--'}
                      </span>
                      <span className="text-[10px] text-slate-500">ft MLLW</span>
                    </div>
                    <span className={cn('text-[10px] font-medium', cls)}>{label}</span>

                    {chartData.length >= 2 && (
                      <div className="mt-2 h-10">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id={`tideGrad${r.stationId}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <YAxis domain={[domainMin, domainMax]} hide />
                            <Tooltip
                              contentStyle={{ background: 'oklch(0.13 0.014 250)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', fontSize: '10px' }}
                              formatter={(v: number) => [`${v.toFixed(2)} ft`, '']}
                              labelFormatter={() => ''}
                            />
                            <Area type="monotone" dataKey="v" stroke="#22d3ee" strokeWidth={1.5} fill={`url(#tideGrad${r.stationId})`} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {r.lastUpdated && (
                      <p className="mt-1 text-[9px] text-slate-600 truncate">{r.lastUpdated}</p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
