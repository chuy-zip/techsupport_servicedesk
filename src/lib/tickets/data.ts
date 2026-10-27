import "server-only";
import type { ClientType, Impact, Ticket, Urgency } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { classifyFrom } from "@/lib/tickets/classify";
import { attentionMinutesBetween, slaProgress, type SlaProgress } from "@/lib/tickets/sla";

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

// Prioridad con la matriz y el piso del cliente, y vencimientos contados desde `from` con su reloj.
// La usan tanto la creación como la reclasificación, para que no haya dos versiones de la regla
export async function classify(impact: Impact, urgency: Urgency, clientType: ClientType, from: Date) {
  const rule = await db.priorityRule.findUniqueOrThrow({ where: { impact_urgency: { impact, urgency } } });
  const levels = new Map((await db.priorityLevel.findMany()).map((level) => [level.priority, level]));
  return classifyFrom(rule.priority, (priority) => levels.get(priority)!, clientType, from);
}

type SlaFields = Pick<Ticket, "createdAt" | "firstResponseAt" | "resolvedAt" | "responseDueAt" | "resolutionDueAt">;

// El vencimiento que corre ahora: primero la respuesta y, ya respondido, la resolución
export function currentDue(ticket: SlaFields) {
  if (ticket.resolvedAt) return null;
  return ticket.firstResponseAt ? ticket.resolutionDueAt : ticket.responseDueAt;
}

export function currentSla(
  ticket: SlaFields,
  clientType: ClientType,
  now: Date,
): { label: string; progress: SlaProgress } | null {
  const due = currentDue(ticket);
  if (!due) return null;

  const alertRatio = clientType.responseAlertMinutes / clientType.responseCommitMinutes;
  return {
    label: ticket.firstResponseAt ? "Resolución" : "Primera respuesta",
    progress: slaProgress(ticket.createdAt, due, now, clientType, alertRatio),
  };
}

// Aviso de la matriz de escalamiento de la Fase 1. Vercel Hobby no permite tareas frecuentes,
// así que se calcula al consultar en vez de dispararse solo
export function escalationAlert(
  ticket: Pick<Ticket, "createdAt" | "resolvedAt" | "level" | "status">,
  clientType: ClientType,
  now: Date,
): string | null {
  if (ticket.resolvedAt || ticket.status === "RESOLVED" || ticket.status === "CLOSED") return null;
  if (attentionMinutesBetween(ticket.createdAt, now, clientType) < clientType.escalationMinutes) return null;

  if (clientType.escalateTo === "AGENT" && clientType.escalateToLevel && ticket.level < clientType.escalateToLevel) {
    return `Escalar a nivel ${clientType.escalateToLevel}`;
  }
  if (clientType.escalateTo === "SUPERVISOR") return "Avisar a supervisión";
  return null;
}
