import crypto from "crypto";

const CENSUS_BLOCKS_URL =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/2/query";

type ExposureFeature = {
  geoid: string;
  population: number;
};

type ZoneExposure = {
  population: number;
  blockCount: number;
  source: "census-2020-blocks";
  blocks: ExposureFeature[];
};

const exposureCache = new Map<string, ZoneExposure>();

function makePolygonCacheKey(polygons: number[][][]) {
  return crypto.createHash("sha1").update(JSON.stringify(polygons)).digest("hex");
}

function buildEsriPolygon(ring: number[][]) {
  return {
    rings: [
      ring.map(([lat, lng]) => [lng, lat]),
    ],
    spatialReference: { wkid: 4326 },
  };
}

async function queryBlocksForRing(ring: number[][]): Promise<ExposureFeature[]> {
  const params = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify(buildEsriPolygon(ring)),
    geometryType: "esriGeometryPolygon",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "GEOID,POP100",
    returnGeometry: "false",
    f: "json",
  });

  const response = await fetch(`${CENSUS_BLOCKS_URL}?${params.toString()}`, {
    headers: {
      "User-Agent": "BayShield/3.0",
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Census blocks query failed: ${response.status}`);
  }

  const data = await response.json() as {
    features?: Array<{
      attributes?: {
        GEOID?: string;
        POP100?: number | string;
      };
    }>;
  };

  return (data.features ?? [])
    .map(feature => ({
      geoid: String(feature.attributes?.GEOID ?? ""),
      population: Number(feature.attributes?.POP100 ?? 0),
    }))
    .filter(feature => feature.geoid.length > 0);
}

export async function estimatePopulationFromPolygons(polygons: number[][][]) {
  if (!polygons.length) {
    return {
      population: 0,
      blockCount: 0,
      source: "census-2020-blocks" as const,
      blocks: [],
    };
  }

  const cacheKey = makePolygonCacheKey(polygons);
  const cached = exposureCache.get(cacheKey);
  if (cached) return cached;

  const blockMap = new Map<string, ExposureFeature>();
  for (const ring of polygons) {
    if (ring.length < 3) continue;
    const features = await queryBlocksForRing(ring);
    for (const feature of features) {
      if (!blockMap.has(feature.geoid)) {
        blockMap.set(feature.geoid, feature);
      }
    }
  }

  const blocks = Array.from(blockMap.values());
  const exposure: ZoneExposure = {
    population: blocks.reduce((sum, block) => sum + block.population, 0),
    blockCount: blocks.length,
    source: "census-2020-blocks",
    blocks,
  };

  exposureCache.set(cacheKey, exposure);
  return exposure;
}
