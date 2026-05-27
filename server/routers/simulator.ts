/**
 * Storm Simulator tRPC Router
 *
 * Accepts a user-defined storm track + parameters, runs an LLM-powered
 * infrastructure impact analysis, and persists the result to the DB.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { stormSimulations } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// ── Zod schemas ──────────────────────────────────────────────────────────────

const TrackPointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

const StormTypeEnum = z.enum([
  "hurricane",
  "tropical_storm",
  "tropical_depression",
  "tornado",
  "flood",
  "nor_easter",
]);

const CreateSimulationInput = z.object({
  name: z.string().min(1).max(128),
  stormType: StormTypeEnum.default("hurricane"),
  category: z.number().int().min(1).max(5).optional(),
  windSpeedKph: z.number().min(0).max(400).default(150),
  radiusKm: z.number().min(5).max(500).default(80),
  forwardSpeedKph: z.number().min(1).max(100).default(20),
  track: z.array(TrackPointSchema).min(2).max(20),
  landfall: TrackPointSchema.optional(),
});

// ── LLM JSON schema ──────────────────────────────────────────────────────────

const ANALYSIS_JSON_SCHEMA = {
  name: "storm_analysis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      affectedPopulation: { type: "integer" },
      threatLevel: { type: "string", enum: ["CRITICAL", "HIGH", "MODERATE", "LOW"] },
      infrastructureImpacts: {
        type: "object",
        properties: {
          power:          { type: "object", properties: { severity: { type: "string" }, description: { type: "string" }, outageEstimate: { type: "string" }, specificClosures: { type: "string" } }, required: ["severity","description","outageEstimate","specificClosures"], additionalProperties: false },
          roads:          { type: "object", properties: { severity: { type: "string" }, description: { type: "string" }, outageEstimate: { type: "string" }, specificClosures: { type: "string" } }, required: ["severity","description","outageEstimate","specificClosures"], additionalProperties: false },
          bridges:        { type: "object", properties: { severity: { type: "string" }, description: { type: "string" }, outageEstimate: { type: "string" }, specificClosures: { type: "string" } }, required: ["severity","description","outageEstimate","specificClosures"], additionalProperties: false },
          airports:       { type: "object", properties: { severity: { type: "string" }, description: { type: "string" }, outageEstimate: { type: "string" }, specificClosures: { type: "string" } }, required: ["severity","description","outageEstimate","specificClosures"], additionalProperties: false },
          port:           { type: "object", properties: { severity: { type: "string" }, description: { type: "string" }, outageEstimate: { type: "string" }, specificClosures: { type: "string" } }, required: ["severity","description","outageEstimate","specificClosures"], additionalProperties: false },
          hospitals:      { type: "object", properties: { severity: { type: "string" }, description: { type: "string" }, outageEstimate: { type: "string" }, specificClosures: { type: "string" } }, required: ["severity","description","outageEstimate","specificClosures"], additionalProperties: false },
          communications: { type: "object", properties: { severity: { type: "string" }, description: { type: "string" }, outageEstimate: { type: "string" }, specificClosures: { type: "string" } }, required: ["severity","description","outageEstimate","specificClosures"], additionalProperties: false },
          waterSewer:     { type: "object", properties: { severity: { type: "string" }, description: { type: "string" }, outageEstimate: { type: "string" }, specificClosures: { type: "string" } }, required: ["severity","description","outageEstimate","specificClosures"], additionalProperties: false },
        },
        required: ["power","roads","bridges","airports","port","hospitals","communications","waterSewer"],
        additionalProperties: false,
      },
      evacuationZones: {
        type: "object",
        properties: {
          mandatory:         { type: "array", items: { type: "string" } },
          recommended:       { type: "array", items: { type: "string" } },
          estimatedEvacuees: { type: "integer" },
          timeToEvacuate:    { type: "string" },
        },
        required: ["mandatory","recommended","estimatedEvacuees","timeToEvacuate"],
        additionalProperties: false,
      },
      shelterDemand: {
        type: "object",
        properties: {
          estimatedShelterNeeds: { type: "integer" },
          recommendedShelters:   { type: "array", items: { type: "string" } },
          specialNeedsCount:     { type: "integer" },
        },
        required: ["estimatedShelterNeeds","recommendedShelters","specialNeedsCount"],
        additionalProperties: false,
      },
      stormSurge: {
        type: "object",
        properties: {
          maxSurgeMeters:     { type: "number" },
          affectedCoastlineKm:{ type: "number" },
          highRiskAreas:      { type: "array", items: { type: "string" } },
        },
        required: ["maxSurgeMeters","affectedCoastlineKm","highRiskAreas"],
        additionalProperties: false,
      },
      economicImpact: {
        type: "object",
        properties: {
          estimatedDamageUSD: { type: "string" },
          recoveryMonths:     { type: "integer" },
          details:            { type: "string" },
        },
        required: ["estimatedDamageUSD","recoveryMonths","details"],
        additionalProperties: false,
      },
      immediateActions: { type: "array", items: { type: "string" } },
      agentRecommendations: {
        type: "object",
        properties: {
          stormWatcher:         { type: "string" },
          vulnerabilityMapper:  { type: "string" },
          resourceCoordinator:  { type: "string" },
          alertCommander:       { type: "string" },
        },
        required: ["stormWatcher","vulnerabilityMapper","resourceCoordinator","alertCommander"],
        additionalProperties: false,
      },
    },
    required: [
      "summary","affectedPopulation","threatLevel","infrastructureImpacts",
      "evacuationZones","shelterDemand","stormSurge","economicImpact",
      "immediateActions","agentRecommendations"
    ],
    additionalProperties: false,
  },
};

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildAnalysisPrompt(input: z.infer<typeof CreateSimulationInput>): string {
  const categoryLabel = input.stormType === "hurricane"
    ? `Category ${input.category ?? 1} Hurricane`
    : input.stormType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  // Limit to 6 waypoints to keep prompt short
  const trackSummary = input.track
    .slice(0, 6)
    .map((p, i) => `Pt${i + 1}: ${p.lat.toFixed(3)}N ${p.lng.toFixed(3)}W`)
    .join(" → ");

  const landfallStr = input.landfall
    ? `Landfall: ${input.landfall.lat.toFixed(3)}N ${input.landfall.lng.toFixed(3)}W`
    : `Landfall: ${input.track[input.track.length - 1].lat.toFixed(3)}N ${input.track[input.track.length - 1].lng.toFixed(3)}W`;

  return `You are BayShield's AI Infrastructure Impact Analyst for Tampa Bay, Florida.

STORM: "${input.name}" | ${categoryLabel} | Wind: ${input.windSpeedKph} km/h | Radius: ${input.radiusKm} km | Forward: ${input.forwardSpeedKph} km/h
Track: ${trackSummary}
${landfallStr}

Tampa Bay context (3.2M pop): Hillsborough, Pinellas, Pasco, Manatee, Sarasota counties.
Key assets: Port Tampa Bay, MacDill AFB, Tampa Intl Airport, Tampa General/St. Joseph's/BayCare hospitals, Sunshine Skyway Bridge, I-275/I-75/I-4.
Vulnerable: Pinellas Peninsula evac zones A-E, barrier islands (Clearwater Beach, St. Pete Beach), 85k mobile homes.

Analyze the realistic infrastructure impact of this storm on Tampa Bay. Be specific and data-driven. Keep each string under 150 characters. Keep arrays to 2-3 items.`;
}

// ── Router ───────────────────────────────────────────────────────────────────

export const simulatorRouter = router({

  /**
   * Create a new storm simulation and run LLM analysis.
   */
  create: publicProcedure
    .input(CreateSimulationInput)
    .mutation(async ({ input }) => {
      const db = await getDb();
      const simId = randomUUID();

      if (db) {
        await db.insert(stormSimulations).values({
          simId,
          name: input.name,
          stormType: input.stormType,
          category: input.category ?? null,
          windSpeedKph: input.windSpeedKph,
          radiusKm: input.radiusKm,
          forwardSpeedKph: input.forwardSpeedKph,
          track: input.track,
          landfall: input.landfall ?? null,
          status: "analyzing",
        });
      }

      let analysis: Record<string, unknown> | null = null;
      let analysisText = "";
      let affectedPopulation = 0;
      let status: "complete" | "error" = "complete";

      try {
        const prompt = buildAnalysisPrompt(input);
        const llmResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are BayShield's AI Infrastructure Impact Analyst for Tampa Bay, Florida. Respond with structured JSON analysis only.",
            },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: ANALYSIS_JSON_SCHEMA,
          },
        });

        const raw = (llmResponse as { choices: Array<{ message: { content: string } }> })
          .choices?.[0]?.message?.content ?? "{}";

        analysisText = raw;

        // Robust JSON extraction
        let jsonStr = raw.trim();
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const firstBrace = jsonStr.indexOf("{");
        const lastBrace = jsonStr.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
        }

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(jsonStr) as Record<string, unknown>;
        } catch {
          // Repair truncated JSON by closing open brackets
          let depth = 0;
          let inString = false;
          let escape = false;
          const openStack: string[] = [];
          for (const ch of jsonStr) {
            if (escape) { escape = false; continue; }
            if (ch === "\\" && inString) { escape = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === "{") { depth++; openStack.push("}"); }
            else if (ch === "[") { depth++; openStack.push("]"); }
            else if (ch === "}" || ch === "]") { depth--; openStack.pop(); }
          }
          let repaired = jsonStr.replace(/,\s*$/, "");
          while (openStack.length > 0) { repaired += openStack.pop(); }
          try {
            parsed = JSON.parse(repaired) as Record<string, unknown>;
          } catch {
            parsed = {
              summary: "Analysis partially generated — please retry for full results.",
              affectedPopulation: 0,
              threatLevel: "MODERATE",
              infrastructureImpacts: {
                power: { severity: "moderate", description: "Impact assessment pending", outageEstimate: "Unknown", specificClosures: "" },
                roads: { severity: "moderate", description: "Impact assessment pending", outageEstimate: "Unknown", specificClosures: "" },
                bridges: { severity: "moderate", description: "Impact assessment pending", outageEstimate: "", specificClosures: "" },
                airports: { severity: "moderate", description: "Impact assessment pending", outageEstimate: "Unknown", specificClosures: "" },
                port: { severity: "moderate", description: "Impact assessment pending", outageEstimate: "Unknown", specificClosures: "" },
                hospitals: { severity: "minor", description: "Impact assessment pending", outageEstimate: "", specificClosures: "" },
                communications: { severity: "moderate", description: "Impact assessment pending", outageEstimate: "Unknown", specificClosures: "" },
                waterSewer: { severity: "moderate", description: "Impact assessment pending", outageEstimate: "Unknown", specificClosures: "" },
              },
              evacuationZones: { mandatory: [], recommended: [], estimatedEvacuees: 0, timeToEvacuate: "Unknown" },
              shelterDemand: { estimatedShelterNeeds: 0, recommendedShelters: [], specialNeedsCount: 0 },
              stormSurge: { maxSurgeMeters: 0, affectedCoastlineKm: 0, highRiskAreas: [] },
              economicImpact: { estimatedDamageUSD: "Unknown", recoveryMonths: 0, details: "" },
              immediateActions: [],
              agentRecommendations: { stormWatcher: "", vulnerabilityMapper: "", resourceCoordinator: "", alertCommander: "" },
            };
          }
        }

        analysis = parsed;
        affectedPopulation = (analysis.affectedPopulation as number) ?? 0;
        status = "complete";
      } catch (err) {
        console.error("[Simulator] LLM analysis failed:", err);
        status = "error";
        analysisText = "LLM analysis failed. Please try again.";
      }

      if (db) {
        await db.update(stormSimulations)
          .set({ analysis, analysisText, affectedPopulation, status, updatedAt: new Date() })
          .where(eq(stormSimulations.simId, simId));
      }

      return {
        simId,
        name: input.name,
        stormType: input.stormType,
        category: input.category ?? null,
        windSpeedKph: input.windSpeedKph,
        radiusKm: input.radiusKm,
        forwardSpeedKph: input.forwardSpeedKph,
        track: input.track,
        landfall: input.landfall ?? null,
        analysis,
        analysisText,
        affectedPopulation,
        status,
        createdAt: new Date().toISOString(),
      };
    }),

  /**
   * List all past simulations (most recent first).
   */
  list: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select({
          simId: stormSimulations.simId,
          name: stormSimulations.name,
          stormType: stormSimulations.stormType,
          category: stormSimulations.category,
          windSpeedKph: stormSimulations.windSpeedKph,
          radiusKm: stormSimulations.radiusKm,
          affectedPopulation: stormSimulations.affectedPopulation,
          status: stormSimulations.status,
          createdAt: stormSimulations.createdAt,
        })
        .from(stormSimulations)
        .orderBy(desc(stormSimulations.createdAt))
        .limit(input.limit);

      return rows;
    }),

  /**
   * Get a single simulation by ID.
   */
  get: publicProcedure
    .input(z.object({ simId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [row] = await db
        .select()
        .from(stormSimulations)
        .where(eq(stormSimulations.simId, input.simId))
        .limit(1);

      return row ?? null;
    }),

  /**
   * Delete a simulation by ID.
   */
  delete: publicProcedure
    .input(z.object({ simId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      await db.delete(stormSimulations).where(eq(stormSimulations.simId, input.simId));
      return { success: true };
    }),
});
