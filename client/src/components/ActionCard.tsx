import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, ShieldAlert, Siren } from 'lucide-react';

interface Config {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  color: string;
  bg: string;
  border: string;
  actions: string[];
}

const CONFIGS: Record<string, Config> = {
  monitoring: {
    icon: CheckCircle2,
    title: 'All Clear — Tampa Bay is calm',
    subtitle: 'No active warnings or watches right now. Use this time to review your emergency plan.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/6',
    border: 'border-emerald-500/20',
    actions: [
      'Know your evacuation zone — check hillsboroughcounty.org or pinellascounty.org',
      'Keep a 72-hour kit ready: water, food, medications, and copies of important documents',
      'Save BayShield to your phone\'s home screen for one-tap access during emergencies',
      'Sign up for free county emergency alerts at your county\'s official website',
    ],
  },
  advisory: {
    icon: AlertTriangle,
    title: 'Conditions Developing — Stay Informed',
    subtitle: 'Weather or storm conditions are evolving. No action required yet, but be ready to move quickly.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/6',
    border: 'border-blue-500/20',
    actions: [
      'Check BayShield and local news every few hours for updates',
      'Review your My Plan — confirm your evacuation route and shelter destination',
      'Top off your gas tank now — lines form quickly when warnings are issued',
      'Charge your phone, backup battery, and any essential devices',
      'Check your emergency kit and replace anything that is expired or low',
    ],
  },
  warning: {
    icon: ShieldAlert,
    title: 'Prepare to Act — Conditions Are Dangerous',
    subtitle: 'Significant threat developing. Prepare to leave now — conditions change fast.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/6',
    border: 'border-amber-500/20',
    actions: [
      'Fill your gas tank immediately — stations will run out quickly',
      'Get cash from an ATM now — card machines fail during power outages',
      'Pack essentials: photo ID, insurance cards, medications, phone charger, water',
      'Move outdoor furniture, grills, and loose items indoors',
      'Confirm your shelter destination using the Shelters tab',
      'Let a friend or family member outside the area know your plan and route',
      'If you have pets, identify a pet-friendly shelter or hotel right now',
    ],
  },
  critical: {
    icon: Siren,
    title: 'Evacuate If Your Zone Is Ordered',
    subtitle: 'Life-safety situation. If your evacuation zone has been ordered — leave immediately, do not wait.',
    color: 'text-red-400',
    bg: 'bg-red-500/6',
    border: 'border-red-500/20',
    actions: [
      'Check if YOUR zone is under an order — use the Map tab or county website',
      'If in Zone A or B: LEAVE NOW. Waiting until the last minute costs lives',
      'Take only what you can carry in 15 minutes: documents, meds, water, phone',
      'Tell someone your exact destination and route before you leave',
      'NEVER drive through flooded roads — "Turn Around, Don\'t Drown"',
      'If you cannot evacuate: interior room, lowest floor, no windows',
      'Keep this page open and check for updates every 30 minutes',
    ],
  },
};

export default function ActionCard({ threatLevel }: { threatLevel: string }) {
  const cfg = CONFIGS[threatLevel] ?? CONFIGS.monitoring;
  const Icon = cfg.icon;

  return (
    <div className={cn('rounded-xl border p-4', cfg.bg, cfg.border)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', cfg.color)} />
        <div className="min-w-0 flex-1">
          <h2 className={cn('text-sm font-semibold', cfg.color)}>{cfg.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{cfg.subtitle}</p>
          <ol className="mt-3 space-y-1.5">
            {cfg.actions.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                <span className={cn('mt-0.5 flex-shrink-0 font-mono text-[10px] font-bold tabular-nums', cfg.color)}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{action}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
