import { useState, useCallback, useEffect } from 'react';
import { Polygon, Circle, Marker, Popup, ZoomControl, GeoJSON, WMSTileLayer } from 'react-leaflet';
import L from 'leaflet';
import { MapView } from '@/components/Map';
import { useSimulation } from '@/contexts/SimulationContext';
import type { Resource } from '@/lib/stormData';
import EvacuationRouter from '@/components/EvacuationRouter';
import { cn } from '@/lib/utils';
import { AlertTriangle, MapPin, Building2, Route, Layers, Radar, Waves, ShieldAlert, CloudLightning, Map } from 'lucide-react';

const NHC_CONE_URL =
  'https://services.arcgis.com/LBbVDC0hKPAnLRpO/arcgis/rest/services/NHC_Active_Tracks_v3/FeatureServer/2/query?where=1%3D1&outFields=*&f=geojson';
const NHC_TRACK_URL =
  'https://services.arcgis.com/LBbVDC0hKPAnLRpO/arcgis/rest/services/NHC_Active_Tracks_v3/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson';

const ZONE_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  evacuate: { fill: '#ff6b6b', stroke: '#d43f63', label: 'EVACUATE' },
  warning:  { fill: '#ffb44d', stroke: '#f07a2b', label: 'WARNING' },
  watch:    { fill: '#5cc8ff', stroke: '#2f7df6', label: 'WATCH' },
  safe:     { fill: '#5de2b3', stroke: '#19b88a', label: 'SAFE' },
};

const RESOURCE_META: Record<string, { tint: string; label: string; glyph: string }> = {
  shelter:         { tint: '#73b8ff', label: 'Shelter', glyph: 'S' },
  supply_depot:    { tint: '#47d6a8', label: 'Depot',   glyph: 'D' },
  medical:         { tint: '#ff7f96', label: 'Medical', glyph: 'M' },
  evacuation_route:{ tint: '#ffd166', label: 'Route',   glyph: 'R' },
};

type SidebarTab = 'zones' | 'resources' | 'evacuation';
type LiveZone = ReturnType<typeof useSimulation>['vulnerabilityZones'][number];

function makeZoneIcon(fill: string, score: number) {
  const svg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="pin${score}" x1="16" y1="12" x2="48" y2="54" gradientUnits="userSpaceOnUse">
      <stop stop-color="${fill}99"/><stop offset="1" stop-color="${fill}"/>
    </linearGradient></defs>
    <path d="M32 6C21.507 6 13 14.507 13 25c0 13.797 16.965 29.465 18.035 30.447a1.5 1.5 0 0 0 1.93 0C34.035 54.465 51 38.797 51 25 51 14.507 42.493 6 32 6Z" fill="url(#pin${score})" stroke="rgba(226,232,240,0.75)" stroke-width="2"/>
    <circle cx="32" cy="25" r="10.5" fill="rgba(4,13,24,0.72)" stroke="rgba(255,255,255,0.18)"/>
    <text x="32" y="29.5" text-anchor="middle" font-size="11" font-family="Inter,Arial,sans-serif" font-weight="700" fill="white">${score}</text>
  </svg>`;
  return L.divIcon({ className: '', html: svg, iconSize: [32, 32], iconAnchor: [16, 26], popupAnchor: [0, -28] });
}

function makeResourceIcon(tint: string, glyph: string) {
  const svg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="rpinG" x1="16" y1="12" x2="48" y2="54" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0b1220"/><stop offset="1" stop-color="${tint}"/>
    </linearGradient></defs>
    <path d="M32 6C21.507 6 13 14.507 13 25c0 13.797 16.965 29.465 18.035 30.447a1.5 1.5 0 0 0 1.93 0C34.035 54.465 51 38.797 51 25 51 14.507 42.493 6 32 6Z" fill="url(#rpinG)" stroke="rgba(226,232,240,0.75)" stroke-width="2"/>
    <circle cx="32" cy="25" r="10.5" fill="rgba(4,13,24,0.72)" stroke="rgba(255,255,255,0.18)"/>
    <text x="32" y="29.5" text-anchor="middle" font-size="11" font-family="Inter,Arial,sans-serif" font-weight="700" fill="white">${glyph}</text>
  </svg>`;
  return L.divIcon({ className: '', html: svg, iconSize: [32, 32], iconAnchor: [16, 26], popupAnchor: [0, -28] });
}

