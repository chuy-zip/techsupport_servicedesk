import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import type { Prisma, TicketStatus } from "@/generated/prisma/client";
import { TicketCard, type BoardTicket } from "@/components/tickets/ticket-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentDue, currentSla, escalationAlert } from "@/lib/tickets/data";
import { statusNames } from "@/lib/tickets/labels";
import { APPROVER_ROLES } from "@/lib/tickets/workflow";
import { BoardFilters, type Filters } from "./board-filters";

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

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const all = (value: string | string[] | undefined) => (Array.isArray(value) ? value : value ? [value] : []);

async function Board({ searchParams }: { searchParams: PageProps<"/tablero">["searchParams"] }) {
  await connection();
  const user = await getCurrentUser();
  if (user.role === "CLIENT") redirect("/inicio");

  // Ver la carga de otras personas y filtrar por ellas es de supervisión
  const showWorkload = APPROVER_ROLES.includes(user.role);
  const params = await searchParams;

  const [companies, services, agents] = await Promise.all([
    db.company.findMany({ include: { clientType: true }, orderBy: { name: "asc" } }),
    db.service.findMany({ orderBy: { sortOrder: "asc" } }),
    db.user.findMany({ where: { role: "AGENT", active: true }, orderBy: [{ supportLevel: "asc" }, { name: "asc" }] }),
  ]);

  // Solo se aceptan valores que existen; lo demás se ignora en vez de fallar
  const requested = first(params.asignados);
  const assigned =
    requested === "mios" || (showWorkload && (requested === "ninguno" || agents.some((a) => a.id === requested)))
      ? requested
      : "";
  const filters: Filters = {
    assigned,
    clients: all(params.cliente).filter((id) => companies.some((c) => c.id === id)),
    service: services.some((s) => s.code === first(params.servicio)) ? first(params.servicio) : "",
    priority: PRIORITY_ORDER.includes(first(params.prioridad)) ? first(params.prioridad) : "",
  };

  const where: Prisma.TicketWhereInput = {};
  if (filters.assigned === "mios") where.assigneeId = user.id;
  else if (filters.assigned === "ninguno") where.assigneeId = null;
  else if (filters.assigned) where.assigneeId = filters.assigned;
  if (filters.clients.length) where.companyId = { in: filters.clients };
  if (filters.service) where.catalogItem = { service: { code: filters.service } };
  if (filters.priority) where.priority = filters.priority as Prisma.TicketWhereInput["priority"];

  const include = {
    catalogItem: { include: { service: true } },
    company: { include: { clientType: true } },
    assignee: true,
  } as const;

  const [active, closed, workload] = await Promise.all([
    db.ticket.findMany({ where: { ...where, status: { not: "CLOSED" } }, include }),
    db.ticket.findMany({
      where: { ...where, status: "CLOSED" },
      include,
      orderBy: { closedAt: "desc" },
      take: CLOSED_LIMIT,
    }),
    // La carga es el trabajo pendiente de cada persona, sin resolver ni cerrar, sin importar los filtros
    showWorkload
      ? db.ticket.groupBy({ by: ["assigneeId"], where: { status: { notIn: ["RESOLVED", "CLOSED"] } }, _count: true })
      : Promise.resolve([]),
  ]);

  const openFor = (assigneeId: string | null) => workload.find((row) => row.assigneeId === assigneeId)?._count ?? 0;
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
    tags: ticket.tags,
    pendingApproval: ticket.requiresApproval && !ticket.approvedAt,
    alert: escalationAlert(ticket, ticket.company.clientType, now),
    sla: currentSla(ticket, ticket.company.clientType, now),
  });

  const columns = COLUMNS.map((status) => ({
    status,
    tickets: (status === "CLOSED" ? closed : sorted.filter((t) => t.status === status)).map(toCard),
  }));

  return (
    <>
      <BoardFilters
        filters={filters}
        companies={companies.map((c) => ({ id: c.id, name: c.name, vip: c.clientType.code === "VIP" }))}
        services={services.map((s) => ({ code: s.code, name: s.name }))}
        agents={agents.map((a) => ({ id: a.id, name: a.name, open: openFor(a.id) }))}
        unassigned={openFor(null)}
        showWorkload={showWorkload}
      />

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
