import { ROLES } from '../../constants/roles';
import { ROUTES } from '../../constants/routes';

const studentFacultyLinks = [
  { label: 'Dashboard', to: ROUTES.STUDENT_DASHBOARD, icon: 'home' },
  { label: 'Register a Vehicle', to: ROUTES.STUDENT_VEHICLE_REGISTRATION, icon: 'plus' },
  { label: 'Application Status', to: ROUTES.STUDENT_APPLICATION_STATUS, icon: 'clipboard' },
  { label: 'Notifications', to: ROUTES.STUDENT_NOTIFICATIONS, icon: 'bell' },
  { label: 'Profile', to: ROUTES.STUDENT_PROFILE, icon: 'user' },
];

export const NAV_CONFIG = {
  [ROLES.STUDENT]: studentFacultyLinks,
  [ROLES.FACULTY]: studentFacultyLinks,
  
  [ROLES.VISITOR]: [
    { label: 'Dashboard', to: ROUTES.VISITOR_DASHBOARD, icon: 'home' },
    { label: 'Register a Visit', to: ROUTES.VISITOR_REGISTER, icon: 'plus' },
    { label: 'Visit History', to: ROUTES.VISITOR_HISTORY, icon: 'clipboard' },
  ],
  [ROLES.ADMIN_GSU]: [
    { label: 'Dashboard', to: ROUTES.ADMIN_DASHBOARD, icon: 'home' },
    { label: 'Pending Applications', to: ROUTES.ADMIN_PENDING_APPLICATIONS, icon: 'clipboard' },
    { label: 'Vehicle Management', to: ROUTES.ADMIN_VEHICLE_MANAGEMENT, icon: 'car' },
    { label: 'Visitor Approvals', to: ROUTES.ADMIN_VISITOR_APPROVALS, icon: 'idcard' },
    { label: 'User Management', to: ROUTES.ADMIN_USER_MANAGEMENT, icon: 'users' },
    { label: 'Entry Logs', to: ROUTES.ADMIN_ENTRY_LOGS, icon: 'log' },
    // MERGED: One link opens the 3-tab hub (Analytics, Flags, Audits)
    { label: 'Reports & Hub', to: ROUTES.ADMIN_REPORTS, icon: 'chart' }, 
    { label: 'Settings', to: ROUTES.ADMIN_SETTINGS, icon: 'settings' },
  ],
  [ROLES.BAO]: [
    { label: 'Dashboard', to: ROUTES.ADMIN_DASHBOARD, icon: 'home' },
    { label: 'Sticker Management', to: ROUTES.ADMIN_STICKER_MANAGEMENT, icon: 'sticker' },
    { label: 'Reports & Hub', to: ROUTES.ADMIN_REPORTS, icon: 'chart' },
  ],
  [ROLES.GUARD]: [
    { label: 'Dashboard', to: ROUTES.GUARD_DASHBOARD, icon: 'home' },
    { label: 'Scan Sticker', to: ROUTES.GUARD_SCANNER, icon: 'scan' },
    { label: 'Scan History', to: ROUTES.GUARD_SCAN_HISTORY, icon: 'log' },
    { label: 'Manual Lookup', to: ROUTES.GUARD_MANUAL_LOOKUP, icon: 'search' },
    { label: 'Visitor Verification', to: ROUTES.GUARD_VISITOR_VERIFICATION, icon: 'idcard' },
  ],
};