import { Activity, Ambulance, Building2, HeartPulse, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThreatLevel } from '@/lib/stormData';
import { buildMedicalOperations } from '@/lib/medicalOperations';

const STATUS_STYLES = {
  accessible: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
  monitor: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
  'disruption-risk': 'text-red-300 bg-red-400/10 border-red-400/20',
} as const;

export default function MedicalOperationsPanel({
  threatLevel,
  infrastructureSignals,
}: {
  threatLevel: ThreatLevel;
  infrastructureSignals: {
    roadClosuresTotal: number;
    bridgeClosuresTotal: number;
    dukeOutages: Array<{
      county: string;
      customersOut: number;
      customersServed: number;
      percentOut: number;
      etr: string | null;
    }>;
  } | null;
}) {
  const facilities = buildMedicalOperations({
    threatLevel,
    roadClosuresTotal: infrastructureSignals?.roadClosuresTotal ?? 0,
    bridgeClosuresTotal: infrastructureSignals?.bridgeClosuresTotal ?? 0,
    dukeOutages: infrastructureSignals?.dukeOutages ?? [],
  });

  const disruptionRisk = facilities.filter(facility => facility.status === 'disruption-risk').length;
  const monitorCount = facilities.filter(facility => facility.status === 'monitor').length;

  return (
    <div className="rounded-2xl border border-white/8 bg-card/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-rose-200/70">Medical Operations</p>
          <h2 className="mt-1 flex items-center gap-2 text-base font-semibold text-white">
            <HeartPulse className="h-4 w-4 text-rose-300" />
            Hospital Access Risk
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Official facility inventory with live access risk from FL511 closures, bridge disruptions, and county outage pressure.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/8 bg-background/35 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Facilities</p>
            <p className="mt-1 text-sm font-semibold text-white">{facilities.length}</p>
          </div>
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-red-200/70">Disruption risk</p>
            <p className="mt-1 text-sm font-semibold text-white">{disruptionRisk}</p>
          </div>
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-amber-200/70">Monitor</p>
            <p className="mt-1 text-sm font-semibold text-white">{monitorCount}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        {facilities.slice(0, 6).map(facility => (
          <div key={facility.id} className="rounded-xl border border-white/8 bg-background/35 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-slate-300" />
                  <p className="text-sm font-medium text-white">{facility.name}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {facility.city}, {facility.county} • {facility.type}
                </p>
              </div>
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase', STATUS_STYLES[facility.status])}>
                {facility.status === 'disruption-risk' ? 'Disruption risk' : facility.status === 'monitor' ? 'Monitor' : 'Accessible'}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-white/8 bg-background/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Access risk</p>
                <p className="mt-1 font-mono text-sm text-white">{facility.accessRisk}</p>
              </div>
              <div className="rounded-lg border border-white/8 bg-background/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Transport</p>
                <p className="mt-1 font-mono text-sm text-white">{facility.transportPressure}</p>
              </div>
              <div className="rounded-lg border border-white/8 bg-background/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Outage</p>
                <p className="mt-1 font-mono text-sm text-white">{facility.outagePressure}</p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{facility.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-200" />
            <p className="text-sm font-medium text-white">Operational Truth</p>
          </div>
          <p className="mt-2 text-xs text-slate-300">
            Facility locations are fixed references. Access pressure is live. Public hospital-by-hospital internal operating status is not broadly available.
          </p>
        </div>
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3">
          <div className="flex items-center gap-2">
            <Ambulance className="h-4 w-4 text-amber-200" />
            <p className="text-sm font-medium text-white">EMS Impact</p>
          </div>
          <p className="mt-2 text-xs text-slate-300">
            Bridge and closure counts increase ambulance diversion and transfer risk first in Hillsborough and Pinellas corridors.
          </p>
        </div>
        <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-200" />
            <p className="text-sm font-medium text-white">What To Watch</p>
          </div>
          <p className="mt-2 text-xs text-slate-300">
            Rising closure counts, bridge disruptions, and county outages should trigger hospital access reviews before patient flow starts failing.
          </p>
        </div>
      </div>
    </div>
  );
}
