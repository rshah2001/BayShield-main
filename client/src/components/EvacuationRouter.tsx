import { useState, useEffect, useCallback, useRef } from 'react';
import L from 'leaflet';
import type { Resource } from '@/lib/stormData';
import { cn } from '@/lib/utils';
import {
  Navigation, MapPin, Clock, AlertTriangle, CheckCircle2,
  RefreshCw, ChevronRight, Shield, Zap, Car, Route
} from 'lucide-react';

type LatLng = { lat: number; lng: number };

type RouteZone = {
  id: string;
  name: string;
  floodZone: string;
  lat: number;
  lng: number;
  riskScore: number;
  polygons?: number[][][];
};

function buildFloodZoneBounds(zones: RouteZone[]) {
  return zones
    .filter(z => z.floodZone === 'VE' || z.floodZone === 'AE')
    .map(z => {
      let radius = z.floodZone === 'VE' ? 3000 : 2000;
      if (z.polygons && z.polygons.length > 0) {
        const points = z.polygons.flat();
        const maxDist = points.reduce((max, [lat, lng]) => {
          return Math.max(max, haversineDistance(lat, lng, z.lat, z.lng));
        }, 0);
        radius = Math.max(radius, Math.min(maxDist, 12000));
      }
      return { name: z.name, lat: z.lat, lng: z.lng, radius, penalty: z.floodZone === 'VE' ? 30 : 15 };
    });
}

export interface EvacRoute {
  id: string;
  shelter: Resource;
  distance: string;
  duration: string;
  durationValue: number;
  distanceValue: number;
  safetyScore: number;
  floodZonesCrossed: string[];
  trafficCondition: 'clear' | 'moderate' | 'heavy' | 'standstill';
  steps: string[];
  geometry?: [number, number][];
  recommended: boolean;
  warnings: string[];
}