function ZonePopupContent({ zone, cfg }: { zone: LiveZone; cfg: { fill: string; stroke: string; label: string } }) {
  return (
    <div style={{ minWidth: 220, padding: 14, fontFamily: 'Inter,Arial,sans-serif', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{zone.name}</div>
          <div style={{ fontSize: 11, color: '#8aa0bf', marginTop: 3 }}>
            {zone.source === 'nws-alert-polygon' ? 'Official NWS alert polygon' : 'BayShield geospatial threat model'}
          </div>
        </div>
        <div style={{ padding: '4px 8px', borderRadius: 999, border: `1px solid ${cfg.fill}44`, background: `${cfg.fill}1f`, color: cfg.fill, fontSize: 10, fontWeight: 700 }}>
          {cfg.label}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: 11, color: '#b7c5d9' }}>
        <div>Flood zone <strong style={{ color: cfg.fill }}>{zone.floodZone}</strong></div>
        <div>Risk <strong style={{ color: '#f8fafc' }}>{zone.riskScore}/100</strong></div>
        <div>Population <strong style={{ color: '#f8fafc' }}>{zone.population.toLocaleString()}</strong></div>
        <div>Event <strong style={{ color: '#f8fafc' }}>{zone.event ?? 'Monitoring'}</strong></div>
        <div>Counties <strong style={{ color: '#f8fafc' }}>{zone.affectedCounties?.length ? zone.affectedCounties.join(', ') : 'Tampa Bay'}</strong></div>
        <div>Expires <strong style={{ color: '#f8fafc' }}>{zone.expires ? new Date(zone.expires).toLocaleString() : 'Active'}</strong></div>
      </div>
      <div style={{ marginTop: 12, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${zone.riskScore}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg,${cfg.stroke},${cfg.fill})` }} />
      </div>
    </div>
  );
}

function ResourcePopupContent({ res }: { res: Resource }) {
  const meta = RESOURCE_META[res.type] ?? RESOURCE_META.supply_depot;
  const pct = res.capacity > 0 ? Math.round((res.currentOccupancy / res.capacity) * 100) : 0;
  const statusColor = res.status === 'available' ? '#34d399' : res.status === 'filling' ? '#fbbf24' : '#f87171';
  return (
    <div style={{ minWidth: 220, padding: 14, fontFamily: 'Inter,Arial,sans-serif', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{res.name}</div>
          <div style={{ fontSize: 11, color: '#8aa0bf', marginTop: 3 }}>{meta.label}</div>
        </div>
        <div style={{ padding: '4px 8px', borderRadius: 999, border: `1px solid ${statusColor}44`, background: `${statusColor}1f`, color: statusColor, fontSize: 10, fontWeight: 700 }}>
          {res.status.toUpperCase()}
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#b7c5d9' }}>
        Capacity <strong style={{ color: '#f8fafc' }}>{res.currentOccupancy.toLocaleString()} / {res.capacity.toLocaleString()}</strong> ({pct}%)
      </div>
      <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg,${statusColor},#f8fafc)` }} />
      </div>
      {res.supplies?.length ? (
        <div style={{ marginTop: 12, fontSize: 10, color: '#8aa0bf' }}>
          Supplies: <span style={{ color: '#e2e8f0' }}>{res.supplies.slice(0, 4).join(' · ')}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function MapViewPage() {
  const { alerts, shelters, shelterFeedSource, vulnerabilityZones } = useSimulation();
  const [activeTab, setActiveTab] = useState<SidebarTab>('evacuation');
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [showFema, setShowFema] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [coneGeoJson, setConeGeoJson] = useState<any | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [trackGeoJson, setTrackGeoJson] = useState<any | null>(null);
  const liveResources: Resource[] = shelters.filter(r => r.type === 'shelter');

  useEffect(() => {
    async function fetchNhcLayers() {
      try {
        const [coneRes, trackRes] = await Promise.allSettled([
          fetch(NHC_CONE_URL),
          fetch(NHC_TRACK_URL),
        ]);
        if (coneRes.status === 'fulfilled' && coneRes.value.ok) {
          const data = await coneRes.value.json();
          if (data.features?.length) setConeGeoJson(data);
        }
        if (trackRes.status === 'fulfilled' && trackRes.value.ok) {
          const data = await trackRes.value.json();
          if (data.features?.length) setTrackGeoJson(data);
        }
      } catch { /* non-critical */ }
    }
    fetchNhcLayers();
    const id = setInterval(fetchNhcLayers, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const handleMapReady = useCallback((map: L.Map) => {
    setMapInstance(map);
  }, []);

  const tabs: { id: SidebarTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'evacuation', label: 'Evacuation', icon: <Route className="w-3.5 h-3.5" /> },
    { id: 'zones',      label: 'Zones',      icon: <Layers className="w-3.5 h-3.5" />, count: vulnerabilityZones.filter(z => z.status !== 'safe').length },
    { id: 'resources',  label: 'Resources',  icon: <Building2 className="w-3.5 h-3.5" />, count: liveResources.length },
  ];

  const layerToggles = [
    {
      id: 'fema',
      label: 'FEMA Flood Zones',
      sublabel: showFema ? 'Zoom in to see zones' : 'A/AE/VE/X overlay',
      icon: <Waves className="w-3.5 h-3.5" />,
      active: showFema,
      onToggle: () => setShowFema(v => !v),
      color: 'text-blue-400',
    },
    {
      id: 'nhc',
      label: 'NHC Storm Cone',
      sublabel: coneGeoJson ? 'Active storm data' : 'No active storms',
      icon: <CloudLightning className="w-3.5 h-3.5" />,
      active: !!coneGeoJson,
      onToggle: undefined,
      color: coneGeoJson ? 'text-amber-400' : 'text-slate-500',
    },
  ];

  return (
    <div className="flex min-h-full flex-col overflow-hidden xl:h-full xl:flex-row">
      {/* ── Sidebar ────────────────────────────────────────────── */}
      <div
        className="flex w-full shrink-0 flex-col border-b border-white/8 xl:w-80 xl:border-b-0 xl:border-r"
        style={{ background: 'oklch(0.10 0.012 250)' }}
      >
        <div className="border-b border-white/8 p-4">
          <h1 className="flex items-center gap-2 text-sm font-semibold text-white">
            <MapPin className="w-4 h-4 text-blue-400" />
            Map &amp; Evacuation
          </h1>
          <p className="mt-0.5 text-[11px] text-slate-500">Threat zones, shelter locations, and evacuation routes for Tampa Bay</p>
        </div>

        {alerts.length > 0 && (
          <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400" />
            <span className="text-[11px] text-red-300">{alerts.length} active NWS alert{alerts.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Layer toggles */}
        <div className="mx-3 mt-3 space-y-1.5">
          {layerToggles.map(lt => (
            <div
              key={lt.id}
              className={cn(
                'flex items-center justify-between rounded-lg border px-3 py-2',
                lt.active ? 'border-white/15 bg-white/6' : 'border-white/8 bg-white/3'
              )}
            >
              <div className="flex items-center gap-2">
                <span className={lt.color}>{lt.icon}</span>
                <div>
                  <p className={cn('text-[11px] font-medium', lt.active ? 'text-slate-200' : 'text-slate-500')}>{lt.label}</p>
                  <p className="text-[9px] text-slate-600">{lt.sublabel}</p>
                </div>
              </div>
              {lt.onToggle ? (
                <button
                  onClick={lt.onToggle}
                  className={cn(
                    'h-5 w-9 rounded-full border transition-colors',
                    lt.active ? 'border-blue-400/40 bg-blue-400/30' : 'border-white/15 bg-white/8'
                  )}
                >
                  <div className={cn('mx-0.5 h-4 w-4 rounded-full transition-transform', lt.active ? 'translate-x-4 bg-blue-400' : 'bg-slate-600')} />
                </button>
              ) : (
                <span className={cn('text-[9px] font-mono px-1.5 py-0.5 rounded border',
                  lt.active ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' : 'text-slate-600 bg-white/4 border-white/8'
                )}>
                  {lt.active ? 'LIVE' : 'CLEAR'}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 flex overflow-x-auto border-b border-white/8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex min-w-24 flex-1 flex-col items-center gap-1 border-b-2 py-2.5 text-[10px] font-medium transition-colors',
                activeTab === tab.id ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              )}
            >
              {tab.icon}
              <span className="leading-none">{tab.label}</span>
              {tab.count !== undefined && (
                <span className={cn('rounded px-1 font-mono text-[9px]', activeTab === tab.id ? 'bg-blue-500/20 text-blue-400' : 'bg-white/8 text-slate-500')}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="overflow-hidden xl:flex-1">
          {activeTab === 'evacuation' && (
            <div className="max-h-[70vh] overflow-y-auto xl:h-full xl:max-h-none">
              <EvacuationRouter map={mapInstance} shelters={shelters} zones={vulnerabilityZones} />
            </div>
          )}

          {activeTab === 'zones' && (
            <div className="h-full max-h-[70vh] space-y-2 overflow-y-auto p-3 xl:max-h-none">
              {vulnerabilityZones.length === 0 && (
                <div className="rounded-xl border border-white/8 bg-white/4 p-4 text-sm text-slate-400">
                  No active official NWS polygons are affecting Tampa Bay right now. BayShield will render real alert geometry here as soon as public live polygons are issued.
                </div>
              )}
              {vulnerabilityZones.slice().sort((a, b) => b.riskScore - a.riskScore).map(zone => {
                const cfg = ZONE_COLORS[zone.status] ?? ZONE_COLORS.safe;
                return (
                  <button
                    key={zone.id}
                    onClick={() => {
                      setSelectedZone(zone.id);
                      mapInstance?.panTo([zone.lat, zone.lng]);
                      mapInstance?.setZoom(zone.polygons && zone.polygons.length > 0 ? 10 : 13);
                    }}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition-all',
                      selectedZone === zone.id ? 'border-white/20 bg-white/8' : 'border-white/8 bg-white/4 hover:bg-white/6'
                    )}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">{zone.name}</span>
                      <span className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold" style={{ background: `${cfg.fill}22`, color: cfg.fill, border: `1px solid ${cfg.fill}44` }}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span>{zone.source === 'nws-alert-polygon' ? 'Official polygon' : `Zone ${zone.floodZone}`}</span>
                      <span>{zone.population.toLocaleString()} pop. basis</span>
                      <span>Risk: <strong style={{ color: cfg.fill }}>{zone.riskScore}</strong></span>
                    </div>
                    {zone.affectedCounties && zone.affectedCounties.length > 0 && (
                      <div className="mt-1 text-[10px] text-slate-500">
                        {zone.event ?? 'Alert'} &bull; {zone.affectedCounties.join(', ')}
                      </div>
                    )}
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${zone.riskScore}%`, background: cfg.fill }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'resources' && (
            <div className="h-full max-h-[70vh] space-y-2 overflow-y-auto p-3 xl:max-h-none">
              <div className="mb-2 px-0.5 text-[10px] text-slate-500">
                Shelter source: {shelterFeedSource === 'live_public' ? 'Florida public live feed' : 'No shelters currently reported'}
              </div>
              {liveResources.length === 0 && (
                <div className="rounded-xl border border-white/8 bg-white/4 p-4 text-sm text-slate-400">
                  No open public shelters currently reported by the Florida SERT feed.
                </div>
              )}
              {liveResources.filter(r => r.type !== 'evacuation_route').map(resource => {
                const pct = resource.capacity > 0 ? Math.round((resource.currentOccupancy / resource.capacity) * 100) : 0;
                const statusColor = resource.status === 'available' ? '#34d399' : resource.status === 'filling' ? '#fbbf24' : '#f87171';
                return (
                  <button
                    key={resource.id}
                    onClick={() => { mapInstance?.panTo([resource.lat, resource.lng]); mapInstance?.setZoom(14); }}
                    className="w-full rounded-xl border border-white/8 bg-white/4 p-3 text-left transition-all hover:bg-white/6"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-base">{RESOURCE_META[resource.type]?.glyph ?? 'R'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-white">{resource.name}</div>
                        <div className="text-[10px] text-slate-500">{resource.type.replace('_', ' ')}</div>
                      </div>
                      <span className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold" style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>
                        {resource.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{resource.currentOccupancy.toLocaleString()} / {resource.capacity.toLocaleString()}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: statusColor }} />
                    </div>
                    {resource.supplies && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {resource.supplies.slice(0, 3).map(s => (
                          <span key={s} className="rounded border border-white/8 bg-white/6 px-1 py-0.5 text-[9px] text-slate-400">{s}</span>
                        ))}
                        {resource.supplies.length > 3 && <span className="text-[9px] text-slate-500">+{resource.supplies.length - 3} more</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Map ────────────────────────────────────────────────── */}
      <div className="relative min-h-[50vh] flex-1 overflow-hidden xl:min-h-0 xl:rounded-l-[32px]">
        <MapView onMapReady={handleMapReady} className="h-full min-h-[50vh] w-full xl:min-h-0">
          <ZoomControl position="topright" />

          {/* Zone polygons / fallback circles */}
          {vulnerabilityZones.flatMap(zone => {
            const cfg = ZONE_COLORS[zone.status] ?? ZONE_COLORS.safe;
            if (zone.polygons && zone.polygons.length > 0) {
              return zone.polygons.map((ring: number[][], ringIdx: number) => (
                <Polygon
                  key={`${zone.id}-ring-${ringIdx}`}
                  positions={ring.map(([lat, lng]) => [lat, lng] as [number, number])}
                  pathOptions={{
                    color: cfg.stroke, weight: 2, opacity: 0.9,
                    fillColor: cfg.fill,
                    fillOpacity: zone.status === 'evacuate' ? 0.2 : zone.status === 'warning' ? 0.14 : 0.08,
                  }}
                  eventHandlers={{ click: () => setSelectedZone(zone.id) }}
                >
                  <Popup><ZonePopupContent zone={zone} cfg={cfg} /></Popup>
                </Polygon>
              ));
            }
            return [(
              <Circle
                key={`${zone.id}-circle`}
                center={[zone.lat, zone.lng]}
                radius={500 + zone.riskScore * 14}
                pathOptions={{
                  color: 'transparent',
                  fillColor: cfg.fill,
                  fillOpacity: zone.status === 'evacuate' ? 0.14 : zone.status === 'warning' ? 0.1 : 0.06,
                }}
                eventHandlers={{ click: () => setSelectedZone(zone.id) }}
              >
                <Popup><ZonePopupContent zone={zone} cfg={cfg} /></Popup>
              </Circle>
            )];
          })}

          {/* Zone pin markers */}
          {vulnerabilityZones.map(zone => {
            const cfg = ZONE_COLORS[zone.status] ?? ZONE_COLORS.safe;
            return (
              <Marker
                key={`${zone.id}-marker`}
                position={[zone.lat, zone.lng]}
                icon={makeZoneIcon(cfg.fill, zone.riskScore)}
                zIndexOffset={zone.riskScore + 100}
                eventHandlers={{ click: () => setSelectedZone(zone.id) }}
              >
                <Popup><ZonePopupContent zone={zone} cfg={cfg} /></Popup>
              </Marker>
            );
          })}

          {/* Resource / shelter markers */}
          {liveResources.filter(r => r.type !== 'evacuation_route').map(resource => {
            const meta = RESOURCE_META[resource.type] ?? RESOURCE_META.supply_depot;
            return (
              <Marker
                key={resource.id}
                position={[resource.lat, resource.lng]}
                icon={makeResourceIcon(meta.tint, meta.glyph)}
                zIndexOffset={200}
              >
                <Popup><ResourcePopupContent res={resource} /></Popup>
              </Marker>
            );
          })}

          {/* FEMA flood zone overlay — WMS from NFHL dynamic map service */}
          {showFema && (
            <WMSTileLayer
              url="https://hazards.fema.gov/arcgis/services/public/NFHL/MapServer/WmsServer"
              layers="28"
              format="image/png"
              transparent
              opacity={0.5}
              version="1.1.1"
              attribution='<a href="https://msc.fema.gov">FEMA NFHL</a>'
            />
          )}

          {/* NHC storm cone polygon */}
          {coneGeoJson && (
            <GeoJSON
              key={JSON.stringify(coneGeoJson.features?.length)}
              data={coneGeoJson}
              style={() => ({
                color: '#f97316',
                weight: 2,
                fillColor: '#f97316',
                fillOpacity: 0.12,
                opacity: 0.8,
              })}
            />
          )}

          {/* NHC storm track line */}
          {trackGeoJson && (
            <GeoJSON
              key={`track-${JSON.stringify(trackGeoJson.features?.length)}`}
              data={trackGeoJson}
              style={() => ({
                color: '#fbbf24',
                weight: 3,
                opacity: 0.9,
                fillOpacity: 0,
              })}
            />
          )}
        </MapView>

        {/* Decorative overlays */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_32%,rgba(56,189,248,0.10),transparent_24%),radial-gradient(circle_at_28%_78%,rgba(16,185,129,0.07),transparent_24%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(110,168,221,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(110,168,221,0.16)_1px,transparent_1px)] [background-size:84px_84px]" />

        {/* Top-left badge */}
        <div className="pointer-events-none absolute left-4 top-4 hidden rounded-2xl border border-cyan-300/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)),rgba(4,10,20,0.44)] px-4 py-3 shadow-[0_18px_38px_rgba(2,6,23,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl lg:block">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.24em] text-cyan-200/85">
            <Radar className="h-3.5 w-3.5" />
            BayShield GeoScope
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-300/90">
            <span className="flex items-center gap-1.5"><Waves className="h-3.5 w-3.5 text-cyan-300" /> Coastal exposure overlay</span>
            <span className="flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5 text-emerald-300" /> Priority routes</span>
          </div>
        </div>

        {/* Zone legend */}
        <div
          className="absolute right-3 top-3 rounded-2xl p-3 sm:right-12 sm:top-4"
          style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03)),rgba(8,15,26,0.62)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 22px 44px rgba(2,6,23,0.28),inset 0 1px 0 rgba(255,255,255,0.08)' }}
        >
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">Zone Status</p>
          {Object.entries(ZONE_COLORS).map(([status, cfg]) => (
            <div key={status} className="mb-1 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ background: cfg.fill }} />
              <span className="text-[10px] text-slate-300">{cfg.label}</span>
            </div>
          ))}
        </div>

        {activeTab !== 'evacuation' && (
          <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
            <button
              onClick={() => setActiveTab('evacuation')}
              className="flex items-center gap-2 rounded-full border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(56,189,248,0.24),rgba(37,99,235,0.12))] px-3 py-2 text-xs font-medium text-white shadow-[0_18px_38px_rgba(2,6,23,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-[linear-gradient(180deg,rgba(56,189,248,0.3),rgba(37,99,235,0.15))]"
            >
              <Route className="w-3.5 h-3.5" />
              Find Evacuation Route
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
