import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface EarthCanvasProps {
  className?: string;
}

type Blob = {
  lat: number;
  lon: number;
  rx: number;
  ry: number;
  intensity?: number;
};

type NodePoint = {
  id: string;
  lat: number;
  lon: number;
  color: string;
  size: number;
};

const LAND_BLOBS: Blob[] = [
  { lat: 52, lon: -110, rx: 34, ry: 18, intensity: 1 },
  { lat: 35, lon: -96, rx: 22, ry: 14, intensity: 0.85 },
  { lat: 14, lon: -86, rx: 11, ry: 9, intensity: 0.75 },
  { lat: -15, lon: -60, rx: 18, ry: 22, intensity: 0.9 },
  { lat: 8, lon: 20, rx: 18, ry: 20, intensity: 0.9 },
  { lat: -18, lon: 26, rx: 16, ry: 18, intensity: 0.95 },
  { lat: 48, lon: 15, rx: 18, ry: 10, intensity: 0.75 },
  { lat: 42, lon: 78, rx: 36, ry: 16, intensity: 1 },
  { lat: 22, lon: 78, rx: 11, ry: 10, intensity: 0.8 },
  { lat: 8, lon: 105, rx: 16, ry: 12, intensity: 0.8 },
  { lat: -24, lon: 134, rx: 16, ry: 11, intensity: 0.75 },
  { lat: 72, lon: -40, rx: 12, ry: 8, intensity: 0.55 },
];

const CLOUD_BLOBS: Blob[] = [
  { lat: 22, lon: -25, rx: 26, ry: 10, intensity: 1 },
  { lat: -10, lon: 40, rx: 20, ry: 8, intensity: 0.9 },
  { lat: 48, lon: 110, rx: 18, ry: 7, intensity: 0.8 },
  { lat: -34, lon: -120, rx: 24, ry: 8, intensity: 0.8 },
  { lat: 5, lon: 140, rx: 22, ry: 7, intensity: 0.7 },
];

const NODE_POINTS: NodePoint[] = [
  { id: 'tampa', lat: 27.95, lon: -82.46, color: '#38bdf8', size: 1.15 },
  { id: 'miami', lat: 25.76, lon: -80.19, color: '#22d3ee', size: 0.95 },
  { id: 'new-york', lat: 40.71, lon: -74.0, color: '#93c5fd', size: 0.9 },
  { id: 'london', lat: 51.5, lon: -0.12, color: '#c084fc', size: 0.85 },
  { id: 'lagos', lat: 6.52, lon: 3.37, color: '#34d399', size: 0.9 },
  { id: 'dubai', lat: 25.2, lon: 55.27, color: '#fbbf24', size: 0.82 },
  { id: 'mumbai', lat: 19.07, lon: 72.88, color: '#f59e0b', size: 0.84 },
  { id: 'singapore', lat: 1.35, lon: 103.82, color: '#2dd4bf', size: 0.82 },
];

const CONNECTIONS = [
  ['tampa', 'miami'],
  ['tampa', 'new-york'],
  ['tampa', 'london'],
  ['london', 'dubai'],
  ['dubai', 'mumbai'],
  ['lagos', 'london'],
  ['mumbai', 'singapore'],
] as const;

