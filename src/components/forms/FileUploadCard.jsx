import { useRef, useState } from 'react';
import { Icon } from '../common/Icon';

export function FileUploadCard({ label, hint, accept = 'image/*,.pdf', file, onFileSelect, error }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(fileList) {
    if (fileList && fileList[0]) onFileSelect(fileList[0]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors
          ${isDragging ? 'border-primary-400 bg-primary-50' : error ? 'border-danger-300' : 'border-slate-300 bg-white hover:border-primary-300'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {file ? (
          <>
            <Icon name="check" className="h-6 w-6 text-accent-600" />
            <p className="text-sm font-medium text-slate-700">{file.name}</p>
            <p className="text-xs text-slate-400">Tap to replace</p>
          </>
        ) : (
          <>
            <Icon name="upload" className="h-6 w-6 text-slate-400" />
            <p className="text-sm font-medium text-slate-600">Drag a file here, or tap to browse</p>
            {hint && <p className="text-xs text-slate-400">{hint}</p>}
          </>
        )}
      </div>
      {error && <p className="text-xs text-danger-600">{error}</p>}
    </div>
  );
}
