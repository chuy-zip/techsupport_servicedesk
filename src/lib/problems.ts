import type { ProblemStatus, Role } from "@/generated/prisma/client";

// Reglas de la gestión de problemas. Sin "server-only", para que también las usen los datos de demostración

// En la Fase 1 los problemas los investigan agentes de nivel 2 o 3 y supervisión; el nivel 1 solo los consulta
export function canManageProblems(user: { role: Role; supportLevel: number | null }) {
  if (user.role === "SUPERVISOR" || user.role === "ADMIN") return true;
  return user.role === "AGENT" && (user.supportLevel ?? 0) >= 2;
}

// Flujo de la Fase 1: Identificado, En diagnóstico, Error conocido y Solución propuesta, más el cierre.
// Si la solución propuesta no funciona, vuelve a diagnóstico
export const problemTransitions: Record<ProblemStatus, ProblemStatus[]> = {
  IDENTIFIED: ["DIAGNOSING"],
  DIAGNOSING: ["KNOWN_ERROR"],
  KNOWN_ERROR: ["SOLUTION_PROPOSED"],
  SOLUTION_PROPOSED: ["CLOSED", "DIAGNOSING"],
  CLOSED: [],
};

export function canMoveProblem(from: ProblemStatus, to: ProblemStatus) {
  return problemTransitions[from].includes(to);
}

// Un error conocido es, por definición, una causa raíz documentada con su workaround
export function missingForStatus(to: ProblemStatus, problem: { rootCause: string | null; workaround: string | null }) {
  if (to !== "KNOWN_ERROR") return null;
  if (!problem.rootCause) return "Documenta la causa raíz antes de marcarlo como error conocido.";
  if (!problem.workaround) return "Documenta el workaround antes de marcarlo como error conocido.";
  return null;
}

export function problemTransitionLabel(from: ProblemStatus, to: ProblemStatus) {
  if (to === "DIAGNOSING") return from === "IDENTIFIED" ? "Iniciar diagnóstico" : "Volver a diagnóstico";
  if (to === "KNOWN_ERROR") return "Marcar como error conocido";
  if (to === "SOLUTION_PROPOSED") return "Proponer solución";
  if (to === "CLOSED") return "Cerrar problema";
  return to;
}
