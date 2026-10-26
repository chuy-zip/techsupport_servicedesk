import type {
  Impact,
  Priority,
  ServiceKind,
  TicketStatus,
  TicketType,
  Urgency,
} from "@/generated/prisma/client";

// Textos en pantalla para los valores del modelo. Solo tipos: se puede usar desde el navegador

export const priorityNames: Record<Priority, string> = {
  P1: "Crítica",
  P2: "Alta",
  P3: "Media",
  P4: "Baja",
  P5: "Planificada",
};

export const statusNames: Record<TicketStatus, string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En progreso",
  ESCALATED: "Escalado",
  RESOLVED: "Resuelto",
  CLOSED: "Cerrado",
};

export const typeNames: Record<TicketType, string> = {
  INCIDENT: "Incidente",
  SERVICE_REQUEST: "Solicitud",
};

export const serviceKindNames: Record<ServiceKind, string> = {
  CORE: "Servicio núcleo",
  SUPPORT: "Servicio de soporte",
  ATTENTION: "Atención de la mesa",
};

// Las preguntas traducen los criterios de impacto y urgencia de la Fase 1 a lenguaje del usuario
export const impactOptions: { value: Impact; label: string }[] = [
  { value: "LOW", label: "Solo a mí o a una función puntual" },
  { value: "MEDIUM", label: "A una parte de los usuarios, o el servicio funciona con fallas" },
  { value: "HIGH", label: "A la mayoría de los usuarios, o nadie puede trabajar" },
];

export const urgencyOptions: { value: Urgency; label: string }[] = [
  { value: "LOW", label: "No empeora, o hay otra forma de seguir trabajando" },
  { value: "MEDIUM", label: "Empeora poco a poco, o hay una alternativa a medias" },
  { value: "HIGH", label: "Empeora rápido y no hay forma de seguir trabajando" },
];

export const impactNames: Record<Impact, string> = { HIGH: "Alto", MEDIUM: "Medio", LOW: "Bajo" };
export const urgencyNames: Record<Urgency, string> = { HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" };

export function formatDuration(minutes: number) {
  const total = Math.round(Math.abs(minutes));
  const days = Math.floor(total / (24 * 60));
  const hours = Math.floor((total % (24 * 60)) / 60);
  const mins = total % 60;
  const parts = [days && `${days} d`, hours && `${hours} h`, (mins || total === 0) && `${mins} min`];
  return parts.filter(Boolean).join(" ");
}

const dateFormat = new Intl.DateTimeFormat("es-GT", {
  timeZone: "America/Guatemala",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDate(date: Date) {
  return dateFormat.format(date);
}
