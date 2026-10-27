"use server";

import { refresh } from "next/cache";
import * as z from "zod";
import type { CommentKind, Prisma, TicketStatus } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { classify } from "@/lib/tickets/data";
import { statusNames } from "@/lib/tickets/labels";
import {
  APPROVAL_NOTE,
  APPROVER_ROLES,
  ESCALATION_NOTE,
  STAFF_ROLES,
  canEscalate,
  canHandle,
  canTransition,
  canWork,
  statusNote,
} from "@/lib/tickets/workflow";

export type ActionState = { error?: string } | undefined;

const STALE = "Alguien más modificó el ticket. Recarga la página para ver su estado actual.";
const LEVEL = "Este ticket está escalado a un nivel superior al tuyo.";
const levels = ["HIGH", "MEDIUM", "LOW"] as const;

function loadTicket(id: string) {
  return db.ticket.findUnique({
    where: { id },
    include: { company: { include: { clientType: true } }, assignee: true },
  });
}

type Note = { authorId: string; body: string; internal: boolean; kind: CommentKind };

// Aplica el cambio solo si el ticket sigue como se leyó, y registra eventos y nota en la misma transacción:
// o se guarda todo o nada. Si otra persona lo cambió entre medio, no se pisa su cambio
async function update(
  ticket: { id: string; updatedAt: Date },
  data: Prisma.TicketUncheckedUpdateManyInput,
  events: Omit<Prisma.TicketEventCreateManyInput, "ticketId">[],
  note?: Note,
) {
  const applied = await db.$transaction(async (tx) => {
    const { count } = await tx.ticket.updateMany({ where: { id: ticket.id, updatedAt: ticket.updatedAt }, data });
    if (count === 0) return false;
    await tx.ticketEvent.createMany({ data: events.map((event) => ({ ...event, ticketId: ticket.id })) });
    if (note) await tx.comment.create({ data: { ...note, ticketId: ticket.id } });
    return true;
  });
  if (applied) refresh();
  return applied;
}

const NOTE_MAX = 2000;
const noteField = z.string().trim().max(NOTE_MAX, `La nota no puede pasar de ${NOTE_MAX} caracteres.`).optional();

const StatusSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(["OPEN", "IN_PROGRESS", "ESCALATED", "RESOLVED", "CLOSED"]),
  note: noteField,
});

export async function changeStatus(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(...STAFF_ROLES);
  const input = StatusSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Datos inválidos." };

  const ticket = await loadTicket(input.data.ticketId);
  if (!ticket) return { error: "El ticket ya no existe." };
  const to: TicketStatus = input.data.status;
  if (!canWork(user, ticket.level)) return { error: LEVEL };

  if (!canTransition(ticket.status, to)) {
    return { error: `No se puede pasar de ${statusNames[ticket.status]} a ${statusNames[to]}.` };
  }
  if (to === "IN_PROGRESS" && !ticket.assigneeId) {
    return { error: "Asigna un agente antes de ponerlo en progreso." };
  }
  // Mientras espera autorización no se atiende ni se resuelve
  if ((to === "IN_PROGRESS" || to === "RESOLVED") && ticket.requiresApproval && !ticket.approvedAt) {
    return { error: "Este ticket necesita la aprobación de supervisión antes de atenderse o resolverse." };
  }
  // Se valida aquí aunque el botón esté deshabilitado: el formulario se puede alterar
  const rule = statusNote(ticket.status, to);
  if (rule && !input.data.note) return { error: `Falta la nota: ${rule.prompt}` };

  const now = new Date();
  const data: Prisma.TicketUncheckedUpdateManyInput = { status: to };
  // La primera vez que un agente asignado la toma es la primera respuesta que mide el SLO 2
  if (to === "IN_PROGRESS" && !ticket.firstResponseAt) data.firstResponseAt = now;
  if (to === "RESOLVED") data.resolvedAt = now;
  if (to === "CLOSED") data.closedAt = now;
  if (ticket.status === "RESOLVED" && to === "IN_PROGRESS") data.resolvedAt = null;

  const applied = await update(
    ticket,
    data,
    [{ kind: "STATUS_CHANGED", actorId: user.id, fromValue: ticket.status, toValue: to }],
    rule && input.data.note
      ? { authorId: user.id, body: input.data.note, internal: rule.internal, kind: rule.kind }
      : undefined,
  );
  return applied ? undefined : { error: STALE };
}

const EscalateSchema = z.object({
  ticketId: z.string().min(1),
  level: z.coerce.number().int().min(2).max(3),
  note: noteField,
});

