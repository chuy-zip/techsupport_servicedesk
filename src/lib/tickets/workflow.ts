import type { Role, TicketStatus } from "@/generated/prisma/client";

export const STAFF_ROLES: Role[] = ["AGENT", "SUPERVISOR", "ADMIN"];
export const APPROVER_ROLES: Role[] = ["SUPERVISOR", "ADMIN"];

// Ciclo de la Fase 1: OPEN, IN_PROGRESS, RESOLVED, CLOSED, con ESCALATED desde OPEN o IN_PROGRESS.
// Escalar es una acción aparte porque también sube el nivel. Desde RESOLVED se puede reabrir
export const transitions: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  ESCALATED: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus) {
  return transitions[from].includes(to);
}

export function canEscalate(status: TicketStatus, level: number) {
  return (status === "OPEN" || status === "IN_PROGRESS" || status === "ESCALATED") && level < 3;
}

// Texto del botón según desde dónde se mueve
export function transitionLabel(from: TicketStatus, to: TicketStatus) {
  if (to === "IN_PROGRESS") return from === "RESOLVED" ? "Reabrir" : "Poner en progreso";
  if (to === "RESOLVED") return "Marcar como resuelto";
  if (to === "CLOSED") return "Cerrar";
  return to;
}

// Los tickets escalados solo se asignan a agentes de nivel igual o superior
export function canHandle(agentLevel: number | null, ticketLevel: number) {
  return agentLevel !== null && agentLevel >= ticketLevel;
}

// Supervisión y administración actúan sobre cualquier ticket; un agente, solo sobre los de su nivel o inferior
export function canWork(user: { role: Role; supportLevel: number | null }, ticketLevel: number) {
  return user.role !== "AGENT" || canHandle(user.supportLevel, ticketLevel);
}
