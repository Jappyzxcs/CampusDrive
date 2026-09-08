// Centralized route paths so no page hardcodes a URL string. Phase 2+
// modules import from here; the paths themselves follow the folder
// structure defined for src/pages.

export const ROUTES = {
  // Auth
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',

  // Student / Faculty
  STUDENT_DASHBOARD: '/student/dashboard',
  STUDENT_VEHICLE_REGISTRATION: '/student/vehicles/register',
  STUDENT_DOCUMENT_UPLOAD: '/student/documents/upload',
  STUDENT_APPLICATION_STATUS: '/student/applications/status',
  STUDENT_VEHICLE_DETAILS: '/student/vehicles/:vehicleId',
  STUDENT_RENEWAL: '/student/vehicles/:vehicleId/renew',
  STUDENT_NOTIFICATIONS: '/student/notifications',
  STUDENT_PROFILE: '/student/profile',

  // Visitor — self-registers a planned visit, tracks its approval,
  // views past visits.
  VISITOR_DASHBOARD: '/visitor/dashboard',
  VISITOR_REGISTER: '/visitor/register',
  VISITOR_HISTORY: '/visitor/history',

  // Administrator (GSU) — includes BAO-scoped screens (sticker
  // assignment, payment/pickup) which render under the same /admin
  // prefix but are only reachable by ADMIN_GSU or BAO depending on
  // the screen; enforced in ProtectedRoute, not by the path itself.
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_PENDING_APPLICATIONS: '/admin/applications/pending',
  ADMIN_APPLICATION_REVIEW: '/admin/applications/:applicationId',
  ADMIN_VEHICLE_MANAGEMENT: '/admin/vehicles',
  ADMIN_STICKER_MANAGEMENT: '/admin/stickers',
  ADMIN_VISITOR_APPROVALS: '/admin/visitors',
  ADMIN_USER_MANAGEMENT: '/admin/users',
  ADMIN_ENTRY_LOGS: '/admin/entry-logs',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_AUDIT_LOGS: '/admin/audit-logs',
  ADMIN_SETTINGS: '/admin/settings',

  // Security Guard
  GUARD_DASHBOARD: '/guard/dashboard',
  GUARD_SCANNER: '/guard/scanner',
  GUARD_VERIFICATION_RESULT: '/guard/scanner/result',
  GUARD_SCAN_HISTORY: '/guard/history',
  GUARD_MANUAL_LOOKUP: '/guard/lookup',
  GUARD_VISITOR_VERIFICATION: '/guard/visitors',
};
