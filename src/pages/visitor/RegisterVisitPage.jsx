import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { TextField } from '../../components/forms/TextField';
import { SelectField } from '../../components/forms/SelectField';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { visitorService } from '../../services/visitorService'; // REAL SERVICE
import { useToast } from '../../context/ToastContext';
import { ROUTES } from '../../constants/routes';

const VEHICLE_TYPES = [
  { value: 'Car', label: 'Car' },
  { value: 'Motorcycle', label: 'Motorcycle' },
  { value: 'None', label: 'On foot / no vehicle' },
];

export default function RegisterVisitPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    visitorName: user?.fullName || user?.name || '',
    plateNumber: '',
    vehicleType: '',
    purpose: '',
    hostName: '',
    contactNumber: '',
    visitDate: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate() {
    const next = {};
    if (!form.visitorName.trim()) next.visitorName = 'This field is required.';
    if (!form.vehicleType) next.vehicleType = 'Select an option.';
    if (form.vehicleType && form.vehicleType !== 'None' && !form.plateNumber.trim()) {
      next.plateNumber = 'Plate number is required for a vehicle visit.';
    }
    if (!form.purpose.trim()) next.purpose = 'Please describe the purpose of your visit.';
    if (!form.hostName.trim()) next.hostName = 'Who or which office are you visiting?';
    if (!form.contactNumber.trim()) next.contactNumber = 'This field is required.';
    if (!form.visitDate) next.visitDate = 'Select a visit date.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Save directly to Firebase
      await visitorService.createVisit({
        visitorId: user.id,
        visitorName: form.visitorName,
        plateNumber: form.vehicleType === 'None' ? 'N/A' : form.plateNumber.toUpperCase(),
        vehicleType: form.vehicleType,
        purpose: form.purpose,
        hostName: form.hostName,
        contactNumber: form.contactNumber,
        visitDate: form.visitDate,
      });
      showToast('Visit request submitted. Awaiting GSU approval.', { type: 'success' });
      navigate(ROUTES.VISITOR_HISTORY);
    } catch (error) {
      console.error("Submission failed:", error);
      showToast('Failed to submit request. Please try again.', { type: 'danger' });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ... (The rest of the UI rendering remains completely unchanged)
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Register a Visit</h2>
        <p className="text-sm text-slate-500">
          Submit your visit details for GSU approval. You'll be checked in at the gate once approved.
        </p>
      </div>

      <DashboardCard>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <TextField
            id="visitorName"
            label="Full Name"
            required
            value={form.visitorName}
            error={errors.visitorName}
            onChange={(e) => update('visitorName', e.target.value)}
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SelectField
              id="vehicleType"
              label="Vehicle Type"
              required
              options={VEHICLE_TYPES}
              value={form.vehicleType}
              error={errors.vehicleType}
              onChange={(e) => update('vehicleType', e.target.value)}
            />
            <TextField
              id="plateNumber"
              label="Plate Number"
              placeholder="e.g. ABC 1122"
              required={form.vehicleType !== 'None'}
              disabled={form.vehicleType === 'None'}
              value={form.plateNumber}
              error={errors.plateNumber}
              onChange={(e) => update('plateNumber', e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="purpose" className="text-sm font-medium text-slate-700">
              Purpose of Visit <span className="text-danger-600">*</span>
            </label>
            <textarea
              id="purpose"
              required
              rows={3}
              value={form.purpose}
              onChange={(e) => update('purpose', e.target.value)}
              placeholder="e.g. Meeting with faculty, document submission, vendor delivery…"
              className={`rounded-md border px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400
                focus-visible:border-primary-500 ${errors.purpose ? 'border-danger-400' : 'border-slate-300'}`}
            />
            {errors.purpose && <p className="text-xs text-danger-600">{errors.purpose}</p>}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              id="hostName"
              label="Person / Office to Visit"
              placeholder="e.g. Prof. Dela Cruz, Registrar's Office"
              required
              value={form.hostName}
              error={errors.hostName}
              onChange={(e) => update('hostName', e.target.value)}
            />
            <TextField
              id="contactNumber"
              label="Contact Number"
              placeholder="09xx-xxx-xxxx"
              required
              value={form.contactNumber}
              error={errors.contactNumber}
              onChange={(e) => update('contactNumber', e.target.value)}
            />
          </div>

          <TextField
            id="visitDate"
            label="Visit Date"
            type="date"
            required
            value={form.visitDate}
            error={errors.visitDate}
            onChange={(e) => update('visitDate', e.target.value)}
            className="sm:w-1/2"
          />

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting…' : 'Submit Visit Request'}
            </button>
          </div>
        </form>
      </DashboardCard>
    </div>
  );
}