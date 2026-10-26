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
import { currentSla } from "@/lib/tickets/data";
import {
  formatDate,
  impactNames,
  typeNames,
  urgencyNames,
} from "@/lib/tickets/labels";

export const metadata: Metadata = { title: "Ticket" };

export default function TicketPage({ params }: PageProps<"/tickets/[number]">) {
  return (
    <Suspense fallback={<p className="text-muted">Cargando el ticket…</p>}>
      <TicketDetail params={params} />
    </Suspense>
  );
}

async function TicketDetail({
  params,
}: {
  params: PageProps<"/tickets/[number]">["params"];
}) {
  const number = Number((await params).number);
  if (!Number.isInteger(number)) notFound();

  const user = await getCurrentUser();
  const ticket = await db.ticket.findUnique({
    where: { number },
    include: {
      catalogItem: { include: { service: true } },
      company: { include: { clientType: true } },
      requester: true,
      assignee: true,
    },
  });

  // Un cliente solo ve los tickets de su empresa. Se responde igual que si no existiera
  if (
    !ticket ||
    (user.role === "CLIENT" && ticket.companyId !== user.companyId)
  )
    notFound();

  await connection();
  const sla = currentSla(ticket, ticket.company.clientType, new Date());

  const details = [
    { label: "Folio", value: `#${ticket.number}` },
    {
      label: "Tipo",
      value: `${typeNames[ticket.type]} · ${ticket.catalogItem.code}`,
    },
    { label: "Qué pasa", value: ticket.catalogItem.name },
    { label: "Impacto", value: impactNames[ticket.impact] },
    { label: "Urgencia", value: urgencyNames[ticket.urgency] },
    {
      label: "Empresa",
      value: `${ticket.company.name}, cliente ${ticket.company.clientType.name}`,
    },
    { label: "Reportado por", value: ticket.requester.name },
    { label: "Creado", value: formatDate(ticket.createdAt) },
    { label: "Asignado a", value: ticket.assignee?.name ?? "Sin asignar" },
  ];

  return (
    <>
      <BackLink href="/inicio">
        {user.role === "CLIENT" ? "Mis tickets" : "Inicio"}
      </BackLink>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <Eyebrow>{ticket.catalogItem.service.name}</Eyebrow>
          <h1 className="mt-2 font-display text-title leading-tight font-bold break-words">
            {ticket.title}
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>

          {ticket.requiresApproval && !ticket.approvedAt && (
            <p className="mt-6 rounded-control border border-p2/30 bg-p2-bg px-4 py-3 text-caption text-p2">
              Esta solicitud necesita la autorización de supervisión antes de
              atenderse.
            </p>
          )}

          <Card className="mt-6 px-6 py-5">
            <h2 className="text-caption font-medium text-muted">Descripción</h2>
            <p className="mt-2 whitespace-pre-wrap">{ticket.description}</p>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          {sla && (
            <Card className="px-5 py-4">
              <SlaMeter label={sla.label} progress={sla.progress} />
            </Card>
          )}
          <Card>
            <dl className="divide-y divide-line text-caption">
              {details.map((item) => (
                <div
                  key={item.label}
                  className="flex justify-between gap-4 px-5 py-3"
                >
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
