// User roles for CampusDrive.
//
// The thesis (Chapter III, Use Case Diagram) defines three actors:
// Student/Staff (vehicle owner), Security Personnel (Guard), and
// Administrator (GSU). Internally, "Administrator" covers more than one
// desk at GSU: the approval reviewer and the office that assigns sticker
// serials and confirms payment/pickup. Per the Sprint 3 clarification,
// those are split into two accounts so sticker issuance isn't done by
// the same role that approves applications:
//
//   ADMIN_GSU — reviews applications & documents, approves/rejects
//   BAO       — assigns sticker serials, confirms payment, marks pickup
//   GUARD     — scans stickers at checkpoints, views verification results
//   STUDENT, FACULTY — registers vehicles, uploads documents, tracks status
//
// VISITOR is not in the thesis's actor list — it's a module added after
// the initial build to cover non-affiliated guests: they register a
// planned visit (name, plate, purpose), ADMIN_GSU approves it, and GUARD
// checks them in/out at the gate against that approval. Kept as its own
// role rather than folded into STUDENT or FACULTY because a visitor has no
// vehicle accreditation, sticker, or renewal flow — just a per-visit
// approval.
//
// ADMIN_GSU and BAO are both "internal staff" accounts created by GSU,
// as opposed to STUDENT, FACULTY, and VISITOR, which self-register.

export const ROLES = Object.freeze({
  STUDENT: 'student',
  FACULTY: 'faculty',
  ADMIN_GSU: 'admin_gsu',
  BAO: 'bao',
  GUARD: 'guard',
  VISITOR: 'visitor',
});

export const INTERNAL_STAFF_ROLES = [ROLES.ADMIN_GSU, ROLES.BAO, ROLES.GUARD];

export const ROLE_LABELS = {
  [ROLES.STUDENT]: 'Student',
  [ROLES.FACULTY]: 'Faculty',
  [ROLES.ADMIN_GSU]: 'Administrator (GSU)',
  [ROLES.BAO]: 'BAO Staff',
  [ROLES.GUARD]: 'Security Guard',
  [ROLES.VISITOR]: 'Visitor',
};

// Where each role lands immediately after login.
export const ROLE_HOME_ROUTE = {
  [ROLES.STUDENT]: '/student/dashboard',
  [ROLES.FACULTY]: '/student/dashboard',
  [ROLES.ADMIN_GSU]: '/admin/dashboard',
  [ROLES.BAO]: '/admin/stickers',
  [ROLES.GUARD]: '/guard/dashboard',
  [ROLES.VISITOR]: '/visitor/dashboard',
};