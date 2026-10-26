import type { ComponentProps, ReactNode } from "react";

const inputClass =
  "rounded-control border border-line bg-surface px-3.5 py-2.5 text-ink transition-colors duration-150 focus:border-olive";

function Field({ label, error, hint, children, className = "" }: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-caption font-medium text-muted">{label}</span>
      {children}
      {hint && !error && <span className="text-caption text-muted">{hint}</span>}
      {error && <span className="text-caption text-p1">{error}</span>}
    </label>
  );
}

type FieldProps = { label: string; error?: string; hint?: string };

export function TextField({ label, error, hint, className, ...props }: ComponentProps<"input"> & FieldProps) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      <input className={inputClass} aria-invalid={error ? true : undefined} {...props} />
    </Field>
  );
}

export function TextArea({ label, error, hint, className, ...props }: ComponentProps<"textarea"> & FieldProps) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      <textarea className={`${inputClass} min-h-32 resize-y`} aria-invalid={error ? true : undefined} {...props} />
    </Field>
  );
}
