"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageProblems, canMoveProblem, missingForStatus } from "@/lib/problems";
import { problemStatusNames } from "@/lib/tickets/labels";
import { STAFF_ROLES } from "@/lib/tickets/workflow";

export type ActionState = { error?: string } | undefined;

const STALE = "Alguien más modificó el problema. Recarga la página para ver su estado actual.";
const FORBIDDEN = "Los problemas los gestionan agentes de nivel 2 o 3 y supervisión.";
const CLOSED = "El problema está cerrado; ya no recibe cambios.";

// Todo el personal entra, pero solo nivel 2, nivel 3 y supervisión cambian algo.
// Se verifica aquí aunque la pantalla oculte los controles: cada acción es un endpoint público
async function requireManager(): Promise<CurrentUser | null> {
  const user = await requireUser(...STAFF_ROLES);
  return canManageProblems(user) ? user : null;
}

// Aplica el cambio solo si el problema sigue como se leyó, para no pisar el de otra persona
async function update(problem: { id: string; updatedAt: Date }, data: Prisma.ProblemUncheckedUpdateManyInput) {
  const { count } = await db.problem.updateMany({ where: { id: problem.id, updatedAt: problem.updatedAt }, data });
  if (count > 0) refresh();
  return count > 0;
}

const text = (max: number, empty: string) =>
  z.string().trim().min(1, empty).max(max, `No puede pasar de ${max} caracteres.`);

const CreateSchema = z.object({
  title: text(120, "Escribe un título.").min(5, "Escribe un título de al menos 5 caracteres."),
  description: text(4000, "Describe qué se observa."),
  serviceId: z.string().optional(),
});

export async function createProblem(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireManager();
  if (!user) return { error: FORBIDDEN };
  const input = CreateSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Datos inválidos." };

  const serviceId = input.data.serviceId || null;
  if (serviceId && !(await db.service.findUnique({ where: { id: serviceId } }))) {
    return { error: "Ese servicio no existe." };
  }

  // Quien lo identifica queda como responsable; supervisión puede pasarlo a otra persona
  const problem = await db.problem.create({
    data: { title: input.data.title, description: input.data.description, serviceId, ownerId: user.id },
  });
  redirect(`/problemas/${problem.number}`);
}

const StatusSchema = z.object({
  problemId: z.string().min(1),
  status: z.enum(["IDENTIFIED", "DIAGNOSING", "KNOWN_ERROR", "SOLUTION_PROPOSED", "CLOSED"]),
});

export async function changeProblemStatus(_state: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireManager())) return { error: FORBIDDEN };
  const input = StatusSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: "Datos inválidos." };

  const problem = await db.problem.findUnique({ where: { id: input.data.problemId } });
  if (!problem) return { error: "El problema ya no existe." };
  const to = input.data.status;
  if (!canMoveProblem(problem.status, to)) {
    return { error: `No se puede pasar de ${problemStatusNames[problem.status]} a ${problemStatusNames[to]}.` };
  }
  const missing = missingForStatus(to, problem);
  if (missing) return { error: missing };

  const applied = await update(problem, { status: to, closedAt: to === "CLOSED" ? new Date() : null });
  return applied ? undefined : { error: STALE };
}

const AnalysisSchema = z.object({
  problemId: z.string().min(1),
  rootCause: z.string().trim().max(4000, "La causa raíz no puede pasar de 4000 caracteres."),
  workaround: z.string().trim().max(4000, "El workaround no puede pasar de 4000 caracteres."),
});

export async function saveAnalysis(_state: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireManager())) return { error: FORBIDDEN };
  const input = AnalysisSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Datos inválidos." };

  const problem = await db.problem.findUnique({ where: { id: input.data.problemId } });
  if (!problem) return { error: "El problema ya no existe." };
  if (problem.status === "CLOSED") return { error: CLOSED };

  const rootCause = input.data.rootCause || null;
  const workaround = input.data.workaround || null;
  // Un error conocido sin causa o sin workaround dejaría de serlo
  if (problem.status !== "IDENTIFIED" && problem.status !== "DIAGNOSING" && (!rootCause || !workaround)) {
    return { error: "Un error conocido necesita su causa raíz y su workaround; no se pueden dejar vacíos." };
  }

  const applied = await update(problem, { rootCause, workaround });
  return applied ? undefined : { error: STALE };
}

