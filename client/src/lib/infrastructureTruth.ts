import type { InfrastructurePrediction, ThreatLevel } from '@/lib/stormData';

type LiveZoneSignal = {
  status: string;
  riskScore: number;
};

type ShelterSignal = {
  capacity: number;
  currentOccupancy: number;
};

type InfrastructureTruthInput = {
  threatLevel: ThreatLevel;
  windMph: number;
  stormCategory: number;
  alertCount: number;
  criticalAlertCount: number;
  warningAlertCount: number;
  hotZoneCount: number;
  watchZoneCount: number;
  totalPopulationAtRisk: number;
  vulnerabilityZones: LiveZoneSignal[];
  shelters: ShelterSignal[];
  sourceLabel: string;
  officialRoadClosures?: number;
  officialBridgeClosures?: number;
  officialOutagePercent?: number;
  officialOutageCustomers?: number;
};

const HORIZONS = [
  { timeframe: 'Now', factor: 1.0 },
  { timeframe: 'T+6h', factor: 1.08 },
  { timeframe: 'T+12h', factor: 1.15 },
  { timeframe: 'T+24h', factor: 1.22 },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getThreatBase(threatLevel: ThreatLevel) {
  switch (threatLevel) {
    case 'critical':
      return 62;
    case 'warning':
      return 40;
    case 'advisory':
      return 22;
    default:
      return 8;
  }
}

function formatMoney(amount: number) {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(0)}M`;
  return `$${Math.round(amount / 1_000).toLocaleString()}K`;
}

function getHospitalRisk(score: number): InfrastructurePrediction['hospitalRisk'] {
  if (score >= 78) return 'critical';
  if (score >= 58) return 'high';
  if (score >= 32) return 'moderate';
  return 'low';
}

function getWindDamageRisk(score: number): InfrastructurePrediction['windDamageRisk'] {
  if (score >= 84) return 'extreme';
  if (score >= 58) return 'high';
  if (score >= 28) return 'moderate';
  return 'low';
}

export function buildInfrastructureTruthModel(input: InfrastructureTruthInput): InfrastructurePrediction[] {
  const {
    threatLevel,
    windMph,
    stormCategory,
    alertCount,
    criticalAlertCount,
    warningAlertCount,
    hotZoneCount,
    watchZoneCount,
    totalPopulationAtRisk,
    vulnerabilityZones,
    shelters,
    sourceLabel,
    officialRoadClosures = 0,
    officialBridgeClosures = 0,
    officialOutagePercent = 0,
    officialOutageCustomers = 0,
  } = input;

  const totalCapacity = shelters.reduce((sum, shelter) => sum + shelter.capacity, 0);
  const totalOccupancy = shelters.reduce((sum, shelter) => sum + shelter.currentOccupancy, 0);
  const shelterBufferPct = totalCapacity > 0
    ? ((totalCapacity - totalOccupancy) / totalCapacity) * 100
    : 100;
  const liveRiskMean = vulnerabilityZones.length > 0
    ? vulnerabilityZones.reduce((sum, zone) => sum + zone.riskScore, 0) / vulnerabilityZones.length
    : 0;
  const actionableZoneCount = vulnerabilityZones.filter(zone => zone.status !== 'safe').length;
  const activeThreat = alertCount > 0 || hotZoneCount > 0 || windMph >= 20 || stormCategory > 0;

  const baseThreat = getThreatBase(threatLevel);
  const powerSeed = clamp(
    baseThreat
      + (criticalAlertCount * 12)
      + (warningAlertCount * 5)
      + (hotZoneCount * 8)
      + (watchZoneCount * 3)
      + Math.max(0, windMph - 18) * 0.95
      + (stormCategory * 9)
      + ((100 - shelterBufferPct) * 0.18)
      + (liveRiskMean * 0.12),
    2,
    92,
  );
  const powerSeedWithOfficial = clamp(
    powerSeed
      + (officialOutagePercent * 120)
      + Math.min(officialOutageCustomers / 250, 16),
    2,
    95,
  );

  const roadSeed = clamp(
    (baseThreat * 0.82)
      + (criticalAlertCount * 10)
      + (hotZoneCount * 11)
      + (watchZoneCount * 4)
      + Math.max(0, windMph - 22) * 0.55
      + (stormCategory * 5)
      + (actionableZoneCount * 2.5),
    1,
    88,
  );
  const roadSeedWithOfficial = clamp(
    roadSeed
      + (officialRoadClosures * 4.5)
      + (officialBridgeClosures * 6),
    1,
    94,
  );

  const floodSeed = clamp(
    (hotZoneCount * 2.1)
      + (watchZoneCount * 1.0)
      + (stormCategory * 1.6)
      + (criticalAlertCount * 1.4)
      + (warningAlertCount * 0.8)
      + (threatLevel === 'critical' ? 2.5 : threatLevel === 'warning' ? 1.3 : threatLevel === 'advisory' ? 0.7 : 0),
    0,
    15,
  );

  return HORIZONS.map(({ timeframe, factor }, index) => {
    const activeFactor = activeThreat ? factor : Math.max(0.55, 1 - index * 0.1);
    const powerOutagePct = Math.round(clamp(powerSeedWithOfficial * activeFactor, 0, 100));
    const roadClosurePct = Math.round(clamp(roadSeedWithOfficial * activeFactor, 0, 100));
    const floodDepthFt = Math.round(clamp(floodSeed * activeFactor, 0, 20) * 10) / 10;
    const hospitalScore = clamp(
      (powerOutagePct * 0.4) + (roadClosurePct * 0.35) + (floodDepthFt * 4.2),
      0,
      100,
    );
    const recoveryDays = Math.max(
      activeThreat ? 2 : 1,
      Math.round(1 + (powerOutagePct * 0.14) + (roadClosurePct * 0.09) + (floodDepthFt * 1.4)),
    );
    const damageEstimate = formatMoney(
      (totalPopulationAtRisk * 3800)
      + (powerOutagePct * 2_800_000)
      + (roadClosurePct * 1_700_000)
      + (floodDepthFt * 22_000_000),
    );

    return {
      id: `live-infra-${index + 1}`,
      alertId: sourceLabel,
      timeframe,
      powerOutagePct,
      roadClosurePct,
      hospitalRisk: getHospitalRisk(hospitalScore),
      damageEstimate,
      recoveryDays,
      floodDepthFt,
      windDamageRisk: getWindDamageRisk(Math.round((powerOutagePct * 0.55) + (windMph * 0.9) + (stormCategory * 6))),
    };
  });
}
