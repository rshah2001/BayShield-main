import { desc, eq } from "drizzle-orm";
import { incidentActionState } from "../../drizzle/schema";
import { getDb } from "../db";
import { recordIncidentAudit } from "./incidentExecution";

export type IncidentActionStatus = "new" | "reviewed" | "assigned" | "completed";

export type SharedIncidentAction = {
  id: string;
  planId: string;
  title: string;
  detail: string;
  severity: string;
  status: IncidentActionStatus;
  owner: string | null;
  managedBy: "system" | "operator";
  createdAt: string;
  updatedAt: string;
  dueLabel: string;
  zonesAffected: string[];
  populationCovered: number;
  source: string;
  recommendations: string[];
};

type WorkflowRecord = {
  status: IncidentActionStatus;
  owner: string | null;
  updatedAt: string;
};

const workflowState = new Map<string, WorkflowRecord>();

function actionKey(mode: "live" | "simulation", planId: string) {
  return `${mode}:${planId}`;
}

function inferOwner(title: string, detail: string, recommendations: string[]) {
  const haystack = `${title} ${detail} ${recommendations.join(" ")}`.toLowerCase();
  if (haystack.includes("shelter") || haystack.includes("resource") || haystack.includes("supply")) return "Logistics Desk";
  if (haystack.includes("route") || haystack.includes("evac") || haystack.includes("bridge") || haystack.includes("transport")) return "Transportation Lead";
  if (haystack.includes("hospital") || haystack.includes("medical") || haystack.includes("special-needs")) return "Medical Ops";
  if (haystack.includes("alert") || haystack.includes("communication") || haystack.includes("public")) return "Alert Desk";
  return null;
}

function inferDueLabel(severity: string, populationCovered: number) {
  if (severity === "critical" || populationCovered >= 25000) return "Immediate";
  if (severity === "warning" || populationCovered >= 10000) return "Within 30 min";
  if (severity === "advisory") return "Within 60 min";
  return "Monitor this cycle";
}

function inferAutonomousStatus(input: {
  severity: string;
  title: string;
  detail: string;
  owner: string | null;
  populationCovered: number;
}): IncidentActionStatus {
  const haystack = `${input.title} ${input.detail}`.toLowerCase();
  if (haystack.includes("all clear") || haystack.includes("no evacuation required")) {
    return "completed";
  }
  if (input.severity === "critical" || input.populationCovered >= 10000) {
    return input.owner ? "assigned" : "reviewed";
  }
  if (input.severity === "warning" || input.severity === "advisory") {
    return input.owner ? "assigned" : "reviewed";
  }
  return "reviewed";
}

function deriveFallbackAction(result: Record<string, unknown>, mode: "live" | "simulation"): SharedIncidentAction[] {
  const alerts = Array.isArray(result.nws_alerts) ? result.nws_alerts as Array<Record<string, unknown>> : [];
  if (!alerts.length) return [];

  const severity = String(result.threat_level ?? "monitoring").toLowerCase();
  const id = actionKey(mode, "validate-live-alerts");
  const record = workflowState.get(id);
  const now = String(result.completed_at ?? new Date().toISOString());

  return [{
    id,
    planId: "validate-live-alerts",
    title: "Validate live alerts and issue operator tasking",
    detail: `${alerts.length} active alert${alerts.length === 1 ? "" : "s"} are present but no explicit action plan was published in the latest cycle. Review alert geography, shelter posture, and routing before escalation.`,
    severity,
    status: record?.status ?? "assigned",
    owner: record?.owner ?? "Command Desk",
    managedBy: record ? "operator" : "system",
    createdAt: now,
    updatedAt: record?.updatedAt ?? now,
    dueLabel: severity === "critical" ? "Immediate" : "Within 30 min",
    zonesAffected: alerts.slice(0, 4).map(alert => String(alert.area_desc ?? "Tampa Bay")),
    populationCovered: Number(result.total_at_risk ?? 0),
    source: "Alert Commander",
    recommendations: [
      "Review the live alert footprint against Tampa Bay operating zones",
      "Assign protective actions to logistics, transport, and public information leads",
      "Confirm shelter and route posture before the next live update",
    ],
  }];
}

