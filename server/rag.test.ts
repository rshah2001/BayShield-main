import { describe, expect, it } from "vitest";
import {
  createDynamicContextDocument,
  formatRetrievedContext,
  retrieveBayShieldContext,
} from "./_core/rag";

describe("BayShield RAG retrieval", () => {
  it("retrieves dynamic latest-run context for operational questions", () => {
    const latestRun = createDynamicContextDocument(
      "Latest Pipeline Run",
      "Threat level: CRITICAL\nPopulation at risk: 48200\nAction plans: P1 Mandatory evacuation for Pinellas Point"
    );

    const results = retrieveBayShieldContext("What is the latest threat level for Pinellas Point?", {
      dynamicDocuments: [latestRun],
      limit: 3,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.source).toBe("runtime/latest-run");
    expect(results[0]?.content).toContain("CRITICAL");
  });

  it("formats retrieved chunks for prompt injection safely", () => {
    const latestRun = createDynamicContextDocument(
      "Latest Pipeline Run",
      "Threat level: WARNING"
    );

    const formatted = formatRetrievedContext([{
      ...latestRun,
      score: 9,
    }]);

    expect(formatted).toContain("[Context 1]");
    expect(formatted).toContain("Source: runtime/latest-run");
  });
});
