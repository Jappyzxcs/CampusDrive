import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { TextField } from '../../components/forms/TextField';
import { ROLE_LABELS } from '../../constants/roles';
import { useToast } from '../../context/ToastContext';

export default function ProfilePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // FIXED: Changed user.fullName to user.name to match the database
  const [name, setName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) return;
    
    setIsSaving(true);
    try {
      // FIXED: Actually save the updated name to Firestore
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

  // NEW: Allow users to trigger their own password reset emails
  async function handlePasswordReset() {
    if (!confirm(`Send password reset email to ${user.email}?`)) return;
    try {
      await authService.sendResetEmail(user.email);
      showToast('Password reset link sent to your email.', { type: 'success' });
    } catch (error) {
      showToast('Failed to send reset email.', { type: 'danger' });
    }
  }

  // FIXED: Ensure initials don't crash if the name is temporarily undefined
  const initials = (name || 'U')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Profile</h2>
        <p className="text-sm text-slate-500">Manage your account details.</p>
      </div>

      <DashboardCard>
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-lg font-semibold text-primary-800">
              {initials}
            </span>
            <div>
              <p className="font-semibold text-slate-800">{user?.name || 'User'}</p>
              <p className="text-sm text-slate-500">{ROLE_LABELS[user?.role] || 'Student'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePasswordReset}
            className="text-sm font-medium text-primary-700 hover:text-primary-800 transition-colors"
          >
            Reset Password
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <TextField 
            id="name" 
            label="Full Name" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            required 
            disabled={isSaving}
          />
          
          {/* NEW: Displaying the data collected during registration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <TextField 
              id="institutionalId" 
              label="Student / Employee ID" 
              value={user?.institutionalId || 'N/A'} 
              disabled 
            />
            <TextField 
              id="college" 
              label="College / Department" 
              value={user?.college || 'N/A'} 
              disabled 
            />
          </div>

          <TextField 
            id="email" 
            label="Institutional Email" 
            value={user?.email || ''} 
            disabled 
          />

          <div className="flex justify-end border-t border-slate-100 pt-5 mt-2">
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={isSaving || name === user?.name}
            >
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </DashboardCard>
    </div>
  );
}