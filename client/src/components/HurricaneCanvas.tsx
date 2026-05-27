// ============================================================
// HurricaneCanvas — 3D-style animated hurricane vortex
// Shows the storm traveling its track, intensifying over water,
// and weakening on landfall. Canvas-based, no external deps.
// ============================================================
import { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

interface TrackPoint { lat: number; lng: number; label?: string; }

interface HurricaneCanvasProps {
  track: TrackPoint[];
  category: number;
  stormType: string;
  windSpeedKph: number;
  radiusKm: number;
  isRunning: boolean;
  className?: string;
}

// Category → visual config
const CAT_CONFIG: Record<number, { color: string; eyeColor: string; bandColor: string; glowColor: string; size: number; label: string }> = {
  0: { color: '#94a3b8', eyeColor: '#cbd5e1', bandColor: '#64748b', glowColor: 'rgba(148,163,184,0.3)', size: 0.35, label: 'Tropical Storm' },
  1: { color: '#22d3ee', eyeColor: '#a5f3fc', bandColor: '#0891b2', glowColor: 'rgba(34,211,238,0.35)', size: 0.42, label: 'Category 1' },
  2: { color: '#a3e635', eyeColor: '#d9f99d', bandColor: '#65a30d', glowColor: 'rgba(163,230,53,0.35)', size: 0.50, label: 'Category 2' },
  3: { color: '#facc15', eyeColor: '#fef08a', bandColor: '#ca8a04', glowColor: 'rgba(250,204,21,0.40)', size: 0.60, label: 'Category 3' },
  4: { color: '#f97316', eyeColor: '#fed7aa', bandColor: '#c2410c', glowColor: 'rgba(249,115,22,0.45)', size: 0.72, label: 'Category 4' },
  5: { color: '#ef4444', eyeColor: '#fecaca', bandColor: '#991b1b', glowColor: 'rgba(239,68,68,0.55)', size: 0.88, label: 'Category 5' },
};

// Determine if a track point is "over land" (very rough — Tampa Bay area heuristic)
function isOverLand(pt: TrackPoint): boolean {
  // Simplified: if lat > 27.5 and lng > -82.6 we treat as landfall/inland
  return pt.lat > 27.5 && pt.lng > -82.6;
}

// Interpolate between two track points by t ∈ [0,1]
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export default function HurricaneCanvas({
  track,
  category,
  stormType,
  windSpeedKph,
  isRunning,
  className,
}: HurricaneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);
  const progressRef = useRef(0); // 0 → 1 along the track
  const speedRef = useRef(0.0008); // progress units per frame
  const directionRef = useRef<1 | -1>(1); // playback direction
  const [isPaused, setIsPaused] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentCat, setCurrentCat] = useState(category);
  const [isLandfall, setIsLandfall] = useState(false);

  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  const playSpeedRef = useRef(1);
  playSpeedRef.current = playSpeed;

  // Get interpolated position along track
  const getPositionOnTrack = useCallback((progress: number): TrackPoint => {
    if (track.length === 0) return { lat: 27.95, lng: -82.45 };
    if (track.length === 1) return track[0];
    const scaled = progress * (track.length - 1);
    const idx = Math.min(Math.floor(scaled), track.length - 2);
    const t = scaled - idx;
    return {
      lat: lerp(track[idx].lat, track[idx + 1].lat, t),
      lng: lerp(track[idx].lng, track[idx + 1].lng, t),
    };
  }, [track]);

  // Draw the hurricane vortex
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, time: number, progress: number) => {
    ctx.clearRect(0, 0, w, h);

    // Dark ocean background
    const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    bg.addColorStop(0, '#0a1628');
    bg.addColorStop(1, '#020b18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Draw track path (faint)
    if (track.length >= 2) {
      const scaleX = (lng: number) => ((lng - (track[0].lng - 2)) / 6) * w;
      const scaleY = (lat: number) => h - ((lat - (track[0].lat - 1)) / 6) * h;

      ctx.beginPath();
      ctx.moveTo(scaleX(track[0].lng), scaleY(track[0].lat));
      for (let i = 1; i < track.length; i++) {
        ctx.lineTo(scaleX(track[i].lng), scaleY(track[i].lat));
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Waypoint dots
      track.forEach((pt, i) => {
        const x = scaleX(pt.lng);
        const y = scaleY(pt.lat);
        ctx.beginPath();
        ctx.arc(x, y, i === 0 || i === track.length - 1 ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? 'rgba(34,211,238,0.6)' : i === track.length - 1 ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.3)';
        ctx.fill();
      });

      // Storm position dot on track
      const pos = getPositionOnTrack(progress);
      const sx = scaleX(pos.lng);
      const sy = scaleY(pos.lat);

      // Draw storm at center
      drawVortex(ctx, sx, sy, w, h, time, progress, pos);
    } else {
      // No track — draw centered
      drawVortex(ctx, w / 2, h / 2, w, h, time, progress, { lat: 27.95, lng: -82.45 });
    }
  }, [track, getPositionOnTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  const drawVortex = (
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    w: number, h: number,
    time: number,
    progress: number,
    pos: TrackPoint
  ) => {
    const onLand = track.length >= 2 && isOverLand(pos);
    const landDecay = onLand ? Math.max(0.3, 1 - (progress - 0.6) * 1.5) : 1;

    // Effective category: weaken over land
    const effectiveCat = Math.max(0, Math.round(category * landDecay));
    const cfg = CAT_CONFIG[effectiveCat] ?? CAT_CONFIG[0];

    const baseRadius = Math.min(w, h) * 0.38 * cfg.size * landDecay;
    const eyeRadius = baseRadius * 0.18;

    // Outer glow
    const glow = ctx.createRadialGradient(cx, cy, eyeRadius, cx, cy, baseRadius * 1.6);
    glow.addColorStop(0, cfg.glowColor);
    glow.addColorStop(0.5, cfg.glowColor.replace('0.', '0.1'));
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Spiral bands (6 arms)
    const numBands = 6;
    const rotSpeed = stormType === 'tornado' ? 4 : (1 + (category - 1) * 0.3);
    for (let band = 0; band < numBands; band++) {
      const bandOffset = (band / numBands) * Math.PI * 2;
      ctx.beginPath();
      const steps = 80;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const r = eyeRadius + (baseRadius - eyeRadius) * t;
        // Counter-clockwise (Northern Hemisphere)
        const angle = bandOffset - time * rotSpeed - t * Math.PI * 3.5;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r * 0.85; // slight ellipse for 3D feel
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const bandAlpha = 0.55 * landDecay;
      ctx.strokeStyle = cfg.bandColor + Math.round(bandAlpha * 255).toString(16).padStart(2, '0');
      ctx.lineWidth = Math.max(1.5, baseRadius * 0.045);
      ctx.stroke();
    }

    // Main cloud disc
    const disc = ctx.createRadialGradient(cx, cy, eyeRadius, cx, cy, baseRadius);
    disc.addColorStop(0, 'transparent');
    disc.addColorStop(0.3, cfg.color + '18');
    disc.addColorStop(0.7, cfg.color + '28');
    disc.addColorStop(1, cfg.color + '08');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.ellipse(cx, cy, baseRadius, baseRadius * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye wall (dense ring)
    const eyeWall = ctx.createRadialGradient(cx, cy, eyeRadius * 0.7, cx, cy, eyeRadius * 1.5);
    eyeWall.addColorStop(0, 'transparent');
    eyeWall.addColorStop(0.5, cfg.color + '66');
    eyeWall.addColorStop(1, 'transparent');
    ctx.fillStyle = eyeWall;
    ctx.beginPath();
    ctx.arc(cx, cy, eyeRadius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye (calm center)
    const eye = ctx.createRadialGradient(cx, cy, 0, cx, cy, eyeRadius);
    eye.addColorStop(0, cfg.eyeColor + 'cc');
    eye.addColorStop(0.6, cfg.eyeColor + '44');
    eye.addColorStop(1, 'transparent');
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(cx, cy, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Rotation particles
    const numParticles = Math.floor(12 + category * 4);
    for (let p = 0; p < numParticles; p++) {
      const pAngle = (p / numParticles) * Math.PI * 2 - time * rotSpeed * 1.2;
      const pRadius = eyeRadius * 1.3 + (baseRadius - eyeRadius * 1.3) * (0.2 + (p % 3) * 0.25);
      const px = cx + Math.cos(pAngle) * pRadius;
      const py = cy + Math.sin(pAngle) * pRadius * 0.85;
      const pSize = Math.max(1, baseRadius * 0.018);
      ctx.beginPath();
      ctx.arc(px, py, pSize, 0, Math.PI * 2);
      ctx.fillStyle = cfg.color + 'aa';
      ctx.fill();
    }

    // Landfall weakening effect: rain streaks
    if (onLand && landDecay < 0.85) {
      const streakCount = Math.floor((1 - landDecay) * 30);
      for (let s = 0; s < streakCount; s++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = eyeRadius + Math.random() * baseRadius * 1.2;
        const sx2 = cx + Math.cos(angle) * dist;
        const sy2 = cy + Math.sin(angle) * dist;
        ctx.beginPath();
        ctx.moveTo(sx2, sy2);
        ctx.lineTo(sx2 + 3, sy2 + 8);
        ctx.strokeStyle = 'rgba(147,197,253,0.3)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // Category label
    const labelY = cy + baseRadius + 18;
    ctx.font = `bold ${Math.max(10, Math.min(13, w * 0.035))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = cfg.color;
    ctx.fillText(
      onLand && landDecay < 0.85
        ? `${cfg.label} → WEAKENING`
        : cfg.label,
      cx, labelY
    );

    // Wind speed
    ctx.font = `${Math.max(9, Math.min(11, w * 0.028))}px monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`${Math.round(windSpeedKph * landDecay)} km/h`, cx, labelY + 15);

    // Progress indicator
    if (track.length >= 2) {
      const pct = Math.round(progress * 100);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = `${Math.max(8, Math.min(10, w * 0.025))}px monospace`;
      ctx.fillText(`Track: ${pct}%`, cx, h - 10);
    }
  };

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = 0;

    const animate = (ts: number) => {
      const dt = Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;

      if (!isPausedRef.current && isRunning) {
        timeRef.current += dt * 1.2 * playSpeedRef.current;
        const trackLen = Math.max(track.length - 1, 1);
        progressRef.current = Math.min(1, progressRef.current + (dt * 0.04 * playSpeedRef.current) / trackLen);
        if (progressRef.current >= 1) progressRef.current = 0; // loop

        setCurrentProgress(Math.round(progressRef.current * 100));

        // Update live category display
        const pos = track.length >= 2 ? getPositionOnTrack(progressRef.current) : { lat: 27.95, lng: -82.45 };
        const onLand = track.length >= 2 && isOverLand(pos);
        const decay = onLand ? Math.max(0.3, 1 - (progressRef.current - 0.6) * 1.5) : 1;
        setCurrentCat(Math.max(0, Math.round(category * decay)));
        setIsLandfall(onLand);
      }

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
      }

      draw(ctx, w, h, timeRef.current, progressRef.current);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw, isRunning, track, category, getPositionOnTrack]);

  // Reset progress when track changes
  useEffect(() => {
    progressRef.current = 0;
    timeRef.current = 0;
  }, [track]);

  const cfg = CAT_CONFIG[currentCat] ?? CAT_CONFIG[0];

  return (
    <div className={cn('flex flex-col bg-[#020b18] rounded-xl overflow-hidden border border-white/[0.06]', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: cfg.color }} />
          <span className="text-xs font-mono" style={{ color: cfg.color }}>
            {isLandfall ? '⚡ LANDFALL — WEAKENING' : `${cfg.label} · ${windSpeedKph} km/h`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Speed control */}
          <div className="flex items-center gap-1">
            {[0.5, 1, 2, 4].map(s => (
              <button
                key={s}
                onClick={() => setPlaySpeed(s)}
                className={cn(
                  'text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors',
                  playSpeed === s ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'
                )}
              >
                {s}×
              </button>
            ))}
          </div>
          {/* Play/pause */}
          <button
            onClick={() => setIsPaused(v => !v)}
            className="text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 text-white/60 hover:text-white/90 transition-colors"
          >
            {isPaused ? '▶ Play' : '⏸ Pause'}
          </button>
          {/* Restart */}
          <button
            onClick={() => { progressRef.current = 0; timeRef.current = 0; setCurrentProgress(0); }}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-white/60 hover:text-white/90 transition-colors"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full flex-1"
        style={{ minHeight: 220 }}
      />

      {/* Progress bar */}
      <div className="h-1 bg-white/5">
        <div
          className="h-full transition-none"
          style={{ width: `${currentProgress}%`, background: cfg.color, opacity: 0.7 }}
        />
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/[0.06]">
        <span className="text-[10px] font-mono text-white/30">
          {track.length >= 2 ? `${track.length} waypoints · looping` : 'Add track points to animate path'}
        </span>
        <span className="text-[10px] font-mono" style={{ color: cfg.color + 'aa' }}>
          {currentProgress}% along track
        </span>
      </div>
    </div>
  );
}
