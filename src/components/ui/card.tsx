import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-card border border-line bg-surface shadow-card ${className}`} {...props} />;
}
