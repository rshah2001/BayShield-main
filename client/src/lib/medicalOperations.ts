import type { ThreatLevel } from '@/lib/stormData';

export type MedicalFacility = {
  id: string;
  name: string;
  county: string;
  city: string;
  type: string;
  emergencyServices: boolean;
  lat: number;
  lng: number;
};

export type MedicalFacilityStatus = MedicalFacility & {
  accessRisk: number;
  status: 'accessible' | 'monitor' | 'disruption-risk';
  outagePressure: number;
  transportPressure: number;
  note: string;
};

export const TAMPA_BAY_MEDICAL_FACILITIES: MedicalFacility[] = [
  {
    id: 'tgh',
    name: 'Tampa General Hospital',
    county: 'Hillsborough',
    city: 'Tampa',
    type: 'Acute Care',
    emergencyServices: true,
    lat: 27.9382,
    lng: -82.4584,
  },
  {
    id: 'st-josephs',
    name: "St. Joseph's Hospital",
    county: 'Hillsborough',
    city: 'Tampa',
    type: 'Acute Care',
    emergencyServices: true,
    lat: 27.9618,
    lng: -82.4832,
  },
  {
    id: 'adventhealth-tampa',
    name: 'AdventHealth Tampa',
    county: 'Hillsborough',
    city: 'Tampa',
    type: 'Acute Care',
    emergencyServices: true,
    lat: 28.0337,
    lng: -82.4244,
  },
  {
    id: 'hca-brandon',
    name: 'HCA Florida Brandon Hospital',
    county: 'Hillsborough',
    city: 'Brandon',
    type: 'Acute Care',
    emergencyServices: true,
    lat: 27.9364,
    lng: -82.2922,
  },
  {
    id: 'bayfront-st-pete',
    name: 'Bayfront Health St. Petersburg',
    county: 'Pinellas',
    city: 'St. Petersburg',
    type: 'Acute Care',
    emergencyServices: true,
    lat: 27.7666,
    lng: -82.6389,
  },
  {
    id: 'morton-plant',
    name: 'Morton Plant Hospital',
    county: 'Pinellas',
    city: 'Clearwater',
    type: 'Acute Care',
    emergencyServices: true,
    lat: 27.9606,
    lng: -82.8001,
  },
  {
    id: 'mease-dunedin',
    name: 'Mease Dunedin Hospital',
    county: 'Pinellas',
    city: 'Dunedin',
    type: 'Acute Care',
    emergencyServices: true,
    lat: 28.0293,
    lng: -82.7718,
  },
  {
    id: 'sarasota-memorial',
    name: 'Sarasota Memorial Hospital',
    county: 'Sarasota',
    city: 'Sarasota',
    type: 'Acute Care',
    emergencyServices: true,
    lat: 27.3213,
    lng: -82.5301,
  },
  {
    id: 'manatee-memorial',
    name: 'Manatee Memorial Hospital',
    county: 'Manatee',
    city: 'Bradenton',
    type: 'Acute Care',
    emergencyServices: true,
    lat: 27.4957,
    lng: -82.5748,
  },
];

type CountyOutage = {
  county: string;
  percentOut: number;
  customersOut: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getThreatModifier(threatLevel: ThreatLevel) {
  switch (threatLevel) {
    case 'critical':
      return 18;
    case 'warning':
      return 11;
    case 'advisory':
      return 6;
    default:
      return 2;
  }
}

export function buildMedicalOperations(params: {
  threatLevel: ThreatLevel;
  roadClosuresTotal: number;
  bridgeClosuresTotal: number;
  dukeOutages: CountyOutage[];
}) {
  const countyOutageMap = new Map(
    params.dukeOutages.map(outage => [outage.county.trim().toLowerCase(), outage])
  );

  return TAMPA_BAY_MEDICAL_FACILITIES.map(facility => {
    const countyOutage = countyOutageMap.get(facility.county.toLowerCase());
    const outagePressure = countyOutage
      ? clamp(Math.round((countyOutage.percentOut * 100) * 10), 0, 100)
      : 8;
    const transportPressure = clamp(
      (params.roadClosuresTotal * 9)
      + (params.bridgeClosuresTotal * (facility.county === 'Hillsborough' || facility.county === 'Pinellas' ? 12 : 5))
      + getThreatModifier(params.threatLevel),
      0,
      100,
    );
    const accessRisk = clamp(
      Math.round((outagePressure * 0.42) + (transportPressure * 0.58)),
      0,
      100,
    );

    const status: MedicalFacilityStatus['status'] = accessRisk >= 70
      ? 'disruption-risk'
      : accessRisk >= 38
        ? 'monitor'
        : 'accessible';

    const note = countyOutage
      ? `${facility.county} outage feed shows ${countyOutage.customersOut.toLocaleString()} customers out; road/bridge pressure is layered on top for access risk.`
      : `No structured public outage feed is available for ${facility.county}; access risk is driven by transport disruption and regional threat pressure.`;

    return {
      ...facility,
      accessRisk,
      status,
      outagePressure,
      transportPressure,
      note,
    } satisfies MedicalFacilityStatus;
  }).sort((a, b) => b.accessRisk - a.accessRisk);
}