export async function escalate(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(...STAFF_ROLES);
  const input = EscalateSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Elige el nivel al que se escala." };
  if (!input.data.note) return { error: `Falta la nota: ${ESCALATION_NOTE.prompt}` };

  const ticket = await loadTicket(input.data.ticketId);
  if (!ticket) return { error: "El ticket ya no existe." };
  const level = input.data.level;
  if (!canWork(user, ticket.level)) return { error: LEVEL };

  if (!canEscalate(ticket.status, ticket.level) || level <= ticket.level) {
    return { error: "Este ticket no se puede escalar a ese nivel." };
  }

  const data: Prisma.TicketUncheckedUpdateManyInput = { status: "ESCALATED", level };
  const events: Omit<Prisma.TicketEventCreateManyInput, "ticketId">[] = [
    { kind: "LEVEL_CHANGED", actorId: user.id, fromValue: String(ticket.level), toValue: String(level) },
  ];
  if (ticket.status !== "ESCALATED") {
    events.push({ kind: "STATUS_CHANGED", actorId: user.id, fromValue: ticket.status, toValue: "ESCALATED" });
  }
  // Un escalado solo lo atiende un agente del nivel nuevo o superior
  if (ticket.assignee && !canHandle(ticket.assignee.supportLevel, level)) {
    data.assigneeId = null;
    events.push({ kind: "ASSIGNED", actorId: user.id, fromValue: ticket.assignee.name, toValue: null });
  }

  const applied = await update(ticket, data, events, {
    authorId: user.id,
    body: input.data.note,
    internal: ESCALATION_NOTE.internal,
    kind: ESCALATION_NOTE.kind,
  });
  return applied ? undefined : { error: STALE };
}

const AssignSchema = z.object({
  ticketId: z.string().min(1),
  agentId: z.string(),
});

export async function assign(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(...STAFF_ROLES);
  const input = AssignSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: "Datos inválidos." };

  const ticket = await loadTicket(input.data.ticketId);
  if (!ticket) return { error: "El ticket ya no existe." };
  if (ticket.status === "CLOSED") return { error: "Un ticket cerrado no se reasigna." };

  const agentId = input.data.agentId || null;
  if (agentId === ticket.assigneeId) return undefined;

  // Un agente puede tomar un ticket o soltarlo; asignar a otra persona es de supervisión
  if (user.role === "AGENT" && agentId !== user.id && !(agentId === null && ticket.assigneeId === user.id)) {
    return { error: "Solo supervisión puede asignar el ticket a otra persona." };
  }

  let agentName: string | null = null;
  if (agentId) {
    const agent = await db.user.findUnique({ where: { id: agentId } });
    if (!agent || agent.role !== "AGENT" || !agent.active) return { error: "Ese agente no está disponible." };
    if (!canHandle(agent.supportLevel, ticket.level)) {
      return { error: `Este ticket es de nivel ${ticket.level}; ${agent.name} es de nivel ${agent.supportLevel}.` };
    }
    agentName = agent.name;
  }

  const applied = await update(ticket, { assigneeId: agentId }, [
    { kind: "ASSIGNED", actorId: user.id, fromValue: ticket.assignee?.name ?? null, toValue: agentName },
  ]);
  return applied ? undefined : { error: STALE };
}

const ReclassifySchema = z.object({
  ticketId: z.string().min(1),
  impact: z.enum(levels),
  urgency: z.enum(levels),
});

export async function reclassify(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(...STAFF_ROLES);
  const input = ReclassifySchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: "Elige el impacto y la urgencia." };

  const ticket = await loadTicket(input.data.ticketId);
  if (!ticket) return { error: "El ticket ya no existe." };
  if (ticket.status === "CLOSED") return { error: "Un ticket cerrado no se reclasifica." };
  if (!canWork(user, ticket.level)) return { error: LEVEL };

  const { impact, urgency } = input.data;
  if (impact === ticket.impact && urgency === ticket.urgency) return undefined;

  // Mismo cálculo que al crear: la matriz, el piso del cliente y los plazos desde la creación
  const result = await classify(impact, urgency, ticket.company.clientType, ticket.createdAt);

  const applied = await update(ticket, { impact, urgency, ...result }, [
    { kind: "PRIORITY_CHANGED", actorId: user.id, fromValue: ticket.priority, toValue: result.priority },
  ]);
  return applied ? undefined : { error: STALE };
}

export async function approve(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(...APPROVER_ROLES);
  const ticketId = String(formData.get("ticketId") ?? "");

  const ticket = await loadTicket(ticketId);
  if (!ticket) return { error: "El ticket ya no existe." };
  if (!ticket.requiresApproval || ticket.approvedAt) return { error: "Esta solicitud no está pendiente de aprobación." };

  const applied = await update(ticket, { approvedById: user.id, approvedAt: new Date() }, [
    { kind: "APPROVED", actorId: user.id },
  ]);
  return applied ? undefined : { error: STALE };
}

