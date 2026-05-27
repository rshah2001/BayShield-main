/**
 * useSystemHealth — React hook for SSE system health monitoring
 *
 * Connects to /api/system/health-stream and delivers real-time
 * service health status for all BayShield components.
 */
import { useState, useEffect, useRef } from 'react';

export interface ServiceHealth {
  status: 'online' | 'offline' | 'degraded' | 'estimated';
  label: string;
  version?: string;
  agents?: number;
  tables?: number;
  endpoints?: number;
}

export interface SystemHealthData {
  timestamp: string;
  services: {
    node_server: ServiceHealth;
    python_adk: ServiceHealth;
    database: ServiceHealth;
    noaa_api: ServiceHealth;
    llm_service: ServiceHealth;
    shelter_feed: ServiceHealth;
    routing_service: ServiceHealth;
  };
}

export function useSystemHealth() {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/system/health-stream');
    esRef.current = es;

    es.addEventListener('health', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as SystemHealthData;
        setHealth(data);
        setLastUpdated(new Date());
        setIsConnected(true);
      } catch { /* skip malformed */ }
    });

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
    };
  }, []);

  const allOnline = health
    ? Object.values(health.services).every(s => s.status === 'online' || s.status === 'estimated')
    : false;

  const onlineCount = health
    ? Object.values(health.services).filter(s => s.status === 'online' || s.status === 'estimated').length
    : 0;

  const totalCount = health
    ? Object.values(health.services).length
    : 7;

  return {
    health,
    isConnected,
    lastUpdated,
    allOnline,
    onlineCount,
    totalCount,
  };
}
