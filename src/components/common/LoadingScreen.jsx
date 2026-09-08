import { Seal } from './Seal';

/**
 * Full-screen splash shown while the app boots (session restore, initial
 * config fetch, etc). Deliberately quiet: seal, name, campus line, and a
 * thin indeterminate bar — nothing that reads as a consumer-app splash.
 */
export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white">
      <Seal size="xl" animated />

      <div className="flex flex-col items-center gap-1 text-center opacity-0 animate-fade-up">
        <h1 className="text-3xl font-semibold tracking-tight text-primary-900">
          CampusDrive
        </h1>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Laguna State Polytechnic University &ndash; Los Ba&ntilde;os Campus
        </p>
      </div>

      <div
        className="h-1 w-48 overflow-hidden rounded-full bg-slate-100"
        role="status"
        aria-label="Loading CampusDrive"
      >
        <div className="h-full w-1/3 animate-[loading-bar_1.1s_ease-in-out_infinite] rounded-full bg-secondary-500" />
      </div>

      <style>{`
        @keyframes loading-bar {
          0%   { transform: translateX(-120%); }
          50%  { transform: translateX(80%); }
          100% { transform: translateX(220%); }
        }
      `}</style>
    </div>
  );
}
