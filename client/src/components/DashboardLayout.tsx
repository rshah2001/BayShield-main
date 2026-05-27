import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useSimulation } from '@/contexts/SimulationContext';
import LiveSyncBadge from '@/components/LiveSyncBadge';
import LiveTicker from '@/components/LiveTicker';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import {
  LayoutDashboard,
  Building2,
  Map,
  Package,
  CloudSun,
  Shield,
  ChevronLeft,
  Menu,
  X,
  Home,
  Bell,
  BellOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import FloatingChat from '@/components/FloatingChat';

const NAV_ITEMS = [
  { path: '/dashboard',      label: 'Situation Overview', icon: LayoutDashboard },
  { path: '/forecast',       label: 'Weather Forecast',   icon: CloudSun },
  { path: '/map',            label: 'Map & Evacuation',   icon: Map },
  { path: '/resources',      label: 'Shelters & Supplies',icon: Package },
  { path: '/infrastructure', label: 'Infrastructure Risk',icon: Building2 },
  { path: '/my-plan',        label: 'My Emergency Plan',  icon: Home },
];

const THREAT_STYLES: Record<string, { label: string; dotClass: string; textClass: string; bgClass: string }> = {
  monitoring: { label: 'MONITORING', dotClass: 'bg-slate-400', textClass: 'text-slate-400', bgClass: 'bg-slate-400/10 border-slate-400/20' },
  advisory: { label: 'ADVISORY', dotClass: 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]', textClass: 'text-blue-400', bgClass: 'bg-blue-400/10 border-blue-400/20' },
  warning: { label: 'WARNING', dotClass: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]', textClass: 'text-amber-400', bgClass: 'bg-amber-400/10 border-amber-400/20' },
  critical: { label: 'CRITICAL', dotClass: 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]', textClass: 'text-red-400', bgClass: 'bg-red-400/10 border-red-400/20' },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const {
    threatLevel,
    agents,
    liveWeather,
    lastLivePoll,
    nextLivePoll,
  } = useSimulation();
  const threat = THREAT_STYLES[threatLevel] ?? THREAT_STYLES.monitoring;
  const { permission, requestPermission } = usePushNotifications(threatLevel);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location]);

  const sidebarContent = (
    <>
      <div className="border-b border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] px-4 py-4">
        <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/20">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight text-foreground">BayShield</div>
          <div className="font-mono text-[10px] text-muted-foreground">v3.0 · Tampa Bay</div>
        </div>
        </div>
      </div>

      <div className={cn('mx-3 mt-3 rounded-lg border px-3 py-2', threat.bgClass)}>
        <div className="flex items-center gap-2">
          <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', threat.dotClass, threatLevel !== 'monitoring' && 'animate-pulse-live')} />
          <span className={cn('font-mono text-[10px] font-semibold tracking-widest', threat.textClass)}>
            {threat.label}
          </span>
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          {threatLevel === 'monitoring' ? 'All clear — no active threats' :
           threatLevel === 'advisory' ? 'Conditions developing — stay informed' :
           threatLevel === 'warning' ? 'Action may be required soon' :
           'Immediate action required'}
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const active = location === path;
          return (
            <Link key={path} href={path}>
              <div
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-150',
                  active
                    ? 'border border-primary/24 bg-[linear-gradient(180deg,rgba(96,165,250,0.2),rgba(56,189,248,0.08))] font-medium text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'border border-transparent text-muted-foreground hover:border-white/8 hover:bg-white/[0.05] hover:text-foreground'
                )}
              >
                <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-primary' : '')} />
                <span className="truncate">{label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2">
          <div className={cn(
            'h-1.5 w-1.5 rounded-full',
            agents.some(a => a.status === 'active' || a.status === 'processing')
              ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)] animate-pulse-live'
              : 'bg-slate-600'
          )} />
          <span className="text-[10px] text-muted-foreground">
            {agents.some(a => a.status === 'active' || a.status === 'processing')
              ? 'AI analysis running'
              : 'AI analysis ready'}
          </span>
        </div>
      </div>

      <div className="space-y-2 border-t border-white/[0.06] px-3 pb-4 pt-3">
        <div className="px-0.5">
          <LiveSyncBadge
            lastPoll={lastLivePoll}
            nextPoll={nextLivePoll}
            isLoading={liveWeather?.isLoading ?? false}
            variant="compact"
          />
        </div>

        {/* Push notification toggle */}
        {typeof Notification !== 'undefined' && (
          <button
            onClick={permission === 'default' ? requestPermission : undefined}
            disabled={permission === 'denied'}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors',
              permission === 'granted'
                ? 'border-emerald-400/20 bg-emerald-400/8 text-emerald-400'
                : permission === 'denied'
                  ? 'border-red-400/15 bg-red-400/6 text-red-400 cursor-not-allowed'
                  : 'border-white/10 bg-white/4 text-slate-400 hover:bg-white/8 hover:text-white'
            )}
          >
            {permission === 'granted' ? (
              <Bell className="h-3 w-3 flex-shrink-0" />
            ) : (
              <BellOff className="h-3 w-3 flex-shrink-0" />
            )}
            {permission === 'granted' ? 'Alerts enabled' : permission === 'denied' ? 'Alerts blocked' : 'Enable threat alerts'}
          </button>
        )}

        <Link href="/">
          <div className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground">
            <ChevronLeft className="h-3 w-3" />
            Back to Landing
          </div>
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-transparent text-foreground lg:h-screen lg:overflow-hidden">
      <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-white/[0.06] bg-[oklch(0.11_0.013_250/0.76)] backdrop-blur-xl lg:flex">
        {sidebarContent}
      </aside>

      {isMobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileNavOpen(false)}>
          <aside
            className="absolute inset-y-0 left-0 flex w-[86vw] max-w-72 flex-col border-r border-white/[0.08] bg-[oklch(0.11_0.013_250/0.9)] backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-end border-b border-white/[0.06] px-4 py-3">
              <button
                onClick={() => setIsMobileNavOpen(false)}
            className="rounded-xl border border-white/[0.1] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)),rgba(10,18,34,0.4)] p-2 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:bg-white/[0.07] hover:text-foreground"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[oklch(0.11_0.013_250/0.52)] px-2 pt-2 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between rounded-[24px] border border-white/[0.1] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)),rgba(10,18,34,0.42)] px-4 py-3 shadow-[0_16px_36px_rgba(2,6,23,0.24),inset_0_1px_0_rgba(255,255,255,0.1)]">
            <button
              onClick={() => setIsMobileNavOpen(true)}
              className="rounded-xl border border-white/[0.1] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02)),rgba(10,18,34,0.38)] p-2 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:bg-white/[0.07] hover:text-foreground"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0 text-center">
              <div className="text-sm font-semibold tracking-tight text-foreground">BayShield</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {threat.label}
              </div>
            </div>
            <div className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[10px] font-mono text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              LIVE
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <LiveTicker />
      </div>
      <FloatingChat />
    </div>
  );
}
