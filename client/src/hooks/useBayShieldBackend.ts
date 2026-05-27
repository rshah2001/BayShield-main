/**
 * useBayShieldBackend — React hook for the Python ADK backend
 *
 * Provides:
 * - adkHealth: health status of the Python ADK service
 * - runPipeline: trigger a full 4-agent pipeline run
 * - latestRun: most recent pipeline result from DB
 * - recentRuns: last 10 pipeline runs
 * - generateSummary: LLM-powered emergency briefing
 * - explainCorrection: LLM explanation of self-correction
 * - isAdkAvailable: whether the Python service is reachable
 */
import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import type { Message as ChatMessage } from '@/components/AIChatBox';

export interface BayShieldChatResponse {
  answer: string;
  sources: Array<{
    title: string;
    source: string;
  }>;
}

export interface BackendPipelineResult {
  run_id: string;
  threat_level: string;
  total_at_risk: number;
  self_correction_applied: boolean;
  correction_details: string | null;
  weather: {
    station: string;
    temperature_c: number;
    temperature_f: number;
    wind_speed_ms: number;
    wind_speed_kt: number;
    wind_direction: string;
    pressure_pa: number;
    description: string;
    timestamp: string;
  } | null;
  active_storm: {
    name: string;
    category: number;
    wind_kt: number;
    distance_miles: number;
    bearing: string;
    movement_mph: number;
    lat: number;
    lng: number;
  } | null;
  nws_alerts: Array<{
    id: string;
    event: string;
    severity: string;
    area_desc: string;
    headline: string;
    expires: string | null;
    affected_counties?: string[];
    polygon?: number[][][];
    centroid_lat?: number | null;
    centroid_lng?: number | null;
  }>;
  vulnerability_zones: Array<{
    id: string;
    name: string;
    flood_zone: string;
    risk_score: number;
    population: number;
    elderly_pct: number;
    low_income_pct: number;
    mobility_impaired_pct: number;
    lat: number;
    lng: number;
    status: string;
    source?: string;
    population_source?: string;
    population_block_count?: number;
    event?: string | null;
    expires?: string | null;
    affected_counties?: string[];
    polygons?: number[][][];
  }>;
  shelters: Array<{
    id: string;
    name: string;
    address: string;
    capacity: number;
    current_occupancy: number;
    available_capacity: number;
    lat: number;
    lng: number;
    status: string;
    source: string;
  }>;
  action_plans: Array<{
    id: string;
    title: string;
    priority: number;
    action: string;
    shelter: string;
    route: string;
    population: number;
    rationale: string;
    output_type: string;
    correction_applied: boolean;
  }>;
  agent_traces: Array<{
    agent_id: string;
    agent_name: string;
    status: string;
    confidence: number;
    loop_iteration: number;
    input_payload: Record<string, unknown>;
    output_payload: Record<string, unknown>;
    output_type: string;
    llm_narrative?: string | null;
    deterministic_rationale: string;
    started_at?: string | null;
    completed_at?: string | null;
    execution_ms: number;
  }>;
  messages: Array<{
    id: string;
    from_agent: string;
    to_agent: string;
    event_type: string;
    content: string;
    payload: Record<string, unknown>;
    timestamp: string;
  }>;
  infrastructure_signals?: {
    generatedAt: string;
    roadIncidentsTotal: number;
    roadClosuresTotal: number;
    bridgeClosuresTotal: number;
    dukeCustomersOut: number;
    dukeCustomersServed: number;
    dukePercentOut: number;
    dukeCountyCount: number;
    feedStatus: 'live' | 'partial' | 'unavailable';
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
  completed_at: string;
  incident_actions?: Array<{
    id: string;
    planId: string;
    title: string;
    detail: string;
    severity: string;
    status: 'new' | 'reviewed' | 'assigned' | 'completed';
    owner: string | null;
    managedBy: 'system' | 'operator';
    createdAt: string;
    updatedAt: string;
    dueLabel: string;
    zonesAffected: string[];
    populationCovered: number;
    source: string;
    recommendations: string[];
  }>;
}

export interface CurrentLiveState {
  status: 'idle' | 'running' | 'ready' | 'error';
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
  currentState: BackendPipelineResult | null;
  incidentActions: NonNullable<BackendPipelineResult['incident_actions']>;
  incidentDispatches: Array<{
    id: string;
    actionId: string;
    title: string;
    target: string;
    channel: string;
    status: 'pending' | 'delivered' | 'local_only' | 'acknowledged';
    detail: string;
    lastAttemptAt: string | null;
    acknowledgedAt: string | null;
    acknowledgedBy: string | null;
  }>;
  incidentAuditLog: Array<{
    id: string;
    actionId: string;
    eventType: string;
    actor: string;
    summary: string;
    createdAt: string;
  }>;
}

export function useBayShieldBackend() {
  const [lastPipelineResult, setLastPipelineResult] = useState<BackendPipelineResult | null>(null);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Health check — runs once on mount
  const { data: healthData } = trpc.bayshield.adkHealth.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  // Latest run from DB
  const { data: latestRun, refetch: refetchLatestRun } = trpc.bayshield.latestRun.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 10_000,
  });

  // Recent runs
  const { data: recentRuns } = trpc.bayshield.recentRuns.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const { data: currentLiveStateQuery, refetch: refetchCurrentLiveState } = trpc.bayshield.currentLiveState.useQuery(undefined, {
    refetchInterval: 10_000,
    refetchOnWindowFocus: false,
    staleTime: 5_000,
  });

  const updateIncidentActionMutation = trpc.bayshield.updateIncidentAction.useMutation();
  const acknowledgeIncidentDispatchMutation = trpc.bayshield.acknowledgeIncidentDispatch.useMutation();

  // Pipeline mutation
  const runPipelineMutation = trpc.bayshield.runPipeline.useMutation({
    onSuccess: (result) => {
      if (result.ok && result.data) {
        setLastPipelineResult(result.data as unknown as BackendPipelineResult);
        setPipelineError(null);
        refetchLatestRun();
      } else if (!result.ok) {
        setPipelineError(result.error ?? 'Pipeline failed');
      }
      setIsRunningPipeline(false);
    },
    onError: (err) => {
      setPipelineError(err.message);
      setIsRunningPipeline(false);
    },
  });

  // LLM summary mutation
  const generateSummaryMutation = trpc.bayshield.generateSummary.useMutation();

  // LLM correction explanation
  const explainCorrectionMutation = trpc.bayshield.explainCorrection.useMutation();

  // RAG chat mutation
  const chatMutation = trpc.bayshield.chat.useMutation();

  const runPipeline = useCallback(async (mode: 'live' | 'simulation' = 'live') => {
    setIsRunningPipeline(true);
    setPipelineError(null);
    await runPipelineMutation.mutateAsync({ mode });
  }, [runPipelineMutation]);

  const generateSummary = useCallback(async (params: {
    threatLevel: string;
    totalAtRisk: number;
    planCount: number;
    correctionApplied: boolean;
    zones?: Array<{ name: string; riskScore: number; status: string; population: number }>;
  }) => {
    const result = await generateSummaryMutation.mutateAsync(params);
    return result.summary;
  }, [generateSummaryMutation]);

  const explainCorrection = useCallback(async (params: {
    correctionDetails: string;
    planTitle: string;
    threatLevel: string;
  }) => {
    const result = await explainCorrectionMutation.mutateAsync(params);
    return result.explanation;
  }, [explainCorrectionMutation]);

  const askBayShield = useCallback(async (messages: ChatMessage[]) => {
    const result = await chatMutation.mutateAsync({ messages });
    return {
      answer: result.answer,
      sources: Array.isArray(result.sources)
        ? result.sources
            .filter(source => Boolean(source) && typeof source === 'object')
            .map(source => ({
              title: typeof (source as { title?: unknown }).title === 'string'
                ? (source as { title: string }).title
                : 'BayShield source',
              source: typeof (source as { source?: unknown }).source === 'string'
                ? (source as { source: string }).source
                : 'BayShield',
            }))
        : [],
    } satisfies BayShieldChatResponse;
  }, [chatMutation]);

  const updateIncidentAction = useCallback(async (input: {
    actionId: string;
    planId: string;
    title: string;
    mode?: 'live' | 'simulation';
    source?: string;
    status?: 'new' | 'reviewed' | 'assigned' | 'completed';
    owner?: string | null;
  }) => {
    await updateIncidentActionMutation.mutateAsync(input);
    await refetchCurrentLiveState();
  }, [refetchCurrentLiveState, updateIncidentActionMutation]);

  const acknowledgeIncidentDispatch = useCallback(async (input: {
    actionId: string;
    actor: string;
    mode?: 'live' | 'simulation';
  }) => {
    await acknowledgeIncidentDispatchMutation.mutateAsync(input);
    await refetchCurrentLiveState();
  }, [acknowledgeIncidentDispatchMutation, refetchCurrentLiveState]);

  const isAdkAvailable = healthData?.ok === true;
  const currentLiveState = currentLiveStateQuery?.ok ? currentLiveStateQuery.data as CurrentLiveState : null;
  const canonicalPipelineResult = currentLiveState?.currentState ?? lastPipelineResult;

  return {
    isAdkAvailable,
    healthData,
    lastPipelineResult: canonicalPipelineResult,
    currentLiveState,
    isRunningPipeline,
    pipelineError,
    latestRun,
    recentRuns,
    runPipeline,
    generateSummary,
    explainCorrection,
    askBayShield,
    updateIncidentAction,
    acknowledgeIncidentDispatch,
    isGeneratingSummary: generateSummaryMutation.isPending,
    isExplainingCorrection: explainCorrectionMutation.isPending,
    isChatting: chatMutation.isPending,
  };
}
