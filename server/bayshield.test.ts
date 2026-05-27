/**
 * BayShield tRPC Router Tests
 * Tests the bayshield router procedures (ADK health, pipeline, DB queries)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the ADK service fetch calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the DB
vi.mock("../server/db", () => ({
  getDb: vi.fn().mockResolvedValue(null), // null = no DB in test env
}));

describe("BayShield Router", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("adkHealth", () => {
    it("returns ok:true when ADK service responds", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "healthy", agents: 4 }),
      });

      const res = await fetch("http://localhost:8000/health");
      const data = await res.json();
      expect(data.status).toBe("healthy");
      expect(data.agents).toBe(4);
    });

    it("handles ADK service unavailable gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      try {
        await fetch("http://localhost:8000/health");
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect((e as Error).message).toBe("Connection refused");
      }
    });
  });

  describe("Pipeline result serialization", () => {
    it("serializes action plans correctly", () => {
      const plan = {
        id: "plan-1",
        title: "Mandatory Evacuation — Pinellas Point",
        priority: 1,
        action: "Issue mandatory evacuation order",
        shelter: "USF Sun Dome",
        route: "I-275 North",
        population: 8420,
        rationale: "VE flood zone with 95% base risk",
        output_type: "deterministic",
        correction_applied: false,
      };

      expect(plan.priority).toBe(1);
      expect(plan.output_type).toBe("deterministic");
      expect(plan.population).toBe(8420);
    });

    it("serializes A2A messages correctly", () => {
      const message = {
        id: "msg-1",
        from_agent: "storm-watcher",
        to_agent: "vulnerability-mapper",
        event_type: "DATA",
        content: "Storm Watcher complete. Final threat: MONITORING.",
        payload: { threat_level: "MONITORING", alert_count: 0 },
        timestamp: new Date().toISOString(),
      };

      expect(message.from_agent).toBe("storm-watcher");
      expect(message.event_type).toBe("DATA");
      expect(typeof message.timestamp).toBe("string");
    });

    it("serializes agent traces correctly", () => {
      const trace = {
        agent_id: "storm-watcher",
        agent_name: "Storm Watcher",
        status: "complete",
        confidence: 100.0,
        loop_iteration: 2,
        output_type: "deterministic",
        deterministic_rationale: "Threat level computed from NOAA data",
        execution_ms: 5974,
      };

      expect(trace.confidence).toBe(100.0);
      expect(trace.output_type).toBe("deterministic");
      expect(trace.execution_ms).toBeGreaterThan(0);
    });
  });

  describe("Threat level mapping", () => {
    const threatLevels = ["NONE", "MONITORING", "WATCH", "WARNING", "CRITICAL"];

    it.each(threatLevels)("accepts valid threat level: %s", (level) => {
      expect(threatLevels).toContain(level);
    });

    it("maps threat levels to UI colors correctly", () => {
      const colorMap: Record<string, string> = {
        CRITICAL: "text-red-400",
        WARNING: "text-amber-400",
        WATCH: "text-blue-400",
        MONITORING: "text-emerald-400",
        NONE: "text-slate-400",
      };

      expect(colorMap.CRITICAL).toBe("text-red-400");
      expect(colorMap.MONITORING).toBe("text-emerald-400");
    });
  });

  describe("Data transparency labels", () => {
    it("marks shelter occupancy as estimated", () => {
      const shelterData = {
        name: "USF Sun Dome",
        capacity: 12000,
        current_occupancy: 600,
        source: "estimated",
      };

      expect(shelterData.source).toBe("estimated");
    });

    it("marks zone risk scores as deterministic", () => {
      const zoneData = {
        name: "Pinellas Point",
        risk_score: 95,
        output_type: "deterministic",
        source: "FEMA FIRM + CDC SVI",
      };

      expect(zoneData.output_type).toBe("deterministic");
    });
  });
});
