import { describe, expect, it } from "vitest";
import {
  findSimilarStorms,
  getHistoricalOverview,
  loadHistoricalStorms,
} from "./_core/historicalStorms";

describe("historical hurricane dataset", () => {
  it("loads storms from the project-local Kaggle CSV", () => {
    const storms = loadHistoricalStorms();

    expect(storms.length).toBeGreaterThanOrEqual(300);
    expect(storms.some(storm => /\bFL\b/.test(storm.states))).toBe(true);
  });

  it("returns overview metrics", () => {
    const overview = getHistoricalOverview();

    expect(overview.totalStorms).toBeGreaterThanOrEqual(300);
    expect(overview.majorStorms).toBeGreaterThan(0);
    expect(overview.strongestStorms.length).toBeGreaterThan(0);
  });

  it("finds similar Florida storms", () => {
    const matches = findSimilarStorms({
      category: 4,
      maxWindKt: 145,
      pressure: 942,
      states: "FL",
      limit: 3,
    });

    expect(matches.length).toBeGreaterThan(0);
  });
});
