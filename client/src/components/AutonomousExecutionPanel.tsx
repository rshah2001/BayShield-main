import { BellRing, CheckCheck, History, RadioTower } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { cn } from '@/lib/utils';

type Dispatch = {
  id: string;
  actionId: string;
  title: string;
  target: string;
  channel: string;
  status: 'pending' | 'delivered' | 'local_only' | 'acknowledged';
  detail: string;
  lastAttemptAt: Date | null;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
};

type AuditEvent = {
  id: string;
  actionId: string;
  eventType: string;
  actor: string;
  summary: string;
  createdAt: Date;
};

const STATUS_STYLE: Record<Dispatch['status'], string> = {
  pending: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  delivered: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  local_only: 'border-slate-400/20 bg-slate-400/10 text-slate-200',
  acknowledged: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
};

type Props = {
  dispatches: Dispatch[];
  auditLog: AuditEvent[];
  onAcknowledge: (actionId: string, actor: string) => void;
};

export default function AutonomousExecutionPanel({ dispatches, auditLog, onAcknowledge }: Props) {
  const { user } = useAuth();
  const actorName = user?.name || user?.email || 'BayShield Operator';

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr,0.8fr]">
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Autonomous Dispatch</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              BayShield attempts outbound task dispatch for live assigned actions and records whether delivery stayed local or reached the configured notification service.
            </p>
          </div>
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[10px] font-mono text-cyan-200">
            {dispatches.length} dispatches
          </span>
        </div>

        <div className="space-y-3">
          {dispatches.length === 0 ? (
            <div className="rounded-lg border border-border/40 bg-background/30 p-4 text-xs text-muted-foreground">
              No autonomous dispatches have been generated in this cycle.
            </div>
          ) : dispatches.map(dispatch => (
            <div key={dispatch.id} className="rounded-lg border border-border/40 bg-background/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{dispatch.title}</p>
                    <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase', STATUS_STYLE[dispatch.status])}>
                      {dispatch.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{dispatch.detail}</p>
                </div>
                <RadioTower className="h-4 w-4 text-cyan-300" />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-white/8 bg-card/70 p-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Target</p>
                  <p className="mt-1 text-xs font-semibold text-foreground">{dispatch.target}</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-card/70 p-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Channel</p>
                  <p className="mt-1 text-xs font-semibold text-foreground">{dispatch.channel}</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-card/70 p-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Last Attempt</p>
                  <p className="mt-1 text-xs font-semibold text-foreground">
                    {dispatch.lastAttemptAt
                      ? dispatch.lastAttemptAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                      : 'Pending'}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  {dispatch.acknowledgedAt
                    ? `Acknowledged by ${dispatch.acknowledgedBy ?? 'operator'} at ${dispatch.acknowledgedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                    : 'Awaiting operator acknowledgement'}
                </div>
                <button
                  type="button"
                  onClick={() => onAcknowledge(dispatch.actionId, actorName)}
                  disabled={dispatch.status === 'acknowledged'}
                  className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200 transition-colors hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {dispatch.status === 'acknowledged' ? 'Acknowledged' : 'Acknowledge Dispatch'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Audit Trail</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Every workflow change, dispatch attempt, and acknowledgement is recorded here for review.
            </p>
          </div>
          <History className="h-4 w-4 text-violet-300" />
        </div>

        <div className="space-y-2">
          {auditLog.length === 0 ? (
            <div className="rounded-lg border border-border/40 bg-background/30 p-4 text-xs text-muted-foreground">
              No audit events recorded yet.
            </div>
          ) : auditLog.slice(0, 10).map(event => (
            <div key={event.id} className="rounded-lg border border-border/40 bg-background/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-foreground">
                  {event.eventType === 'dispatch_attempt' ? <BellRing className="h-3.5 w-3.5 text-cyan-300" /> : <CheckCheck className="h-3.5 w-3.5 text-emerald-300" />}
                  <span className="font-medium">{event.summary}</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {event.createdAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{event.actor}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
