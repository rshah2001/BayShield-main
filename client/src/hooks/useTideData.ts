import { useState, useEffect, useCallback } from 'react';

const STATIONS = [
  { id: '8726520', name: 'St. Petersburg' },
  { id: '8726607', name: 'Port Tampa' },
  { id: '8726724', name: 'Clearwater' },
];

export interface TideReading {
  stationId: string;
  stationName: string;
  currentLevel: number | null;
  trend: 'rising' | 'falling' | 'stable';
  history: { t: string; v: number }[];
  lastUpdated: string | null;
  error: boolean;
}

function buildUrl(stationId: string) {
  return `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&datum=MLLW&station=${stationId}&time_zone=lst_ldt&units=english&interval=h&format=json&range=12&application=BayShield`;
}

export function useTideData(refreshMs = 5 * 60 * 1000) {
  const [readings, setReadings] = useState<TideReading[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const results = await Promise.all(
      STATIONS.map(async ({ id, name }) => {
        try {
          const res = await fetch(buildUrl(id));
          if (!res.ok) throw new Error('fetch failed');
          const json = await res.json();
          if (json.error) throw new Error(json.error.message ?? 'API error');

          const raw: { t: string; v: string }[] = json.data ?? [];
          const parsed = raw
            .map(d => ({ t: d.t, v: parseFloat(d.v) }))
            .filter(d => !isNaN(d.v));

          const current = parsed[parsed.length - 1]?.v ?? null;
          const prev = parsed[parsed.length - 2]?.v ?? null;
          const trend: TideReading['trend'] =
            prev === null || current === null ? 'stable'
            : current - prev > 0.05 ? 'rising'
            : current - prev < -0.05 ? 'falling'
            : 'stable';

          return {
            stationId: id, stationName: name,
            currentLevel: current,
            trend,
            history: parsed.slice(-8),
            lastUpdated: parsed[parsed.length - 1]?.t ?? null,
            error: false,
          } satisfies TideReading;
        } catch {
          return {
            stationId: id, stationName: name,
            currentLevel: null, trend: 'stable' as const,
            history: [], lastUpdated: null, error: true,
          } satisfies TideReading;
        }
      })
    );
    setReadings(results);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, refreshMs);
    return () => clearInterval(id);
  }, [fetchAll, refreshMs]);

  return { readings, loading };
}
