const FL511_TRAFFIC_URL = "https://www.fl511.com/List/GetData/traffic";
const FL511_BRIDGE_URL = "https://www.fl511.com/List/GetData/Bridge";
const DUKE_OUTAGE_URL = "https://services3.arcgis.com/oX5r75R7mapdoI2F/arcgis/rest/services/Duke_Energy_Distribution_Outages_Public/FeatureServer/1/query?where=1%3D1&outFields=*&f=json&returnGeometry=false";

const TAMPA_BAY_COUNTIES = new Set([
  "HILLSBOROUGH",
  "PINELLAS",
  "PASCO",
  "MANATEE",
  "HERNANDO",
  "SARASOTA",
  "POLK",
]);

type Fl511TrafficRecord = {
  id: number;
  type?: string;
  roadwayName?: string;
  description?: string;
  severity?: string;
  direction?: string;
  county?: string;
  region?: string;
  lastUpdated?: string;
  laneDescription?: string;
  startDate?: string;
};

type Fl511BridgeRecord = {
  name?: string;
  roadway?: string;
  county?: string;
  status?: string;
  direction?: string;
  lastUpdated?: string;
};

type DukeCountyRecord = {
  COUNTY_NAME?: string;
  CUSTOMER_SERVED?: number;
  CUSTOMER_OUT?: number;
  STATE_NAME?: string;
  ETR?: string | null;
  PERCENT_OUT?: number;
};

export type InfrastructureSignals = {
  generatedAt: string;
  roadIncidentsTotal: number;
  roadClosuresTotal: number;
  bridgeClosuresTotal: number;
  dukeCustomersOut: number;
  dukeCustomersServed: number;
  dukePercentOut: number;
  dukeCountyCount: number;
  feedStatus: "live" | "partial" | "unavailable";
  sourceSummary: string[];
  roadIncidents: Array<{
    id: string;
    roadway: string;
    county: string;
    severity: string;
    type: string;
    laneStatus: string;
    description: string;
    updatedAt: string | null;
  }>;
  bridgeClosures: Array<{
    name: string;
    roadway: string;
    county: string;
    status: string;
    direction: string;
    updatedAt: string | null;
  }>;
  dukeOutages: Array<{
    county: string;
    customersOut: number;
    customersServed: number;
    percentOut: number;
    etr: string | null;
  }>;
};

