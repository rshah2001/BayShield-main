/**
 * usePipelineStream — React hook for SSE pipeline streaming
 *
 * Connects to /api/pipeline/stream and delivers real-time
 * agent status events as the 4-agent pipeline executes.
 * Automatically handles reconnection and cleanup.
 */
import { useState, useCallback, useRef } from 'react';

export type PipelineEventType =
  | 'pipeline_start'
  | 'agent_start'
  | 'agent_complete'
  | 'parallel_start'
  | 'parallel_complete'
  | 'pipeline_complete'
  | 'error'
  | 'done';

export interface PipelineEvent {
  event: PipelineEventType;
  agent?: string;
  phase?: number;
  pattern?: string;
  threat_level?: string;
  loop_iterations?: number;
  alert_count?: number;
  storm_count?: number;
  confidence?: number;
  plans?: number;
  correction_applied?: boolean;
  correction_details?: string;
  total_at_risk?: number;
  action_plans?: number;
  message_count?: number;
  completed_at?: string;
  run_id?: string;
  agents?: string[];
  vulnerability_mapper?: Record<string, unknown>;
  resource_coordinator?: Record<string, unknown>;
  messages?: Array<{ from: string; to: string; event_type: string; content: string }>;
  message?: string;
  code?: string;
  timestamp?: string;
}

export interface StreamState {
  isStreaming: boolean;
  events: PipelineEvent[];
  currentPhase: number;
  currentAgent: string | null;
  isComplete: boolean;
  error: string | null;
  threatLevel: string | null;
  totalAtRisk: number;
}

const INITIAL_STATE: StreamState = {
  isStreaming: false,
  events: [],
  currentPhase: 0,
  currentAgent: null,
  isComplete: false,
  error: null,
  threatLevel: null,
  totalAtRisk: 0,
};

export function usePipelineStream() {
  const [state, setState] = useState<StreamState>(INITIAL_STATE);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startStream = useCallback((mode: 'live' | 'simulation' = 'live') => {
    // Close any existing stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setState({ ...INITIAL_STATE, isStreaming: true });

    const es = new EventSource(`/api/pipeline/stream?mode=${mode}`);
    eventSourceRef.current = es;

    const handleEvent = (eventType: string, data: PipelineEvent) => {
      setState(prev => {
        const newEvents = [...prev.events, { ...data, event: eventType as PipelineEventType }];
        let currentPhase = prev.currentPhase;
        let currentAgent = prev.currentAgent;
        let isComplete = prev.isComplete;
        let isStreaming = prev.isStreaming;
        let error = prev.error;
        let threatLevel = prev.threatLevel;
        let totalAtRisk = prev.totalAtRisk;

        switch (eventType) {
          case 'agent_start':
          case 'parallel_start':
            currentPhase = data.phase ?? prev.currentPhase;
            currentAgent = data.agent ?? (data.agents ? data.agents[0] : null);
            break;
          case 'agent_complete':
            currentAgent = null;
            if (data.threat_level) threatLevel = data.threat_level;
            break;
          case 'parallel_complete':
            currentAgent = null;
            if (data.vulnerability_mapper) {
              const vm = data.vulnerability_mapper as { total_at_risk?: number };
              totalAtRisk = vm.total_at_risk ?? totalAtRisk;
            }
            break;
          case 'pipeline_complete':
            isComplete = true;
            isStreaming = false;
            currentAgent = null;
            if (data.threat_level) threatLevel = data.threat_level;
            if (data.total_at_risk) totalAtRisk = data.total_at_risk;
            break;
          case 'error':
            error = data.message ?? 'Stream error';
            isStreaming = false;
            break;
          case 'done':
            isStreaming = false;
            break;
        }

        return {
          isStreaming,
          events: newEvents,
          currentPhase,
          currentAgent,
          isComplete,
          error,
          threatLevel,
          totalAtRisk,
        };
      });
    };

    // Register event listeners for each event type
    const eventTypes: PipelineEventType[] = [
      'pipeline_start', 'agent_start', 'agent_complete',
      'parallel_start', 'parallel_complete', 'pipeline_complete',
      'error', 'done'
    ];

    for (const eventType of eventTypes) {
      es.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as PipelineEvent;
          handleEvent(eventType, data);
        } catch { /* skip malformed */ }
      });
    }

    es.onerror = () => {
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: prev.events.length === 0
          ? 'Could not connect to pipeline stream. Python ADK service may not be running.'
          : null,
      }));
      es.close();
    };
  }, []);

  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState(prev => ({ ...prev, isStreaming: false }));
  }, []);

  const reset = useCallback(() => {
    stopStream();
    setState(INITIAL_STATE);
  }, [stopStream]);

  return {
    ...state,
    startStream,
    stopStream,
    reset,
  };
}
