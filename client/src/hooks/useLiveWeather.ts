// ============================================================
// BAYSHIELD -- useLiveWeather hook
// Fetches REAL live data from NWS/NOAA public APIs (no key needed)
//
// APIs used:
//   1. https://api.weather.gov/stations/KTPA/observations/latest
//      → Current Tampa International Airport conditions
//   2. https://api.weather.gov/alerts/active?area=FL&status=actual
//      → Active NWS weather alerts for Florida
//   3. https://www.nhc.noaa.gov/nhc_at1.xml  (Atlantic basin 1)
//      https://www.nhc.noaa.gov/nhc_at2.xml  (Atlantic basin 2)
//      → Active NHC tropical storms/hurricanes
//   4. https://api.weather.gov/gridpoints/TBW/56,93/forecast
//      → NWS Tampa Bay 7-day forecast
// ============================================================

import { useState, useEffect, useCallback } from 'react';

export interface LiveObservation {
  tempC: number | null;
  tempF: number | null;
  windSpeedMps: number | null;
  windSpeedKt: number | null;
  windSpeedMph: number | null;
  windDirectionDeg: number | null;
  windDirectionText: string;
  pressurePa: number | null;
  pressureInHg: number | null;
  conditions: string;
  humidity: number | null;
  visibility: number | null;
  timestamp: string | null;
  stationId: string;
}

export interface NWSAlert {
  id: string;
  event: string;
  severity: string;
  urgency: string;
  headline: string;
  description: string;
  areaDesc: string;
  effective: string;
  expires: string;
  senderName: string;
}

export interface ActiveStorm {
  name: string;
  type: string;          // 'Hurricane' | 'Tropical Storm' | 'Tropical Depression' | 'Subtropical Storm'
  category: number | null;
  windKt: number | null;
  windMph: number | null;
  pressure: number | null;
  movement: string;
  position: string;
  distanceMiles: number | null;  // approx distance from Tampa Bay
  advisoryTime: string;
  source: 'NHC';
}

export interface ForecastPeriod {
  name: string;
  shortForecast: string;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  isDaytime: boolean;
}

export interface WindHistoryPoint {
  time: string;
  wind: number | null;
}

export interface LiveWeatherData {
  observation: LiveObservation | null;
  alerts: NWSAlert[];
  activeStorms: ActiveStorm[];
  forecast: ForecastPeriod[];
  windHistory: WindHistoryPoint[];
  threatLevel: 'NONE' | 'WATCH' | 'WARNING' | 'CRITICAL';
  lastUpdated: Date | null;
  isLoading: boolean;
  error: string | null;
}

