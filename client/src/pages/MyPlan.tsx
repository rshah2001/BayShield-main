import { useState, useEffect } from 'react';
import { useSimulation } from '@/contexts/SimulationContext';
import { cn } from '@/lib/utils';
import {
  Home, MapPin, Navigation, Building2, Waves, AlertTriangle,
  CheckCircle2, RefreshCw, ExternalLink, ArrowRight, ShieldAlert,
} from 'lucide-react';
import { Link } from 'wouter';

interface MyPlan {
  address: string;
  lat: number;
  lng: number;
  floodZone: string;
  floodSubtype: string;
  sfha: boolean;
  evacZone: string | null;
  nearestShelterId: string;
  nearestShelterName: string;
  nearestShelterLat: number;
  nearestShelterLng: number;
  distanceMi: number;
  driveMinutes: number | null;
  savedAt: string;
}

const PLAN_KEY = 'bayshield_myplan';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Tampa Bay county GIS services — evacuation zone point-in-polygon lookup.
// Tries each county in sequence; returns the zone letter (e.g. "A", "B") or null.
async function lookupEvacZone(lat: number, lng: number): Promise<string | null> {
  const ENDPOINTS = [
    {
      url: 'https://maps.hillsboroughcounty.org/arcgis/rest/services/Emergency_Management/Emergency_Management_Evacuation_Zones/MapServer/0/query',
      fields: ['ZONE', 'EVZ', 'EV_ZONE', 'Zone'],
    },
    {
      url: 'https://egis.pinellascounty.org/arcgis/rest/services/EMD/EmergencyManagement/MapServer/0/query',
      fields: ['ZONE', 'EVZONE', 'EVZ', 'Zone'],
    },
    {
      url: 'https://gis.pascocountyfl.net/arcgis/rest/services/Emergency_Management/Evacuation_Zones/MapServer/0/query',
      fields: ['ZONE', 'EVZ', 'Zone'],
    },
    {
      url: 'https://www.arcgis.com/sharing/rest/content/items/be0d85c4cb534dc097ae7d0f28c60e38/data',
      fields: ['ZONE', 'EVZ', 'Zone'],
    },
  ];

  for (const { url, fields } of ENDPOINTS) {
    try {
      const res = await fetch(
        `${url}?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326` +
        `&spatialRel=esriSpatialRelIntersects&outFields=${fields.join(',')}&returnGeometry=false&f=json`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const attrs = data.features?.[0]?.attributes;
      if (attrs) {
        for (const field of fields) {
          const val = attrs[field];
          if (val != null && String(val).trim() !== '') {
            return String(val).trim().toUpperCase().replace(/^ZONE[\s-]*/i, '');
          }
        }
      }
    } catch { /* timeout or network error — try next county */ }
  }
  return null;
}

function floodZoneInfo(zone: string, sfha: boolean): { risk: string; color: string; what: string } {
  const z = zone.toUpperCase();
  if (z.startsWith('V')) return {
    risk: 'VERY HIGH — Coastal Wave Hazard',
    color: 'text-red-400',
    what: 'You are in a coastal high-hazard area subject to wave action. This is the most dangerous flood zone. You will almost certainly be ordered to evacuate during a major hurricane.'
  };
  if (z === 'AE' || z === 'AH' || z === 'AO' || z.startsWith('A1') || z === 'A') return {
    risk: 'HIGH — 1% Annual Flood Chance',
    color: 'text-amber-400',
    what: 'You are in a Special Flood Hazard Area (SFHA). There is a 1-in-100 chance of flooding in any given year. Federal flood insurance is required for federally-backed mortgages here. Evacuation is likely during major storms.'
  };
  if (sfha) return {
    risk: 'HIGH — Flood Hazard Area',
    color: 'text-amber-400',
    what: 'You are in a designated flood hazard area. Know your evacuation zone and have a plan ready.'
  };
  if (z === 'X') return {
    risk: 'LOW to MODERATE',
    color: 'text-blue-400',
    what: 'You are in a minimal to moderate flood risk area. You may still be ordered to evacuate during major hurricanes depending on your evacuation zone.'
  };
  return {
    risk: 'LOW — Minimal Flood Hazard',
    color: 'text-emerald-400',
    what: 'Your address shows low flood risk from FEMA maps. Still know your evacuation zone — hurricane evacuations are based on surge zones, not just flood maps.'
  };
}

export default function MyPlanPage() {
  const { shelters, threatLevel, alerts, vulnerabilityZones } = useSimulation();
  const [address, setAddress] = useState('');
  const [plan, setPlan] = useState<MyPlan | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(PLAN_KEY);
    if (saved) {
      try { setPlan(JSON.parse(saved)); setStatus('done'); } catch { /* corrupt */ }
    }
  }, []);

  async function buildPlan() {
    if (!address.trim()) return;
    setStatus('loading');
    setErrorMsg('');

    try {
      // Step 1: Geocode address
      // viewbox biases toward Tampa Bay without excluding other FL locations
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5&countrycodes=us&viewbox=-83.2,28.4,-81.9,27.3&bounded=0`
      );
      const geoData = await geoRes.json();
      if (!geoData.length) throw new Error('Address not found. Try including city and state — e.g. "1234 Bay St, Tampa, FL".');
      const lat = parseFloat(geoData[0].lat);
      const lng = parseFloat(geoData[0].lon);

      // Step 2: FEMA flood zone lookup
      let floodZone = 'Unknown';
      let floodSubtype = '';
      let sfha = false;
      try {
        const femaRes = await fetch(
          `https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query` +
          `?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326` +
          `&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY,SFHA_TF` +
          `&returnGeometry=false&f=json`
        );
        const femaData = await femaRes.json();
        const feat = femaData.features?.[0]?.attributes;
        if (feat) {
          floodZone = feat.FLD_ZONE ?? 'X';
          floodSubtype = feat.ZONE_SUBTY ?? '';
          sfha = feat.SFHA_TF === 'T';
        }
      } catch { /* non-critical */ }

      // Step 2b: Evacuation zone from county GIS
      let evacZone: string | null = null;
      try { evacZone = await lookupEvacZone(lat, lng); } catch { /* non-critical */ }

      // Step 3: Find nearest open shelter (fall back to all shelters if none are marked open)
      const openShelters = shelters.filter(s => s.status !== 'closed').length
        ? shelters.filter(s => s.status !== 'closed')
        : shelters;
      if (!openShelters.length) throw new Error('No shelter data available yet. Reload the page and try again in a moment.');
      let nearest = openShelters[0];
      let nearestDist = haversineKm(lat, lng, nearest.lat, nearest.lng);
      for (const s of openShelters.slice(1)) {
        const d = haversineKm(lat, lng, s.lat, s.lng);
        if (d < nearestDist) { nearestDist = d; nearest = s; }
      }
      const distanceMi = nearestDist * 0.621371;

      // Step 4: OSRM drive time estimate
      let driveMinutes: number | null = null;
      try {
        const osrmRes = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${nearest.lng},${nearest.lat}?overview=false`
        );
        const osrmData = await osrmRes.json();
        const secs = osrmData.routes?.[0]?.duration;
        if (secs) driveMinutes = Math.round(secs / 60);
      } catch { /* fall back to distance estimate */ }

      if (driveMinutes === null) {
        driveMinutes = Math.round((distanceMi / 30) * 60);
      }

      const newPlan: MyPlan = {
        address: geoData[0].display_name,
        lat, lng,
        floodZone, floodSubtype, sfha,
        evacZone,
        nearestShelterId: nearest.id,
        nearestShelterName: nearest.name,
        nearestShelterLat: nearest.lat,
        nearestShelterLng: nearest.lng,
        distanceMi,
        driveMinutes,
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem(PLAN_KEY, JSON.stringify(newPlan));
      setPlan(newPlan);
      setStatus('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  function clearPlan() {
    localStorage.removeItem(PLAN_KEY);
    setPlan(null);
    setStatus('idle');
    setAddress('');
  }

  const zoneInfo = plan ? floodZoneInfo(plan.floodZone, plan.sfha) : null;

  // Live current orders data
  const activeEvacZones = vulnerabilityZones.filter(z => z.status === 'evacuate');
  const evacAlerts = alerts.filter(a =>
    a.priority === 'critical' ||
    a.message?.toLowerCase().includes('evacuat') ||
    a.message?.toLowerCase().includes('surge')
  );

  // Evacuation zone display helpers
  function evacZoneColor(zone: string | null) {
    if (!zone) return { label: 'Unknown', color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/20', risk: 'Could not determine your zone. Check your county website.' };
    const z = zone.toUpperCase();
    if (z === 'A') return { label: 'Zone A', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25', risk: 'HIGHEST RISK — Evacuate during any hurricane (Category 1 or higher). You will be among the first ordered to leave.' };
    if (z === 'B') return { label: 'Zone B', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/25', risk: 'HIGH RISK — Evacuate during Category 2 or stronger storms. Be ready to leave quickly.' };
    if (z === 'C') return { label: 'Zone C', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', risk: 'MODERATE-HIGH RISK — Evacuate during Category 3 or stronger storms. Stay alert to orders.' };
    if (z === 'D') return { label: 'Zone D', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/25', risk: 'MODERATE RISK — Evacuate during Category 4 or stronger storms. Know your route.' };
    if (z === 'E') return { label: 'Zone E', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25', risk: 'LOW-MODERATE RISK — Evacuate during Category 5 storms. Monitor orders closely.' };
    return { label: `Zone ${zone}`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', risk: 'LOWER RISK — Voluntary evacuation may be recommended for major storms. Know your shelter.' };
  }

  return (
    <div className="min-h-full space-y-5 p-4 md:p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">My Emergency Plan</h1>
        </div>
        <p className="mt-1 text-xs text-muted-foreground max-w-lg">
          Enter your home address to get your personalized flood zone, nearest open shelter, and estimated evacuation drive time — all in one place.
        </p>
      </div>

      {/* Address input */}
      <div className="rounded-xl border border-white/10 bg-white/4 p-4">
        <label className="mb-2 block text-sm font-medium text-foreground">
          Your Home Address
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buildPlan()}
            placeholder="e.g. 123 Main St, Tampa, FL"
            className="flex-1 rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-foreground placeholder:text-slate-500 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <button
            onClick={buildPlan}
            disabled={status === 'loading' || !address.trim()}
            className="flex items-center gap-2 rounded-lg bg-primary/80 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary disabled:opacity-50"
          >
            {status === 'loading' ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            {status === 'loading' ? 'Building...' : 'Build My Plan'}
          </button>
        </div>
        {status === 'error' && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            {errorMsg}
          </p>
        )}
        <p className="mt-2 text-[11px] text-slate-500">
          Your address is never sent to our servers — it's processed locally and saved only on your device.
        </p>
      </div>

      {/* Results */}
      {status === 'done' && plan && zoneInfo && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Your plan is saved on this device</span>
            </div>
            <button onClick={clearPlan} className="text-[11px] text-slate-500 hover:text-slate-300">
              Clear plan
            </button>
          </div>

          {/* Address confirmed */}
          <div className="rounded-xl border border-white/10 bg-white/4 p-4">
            <p className="text-[11px] font-mono text-slate-500 mb-1">LOCATION CONFIRMED</p>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
              <p className="text-sm text-foreground leading-snug">{plan.address}</p>
            </div>
          </div>

          {/* Flood zone */}
          <div className={cn('rounded-xl border p-4', plan.sfha || plan.floodZone.startsWith('V') ? 'border-amber-500/25 bg-amber-500/6' : 'border-emerald-500/20 bg-emerald-500/6')}>
            <div className="flex items-center gap-2 mb-2">
              <Waves className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-semibold text-foreground">FEMA Flood Zone</span>
              <span className={cn('ml-auto rounded-full border px-2 py-0.5 font-mono text-xs font-bold',
                plan.sfha ? 'border-amber-400/30 bg-amber-400/10 text-amber-400' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
              )}>
                Zone {plan.floodZone}{plan.floodSubtype ? ` — ${plan.floodSubtype}` : ''}
              </span>
            </div>
            <p className={cn('text-sm font-semibold mb-1', zoneInfo.color)}>{zoneInfo.risk}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{zoneInfo.what}</p>
            <a
              href="https://msc.fema.gov/portal/home"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-blue-400 hover:underline"
            >
              View on FEMA Flood Map <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Evacuation zone */}
          {(() => {
            const ez = evacZoneColor(plan.evacZone);
            return (
              <div className={cn('rounded-xl border p-4', ez.bg, ez.border)}>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="h-4 w-4 text-current opacity-70" />
                  <span className="text-sm font-semibold text-foreground">Your Hurricane Evacuation Zone</span>
                  <span className={cn('ml-auto rounded-full border px-3 py-0.5 font-mono text-sm font-bold', ez.color, ez.border, ez.bg)}>
                    {plan.evacZone ? `Zone ${plan.evacZone}` : 'Unknown'}
                  </span>
                </div>
                <p className={cn('text-sm font-semibold mb-1', ez.color)}>{ez.risk}</p>
                <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                  Evacuation zones A–F are based on storm surge risk, not flood maps. Zone A floods first and worst.
                  Your order to evacuate comes from your county, not this app.
                </p>
                {!plan.evacZone && (
                  <p className="mt-2 text-[11px] text-amber-400">
                    Zone lookup returned no result — your address may be outside the supported counties or the GIS service was unavailable. Use the links below.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href="https://www.hillsboroughcounty.org/en/residents/public-safety/emergency-management/know-your-zone" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/10">
                    Hillsborough <ExternalLink className="h-3 w-3" />
                  </a>
                  <a href="https://www.pinellascounty.org/emergency/evacuation.htm" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/10">
                    Pinellas <ExternalLink className="h-3 w-3" />
                  </a>
                  <a href="https://www.pascocountyfl.net/1849/Evacuation-Zones" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/10">
                    Pasco <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            );
          })()}

          {/* Current evacuation orders — live from simulation data */}
          <div className={cn(
            'rounded-xl border p-4',
            activeEvacZones.length > 0 || evacAlerts.length > 0
              ? 'border-red-500/30 bg-red-500/8'
              : threatLevel === 'warning'
                ? 'border-amber-500/25 bg-amber-500/6'
                : 'border-emerald-500/20 bg-emerald-500/6'
          )}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={cn('h-4 w-4', activeEvacZones.length > 0 ? 'text-red-400' : threatLevel === 'warning' ? 'text-amber-400' : 'text-emerald-400')} />
              <span className="text-sm font-semibold text-foreground">Current Evacuation Orders</span>
              <span className={cn(
                'ml-auto rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase',
                activeEvacZones.length > 0 ? 'text-red-400 bg-red-400/10 border-red-400/20' :
                threatLevel === 'warning' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' :
                'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
              )}>
                {threatLevel}
              </span>
            </div>

            {activeEvacZones.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-red-300">Active evacuation notices from official NWS polygons:</p>
                {activeEvacZones.slice(0, 4).map(z => (
                  <div key={z.id} className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2">
                    <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-red-400" />
                    <div>
                      <p className="text-xs font-semibold text-red-200">{z.name}</p>
                      {z.affectedCounties?.length ? (
                        <p className="text-[11px] text-slate-400">{z.affectedCounties.join(', ')}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
                {plan.evacZone && (
                  <p className="mt-1 text-xs font-semibold text-red-300">
                    You are in Zone {plan.evacZone}. Check your county website to confirm if your zone is ordered.
                  </p>
                )}
              </div>
            ) : evacAlerts.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs text-amber-300 font-medium">Active alerts that may precede evacuation orders:</p>
                {evacAlerts.slice(0, 3).map(a => (
                  <p key={a.id} className="text-[11px] text-slate-300 leading-snug">{a.message}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-emerald-300">
                No active evacuation orders for Tampa Bay right now.
              </p>
            )}

            <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
              Official evacuation orders are issued by county emergency management, not NWS or BayShield.
              Always verify with your county before evacuating or sheltering in place.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href="https://www.hillsboroughcounty.org/en/residents/public-safety/emergency-management" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                Hillsborough EM <ArrowRight className="h-3 w-3" />
              </a>
              <a href="https://pinellascounty.org/emergency" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                Pinellas EM <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Nearest shelter */}
          <div className="rounded-xl border border-white/10 bg-white/4 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-foreground">Your Nearest Open Shelter</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Destination</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{plan.nearestShelterName}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Distance</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{plan.distanceMi.toFixed(1)} miles</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Drive Time (est.)</p>
                <p className="mt-1 text-sm font-semibold text-emerald-400">
                  {plan.driveMinutes ? `~${plan.driveMinutes} min` : 'Calculating...'}
                  <span className="ml-1 text-[10px] font-normal text-slate-500">normal traffic</span>
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-amber-300 leading-relaxed">
              During an actual evacuation, expect this drive to take 2–4× longer due to traffic. Leave early.
            </p>
            <Link href="/map">
              <div className="mt-3 flex cursor-pointer items-center gap-1 text-[11px] text-primary hover:underline">
                View shelter on the map <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          </div>

          {/* Action summary */}
          <div className="rounded-xl border border-white/10 bg-white/4 p-4">
            <p className="mb-3 text-sm font-semibold">Your Evacuation Summary</p>
            <div className="space-y-2">
              {[
                { label: '1. Know your zone', detail: 'Look up your Hillsborough or Pinellas evacuation zone (A–F). Write it down.' },
                { label: '2. Know your route', detail: `Navigate to: ${plan.nearestShelterName} (~${plan.distanceMi.toFixed(1)} mi away)` },
                { label: '3. Pack your bag now', detail: 'Documents, 3 days of medications, water, phone charger, cash, and pet supplies.' },
                { label: '4. Fill up gas', detail: 'Keep your tank at least half full from June–November each year.' },
                { label: '5. Leave early', detail: 'Traffic during evacuation is severe. Leave at the first order for your zone, not the last.' },
              ].map(({ label, detail }) => (
                <div key={label} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-600">
            Plan last updated: {new Date(plan.savedAt).toLocaleString()}. Re-run after moving or when shelter information changes.
          </p>
        </>
      )}

      {/* Empty state */}
      {status === 'idle' && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-8 text-center">
          <Home className="mx-auto mb-3 h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-400">Enter your address above to generate your personal emergency plan.</p>
          <p className="mt-1 text-xs text-slate-600">Takes about 10 seconds. Results are saved on your device.</p>
        </div>
      )}
    </div>
  );
}
