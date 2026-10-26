import Link from "next/link";
import type { ComponentProps } from "react";

// Enlace para volver a la pantalla anterior del flujo, sobre el título
export function BackLink({ children, className = "", ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={`inline-flex items-center gap-1.5 text-caption font-medium text-muted transition-colors duration-150 hover:text-olive ${className}`}
      {...props}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M10 3 5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </Link>
  );
}
