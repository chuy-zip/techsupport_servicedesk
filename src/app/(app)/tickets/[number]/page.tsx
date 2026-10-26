import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PriorityBadge, StatusBadge } from "@/components/tickets/badges";
import { SlaMeter } from "@/components/tickets/sla-meter";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentSla, escalationAlert } from "@/lib/tickets/data";
import { describeEvent, formatDate, impactNames, typeNames, urgencyNames } from "@/lib/tickets/labels";
import { StaffPanel } from "./staff-panel";

export const metadata: Metadata = { title: "Ticket" };

export default function TicketPage({ params }: PageProps<"/tickets/[number]">) {
  return (
    <Suspense fallback={<p className="text-muted">Cargando el ticket…</p>}>
      <TicketDetail params={params} />
    </Suspense>
  );
}

async function TicketDetail({ params }: { params: PageProps<"/tickets/[number]">["params"] }) {
  // Consultar la base abre conexiones con valores aleatorios; también al precargar desde el tablero
  await connection();
  const number = Number((await params).number);
  if (!Number.isInteger(number)) notFound();

  const user = await getCurrentUser();
  const isStaff = user.role !== "CLIENT";
  const ticket = await db.ticket.findUnique({
    where: { number },
    include: {
      catalogItem: { include: { service: true } },
      company: { include: { clientType: true } },
      requester: true,
      assignee: true,
      approvedBy: true,
      // El historial solo se muestra al personal
      events: { include: { actor: true }, orderBy: { createdAt: "desc" } },
    },
  });

  // Un cliente solo ve los tickets de su empresa. Se responde igual que si no existiera
  if (!ticket || (!isStaff && ticket.companyId !== user.companyId)) notFound();

  const agents = isStaff
    ? await db.user.findMany({
        where: { role: "AGENT", active: true },
        select: { id: true, name: true, supportLevel: true },
        orderBy: [{ supportLevel: "asc" }, { name: "asc" }],
      })
    : [];

  const now = new Date();
  const sla = currentSla(ticket, ticket.company.clientType, now);
  const alert = isStaff ? escalationAlert(ticket, ticket.company.clientType, now) : null;

  const details = [
    { label: "Ticket", value: `#${ticket.number}` },
    { label: "Tipo", value: `${typeNames[ticket.type]} · ${ticket.catalogItem.code}` },
    { label: "Qué pasa", value: ticket.catalogItem.name },
    { label: "Impacto", value: impactNames[ticket.impact] },
    { label: "Urgencia", value: urgencyNames[ticket.urgency] },
    { label: "Empresa", value: `${ticket.company.name}, cliente ${ticket.company.clientType.name}` },
    { label: "Reportado por", value: ticket.requester.name },
    { label: "Creado", value: formatDate(ticket.createdAt) },
    { label: "Nivel", value: `Nivel ${ticket.level}` },
    { label: "Asignado a", value: ticket.assignee?.name ?? "Sin asignar" },
  ];

  return (
    <>
      <BackLink href={isStaff ? "/tablero" : "/inicio"}>{isStaff ? "Tablero" : "Mis tickets"}</BackLink>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <Eyebrow>{ticket.catalogItem.service.name}</Eyebrow>
          <h1 className="mt-2 font-display text-title leading-tight font-bold break-words">{ticket.title}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>

          {ticket.requiresApproval && (
            <p
              className={`mt-6 rounded-control border px-4 py-3 text-caption ${
                ticket.approvedAt ? "border-line bg-surface text-muted" : "border-p2/30 bg-p2-bg text-p2"
              }`}
            >
              {ticket.approvedAt
                ? `Solicitud aprobada por ${ticket.approvedBy?.name} el ${formatDate(ticket.approvedAt)}.`
                : "Esta solicitud necesita la autorización de supervisión antes de atenderse."}
            </p>
          )}

          {alert && (
            <p className="mt-6 rounded-control border border-p1/30 bg-p1-bg px-4 py-3 text-caption text-p1">
              {alert}: el ticket superó el tiempo de escalamiento de su tipo de cliente.
            </p>
          )}

          <Card className="mt-6 px-6 py-5">
            <h2 className="text-caption font-medium text-muted">Descripción</h2>
            <p className="mt-2 whitespace-pre-wrap">{ticket.description}</p>
          </Card>

          {isStaff && ticket.events.length > 0 && (
            <section className="mt-8">
              <h2 className="font-semibold">Historial</h2>
              <ol className="mt-3 flex flex-col gap-3 border-l border-line pl-4">
                {ticket.events.map((event) => (
                  <li key={event.id} className="text-caption">
                    <p>
                      <span className="font-medium">{event.actor?.name ?? "Sistema"}</span>{" "}
                      {describeEvent(event.kind, event.fromValue, event.toValue)}
                    </p>
                    <p className="text-muted tabular-nums">{formatDate(event.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          {sla && (
            <Card className="px-5 py-4">
              <SlaMeter label={sla.label} progress={sla.progress} />
            </Card>
          )}
          {isStaff && <StaffPanel ticket={ticket} user={user} agents={agents} />}
          <Card>
            <dl className="divide-y divide-line text-caption">
              {details.map((item) => (
                <div key={item.label} className="flex justify-between gap-4 px-5 py-3">
                  <dt className="whitespace-nowrap text-muted">{item.label}</dt>
                  <dd className="text-right font-medium">{item.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </aside>
      </div>
    </>
  );
}
