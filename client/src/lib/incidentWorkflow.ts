import type {
  ActionPlan,
  Alert,
  IncidentAction,
  IncidentActionStatus,
  ThreatLevel,
} from '@/lib/stormData';

export type IncidentActionRecord = {
  status: IncidentActionStatus;
  owner: string | null;
  updatedAt: string;
};

export function getIncidentActionStorageKey(mode: 'live' | 'simulation') {
  return `bayshield:incident-actions:${mode}`;
}

function inferOwner(plan: ActionPlan): string | null {
  const haystack = `${plan.title} ${plan.summary} ${plan.recommendations.join(' ')}`.toLowerCase();
  if (haystack.includes('shelter') || haystack.includes('resource') || haystack.includes('supply')) {
    return 'Logistics Desk';
  }
  if (haystack.includes('route') || haystack.includes('evac') || haystack.includes('bridge') || haystack.includes('transport')) {
    return 'Transportation Lead';
  }
  if (haystack.includes('hospital') || haystack.includes('medical') || haystack.includes('special-needs')) {
    return 'Medical Ops';
  }
  if (haystack.includes('alert') || haystack.includes('communication') || haystack.includes('public')) {
    return 'Alert Desk';
  }
  return null;
}

function inferDueLabel(severity: ThreatLevel, populationCovered: number) {
  if (severity === 'critical' || populationCovered >= 25000) return 'Immediate';
  if (severity === 'warning' || populationCovered >= 10000) return 'Within 30 min';
  if (severity === 'advisory') return 'Within 60 min';
  return 'Monitor this cycle';
}

export function buildIncidentActions(input: {
  actionPlans: ActionPlan[];
  alerts: Alert[];
  threatLevel: ThreatLevel;
  workflow: Record<string, IncidentActionRecord>;
}) {
  const { actionPlans, alerts, threatLevel, workflow } = input;

  const planActions: IncidentAction[] = actionPlans.map(plan => {
    const workflowState = workflow[plan.id];
    const nowIso = new Date().toISOString();
    return {
      id: plan.id,
      planId: plan.id,
      title: plan.title,
      detail: plan.summary,
      severity: plan.severity,
      status: workflowState?.status ?? 'new',
      owner: workflowState?.owner ?? inferOwner(plan),
      createdAt: plan.createdAt,
      updatedAt: new Date(workflowState?.updatedAt ?? plan.createdAt.toISOString?.() ?? nowIso),
      dueLabel: inferDueLabel(plan.severity, plan.populationCovered),
      zonesAffected: plan.zonesAffected,
      populationCovered: plan.populationCovered,
      source: plan.agentSource,
      recommendations: plan.recommendations,
    };
  });

  if (planActions.length > 0) {
    return planActions;
  }

  if (alerts.length === 0) {
    return [];
  }

  const fallbackId = `incident-alert-review-${threatLevel}`;
  const workflowState = workflow[fallbackId];
  return [
    {
      id: fallbackId,
      planId: fallbackId,
      title: 'Validate live alerts and issue operator tasking',
      detail: `${alerts.length} active alert${alerts.length === 1 ? '' : 's'} are present but no explicit action plan was published in the latest cycle. Review alert geography, shelter posture, and routing before escalation.`,
      severity: threatLevel,
      status: workflowState?.status ?? 'new',
      owner: workflowState?.owner ?? 'Command Desk',
      createdAt: new Date(),
      updatedAt: new Date(workflowState?.updatedAt ?? new Date().toISOString()),
      dueLabel: threatLevel === 'critical' ? 'Immediate' : 'Within 30 min',
      zonesAffected: alerts.slice(0, 4).map(alert => alert.zone),
      populationCovered: alerts.reduce((sum, alert) => sum + (alert.population ?? 0), 0),
      source: 'Alert Commander',
      recommendations: [
        'Review the live alert footprint against Tampa Bay operating zones',
        'Assign protective actions to logistics, transport, and public information leads',
        'Confirm shelter and route posture before the next live update',
      ],
    },
  ];
}
