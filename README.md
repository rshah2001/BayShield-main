# BayShield — Multi-Agent Disaster Response Coordinator

**BayShield v3.0** is a real-time, multi-agent AI disaster response command center purpose-built for the Tampa Bay region. Four specialist AI agents — Storm Watcher, Vulnerability Mapper, Resource Coordinator, and Alert Commander — communicate via an Agent-to-Agent (A2A) message bus to autonomously monitor weather threats, identify at-risk communities, coordinate emergency resources, and issue targeted evacuation orders. The system operates in two distinct modes: **Live mode**, which polls real NOAA and NWS public APIs every two minutes with zero hardcoded values, and **Simulation mode**, which runs a fully scripted Hurricane Helena Category 4 scenario for demonstration and training purposes.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Agent Pipeline](#agent-pipeline)
3. [Live Data Sources](#live-data-sources)
4. [Pages & Features](#pages--features)
5. [Tech Stack](#tech-stack)
6. [Data Models](#data-models)
7. [Running Locally](#running-locally)
8. [Live vs Simulation Mode](#live-vs-simulation-mode)
9. [Evacuation Routing Engine](#evacuation-routing-engine)
10. [What Is Static vs Live](#what-is-static-vs-live)

---

## Architecture Overview

BayShield is a pure static React 19 frontend (no backend server required) that communicates directly with public government weather APIs from the browser. The agent pipeline is implemented entirely in TypeScript using React context and custom hooks, simulating the A2A message-passing architecture described in the original StormMesh specification.

```
┌─────────────────────────────────────────────────────────────────┐
│                        BayShield v3.0                           │
│                                                                 │
│  ┌──────────────┐    A2A     ┌─────────────────────────────┐   │
│  │ Storm Watcher│ ─────────▶ │     Vulnerability Mapper    │   │
│  │  (LoopAgent) │            │       (ParallelAgent)        │   │
│  │  NOAA + NWS  │            │  NWS alerts + zone mapping  │   │
│  └──────────────┘            └──────────────┬──────────────┘   │
│         │                                   │                   │
│         │ A2A                               │ A2A               │
│         ▼                                   ▼                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Resource Coordinator (ParallelAgent)        │   │
│  │         Shelter status + supply depots + routes          │   │
│  └──────────────────────────────┬───────────────────────────┘   │
│                                 │ A2A                           │
│                                 ▼                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Alert Commander (SelfCorrectingLoopAgent)        │   │
│  │   Generates action plans · Issues alerts · Self-corrects │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Pipeline

The pipeline runs in 9 phases, completing in approximately 10 seconds in both modes. Each agent animates from `idle` → `processing` → `complete` with a real-time confidence bar.

| Agent | Pattern | Role | Confidence |
|---|---|---|---|
| **Storm Watcher** | `LoopAgent` | Polls NOAA NHC and KTPA station every 2 min; escalates threat level from MONITORING → ADVISORY → WARNING → CRITICAL | Stays ACTIVE at 100% |
| **Vulnerability Mapper** | `ParallelAgent` | Runs simultaneously with Resource Coordinator; maps 8 Tampa Bay zones by flood zone (VE/AE/X), population, elderly %, low-income %, and mobility-impaired % | Completes at 92–100% |
| **Resource Coordinator** | `ParallelAgent` | Simultaneously identifies shelter capacity, supply depot inventory, and evacuation route status across 3 shelters and 2 supply depots | Completes at 100% |
| **Alert Commander** | `SelfCorrectingLoopAgent` | Consumes outputs from Agents 2 and 3; generates prioritized action plans; self-corrects by re-running if logical inconsistencies are detected | Completes at 100% |

In **Live mode**, the pipeline re-runs automatically every 2 minutes when NOAA data refreshes. In **Simulation mode**, it runs once on page load and can be manually re-triggered with the Run button.

---

## Live Data Sources

All four APIs are public, require no API key, and are called directly from the browser.

| Source | Endpoint | Data Provided | Refresh |
|---|---|---|---|
| **NOAA NWS — KTPA Station** | `api.weather.gov/stations/KTPA/observations/latest` | Temperature (°F/°C), wind speed (kt/mph), wind direction, pressure (inHg/Pa), humidity, visibility, sky conditions | Every 2 min |
| **NOAA NWS — FL Alerts** | `api.weather.gov/alerts/active?area=FL&status=actual` | Active weather alerts for Florida: event type, severity, urgency, affected counties, expiry time | Every 2 min |
| **NOAA NHC — Atlantic RSS** | `nhc.noaa.gov/nhc_at1.xml` + `nhc_at2.xml` | Active Atlantic tropical storms and hurricanes: name, category, wind speed (kt), pressure, movement, estimated distance from Tampa Bay | Every 2 min |
| **NOAA NWS — TBW Forecast** | `api.weather.gov/gridpoints/TBW/56,93/forecast` | Tampa Bay 7-day forecast: temperature, wind speed/direction, short forecast text, day/night periods | Every 2 min |

The `useLiveWeather` hook fetches all four sources in parallel using `Promise.allSettled`, so a failure in any single source does not block the others. The computed `threatLevel` field (`NONE` / `WATCH` / `WARNING` / `CRITICAL`) is derived from the combination of active NHC storms and NWS alert severities.

---

## Pages & Features

### Landing Page (`/`)

The public-facing entry point. Features a full-bleed hurricane satellite image of Tampa Bay at night, a scrolling live emergency ticker at the bottom, a four-agent architecture diagram, a feature highlights section, and a "Launch Dashboard" CTA. The ticker shows real-time data in Live mode and the Helena scenario in Simulation mode.

### Command Dashboard (`/dashboard`)

The primary command interface. It auto-starts the agent pipeline on mount and displays:

- **Four stat cards** — Active Alerts (NWS Live), Population at Risk (Computed), Shelter Capacity (Estimated), and Zones Monitored (Static), each labelled with its data source.
- **Live Conditions panel** — Real KTPA observations: storm status, wind speed and direction, temperature, pressure, humidity, and sky conditions.
- **NOAA Live Feed panel** — Last sync timestamp, countdown to next sync, and live/offline status for all four API sources.
- **Wind Speed — Last 24h chart** — A Recharts area chart plotting real KTPA wind observations over time. In Simulation mode, this becomes the Helena intensity trajectory chart.
- **Tampa Bay Threat Map** — A static satellite overlay of Tampa Bay with six neighborhood zone labels and an "All Clear" or active threat banner.
- **Agent Status panel** — Four agent cards showing status badge (IDLE / PROCESSING / ACTIVE / COMPLETE), last action text, and an animated confidence progress bar.
- **Activity Feed** — Timestamped log of agent messages as they are generated, filterable by agent.
- **System Log** — A terminal-style log showing every system event with timestamps, labelled LIVE or SIM.
- **Active Alerts list** — Full NWS alert cards with event type, affected area, and expiry time.
- **Live Ticker bar** — Pinned to the bottom of the viewport. Green in Live/clear state, amber with real NWS headlines when alerts are active, red with Helena scenario data in Simulation mode.

### Agent Communications (`/agents`)

A dedicated view of the A2A message bus. Displays the full pipeline architecture diagram showing the four agents and their communication flow, followed by a real-time message log showing every inter-agent message with sender, recipient, event type, payload preview, and delivery status (`sent` / `received` / `processing` / `acknowledged`).

### Infrastructure Predictions (`/infrastructure`)

Populated once the Alert Commander completes Phase 6 or later. Shows AI-generated infrastructure risk predictions per zone: power outage probability (%), road closure probability (%), hospital risk level (low/moderate/high/critical), estimated damage cost, flood depth in feet, wind damage risk, and estimated recovery days. Also displays the full action plans generated by Alert Commander with prioritized recommendations and affected zone lists.

### Map & Evacuation (`/map`)

A full-bleed Google Maps dark-styled view of Tampa Bay with two tabs:

**Threat Map tab** — Shows all 8 vulnerability zone markers colour-coded by risk score, 3 shelter markers (USF Sun Dome, Yuengling Center, Tropicana Field), 2 supply depot markers, and FEMA flood zone circles (VE zones at 3 km radius, AE zones at 2 km radius). Clicking any marker opens an info window with zone details.

**Evacuation Routes tab** — The full Evacuation Routing Engine (see below). Users enter their location or share GPS coordinates, and the system computes routes to all three shelters simultaneously using the Google Maps Directions API with live traffic.

### Resources (`/resources`)

Displays the full resource inventory for Tampa Bay's emergency response network. Shows shelter capacity bars (current occupancy vs total capacity), supply depot inventory lists (water, MREs, medical kits, generators, fuel), and the complete vulnerability zone table sorted by risk score with flood zone classification, population, and demographic breakdown (elderly %, low-income %, mobility-impaired %).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 with TypeScript 5.6 |
| Routing | Wouter 3 |
| Styling | Tailwind CSS 4 with custom OKLCH design tokens |
| UI Components | shadcn/ui (Radix UI primitives) |
| Charts | Recharts 2 |
| Animations | Framer Motion 12 |
| Maps | Google Maps JavaScript API |
| Icons | Lucide React |
| Build | Vite 7 |
| Package Manager | pnpm |
| Data | NOAA NWS public REST API + NHC RSS feeds (no API key required) |

---

## Data Models

The following TypeScript interfaces define the core data structures used across all agents and pages.

**`WeatherData`** — Represents the current storm state: storm name, category (0–5), wind speed (kt), pressure (mb), lat/lng position, movement description, landfall estimate, threat level, radar returns, and surge height.

**`VulnerabilityZone`** — Represents one of the 8 Tampa Bay neighbourhoods: FEMA flood zone classification (VE/AE/X), population count, elderly percentage, low-income percentage, mobility-impaired percentage, composite risk score (0–100), and current evacuation status.

**`Resource`** — A shelter, supply depot, medical facility, or evacuation route with capacity, current occupancy, operational status, and supply inventory.

**`AgentMessage`** — An A2A message with sender, recipient, timestamp, event type, JSON payload, human-readable content, and delivery status.

**`AgentState`** — Runtime state of one agent: status, last action text, loop iteration count, confidence score, and processing time.

**`ActionPlan`** — Generated by Alert Commander: title, summary, prioritised recommendations list, affected zones, population covered, and severity level.

**`InfrastructurePrediction`** — Predictive model output per zone: power outage %, road closure %, hospital risk, damage estimate, flood depth, wind damage risk, and recovery days.

---

## Running Locally

```bash
# Clone and install
git clone <repo>
cd stormmesh
pnpm install

# Start the development server
pnpm dev
# → http://localhost:3000
```

NOAA/NWS APIs are public and unauthenticated. Configure a Google Maps API key for map and routing features when running outside the original hosted template environment.

---

## Live vs Simulation Mode

The mode toggle in the sidebar bottom-left switches between the two modes. The current mode is displayed as a badge on the Dashboard header and on every data source label.

| Feature | Live Mode | Simulation Mode |
|---|---|---|
| Storm name / category | Real NHC RSS | "Hurricane Helena" (hardcoded) |
| Wind speed / direction | Real KTPA station | 145 kt (hardcoded) |
| Temperature / pressure / humidity | Real KTPA station | N/A |
| Active alert count | Real NWS FL alerts API | Generated by pipeline |
| Threat level | Computed from NHC + NWS | Escalates to CRITICAL |
| Wind trend chart | Real KTPA observations over time | Helena trajectory curve |
| Ticker bar colour | Green (clear) / Amber (alerts) | Red |
| Ticker bar content | Real NWS alert headlines | Helena scenario messages |
| Agent pipeline | Re-runs every 2 min on NOAA refresh | Runs once, re-triggerable |
| Infrastructure predictions | Derived from real NWS data | Full Helena scenario |
| Shelter occupancy | Estimated from threat level | 57% (hardcoded) |
| Zone statuses on map | Derived from threat level | Fixed evacuation zones |
| Resource inventory | Static (real Tampa Bay facilities) | Same |
| Population at risk | Computed from active alert zones | 47,520 (hardcoded) |

---

## Evacuation Routing Engine

The Evacuation Routing Engine (`EvacuationRouter.tsx`) is the most technically complex component. It uses the Google Maps Directions API with live traffic to compute simultaneous routes from the user's location to all three Tampa Bay shelters, then ranks them by a composite **Safety Score** (0–100).

**Safety Score formula:**

```
Safety Score = 100
  − flood_zone_penalty     (VE zone crossing: −30 pts; AE zone crossing: −15 pts)
  − traffic_penalty        (moderate: −5; heavy: −15; standstill: −25)
  − capacity_penalty       (shelter filling: −10; shelter full: −40)
```

Flood zone penalties are computed using the Haversine formula to check each route step's coordinates against the 8 known FEMA flood zone centroids. A VE zone has a 3 km penalty radius; an AE zone has a 2 km radius.

The engine uses `google.maps.TrafficModel.BEST_GUESS` to incorporate real-time traffic conditions into ETA calculations, comparing `duration_in_traffic` against `duration` to classify traffic as clear / moderate / heavy / standstill.

Each computed route card shows: shelter name and capacity, ETA with live traffic, distance, safety score bar, flood zones crossed, traffic condition badge, turn-by-turn directions, and any warnings. The recommended route (highest safety score) is highlighted. Routes auto-refresh every 2 minutes alongside the NOAA data poll.

**Shelters covered:**

| Shelter | Address | Capacity |
|---|---|---|
| USF Sun Dome | 4202 E Fowler Ave, Tampa | 10,000 |
| Yuengling Center | 4202 E Fowler Ave, Tampa | 10,000 |
| Tropicana Field | 1 Tropicana Dr, St. Petersburg | 10,000 |

---

## What Is Static vs Live

For full transparency, the following table documents every data field in the application and whether it is fetched live, computed from live data, or static.

| Field | Source Type | Details |
|---|---|---|
| Storm name, category, wind (kt) | **Live** (NHC RSS) | Real Atlantic basin tracking |
| Temperature, humidity, pressure | **Live** (KTPA NWS) | Tampa International Airport station |
| Wind speed / direction | **Live** (KTPA NWS) | Updated every NOAA observation cycle |
| Active alert count + headlines | **Live** (NWS FL Alerts API) | All active Florida NWS alerts |
| Threat level | **Computed** | Derived from NHC storm proximity + NWS severity |
| Population at risk | **Computed** | Derived from active alert zone overlap |
| Shelter occupancy % | **Estimated** | Scaled from threat level (5% at NONE → 90% at CRITICAL) |
| Wind trend chart | **Live** (KTPA) | Last 24h observations plotted in real time |
| Zone statuses (evacuate/watch/safe) | **Derived** | Computed from current threat level |
| Infrastructure predictions | **Agent-generated** | Computed by Alert Commander from live NWS data |
| Resource inventory (MREs, water, etc.) | **Static** | Real Tampa Bay emergency management facility data |
| Vulnerability zone demographics | **Static** | Based on US Census / FEMA flood zone data for Tampa Bay |
| Evacuation route ETAs | **Live** (Google Maps) | Real-time traffic via Directions API |
| Flood zone boundaries on map | **Static** | FEMA FIRM flood zone classifications |
