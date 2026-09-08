import { Icon } from '../common/Icon';

/**
 * Stands in for the live camera feed until the YOLOv8 + PP-OCRv3
 * pipeline is wired up. `state` drives the visual: idle (viewfinder),
 * scanning (animated line + pulse), done (dimmed, result renders on top).
 */
export function CameraPreview({ state = 'idle' }) {
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-slate-900 sm:aspect-video">
      {/* Simulated viewfinder */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon name="camera" className="h-16 w-16 text-slate-700" />
      </div>

      {/* Corner guides */}
      <div className="pointer-events-none absolute inset-6 sm:inset-10">
        {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2', 'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map(
          (cls) => (
            <span key={cls} className={`absolute h-8 w-8 rounded-sm border-secondary-400 ${cls}`} />
          ),
        )}
      </div>

      {state === 'scanning' && (
        <div className="absolute inset-x-6 top-6 h-0.5 animate-[scan-line_1.4s_ease-in-out_infinite] bg-secondary-400 shadow-[0_0_12px_2px_rgba(245,196,0,0.7)] sm:inset-x-10" />
      )}

      {state === 'scanning' && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center">
          <span className="rounded-full bg-slate-900/80 px-4 py-1.5 text-xs font-medium text-secondary-300">
            Reading sticker…
          </span>
        </div>
      )}

      <style>{`
        @keyframes scan-line {
          0% { transform: translateY(0); opacity: 0.3; }
          50% { opacity: 1; }
          100% { transform: translateY(calc(100% + 1rem)); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
