import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME_ROUTE, ROLES } from '../../constants/roles';

export default function VisitorAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth(); // Added register
  
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '', password: '', fullName: '', phone: ''
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    try {
      if (isLogin) {
        const authenticatedUser = await login({ email: formData.email, password: formData.password });
        const redirectTo = location.state?.from?.pathname ?? ROLE_HOME_ROUTE[authenticatedUser.role] ?? '/visitor/dashboard';
        navigate(redirectTo, { replace: true });
      } else {
        // Real Registration
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
                className="rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-sm font-medium text-slate-700">Contact Number</label>
              <input
                id="phone" name="phone" type="tel" required
                value={formData.phone} onChange={handleInputChange}
                placeholder="0912 345 6789"
                className="rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
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
            className="rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
            {isLogin && (
              <a href="#" className="text-xs font-medium text-green-700 hover:text-green-800">
                Forgot password?
              </a>
            )}
          </div>
          <input
            id="password" name="password" type="password" autoComplete="current-password" required
            value={formData.password} onChange={handleInputChange}
            placeholder="••••••••"
            className="rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>

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
            onClick={() => setIsLogin(!isLogin)}
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