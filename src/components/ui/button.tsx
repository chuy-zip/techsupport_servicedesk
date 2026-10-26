import Link from "next/link";
import type { ComponentProps } from "react";

const variants = {
  // Uno solo por pantalla
  primary: "bg-olive px-4 py-3 font-semibold text-white hover:bg-olive-dark",
  secondary: "border border-line bg-surface px-3.5 py-2 text-caption font-medium text-ink hover:bg-canvas",
};

type Variant = keyof typeof variants;

function buttonClass(variant: Variant, className: string) {
  return `inline-flex items-center justify-center rounded-control transition-colors duration-150 disabled:opacity-60 ${variants[variant]} ${className}`;
}

// className es solo para acomodo, como márgenes o ancho
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

// Un enlace con aspecto de botón, para navegar
export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
