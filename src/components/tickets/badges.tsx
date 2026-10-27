import type { Priority, TicketStatus } from "@/generated/prisma/client";
import { priorityNames, statusNames } from "@/lib/tickets/labels";

const pill = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold whitespace-nowrap";

// Clases completas y no armadas, para que Tailwind las encuentre
const priorityClasses: Record<Priority, string> = {
  P1: "bg-p1-bg text-p1",
  P2: "bg-p2-bg text-p2",
  P3: "bg-p3-bg text-p3",
  P4: "bg-p4-bg text-p4",
  P5: "bg-p5-bg text-p5",
};

// El color nunca va solo: siempre con el código y el nombre
export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`${pill} ${priorityClasses[priority]}`}>
      {priority} {priorityNames[priority]}
    </span>
  );
}

export function TagChip({ tag }: { tag: string }) {
  return <span className={`${pill} bg-line/70 font-medium text-muted`}>{tag}</span>;
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const resolved = status === "RESOLVED" || status === "CLOSED";
  return (
    <span className={`${pill} border ${resolved ? "border-transparent bg-lime text-ink" : "border-line bg-surface text-ink"}`}>
      {statusNames[status]}
    </span>
  );
}
