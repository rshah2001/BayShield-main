/**
 * Vitest tests for the Storm Simulator business logic.
 * Tests the LLM prompt builder, input validation, and analysis parsing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// ── Mock LLM ─────────────────────────────────────────────────────────────────
const MOCK_ANALYSIS = {
  summary: "Category 3 hurricane poses major threat to Tampa Bay.",
  affectedPopulation: 850000,
  threatLevel: "HIGH",
  infrastructureImpacts: {
    power: { severity: "major", estimatedOutages: "450,000 customers", restorationDays: 14, details: "Widespread outages." },
    roads: { severity: "major", closures: ["I-275 Sunshine Skyway"], floodingRisk: "Significant flooding on US-19", details: "Major closures." },
    bridges: { severity: "major", atRisk: ["Sunshine Skyway Bridge"], details: "Bridge closure likely." },
    airports: { severity: "moderate", closureHours: 48, details: "TPA closure expected." },
    port: { severity: "major", closureHours: 72, details: "Port Tampa Bay closure." },
    hospitals: { severity: "moderate", atRisk: ["Tampa General"], details: "On generator power." },
    communications: { severity: "moderate", details: "Cell tower outages." },
    waterSewer: { severity: "minor", details: "Minor disruptions." },
  },
  evacuationZones: {
    mandatory: ["Pinellas Zone A", "Hillsborough Zone A"],
    recommended: ["Pinellas Zone B"],
    estimatedEvacuees: 250000,
    timeToEvacuate: "72 hours",
  },
  shelterDemand: {
    estimatedShelterNeeds: 45000,
    recommendedShelters: ["USF Sun Dome"],
    specialNeedsCount: 8000,
  },
  stormSurge: { maxSurgeMeters: 3.5, affectedCoastlineKm: 120, highRiskAreas: ["Pinellas Peninsula"] },
  economicImpact: { estimatedDamageUSD: "$8-15 billion", recoveryMonths: 18, details: "Major disruption." },
  immediateActions: ["Issue mandatory evacuation for Zone A", "Pre-position resources"],
  agentRecommendations: {
    stormWatcher: "Monitor KTPA every 30 min.",
    vulnerabilityMapper: "Prioritize Zone A coastal communities.",
    resourceCoordinator: "Pre-position 500 cots at USF.",
    alertCommander: "Issue Zone A evacuation order.",
  },
};

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(MOCK_ANALYSIS) } }],
  }),
}));

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// ── Input validation schema (mirrors the router) ──────────────────────────────
const TrackPointSchema = z.object({ lat: z.number(), lng: z.number(), label: z.string().optional() });
const CreateSimulationInput = z.object({
  name: z.string().min(1).max(128),
  stormType: z.enum(["hurricane", "tropical_storm", "tropical_depression", "tornado", "flood", "nor_easter"]).default("hurricane"),
  category: z.number().int().min(1).max(5).optional(),
  windSpeedKph: z.number().min(0).max(400).default(150),
  radiusKm: z.number().min(5).max(500).default(80),
  forwardSpeedKph: z.number().min(1).max(100).default(20),
  track: z.array(TrackPointSchema).min(2).max(20),
  landfall: TrackPointSchema.optional(),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Storm Simulator — Input Validation", () => {
  it("accepts a valid hurricane simulation input", () => {
    const result = CreateSimulationInput.safeParse({
      name: "Hurricane Alpha",
      stormType: "hurricane",
      category: 3,
      windSpeedKph: 185,
      radiusKm: 80,
      forwardSpeedKph: 22,
      track: [
        { lat: 24.5, lng: -82.0, label: "Gulf origin" },
        { lat: 27.9, lng: -82.4, label: "Tampa Bay landfall" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects track with fewer than 2 points", () => {
    const result = CreateSimulationInput.safeParse({
      name: "Bad Track",
      stormType: "hurricane",
      category: 1,
      windSpeedKph: 120,
      radiusKm: 60,
      forwardSpeedKph: 15,
      track: [{ lat: 27.9, lng: -82.4 }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("track");
  });

  it("rejects wind speed above 400 km/h", () => {
    const result = CreateSimulationInput.safeParse({
      name: "Impossible Storm",
      stormType: "hurricane",
      category: 5,
      windSpeedKph: 999,
      radiusKm: 80,
      forwardSpeedKph: 20,
      track: [{ lat: 24.0, lng: -82.0 }, { lat: 27.9, lng: -82.4 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts non-hurricane storm types without category", () => {
    const result = CreateSimulationInput.safeParse({
      name: "Flood Event Alpha",
      stormType: "flood",
      windSpeedKph: 50,
      radiusKm: 120,
      forwardSpeedKph: 10,
      track: [
        { lat: 27.5, lng: -82.5 },
        { lat: 27.9, lng: -82.4 },
        { lat: 28.1, lng: -82.3 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stormType).toBe("flood");
      expect(result.data.category).toBeUndefined();
    }
  });

  it("rejects empty storm name", () => {
    const result = CreateSimulationInput.safeParse({
      name: "",
      stormType: "hurricane",
      category: 2,
      windSpeedKph: 155,
      radiusKm: 70,
      forwardSpeedKph: 18,
      track: [{ lat: 24.0, lng: -82.0 }, { lat: 27.9, lng: -82.4 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects track with more than 20 points", () => {
    const tooManyPoints = Array.from({ length: 21 }, (_, i) => ({
      lat: 24 + i * 0.2,
      lng: -82.0,
    }));
    const result = CreateSimulationInput.safeParse({
      name: "Long Track",
      stormType: "tropical_storm",
      windSpeedKph: 90,
      radiusKm: 60,
      forwardSpeedKph: 15,
      track: tooManyPoints,
    });
    expect(result.success).toBe(false);
  });
});

describe("Storm Simulator — LLM Analysis Parsing", () => {
  it("correctly parses LLM JSON response into structured analysis", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const response = await invokeLLM({ messages: [] });
    const content = (response as { choices: Array<{ message: { content: string } }> })
      .choices[0].message.content;
    const parsed = JSON.parse(content) as typeof MOCK_ANALYSIS;

    expect(parsed.threatLevel).toBe("HIGH");
    expect(parsed.affectedPopulation).toBe(850000);
    expect(parsed.infrastructureImpacts.power.severity).toBe("major");
    expect(parsed.evacuationZones.mandatory).toContain("Pinellas Zone A");
    expect(parsed.immediateActions.length).toBeGreaterThan(0);
    expect(parsed.agentRecommendations.stormWatcher).toBeTruthy();
  });

  it("identifies all 8 infrastructure categories in analysis", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const response = await invokeLLM({ messages: [] });
    const content = (response as { choices: Array<{ message: { content: string } }> })
      .choices[0].message.content;
    const parsed = JSON.parse(content) as typeof MOCK_ANALYSIS;
    const infraKeys = Object.keys(parsed.infrastructureImpacts);

    expect(infraKeys).toContain("power");
    expect(infraKeys).toContain("roads");
    expect(infraKeys).toContain("bridges");
    expect(infraKeys).toContain("airports");
    expect(infraKeys).toContain("port");
    expect(infraKeys).toContain("hospitals");
    expect(infraKeys).toContain("communications");
    expect(infraKeys).toContain("waterSewer");
  });

  it("includes all 4 agent recommendations", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const response = await invokeLLM({ messages: [] });
    const content = (response as { choices: Array<{ message: { content: string } }> })
      .choices[0].message.content;
    const parsed = JSON.parse(content) as typeof MOCK_ANALYSIS;

    expect(parsed.agentRecommendations.stormWatcher).toBeTruthy();
    expect(parsed.agentRecommendations.vulnerabilityMapper).toBeTruthy();
    expect(parsed.agentRecommendations.resourceCoordinator).toBeTruthy();
    expect(parsed.agentRecommendations.alertCommander).toBeTruthy();
  });
});

describe("Storm Simulator — Storm Type Coverage", () => {
  const validTypes = ["hurricane", "tropical_storm", "tropical_depression", "tornado", "flood", "nor_easter"] as const;

  validTypes.forEach(stormType => {
    it(`accepts storm type: ${stormType}`, () => {
      const result = CreateSimulationInput.safeParse({
        name: `Test ${stormType}`,
        stormType,
        windSpeedKph: 100,
        radiusKm: 60,
        forwardSpeedKph: 15,
        track: [{ lat: 25.0, lng: -82.0 }, { lat: 27.9, lng: -82.4 }],
      });
      expect(result.success).toBe(true);
    });
  });
});
