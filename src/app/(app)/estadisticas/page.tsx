import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Prisma, type Priority, type TicketStatus } from "@/generated/prisma/client";
import { Columns, Donut, Legend, SplitBar, StackedBars, type Slice, type StackedRow } from "@/components/stats/charts";
import { TagChip } from "@/components/tickets/badges";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { priorityNames, serviceKindNames, statusNames, typeNames } from "@/lib/tickets/labels";

export const metadata: Metadata = { title: "Estadísticas" };

const PRIORITIES: Priority[] = ["P1", "P2", "P3", "P4", "P5"];
const STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "ESCALATED", "RESOLVED", "CLOSED"];
const DONE: TicketStatus[] = ["RESOLVED", "CLOSED"];
const TAG_LIMIT = 10;

const priorityColor: Record<Priority, string> = {
  P1: "var(--color-chart-p1)",
  P2: "var(--color-chart-p2)",
  P3: "var(--color-chart-p3)",
  P4: "var(--color-chart-p4)",
  P5: "var(--color-chart-p5)",
};

const statusColor: Record<TicketStatus, string> = {
  OPEN: "var(--color-chart-open)",
  IN_PROGRESS: "var(--color-chart-progress)",
  ESCALATED: "var(--color-chart-escalated)",
  RESOLVED: "var(--color-chart-resolved)",
  CLOSED: "var(--color-chart-closed)",
};

