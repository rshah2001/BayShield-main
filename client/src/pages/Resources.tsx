import { useState } from 'react';
import { useSimulation } from '@/contexts/SimulationContext';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Building2, Package, Heart, Route, Users } from 'lucide-react';

const TYPE_META: Record<string, { label: string; icon: typeof Building2; text: string; bg: string; border: string }> = {
  shelter:          { label: 'Shelters',          icon: Building2, text: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/20' },
  supply_depot:     { label: 'Supply Depots',     icon: Package,   text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  medical:          { label: 'Medical',           icon: Heart,     text: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/20' },
  evacuation_route: { label: 'Evacuation Routes', icon: Route,     text: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/20' },
};

const STATUS_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  available: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  filling:   { text: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/20' },
  full:      { text: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/20' },
  closed:    { text: 'text-slate-400',   bg: 'bg-slate-400/10',   border: 'border-slate-400/20' },
  open:      { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  active:    { text: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/20' },
  standby:   { text: 'text-slate-400',   bg: 'bg-slate-400/10',   border: 'border-slate-400/20' },
};

const ZONE_STATUS: Record<string, { text: string; bg: string; border: string }> = {
  evacuate: { text: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/20' },
  warning:  { text: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/20' },
  watch:    { text: 'text-sky-400',     bg: 'bg-sky-400/10',     border: 'border-sky-400/20' },
  safe:     { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
};

export default function Resources() {
  const { isRunning, weather, shelters: liveShelters, shelterFeedSource, vulnerabilityZones } = useSimulation();
  const [filterType, setFilterType] = useState<string>('all');

  const { data: historicalOverview } = trpc.bayshield.historicalOverview.useQuery(undefined, {
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const { data: similarStorms } = trpc.bayshield.similarStorms.useQuery({
    category: weather.category || null,
    maxWindKt: weather.windSpeed || null,
    pressure: weather.pressure || null,
    states: 'FL',
    limit: 5,
  }, {
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const shelters = liveShelters;
  const filteredResources = filterType === 'all' ? shelters : shelters.filter(r => r.type === filterType);
  const totalCap = shelters.reduce((s, r) => s + r.capacity, 0);
  const totalOcc = shelters.reduce((s, r) => s + r.currentOccupancy, 0);
  const shelterPct = totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0;
  const remainingShelterSpace = Math.max(0, totalCap - totalOcc);
  const constrainedShelters = shelters.filter(shelter => shelter.capacity > 0 && (shelter.currentOccupancy / shelter.capacity) >= 0.75).length;
  const shelterNotice = shelterFeedSource === 'live_public'
    ? {
        title: 'Shelter data is live',
        body: 'BayShield is using the public Florida Disaster open-shelter feed. Capacity and occupancy reflect currently open shelters published by the state dashboard for Tampa Bay counties.',
        tone: 'emerald',
      }
    : {
        title: 'Shelter occupancy is fallback-estimated when no public shelters are open',
        body: 'Florida publishes a public feed for currently open shelters. When that feed has no open Tampa Bay shelters, BayShield falls back to labeled readiness estimates so the dashboard still shows local standby capacity.',
        tone: 'amber',
      };
  const showHistoricalAnalogs = weather.category > 0;

  return (
    <div className="min-h-full space-y-5 p-4 sm:p-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Shelters &amp; Supplies</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Open shelters, supply depots, medical facilities, and evacuation routes for Tampa Bay</p>
        </div>
        {isRunning && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse-live" />Live Data
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Remaining Shelter Space', value: remainingShelterSpace.toLocaleString(), icon: Building2, text: 'text-blue-400', bg: 'bg-blue-400/10', sub: totalCap > 0 ? `${shelterPct}% occupied across live shelters` : 'No open public shelters' },
          { label: 'Shelters Under Pressure', value: constrainedShelters, icon: Users, text: constrainedShelters > 0 ? 'text-red-400' : 'text-emerald-400', bg: constrainedShelters > 0 ? 'bg-red-400/10' : 'bg-emerald-400/10', sub: `${shelters.length} shelters in current readiness view` },
          { label: 'Medical Facilities', value: 'Standby', icon: Heart, text: 'text-red-400', bg: 'bg-red-400/10', sub: 'Hospitals reported when state activates emergency facilities' },
          { label: 'Evacuation Routes', value: 'Clear', icon: Route, text: 'text-amber-400', bg: 'bg-amber-400/10', sub: 'FL511 road feed — check Infrastructure page for closures' },
        ].map(({ label, value, icon: Icon, text, bg, sub }) => (
          <div key={label} className="bg-card border border-border/50 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                <p className={cn('text-2xl font-semibold', text)}>{value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
              </div>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', bg)}>
                <Icon className={cn('w-4 h-4', text)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {constrainedShelters > 0 && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 flex items-start gap-2.5">
          <span className="text-amber-400 mt-0.5 flex-shrink-0">⚠</span>
          <p className="text-[11px] text-amber-100/90 leading-relaxed">
            <strong className="font-semibold">{constrainedShelters} shelter{constrainedShelters === 1 ? '' : 's'} above 75% capacity.</strong>
            {' '}Consider directing residents to shelters with more available space.
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterType('all')}
          className={cn('px-3 py-1.5 rounded-lg text-xs font-mono transition-colors border',
            filterType === 'all' ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground border-border/30 hover:text-foreground'
          )}
        >All ({shelters.length})</button>
        {Object.entries(TYPE_META).map(([type, meta]) => {
          const count = shelters.filter(r => r.type === type).length;
          return (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? 'all' : type)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-mono transition-colors border flex items-center gap-1.5',
                filterType === type ? cn(meta.bg, meta.text, meta.border) : 'text-muted-foreground border-border/30 hover:text-foreground'
              )}
            >
              <meta.icon className="w-3 h-3" />
              {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Shelter notice */}
      {(filterType === 'all' || filterType === 'shelter') && (
        <div className={cn(
          'flex items-start gap-2.5 rounded-xl px-4 py-3 border',
          shelterNotice.tone === 'emerald'
            ? 'bg-emerald-400/[0.06] border-emerald-400/15'
            : 'bg-amber-400/[0.06] border-amber-400/15'
        )}>
          <span className={cn(
            'text-sm flex-shrink-0 mt-0.5',
            shelterNotice.tone === 'emerald' ? 'text-emerald-400' : 'text-amber-400'
          )}>⚠</span>
          <div>
            <p className={cn(
              'text-xs font-medium',
              shelterNotice.tone === 'emerald' ? 'text-emerald-400/90' : 'text-amber-400/90'
            )}>{shelterNotice.title}</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-relaxed">
              {shelterNotice.body}
            </p>
          </div>
        </div>
      )}

      {historicalOverview && showHistoricalAnalogs && (
        <div className="bg-card border border-border/50 rounded-xl p-4">
          <div className="flex flex-col gap-1 mb-4">
            <h2 className="text-sm font-medium">Historical Storm Analogs</h2>
            <p className="text-[11px] text-muted-foreground">
              Past storms with similar intensity — useful for understanding what to expect.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Historical Storms', value: historicalOverview.totalStorms.toLocaleString(), sub: `${historicalOverview.namedStorms} named storms` },
              { label: 'Florida Impacts', value: historicalOverview.floridaStorms.toLocaleString(), sub: 'storms affecting FL' },
              { label: 'Major Storms', value: historicalOverview.majorStorms.toLocaleString(), sub: 'Category 3+' },
              { label: 'Average Max Wind', value: historicalOverview.averageMaxWindKt ? `${historicalOverview.averageMaxWindKt} kt` : '—', sub: historicalOverview.averagePressureMb ? `${historicalOverview.averagePressureMb} mb avg pressure` : 'pressure unavailable' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="rounded-xl border border-border/40 bg-background/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 mt-4 xl:grid-cols-2">
            <div className="rounded-xl border border-border/40 bg-background/40 p-3">
              <h3 className="text-xs font-medium mb-2">Strongest Historical Storms</h3>
              <div className="space-y-2">
                {historicalOverview.strongestStorms.map((storm, index) => (
                  <div key={`${storm.year}-${storm.normalizedName}-${index}`} className="flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{storm.name ?? 'Unnamed storm'} ({storm.year})</p>
                      <p className="text-muted-foreground truncate">{storm.states}</p>
                    </div>
                    <div className="text-right font-mono text-muted-foreground">
                      <p>{storm.maxWindKt ?? '—'} kt</p>
                      <p>Cat {storm.category ?? '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-background/40 p-3">
              <h3 className="text-xs font-medium mb-2">Closest Historical Matches To Current Scenario</h3>
              <div className="space-y-2">
                {(similarStorms ?? []).length > 0 ? similarStorms!.map((storm, index) => (
                  <div key={`${storm.year}-${storm.normalizedName}-${index}`} className="flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{storm.name ?? 'Unnamed storm'} ({storm.year})</p>
                      <p className="text-muted-foreground truncate">{storm.states}</p>
                    </div>
                    <div className="text-right font-mono text-muted-foreground">
                      <p>{storm.maxWindKt ?? '—'} kt</p>
                      <p>{storm.pressure ?? '—'} mb</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-[11px] text-muted-foreground">No comparable storms available yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Resource cards */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {filteredResources.map(res => {
          const meta = TYPE_META[res.type];
          const Icon = meta?.icon ?? Package;
          const ss = STATUS_STYLES[res.status] ?? STATUS_STYLES.available;
          const occupancyPct = res.capacity > 0 ? Math.round((res.currentOccupancy / res.capacity) * 100) : 0;

          return (
            <div key={res.id} className="bg-card border border-border/50 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', meta?.bg ?? 'bg-slate-400/10', meta?.border ?? 'border-slate-400/20', 'border')}>
                    <Icon className={cn('w-4 h-4', meta?.text ?? 'text-slate-400')} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold leading-tight">{res.name}</p>
                    <p className={cn('text-[10px] font-mono', meta?.text ?? 'text-slate-400')}>{meta?.label}</p>
                  </div>
                </div>
                <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-mono uppercase flex-shrink-0', ss.text, ss.bg, ss.border)}>
                  {res.status}
                </span>
              </div>

              {res.type !== 'evacuation_route' && res.capacity > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">Capacity</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{res.currentOccupancy.toLocaleString()} / {res.capacity.toLocaleString()}</span>
                  </div>
                  <div className="h-1 bg-border/40 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500',
                        occupancyPct > 80 ? 'bg-red-400' : occupancyPct > 50 ? 'bg-amber-400' : 'bg-emerald-400'
                      )}
                      style={{ width: `${occupancyPct}%` }}
                    />
                  </div>
                  <div className="text-right mt-0.5">
                    <span className={cn('text-[10px] font-mono', occupancyPct > 80 ? 'text-red-400' : 'text-muted-foreground')}>{occupancyPct}%</span>
                  </div>
                </div>
              )}

              {res.supplies && res.supplies.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5">Supplies</p>
                  <div className="flex flex-wrap gap-1">
                    {res.supplies.map(s => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 border border-border/30 text-muted-foreground font-mono">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Vulnerability zones table */}
      <div className="bg-card border border-border/50 rounded-xl p-4">
        <h2 className="text-sm font-medium mb-3">Alert Zones</h2>
        {vulnerabilityZones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active NWS alerts for Tampa Bay right now. This table updates automatically when official alerts are issued.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30">
                  {['Zone', 'Flood Zone', 'Population', 'Event', 'Risk Score', 'Status'].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...vulnerabilityZones].sort((a, b) => b.riskScore - a.riskScore).map(zone => {
                  const zs = ZONE_STATUS[zone.status] ?? ZONE_STATUS.safe;
                  const riskColor = zone.riskScore >= 80 ? '#f87171' : zone.riskScore >= 60 ? '#fbbf24' : '#34d399';
                  return (
                    <tr key={zone.id} className="border-b border-border/20">
                      <td className="py-2 px-2 font-semibold text-foreground">{zone.name}</td>
                      <td className="py-2 px-2 font-mono text-muted-foreground">{zone.floodZone}</td>
                      <td className="py-2 px-2 font-mono text-muted-foreground">{zone.population.toLocaleString()}</td>
                      <td className="py-2 px-2 text-muted-foreground">{zone.event ?? 'N/A'}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1 bg-border/40 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${zone.riskScore}%`, background: riskColor }} />
                          </div>
                          <span className="font-mono" style={{ color: riskColor }}>{zone.riskScore}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-mono uppercase', zs.text, zs.bg, zs.border)}>
                          {zone.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