interface EvacuationRouterProps {
  map: L.Map | null;
  shelters?: Resource[];
  zones?: RouteZone[];
  onRouteSelected?: (route: EvacRoute | null) => void;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function floodPenaltyForPath(
  points: [number, number][],
  zones: ReturnType<typeof buildFloodZoneBounds>
): { penalty: number; zones: string[] } {
  let penalty = 0;
  const crossed: string[] = [];
  // sample at most 20 points along the path
  const step = Math.max(1, Math.floor(points.length / 20));
  for (let i = 0; i < points.length; i += step) {
    const [lat, lng] = points[i];
    for (const zone of zones) {
      if (!crossed.includes(zone.name) && haversineDistance(lat, lng, zone.lat, zone.lng) < zone.radius) {
        penalty += zone.penalty;
        crossed.push(zone.name);
      }
    }
  }
  return { penalty, zones: crossed };
}

function formatDuration(seconds: number): string {
  const min = Math.round(seconds / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`;
}

function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

const TRAFFIC_CONFIG: Record<EvacRoute['trafficCondition'], { label: string; color: string; bg: string }> = {
  clear:      { label: 'Clear',      color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  moderate:   { label: 'Moderate',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  heavy:      { label: 'Heavy',      color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  standstill: { label: 'Standstill', color: '#ef4444', bg: 'rgba(239,68,68,0.18)' },
};

function SafetyBar({ score }: { score: number }) {
  const color = score >= 75 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono" style={{ color }}>{score}</span>
    </div>
  );
}

export default function EvacuationRouter({ map, shelters: providedShelters, zones: providedZones, onRouteSelected }: EvacuationRouterProps) {
  const shelters = (providedShelters ?? []).filter(r => r.type === 'shelter');
  const floodZoneBounds = buildFloodZoneBounds(providedZones ?? []);

  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [routes, setRoutes] = useState<EvacRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [showAddressInput, setShowAddressInput] = useState(false);

  const routePolylineRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const renderRouteOnMap = useCallback((route: EvacRoute) => {
    if (!map || !route.geometry) return;
    routePolylineRef.current?.remove();
    const color = route.safetyScore >= 75 ? '#34d399' : route.safetyScore >= 50 ? '#fbbf24' : '#f87171';
    routePolylineRef.current = L.polyline(route.geometry, {
      color, weight: 5, opacity: 0.9,
    }).addTo(map);
    onRouteSelected?.(route);
  }, [map, onRouteSelected]);

  const computeRoutes = useCallback(async (origin: LatLng) => {
    if (!shelters.length) { setIsRouting(false); return; }
    setIsRouting(true);
    const results: EvacRoute[] = [];

    for (const shelter of shelters) {
      const straightLine = haversineDistance(origin.lat, origin.lng, shelter.lat, shelter.lng);
      let distanceValue = Math.round(straightLine);
      let durationValue = Math.round(straightLine / 13); // ~47 km/h average
      let distanceText = formatDistance(distanceValue);
      let durationText = formatDuration(durationValue);
      let steps: string[] = [];
      let geometry: [number, number][] | undefined;

      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${shelter.lng},${shelter.lat}?overview=full&geometries=geojson&steps=true`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.code === 'Ok' && data.routes?.length) {
            const r = data.routes[0];
            const leg = r.legs[0];
            distanceValue = Math.round(r.distance);
            durationValue = Math.round(r.duration);
            distanceText = formatDistance(distanceValue);
            durationText = formatDuration(durationValue);
            geometry = (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]);
            steps = (leg.steps as { name: string; maneuver: { type: string; modifier?: string } }[])
              .slice(0, 6)
              .map(step => {
                const name = step.name || 'unnamed road';
                const { type, modifier } = step.maneuver;
                if (type === 'depart') return `Head ${modifier ?? 'forward'} on ${name}`;
                if (type === 'arrive') return `Arrive at ${shelter.name}`;
                return `${modifier ? `Turn ${modifier}` : 'Continue'} onto ${name}`;
              });
          }
        }
      } catch {
        // fallback to haversine values computed above
      }

      const pathToCheck: [number, number][] = geometry ?? [[origin.lat, origin.lng], [shelter.lat, shelter.lng]];
      const { penalty, zones } = floodPenaltyForPath(pathToCheck, floodZoneBounds);
      const capacityPenalty = shelter.status === 'full' ? 40 : shelter.status === 'filling' ? 10 : 0;
      const safetyScore = Math.max(0, Math.min(100, 100 - penalty - capacityPenalty));

      const warnings: string[] = [];
      if (zones.length > 0) warnings.push(`Passes through ${zones.length} flood zone(s): ${zones.slice(0, 2).join(', ')}`);
      if (shelter.status === 'filling') warnings.push(`Shelter at ${Math.round((shelter.currentOccupancy / shelter.capacity) * 100)}% capacity`);
      if (shelter.status === 'full') warnings.push('Shelter at full capacity -- seek alternate');

      results.push({
        id: shelter.id, shelter,
        distance: distanceText, duration: durationText,
        durationValue, distanceValue,
        safetyScore, floodZonesCrossed: zones,
        trafficCondition: 'clear',
        steps, geometry, recommended: false, warnings,
      });
    }

    results.sort((a, b) => b.safetyScore !== a.safetyScore ? b.safetyScore - a.safetyScore : a.durationValue - b.durationValue);
    if (results.length > 0) results[0].recommended = true;

    setRoutes(results);
    setLastUpdated(new Date());
    setIsRouting(false);

    if (results.length > 0) {
      setSelectedRouteId(results[0].id);
      renderRouteOnMap(results[0]);
    }
  }, [floodZoneBounds, shelters, renderRouteOnMap]);

  const placeUserMarker = useCallback((loc: LatLng) => {
    if (!map) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = L.circleMarker([loc.lat, loc.lng], {
      radius: 10, fillColor: '#3b82f6', fillOpacity: 1, color: '#ffffff', weight: 2,
    }).addTo(map);
    map.panTo([loc.lat, loc.lng]);
    map.setZoom(11);
  }, [map]);

  const getLocation = useCallback(() => {
    setIsLocating(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported by your browser.');
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setIsLocating(false);
        placeUserMarker(loc);
        computeRoutes(loc);
      },
      err => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location access denied. Enter your address below.');
        } else {
          setLocationError('Could not get your location. Enter your address below.');
        }
        setShowAddressInput(true);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [placeUserMarker, computeRoutes]);

  const geocodeAddress = useCallback(async () => {
    if (!manualAddress.trim()) return;
    setIsLocating(true);
    setLocationError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualAddress + ', Tampa Bay, FL')}&limit=1&countrycodes=us`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.length) throw new Error('Not found');
      const loc: LatLng = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      setUserLocation(loc);
      setIsLocating(false);
      setShowAddressInput(false);
      placeUserMarker(loc);
      computeRoutes(loc);
    } catch {
      setLocationError('Address not found. Try a more specific address.');
      setIsLocating(false);
    }
  }, [manualAddress, placeUserMarker, computeRoutes]);

  // Auto-refresh routes every 2 minutes
  useEffect(() => {
    if (!userLocation) return;
    refreshTimerRef.current = setInterval(() => computeRoutes(userLocation), 2 * 60 * 1000);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [userLocation, computeRoutes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      routePolylineRef.current?.remove();
      userMarkerRef.current?.remove();
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, []);

  const selectedRoute = routes.find(r => r.id === selectedRouteId) ?? null;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/8">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Route className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-white">Evacuation Routing</span>
          </div>
          {lastUpdated && (
            <button
              onClick={() => userLocation && computeRoutes(userLocation)}
              disabled={isRouting}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className={cn('w-3 h-3', isRouting && 'animate-spin')} />
              {isRouting ? 'Updating...' : `Updated ${lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`}
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500">
          Routes to shelters ranked by safety score and flood zone avoidance
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!userLocation ? (
          <div className="space-y-3">
            <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                <Navigation className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-sm font-medium text-white mb-1">Find Your Evacuation Route</p>
              <p className="text-[11px] text-slate-400 mb-4">
                Share your location to get routes to the nearest shelter, ranked by safety score.
              </p>
              <button
                onClick={getLocation}
                disabled={isLocating}
                className="w-full py-2.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLocating
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Locating...</>
                  : <><Navigation className="w-4 h-4" /> Use My Location</>}
              </button>
            </div>

            {locationError && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-[11px] text-amber-400 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {locationError}
                </p>
              </div>
            )}

            {showAddressInput && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualAddress}
                    onChange={e => setManualAddress(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && geocodeAddress()}
                    placeholder="Enter your address..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
                  />
                  <button
                    onClick={geocodeAddress}
                    disabled={isLocating || !manualAddress.trim()}
                    className="px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isLocating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">e.g. &quot;123 Main St, Tampa&quot; or &quot;Clearwater Beach&quot;</p>
              </div>
            )}

            {!showAddressInput && !locationError && (
              <button
                onClick={() => setShowAddressInput(true)}
                className="w-full text-[11px] text-slate-400 hover:text-white transition-colors py-1"
              >
                Enter address manually instead
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[11px] text-emerald-300 flex-1 truncate">
                Location confirmed -- routing to {shelters.length} shelter{shelters.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => {
                  setUserLocation(null);
                  setRoutes([]);
                  setSelectedRouteId(null);
                  routePolylineRef.current?.remove();
                  userMarkerRef.current?.remove();
                  onRouteSelected?.(null);
                }}
                className="text-[10px] text-slate-400 hover:text-white transition-colors"
              >
                Change
              </button>
            </div>

            {isRouting && routes.length === 0 && (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />)}
                <p className="text-[11px] text-slate-500 text-center">Calculating routes...</p>
              </div>
            )}

            {shelters.length === 0 && !isRouting && (
              <div className="rounded-xl border border-white/8 bg-white/4 p-4 text-sm text-slate-400">
                No open shelters are currently reported. Routes will appear here when shelters activate.
              </div>
            )}

            {routes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider">
                    {routes.length} Route{routes.length !== 1 ? 's' : ''} Found
                  </span>
                  {isRouting && (
                    <span className="text-[10px] text-blue-400 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Refreshing
                    </span>
                  )}
                </div>

                {routes.map(route => {
                  const isSelected = route.id === selectedRouteId;
                  const tc = TRAFFIC_CONFIG[route.trafficCondition];
                  return (
                    <button
                      key={route.id}
                      onClick={() => { setSelectedRouteId(route.id); renderRouteOnMap(route); }}
                      className={cn(
                        'w-full text-left rounded-xl p-3 border transition-all duration-200',
                        isSelected ? 'bg-blue-500/12 border-blue-500/40' : 'bg-white/4 border-white/8 hover:bg-white/6 hover:border-white/15'
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {route.recommended && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">RECOMMENDED</span>
                          )}
                          <span className="text-xs font-semibold text-white">{route.shelter.name}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />}
                      </div>

                      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" /><span className="text-[11px] text-slate-300">{route.duration}</span></div>
                        <div className="flex items-center gap-1"><Car className="w-3 h-3 text-slate-400" /><span className="text-[11px] text-slate-300">{route.distance}</span></div>
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: tc.bg, color: tc.color }}>
                          <Zap className="w-2.5 h-2.5" />{tc.label}
                        </div>
                      </div>

                      <div className="mb-1.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-500 font-mono uppercase">Safety Score</span>
                          <span className="text-[10px] font-mono" style={{ color: route.safetyScore >= 75 ? '#34d399' : route.safetyScore >= 50 ? '#fbbf24' : '#f87171' }}>
                            {route.safetyScore >= 75 ? 'SAFE' : route.safetyScore >= 50 ? 'CAUTION' : 'RISK'}
                          </span>
                        </div>
                        <SafetyBar score={route.safetyScore} />
                      </div>

                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Capacity: {route.shelter.currentOccupancy.toLocaleString()} / {route.shelter.capacity.toLocaleString()}</span>
                        <span className={cn('font-mono', route.shelter.status === 'available' ? 'text-emerald-400' : route.shelter.status === 'filling' ? 'text-amber-400' : 'text-red-400')}>
                          {route.shelter.status.toUpperCase()}
                        </span>
                      </div>

                      {route.warnings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {route.warnings.map((w, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                              <span className="text-[10px] text-amber-300/80">{w}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedRoute && selectedRoute.steps.length > 0 && (
              <div className="bg-white/4 border border-white/8 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Navigation className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[11px] font-semibold text-white">Turn-by-Turn Directions</span>
                  <span className="text-[10px] text-slate-500">to {selectedRoute.shelter.name}</span>
                </div>
                <div className="space-y-2">
                  {selectedRoute.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[9px] text-blue-400 font-mono font-bold">{i + 1}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
                {selectedRoute.shelter.supplies && (
                  <div className="mt-3 pt-3 border-t border-white/8">
                    <p className="text-[10px] text-slate-500 mb-1.5 font-mono uppercase">Available at Shelter</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedRoute.shelter.supplies.map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-white/6 text-slate-300 border border-white/10">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedRoute && selectedRoute.floodZonesCrossed.length > 0 && (
              <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[11px] font-semibold text-red-300">Flood Zone Warning</span>
                </div>
                <p className="text-[11px] text-red-300/80">
                  This route passes through {selectedRoute.floodZonesCrossed.length} flood zone(s):{' '}
                  <strong>{selectedRoute.floodZonesCrossed.join(', ')}</strong>. Drive carefully and monitor water levels.
                </p>
              </div>
            )}

            <div className="text-center">
              <p className="text-[10px] text-slate-600">Routes auto-refresh every 2 minutes</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
