import { Navigate, Route, createBrowserRouter, createRoutesFromElements } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ROUTES } from '../constants/routes';
import { ROLES } from '../constants/roles';

// --- PUBLIC AUTH ROUTES ---
import LandingPage from '../pages/auth/LandingPage';
import LoginPage from '../pages/auth/LoginPage';
import StaffAuth from '../pages/auth/StaffAuth';
import VisitorAuth from '../pages/auth/VisitorAuth';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';

// --- STUDENT / FACULTY ---
import StudentDashboard from '../pages/student/StudentDashboard';
import VehicleRegistrationPage from '../pages/student/VehicleRegistrationPage';
import DocumentUploadPage from '../pages/student/DocumentUploadPage';
import ApplicationStatusPage from '../pages/student/ApplicationStatusPage';
import VehicleDetailsPage from '../pages/student/VehicleDetailsPage';
import RenewalRequestPage from '../pages/student/RenewalRequestPage';
import NotificationsPage from '../pages/student/NotificationsPage';
import ProfilePage from '../pages/student/ProfilePage';

// --- VISITOR ---
import VisitorDashboard from '../pages/visitor/VisitorDashboard';
import RegisterVisitPage from '../pages/visitor/RegisterVisitPage';
import VisitHistoryPage from '../pages/visitor/VisitHistoryPage';

// --- ADMIN ---
import AdminDashboard from '../pages/admin/AdminDashboard';
import PendingApplicationsPage from '../pages/admin/PendingApplicationsPage';
import ApplicationReviewPage from '../pages/admin/ApplicationReviewPage';
import VehicleManagementPage from '../pages/admin/VehicleManagementPage';
import StickerManagementPage from '../pages/admin/StickerManagementPage';
import VisitorApprovalsPage from '../pages/admin/VisitorApprovalsPage';
import UserManagementPage from '../pages/admin/UserManagementPage';
import EntryLogsPage from '../pages/admin/EntryLogsPage';
import ReportsPage from '../pages/admin/ReportsPage';
import AuditLogsPage from '../pages/admin/AuditLogsPage';
import SettingsPage from '../pages/admin/SettingsPage';

