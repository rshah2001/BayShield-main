import fs from "fs";
import path from "path";

export type HistoricalStorm = {
  year: number;
  month: string;
  states: string;
  category: number | null;
  pressure: number | null;
  maxWindKt: number | null;
  name: string | null;
  normalizedName: string;
};

export type HistoricalOverview = {
  totalStorms: number;
  namedStorms: number;
  floridaStorms: number;
  majorStorms: number;
  averageMaxWindKt: number | null;
  averagePressureMb: number | null;
  strongestStorms: HistoricalStorm[];
  categoryBreakdown: Array<{ category: string; count: number }>;
};

const DATA_PATH = path.resolve(process.cwd(), "data/us-hurricane-data.csv");

let cachedStorms: HistoricalStorm[] | null = null;

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-----") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanName(value: string): string | null {
  const trimmed = value.trim().replace(/^"+|"+$/g, "");
  if (!trimmed || trimmed === "-----") return null;
  return trimmed;
}

function isDecadeRow(year: string): boolean {
  return /^\d{4}s$/.test(year.trim());
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

export function loadHistoricalStorms(): HistoricalStorm[] {
  if (cachedStorms) return cachedStorms;
  if (!fs.existsSync(DATA_PATH)) return [];

  const raw = fs.readFileSync(DATA_PATH, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter(Boolean);

  cachedStorms = lines
    .slice(1)
    .map(splitCsvLine)
    .filter(parts => parts.length >= 7)
    .filter(parts => !isDecadeRow(parts[0]))
    .filter(parts => parts[1].trim().toLowerCase() !== "none")
    .map(parts => {
      const name = cleanName(parts[6]);
      return {
        year: Number(parts[0]),
        month: parts[1].trim(),
        states: parts[2].trim(),
        category: toNumber(parts[3]),
        pressure: toNumber(parts[4]),
        maxWindKt: toNumber(parts[5]),
        name,
        normalizedName: (name ?? "Unnamed storm").toLowerCase(),
      };
    })
    .filter(storm => Number.isFinite(storm.year));

  return cachedStorms;
}

function average(values: Array<number | null>): number | null {
  const filtered = values.filter((value): value is number => typeof value === "number");
  if (filtered.length === 0) return null;
  return Math.round((filtered.reduce((sum, value) => sum + value, 0) / filtered.length) * 10) / 10;
}

export function getHistoricalOverview(): HistoricalOverview {
  const storms = loadHistoricalStorms();
  const floridaStorms = storms.filter(storm => /\bFL\b/.test(storm.states)).length;
  const majorStorms = storms.filter(storm => (storm.category ?? 0) >= 3).length;
  const namedStorms = storms.filter(storm => storm.name).length;

  const categoryMap = new Map<string, number>();
  for (const storm of storms) {
    const key = storm.category === null ? "Unknown" : `Cat ${storm.category}`;
    categoryMap.set(key, (categoryMap.get(key) ?? 0) + 1);
  }

  const strongestStorms = [...storms]
    .sort((a, b) => (b.maxWindKt ?? -1) - (a.maxWindKt ?? -1))
    .slice(0, 5);

  return {
    totalStorms: storms.length,
    namedStorms,
    floridaStorms,
    majorStorms,
    averageMaxWindKt: average(storms.map(storm => storm.maxWindKt)),
    averagePressureMb: average(storms.map(storm => storm.pressure)),
    strongestStorms,
    categoryBreakdown: Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
  };
}

type SimilarStormOptions = {
  category?: number | null;
  maxWindKt?: number | null;
  pressure?: number | null;
  states?: string | null;
  limit?: number;
};

export function findSimilarStorms(options: SimilarStormOptions): HistoricalStorm[] {
  const storms = loadHistoricalStorms();

  return [...storms]
    .map(storm => {
      let score = 0;

      if (typeof options.category === "number" && storm.category !== null) {
        score += Math.max(0, 40 - Math.abs(storm.category - options.category) * 18);
      }

      if (typeof options.maxWindKt === "number" && storm.maxWindKt !== null) {
        score += Math.max(0, 35 - Math.abs(storm.maxWindKt - options.maxWindKt) / 4);
      }

      if (typeof options.pressure === "number" && storm.pressure !== null) {
        score += Math.max(0, 25 - Math.abs(storm.pressure - options.pressure) / 2);
      }

      if (options.states && storm.states.includes(options.states)) {
        score += 18;
      }

      return { storm, score };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 5)
    .map(entry => entry.storm);
}
