import type { ClientType, Priority } from "../../generated/prisma/client";
import { applyPriorityFloor } from "./priority";
import { addAttentionMinutes } from "./sla";

type LevelTimes = { responseMinutes: number | null; resolutionMinutes: number | null };

// Prioridad final y vencimientos a partir de lo que dice la matriz. Es pura, sin acceso a la base,
// para que la usen la aplicación y los scripts de datos sin que existan dos versiones de la regla
export function classifyFrom(
  rulePriority: Priority,
  levelFor: (priority: Priority) => LevelTimes,
  clientType: ClientType,
  from: Date,
) {
  const priority = applyPriorityFloor(rulePriority, clientType.minPriority);
  const level = levelFor(priority);
  const due = (minutes: number | null) => (minutes === null ? null : addAttentionMinutes(from, minutes, clientType));
  return {
    priority,
    responseDueAt: due(level.responseMinutes),
    resolutionDueAt: due(level.resolutionMinutes),
  };
}
