import { useEffect, useState } from 'react';
import { CloudRain, Wind, Thermometer, AlertTriangle, RefreshCw, Droplets, Eye, CloudLightning } from 'lucide-react';
import { cn } from '@/lib/utils';

const LAT = 27.85;
const LNG = -82.65;

interface ForecastPeriod {
  number: number;
  name: string;
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  probabilityOfPrecipitation: { value: number | null };
  icon: string;
}

interface NhcStorm {
  id: string;
  name: string;
  classification: string;
  intensity: string;
  pressure: string;
  latitudeNumeric: number;
  longitudeNumeric: number;
  movementDir: number;
  movementSpeed: number;
  lastUpdate: string;
}

function stormClassLabel(cls: string) {
  const map: Record<string, string> = {
    TD: 'Tropical Depression', TS: 'Tropical Storm', HU: 'Hurricane',
    MH: 'Major Hurricane', EX: 'Post-Tropical', DB: 'Disturbance',
  };
  return map[cls] ?? cls;
}

function distanceToTampa(lat: number, lng: number) {
  const R = 6371;
  const dLat = (LAT - lat) * Math.PI / 180;
  const dLng = (LNG - lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(LAT * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function rainColor(pct: number | null) {
  if (pct === null) return 'text-slate-500';
  if (pct >= 70) return 'text-red-400';
  if (pct >= 40) return 'text-amber-400';
  if (pct >= 20) return 'text-blue-400';
  return 'text-slate-400';
}

function tempColor(f: number) {
  if (f >= 95) return 'text-red-400';
  if (f >= 85) return 'text-orange-400';
  if (f >= 70) return 'text-amber-300';
  return 'text-blue-300';
}

function weatherIcon(forecast: string) {
  const f = forecast.toLowerCase();
  if (f.includes('thunder') || f.includes('lightning')) return <CloudLightning className="w-6 h-6 text-amber-400" />;
  if (f.includes('rain') || f.includes('shower') || f.includes('drizzle')) return <CloudRain className="w-6 h-6 text-blue-400" />;
  if (f.includes('fog') || f.includes('mist') || f.includes('haze')) return <Eye className="w-6 h-6 text-slate-400" />;
  if (f.includes('wind') || f.includes('breezy') || f.includes('gusty')) return <Wind className="w-6 h-6 text-cyan-400" />;
  if (f.includes('cloud') || f.includes('overcast')) return <Droplets className="w-6 h-6 text-slate-400" />;
  return <Thermometer className="w-6 h-6 text-amber-300" />;
}

// Day-only periods for the 7-day view
function dayPeriods(periods: ForecastPeriod[]) {
  return periods.filter(p => p.isDaytime).slice(0, 7);
}

export default function ForecastPage() {
  const [periods, setPeriods] = useState<ForecastPeriod[]>([]);
  const [storms, setStorms] = useState<NhcStorm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [activeDay, setActiveDay] = useState<number | null>(null);

  const fetchForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: get grid point
      const ptRes = await fetch(`https://api.weather.gov/points/${LAT},${LNG}`, {
        headers: { 'User-Agent': 'BayShield/3.0 (emergency-management)' },
      });
      if (!ptRes.ok) throw new Error('Could not reach NOAA weather service');
      const ptData = await ptRes.json();
      const forecastUrl: string = ptData.properties.forecast;

      // Step 2: get forecast
      const fRes = await fetch(forecastUrl, {
        headers: { 'User-Agent': 'BayShield/3.0 (emergency-management)' },
      });
      if (!fRes.ok) throw new Error('Could not load forecast data');
      const fData = await fRes.json();
      setPeriods(fData.properties.periods ?? []);
      setLastFetched(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load forecast');
    } finally {
      setLoading(false);
    }
  };

  const fetchStorms = async () => {
    try {
      const res = await fetch('https://www.nhc.noaa.gov/CurrentStorms.json');
      if (!res.ok) return;
      const data = await res.json();
      setStorms(data.activeStorms ?? []);
    } catch {
      // non-critical — storms section just stays empty
    }
  };

  useEffect(() => {
    fetchForecast();
    fetchStorms();
  }, []);

  const days = dayPeriods(periods);
  const allPeriods = periods.slice(0, 14); // day + night for detail
  const selected = activeDay !== null ? allPeriods.find(p => p.number === activeDay) : null;

  // Find the night period matching selected day
  const selectedNight = selected
    ? allPeriods.find(p => !p.isDaytime && p.number === selected.number + 1)
    : null;

  return (
    <div className="min-h-full p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Weather Forecast</h1>
          <p className="mt-0.5 text-[12px] text-slate-400">
            Tampa Bay Area &middot; Source: NOAA National Weather Service
            {lastFetched && (
              <span className="ml-2 text-slate-500">
                &middot; Updated {lastFetched.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => { fetchForecast(); fetchStorms(); }}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-[11px] text-slate-400 transition-colors hover:bg-white/8 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Active storms banner */}
      {storms.length > 0 && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/8 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-semibold text-red-300">
              {storms.length} Active Atlantic Storm{storms.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {storms.map(storm => {
              const distKm = distanceToTampa(storm.latitudeNumeric, storm.longitudeNumeric);
              const distMi = Math.round(distKm * 0.621);
              const intensityKt = parseInt(storm.intensity);
              const isHurricane = storm.classification === 'HU' || storm.classification === 'MH';
              return (
                <div key={storm.id} className="rounded-xl border border-red-500/20 bg-red-500/6 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{storm.name}</span>
                    <span className={cn('rounded-full px-2 py-0.5 font-mono text-[9px] font-bold', isHurricane ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30')}>
                      {stormClassLabel(storm.classification)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300">
                    <div>Winds: <strong className="text-white">{intensityKt} kt ({Math.round(intensityKt * 1.151)} mph)</strong></div>
                    <div>Pressure: <strong className="text-white">{storm.pressure} mb</strong></div>
                    <div>Moving: <strong className="text-white">{storm.movementSpeed} mph</strong></div>
                    <div>Distance: <strong className="text-white">{distMi} mi from Tampa</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No active storms */}
      {!loading && storms.length === 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/6 px-4 py-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          <span className="text-sm text-emerald-300">No active tropical storms or hurricanes in the Atlantic basin</span>
        </div>
      )}

      {/* 7-day grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-white/6 bg-white/4" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/8 p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={fetchForecast} className="mt-3 rounded-lg bg-red-500/20 px-4 py-1.5 text-xs text-red-300 hover:bg-red-500/30">
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {days.map(period => {
              const rain = period.probabilityOfPrecipitation?.value;
              const isSelected = activeDay === period.number;
              return (
                <button
                  key={period.number}
                  onClick={() => setActiveDay(isSelected ? null : period.number)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl border p-3 text-left transition-all hover:bg-white/6',
                    isSelected ? 'border-blue-400/40 bg-blue-500/10' : 'border-white/8 bg-white/4'
                  )}
                >
                  <span className="text-[11px] font-semibold text-slate-300">{period.name}</span>
                  <div className="my-1">{weatherIcon(period.shortForecast)}</div>
                  <span className={cn('text-xl font-bold', tempColor(period.temperature))}>
                    {period.temperature}&deg;{period.temperatureUnit}
                  </span>
                  <span className="text-center text-[10px] leading-snug text-slate-400">{period.shortForecast}</span>
                  {rain !== null && rain !== undefined && (
                    <div className={cn('flex items-center gap-1 text-[10px] font-mono', rainColor(rain))}>
                      <Droplets className="h-3 w-3" />
                      {rain}%
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Expanded detail panel */}
          {selected && (
            <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">{selected.name} &mdash; Detailed Forecast</h2>
                <button onClick={() => setActiveDay(null)} className="text-[11px] text-slate-500 hover:text-slate-300">Close</button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm leading-relaxed text-slate-300">{selected.detailedForecast}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/8 bg-white/4 p-3">
                      <p className="mb-1 text-[10px] text-slate-500 font-mono uppercase">Wind</p>
                      <p className="text-sm font-semibold text-white">{selected.windSpeed}</p>
                      <p className="text-[11px] text-slate-400">{selected.windDirection}</p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/4 p-3">
                      <p className="mb-1 text-[10px] text-slate-500 font-mono uppercase">Rain Chance</p>
                      <p className={cn('text-sm font-semibold', rainColor(selected.probabilityOfPrecipitation?.value ?? null))}>
                        {selected.probabilityOfPrecipitation?.value ?? 0}%
                      </p>
                    </div>
                  </div>
                </div>
                {selectedNight && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tonight</p>
                    <p className="text-sm leading-relaxed text-slate-300">{selectedNight.detailedForecast}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={cn('text-lg font-bold', tempColor(selectedNight.temperature))}>
                        {selectedNight.temperature}&deg;{selectedNight.temperatureUnit}
                      </span>
                      <span className="text-[11px] text-slate-400">{selectedNight.shortForecast}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Plain-language safety note */}
      <div className="rounded-2xl border border-blue-400/15 bg-blue-400/5 p-4">
        <p className="text-[12px] font-semibold text-blue-300">What to watch for in Tampa Bay</p>
        <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
          <li>&bull; Rain chance above 60% = carry an umbrella, avoid low-lying roads</li>
          <li>&bull; Wind over 40 mph = secure outdoor furniture, avoid driving high-profile vehicles</li>
          <li>&bull; Any active hurricane within 500 miles = monitor BayShield alerts and be ready to evacuate</li>
          <li>&bull; Tornado watch issued = move to an interior room on the lowest floor immediately</li>
        </ul>
      </div>
    </div>
  );
}