function normalizeCountyName(value: string | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function isTampaBayCounty(value: string | undefined) {
  return TAMPA_BAY_COUNTIES.has(normalizeCountyName(value));
}

function isRoadClosure(record: Fl511TrafficRecord) {
  const type = String(record.type ?? "").toLowerCase();
  const description = String(record.description ?? "").toLowerCase();
  const lane = String(record.laneDescription ?? "").toLowerCase();
  return type.includes("closure") || description.includes("all lanes closed") || lane.includes("all lanes");
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Feed request failed ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json() as Promise<unknown>;
}

function buildTrafficPayload() {
  return {
    draw: 1,
    columns: [
      { data: "region", name: "region", searchable: false, orderable: false, search: { value: "", regex: false } },
      { data: "county", name: "county", searchable: false, orderable: false, search: { value: "", regex: false } },
      { data: "roadwayName", name: "roadwayName", searchable: false, orderable: true, search: { value: "", regex: false } },
      { data: "direction", name: "direction", searchable: false, orderable: true, search: { value: "", regex: false } },
      { data: "type", name: "type", searchable: false, orderable: false, search: { value: "", regex: false } },
      { data: "severity", name: "severity", searchable: false, orderable: true, search: { value: "", regex: false } },
      { data: "description", name: "description", searchable: false, orderable: false, search: { value: "", regex: false } },
      { data: "startDate", name: "startDate", searchable: false, orderable: true, search: { value: "", regex: false } },
      { data: "lastUpdated", name: "lastUpdated", searchable: false, orderable: true, search: { value: "", regex: false } },
    ],
    order: [{ column: 8, dir: "desc" }],
    start: 0,
    length: 250,
    search: { value: "", regex: false },
  };
}

function buildBridgePayload() {
  return {
    draw: 1,
    columns: [
      { data: "filterAndOrderProperty1", name: "filterAndOrderProperty1", searchable: true, orderable: true, search: { value: "", regex: false } },
      { data: "filterAndOrderProperty2", name: "filterAndOrderProperty2", searchable: true, orderable: true, search: { value: "", regex: false } },
      { data: "filterAndOrderProperty3", name: "filterAndOrderProperty3", searchable: true, orderable: true, search: { value: "", regex: false } },
      { data: "filterAndOrderProperty6", name: "filterAndOrderProperty6", searchable: true, orderable: true, search: { value: "", regex: false } },
      { data: "filterAndOrderProperty4", name: "filterAndOrderProperty4", searchable: true, orderable: true, search: { value: "", regex: false } },
      { data: "filterAndOrderProperty5", name: "filterAndOrderProperty5", searchable: true, orderable: true, search: { value: "", regex: false } },
    ],
    order: [{ column: 0, dir: "asc" }],
    start: 0,
    length: 100,
    search: { value: "", regex: false },
  };
}

export async function fetchInfrastructureSignals(): Promise<InfrastructureSignals> {
  const sourceSummary: string[] = [];
  const generatedAt = new Date().toISOString();

  let roadIncidents: InfrastructureSignals["roadIncidents"] = [];
  let bridgeClosures: InfrastructureSignals["bridgeClosures"] = [];
  let dukeOutages: InfrastructureSignals["dukeOutages"] = [];
  let feedStatus: InfrastructureSignals["feedStatus"] = "live";

  try {
    const trafficResponse = await fetchJson(FL511_TRAFFIC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildTrafficPayload()),
    }) as { data?: Fl511TrafficRecord[] };

    roadIncidents = (trafficResponse.data ?? [])
      .filter(record => record.region === "Tampa Bay" || isTampaBayCounty(record.county))
      .map(record => ({
        id: String(record.id),
        roadway: String(record.roadwayName ?? "Unknown roadway"),
        county: String(record.county ?? "Unknown county"),
        severity: String(record.severity ?? "Unknown"),
        type: String(record.type ?? "Traffic"),
        laneStatus: String(record.laneDescription ?? "Unknown"),
        description: String(record.description ?? "No description"),
        updatedAt: record.lastUpdated ?? null,
      }))
      .slice(0, 25);

    sourceSummary.push("FL511 traffic incidents");
  } catch (error) {
    feedStatus = "partial";
    sourceSummary.push(`FL511 traffic unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const bridgeResponse = await fetchJson(FL511_BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBridgePayload()),
    }) as { data?: Fl511BridgeRecord[] };

    bridgeClosures = (bridgeResponse.data ?? [])
      .filter(record => isTampaBayCounty(record.county))
      .map(record => ({
        name: String(record.name ?? "Unknown bridge"),
        roadway: String(record.roadway ?? "Unknown roadway"),
        county: String(record.county ?? "Unknown county"),
        status: String(record.status ?? "Unknown"),
        direction: String(record.direction ?? ""),
        updatedAt: record.lastUpdated ?? null,
      }))
      .slice(0, 20);

    sourceSummary.push("FL511 bridge status");
  } catch (error) {
    feedStatus = feedStatus === "live" ? "partial" : feedStatus;
    sourceSummary.push(`FL511 bridges unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const dukeResponse = await fetchJson(DUKE_OUTAGE_URL) as { features?: Array<{ attributes?: DukeCountyRecord }> };
    dukeOutages = (dukeResponse.features ?? [])
      .map(feature => feature.attributes ?? {})
      .filter(record => record.STATE_NAME === "FLORIDA" && isTampaBayCounty(record.COUNTY_NAME))
      .map(record => ({
        county: String(record.COUNTY_NAME ?? "Unknown"),
        customersOut: Number(record.CUSTOMER_OUT ?? 0),
        customersServed: Number(record.CUSTOMER_SERVED ?? 0),
        percentOut: Number(record.PERCENT_OUT ?? 0),
        etr: record.ETR ?? null,
      }))
      .filter(record => record.customersServed > 0 || record.customersOut > 0);

    sourceSummary.push("Duke Energy Florida county outages");
    sourceSummary.push("TECO outage map is public but does not expose a stable structured feed");
  } catch (error) {
    feedStatus = feedStatus === "live" ? "partial" : feedStatus;
    sourceSummary.push(`Duke outage feed unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (roadIncidents.length === 0 && bridgeClosures.length === 0 && dukeOutages.length === 0) {
    feedStatus = "unavailable";
  }

  const roadClosuresTotal = roadIncidents.filter(record => {
    const type = record.type.toLowerCase();
    const description = record.description.toLowerCase();
    const lane = record.laneStatus.toLowerCase();
    return type.includes("closure") || description.includes("closed") || lane.includes("closed") || lane.includes("blocked");
  }).length;

  const dukeCustomersOut = dukeOutages.reduce((sum, county) => sum + county.customersOut, 0);
  const dukeCustomersServed = dukeOutages.reduce((sum, county) => sum + county.customersServed, 0);
  const dukePercentOut = dukeCustomersServed > 0 ? dukeCustomersOut / dukeCustomersServed : 0;

  return {
    generatedAt,
    roadIncidentsTotal: roadIncidents.length,
    roadClosuresTotal,
    bridgeClosuresTotal: bridgeClosures.filter(bridge => bridge.status.toLowerCase().includes("down") || bridge.status.toLowerCase().includes("closed")).length,
    dukeCustomersOut,
    dukeCustomersServed,
    dukePercentOut,
    dukeCountyCount: dukeOutages.length,
    feedStatus,
    sourceSummary,
    roadIncidents,
    bridgeClosures,
    dukeOutages,
  };
}
