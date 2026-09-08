import { useEffect, useMemo, useState } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { authService } from '../../services/authService'; // REAL DATA ONLY
import { DataTable } from '../../components/tables/DataTable';
import { SearchFilterBar } from '../../components/tables/SearchFilterBar';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { Modal } from '../../components/common/Modal';
import { TextField } from '../../components/forms/TextField';
import { SelectField } from '../../components/forms/SelectField';
import { ROLE_LABELS, ROLES, INTERNAL_STAFF_ROLES } from '../../constants/roles';
import { useToast } from '../../context/ToastContext';

// UPDATED: Separated Student and Faculty roles
const ROLE_OPTIONS = [
  { value: ROLES.STUDENT, label: ROLE_LABELS[ROLES.STUDENT] },
  { value: ROLES.FACULTY, label: ROLE_LABELS[ROLES.FACULTY] },
  { value: ROLES.VISITOR, label: ROLE_LABELS[ROLES.VISITOR] },
  { value: ROLES.ADMIN_GSU, label: ROLE_LABELS[ROLES.ADMIN_GSU] },
  { value: ROLES.BAO, label: ROLE_LABELS[ROLES.BAO] },
  { value: ROLES.GUARD, label: ROLE_LABELS[ROLES.GUARD] },
];

const STAFF_ROLE_OPTIONS = ROLE_OPTIONS.filter((r) => INTERNAL_STAFF_ROLES.includes(r.value));

export default function UserManagementPage() {
  const { showToast } = useToast();
  
  // UPDATED: Fetching real users from Firestore instead of mock data
  const { data, isLoading } = useAsyncData(() => authService.getAllUsers(), []);
  
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '' });
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: '', name: '', role: '' });

  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    if (data) setUsers(data);
  }, [data]);

  const filtered = useMemo(() => {
    return users
      .filter((u) => u.name?.toLowerCase().includes(debouncedSearch.toLowerCase()))
      .filter((u) => !role || u.role === role);
  }, [users, debouncedSearch, role]);

  function handleCreateChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleEditChange(e) {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!form.name || !form.email || !form.password || !form.role) {
      showToast('Please fill out all fields.', { type: 'danger' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const newUid = await authService.adminCreateStaffAccount(form.email, form.password, {
        name: form.name,
        email: form.email,
        role: form.role
      });
      
      const newUserForTable = {
        id: newUid,
        name: form.name,
        email: form.email,
        role: form.role,
        status: 'active',
        dateCreated: new Date().toISOString().slice(0, 10),
      };
      
      setUsers((current) => [newUserForTable, ...current]);
      setIsCreateOpen(false);
      setForm({ name: '', email: '', password: '', role: '' });
      showToast(`Staff account created for ${form.name}.`, { type: 'success' });
    } catch (error) {
      showToast(error.message || 'Failed to create account.', { type: 'danger' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditSubmit(event) {
    event.preventDefault();
    if (!editForm.name || !editForm.role) {
      showToast('Name and Role are required.', { type: 'danger' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Real database update
      await authService.updateUserProfile(editForm.id, { name: editForm.name, role: editForm.role });

      setUsers((current) => 
        current.map(u => u.id === editForm.id ? { ...u, name: editForm.name, role: editForm.role } : u)
      );
      setIsEditOpen(false);
      showToast('User profile updated successfully.', { type: 'success' });
    } catch (error) {
      showToast('Failed to update user.', { type: 'danger' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleStatus(user) {
    try {
      // Real database update
      const newStatus = await authService.toggleUserStatus(user.id, user.status);
      
      setUsers((current) => 
        current.map(u => u.id === user.id ? { ...u, status: newStatus } : u)
      );
      showToast(`User ${newStatus === 'active' ? 'reactivated' : 'suspended'}.`, { type: 'info' });
    } catch (error) {
      showToast('Failed to update status.', { type: 'danger' });
    }
  }

  async function handleResetPassword(email) {
    if (!confirm(`Send password reset email to ${email}?`)) return;
    try {
      await authService.sendResetEmail(email);
      showToast(`Password reset link sent to ${email}`, { type: 'success' });
    } catch (error) {
      showToast('Failed to send reset email.', { type: 'danger' });
    }
  }

  const columns = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (row) => ROLE_LABELS[row.role] || row.role },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status || 'active'} /> },
    { key: 'dateCreated', header: 'Created', sortable: true },
    { 
      key: 'actions', 
      header: 'Actions', 
      render: (row) => (
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setEditForm({ id: row.id, name: row.name, role: row.role });
              setIsEditOpen(true);
            }}
            title="Edit User"
            className="text-slate-400 transition-colors hover:text-primary-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          
          <button 
            onClick={() => handleToggleStatus(row)}
            title={row.status === 'active' ? 'Suspend User' : 'Reactivate User'}
            className={`transition-colors ${row.status === 'active' ? 'text-slate-400 hover:text-danger-600' : 'text-danger-500 hover:text-success-600'}`}
          >
            {row.status === 'active' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            )}
          </button>

          <button 
            onClick={() => handleResetPassword(row.email)}
            title="Reset Password"
            className="text-slate-400 transition-colors hover:text-accent-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-primary-900">User Management</h2>
          <p className="text-sm text-slate-500">
            Student, Faculty, and Visitor accounts self-register. Staff accounts are managed here.
          </p>
        </div>
        <button onClick={() => setIsCreateOpen(true)} className="btn-primary">
          Create Staff Account
        </button>
      </div>

      <DashboardCard>
        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name…"
          filters={[{ key: 'role', label: 'Role', options: ROLE_OPTIONS }]}
          activeFilters={{ role }}
          onFilterChange={(_, value) => setRole(value)}
        />
        <DataTable columns={columns} rows={filtered} isLoading={isLoading} emptyTitle="No users found" emptyDescription="There are no users registered in the database yet." />
      </DashboardCard>

      {/* CREATE USER MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => !isSubmitting && setIsCreateOpen(false)}
        title="Create Staff Account"
        footer={
          <>
            <button type="button" onClick={() => setIsCreateOpen(false)} className="btn-secondary" disabled={isSubmitting}>
              Cancel
            </button>
            <button type="button" onClick={handleCreate} className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4" noValidate>
          <TextField id="new-name" name="name" label="Full Name" required value={form.name} onChange={handleCreateChange} disabled={isSubmitting} />
          <TextField id="new-email" name="email" label="Institutional Email" type="email" required value={form.email} onChange={handleCreateChange} disabled={isSubmitting} />
          <TextField id="new-password" name="password" label="Password" type="password" required value={form.password} onChange={handleCreateChange} disabled={isSubmitting} />
          <SelectField id="new-role" name="role" label="Role" required options={STAFF_ROLE_OPTIONS} value={form.role} onChange={handleCreateChange} disabled={isSubmitting} />
        </form>
      </Modal>

      {/* EDIT USER MODAL */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => !isSubmitting && setIsEditOpen(false)}
        title="Edit Staff Account"
        footer={
          <>
            <button type="button" onClick={() => setIsEditOpen(false)} className="btn-secondary" disabled={isSubmitting}>
              Cancel
            </button>
            <button type="button" onClick={handleEditSubmit} className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4" noValidate>
          <TextField id="edit-name" name="name" label="Full Name" required value={editForm.name} onChange={handleEditChange} disabled={isSubmitting} />
          <SelectField id="edit-role" name="role" label="Role" required options={STAFF_ROLE_OPTIONS} value={editForm.role} onChange={handleEditChange} disabled={isSubmitting} />
        </form>
      </Modal>
    </div>
  );
}