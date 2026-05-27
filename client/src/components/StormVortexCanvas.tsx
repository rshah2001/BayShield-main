import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface StormVortexCanvasProps {
  className?: string;
}

type StormMode = 'cyclone' | 'tornado' | 'tropical-rain' | 'flood';

type Particle = {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  lane: number;
  alpha: number;
};

const MODES: StormMode[] = ['cyclone', 'tornado', 'tropical-rain', 'flood'];
const MODE_DURATION_MS = 12000;
const PARTICLE_COUNT = 140;

const MODE_META: Record<StormMode, { glow: string; core: string; accent: string }> = {
  cyclone: {
    glow: 'rgba(56,189,248,0.24)',
    core: 'rgba(186,230,253,0.92)',
    accent: 'rgba(34,211,238,0.85)',
  },
  tornado: {
    glow: 'rgba(125,211,252,0.18)',
    core: 'rgba(226,232,240,0.82)',
    accent: 'rgba(148,163,184,0.74)',
  },
  'tropical-rain': {
    glow: 'rgba(45,212,191,0.18)',
    core: 'rgba(125,211,252,0.8)',
    accent: 'rgba(34,197,94,0.56)',
  },
  flood: {
    glow: 'rgba(59,130,246,0.2)',
    core: 'rgba(147,197,253,0.84)',
    accent: 'rgba(96,165,250,0.58)',
  },
};

function easeInOutSine(value: number) {
  return -(Math.cos(Math.PI * value) - 1) / 2;
}

