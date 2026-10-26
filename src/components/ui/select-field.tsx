import type { ComponentProps } from "react";

export function SelectField({
  label,
  className = "",
  children,
  ...props
}: ComponentProps<"select"> & { label: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-caption font-medium text-muted">{label}</span>
      <select
        className="rounded-control border border-line bg-surface px-3 py-2 text-caption text-ink transition-colors duration-150 focus:border-olive"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