export function deriveIncidentActionsFromResult(result: Record<string, unknown>, mode: "live" | "simulation" = "live"): SharedIncidentAction[] {
  const plans = Array.isArray(result.action_plans) ? result.action_plans as Array<Record<string, unknown>> : [];
  if (!plans.length) return deriveFallbackAction(result, mode);

  return plans.map((plan) => {
    const planId = String(plan.id ?? "plan");
    const id = actionKey(mode, planId);
    const detail = String(plan.rationale ?? plan.action ?? "");
    const recommendations = [
      String(plan.action ?? "No action provided"),
      `Shelter: ${String(plan.shelter ?? "TBD")}`,
      `Route: ${String(plan.route ?? "TBD")}`,
    ];
    const severity = String(result.threat_level ?? "monitoring").toLowerCase();
    const populationCovered = Number(plan.population ?? 0);
    const persisted = workflowState.get(id);
    const createdAt = String(result.completed_at ?? new Date().toISOString());
    const inferredOwner = inferOwner(String(plan.title ?? ""), detail, recommendations);
    const owner = persisted?.owner ?? inferredOwner;
    const status = persisted?.status ?? inferAutonomousStatus({
      severity,
      title: String(plan.title ?? ""),
      detail,
      owner,
      populationCovered,
    });

    return {
      id,
      planId,
      title: String(plan.title ?? "Untitled Plan"),
      detail,
      severity,
      status,
      owner,
      managedBy: persisted ? "operator" : "system",
      createdAt,
      updatedAt: persisted?.updatedAt ?? createdAt,
      dueLabel: inferDueLabel(severity, populationCovered),
      zonesAffected: [],
      populationCovered,
      source: "Alert Commander",
      recommendations,
    };
  });
}

export async function hydrateIncidentWorkflowFromDb(mode: "live" | "simulation" = "live") {
  const db = await getDb();
  if (!db) return;

  const rows = await db.select().from(incidentActionState)
    .where(eq(incidentActionState.mode, mode))
    .orderBy(desc(incidentActionState.updatedAt));

  rows.forEach((row) => {
    workflowState.set(row.actionKey, {
      status: row.status,
      owner: row.owner ?? null,
      updatedAt: row.updatedAt.toISOString(),
    });
  });
}

export async function updateIncidentWorkflowState(input: {
  actionId: string;
  mode?: "live" | "simulation";
  planId: string;
  title: string;
  status?: IncidentActionStatus;
  owner?: string | null;
  source?: string;
}) {
  const mode = input.mode ?? "live";
  const previous = workflowState.get(input.actionId);
  const next: WorkflowRecord = {
    status: input.status ?? previous?.status ?? "new",
    owner: input.owner !== undefined ? input.owner : previous?.owner ?? null,
    updatedAt: new Date().toISOString(),
  };

  workflowState.set(input.actionId, next);

  const db = await getDb();
  if (!db) return next;

  await db.insert(incidentActionState).values({
    actionKey: input.actionId,
    mode,
    planId: input.planId,
    title: input.title,
    status: next.status,
    owner: next.owner,
    source: input.source ?? "Alert Commander",
    updatedAt: new Date(next.updatedAt),
  }).onDuplicateKeyUpdate({
    set: {
      status: next.status,
      owner: next.owner,
      updatedAt: new Date(next.updatedAt),
      title: input.title,
      source: input.source ?? "Alert Commander",
    },
  });

  await recordIncidentAudit({
    actionId: input.actionId,
    mode,
    eventType: "workflow_update",
    actor: input.owner ? input.owner : "BayShield Operator",
    summary: `Workflow updated to ${next.status}${next.owner ? ` for ${next.owner}` : ""}`,
  });

  return next;
}