export default function StormVortexCanvas({ className }: StormVortexCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const createParticles = () => {
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
        angle: Math.random() * Math.PI * 2,
        radius: 0.18 + Math.random() * 0.92,
        speed: 0.0014 + Math.random() * 0.004,
        size: 0.8 + Math.random() * 2.8,
        lane: index % 4,
        alpha: 0.16 + Math.random() * 0.42,
      }));
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      createParticles();
    };

    const drawCyclone = (
      width: number,
      height: number,
      time: number,
      opacity: number
    ) => {
      const cx = width * 0.66;
      const cy = height * 0.42;
      const radius = Math.min(width, height) * 0.18;
      const meta = MODE_META.cyclone;

      const glow = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * 2.4);
      glow.addColorStop(0, meta.glow.replace('0.24', `${0.34 * opacity}`));
      glow.addColorStop(0.4, `rgba(56,189,248,${0.12 * opacity})`);
      glow.addColorStop(1, 'rgba(2,6,23,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 2.4, 0, Math.PI * 2);
      ctx.fill();

      for (let arm = 0; arm < 4; arm += 1) {
        ctx.beginPath();
        for (let step = 0; step <= 120; step += 1) {
          const t = step / 120;
          const spiral = arm * (Math.PI / 2) + t * 5.6 + time * 0.0011;
          const r = radius * (0.2 + t * 1.3);
          const x = cx + Math.cos(spiral) * r;
          const y = cy + Math.sin(spiral) * r * 0.7;
          if (step === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(186,230,253,${(0.06 + opacity * 0.18).toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      for (const particle of particlesRef.current) {
        particle.angle += particle.speed * 2.2;
        particle.radius -= particle.speed * 0.065;
        if (particle.radius <= 0.08) {
          particle.radius = 1;
          particle.angle = Math.random() * Math.PI * 2;
        }

        const swirl = particle.angle + particle.radius * 9 + time * 0.0005;
        const px = cx + Math.cos(swirl) * radius * particle.radius * 1.35;
        const py = cy + Math.sin(swirl) * radius * particle.radius * 0.86;

        ctx.beginPath();
        ctx.arc(px, py, particle.size * (0.28 + particle.radius * 0.48), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(186,230,253,${(particle.alpha * opacity).toFixed(3)})`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(2,6,23,${0.82 * opacity})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.28, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(125,211,252,${0.34 * opacity})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    const drawTornado = (
      width: number,
      height: number,
      time: number,
      opacity: number
    ) => {
      const cx = width * 0.63;
      const topY = height * 0.23;
      const baseY = height * 0.74;
      const meta = MODE_META.tornado;

      const glow = ctx.createRadialGradient(cx, topY + (baseY - topY) * 0.45, 0, cx, topY, height * 0.36);
      glow.addColorStop(0, `rgba(148,163,184,${0.14 * opacity})`);
      glow.addColorStop(1, 'rgba(2,6,23,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, topY + (baseY - topY) * 0.42, height * 0.36, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 24; i += 1) {
        const t = i / 23;
        const y = topY + (baseY - topY) * t;
        const widthAtY = (1 - t) * 88 + 18 + Math.sin(time * 0.0018 + t * 9) * 10;
        const twist = Math.sin(time * 0.0019 + t * 8.5) * (26 - t * 12);

        ctx.beginPath();
        ctx.moveTo(cx - widthAtY * 0.5 + twist, y);
        ctx.lineTo(cx + widthAtY * 0.5 + twist, y);
        ctx.strokeStyle = `rgba(226,232,240,${(0.015 + (1 - t) * 0.06 * opacity).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      for (let step = 0; step <= 64; step += 1) {
        const t = step / 64;
        const y = topY + (baseY - topY) * t;
        const offset = Math.sin(time * 0.002 + t * 9) * 22;
        const halfWidth = (1 - t) * 44 + 9;
        const x = cx - halfWidth + offset;
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let step = 64; step >= 0; step -= 1) {
        const t = step / 64;
        const y = topY + (baseY - topY) * t;
        const offset = Math.sin(time * 0.002 + t * 9) * 22;
        const halfWidth = (1 - t) * 44 + 9;
        ctx.lineTo(cx + halfWidth + offset, y);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(203,213,225,${0.08 * opacity})`;
      ctx.fill();

      for (const particle of particlesRef.current) {
        particle.angle += particle.speed * 1.7;
        const ty = baseY - particle.radius * (baseY - topY);
        const funnel = (1 - particle.radius) * 66 + 14;
        const offset = Math.sin(time * 0.0022 + particle.radius * 10) * 18;
        const px = cx + offset + Math.cos(particle.angle) * funnel * 0.42;
        const py = ty + Math.sin(particle.angle * 1.6) * 5;

        ctx.beginPath();
        ctx.arc(px, py, particle.size * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(226,232,240,${(particle.alpha * 0.7 * opacity).toFixed(3)})`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.ellipse(cx + Math.sin(time * 0.0017) * 16, baseY + 16, 96, 22, 0.08, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(125,211,252,${0.08 * opacity})`;
      ctx.fill();
      ctx.strokeStyle = meta.accent.replace('0.74', `${0.28 * opacity}`);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    const drawTropicalRain = (
      width: number,
      height: number,
      time: number,
      opacity: number
    ) => {
      const cx = width * 0.68;
      const cy = height * 0.4;
      const radius = Math.min(width, height) * 0.15;
      const meta = MODE_META['tropical-rain'];

      const cloud = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * 1.9);
      cloud.addColorStop(0, `rgba(45,212,191,${0.14 * opacity})`);
      cloud.addColorStop(0.5, `rgba(59,130,246,${0.1 * opacity})`);
      cloud.addColorStop(1, 'rgba(2,6,23,0)');
      ctx.fillStyle = cloud;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 2, 0, Math.PI * 2);
      ctx.fill();

      for (let ring = 0; ring < 3; ring += 1) {
        ctx.beginPath();
        for (let step = 0; step <= 90; step += 1) {
          const t = step / 90;
          const angle = t * Math.PI * 2 + time * 0.00055 + ring * 1.2;
          const wave = radius * (0.5 + ring * 0.36 + Math.sin(t * 12 + time * 0.0012) * 0.06);
          const x = cx + Math.cos(angle) * wave * 1.4;
          const y = cy + Math.sin(angle) * wave * 0.56;
          if (step === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(125,211,252,${(0.06 + opacity * 0.12).toFixed(3)})`;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }

      for (let i = 0; i < 80; i += 1) {
        const x = ((i * 37.7) % (width * 0.44)) + width * 0.46;
        const travel = (time * (0.16 + (i % 7) * 0.018) + i * 49) % (height + 40);
        const y = travel - 20;
        const len = 10 + (i % 4) * 5;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 7, y + len);
        ctx.strokeStyle = `rgba(186,230,253,${(0.08 + opacity * 0.2).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = meta.core.replace('0.8', `${0.3 * opacity}`);
      ctx.fill();
    };

    const drawFlood = (
      width: number,
      height: number,
      time: number,
      opacity: number
    ) => {
      const cx = width * 0.66;
      const cy = height * 0.6;
      const meta = MODE_META.flood;

      const haze = ctx.createLinearGradient(0, cy - 160, 0, height);
      haze.addColorStop(0, 'rgba(2,6,23,0)');
      haze.addColorStop(0.45, `rgba(37,99,235,${0.07 * opacity})`);
      haze.addColorStop(1, `rgba(14,116,144,${0.12 * opacity})`);
      ctx.fillStyle = haze;
      ctx.fillRect(width * 0.42, cy - 140, width * 0.5, height - cy + 160);

      for (let i = 0; i < 7; i += 1) {
        const progress = ((time * 0.00012) + i * 0.16) % 1;
        const rx = 60 + progress * 220;
        const ry = 12 + progress * 42;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 24, rx, ry, 0.04, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(125,211,252,${((1 - progress) * 0.18 * opacity).toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      for (let band = 0; band < 5; band += 1) {
        const y = cy + band * 24;
        ctx.beginPath();
        for (let step = 0; step <= 120; step += 1) {
          const t = step / 120;
          const x = width * 0.44 + t * width * 0.44;
          const wave = Math.sin(t * 15 + time * 0.0018 + band) * (6 + band * 1.4);
          if (step === 0) ctx.moveTo(x, y + wave);
          else ctx.lineTo(x, y + wave);
        }
        ctx.strokeStyle = `rgba(147,197,253,${(0.06 + opacity * 0.09).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      for (let i = 0; i < 36; i += 1) {
        const drift = ((time * 0.02) + i * 23) % (width * 0.42);
        const x = width * 0.47 + drift;
        const y = cy + (i % 8) * 18 + Math.sin(time * 0.0016 + i) * 6;
        ctx.beginPath();
        ctx.arc(x, y, 1.2 + (i % 3), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(186,230,253,${(0.05 + opacity * 0.12).toFixed(3)})`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.ellipse(cx, cy + 20, 180, 34, 0.02, 0, Math.PI * 2);
      ctx.fillStyle = meta.glow.replace('0.2', `${0.18 * opacity}`);
      ctx.fill();
    };

    const draw = (time: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) {
        frameRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const modeIndex = Math.floor(time / MODE_DURATION_MS) % MODES.length;
      const nextIndex = (modeIndex + 1) % MODES.length;
      const cycleProgress = (time % MODE_DURATION_MS) / MODE_DURATION_MS;
      const blendWindow = Math.max(0, (cycleProgress - 0.78) / 0.22);
      const mix = easeInOutSine(blendWindow);
      const activeMode = MODES[modeIndex];
      const nextMode = MODES[nextIndex];

      const drawMode = (mode: StormMode, opacity: number) => {
        if (opacity <= 0.001) return;
        if (mode === 'cyclone') drawCyclone(width, height, time, opacity);
        if (mode === 'tornado') drawTornado(width, height, time, opacity);
        if (mode === 'tropical-rain') drawTropicalRain(width, height, time, opacity);
        if (mode === 'flood') drawFlood(width, height, time, opacity);
      };

      drawMode(activeMode, 1 - mix * 0.95);
      drawMode(nextMode, mix);

      const meta = MODE_META[activeMode];
      const vignette = ctx.createRadialGradient(width * 0.68, height * 0.44, 0, width * 0.68, height * 0.44, Math.min(width, height) * 0.42);
      vignette.addColorStop(0, meta.glow.replace(/0\.\d+\)/, `${0.18 * (1 - mix * 0.4)})`));
      vignette.addColorStop(1, 'rgba(2,6,23,0)');
      ctx.fillStyle = vignette;
      ctx.beginPath();
      ctx.arc(width * 0.68, height * 0.44, Math.min(width, height) * 0.42, 0, Math.PI * 2);
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
