/**
 * steps: [{ label, date, done }]
 * The first non-done step is treated as "in progress" and gets an
 * accent ring instead of a filled dot.
 */
export function Timeline({ steps }) {
  const firstPendingIndex = steps.findIndex((s) => !s.done);

  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const isDone = step.done;
        const isCurrent = index === firstPendingIndex;
        const isLast = index === steps.length - 1;

        return (
          <li key={step.label} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && (
              <span
                className={`absolute left-[11px] top-6 h-full w-0.5 ${isDone ? 'bg-accent-400' : 'bg-slate-200'}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`z-10 mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 text-xs font-bold
                ${
                  isDone
                    ? 'border-accent-500 bg-accent-500 text-white'
                    : isCurrent
                      ? 'border-secondary-500 bg-white text-secondary-600'
                      : 'border-slate-200 bg-white text-slate-300'
                }`}
            >
              {isDone ? '✓' : index + 1}
            </span>
            <div className="pb-1">
              <p className={`text-sm font-medium ${isDone || isCurrent ? 'text-slate-800' : 'text-slate-400'}`}>
                {step.label}
              </p>
              {step.date && <p className="text-xs text-slate-400">{step.date}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