// Convert wind degrees to compass text
function degreesToCompass(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Parse NHC RSS XML to extract active storms
function parseNHCRss(xml: string): ActiveStorm[] {
  const storms: ActiveStorm[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const items = doc.querySelectorAll('item');

  items.forEach(item => {
    const title = item.querySelector('title')?.textContent ?? '';
    const desc = item.querySelector('description')?.textContent ?? '';
    const pubDate = item.querySelector('pubDate')?.textContent ?? '';

    // Skip "No current storm" entries
    if (title.toLowerCase().includes('no current storm')) return;

    // Parse storm type and name from title like "Hurricane Helena Advisory 15"
    const stormMatch = title.match(/(Hurricane|Tropical Storm|Tropical Depression|Subtropical Storm)\s+(\w+)/i);
    if (!stormMatch) return;

    const type = stormMatch[1];
    const name = stormMatch[2];

    // Parse wind speed from description
    const windMatch = desc.match(/(\d+)\s*(?:kt|knots)/i);
    const windKt = windMatch ? parseInt(windMatch[1]) : null;
    const windMph = windKt ? Math.round(windKt * 1.15078) : null;

    // Determine category
    let category: number | null = null;
    if (type === 'Hurricane' && windKt) {
      if (windKt >= 137) category = 5;
      else if (windKt >= 113) category = 4;
      else if (windKt >= 96) category = 3;
      else if (windKt >= 83) category = 2;
      else category = 1;
    }

    // Parse position
    const posMatch = desc.match(/(\d+\.\d+)[°\s]*([NS])[,\s]+(\d+\.\d+)[°\s]*([EW])/i);
    const position = posMatch ? `${posMatch[1]}°${posMatch[2]}, ${posMatch[3]}°${posMatch[4]}` : 'Position unavailable';

    // Parse movement
    const movMatch = desc.match(/moving\s+([A-Z]+)\s+at\s+(\d+)\s*mph/i);
    const movement = movMatch ? `${movMatch[1]} at ${movMatch[2]} mph` : 'Movement data unavailable';

    // Rough distance from Tampa Bay (27.95N, 82.46W)
    let distanceMiles: number | null = null;
    if (posMatch) {
      const lat = parseFloat(posMatch[1]) * (posMatch[2] === 'S' ? -1 : 1);
      const lng = parseFloat(posMatch[3]) * (posMatch[4] === 'W' ? -1 : 1);
      const dLat = (lat - 27.95) * 69;
      const dLng = (lng - (-82.46)) * 53;
      distanceMiles = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
    }

    storms.push({ name, type, category, windKt, windMph, pressure: null, movement, position, distanceMiles, advisoryTime: pubDate, source: 'NHC' });
  });

  return storms;
}

// Determine threat level from storms and alerts
function computeThreatLevel(storms: ActiveStorm[], alerts: NWSAlert[]): LiveWeatherData['threatLevel'] {
  // Active hurricane within 500 miles → CRITICAL
  const nearHurricane = storms.find(s => s.type === 'Hurricane' && s.distanceMiles !== null && s.distanceMiles < 500);
  if (nearHurricane) return 'CRITICAL';

  // Active tropical storm within 300 miles → WARNING
  const nearTropStorm = storms.find(s => s.distanceMiles !== null && s.distanceMiles < 300);
  if (nearTropStorm) return 'WARNING';

  // Extreme/Severe NWS alert for Tampa Bay area → WARNING
  const severeAlert = alerts.find(a =>
    (a.severity === 'Extreme' || a.severity === 'Severe') &&
    (a.areaDesc.toLowerCase().includes('hillsborough') ||
     a.areaDesc.toLowerCase().includes('pinellas') ||
     a.areaDesc.toLowerCase().includes('pasco') ||
     a.areaDesc.toLowerCase().includes('manatee') ||
     a.areaDesc.toLowerCase().includes('sarasota') ||
     a.areaDesc.toLowerCase().includes('tampa'))
  );
  if (severeAlert) return 'WARNING';

  // Moderate alert for Tampa Bay → WATCH
  const moderateAlert = alerts.find(a =>
    a.severity === 'Moderate' &&
    (a.areaDesc.toLowerCase().includes('hillsborough') ||
     a.areaDesc.toLowerCase().includes('pinellas') ||
     a.areaDesc.toLowerCase().includes('tampa'))
  );
  if (moderateAlert) return 'WATCH';

  // Any active storm anywhere in Atlantic → WATCH
  if (storms.length > 0) return 'WATCH';

  return 'NONE';
}

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

export function useLiveWeather(refreshIntervalMs = 5 * 60 * 1000): LiveWeatherData {
  const [data, setData] = useState<LiveWeatherData>({
    observation: null,
    alerts: [],
    activeStorms: [],
    forecast: [],
    windHistory: [],
    threatLevel: 'NONE',
    lastUpdated: null,
    isLoading: true,
    error: null,
  });

  const fetchAll = useCallback(async () => {
    setData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const headers = { 'User-Agent': 'BayShield/3.0 (bayshield.app)' };

      // Run all fetches in parallel
      const [obsRes, alertsRes, nhcAt1Res, nhcAt2Res, forecastRes, obsHistRes] = await Promise.allSettled([
        fetch('https://api.weather.gov/stations/KTPA/observations/latest', { headers }),
        fetch('https://api.weather.gov/alerts/active?area=FL&status=actual', { headers }),
        fetch(`${CORS_PROXY}${encodeURIComponent('https://www.nhc.noaa.gov/nhc_at1.xml')}`),
        fetch(`${CORS_PROXY}${encodeURIComponent('https://www.nhc.noaa.gov/nhc_at2.xml')}`),
        fetch('https://api.weather.gov/gridpoints/TBW/56,93/forecast', { headers }),
        fetch('https://api.weather.gov/stations/KTPA/observations?limit=12', { headers }),
      ]);

      // --- Parse observation ---
      let observation: LiveObservation | null = null;
      if (obsRes.status === 'fulfilled' && obsRes.value.ok) {
        const obsJson = await obsRes.value.json();
        const p = obsJson.properties ?? {};
        const tempC = p.temperature?.value ?? null;
        const windMps = p.windSpeed?.value ?? null;
        const windKt = windMps !== null ? Math.round(windMps * 1.94384) : null;
        const windMph = windMps !== null ? Math.round(windMps * 2.23694) : null;
        const windDeg = p.windDirection?.value ?? null;
        observation = {
          tempC: tempC !== null ? Math.round(tempC) : null,
          tempF: tempC !== null ? Math.round(tempC * 9 / 5 + 32) : null,
          windSpeedMps: windMps !== null ? Math.round(windMps * 10) / 10 : null,
          windSpeedKt: windKt,
          windSpeedMph: windMph,
          windDirectionDeg: windDeg,
          windDirectionText: windDeg !== null ? degreesToCompass(windDeg) : '--',
          pressurePa: p.barometricPressure?.value ?? null,
          pressureInHg: p.barometricPressure?.value ? Math.round(p.barometricPressure.value / 3386.39 * 100) / 100 : null,
          conditions: p.textDescription ?? 'Unknown',
          humidity: p.relativeHumidity?.value ? Math.round(p.relativeHumidity.value) : null,
          visibility: p.visibility?.value ? Math.round(p.visibility.value / 1609.34) : null,
          timestamp: p.timestamp ?? null,
          stationId: 'KTPA',
        };
      }

      // --- Parse NWS alerts ---
      let alerts: NWSAlert[] = [];
      if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
        const alertsJson = await alertsRes.value.json();
        alerts = (alertsJson.features ?? []).map((f: any) => {
          const p = f.properties;
          return {
            id: p.id ?? f.id,
            event: p.event ?? '',
            severity: p.severity ?? 'Unknown',
            urgency: p.urgency ?? 'Unknown',
            headline: p.headline ?? '',
            description: (p.description ?? '').slice(0, 300),
            areaDesc: p.areaDesc ?? '',
            effective: p.effective ?? '',
            expires: p.expires ?? '',
            senderName: p.senderName ?? '',
          };
        });
      }

      // --- Parse NHC storms ---
      let activeStorms: ActiveStorm[] = [];
      for (const nhcRes of [nhcAt1Res, nhcAt2Res]) {
        if (nhcRes.status === 'fulfilled' && nhcRes.value.ok) {
          const xml = await nhcRes.value.text();
          activeStorms = [...activeStorms, ...parseNHCRss(xml)];
        }
      }

      // --- Parse forecast ---
      let forecast: ForecastPeriod[] = [];
      if (forecastRes.status === 'fulfilled' && forecastRes.value.ok) {
        const forecastJson = await forecastRes.value.json();
        forecast = (forecastJson.properties?.periods ?? []).slice(0, 7).map((p: any) => ({
          name: p.name,
          shortForecast: p.shortForecast,
          temperature: p.temperature,
          temperatureUnit: p.temperatureUnit,
          windSpeed: p.windSpeed,
          windDirection: p.windDirection,
          isDaytime: p.isDaytime,
        }));
      }

      // --- Parse wind history ---
      let windHistory: WindHistoryPoint[] = [];
      if (obsHistRes.status === 'fulfilled' && obsHistRes.value.ok) {
        const histJson = await obsHistRes.value.json();
        const features: any[] = (histJson.features ?? []).slice(0, 12);
        windHistory = features
          .reverse() // API returns newest-first; reverse to oldest-first for chart
          .map((f: any, i: number, arr: any[]) => {
            const ts: string | undefined = f.properties?.timestamp;
            const windMps: number | null = f.properties?.windSpeed?.value ?? null;
            const hoursAgo = ts ? Math.round((Date.now() - new Date(ts).getTime()) / 3_600_000) : null;
            const time = i === arr.length - 1 ? 'Now' : (hoursAgo != null ? `-${hoursAgo}h` : '?');
            const wind = windMps != null ? Math.round(windMps * 1.94384) : null;
            return { time, wind };
          });
      }

      const threatLevel = computeThreatLevel(activeStorms, alerts);

      setData({
        observation,
        alerts,
        activeStorms,
        forecast,
        windHistory,
        threatLevel,
        lastUpdated: new Date(),
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch weather data',
      }));
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchAll, refreshIntervalMs]);

  return data;
}
