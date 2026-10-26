import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import type { TicketStatus } from "@/generated/prisma/client";
import { TicketCard, type BoardTicket } from "@/components/tickets/ticket-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentDue, currentSla, escalationAlert } from "@/lib/tickets/data";
import { statusNames } from "@/lib/tickets/labels";

export const metadata: Metadata = { title: "Tablero" };

const COLUMNS: TicketStatus[] = ["OPEN", "IN_PROGRESS", "ESCALATED", "RESOLVED", "CLOSED"];
const PRIORITY_ORDER = ["P1", "P2", "P3", "P4", "P5"];
// Los cerrados solo sirven de referencia; se muestran los más recientes
const CLOSED_LIMIT = 10;

export default function BoardPage({ searchParams }: PageProps<"/tablero">) {
  return (
    <>
      <Eyebrow>Equipo de soporte</Eyebrow>
      <h1 className="mt-2 font-display text-title leading-tight font-bold">Tablero</h1>
      <Suspense fallback={<p className="mt-8 text-muted">Cargando la cola…</p>}>
        <Board searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Board({ searchParams }: { searchParams: PageProps<"/tablero">["searchParams"] }) {
  await connection();
  const user = await getCurrentUser();
  if (user.role === "CLIENT") redirect("/inicio");

  const mine = (await searchParams).asignados === "mios";
  const assigned = mine ? { assigneeId: user.id } : {};
  const include = {
    catalogItem: { include: { service: true } },
    company: { include: { clientType: true } },
    assignee: true,
  } as const;

  const [active, closed] = await Promise.all([
    db.ticket.findMany({ where: { status: { not: "CLOSED" }, ...assigned }, include }),
    db.ticket.findMany({
      where: { status: "CLOSED", ...assigned },
      include,
      orderBy: { closedAt: "desc" },
      take: CLOSED_LIMIT,
    }),
  ]);

  const now = new Date();

  // Lo más urgente arriba: primero la prioridad y, entre iguales, el vencimiento más cercano
  const sorted = active.sort((a, b) => {
    const byPriority = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
    if (byPriority !== 0) return byPriority;
    const dueA = currentDue(a)?.getTime() ?? Infinity;
    const dueB = currentDue(b)?.getTime() ?? Infinity;
    return dueA - dueB || a.createdAt.getTime() - b.createdAt.getTime();
  });

  const toCard = (ticket: (typeof active)[number]): BoardTicket => ({
    number: ticket.number,
    title: ticket.title,
    serviceName: ticket.catalogItem.service.name,
    priority: ticket.priority,
    companyName: ticket.company.name,
    vip: ticket.company.clientType.code === "VIP",
    level: ticket.level,
    assigneeName: ticket.assignee?.name ?? null,
    pendingApproval: ticket.requiresApproval && !ticket.approvedAt,
    alert: escalationAlert(ticket, ticket.company.clientType, now),
    sla: currentSla(ticket, ticket.company.clientType, now),
  });

  const columns = COLUMNS.map((status) => ({
    status,
    tickets: (status === "CLOSED" ? closed : sorted.filter((t) => t.status === status)).map(toCard),
  }));

  const tab = (active: boolean) =>
    `rounded-full px-3 py-1 text-caption font-medium transition-colors duration-150 ${
      active ? "bg-ink text-white" : "text-muted hover:text-ink"
    }`;

  return (
    <>
      <nav className="mt-6 flex gap-1" aria-label="Filtro de tickets">
        <Link href="/tablero" className={tab(!mine)} aria-current={!mine ? "page" : undefined}>
          Todos
        </Link>
        <Link href="/tablero?asignados=mios" className={tab(mine)} aria-current={mine ? "page" : undefined}>
          Asignados a mí
        </Link>
      </nav>

      <div className="mt-4 grid auto-cols-[minmax(13rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-4">
        {columns.map((column) => (
          <section key={column.status} className="flex flex-col gap-2.5 rounded-card bg-line/50 p-2.5">
            <h2 className="flex items-center justify-between px-1 text-caption font-semibold">
              {statusNames[column.status]}
              <span className="text-muted tabular-nums">{column.tickets.length}</span>
            </h2>
            {column.tickets.length === 0 ? (
              <p className="px-1 pb-2 text-caption text-muted">Sin tickets.</p>
            ) : (
              column.tickets.map((ticket) => <TicketCard key={ticket.number} ticket={ticket} />)
            )}
          </section>
        ))}
      </div>
    </>
  );
}
