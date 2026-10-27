import type { ComponentProps } from "react";

// Caja de los controles desplegables. La comparten el select y los desplegables hechos a mano,
// como el de clientes con checkboxes, para que se vean iguales
export const dropdownClass =
  "relative w-full appearance-none rounded-control border border-line bg-surface py-2 pr-9 pl-3 text-left text-caption text-ink transition-colors duration-150 focus:border-olive";

// Flecha propia en vez de la del navegador, que cambia entre sistemas
export function DropdownChevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SelectField({
  label,
  className = "",
  children,
  ...props
}: ComponentProps<"select"> & { label: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-caption font-medium text-muted">{label}</span>
      <span className="relative">
        <select className={dropdownClass} {...props}>
          {children}
        </select>
        <DropdownChevron />
      </span>
    </label>
  );
}