function wrapLongitude(delta: number) {
  let value = delta;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

function sampleBlob(lat: number, lon: number, blobs: Blob[]) {
  let value = 0;
  for (const blob of blobs) {
    const dx = wrapLongitude(lon - blob.lon) / blob.rx;
    const dy = (lat - blob.lat) / blob.ry;
    const distance = dx * dx + dy * dy;
    if (distance < 1) {
      const weight = (1 - distance) * (blob.intensity ?? 1);
      value = Math.max(value, weight);
    }
  }
  return value;
}

function projectPoint(cx: number, cy: number, radius: number, lat: number, lon: number, rotation: number) {
  const lonRad = ((lon * Math.PI) / 180) + rotation;
  const latRad = (lat * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  const z = cosLat * Math.cos(lonRad);
  if (z <= 0) return null;

  return {
    x: cx + radius * cosLat * Math.sin(lonRad),
    y: cy - radius * Math.sin(latRad),
    z,
  };
}

export default function EarthCanvas({ className }: EarthCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    const draw = (time: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) {
        frameRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const radius = Math.min(width, height) * 0.34;
      const cx = width * 0.54;
      const cy = height * 0.5;
      const rotation = time * 0.000045;
      const cloudRotation = rotation * 1.28;

      const halo = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * 1.85);
      halo.addColorStop(0, 'rgba(59,130,246,0.18)');
      halo.addColorStop(0.38, 'rgba(14,165,233,0.12)');
      halo.addColorStop(0.7, 'rgba(16,185,129,0.05)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.85, 0, Math.PI * 2);
      ctx.fill();

      const sphere = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.32, radius * 0.18, cx, cy, radius);
      sphere.addColorStop(0, 'rgba(100,210,255,0.3)');
      sphere.addColorStop(0.28, 'rgba(31,111,188,0.95)');
      sphere.addColorStop(0.66, 'rgba(10,34,74,0.98)');
      sphere.addColorStop(1, 'rgba(2,10,25,1)');
      ctx.fillStyle = sphere;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      for (let lat = -84; lat <= 84; lat += 6) {
        for (let lon = -180; lon <= 180; lon += 6) {
          const point = projectPoint(cx, cy, radius, lat, lon, rotation);
          if (!point) continue;
          const { x, y, z } = point;
          const highlight = Math.max(0, z);
          const land = sampleBlob(lat, lon - (rotation * 180) / Math.PI, LAND_BLOBS);
          const oceanGlow = sampleBlob(lat, lon - (rotation * 180) / Math.PI, CLOUD_BLOBS) * 0.18;
          const size = 0.8 + highlight * 1.8 + land * 1.1;

          if (land > 0.04) {
            const alpha = 0.2 + land * 0.42 + highlight * 0.18;
            ctx.fillStyle = `rgba(109,229,196,${alpha.toFixed(3)})`;
          } else {
            const alpha = 0.08 + highlight * 0.12 + oceanGlow;
            ctx.fillStyle = `rgba(90,160,255,${alpha.toFixed(3)})`;
          }

          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (let lat = -72; lat <= 72; lat += 12) {
        ctx.beginPath();
        for (let lon = -180; lon <= 180; lon += 6) {
          const point = projectPoint(cx, cy, radius, lat, lon, rotation);
          if (!point) continue;
          if (lon === -180 || point.z <= 0.03) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
        ctx.strokeStyle = 'rgba(148,163,184,0.06)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (let lon = -150; lon <= 180; lon += 30) {
        ctx.beginPath();
        for (let lat = -84; lat <= 84; lat += 4) {
          const point = projectPoint(cx, cy, radius, lat, lon, rotation);
          if (!point) continue;
          if (lat === -84 || point.z <= 0.03) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
        ctx.strokeStyle = 'rgba(96,165,250,0.045)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (let lat = -84; lat <= 84; lat += 10) {
        for (let lon = -180; lon <= 180; lon += 10) {
          const point = projectPoint(cx, cy, radius, lat, lon, cloudRotation);
          if (!point) continue;

          const cloud = sampleBlob(lat, lon - (cloudRotation * 180) / Math.PI, CLOUD_BLOBS);
          if (cloud < 0.14) continue;

          ctx.fillStyle = `rgba(226,232,240,${(0.04 + cloud * 0.18).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 0.8 + cloud * 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const visibleNodes = new Map(
        NODE_POINTS.map(node => [node.id, projectPoint(cx, cy, radius, node.lat, node.lon, rotation)])
      );

      for (const [fromId, toId] of CONNECTIONS) {
        const from = visibleNodes.get(fromId);
        const to = visibleNodes.get(toId);
        if (!from || !to) continue;

        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2 - radius * 0.18;
        const routeGlow = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
        routeGlow.addColorStop(0, 'rgba(56,189,248,0)');
        routeGlow.addColorStop(0.45, 'rgba(56,189,248,0.24)');
        routeGlow.addColorStop(0.55, 'rgba(110,231,255,0.34)');
        routeGlow.addColorStop(1, 'rgba(56,189,248,0)');
        ctx.strokeStyle = routeGlow;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(midX, midY, to.x, to.y);
        ctx.stroke();

        const pulseT = ((time * 0.00022) + (from.x + to.x) * 0.0005) % 1;
        const pulseX = (1 - pulseT) * (1 - pulseT) * from.x + 2 * (1 - pulseT) * pulseT * midX + pulseT * pulseT * to.x;
        const pulseY = (1 - pulseT) * (1 - pulseT) * from.y + 2 * (1 - pulseT) * pulseT * midY + pulseT * pulseT * to.y;
        ctx.beginPath();
        ctx.arc(pulseX, pulseY, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(186,230,253,0.92)';
        ctx.fill();
      }

      for (const node of NODE_POINTS) {
        const point = visibleNodes.get(node.id);
        if (!point) continue;

        const outer = 5 + node.size * 3;
        const pulse = 0.75 + Math.sin(time * 0.002 + point.x * 0.01) * 0.15;
        ctx.beginPath();
        ctx.arc(point.x, point.y, outer * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `${node.color}22`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(point.x, point.y, 1.8 + node.size * 1.7, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
      }

      const terminator = ctx.createLinearGradient(cx - radius * 1.15, cy, cx + radius * 1.2, cy);
      terminator.addColorStop(0, 'rgba(2,8,20,0.02)');
      terminator.addColorStop(0.56, 'rgba(2,8,20,0.05)');
      terminator.addColorStop(0.76, 'rgba(2,8,20,0.34)');
      terminator.addColorStop(1, 'rgba(2,8,20,0.68)');
      ctx.fillStyle = terminator;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      ctx.restore();

      const atmosphere = ctx.createRadialGradient(cx, cy, radius * 0.92, cx, cy, radius * 1.08);
      atmosphere.addColorStop(0, 'rgba(0,0,0,0)');
      atmosphere.addColorStop(0.72, 'rgba(56,189,248,0.08)');
      atmosphere.addColorStop(0.9, 'rgba(110,231,255,0.28)');
      atmosphere.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = atmosphere;
      ctx.lineWidth = radius * 0.1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.01, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(cx + radius * 0.14, cy + radius * 1.12, radius * 1.02, radius * 0.18, -0.08, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15,23,42,0.38)';
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(cx + radius * 0.07, cy + radius * 1.06, radius * 0.74, radius * 0.11, -0.08, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56,189,248,0.08)';
      ctx.fill();

      frameRef.current = requestAnimationFrame(draw);
    };

    resize();
    frameRef.current = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      aria-hidden="true"
    />
  );
}
