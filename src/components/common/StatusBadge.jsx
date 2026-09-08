// Every status string used anywhere in CampusDrive (applications,
// vehicles, stickers, scan results) maps to one entry here, so "approved"
// or "valid" is always the same shade of green no matter which page
// renders it. Add new statuses here, not inline in a page.
const STATUS_STYLES = {
  // generic / application / vehicle
  // THE FIX: Changed 'Approved' to 'Paid' so old records display correctly
  approved: { label: 'Paid', className: 'bg-accent-100 text-accent-800' }, 
  
  // THE NEW STATUS: Added for the BAO handoff
  for_payment: { label: 'For Payment', className: 'bg-secondary-100 text-secondary-800' }, 
  
  active: { label: 'Active', className: 'bg-accent-100 text-accent-800' },
  valid: { label: 'Valid', className: 'bg-accent-100 text-accent-800' },
  paid: { label: 'Paid', className: 'bg-accent-100 text-accent-800' },
  picked_up: { label: 'Picked Up', className: 'bg-accent-100 text-accent-800' },
  resolved: { label: 'Resolved', className: 'bg-accent-100 text-accent-800' },
  inside_campus: { label: 'Inside Campus', className: 'bg-accent-100 text-accent-800' },
  completed: { label: 'Visit Completed', className: 'bg-slate-100 text-slate-700' },

  pending: { label: 'Pending', className: 'bg-secondary-100 text-secondary-800' },
  under_review: { label: 'Under Review', className: 'bg-secondary-100 text-secondary-800' },
  unpaid: { label: 'Unpaid', className: 'bg-secondary-100 text-secondary-800' },
  unassigned: { label: 'Unassigned', className: 'bg-slate-100 text-slate-700' },
  under_investigation: { label: 'Under Investigation', className: 'bg-secondary-100 text-secondary-800' },
  inactive: { label: 'Inactive', className: 'bg-slate-100 text-slate-600' },

  rejected: { label: 'Rejected', className: 'bg-danger-100 text-danger-800' },
  expired: { label: 'Expired', className: 'bg-danger-100 text-danger-800' },
  mismatch: { label: 'Sticker Mismatch', className: 'bg-danger-100 text-danger-800' },
  unregistered: { label: 'Unregistered Vehicle', className: 'bg-danger-100 text-danger-800' },
  duplicate: { label: 'Duplicate Sticker', className: 'bg-danger-100 text-danger-800' },
  no_record: { label: 'No Record Found', className: 'bg-danger-100 text-danger-800' },
  flagged_duplicate: { label: 'Flagged — Duplicate', className: 'bg-danger-100 text-danger-800' },
};

export function StatusBadge({ status, label }) {
  const config = STATUS_STYLES[status] || { label: label || status, className: 'bg-slate-100 text-slate-700' };
  return <span className={`status-badge ${config.className}`}>{label || config.label}</span>;
}