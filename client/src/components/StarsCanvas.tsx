import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface StarsCanvasProps {
  className?: string;
}

type Star = {
  x: number;
  y: number;
  z: number;
  radius: number;
  alpha: number;
  drift: number;
};

const STAR_COUNT = 170;

export default function StarsCanvas({ className }: StarsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const starsRef = useRef<Star[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const createStars = (width: number, height: number) => {
      starsRef.current = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random(),
        radius: 0.35 + Math.random() * 1.75,
        alpha: 0.2 + Math.random() * 0.55,
        drift: 0.03 + Math.random() * 0.18,
      }));
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      createStars(width, height);
    };

    const draw = (time: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);

      for (const star of starsRef.current) {
        star.y += star.drift * (0.55 + star.z);
        if (star.y > height + 6) {
          star.y = -6;
          star.x = Math.random() * width;
        }

        const twinkle = 0.72 + Math.sin(time * 0.0012 + star.x * 0.014 + star.y * 0.01) * 0.28;
        const alpha = star.alpha * twinkle;
        const glow = star.radius * (2.6 + star.z * 1.6);

        ctx.beginPath();
        ctx.arc(star.x, star.y, glow, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148, 197, 255, ${(alpha * 0.08).toFixed(3)})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(226, 240, 255, ${alpha.toFixed(3)})`;
        ctx.fill();
      }

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

  return <canvas ref={canvasRef} className={cn('pointer-events-none absolute inset-0 h-full w-full', className)} aria-hidden="true" />;
}
