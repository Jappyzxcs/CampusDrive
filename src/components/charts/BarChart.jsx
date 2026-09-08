/**
 * data: [{ label, value, secondaryValue? }]
 * Renders a simple vertical bar chart with CSS heights — deliberately
 * dependency-free since these dashboards only need one or two series.
 */
export function BarChart({ data, valueFormatter = (v) => v }) {
  const max = Math.max(...data.map((d) => d.value + (d.secondaryValue || 0)), 1);

  return (
    <div className="flex items-end gap-3 pt-2" style={{ height: 160 }}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 flex-col-reverse items-stretch overflow-hidden rounded-t-md bg-slate-100">
            {d.secondaryValue ? (
              <div
                className="w-full bg-danger-400"
                style={{ height: `${(d.secondaryValue / max) * 100}%` }}
                title={`${d.secondaryValue} flagged`}
              />
            ) : null}
            <div
              className="w-full bg-primary-500"
              style={{ height: `${(d.value / max) * 100}%` }}
              title={valueFormatter(d.value)}
            />
          </div>
          <span className="text-[11px] text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
