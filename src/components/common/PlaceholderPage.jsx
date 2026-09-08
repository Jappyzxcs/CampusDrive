/**
 * Temporary stand-in for routes that belong to a later phase (student,
 * admin, and guard modules land in Phases 3–5). Keeps the routing tree
 * navigable end-to-end from Phase 1 onward without faking finished UI.
 */
export function PlaceholderPage({ title, phase }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-8 text-center">
      <span className="status-badge bg-secondary-100 text-secondary-800">
        Coming in {phase}
      </span>
      <h1 className="text-2xl">{title}</h1>
      <p className="max-w-md text-sm text-slate-500">
        This screen is scaffolded in the route map but not yet built. It
        will be delivered as new files in a later sprint.
      </p>
    </div>
  );
}
