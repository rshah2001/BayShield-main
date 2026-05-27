import { incidentAuditLog, incidentDispatches } from "../../drizzle/schema";
import { getDb } from "../db";
import { notifyOwner } from "./notification";
import type { SharedIncidentAction } from "./incidentWorkflow";

export type SharedIncidentDispatch = {
  id: string;
  actionId: string;
  title: string;
  target: string;
  channel: string;
  status: "pending" | "delivered" | "local_only" | "acknowledged";
  detail: string;
  lastAttemptAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
};

export type SharedIncidentAuditEvent = {
  id: string;
  actionId: string;
  eventType: string;
  actor: string;
  summary: string;
  createdAt: string;
};

const dispatchState = new Map<string, SharedIncidentDispatch>();
const auditLogState: SharedIncidentAuditEvent[] = [];

function buildDispatchKey(actionId: string) {
  return `dispatch:${actionId}`;
}

function pushAudit(event: SharedIncidentAuditEvent) {
  auditLogState.unshift(event);
  if (auditLogState.length > 200) {
    auditLogState.length = 200;
  }
}

export async function recordIncidentAudit(input: {
  actionId: string;
  mode?: "live" | "simulation";
  eventType: string;
  actor: string;
  summary: string;
}) {
  const event: SharedIncidentAuditEvent = {
    id: `${input.actionId}:${input.eventType}:${Date.now()}`,
    actionId: input.actionId,
    eventType: input.eventType,
    actor: input.actor,
    summary: input.summary,
    createdAt: new Date().toISOString(),
  };
  pushAudit(event);

  const db = await getDb();
  if (!db) return event;

  await db.insert(incidentAuditLog).values({
    eventKey: event.id,
    actionKey: input.actionId,
    mode: input.mode ?? "live",
    eventType: input.eventType,
    actor: input.actor,
    summary: input.summary,
    createdAt: new Date(event.createdAt),
  }).onDuplicateKeyUpdate({
    set: {
      summary: input.summary,
    },
  });

  return event;
}

function inferDispatchTarget(action: SharedIncidentAction) {
  return action.owner ?? "Command Desk";
}

function inferDispatchChannel(action: SharedIncidentAction) {
  return action.owner ? "owner_notification" : "command_console";
}

async function persistDispatch(dispatch: SharedIncidentDispatch, mode: "live" | "simulation") {
  const db = await getDb();
  if (!db) return;

  await db.insert(incidentDispatches).values({
    dispatchKey: dispatch.id,
    actionKey: dispatch.actionId,
    mode,
    channel: dispatch.channel,
    target: dispatch.target,
    status: dispatch.status,
    detail: dispatch.detail,
    acknowledgedAt: dispatch.acknowledgedAt ? new Date(dispatch.acknowledgedAt) : null,
    acknowledgedBy: dispatch.acknowledgedBy,
    lastAttemptAt: dispatch.lastAttemptAt ? new Date(dispatch.lastAttemptAt) : null,
  }).onDuplicateKeyUpdate({
    set: {
      channel: dispatch.channel,
      target: dispatch.target,
      status: dispatch.status,
      detail: dispatch.detail,
      acknowledgedAt: dispatch.acknowledgedAt ? new Date(dispatch.acknowledgedAt) : null,
      acknowledgedBy: dispatch.acknowledgedBy,
      lastAttemptAt: dispatch.lastAttemptAt ? new Date(dispatch.lastAttemptAt) : null,
    },
  });
}

async function attemptDispatch(action: SharedIncidentAction, dispatch: SharedIncidentDispatch, mode: "live" | "simulation") {
  const attemptAt = new Date().toISOString();
  dispatch.lastAttemptAt = attemptAt;

  if (mode !== "live" || action.managedBy === "operator") {
    dispatch.status = "local_only";
    dispatch.detail = "Operator-managed action retained in the BayShield operations board.";
    await persistDispatch(dispatch, mode);
    return dispatch;
  }

  try {
    const delivered = await notifyOwner({
      title: `[BayShield] ${action.title}`,
      content: `${action.detail}\nOwner: ${dispatch.target}\nDue: ${action.dueLabel}\nPopulation covered: ${action.populationCovered.toLocaleString()}`,
    });
    dispatch.status = delivered ? "delivered" : "local_only";
    dispatch.detail = delivered
      ? "Notification accepted by the configured owner notification service."
      : "Outbound service unavailable. Dispatch retained locally in the BayShield board.";
  } catch {
    dispatch.status = "local_only";
    dispatch.detail = "No outbound notification service available. Dispatch retained locally in the BayShield board.";
  }

  await persistDispatch(dispatch, mode);
  await recordIncidentAudit({
    actionId: action.id,
    mode,
    eventType: "dispatch_attempt",
    actor: "BayShield Autonomy",
    summary: `${dispatch.channel} dispatch ${dispatch.status} for ${dispatch.target}`,
  });
  return dispatch;
}

export async function syncIncidentExecution(actions: SharedIncidentAction[], mode: "live" | "simulation" = "live") {
  for (const action of actions) {
    const dispatchId = buildDispatchKey(action.id);
    const existing = dispatchState.get(dispatchId);
    const dispatch: SharedIncidentDispatch = existing ?? {
      id: dispatchId,
      actionId: action.id,
      title: action.title,
      target: inferDispatchTarget(action),
      channel: inferDispatchChannel(action),
      status: "pending",
      detail: "Dispatch queued inside BayShield.",
      lastAttemptAt: null,
      acknowledgedAt: null,
      acknowledgedBy: null,
    };

    dispatch.title = action.title;
    dispatch.target = inferDispatchTarget(action);
    dispatch.channel = inferDispatchChannel(action);

    dispatchState.set(dispatchId, dispatch);

    if ((action.status === "assigned" || action.status === "completed") && !dispatch.lastAttemptAt) {
      await attemptDispatch(action, dispatch, mode);
    } else {
      await persistDispatch(dispatch, mode);
    }
  }

  return actions.map(action => dispatchState.get(buildDispatchKey(action.id))).filter(Boolean) as SharedIncidentDispatch[];
}

export async function acknowledgeIncidentDispatch(input: {
  actionId: string;
  actor: string;
  mode?: "live" | "simulation";
}) {
  const dispatch = dispatchState.get(buildDispatchKey(input.actionId));
  if (!dispatch) return null;

  dispatch.status = "acknowledged";
  dispatch.acknowledgedAt = new Date().toISOString();
  dispatch.acknowledgedBy = input.actor;
  await persistDispatch(dispatch, input.mode ?? "live");
  await recordIncidentAudit({
    actionId: input.actionId,
    mode: input.mode,
    eventType: "acknowledged",
    actor: input.actor,
    summary: `Dispatch acknowledged by ${input.actor}`,
  });
  return dispatch;
}

export function getIncidentExecutionState() {
  return {
    dispatches: Array.from(dispatchState.values()),
    auditLog: [...auditLogState],
  };
}
