import { useState, useEffect, useRef, useCallback } from 'react';

const THREAT_ORDER = ['monitoring', 'advisory', 'warning', 'critical'];

const MESSAGES: Record<string, { title: string; body: string }> = {
  advisory: {
    title: 'BayShield — Conditions Developing',
    body: 'Weather conditions are evolving for Tampa Bay. Stay informed and review your plan.',
  },
  warning: {
    title: 'BayShield — Action May Be Needed',
    body: 'Dangerous conditions developing near Tampa Bay. Prepare to evacuate if ordered.',
  },
  critical: {
    title: 'BayShield — CRITICAL ALERT',
    body: 'Immediate action required for Tampa Bay. Check your evacuation zone now.',
  },
};

export function usePushNotifications(threatLevel: string) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const prevRef = useRef(threatLevel);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  useEffect(() => {
    const prev = THREAT_ORDER.indexOf(prevRef.current);
    const curr = THREAT_ORDER.indexOf(threatLevel);

    if (curr > prev && permission === 'granted') {
      const msg = MESSAGES[threatLevel];
      if (msg) {
        new Notification(msg.title, {
          body: msg.body,
          icon: '/shield.svg',
          tag: 'bayshield-threat',
          requireInteraction: threatLevel === 'critical',
        });
      }
    }
    prevRef.current = threatLevel;
  }, [threatLevel, permission]);

  return { permission, requestPermission };
}
