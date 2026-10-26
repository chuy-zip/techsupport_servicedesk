import type { Priority } from "@/generated/prisma/client";

const ORDER: Priority[] = ["P1", "P2", "P3", "P4", "P5"];

// Un cliente con prioridad mínima, como VIP con P2, nunca queda por debajo de ella
export function applyPriorityFloor(priority: Priority, floor: Priority | null): Priority {
  if (!floor) return priority;
  return ORDER.indexOf(priority) > ORDER.indexOf(floor) ? floor : priority;
}
