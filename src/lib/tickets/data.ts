import "server-only";
import type { ClientType, Ticket } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { slaProgress, type SlaProgress } from "@/lib/tickets/sla";

// Servicios con los elementos del catálogo que puede ver un tipo de cliente.
// I-1 es solo para VIP e I-2 solo para Normal; el resto es para todos
export async function getCatalogFor(clientTypeCode: string) {
  return db.service.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        where: {
          active: true,
          OR: [{ clientTypeId: null }, { clientType: { code: clientTypeCode } }],
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export type CatalogService = Awaited<ReturnType<typeof getCatalogFor>>[number];

// El plazo que corre ahora: primero la respuesta y, ya respondido, la resolución
export function currentSla(
  ticket: Pick<Ticket, "createdAt" | "firstResponseAt" | "resolvedAt" | "responseDueAt" | "resolutionDueAt">,
  clientType: ClientType,
  now: Date,
): { label: string; progress: SlaProgress } | null {
  if (ticket.resolvedAt) return null;

  const alertRatio = clientType.responseAlertMinutes / clientType.responseCommitMinutes;
  const due = ticket.firstResponseAt ? ticket.resolutionDueAt : ticket.responseDueAt;
  if (!due) return null;

  return {
    label: ticket.firstResponseAt ? "Resolución" : "Primera respuesta",
    progress: slaProgress(ticket.createdAt, due, now, clientType, alertRatio),
  };
}
