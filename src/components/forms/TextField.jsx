export function TextField({ label, id, error, hint, required, className = '', ...inputProps }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-danger-600">*</span>}
      </label>
      <input
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`rounded-md border px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400
          focus-visible:border-primary-500 ${error ? 'border-danger-400' : 'border-slate-300'}`}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