export type CommentState = { error?: string; sent?: number } | undefined;

const CommentSchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().trim().min(1, "Escribe el comentario.").max(2000, "El comentario no puede pasar de 2000 caracteres."),
  internal: z.literal("on").optional(),
});

// Clientes y personal comentan; solo el personal puede dejar notas internas
export async function addComment(_state: CommentState, formData: FormData): Promise<CommentState> {
  const user = await requireUser();
  const input = CommentSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: input.error.issues[0].message };

  const ticket = await db.ticket.findUnique({ where: { id: input.data.ticketId } });
  const isStaff = user.role !== "CLIENT";
  // Un cliente solo comenta en los tickets de su empresa; se responde igual que si no existiera
  if (!ticket || (!isStaff && ticket.companyId !== user.companyId)) return { error: "El ticket ya no existe." };
  if (ticket.status === "CLOSED") return { error: "El ticket está cerrado; ya no recibe comentarios." };

  await db.comment.create({
    data: {
      ticketId: ticket.id,
      authorId: user.id,
      body: input.data.body,
      // Aunque un cliente mande la casilla, nunca crea notas internas
      internal: isStaff && input.data.internal === "on",
    },
  });
  refresh();
  return { sent: Date.now() };
}

const CategorySchema = z.object({
  ticketId: z.string().min(1),
  catalogItemId: z.string().min(1, "Elige el elemento del catálogo."),
});

// El nivel 1 clasifica lo que llegó como "Otro" o con el elemento equivocado. La prioridad no cambia:
// se ajusta aparte con Reclasificar, porque depende del alcance y la urgencia, no del elemento
export async function changeCategory(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(...STAFF_ROLES);
  const input = CategorySchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Datos inválidos." };

  const ticket = await db.ticket.findUnique({
    where: { id: input.data.ticketId },
    include: { catalogItem: true, company: true },
  });
  if (!ticket) return { error: "El ticket ya no existe." };
  if (ticket.status === "CLOSED") return { error: "Un ticket cerrado no se reclasifica." };
  if (!canWork(user, ticket.level)) return { error: LEVEL };
  if (input.data.catalogItemId === ticket.catalogItemId) return undefined;

  const item = await db.catalogItem.findUnique({ where: { id: input.data.catalogItemId } });
  // Solo elementos activos y visibles para el tipo de cliente de la empresa, como al crear
  if (!item || !item.active || (item.clientTypeId && item.clientTypeId !== ticket.company.clientTypeId)) {
    return { error: "Ese elemento no está disponible para este cliente." };
  }

  const data: Prisma.TicketUncheckedUpdateManyInput = { catalogItemId: item.id, type: item.type };
  // Si el elemento nuevo pide autorización y no se puede saber la respuesta, se exige por precaución
  if (item.approvalQuestion && !ticket.approvedAt) data.requiresApproval = true;

  const applied = await update(ticket, data, [
    { kind: "CATEGORY_CHANGED", actorId: user.id, fromValue: ticket.catalogItem.code, toValue: item.code },
  ]);
  return applied ? undefined : { error: STALE };
}

const RequestApprovalSchema = z.object({
  ticketId: z.string().min(1),
  note: noteField,
});

// Aprobación pedida por el agente que atiende, para casos delicados que el catálogo no previó.
// Supervisión y administración no la piden: son quienes aprueban
export async function requestApproval(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("AGENT");
  const input = RequestApprovalSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Datos inválidos." };
  if (!input.data.note) return { error: `Falta la nota: ${APPROVAL_NOTE.prompt}` };

  const ticket = await loadTicket(input.data.ticketId);
  if (!ticket) return { error: "El ticket ya no existe." };
  if (!canWork(user, ticket.level)) return { error: LEVEL };
  if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
    return { error: "Un ticket resuelto o cerrado no pide aprobación." };
  }
  if (ticket.requiresApproval && !ticket.approvedAt) return { error: "Este ticket ya espera aprobación." };

  // Si ya se había aprobado algo antes, esta es una autorización nueva y la anterior no vale para ella
  const applied = await update(
    ticket,
    { requiresApproval: true, approvedAt: null, approvedById: null },
    [{ kind: "APPROVAL_REQUESTED", actorId: user.id }],
    { authorId: user.id, body: input.data.note, internal: APPROVAL_NOTE.internal, kind: APPROVAL_NOTE.kind },
  );
  return applied ? undefined : { error: STALE };
}