// --- GUARD ---
import GuardDashboard from '../pages/guard/GuardDashboard';
import ScannerPage from '../pages/guard/ScannerPage';
import VerificationResultPage from '../pages/guard/VerificationResultPage';
import ScanHistoryPage from '../pages/guard/ScanHistoryPage';
import ManualLookupPage from '../pages/guard/ManualLookupPage';
import VisitorVerificationPage from '../pages/guard/VisitorVerificationPage';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      {/* PUBLIC ROUTES (The New Front Door) */}
      <Route path="/" element={<LandingPage />} />
      <Route path={ROUTES.LOGIN || "/login"} element={<LoginPage />} />
      <Route path={ROUTES.STAFF_LOGIN || "/staff/login"} element={<StaffAuth />} />
      <Route path={ROUTES.VISITOR_LOGIN || "/visitor/login"} element={<VisitorAuth />} />
      <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />

      {/* PROTECTED ROUTES */}

      {/* UPDATED: Allow both STUDENT and FACULTY roles */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.STUDENT, ROLES.FACULTY]} />}>
        <Route element={<DashboardLayout />}>
          <Route path={ROUTES.STUDENT_DASHBOARD} element={<StudentDashboard />} handle={{ title: 'Dashboard' }} />
          <Route path={ROUTES.STUDENT_VEHICLE_REGISTRATION} element={<VehicleRegistrationPage />} handle={{ title: 'Register a Vehicle' }} />
          <Route path={ROUTES.STUDENT_DOCUMENT_UPLOAD} element={<DocumentUploadPage />} handle={{ title: 'Upload Documents' }} />
          <Route path={ROUTES.STUDENT_APPLICATION_STATUS} element={<ApplicationStatusPage />} handle={{ title: 'Application Status' }} />
          <Route path={ROUTES.STUDENT_VEHICLE_DETAILS} element={<VehicleDetailsPage />} handle={{ title: 'Vehicle Details' }} />
          <Route path={ROUTES.STUDENT_RENEWAL} element={<RenewalRequestPage />} handle={{ title: 'Renew Registration' }} />
          <Route path={ROUTES.STUDENT_NOTIFICATIONS} element={<NotificationsPage />} handle={{ title: 'Notifications' }} />
          <Route path={ROUTES.STUDENT_PROFILE} element={<ProfilePage />} handle={{ title: 'Profile' }} />
        </Route>
      </Route>

      {/* Visitor */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.VISITOR]} />}>
        <Route element={<DashboardLayout />}>
          <Route path={ROUTES.VISITOR_DASHBOARD} element={<VisitorDashboard />} handle={{ title: 'Dashboard' }} />
          <Route path={ROUTES.VISITOR_REGISTER} element={<RegisterVisitPage />} handle={{ title: 'Register a Visit' }} />
          <Route path={ROUTES.VISITOR_HISTORY} element={<VisitHistoryPage />} handle={{ title: 'Visit History' }} />
        </Route>
      </Route>

      {/* Administrator (GSU) + BAO */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN_GSU, ROLES.BAO]} />}>
        <Route element={<DashboardLayout />}>
          <Route path={ROUTES.ADMIN_DASHBOARD} element={<AdminDashboard />} handle={{ title: 'Dashboard' }} />
          <Route path={ROUTES.ADMIN_PENDING_APPLICATIONS} element={<PendingApplicationsPage />} handle={{ title: 'Pending Applications' }} />
          <Route path={ROUTES.ADMIN_APPLICATION_REVIEW} element={<ApplicationReviewPage />} handle={{ title: 'Application Review' }} />
          <Route path={ROUTES.ADMIN_VEHICLE_MANAGEMENT} element={<VehicleManagementPage />} handle={{ title: 'Vehicle Management' }} />
          <Route path={ROUTES.ADMIN_STICKER_MANAGEMENT} element={<StickerManagementPage />} handle={{ title: 'Sticker Management' }} />
          <Route path={ROUTES.ADMIN_VISITOR_APPROVALS} element={<VisitorApprovalsPage />} handle={{ title: 'Visitor Approvals' }} />
          <Route path={ROUTES.ADMIN_USER_MANAGEMENT} element={<UserManagementPage />} handle={{ title: 'User Management' }} />
          <Route path={ROUTES.ADMIN_ENTRY_LOGS} element={<EntryLogsPage />} handle={{ title: 'Entry Logs' }} />
          <Route path={ROUTES.ADMIN_REPORTS} element={<ReportsPage />} handle={{ title: 'Reports' }} />
          <Route path={ROUTES.ADMIN_AUDIT_LOGS} element={<AuditLogsPage />} handle={{ title: 'Audit Logs' }} />
          <Route path={ROUTES.ADMIN_SETTINGS} element={<SettingsPage />} handle={{ title: 'Settings' }} />
        </Route>
      </Route>

      {/* Security Guard */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.GUARD]} />}>
        <Route element={<DashboardLayout />}>
          <Route path={ROUTES.GUARD_DASHBOARD} element={<GuardDashboard />} handle={{ title: 'Dashboard' }} />
          <Route path={ROUTES.GUARD_SCANNER} element={<ScannerPage />} handle={{ title: 'Scan Sticker' }} />
          <Route path={ROUTES.GUARD_VERIFICATION_RESULT} element={<VerificationResultPage />} handle={{ title: 'Verification Result' }} />
          <Route path={ROUTES.GUARD_SCAN_HISTORY} element={<ScanHistoryPage />} handle={{ title: 'Scan History' }} />
          <Route path={ROUTES.GUARD_MANUAL_LOOKUP} element={<ManualLookupPage />} handle={{ title: 'Manual Lookup' }} />
          <Route path={ROUTES.GUARD_VISITOR_VERIFICATION} element={<VisitorVerificationPage />} handle={{ title: 'Visitor Verification' }} />
        </Route>
      </Route>

      {/* Fallback to Landing Page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  )
);