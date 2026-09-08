import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME_ROUTE, ROLES } from '../../constants/roles';
import { ROUTES } from '../../constants/routes';

export default function LoginPage() {
  const { login, register, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLogin, setIsLogin] = useState(true);
  
  // NEW: State for the password visibility toggle
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '', 
    password: '', 
    name: '', 
    institutionalId: '', 
    college: '',
    role: '' 
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // NEW: Password validation checks for the tips
  const hasMinLength = formData.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(formData.password);
  const hasNumberOrSymbol = /[0-9!@#$%^&*]/.test(formData.password);

  const handleInputChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    
    try {
      if (isLogin) {
        const authenticatedUser = await login({ email: formData.email, password: formData.password });
        const redirectTo = location.state?.from?.pathname ?? ROLE_HOME_ROUTE[authenticatedUser.role];
        navigate(redirectTo, { replace: true });
      } else {
        if (!formData.role) {
          throw new Error("Please select a role.");
        }
        
        // Enforce strong password before registering
        if (!hasMinLength || !hasUppercase || !hasNumberOrSymbol) {
          throw new Error("Please meet all password requirements.");
        }
        
        await register(formData);
        if (logout) await logout();
        
        setSuccess('Account created successfully! Please sign in with your new credentials.');
        setIsLogin(true);
        setFormData(prev => ({ ...prev, password: '' }));
        setShowPassword(false); // Reset eye toggle
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const toggleView = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccess('');
    setShowPassword(false);
  };

  // Helper component for the password checklist icons
  const CheckIcon = ({ checked }) => (
    <svg className={`h-3.5 w-3.5 flex-none transition-colors ${checked ? 'text-emerald-500' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );

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
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="role" className="text-sm font-medium text-slate-700">Role</label>
              <select
                id="role" name="role" required
                value={formData.role} onChange={handleInputChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus-visible:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 bg-white"
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
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="college" className="text-sm font-medium text-slate-700">College / Department</label>
              <select
                id="college" name="college" required
                value={formData.college} onChange={handleInputChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus-visible:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 bg-white"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
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
          
          {/* THE FIX: Password input wrapper with the eye toggle */}
          <div className="relative">
            <input
              id="password" name="password" 
              type={showPassword ? "text" : "password"} 
              autoComplete="current-password" required
              value={formData.password} onChange={handleInputChange}
              placeholder="••••••••"
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
              tabIndex="-1"
            >
              {showPassword ? (
                // Eye Slash Icon (Hide)
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                // Eye Icon (Show)
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* THE FIX: Real-time password tips only visible during registration */}
          {!isLogin && (
            <ul className="mt-1 flex flex-col gap-1 text-[11px] text-slate-500">
              <li className={`flex items-center gap-1.5 transition-colors ${hasMinLength ? 'text-emerald-600' : ''}`}>
                <CheckIcon checked={hasMinLength} /> Minimum of 8 characters
              </li>
              <li className={`flex items-center gap-1.5 transition-colors ${hasUppercase ? 'text-emerald-600' : ''}`}>
                <CheckIcon checked={hasUppercase} /> At least one uppercase letter (A-Z)
              </li>
              <li className={`flex items-center gap-1.5 transition-colors ${hasNumberOrSymbol ? 'text-emerald-600' : ''}`}>
                <CheckIcon checked={hasNumberOrSymbol} /> At least one number or symbol
              </li>
            </ul>
          )}
        </div>

        {success && (
          <p role="alert" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 border border-green-200">
            {success}
          </p>
        )}

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