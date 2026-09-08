import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME_ROUTE, ROLES } from '../../constants/roles';
import { ROUTES } from '../../constants/routes';

export default function LoginPage() {
  // NEW: Extracted logout from useAuth
  const { login, register, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLogin, setIsLogin] = useState(true);
  
  const [formData, setFormData] = useState({
    email: '', 
    password: '', 
    name: '', 
    institutionalId: '', 
    college: '',
    role: '' 
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(''); // NEW: Success notification state
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess(''); // Clear previous success messages
    setIsSubmitting(true);
    
    try {
      if (isLogin) {
        const authenticatedUser = await login({ email: formData.email, password: formData.password });
        const redirectTo = location.state?.from?.pathname ?? ROLE_HOME_ROUTE[authenticatedUser.role];
        navigate(redirectTo, { replace: true });
      } else {
        // Real Registration
        if (!formData.role) {
          throw new Error("Please select a role.");
        }
        
        // 1. Create the account (system automatically logs them in here)
        await register(formData);
        
        // 2. Immediately log them out so they have to manually sign in
        if (logout) await logout();
        
        // 3. Set success message, switch to login view, and clear password
        setSuccess('Account created successfully! Please sign in with your new credentials.');
        setIsLogin(true);
        setFormData(prev => ({ ...prev, password: '' }));
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Helper to toggle views and clear messages
  const toggleView = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccess('');
  };

  return (
    <AuthLayout
      eyebrow="Official LSPU-LB System"
      title={isLogin ? 'Sign in to CampusDrive' : 'Create an account'}
      subtitle={isLogin ? 'Use your LSPU-LB institutional account.' : 'Register as a Student or Faculty member.'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        
        {!isLogin && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-medium text-slate-700">Full Name</label>
              <input
                id="name" name="name" type="text" required
                value={formData.name} onChange={handleInputChange}
                placeholder="Juan Dela Cruz"
                className="rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="role" className="text-sm font-medium text-slate-700">Role</label>
              <select
                id="role" name="role" required
                value={formData.role} onChange={handleInputChange}
                className="rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus-visible:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 bg-white"
              >
                <option value="" disabled>Select your role</option>
                <option value={ROLES.STUDENT}>Student</option>
                <option value={ROLES.FACULTY}>Faculty</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="institutionalId" className="text-sm font-medium text-slate-700">Student / Employee ID</label>
              <input
                id="institutionalId" name="institutionalId" type="text" required
                value={formData.institutionalId} onChange={handleInputChange}
                placeholder="e.g. 0321-2345"
                className="rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="college" className="text-sm font-medium text-slate-700">College / Department</label>
              <select
                id="college" name="college" required
                value={formData.college} onChange={handleInputChange}
                className="rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus-visible:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 bg-white"
              >
                <option value="" disabled>Select your college</option>
                <option value="CCS">College of Computer Studies (CCS)</option>
                <option value="CTE">College of Teacher Education (CTE)</option>
                <option value="CBAA">College of Business Administration & Accountancy (CBAA)</option>
                <option value="CIHMT">College of International Hospitality Management & Tourism (CHMT)</option>
                <option value="COF">College of Fisheries (COF)</option>
                <option value="CAS">College of Arts and Sciences (CAS)</option>
                <option value="CCJE">College of Criminal Justice Education (CCJE)</option>
                <option value="CFND">College of Food Nutrition and Dietetics (CFND)</option>
                <option value="FACULTY">Faculty / Administration</option>
              </select>
            </div>
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="email" name="email" type="email" autoComplete="email" required
            value={formData.email} onChange={handleInputChange}
            placeholder={isLogin ? "juandelacruz@lspu.edu.ph" : "student@lspu.edu.ph"}
            className="rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            {isLogin && (
              <Link
                to={ROUTES.FORGOT_PASSWORD || '#'}
                className="text-xs font-medium text-primary-700 hover:text-primary-800"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <input
            id="password" name="password" type="password" autoComplete="current-password" required
            value={formData.password} onChange={handleInputChange}
            placeholder="••••••••"
            className="rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
          />
        </div>

        {/* NEW: Success Notification */}
        {success && (
          <p role="alert" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 border border-green-200">
            {success}
          </p>
        )}

        {/* Error Notification */}
        {error && (
          <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {error}
          </p>
        )}

        <button type="submit" className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-900 hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-900 transition-colors mt-1" disabled={isSubmitting}>
          {isSubmitting ? 'Processing…' : (isLogin ? 'Sign in' : 'Create account')}
        </button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">
              {isLogin ? 'New to CampusDrive?' : 'Already have an account?'}
            </span>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={toggleView}
            className="text-primary-700 font-semibold hover:text-primary-900 transition-colors"
          >
            {isLogin ? 'Create a Student/Faculty Account' : 'Sign in to existing account'}
          </button>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        Student, faculty, and visitor accounts self-register from the campus portal.
        Staff accounts (Admin/GSU, BAO, Guard) are created by GSU.
      </p>
    </AuthLayout>
  );
}