import fs from "fs";
import path from "path";

type SourceDocument = {
  id: string;
  title: string;
  source: string;
  content: string;
};

export type RetrievedChunk = {
  id: string;
  title: string;
  source: string;
  content: string;
  score: number;
};

type RetrieveOptions = {
  limit?: number;
  dynamicDocuments?: SourceDocument[];
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "what",
  "with",
]);

const SYNONYM_MAP: Record<string, string[]> = {
  hurricane: ["storm", "tropical", "cyclone"],
  storm: ["hurricane", "tropical"],
  weather: ["temperature", "wind", "conditions"],
  current: ["latest", "live", "now"],
  latest: ["current", "live", "recent"],
  shelter: ["capacity", "occupancy", "resource"],
  evacuation: ["route", "evacuate", "shelter"],
  agents: ["pipeline", "system", "workflow"],
  system: ["agents", "pipeline", "dashboard"],
  damage: ["impact", "flood", "surge", "wind"],
};

const projectRoot = process.cwd();
const MAX_CHARS_PER_CHUNK = 1200;
const SOURCE_FILES = [
  { relativePath: "README.md", title: "BayShield README" },
  { relativePath: "BAYSHIELD_README.md", title: "BayShield Product Notes" },
  { relativePath: "python-agents/agent-cards/agent-registry.json", title: "Agent Registry" },
  { relativePath: "package.json", title: "Project Dependencies" },
] as const;

let cachedDocuments: SourceDocument[] | null = null;

function tokenize(input: string): string[] {
  const baseTokens = input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));

  const expandedTokens = new Set<string>();
  for (const token of baseTokens) {
    expandedTokens.add(token);
    for (const synonym of SYNONYM_MAP[token] ?? []) {
      expandedTokens.add(synonym);
    }
    if (token.endsWith("s") && token.length > 3) {
      expandedTokens.add(token.slice(0, -1));
    }
  }

  return Array.from(expandedTokens);
}

function chunkText(source: string, title: string, text: string): SourceDocument[] {
  const cleaned = text.replace(/\r/g, "").trim();
  if (!cleaned) return [];

  const rawSections = cleaned
    .split(/\n(?=# )|\n(?=## )|\n(?=### )/)
    .map(section => section.trim())
    .filter(Boolean);

  const sections = rawSections.length > 0 ? rawSections : [cleaned];
  const chunks: SourceDocument[] = [];

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex];
    const lines = section.split("\n");
    const heading = lines[0]?.replace(/^#+\s*/, "").trim() || `${title} ${sectionIndex + 1}`;
    const body = lines.join("\n").trim();

    if (body.length <= MAX_CHARS_PER_CHUNK) {
      chunks.push({
        id: `${source}#${sectionIndex + 1}`,
        title: `${title} — ${heading}`,
        source,
        content: body,
      });
      continue;
    }

    for (let start = 0, chunkIndex = 0; start < body.length; start += MAX_CHARS_PER_CHUNK, chunkIndex++) {
      const slice = body.slice(start, start + MAX_CHARS_PER_CHUNK).trim();
      if (!slice) continue;
      chunks.push({
        id: `${source}#${sectionIndex + 1}.${chunkIndex + 1}`,
        title: `${title} — ${heading}`,
        source,
        content: slice,
      });
    }
  }

  return chunks;
}

function loadStaticDocuments(): SourceDocument[] {
  if (cachedDocuments) return cachedDocuments;

  cachedDocuments = SOURCE_FILES.flatMap(file => {
    const absolutePath = path.resolve(projectRoot, file.relativePath);
    if (!fs.existsSync(absolutePath)) return [];

    const content = fs.readFileSync(absolutePath, "utf8");
    return chunkText(file.relativePath, file.title, content);
  });

  return cachedDocuments;
}

function scoreChunk(queryTokens: string[], chunk: SourceDocument): number {
  if (queryTokens.length === 0) return 0;

  const titleTokens = new Set(tokenize(chunk.title));
  const contentTokens = new Set(tokenize(chunk.content));

  let score = 0;
  for (const token of queryTokens) {
    if (titleTokens.has(token)) score += 5;
    if (contentTokens.has(token)) score += 2;
    if (chunk.content.toLowerCase().includes(token)) score += 1;
  }

  const loweredContent = chunk.content.toLowerCase();
  const loweredTitle = chunk.title.toLowerCase();
  const exactQuery = queryTokens.join(" ");
  if (exactQuery && loweredContent.includes(exactQuery)) score += 8;
  if (exactQuery && loweredTitle.includes(exactQuery)) score += 10;

  return score;
}

export function retrieveBayShieldContext(
  query: string,
  options: RetrieveOptions = {}
): RetrievedChunk[] {
  const queryTokens = tokenize(query);
  const documents = [
    ...loadStaticDocuments(),
    ...(options.dynamicDocuments ?? []),
  ];

  return documents
    .map(doc => ({ ...doc, score: scoreChunk(queryTokens, doc) }))
    .filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 4);
}

export function createDynamicContextDocument(
  title: string,
  content: string,
  source = "runtime/latest-run"
): SourceDocument {
  return {
    id: source,
    title,
    source,
    content,
  };
}

export function formatRetrievedContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "No relevant BayShield context was retrieved.";
  }

  return chunks
    .map(
      (chunk, index) =>
        `[Context ${index + 1}] ${chunk.title}\nSource: ${chunk.source}\n${chunk.content}`
    )
    .join("\n\n");
}
