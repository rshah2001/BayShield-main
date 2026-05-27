// ============================================================
// BAYSHIELD -- LiveSyncBadge
// Shows a live countdown to next NOAA API poll + last-fetched timestamp.
// Renders only in Live mode. Pulses green when actively fetching.
// ============================================================
import { useState, useEffect } from 'react';
import { RefreshCw, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LiveSyncBadgeProps {
  lastPoll: Date | null;
  nextPoll: Date | null;
  isLoading: boolean;
  /** compact = one-liner for sidebar; full = expanded card for dashboard */
  variant?: 'compact' | 'full';
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function LiveSyncBadge({ lastPoll, nextPoll, isLoading, variant = 'full' }: LiveSyncBadgeProps) {
  const [countdown, setCountdown] = useState<string>('--:--');
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const tick = () => {
      if (!nextPoll || !lastPoll) {
        setCountdown('--:--');
        setProgress(100);
        return;
      }
      const now = Date.now();
      const remaining = nextPoll.getTime() - now;
      const total = nextPoll.getTime() - lastPoll.getTime();
      setCountdown(formatCountdown(remaining));
      setProgress(Math.max(0, Math.min(100, (remaining / total) * 100)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastPoll, nextPoll]);

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
        <span className={cn(
          'w-1.5 h-1.5 rounded-full bg-emerald-400',
          isLoading ? 'animate-pulse' : ''
        )} />
        <span className="text-[10px] font-mono text-emerald-400">
          {isLoading ? 'Syncing...' : `Next sync ${countdown}`}
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border p-3 space-y-2"
      style={{
        background: 'oklch(0.13 0.015 160 / 0.6)',
        borderColor: 'oklch(0.45 0.15 160 / 0.3)',
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Wifi className="w-3 h-3 text-emerald-400" />
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">NOAA Live Feed</span>
        </div>
        <div className={cn(
          'flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded',
          isLoading
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        )}>
          <RefreshCw className={cn('w-2.5 h-2.5', isLoading && 'animate-spin')} />
          {isLoading ? 'Fetching...' : 'Live'}
        </div>
      </div>

      {/* Last fetched */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-500">Last sync</span>
        <span className="font-mono text-slate-300">
          {lastPoll ? formatTime(lastPoll) : 'Pending...'}
        </span>
      </div>

      {/* Next fetch countdown */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-500">Next sync in</span>
        <span className={cn(
          'font-mono font-semibold tabular-nums',
          isLoading ? 'text-amber-400' : 'text-emerald-400'
        )}>
          {isLoading ? 'Now' : countdown}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/8 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${isLoading ? 100 : progress}%`,
            background: isLoading
              ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
              : 'linear-gradient(90deg, #10b981, #34d399)',
          }}
        />
      </div>

      {/* Data sources */}
      <div className="pt-1 border-t border-white/[0.06] space-y-1">
        {[
          { label: 'KTPA Observations', status: 'live' },
          { label: 'NWS FL Alerts',     status: 'live' },
          { label: 'NHC Atlantic RSS',  status: 'live' },
          { label: 'TBW Forecast',      status: 'live' },
        ].map(({ label, status }) => (
          <div key={label} className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500">{label}</span>
            <span className="text-emerald-400 font-mono">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