const OwnerSchema = z.object({ problemId: z.string().min(1), ownerId: z.string() });

export async function assignProblem(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireManager();
  if (!user) return { error: FORBIDDEN };
  const input = OwnerSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: "Datos inválidos." };

  const problem = await db.problem.findUnique({ where: { id: input.data.problemId } });
  if (!problem) return { error: "El problema ya no existe." };
  if (problem.status === "CLOSED") return { error: CLOSED };

  const ownerId = input.data.ownerId || null;
  if (ownerId === problem.ownerId) return undefined;
  // Un agente puede tomarlo; dárselo a otra persona es de supervisión, como con los tickets
  if (user.role === "AGENT" && ownerId !== user.id) {
    return { error: "Solo supervisión puede asignar el problema a otra persona." };
  }
  if (ownerId) {
    const owner = await db.user.findUnique({ where: { id: ownerId } });
    if (!owner || !owner.active || !canManageProblems(owner)) {
      return { error: "Esa persona no gestiona problemas: tiene que ser de nivel 2 o 3, o de supervisión." };
    }
  }

  const applied = await update(problem, { ownerId });
  return applied ? undefined : { error: STALE };
}

const LinkSchema = z.object({
  problemId: z.string().min(1),
  ticketNumber: z.coerce.number({ error: "Escribe el número del ticket." }).int("Escribe el número del ticket.").positive("Escribe el número del ticket."),
});

// Liga un incidente al problema y lo deja en el historial del ticket, en la misma transacción
export async function linkTicket(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireManager();
  if (!user) return { error: FORBIDDEN };
  const input = LinkSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Datos inválidos." };

  const problem = await db.problem.findUnique({ where: { id: input.data.problemId } });
  if (!problem) return { error: "El problema ya no existe." };
  if (problem.status === "CLOSED") return { error: CLOSED };

  const ticket = await db.ticket.findUnique({ where: { number: input.data.ticketNumber }, include: { problem: true } });
  if (!ticket) return { error: `No existe el ticket #${input.data.ticketNumber}.` };
  // Un problema es la causa de incidentes; una solicitud no es una falla
  if (ticket.type !== "INCIDENT") return { error: `El ticket #${ticket.number} es una solicitud; solo se ligan incidentes.` };
  if (ticket.problemId === problem.id) return { error: `El ticket #${ticket.number} ya está ligado a este problema.` };

  // Si estaba en otro problema, se mueve. Solo si nadie lo cambió entre medio
  const applied = await db.$transaction(async (tx) => {
    const { count } = await tx.ticket.updateMany({
      where: { id: ticket.id, problemId: ticket.problemId },
      data: { problemId: problem.id },
    });
    if (count === 0) return false;
    await tx.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        actorId: user.id,
        kind: "PROBLEM_LINKED",
        fromValue: ticket.problem ? `problema #${ticket.problem.number}` : null,
        toValue: `problema #${problem.number}`,
      },
    });
    return true;
  });
  if (applied) refresh();
  return applied ? undefined : { error: "Alguien más cambió ese ticket. Inténtalo de nuevo." };
}

const UnlinkSchema = z.object({ problemId: z.string().min(1), ticketId: z.string().min(1) });

export async function unlinkTicket(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireManager();
  if (!user) return { error: FORBIDDEN };
  const input = UnlinkSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: "Datos inválidos." };

  const problem = await db.problem.findUnique({ where: { id: input.data.problemId } });
  if (!problem) return { error: "El problema ya no existe." };
  if (problem.status === "CLOSED") return { error: CLOSED };

  // Solo si sigue ligado a este problema; si otra persona ya lo movió, no se toca
  const applied = await db.$transaction(async (tx) => {
    const { count } = await tx.ticket.updateMany({
      where: { id: input.data.ticketId, problemId: problem.id },
      data: { problemId: null },
    });
    if (count === 0) return false;
    await tx.ticketEvent.create({
      data: {
        ticketId: input.data.ticketId,
        actorId: user.id,
        kind: "PROBLEM_LINKED",
        fromValue: `problema #${problem.number}`,
        toValue: null,
      },
    });
    return true;
  });
  if (applied) refresh();
  return applied ? undefined : { error: "El ticket ya no está ligado a este problema." };
}
