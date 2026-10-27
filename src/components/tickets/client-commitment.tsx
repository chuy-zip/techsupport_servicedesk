import type { Priority, Ticket } from "@/generated/prisma/client";
import { formatDate } from "@/lib/tickets/labels";

type CommitmentTicket = Pick<
  Ticket,
  "firstResponseAt" | "resolvedAt" | "responseDueAt" | "resolutionDueAt" | "closedAt"
> & { priority: Priority };

// Lo que el cliente necesita saber del SLA: hasta cuándo se comprometió el equipo.
// La clasificación y el semáforo del medidor son información interna del personal
export function commitmentText(ticket: CommitmentTicket): { label: string; value: string } {
  if (ticket.closedAt) return { label: "Cerrado", value: formatDate(ticket.closedAt) };
  if (ticket.resolvedAt) return { label: "Resuelto", value: formatDate(ticket.resolvedAt) };
  if (!ticket.firstResponseAt) {
    return ticket.responseDueAt
      ? { label: "Primera respuesta antes de", value: formatDate(ticket.responseDueAt) }
      : { label: "Primera respuesta", value: "Según la planificación del equipo" };
  }
  if (ticket.resolutionDueAt) return { label: "Resolución antes de", value: formatDate(ticket.resolutionDueAt) };
  return {
    label: "Resolución",
    value: ticket.priority === "P1" ? "Atención continua hasta restaurar el servicio" : "Según la planificación del equipo",
  };
}

export function ClientCommitment({ ticket }: { ticket: CommitmentTicket }) {
  const { label, value } = commitmentText(ticket);
  return (
    <div className="flex flex-col gap-0.5 text-caption">
      <span className="text-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
