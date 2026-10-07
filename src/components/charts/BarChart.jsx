/**
 * data: [{ label, value, secondaryValue? }]
 * Renders a simple vertical bar chart with CSS heights.
 */
export function BarChart({ data, valueFormatter = (v) => v }) {
  // Calculate max to scale the bars (ensures no division by zero)
  const max = Math.max(...data.map((d) => d.value + (d.secondaryValue || 0)), 1);

  return (
    // FIXED: Added strict height (h-[240px]) to prevent Tailwind flex collapse
    <div className="flex w-full h-[240px] items-end gap-2 sm:gap-4 pt-4 pb-2">
      {data.map((d) => (
        <div key={d.label} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
          
          {/* Value Tooltip on Hover */}
          <span className="text-[11px] font-bold text-slate-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {d.value + (d.secondaryValue || 0)}
          </span>

          {/* Chart Bar Track */}
          <div className="flex w-full max-w-[48px] flex-1 flex-col-reverse items-stretch overflow-hidden rounded-t-lg bg-slate-50 border-x border-t border-slate-100">
            
            {/* Flagged / Denied Entries (Stacked on top) */}
            {d.secondaryValue > 0 && (
              <div
                className="w-full bg-rose-400 transition-all duration-500 ease-out group-hover:bg-rose-500"
                style={{ height: `${(d.secondaryValue / max) * 100}%` }}
                title={`${d.secondaryValue} flagged`}
              />
            )}
            
            {/* Valid Entries (Bottom layer) */}
            <div
              className="w-full bg-blue-500 transition-all duration-500 ease-out group-hover:bg-blue-600"
              style={{ height: `${(d.value / max) * 100}%` }}
              title={valueFormatter(d.value)}
            />
          </div>
          
          {/* Date Label */}
          <span className="text-xs font-bold text-slate-400 mt-1">{d.label}</span>
        </div>
      ))}
    </div>
  );
}