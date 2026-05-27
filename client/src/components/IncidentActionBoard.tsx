import { CheckCircle2, ChevronRight, ClipboardList, Clock3, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IncidentAction, IncidentActionStatus } from '@/lib/stormData';

const STATUS_STYLES: Record<IncidentActionStatus, { badge: string; border: string; button: string; label: string }> = {
  new: {
    badge: 'text-sky-200 bg-sky-400/10 border-sky-400/20',
    border: 'border-sky-400/20',
    button: 'bg-sky-400/10 text-sky-200 border-sky-400/20 hover:bg-sky-400/15',
    label: 'New',
  },
  reviewed: {
    badge: 'text-amber-200 bg-amber-400/10 border-amber-400/20',
    border: 'border-amber-400/20',
    button: 'bg-amber-400/10 text-amber-200 border-amber-400/20 hover:bg-amber-400/15',
    label: 'Reviewed',
  },
  assigned: {
    badge: 'text-violet-200 bg-violet-400/10 border-violet-400/20',
    border: 'border-violet-400/20',
    button: 'bg-violet-400/10 text-violet-200 border-violet-400/20 hover:bg-violet-400/15',
    label: 'Assigned',
  },
  completed: {
    badge: 'text-emerald-200 bg-emerald-400/10 border-emerald-400/20',
    border: 'border-emerald-400/20',
    button: 'bg-emerald-400/10 text-emerald-200 border-emerald-400/20 hover:bg-emerald-400/15',
    label: 'Completed',
  },
};

const STATUS_FLOW: IncidentActionStatus[] = ['new', 'reviewed', 'assigned', 'completed'];

function getNextStatus(status: IncidentActionStatus) {
  const index = STATUS_FLOW.indexOf(status);
  return STATUS_FLOW[Math.min(index + 1, STATUS_FLOW.length - 1)];
}

function getNextLabel(status: IncidentActionStatus) {
  if (status === 'new') return 'Mark reviewed';
  if (status === 'reviewed') return 'Assign owner';
  if (status === 'assigned') return 'Mark complete';
  return 'Completed';
}

type Props = {
  incidentActions: IncidentAction[];
  onAdvanceAction: (actionId: string) => void;
  onSetOwner: (actionId: string, owner: string) => void;
};

export default function IncidentActionBoard({ incidentActions, onAdvanceAction, onSetOwner }: Props) {
  const completedCount = incidentActions.filter(action => action.status === 'completed').length;
  const assignedCount = incidentActions.filter(action => action.status === 'assigned').length;
  const pendingCount = incidentActions.length - completedCount;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Incident Workflow</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            BayShield is auto-routing live recommendations into owned operational tasks. Operator overrides remain available through owner reassignment.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase">
          <span className="rounded-full border border-white/8 bg-white/5 px-2 py-1 text-slate-300">{pendingCount} open</span>
          <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-violet-200">{assignedCount} assigned</span>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-emerald-200">{completedCount} completed</span>
        </div>
      </div>

      {incidentActions.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">No incident tasks are active for the current run.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
          {incidentActions.map(action => {
            const statusStyle = STATUS_STYLES[action.status];
            const nextStatus = getNextStatus(action.status);

            return (
              <div key={action.id} className={cn('rounded-xl border bg-card p-4', statusStyle.border)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{action.title}</h3>
                      <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase', statusStyle.badge)}>
                        {statusStyle.label}
                      </span>
                      <span className={cn(
                        'rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase',
                        action.managedBy === 'operator'
                          ? 'border-violet-400/20 bg-violet-400/10 text-violet-200'
                          : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
                      )}>
                        {action.managedBy === 'operator' ? 'Operator override' : 'Autonomous'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{action.detail}</p>
                  </div>
                  <div className="text-right text-[11px]">
                    <p className="font-mono text-muted-foreground">{action.source}</p>
                    <p className="mt-0.5 font-semibold text-foreground">{action.populationCovered.toLocaleString()} impacted</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/8 bg-background/40 p-2">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      <Clock3 className="h-3 w-3" />
                      Due
                    </div>
                    <p className="mt-1 text-xs font-semibold text-foreground">{action.dueLabel}</p>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-background/40 p-2">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      <UserRound className="h-3 w-3" />
                      Owner
                    </div>
                    <p className="mt-1 text-xs font-semibold text-foreground">{action.owner ?? 'Unassigned'}</p>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-background/40 p-2">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3" />
                      Updated
                    </div>
                    <p className="mt-1 text-xs font-semibold text-foreground">
                      {action.updatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {action.zonesAffected.slice(0, 6).map(zone => (
                    <span key={zone} className="rounded border border-border/30 bg-background/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {zone}
                    </span>
                  ))}
                </div>

                <div className="mt-3 space-y-1.5">
                  {action.recommendations.slice(0, 3).map(rec => (
                    <div key={rec} className="flex items-start gap-2 text-[11px] text-foreground/85">
                      <ChevronRight className="mt-0.5 h-3 w-3 flex-shrink-0 text-cyan-300" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <select
                    value={action.owner ?? ''}
                    onChange={event => onSetOwner(action.id, event.target.value)}
                    className="rounded-lg border border-white/8 bg-background/60 px-3 py-2 text-xs text-foreground outline-none"
                  >
                    <option value="">Unassigned owner</option>
                    <option value="Command Desk">Command Desk</option>
                    <option value="Alert Desk">Alert Desk</option>
                    <option value="Transportation Lead">Transportation Lead</option>
                    <option value="Logistics Desk">Logistics Desk</option>
                    <option value="Medical Ops">Medical Ops</option>
                    <option value="Field Ops">Field Ops</option>
                  </select>
                  <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
                    {action.status === 'completed'
                      ? 'BayShield closed this task automatically based on current live conditions.'
                      : 'BayShield is progressing this task automatically from the live pipeline.'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
