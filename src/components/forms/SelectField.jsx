export function SelectField({ label, id, error, required, options, className = '', ...selectProps }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-danger-600">*</span>}
      </label>
      <select
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        className={`rounded-md border bg-white px-3 py-2.5 text-sm text-slate-900
          focus-visible:border-primary-500 ${error ? 'border-danger-400' : 'border-slate-300'}`}
        {...selectProps}
      >
        <option value="" disabled>
          Select…
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-danger-600">{error}</p>}
    </div>
  );
}
