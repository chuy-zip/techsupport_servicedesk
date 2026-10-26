import type { ComponentProps, ReactNode } from "react";

// Opción seleccionable de un grupo de radios, con el aspecto de una tarjeta
export function Choice({
  title,
  description,
  aside,
  className = "",
  ...props
}: Omit<ComponentProps<"input">, "type" | "title"> & {
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-control border border-line bg-surface px-4 py-3 transition-colors duration-150 hover:border-olive/50 has-checked:border-olive has-checked:bg-lime/25 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-olive ${className}`}
    >
      <input type="radio" className="mt-1 accent-olive focus-visible:outline-none" {...props} />
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        {description && <span className="text-caption text-muted">{description}</span>}
      </span>
      {aside}
    </label>
  );
}

// Grupo de opciones con su pregunta
export function ChoiceGroup({ legend, error, children, className = "" }: {
  legend: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={`flex flex-col gap-2 ${className}`}>
      <legend className="mb-1 text-caption font-medium text-muted">{legend}</legend>
      {children}
      {error && <span className="text-caption text-p1">{error}</span>}
    </fieldset>
  );
}
