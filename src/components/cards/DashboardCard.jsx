export function DashboardCard({ title, action, children, className = '' }) {
  return (
    <div className={`card-surface p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-sm font-semibold text-primary-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
