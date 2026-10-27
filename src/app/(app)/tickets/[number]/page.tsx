import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PriorityBadge, StatusBadge, TagChip } from "@/components/tickets/badges";
import { ClientCommitment } from "@/components/tickets/client-commitment";
import { CommentThread } from "@/components/tickets/comment-thread";
import { SlaMeter } from "@/components/tickets/sla-meter";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentSla, escalationAlert, getCatalogFor } from "@/lib/tickets/data";
import { describeEvent, formatDate, impactNames, typeNames, urgencyNames } from "@/lib/tickets/labels";
import { CommentForm } from "./comment-form";
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
      // Las notas internas se filtran en la consulta: al cliente nunca le llegan
      comments: {
        where: isStaff ? {} : { internal: false },
        include: { author: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Un cliente solo ve los tickets de su empresa. Se responde igual que si no existiera
  if (!ticket || (!isStaff && ticket.companyId !== user.companyId)) notFound();

  const [agents, catalog] = isStaff
    ? await Promise.all([
        db.user.findMany({
          where: { role: "AGENT", active: true },
          select: { id: true, name: true, supportLevel: true },
          orderBy: [{ supportLevel: "asc" }, { name: "asc" }],
        }),
        // Los elementos que este cliente podría haber elegido, para reclasificar
        getCatalogFor(ticket.company.clientType.code),
      ])
    : [[], []];

  const now = new Date();
  const sla = currentSla(ticket, ticket.company.clientType, now);
  const alert = isStaff ? escalationAlert(ticket, ticket.company.clientType, now) : null;

  // El cliente ve su caso y quién lo atiende; la clasificación interna es del personal
  const details = isStaff
    ? [
        { label: "Ticket", value: `#${ticket.number}` },
        { label: "Tipo", value: `${typeNames[ticket.type]} · ${ticket.catalogItem.code}` },
        { label: "Qué pasa", value: ticket.catalogItem.name },
        { label: "Impacto", value: impactNames[ticket.impact] },
        { label: "Urgencia", value: urgencyNames[ticket.urgency] },
        { label: "Empresa", value: `${ticket.company.name}, cliente ${ticket.company.clientType.name}` },
        { label: "Reportado por", value: ticket.requester.email },
        { label: "Creado", value: formatDate(ticket.createdAt) },
        { label: "Nivel", value: `Nivel ${ticket.level}` },
        { label: "Asignado a", value: ticket.assignee?.name ?? "Sin asignar" },
      ]
    : [
        { label: "Ticket", value: `#${ticket.number}` },
        { label: "Tipo", value: typeNames[ticket.type] },
        { label: "Qué pasa", value: ticket.catalogItem.name },
        { label: "Reportado por", value: ticket.requester.email },
        { label: "Creado", value: formatDate(ticket.createdAt) },
        { label: "Te atiende", value: ticket.assignee?.name ?? "Pendiente de asignar" },
      ];

  return (
    <>
      <BackLink href={isStaff ? "/tablero" : "/inicio"}>{isStaff ? "Tablero" : "Mis tickets"}</BackLink>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <Eyebrow>{ticket.catalogItem.service.name}</Eyebrow>
          <h1 className="mt-2 font-display text-title leading-tight font-bold break-words">{ticket.title}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {isStaff && <PriorityBadge priority={ticket.priority} />}
            <StatusBadge status={ticket.status} />
            {ticket.tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>

          {ticket.requiresApproval && (
            <p
              className={`mt-6 rounded-control border px-4 py-3 text-caption ${
                ticket.approvedAt ? "border-line bg-surface text-muted" : "border-p2/30 bg-p2-bg text-p2"
              }`}
            >
              {ticket.approvedAt
                ? `Aprobado por ${ticket.approvedBy?.name}, ${formatDate(ticket.approvedAt)}`
                : "Este ticket necesita la autorización de supervisión antes de atenderse."}
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

          <section className="mt-8">
            <h2 className="font-semibold">Comentarios</h2>
            {ticket.comments.length === 0 ? (
              <p className="mt-2 text-caption text-muted">Todavía no hay comentarios.</p>
            ) : (
              <div className="mt-3">
                <CommentThread comments={ticket.comments} viewer={user} />
              </div>
            )}
            <div className="mt-4">
              {ticket.status === "CLOSED" ? (
                <p className="text-caption text-muted">El ticket está cerrado; ya no recibe comentarios.</p>
              ) : (
                <CommentForm ticketId={ticket.id} canWriteInternal={isStaff} />
              )}
            </div>
          </section>

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
          {isStaff
            ? sla && (
                <Card className="px-5 py-4">
                  <SlaMeter label={sla.label} progress={sla.progress} />
                </Card>
              )
            : (
                <Card className="px-5 py-4">
                  <ClientCommitment ticket={ticket} />
                </Card>
              )}
          {isStaff && (
            <StaffPanel
              ticket={ticket}
              user={user}
              agents={agents}
              catalog={catalog.map((service) => ({
                name: service.name,
                items: service.items.map((item) => ({ id: item.id, code: item.code, name: item.name })),
              }))}
            />
          )}
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
