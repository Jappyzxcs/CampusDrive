import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout';
import { ROUTES } from '../../constants/routes';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    // Stub: wire up to the real password-reset endpoint once the PHP
    // backend exposes one. Frontend flow/UI is final for Phase 1.
    setIsSubmitted(true);
  }

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Reset your password"
      subtitle="Enter your institutional email and we'll send reset instructions."
    >
      {isSubmitted ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-md bg-accent-50 px-3 py-3 text-sm text-accent-800">
            If an account exists for <strong>{email}</strong>, reset
            instructions have been sent to it.
          </p>
          <Link to={ROUTES.LOGIN} className="btn-secondary">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Institutional email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juandelacruz@lspu.edu.ph"
              className="rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900
                placeholder:text-slate-400 focus-visible:border-primary-500"
            />
          </div>

          <button type="submit" className="btn-primary">
            Send reset link
          </button>

          <Link
            to={ROUTES.LOGIN}
            className="text-center text-sm font-medium text-primary-700 hover:text-primary-800"
          >
            Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
