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
  
  // NEW ROUTES FOR DOCUMENT UPDATES
  STUDENT_UPDATE_OR: '/update-or/:vehicleId',
  STUDENT_UPDATE_LICENSE: '/update-license/:vehicleId',

  // Visitor
  VISITOR_DASHBOARD: '/visitor/dashboard',
  VISITOR_REGISTER: '/visitor/register',
  VISITOR_HISTORY: '/visitor/history',

  // Administrator (GSU) & BAO
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_PENDING_APPLICATIONS: '/admin/applications/pending',
  ADMIN_APPLICATION_REVIEW: '/admin/applications/:applicationId',
  ADMIN_VEHICLE_MANAGEMENT: '/admin/vehicles',
  ADMIN_FLAGGED_VEHICLES: '/admin/flagged-vehicles', 
  ADMIN_STICKER_MANAGEMENT: '/admin/stickers',
  ADMIN_VISITOR_APPROVALS: '/admin/visitors',
  ADMIN_USER_MANAGEMENT: '/admin/users',
  ADMIN_ENTRY_LOGS: '/admin/entry-logs',
  ADMIN_REPORTS: '/admin/reports', 
  ADMIN_SETTINGS: '/admin/settings', 

  // Security Guard
  GUARD_DASHBOARD: '/guard/dashboard',
  GUARD_SCANNER: '/guard/scanner',
  GUARD_VERIFICATION_RESULT: '/guard/scanner/result',
  GUARD_SCAN_HISTORY: '/guard/history',
  GUARD_MANUAL_LOOKUP: '/guard/lookup',
  GUARD_VISITOR_VERIFICATION: '/guard/visitors',
};