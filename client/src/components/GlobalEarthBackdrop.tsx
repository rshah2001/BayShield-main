import EarthCanvas from '@/components/EarthCanvas';
import StarsCanvas from '@/components/StarsCanvas';
import StormVortexCanvas from '@/components/StormVortexCanvas';

export default function GlobalEarthBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.78),rgba(2,6,23,0.94))]" />
      <StarsCanvas className="opacity-95" />
      <div className="absolute inset-0 opacity-[0.9] mix-blend-screen">
        <StormVortexCanvas className="opacity-[0.78]" />
      </div>
      <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute left-[-12vw] top-[6vh] h-[34vw] w-[34vw] min-h-[260px] min-w-[260px] rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),rgba(2,6,23,0)_68%)] blur-3xl" />
      <div className="absolute right-[-14vw] top-[8vh] h-[88vh] w-[88vh] min-h-[540px] min-w-[540px] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.13),rgba(2,6,23,0)_64%)] blur-3xl" />
      <div className="absolute right-[10vw] top-[14vh] h-[50vh] w-[42vw] min-h-[320px] min-w-[320px] max-w-[720px] opacity-75 blur-[2px] sm:right-[8vw] sm:top-[12vh]">
        <StormVortexCanvas className="opacity-95" />
      </div>
      <div className="absolute inset-y-0 right-[-8vw] w-[90vw] max-w-[1100px] opacity-75 sm:right-[-3vw] sm:w-[74vw]">
        <EarthCanvas className="opacity-95" />
      </div>
      <div className="absolute -bottom-[8vh] left-[4vw] hidden h-[46vh] w-[46vh] min-h-[280px] min-w-[280px] opacity-35 lg:block">
        <EarthCanvas className="opacity-55" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.92)_0%,rgba(2,6,23,0.64)_28%,rgba(2,6,23,0.3)_52%,rgba(2,6,23,0.74)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_48%,rgba(56,189,248,0.1),transparent_24%)]" />
    </div>
  );
}
