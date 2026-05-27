import { desc } from "drizzle-orm";
import { getDb } from "../db";
import { agentRuns, actionPlans, agentMessages } from "../../drizzle/schema";
import { estimatePopulationFromPolygons } from "./censusExposure";
import { fetchInfrastructureSignals } from "./infrastructureFeeds";
import { deriveIncidentActionsFromResult, hydrateIncidentWorkflowFromDb, type SharedIncidentAction } from "./incidentWorkflow";
import { getIncidentExecutionState, syncIncidentExecution, type SharedIncidentAuditEvent, type SharedIncidentDispatch } from "./incidentExecution";

const PYTHON_ADK_URL = process.env.PYTHON_ADK_URL || "http://localhost:8000";
const LIVE_REFRESH_MS = 2 * 60 * 1000;

export type LiveStateSnapshot = {
  status: "idle" | "running" | "ready" | "error";
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
  currentState: Record<string, unknown> | null;
  incidentActions: SharedIncidentAction[];
  incidentDispatches: SharedIncidentDispatch[];
  incidentAuditLog: SharedIncidentAuditEvent[];
};

let schedulerStarted = false;
let runPromise: Promise<void> | null = null;
let timer: NodeJS.Timeout | null = null;

const liveState: LiveStateSnapshot = {
  status: "idle",
  lastRunStartedAt: null,
  lastRunCompletedAt: null,
  nextRunAt: null,
  lastError: null,
  currentState: null,
  incidentActions: [],
  incidentDispatches: [],
  incidentAuditLog: [],
};

