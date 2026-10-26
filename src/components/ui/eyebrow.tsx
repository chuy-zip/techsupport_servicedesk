import type { ComponentProps } from "react";

const tones = {
  olive: "text-olive",
  // Solo sobre fondo olive
  lime: "text-lime",
};

type EyebrowProps = ComponentProps<"p"> & {
  tone?: keyof typeof tones;
};

// Etiqueta pequeña en mayúsculas sobre un título. Debe nombrar algo real, como una sección o un servicio
export function Eyebrow({ tone = "olive", className = "", ...props }: EyebrowProps) {
  return (
    <p className={`text-label font-semibold tracking-[0.16em] uppercase ${tones[tone]} ${className}`} {...props} />
  );
}