export default function StatsPage({ searchParams }: PageProps<"/estadisticas">) {
  return (
    <>
      <Eyebrow>Equipo de soporte</Eyebrow>
      <h1 className="mt-2 font-display text-title leading-tight font-bold">Estadísticas</h1>
      <Suspense fallback={<p className="mt-8 text-muted">Calculando…</p>}>
        <Stats searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Stats({ searchParams }: { searchParams: PageProps<"/estadisticas">["searchParams"] }) {
  await connection();
  const user = await getCurrentUser();
  if (user.role === "CLIENT") redirect("/inicio");

  // "Pendientes" deja fuera lo resuelto y lo cerrado: es la foto de la cola de hoy
  const pendingOnly = (await searchParams).alcance === "pendientes";
  const where: Prisma.TicketWhereInput = pendingOnly ? { status: { notIn: DONE } } : {};

  const [services, items, byItem, byType, byStatus, urgentOpen, tags] = await Promise.all([
    db.service.findMany({ orderBy: { sortOrder: "asc" } }),
    db.catalogItem.findMany({ select: { id: true, serviceId: true, isOther: true } }),
    db.ticket.groupBy({ by: ["catalogItemId", "priority"], where, _count: true }),
    db.ticket.groupBy({ by: ["type"], where, _count: true }),
    db.ticket.groupBy({ by: ["status"], where, _count: true }),
    // Lo urgente que sigue sin resolver, en los dos alcances: es lo primero que hay que atender
    db.ticket.count({ where: { status: { notIn: DONE }, priority: { in: ["P1", "P2"] } } }),
    // Las etiquetas ya se guardan en minúscula y sin repetir, así que se pueden contar directo
    db.$queryRaw<{ tag: string; count: number }[]>`
      SELECT tag, count(*)::int AS count
      FROM "Ticket", unnest(tags) AS tag
      ${pendingOnly ? Prisma.sql`WHERE status NOT IN ('RESOLVED', 'CLOSED')` : Prisma.empty}
      GROUP BY tag
      ORDER BY count DESC, tag
      LIMIT ${TAG_LIMIT}`,
  ]);

  const itemById = new Map(items.map((item) => [item.id, item]));
  const total = byStatus.reduce((sum, row) => sum + row._count, 0);
  const statusCount = (status: TicketStatus) => byStatus.find((row) => row.status === status)?._count ?? 0;
  const done = DONE.reduce((sum, status) => sum + statusCount(status), 0);
  const pending = total - done;
  const priorityCount = (priority: Priority) =>
    byItem.filter((row) => row.priority === priority).reduce((sum, row) => sum + row._count, 0);
  const otherCount = byItem
    .filter((row) => itemById.get(row.catalogItemId)?.isOther)
    .reduce((sum, row) => sum + row._count, 0);

  // El servicio es la categoría del enunciado. Cada barra se parte por prioridad, y se cuenta cuántos
  // llegaron como "Otro": si un servicio acumula muchos, al catálogo le falta un elemento
  const perService = services
    .map((service) => {
      const rows = byItem.filter((row) => itemById.get(row.catalogItemId)?.serviceId === service.id);
      const count = (priority: Priority) =>
        rows.filter((row) => row.priority === priority).reduce((sum, row) => sum + row._count, 0);
      return {
        service,
        total: rows.reduce((sum, row) => sum + row._count, 0),
        other: rows.filter((row) => itemById.get(row.catalogItemId)?.isOther).reduce((sum, row) => sum + row._count, 0),
        byPriority: PRIORITIES.map((priority) => ({ priority, count: count(priority) })),
      };
    })
    // De más a menos tickets, para que el servicio que más carga dé arriba
    .sort((a, b) => b.total - a.total);

  const prioritySlices = (counts: { priority: Priority; count: number }[]): Slice[] =>
    counts.map(({ priority, count }) => ({
      key: priority,
      label: `${priority} ${priorityNames[priority]}`,
      value: count,
      color: priorityColor[priority],
    }));

  const serviceRows: StackedRow[] = perService.map(({ service, other, byPriority }) => ({
    key: service.code,
    label: (
      <>
        {service.name} <span className="font-normal text-muted">· {serviceKindNames[service.kind]}</span>
      </>
    ),
    detail: other > 0 && `${other} como “Otro”`,
    segments: prioritySlices(byPriority),
  }));

  const priorityTotals = PRIORITIES.map((priority) => ({ priority, count: priorityCount(priority) }));
  const statusSlices: Slice[] = STATUSES.filter((status) => !pendingOnly || !DONE.includes(status)).map((status) => ({
    key: status,
    label: statusNames[status],
    value: statusCount(status),
    color: statusColor[status],
  }));
  const typeSlices: Slice[] = [
    { key: "INCIDENT", label: typeNames.INCIDENT, color: "var(--color-chart-progress)" },
    { key: "SERVICE_REQUEST", label: typeNames.SERVICE_REQUEST, color: "var(--color-chart-escalated)" },
  ].map((slice) => ({ ...slice, value: byType.find((row) => row.type === slice.key)?._count ?? 0 }));

  const tiles = [
    { label: "P1 y P2 sin resolver", value: urgentOpen, hint: "Críticos y altos que siguen abiertos" },
    { label: "Escalados", value: statusCount("ESCALATED"), hint: "Esperan a nivel 2 o 3" },
    { label: "Llegaron como “Otro”", value: otherCount, hint: "Casos que el catálogo no prevé" },
  ];

  return (
    <>
      <nav aria-label="Alcance" className="mt-6 flex gap-2">
        {[
          { href: "/estadisticas", label: "Todos los tickets", active: !pendingOnly },
          { href: "/estadisticas?alcance=pendientes", label: "Solo pendientes", active: pendingOnly },
        ].map((option) => (
          <Link
            key={option.href}
            href={option.href}
            aria-current={option.active ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-caption font-medium transition-colors duration-150 ${
              option.active ? "border-olive bg-olive text-white" : "border-line bg-surface text-ink hover:bg-canvas"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {/* Primer nivel: la cola pendiente es la cifra que manda; lo demás la acompaña en pequeño */}
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <section className="flex flex-col justify-between rounded-card bg-olive px-7 py-6 text-white shadow-card">
          <div>
            <Eyebrow tone="lime">Pendientes ahora</Eyebrow>
            <p className="mt-3 text-hero leading-none font-semibold">{pending}</p>
            <p className="mt-2 text-caption text-white/80">
              {pendingOnly ? "Tickets abiertos, en progreso o escalados" : `De ${total} tickets ingresados`}
            </p>
          </div>
          {!pendingOnly && (
            <div className="mt-6">
              <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-lime" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
              </div>
              <p className="mt-2 text-caption text-white/80">
                {done} resueltos o cerrados · {total ? Math.round((done / total) * 100) : 0}%
              </p>
            </div>
          )}
        </section>
        <dl className="flex flex-col gap-3">
          {tiles.map((tile) => (
            <Card key={tile.label} className="flex flex-1 items-center justify-between gap-4 px-5 py-3">
              <dt className="text-caption font-medium">
                {tile.label}
                <span className="block text-label font-normal text-muted">{tile.hint}</span>
              </dt>
              <dd className="text-title leading-none font-semibold">{tile.value}</dd>
            </Card>
          ))}
        </dl>
      </div>

      {/* Segundo nivel: la gráfica por categoría que pide el servicio, a todo lo ancho */}
      <Card className="mt-6 px-6 py-6">
        <h2 className="text-body font-semibold">Tickets por servicio</h2>
        <p className="mt-1 text-caption text-muted">
          La categoría de cada ticket es el servicio del catálogo. Cada barra se parte por prioridad.
        </p>
        <div className="mt-4">
          <Legend slices={prioritySlices(priorityTotals)} />
        </div>
        <div className="mt-5">
          {total === 0 ? <p className="text-caption text-muted">Sin tickets.</p> : <StackedBars rows={serviceRows} />}
        </div>
        <details className="mt-5 text-caption">
          <summary className="cursor-pointer font-medium text-olive-dark">Ver como tabla</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left tabular-nums">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-medium">Servicio</th>
                  {PRIORITIES.map((priority) => (
                    <th key={priority} className="px-2 py-2 text-right font-medium">
                      {priority}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right font-medium">Otro</th>
                  <th className="py-2 pl-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {perService.map(({ service, total: serviceTotal, other, byPriority }) => (
                  <tr key={service.code} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3">{service.name}</td>
                    {byPriority.map((row) => (
                      <td key={row.priority} className="px-2 py-2 text-right">
                        {row.count}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right">{other}</td>
                    <td className="py-2 pl-2 text-right font-semibold">{serviceTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>

      {/* Tercer nivel: cómo se reparte la cola */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card className="px-6 py-5">
          <h2 className="text-body font-semibold">Por estado</h2>
          <div className="mt-5">
            <Donut slices={statusSlices} total={total} caption="tickets" />
          </div>
        </Card>
        <Card className="px-6 py-5">
          <h2 className="text-body font-semibold">Por prioridad</h2>
          <div className="mt-5">
            <Columns slices={prioritySlices(priorityTotals).map((slice) => ({ ...slice, label: slice.key }))} names={priorityNames} />
          </div>
        </Card>
      </div>

      {/* Cuarto nivel: contexto, en tarjetas más compactas */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card className="px-5 py-4">
          <Eyebrow>Por tipo</Eyebrow>
          <div className="mt-3">
            <SplitBar slices={typeSlices} />
          </div>
        </Card>
        <Card className="px-5 py-4">
          <Eyebrow>Etiquetas más usadas</Eyebrow>
          {tags.length === 0 ? (
            <p className="mt-3 text-caption text-muted">Sin etiquetas.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {tags.map((row) => (
                <li key={row.tag} className="flex items-center gap-1">
                  <TagChip tag={row.tag} />
                  <span className="text-caption font-semibold tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-label text-muted">Un ticket puede tener varias, así que no suman el total.</p>
        </Card>
      </div>
    </>
  );
}
