import Link from "next/link";
import type { Priority } from "@/generated/prisma/client";
import type { SlaProgress } from "@/lib/tickets/sla";
import { PriorityBadge, TagChip } from "./badges";
import { SlaMeter } from "./sla-meter";

export type BoardTicket = {
  number: number;
  title: string;
  serviceName: string;
  priority: Priority;
  companyName: string;
  vip: boolean;
  level: number;
  assigneeName: string | null;
  tags: string[];
  pendingApproval: boolean;
  alert: string | null;
  sla: { label: string; progress: SlaProgress } | null;
};

const flag = "rounded-full px-2 py-0.5 text-label font-semibold whitespace-nowrap";

export function TicketCard({ ticket }: { ticket: BoardTicket }) {
  return (
    <Link
      href={`/tickets/${ticket.number}`}
      className="flex flex-col gap-2.5 rounded-control border border-line bg-surface p-3.5 transition-colors duration-150 hover:border-olive/50"
    >
      <div className="flex items-center justify-between gap-2 text-caption text-muted">
        <span className="truncate tabular-nums">
          #{ticket.number} · {ticket.serviceName}
        </span>
        {ticket.level > 1 && <span className="shrink-0">N{ticket.level}</span>}
      </div>
      <p className="line-clamp-2 font-medium leading-snug">{ticket.title}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={ticket.priority} />
        {ticket.vip && <span className={`${flag} bg-lime text-ink`}>VIP</span>}
        {ticket.pendingApproval && <span className={`${flag} bg-p2-bg text-p2`}>Por aprobar</span>}
        {ticket.alert && <span className={`${flag} bg-p1-bg text-p1`}>{ticket.alert}</span>}
        {ticket.tags.slice(0, 3).map((tag) => (
          <TagChip key={tag} tag={tag} />
        ))}
      </div>
      <dl className="text-caption">
        <div className="flex justify-between gap-2">
          <dt className="sr-only">Empresa</dt>
          <dd className="truncate text-muted">{ticket.companyName}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="sr-only">Asignado a</dt>
          <dd className={`truncate ${ticket.assigneeName ? "font-medium" : "text-muted"}`}>
            {ticket.assigneeName ?? "Sin asignar"}
          </dd>
        </div>
      </dl>
      {ticket.sla && <SlaMeter label={ticket.sla.label} progress={ticket.sla.progress} />}
    </Link>
  );
}
