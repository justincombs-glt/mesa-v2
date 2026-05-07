import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function FormField({ label, help, error, required, children }: FormFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="kicker">
        {label}
        {required && <span className="text-crimson ml-1">*</span>}
      </span>
      {children}
      {error && <span className="text-xs text-crimson mt-0.5">{error}</span>}
      {help && !error && <span className="text-xs text-ink-faint mt-0.5">{help}</span>}
    </label>
  );
}
