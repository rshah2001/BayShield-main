/**
 * BayShield tRPC Router
 * Handles agent pipeline orchestration, live weather data,
 * and SSE streaming for real-time frontend updates.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import {
  findSimilarStorms,
  getHistoricalOverview,
} from "../_core/historicalStorms";
import {
  createDynamicContextDocument,
  formatRetrievedContext,
  retrieveBayShieldContext,
} from "../_core/rag";
import { enrichPipelineResultWithCensusExposure, enrichPipelineResultWithInfrastructureSignals, getCurrentLiveState, refreshLiveIncidentActions, runLivePipelineOnce } from "../_core/bayshieldLiveState";
import { deriveIncidentActionsFromResult, updateIncidentWorkflowState } from "../_core/incidentWorkflow";
import { acknowledgeIncidentDispatch, getIncidentExecutionState, syncIncidentExecution } from "../_core/incidentExecution";
import { getDb } from "../db";
import {
  agentRuns, agentMessages, weatherSnapshots, actionPlans,
  vulnerabilityZones, shelterStatus
} from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";

const PYTHON_ADK_URL = process.env.PYTHON_ADK_URL || "http://localhost:8000";

// ── Helper: call the Python ADK service ──────────────────────────────────────
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

// ── Helper: serialize pipeline result to DB ───────────────────────────────────
async function savePipelineResult(result: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;

  const runId = result.run_id as string;
  const completedAt = new Date((result.completed_at as string) || new Date().toISOString());

  // Save agent run record
  await db.insert(agentRuns).values({
    runId,
    mode: "live",
    threatLevel: result.threat_level as string,
    totalAtRisk: result.total_at_risk as number,
    selfCorrectionApplied: (result.self_correction_applied as boolean) ? 1 : 0,
    correctionDetails: result.correction_details as string | null,
    completedAt,
  }).onDuplicateKeyUpdate({ set: { completedAt } });

  // Save A2A messages
  const messages = result.messages as Array<Record<string, unknown>>;
  if (messages?.length) {
    await db.insert(agentMessages).values(
      messages.map((m) => ({
        messageId: m.id as string,
        runId,
        fromAgent: m.from_agent as string,
        toAgent: m.to_agent as string,
        eventType: m.event_type as string,
        content: m.content as string,
        payload: JSON.stringify(m.payload),
        timestamp: new Date(m.timestamp as string),
      }))
    ).onDuplicateKeyUpdate({ set: { timestamp: new Date() } });
  }

  // Save action plans
  const plans = result.action_plans as Array<Record<string, unknown>>;
  if (plans?.length) {
    await db.insert(actionPlans).values(
      plans.map((p) => ({
        planId: p.id as string,
        runId,
        title: p.title as string,
        priority: p.priority as number,
        action: p.action as string,
        shelter: p.shelter as string,
        route: p.route as string,
        population: p.population as number,
        rationale: p.rationale as string,
        outputType: p.output_type as string,
        correctionApplied: (p.correction_applied as boolean) ? 1 : 0,
      }))
    ).onDuplicateKeyUpdate({ set: { createdAt: new Date() } });
  }
}

async function getLatestRunKnowledge() {
  const liveState = getCurrentLiveState();
  const liveRun = liveState.currentState as Record<string, unknown> | null;

  if (liveRun) {
    const plans = Array.isArray(liveRun.action_plans)
      ? liveRun.action_plans as Array<Record<string, unknown>>
      : [];
    const storm = liveRun.active_storm as Record<string, unknown> | null;
    const weather = liveRun.weather as Record<string, unknown> | null;
    const zones = Array.isArray(liveRun.vulnerability_zones)
      ? liveRun.vulnerability_zones as Array<Record<string, unknown>>
      : [];
    const alerts = Array.isArray(liveRun.nws_alerts)
      ? liveRun.nws_alerts as Array<Record<string, unknown>>
      : [];

    const summary = [
      `Latest pipeline run ID: ${String(liveRun.run_id ?? "unknown")}`,
      `Run source: backend canonical live state`,
      `Completed at: ${String(liveRun.completed_at ?? liveState.lastRunCompletedAt ?? "unknown")}`,
      `Threat level: ${String(liveRun.threat_level ?? "unknown")}`,
      `Population at risk: ${Number(liveRun.total_at_risk ?? 0).toLocaleString()}`,
      `Self-correction applied: ${Boolean(liveRun.self_correction_applied)}`,
      typeof liveRun.correction_details === "string" && liveRun.correction_details.length > 0
        ? `Correction details: ${liveRun.correction_details}`
        : null,
      weather
        ? `Weather snapshot: ${Number(weather.temperature_c ?? 0)} C / ${Number(weather.temperature_f ?? 0)} F, wind ${Number(weather.wind_speed_kt ?? 0)} kt ${String(weather.wind_direction ?? "")}, ${String(weather.description ?? "unknown conditions")}`
        : "Weather snapshot unavailable in latest run.",
      storm
        ? `Active storm in run: ${String(storm.name ?? "Unknown")} | category ${Number(storm.category ?? 0)} | ${Number(storm.wind_kt ?? 0)} kt | ${Number(storm.distance_miles ?? 0)} miles from Tampa Bay`
        : "No active tropical storm recorded in latest run.",
      `Alerts in run: ${alerts.length}`,
      `Vulnerability zones in run: ${zones.length}`,
      plans.length > 0
        ? `Action plans: ${plans
            .slice(0, 5)
            .map(
              plan =>
                `P${Number(plan.priority ?? 0)} ${String(plan.title ?? "Untitled")} | action=${String(plan.action ?? "unknown")} | population=${Number(plan.population ?? 0)}`
            )
            .join("; ")}`
        : "Action plans: none recorded",
    ]
      .filter(Boolean)
      .join("\n");

    return createDynamicContextDocument("Latest Pipeline Run", summary, "runtime/latest-live-run");
  }

  const db = await getDb();
  if (!db) return null;

  const runs = await db.select().from(agentRuns)
    .orderBy(desc(agentRuns.completedAt))
    .limit(1);

  if (!runs.length) return null;

  const run = runs[0];
  const plans = await db.select().from(actionPlans)
    .where(eq(actionPlans.runId, run.runId))
    .orderBy(actionPlans.priority);

  const summary = [
    `Latest pipeline run ID: ${run.runId}`,
    `Threat level: ${run.threatLevel}`,
    `Population at risk: ${run.totalAtRisk}`,
    `Self-correction applied: ${Boolean(run.selfCorrectionApplied)}`,
    run.correctionDetails ? `Correction details: ${run.correctionDetails}` : null,
    plans.length > 0
      ? `Action plans: ${plans
          .slice(0, 5)
          .map(
            plan =>
              `P${plan.priority} ${plan.title} | action=${plan.action} | population=${plan.population}`
          )
          .join("; ")}`
      : "Action plans: none recorded",
  ]
    .filter(Boolean)
    .join("\n");

  return createDynamicContextDocument("Latest Pipeline Run", summary, "runtime/latest-db-run");
}

async function getLiveKnowledge() {
  try {
    const data = await callADK("/live-data") as {
      threat_level?: string;
      observation?: {
        station?: string;
        temperature_c?: number;
        temperature_f?: number;
        wind_speed_kt?: number;
        wind_direction?: string;
        pressure_pa?: number;
        description?: string;
        timestamp?: string;
      } | null;
      alerts?: Array<{
        event?: string;
        severity?: string;
        area_desc?: string;
        headline?: string;
      }>;
      storms?: Array<{
        name?: string;
        category?: number;
        wind_kt?: number;
        distance_miles?: number;
        lat?: number;
        lng?: number;
      }>;
      fetched_at?: string;
    };

    const observation = data.observation;
    const alerts = data.alerts ?? [];
    const storms = data.storms ?? [];

    const summary = [
      `Live fetch timestamp: ${data.fetched_at ?? "unknown"}`,
      `Current threat level: ${data.threat_level ?? "unknown"}`,
      observation
        ? `Current KTPA observation: ${observation.temperature_c ?? "unknown"} C / ${observation.temperature_f ?? "unknown"} F, wind ${observation.wind_speed_kt ?? "unknown"} kt ${observation.wind_direction ?? ""}, pressure ${observation.pressure_pa ?? "unknown"} Pa, conditions ${observation.description ?? "unknown"}, observed at ${observation.timestamp ?? "unknown"}`
        : "Current KTPA observation unavailable.",
      alerts.length > 0
        ? `Active Tampa Bay alerts: ${alerts
            .slice(0, 5)
            .map(alert => `${alert.event ?? "Unknown"} (${alert.severity ?? "unknown"}) for ${alert.area_desc ?? "unknown area"}: ${alert.headline ?? "no headline"}`)
            .join("; ")}`
        : "No active Tampa Bay alerts reported in the latest fetch.",
      storms.length > 0
        ? `Active Atlantic storms: ${storms
            .slice(0, 5)
            .map(storm => `${storm.name ?? "Unknown storm"} | category ${storm.category ?? 0} | ${storm.wind_kt ?? "unknown"} kt | ${storm.distance_miles ?? "unknown"} miles from Tampa Bay`)
            .join("; ")}`
        : "No active Atlantic tropical storms or hurricanes were returned in the latest fetch.",
    ].join("\n");

    return {
      document: createDynamicContextDocument("Live NOAA/NHC Snapshot", summary, "runtime/live-data"),
      observation,
      storms,
    };
  } catch {
    return {
      document: createDynamicContextDocument(
        "Live NOAA/NHC Snapshot",
        "Live NOAA/NHC data is currently unavailable.",
        "runtime/live-data"
      ),
      observation: null,
      storms: [],
    };
  }
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map(part => {
      if (typeof part === "string") return part;
      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        (part as { type?: string }).type === "text"
      ) {
        return String((part as { text?: string }).text ?? "");
      }
      return "";
    })
    .join("\n")
    .trim();
}

function isLiveWeatherQuestion(question: string): boolean {
  return /\b(current weather|weather now|weather in celsius|temperature|temp|celsius|fahrenheit)\b/i.test(question);
}

function isActiveStormQuestion(question: string): boolean {
  return /\b(hurricane|storm|tropical|cyclone|coming|new hurricane|active storm)\b/i.test(question);
}

function isDamageQuestion(question: string): boolean {
  return /\b(damage|impact|flood|surge|wind damage|what could it do|how bad)\b/i.test(question);
}

function isCapabilityQuestion(question: string): boolean {
  return /\b(what can you do|capabilities|help with|how does this work|how do you work|what all can you do|system works|agents do)\b/i.test(question);
}

function isLatestRunQuestion(question: string): boolean {
  return /\b(latest pipeline run|latest run|last run|recent run|most recent run)\b/i.test(question);
}

function isHistoricalQuestion(question: string): boolean {
  return /\b(historical|history|past storms|similar storms|analog storms|comparable storms)\b/i.test(question);
}

function buildCapabilitiesDocument() {
  return createDynamicContextDocument(
    "BayShield Capabilities",
    [
      "BayShield is a live Tampa Bay emergency-response dashboard.",
      "Live operations: current weather, active Tampa Bay alerts, active Atlantic storms, shelter status, evacuation routing, agent pipeline traces, and recommended actions.",
      "Maps: Google Maps routing with BayShield live zones and shelter overlays.",
      "Infrastructure: decision-support signals, agent insights, and vulnerability analysis.",
      "Historical hurricane dataset: used for comparable-storm context and simulation support, not as the primary live dashboard surface.",
      "When a question asks about current weather, live storms, alerts, or damage, BayShield should prioritize live NOAA/NWS/NHC data over historical context.",
    ].join("\n"),
    "runtime/capabilities"
  );
}

// ── BayShield Router ──────────────────────────────────────────────────────────
export const bayshieldRouter = router({
  // Health check for Python ADK service
  adkHealth: publicProcedure.query(async () => {
    try {
      const health = await callADK("/health");
      return { ok: true, data: health };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }),

  // Fetch live NOAA/NWS data without running the full pipeline
  liveWeather: publicProcedure.query(async () => {
    try {
      const data = await callADK("/live-data") as Record<string, unknown>;
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: String(e), data: null };
    }
  }),

  currentLiveState: publicProcedure.query(async () => {
    const snapshot = getCurrentLiveState();

    if (!snapshot.currentState && snapshot.status !== "running") {
      void runLivePipelineOnce();
    }

    return {
      ok: true,
      data: snapshot,
    };
  }),

  // Run the full 4-agent pipeline and persist results
  runPipeline: publicProcedure
    .input(z.object({ mode: z.enum(["live", "simulation"]).default("live") }))
    .mutation(async ({ input }) => {
      try {
        const rawResult = await callADK("/run", {
          method: "POST",
          body: JSON.stringify({ mode: input.mode }),
        }) as Record<string, unknown>;
        const result = input.mode === "live"
          ? await enrichPipelineResultWithInfrastructureSignals(
              await enrichPipelineResultWithCensusExposure(rawResult)
            )
          : rawResult;
        const incidentActions = deriveIncidentActionsFromResult(result, input.mode);
        const incidentExecution = await syncIncidentExecution(incidentActions, input.mode);

        // Persist to DB in background (don't block response)
        savePipelineResult(result).catch(console.error);

        return {
          ok: true,
          data: {
            ...result,
            incident_actions: incidentActions,
            incident_dispatches: incidentExecution,
            incident_audit_log: getIncidentExecutionState().auditLog,
          },
        };
      } catch (e) {
        return { ok: false, error: String(e), data: null };
      }
    }),

  updateIncidentAction: publicProcedure
    .input(z.object({
      actionId: z.string().min(1),
      planId: z.string().min(1),
      title: z.string().min(1),
      mode: z.enum(["live", "simulation"]).default("live"),
      source: z.string().optional(),
      status: z.enum(["new", "reviewed", "assigned", "completed"]).optional(),
      owner: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const next = await updateIncidentWorkflowState({
        actionId: input.actionId,
        planId: input.planId,
        title: input.title,
        mode: input.mode,
        source: input.source,
        status: input.status,
        owner: input.owner,
      });

      const snapshot = getCurrentLiveState();
      if (input.mode === "live" && snapshot.currentState) {
        refreshLiveIncidentActions();
      }

      return { ok: true, data: next };
    }),

  acknowledgeIncidentDispatch: publicProcedure
    .input(z.object({
      actionId: z.string().min(1),
      actor: z.string().min(1).default("BayShield Operator"),
      mode: z.enum(["live", "simulation"]).default("live"),
    }))
    .mutation(async ({ input }) => {
      const dispatch = await acknowledgeIncidentDispatch(input);
      const snapshot = getCurrentLiveState();
      if (input.mode === "live" && snapshot.currentState) {
        refreshLiveIncidentActions();
      }
      return { ok: true, data: dispatch };
    }),

  // Get the most recent pipeline run from DB
  latestRun: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const runs = await db.select().from(agentRuns)
      .orderBy(desc(agentRuns.completedAt))
      .limit(1);

    if (!runs.length) return null;
    const run = runs[0];

    const messages = await db.select().from(agentMessages)
      .where(eq(agentMessages.runId, run.runId))
      .orderBy(agentMessages.timestamp);

    const plans = await db.select().from(actionPlans)
      .where(eq(actionPlans.runId, run.runId))
      .orderBy(actionPlans.priority);

    return { run, messages, plans };
  }),

  // Get all recent runs (last 10)
  recentRuns: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return db.select().from(agentRuns)
      .orderBy(desc(agentRuns.completedAt))
      .limit(10);
  }),

  historicalOverview: publicProcedure.query(() => {
    return getHistoricalOverview();
  }),

  similarStorms: publicProcedure
    .input(z.object({
      category: z.number().nullable().optional(),
      maxWindKt: z.number().nullable().optional(),
      pressure: z.number().nullable().optional(),
      states: z.string().nullable().optional(),
      limit: z.number().int().min(1).max(10).default(5),
    }))
    .query(({ input }) => {
      return findSimilarStorms({
        category: input.category ?? null,
        maxWindKt: input.maxWindKt ?? null,
        pressure: input.pressure ?? null,
        states: input.states ?? null,
        limit: input.limit,
      });
    }),

  // LLM-powered action plan summary
  generateSummary: publicProcedure
    .input(z.object({
      threatLevel: z.string(),
      totalAtRisk: z.number(),
      planCount: z.number(),
      correctionApplied: z.boolean(),
      zones: z.array(z.object({
        name: z.string(),
        riskScore: z.number(),
        status: z.string(),
        population: z.number(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const zonesText = input.zones
        ? input.zones.map(z => `${z.name} (risk: ${z.riskScore}, ${z.status})`).join(", ")
        : "Tampa Bay coastal zones";

      try {
        const latestRunContext = await getLatestRunKnowledge();
        const retrievedContext = retrieveBayShieldContext(
          `${input.threatLevel} ${zonesText} ${input.totalAtRisk} action plans`,
          {
            limit: 4,
            dynamicDocuments: latestRunContext ? [latestRunContext] : [],
          }
        );

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are BayShield, an AI emergency coordinator for Tampa Bay. 
Write a concise 2-3 sentence emergency briefing for emergency managers. 
Be specific, actionable, and professional. Do not use markdown formatting.
Use the retrieved BayShield context when it strengthens the answer.`
            },
            {
              role: "user",
              content: `Retrieved context:
${formatRetrievedContext(retrievedContext)}

Current situation: Threat level ${input.threatLevel}. 
${input.totalAtRisk.toLocaleString()} people at risk. 
${input.planCount} action plans generated.
${input.correctionApplied ? "Self-correction was applied to improve plan accuracy." : ""}
High-risk zones: ${zonesText}.
Generate an emergency briefing.`
            }
          ]
        });

        const content = (response as { choices?: Array<{ message?: { content?: string } }> })
          ?.choices?.[0]?.message?.content ?? "Emergency assessment complete. Review action plans.";

        return { summary: content };
      } catch (e) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `LLM summary generation failed: ${String(e)}`,
        });
      }
    }),

  // LLM-powered self-correction explanation
  explainCorrection: publicProcedure
    .input(z.object({
      correctionDetails: z.string(),
      planTitle: z.string(),
      threatLevel: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const latestRunContext = await getLatestRunKnowledge();
        const retrievedContext = retrieveBayShieldContext(
          `${input.planTitle} ${input.threatLevel} ${input.correctionDetails}`,
          {
            limit: 4,
            dynamicDocuments: latestRunContext ? [latestRunContext] : [],
          }
        );

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an AI agent explaining a self-correction in an emergency response system.
Be concise (1-2 sentences) and technical.
Ground your answer in the retrieved BayShield context when relevant.`
            },
            {
              role: "user",
              content: `Retrieved context:
${formatRetrievedContext(retrievedContext)}

The Alert Commander self-correction loop detected: "${input.correctionDetails}" in plan "${input.planTitle}" during a ${input.threatLevel} threat scenario. Explain why this correction was necessary.`
            }
          ]
        });

        const content = (response as { choices?: Array<{ message?: { content?: string } }> })
          ?.choices?.[0]?.message?.content ?? "Correction applied to ensure plan accuracy.";

        return { explanation: content };
      } catch (e) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `LLM explanation generation failed: ${String(e)}`,
        });
      }
    }),

  chat: publicProcedure
    .input(z.object({
      messages: z.array(z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1),
      })).min(1).max(20),
    }))
    .mutation(async ({ input }) => {
      const latestRunContext = await getLatestRunKnowledge();
      const liveKnowledge = await getLiveKnowledge();
      const capabilitiesContext = buildCapabilitiesDocument();
      const primaryStorm = liveKnowledge.storms[0];
      const userQuestion = [...input.messages]
        .reverse()
        .find(message => message.role === "user")?.content ?? input.messages[input.messages.length - 1].content;
      const shouldUseHistorical = Boolean(primaryStorm) || isDamageQuestion(userQuestion) || isHistoricalQuestion(userQuestion);
      const similarStorms = shouldUseHistorical
        ? findSimilarStorms({
            category: primaryStorm?.category ?? null,
            maxWindKt: primaryStorm?.wind_kt ?? liveKnowledge.observation?.wind_speed_kt ?? null,
            pressure: null,
            states: "FL",
            limit: 3,
          })
        : [];

      if (isCapabilityQuestion(userQuestion)) {
        return {
          answer: [
            "Right now I can help with live Tampa Bay weather and alerts, active Atlantic storm tracking, shelter status, evacuation routing, agent pipeline outputs, and decision-support summaries.",
            shouldUseHistorical
              ? `I can also compare the current situation to historical Florida storms like ${similarStorms.slice(0, 2).map(storm => `${storm.year} ${storm.name ?? "Unnamed"}`).join(" and ")} when that adds useful context.`
              : "I also have a historical hurricane dataset available for comparable-storm analysis and simulation support when that becomes relevant.",
          ].join(" "),
          sources: [
            { title: "BayShield Capabilities", source: "runtime/capabilities" },
            { title: "Live NOAA/NHC Snapshot", source: "runtime/live-data" },
          ],
        };
      }

      if (isLatestRunQuestion(userQuestion) && latestRunContext) {
        return {
          answer: latestRunContext.content,
          sources: [
            { title: latestRunContext.title, source: latestRunContext.source },
          ],
        };
      }

      if (isLiveWeatherQuestion(userQuestion)) {
        const observation = liveKnowledge.observation;
        return {
          answer: observation
            ? `Current weather at ${observation.station ?? "KTPA"}: ${observation.temperature_c ?? "unknown"} C (${observation.temperature_f ?? "unknown"} F), wind ${observation.wind_speed_kt ?? "unknown"} kt ${observation.wind_direction ?? ""}, conditions ${observation.description ?? "unknown"}. Observation time: ${observation.timestamp ?? "unknown"}.`
            : "Live weather data is unavailable right now.",
          sources: [
            { title: "Live NOAA/NHC Snapshot", source: "runtime/live-data" },
          ],
        };
      }

      if (isActiveStormQuestion(userQuestion) && !isDamageQuestion(userQuestion)) {
        const storms = liveKnowledge.storms;
        return {
          answer: storms.length > 0
            ? `Active Atlantic storms in the latest NHC snapshot: ${storms
                .slice(0, 3)
                .map(storm => `${storm.name ?? "Unknown storm"} (Category ${storm.category ?? 0}, ${storm.wind_kt ?? "unknown"} kt, about ${storm.distance_miles ?? "unknown"} miles from Tampa Bay)`)
                .join("; ")}.`
            : "The latest NHC snapshot returned no active tropical storms or hurricanes near Tampa Bay.",
          sources: [
            { title: "Live NOAA/NHC Snapshot", source: "runtime/live-data" },
          ],
        };
      }

      if (isDamageQuestion(userQuestion)) {
        const storm = liveKnowledge.storms[0];
        const matchesText = similarStorms.length > 0
          ? `Closest historical Florida matches: ${similarStorms
              .slice(0, 3)
              .map(match => `${match.year} ${match.name ?? "Unnamed storm"} (Cat ${match.category ?? "unknown"}, ${match.maxWindKt ?? "unknown"} kt)`)
              .join("; ")}.`
          : "No close historical Florida matches were found in the current dataset.";

        return {
          answer: storm
            ? `${storm.name ?? "This storm"} could cause damaging wind, flooding, and storm surge impacts if it tracks toward Tampa Bay. Based on the current live snapshot, it is Category ${storm.category ?? 0} with winds near ${storm.wind_kt ?? "unknown"} kt and about ${storm.distance_miles ?? "unknown"} miles away. ${matchesText}`
            : `I do not see an active tropical storm or hurricane in the latest live snapshot affecting Tampa Bay right now. ${matchesText}`,
          sources: [
            { title: "Live NOAA/NHC Snapshot", source: "runtime/live-data" },
            ...(similarStorms.length > 0 ? [{ title: "Historical Hurricane Matches", source: "runtime/historical-matches" }] : []),
          ],
        };
      }

      const dynamicDocuments = [
        capabilitiesContext,
        liveKnowledge.document,
        ...(latestRunContext ? [latestRunContext] : []),
        ...(shouldUseHistorical
          ? [
              createDynamicContextDocument(
                "Historical Hurricane Matches",
                similarStorms.length > 0
                  ? similarStorms
                      .map(
                        storm =>
                          `${storm.year} ${storm.name ?? "Unnamed storm"} | category=${storm.category ?? "unknown"} | maxWindKt=${storm.maxWindKt ?? "unknown"} | pressure=${storm.pressure ?? "unknown"} | states=${storm.states}`
                      )
                      .join("\n")
                  : "No historical storms available.",
                "runtime/historical-matches"
              ),
            ]
          : []),
      ];

      const retrievedContext = retrieveBayShieldContext(userQuestion, {
        limit: 5,
        dynamicDocuments,
      });

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are BayShield's retrieval-augmented disaster response assistant.
Answer using the retrieved BayShield context first and be explicit when a detail comes from live NOAA/NHC data versus the latest pipeline run versus static project docs.
If the answer is not supported by the provided context, say that directly instead of guessing.
When the user asks about current weather, active storms, hurricane risk, or likely damage, prioritize the live NOAA/NHC snapshot and the historical matches.
Keep answers concise, operational, and clear for an emergency-management dashboard user.`
            },
            {
              role: "system",
              content: `Retrieved BayShield context:
${formatRetrievedContext(retrievedContext)}`
            },
            ...input.messages
              .filter(message => message.role !== "system")
              .map(message => ({
                role: message.role,
                content: message.content,
              })),
          ],
        });

        const answer = extractTextContent(
          response.choices?.[0]?.message?.content ?? ""
        );

        return {
          answer: answer || "I couldn't generate a grounded BayShield response.",
          sources: retrievedContext.map(chunk => ({
            title: chunk.title,
            source: chunk.source,
          })),
        };
      } catch (e) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `BayShield chat failed: ${String(e)}`,
        });
      }
    }),
});
