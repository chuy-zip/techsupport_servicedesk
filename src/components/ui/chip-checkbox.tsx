import type { ComponentProps } from "react";

// Ficha redonda que se marca y desmarca, para elegir varias opciones de una lista corta
export function ChipCheckbox({ label, className = "", ...props }: Omit<ComponentProps<"input">, "type"> & { label: string }) {
  return (
    <label
      className={`cursor-pointer rounded-full border border-line bg-surface px-3 py-1 text-caption font-medium text-muted transition-colors duration-150 hover:border-olive/50 has-checked:border-olive has-checked:bg-lime/40 has-checked:text-ink has-disabled:cursor-not-allowed has-disabled:opacity-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-olive ${className}`}
    >
      <input type="checkbox" className="sr-only" {...props} />
      {label}
    </label>
  );
}