async function callADK(path: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${PYTHON_ADK_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ADK service error ${res.status}: ${text}`);
  }

  return res.json();
}

async function savePipelineResult(result: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;

  const runId = result.run_id as string;
  const completedAt = new Date((result.completed_at as string) || new Date().toISOString());

  await db.insert(agentRuns).values({
    runId,
    mode: "live",
    threatLevel: result.threat_level as string,
    totalAtRisk: result.total_at_risk as number,
    selfCorrectionApplied: (result.self_correction_applied as boolean) ? 1 : 0,
    correctionDetails: result.correction_details as string | null,
    completedAt,
  }).onDuplicateKeyUpdate({ set: { completedAt } });

  const messages = result.messages as Array<Record<string, unknown>>;
  if (messages?.length) {
    await db.insert(agentMessages).values(
      messages.map((message) => ({
        messageId: message.id as string,
        runId,
        fromAgent: message.from_agent as string,
        toAgent: message.to_agent as string,
        eventType: message.event_type as string,
        content: message.content as string,
        payload: JSON.stringify(message.payload),
        timestamp: new Date(message.timestamp as string),
      }))
    ).onDuplicateKeyUpdate({ set: { timestamp: new Date() } });
  }

  const plans = result.action_plans as Array<Record<string, unknown>>;
  if (plans?.length) {
    await db.insert(actionPlans).values(
      plans.map((plan) => ({
        planId: plan.id as string,
        runId,
        title: plan.title as string,
        priority: plan.priority as number,
        action: plan.action as string,
        shelter: plan.shelter as string,
        route: plan.route as string,
        population: plan.population as number,
        rationale: plan.rationale as string,
        outputType: plan.output_type as string,
        correctionApplied: (plan.correction_applied as boolean) ? 1 : 0,
      }))
    ).onDuplicateKeyUpdate({ set: { createdAt: new Date() } });
  }
}

export async function enrichPipelineResultWithCensusExposure(result: Record<string, unknown>) {
  const zones = Array.isArray(result.vulnerability_zones)
    ? result.vulnerability_zones as Array<Record<string, unknown>>
    : [];

  const seenBlocks = new Set<string>();
  let totalAtRisk = 0;

  for (const zone of zones) {
    const polygons = Array.isArray(zone.polygons)
      ? zone.polygons
          .filter((ring): ring is unknown[] => Array.isArray(ring))
          .map(ring =>
            ring
              .filter((point): point is unknown[] => Array.isArray(point) && point.length >= 2)
              .map(point => [Number(point[0]), Number(point[1])])
          )
          .filter(ring => ring.length >= 3)
      : [];

    if (!polygons.length) continue;

    try {
      const exposure = await estimatePopulationFromPolygons(polygons);
      zone.population = exposure.population;
      zone.population_source = exposure.source;
      zone.population_block_count = exposure.blockCount;

      if (String(zone.status ?? "safe") !== "safe" && Number(zone.risk_score ?? 0) >= 65) {
        for (const block of exposure.blocks) {
          if (!seenBlocks.has(block.geoid)) {
            seenBlocks.add(block.geoid);
            totalAtRisk += block.population;
          }
        }
      }
    } catch (error) {
      console.warn("[BayShield Live State] Census exposure enrichment failed for zone:", zone.name, error);
    }
  }

  if (totalAtRisk > 0) {
    result.total_at_risk = totalAtRisk;
  }

  return result;
}

export async function enrichPipelineResultWithInfrastructureSignals(result: Record<string, unknown>) {
  try {
    result.infrastructure_signals = await fetchInfrastructureSignals();
  } catch (error) {
    result.infrastructure_signals = {
      generatedAt: new Date().toISOString(),
      roadIncidentsTotal: 0,
      roadClosuresTotal: 0,
      bridgeClosuresTotal: 0,
      dukeCustomersOut: 0,
      dukeCustomersServed: 0,
      dukePercentOut: 0,
      dukeCountyCount: 0,
      feedStatus: "unavailable",
      sourceSummary: [`Infrastructure feeds unavailable: ${error instanceof Error ? error.message : String(error)}`],
      roadIncidents: [],
      bridgeClosures: [],
      dukeOutages: [],
    };
  }

  return result;
}

function setNextRunFrom(baseTimeMs: number) {
  liveState.nextRunAt = new Date(baseTimeMs + LIVE_REFRESH_MS).toISOString();
}

export async function hydrateLiveStateFromDb() {
  if (liveState.currentState) return;

  await hydrateIncidentWorkflowFromDb("live");

  const db = await getDb();
  if (!db) return;

  const runs = await db.select().from(agentRuns)
    .orderBy(desc(agentRuns.completedAt))
    .limit(1);

  if (!runs.length) return;

  const run = runs[0];
  liveState.lastRunCompletedAt = run.completedAt.toISOString();
  setNextRunFrom(run.completedAt.getTime());
  liveState.status = "ready";
}

export async function runLivePipelineOnce(force = false) {
  if (runPromise && !force) return runPromise;

  runPromise = (async () => {
    liveState.status = "running";
    liveState.lastError = null;
    liveState.lastRunStartedAt = new Date().toISOString();

    try {
      const rawResult = await callADK("/run", {
        method: "POST",
        body: JSON.stringify({ mode: "live" }),
      }) as Record<string, unknown>;
      const resultWithExposure = await enrichPipelineResultWithCensusExposure(rawResult);
      const result = await enrichPipelineResultWithInfrastructureSignals(resultWithExposure);

      liveState.currentState = result;
      liveState.incidentActions = deriveIncidentActionsFromResult(result, "live");
      liveState.incidentDispatches = await syncIncidentExecution(liveState.incidentActions, "live");
      liveState.incidentAuditLog = getIncidentExecutionState().auditLog;
      liveState.lastRunCompletedAt = String(result.completed_at ?? new Date().toISOString());
      setNextRunFrom(new Date(liveState.lastRunCompletedAt).getTime());
      liveState.status = "ready";
      savePipelineResult(result).catch(error => {
        console.warn("[BayShield Live State] Failed to persist pipeline result:", error);
      });
    } catch (error) {
      liveState.status = liveState.currentState ? "ready" : "error";
      liveState.lastError = error instanceof Error ? error.message : String(error);
      setNextRunFrom(Date.now());
      console.warn("[BayShield Live State] Live pipeline run failed:", error);
    } finally {
      runPromise = null;
    }
  })();

  return runPromise;
}

export function refreshLiveIncidentActions() {
  if (!liveState.currentState) {
    liveState.incidentActions = [];
    liveState.incidentDispatches = [];
    return;
  }
  liveState.incidentActions = deriveIncidentActionsFromResult(liveState.currentState, "live");
  void syncIncidentExecution(liveState.incidentActions, "live").then(dispatches => {
    liveState.incidentDispatches = dispatches;
    liveState.incidentAuditLog = getIncidentExecutionState().auditLog;
  });
}

function scheduleNextTick() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void runLivePipelineOnce().finally(() => {
      scheduleNextTick();
    });
  }, LIVE_REFRESH_MS);
}

export async function startLiveStateScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  await hydrateLiveStateFromDb();
  void runLivePipelineOnce();
  scheduleNextTick();
}

export function getCurrentLiveState(): LiveStateSnapshot {
  return {
    ...liveState,
    incidentActions: [...liveState.incidentActions],
    incidentDispatches: [...liveState.incidentDispatches],
    incidentAuditLog: [...liveState.incidentAuditLog],
  };
}
