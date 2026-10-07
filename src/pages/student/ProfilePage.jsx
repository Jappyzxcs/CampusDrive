import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { ROLE_LABELS } from '../../constants/roles';
import { useToast } from '../../context/ToastContext';

export default function ProfilePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [name, setName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) return;
    
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { name: name.trim() });
      
      showToast('Profile updated successfully.', { type: 'success' });
    } catch (error) {
      console.error("Profile update error:", error);
      showToast('Failed to update profile.', { type: 'danger' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePasswordReset() {
    if (!confirm(`Send password reset email to ${user.email}?`)) return;
    try {
      await authService.sendResetEmail(user.email);
      showToast('Password reset link sent to your email.', { type: 'success' });
    } catch (error) {
      showToast('Failed to send reset email.', { type: 'danger' });
    }
  }

  const initials = (name || 'U')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    // Removed max-w-4xl. The layout will now stretch fully like the dashboard.
    <div className="flex w-full flex-col gap-6 font-sans text-slate-800 pb-10">
      
      {/* Header Section */}
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-3xl font-extrabold font-sans tracking-tight text-slate-900">
          Profile
        </h1>
        <p className="text-base text-slate-500 font-medium">
          Manage your account details.
        </p>
      </div>

      {/* Main Profile Card - Now spans the full width of the content area */}
      <div className="bg-white w-full rounded-2xl border border-slate-200 shadow-sm p-8">
        
        {/* User Info & Avatar Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-8">
          <div className="flex items-center gap-5">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 shadow-sm text-xl font-bold text-blue-600">
              {initials}
            </span>
            <div>
              <p className="text-xl font-bold text-slate-900 tracking-tight">{user?.name || 'User'}</p>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                {ROLE_LABELS[user?.role] || 'Student'}
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handlePasswordReset}
            className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-all"
          >
            Reset Password
          </button>
        </div>

        {/* Form Section - Constrained to max-w-3xl so fields aren't too stretched */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-3xl" noValidate>
          
          <div className="w-full">
            <label htmlFor="name" className="block text-sm font-bold text-slate-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSaving}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60 disabled:bg-slate-50"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            <div>
              <label htmlFor="institutionalId" className="block text-sm font-bold text-slate-700 mb-2">
                Student / Employee ID
              </label>
              <input
                type="text"
                id="institutionalId"
                value={user?.institutionalId || 'N/A'}
                disabled
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 cursor-not-allowed"
              />
            </div>
            
            <div>
              <label htmlFor="college" className="block text-sm font-bold text-slate-700 mb-2">
                College / Department
              </label>
              <input
                type="text"
                id="college"
                value={user?.college || 'N/A'}
                disabled
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="w-full">
            <label htmlFor="email" className="block text-sm font-bold text-slate-700 mb-2">
              Institutional Email
            </label>
            <input
              type="email"
              id="email"
              value={user?.email || ''}
              disabled
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 cursor-not-allowed"
            />
          </div>

          <div className="flex justify-start border-t border-slate-100 pt-6 mt-4">
            <button 
              type="submit" 
              disabled={isSaving || name === user?.name}
              className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold tracking-wide hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
            >
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}