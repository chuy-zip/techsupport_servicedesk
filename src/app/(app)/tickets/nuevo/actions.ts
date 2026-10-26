"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { applyPriorityFloor } from "@/lib/tickets/priority";
import { addAttentionMinutes } from "@/lib/tickets/sla";

const levels = ["HIGH", "MEDIUM", "LOW"] as const;

const Schema = z.object({
  catalogItemId: z.string({ error: "Elige qué quieres reportar." }).min(1, "Elige qué quieres reportar."),
  title: z
    .string()
    .trim()
    .min(5, "Escribe un título de al menos 5 caracteres.")
    .max(120, "El título no puede pasar de 120 caracteres."),
  description: z
    .string()
    .trim()
    .min(10, "Describe lo que pasa con al menos 10 caracteres.")
    .max(4000, "La descripción no puede pasar de 4000 caracteres."),
  impact: z.enum(levels).optional(),
  urgency: z.enum(levels).optional(),
  approval: z.enum(["yes", "no"]).optional(),
});

type Field = keyof z.infer<typeof Schema>;
export type CreateTicketState = { errors?: Partial<Record<Field, string>> } | undefined;

export async function createTicket(_state: CreateTicketState, formData: FormData): Promise<CreateTicketState> {
  const user = await requireUser("CLIENT");
  if (!user.companyId) throw new Error("El usuario cliente no tiene empresa");

  const read = (name: string) => formData.get(name) ?? undefined;
  const parsed = Schema.safeParse({
    catalogItemId: read("catalogItemId"),
    title: read("title"),
    description: read("description"),
    impact: read("impact"),
    urgency: read("urgency"),
    approval: read("approval"),
  });

  const errors: Partial<Record<Field, string>> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as Field;
      errors[field] ??= issue.message;
    }
    return { errors };
  }
  const data = parsed.data;

  const company = await db.company.findUniqueOrThrow({
    where: { id: user.companyId },
    include: { clientType: true },
  });
  const item = await db.catalogItem.findUnique({ where: { id: data.catalogItemId } });

  // No confiar en lo que mostró el formulario: se vuelve a revisar que el elemento aplique a este cliente
  if (!item || !item.active || (item.clientTypeId && item.clientTypeId !== company.clientTypeId)) {
    return { errors: { catalogItemId: "Ese elemento no está disponible para tu cuenta." } };
  }

  // En incidentes, el usuario describe el alcance y la urgencia; en solicitudes se usan los valores del catálogo
  const impact = item.type === "INCIDENT" ? data.impact : item.defaultImpact;
  const urgency = item.type === "INCIDENT" ? data.urgency : item.defaultUrgency;
  if (!impact) errors.impact = "Indica a quiénes afecta.";
  if (!urgency) errors.urgency = "Indica qué pasa si se espera.";
  if (item.approvalQuestion && !data.approval) errors.approval = "Responde esta pregunta.";
  if (!impact || !urgency || Object.keys(errors).length > 0) return { errors };

  const rule = await db.priorityRule.findUniqueOrThrow({ where: { impact_urgency: { impact, urgency } } });
  const priority = applyPriorityFloor(rule.priority, company.clientType.minPriority);
  const level = await db.priorityLevel.findUniqueOrThrow({ where: { priority } });

  // Los vencimientos corren con el reloj del tipo de cliente
  const now = new Date();
  const due = (minutes: number | null) =>
    minutes === null ? null : addAttentionMinutes(now, minutes, company.clientType);

  const ticket = await db.ticket.create({
    data: {
      title: data.title,
      description: data.description,
      type: item.type,
      catalogItemId: item.id,
      impact,
      urgency,
      priority,
      requesterId: user.id,
      companyId: company.id,
      requiresApproval: item.approvalQuestion !== null && data.approval === "yes",
      responseDueAt: due(level.responseMinutes),
      resolutionDueAt: due(level.resolutionMinutes),
      createdAt: now,
      events: { create: { kind: "CREATED", actorId: user.id, toValue: priority } },
    },
    select: { number: true },
  });

  redirect(`/tickets/${ticket.number}`);
}
