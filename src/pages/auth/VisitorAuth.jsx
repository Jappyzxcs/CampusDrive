import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME_ROUTE, ROLES } from '../../constants/roles';

export default function VisitorAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  // THE FIX: Brought in resetPassword
  const { login, register, resetPassword } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '', password: '', fullName: '', phone: ''
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(''); // NEW: Added success state
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasMinLength = formData.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(formData.password);
  const hasNumberOrSymbol = /[0-9!@#$%^&*]/.test(formData.password);

  const handleInputChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // THE FIX: Added handleForgotPassword for visitors
  const handleForgotPassword = async () => {
    if (!formData.email) {
      setError('Please type your email address first to reset your password.');
      setSuccess('');
      return;
    }
    try {
      setError('');
      setSuccess('');
      await resetPassword(formData.email);
      setSuccess('Password reset link sent! Please check your email inbox.');
    } catch (err) {
      setError('Failed to send reset email. Make sure your email is registered.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    
    try {
      if (isLogin) {
        const authenticatedUser = await login({ email: formData.email, password: formData.password });
        const redirectTo = location.state?.from?.pathname ?? ROLE_HOME_ROUTE[authenticatedUser.role] ?? '/visitor/dashboard';
        navigate(redirectTo, { replace: true });
      } else {
        if (!hasMinLength || !hasUppercase || !hasNumberOrSymbol) {
          throw new Error("Please meet all password requirements.");
        }

        const newUser = await register({
          ...formData,
          role: ROLES.VISITOR 
        });
        navigate('/visitor/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleView = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccess('');
    setShowPassword(false);
  };

  const CheckIcon = ({ checked }) => (
    <svg className={`h-3.5 w-3.5 flex-none transition-colors ${checked ? 'text-emerald-500' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );

  return (
    <AuthLayout
      eyebrow="Campus Access"
      title={isLogin ? 'Visitor Sign In' : 'Register as Visitor'}
      subtitle="Request and manage your campus visits."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        
        {!isLogin && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fullName" className="text-sm font-medium text-slate-700">Full Name</label>
              <input
                id="fullName" name="fullName" type="text" required
                value={formData.fullName} onChange={handleInputChange}
                placeholder="Juan Dela Cruz"
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-sm font-medium text-slate-700">Contact Number</label>
              <input
                id="phone" name="phone" type="tel" required
                value={formData.phone} onChange={handleInputChange}
                placeholder="0912 345 6789"
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">Email address</label>
          <input
            id="email" name="email" type="email" autoComplete="email" required
            value={formData.email} onChange={handleInputChange}
            placeholder="visitor@example.com"
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
            {/* THE FIX: Replaced empty link with active button */}
            {isLogin && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs font-medium text-green-700 hover:text-green-800"
              >
                Forgot password?
              </button>
            )}
          </div>
          
          <div className="relative">
            <input
              id="password" name="password" 
              type={showPassword ? "text" : "password"} 
              autoComplete="current-password" required
              value={formData.password} onChange={handleInputChange}
              placeholder="••••••••"
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
              tabIndex="-1"
            >
              {showPassword ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

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

        <button type="submit" className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 transition-colors mt-1" disabled={isSubmitting}>
          {isSubmitting ? 'Processing…' : (isLogin ? 'Sign in' : 'Create visitor account')}
        </button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">
              {isLogin ? 'First time visiting?' : 'Already registered?'}
            </span>
          </div>
        </div>
        <div className="mt-6 text-center">
          <button
            onClick={toggleView}
            type="button"
            className="text-green-700 font-semibold hover:text-green-800 transition-colors"
          >
            {isLogin ? 'Register a new account' : 'Sign in to existing account'}
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}