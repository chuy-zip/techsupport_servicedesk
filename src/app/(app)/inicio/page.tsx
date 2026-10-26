import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PriorityBadge, StatusBadge } from "@/components/tickets/badges";
import { SlaMeter } from "@/components/tickets/sla-meter";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentSla } from "@/lib/tickets/data";
import { formatDate } from "@/lib/tickets/labels";

export const metadata: Metadata = { title: "Inicio" };

export default function InicioPage() {
  return (
    <Suspense fallback={<p className="text-muted">Cargando…</p>}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const user = await getCurrentUser();
  // El personal trabaja desde el tablero
  if (user.role !== "CLIENT") redirect("/tablero");
  return <ClientHome user={user} />;
}

async function ClientHome({ user }: { user: CurrentUser }) {
  await connection();
  const now = new Date();
  const tickets = await db.ticket.findMany({
    where: { requesterId: user.id },
    orderBy: { createdAt: "desc" },
    include: { catalogItem: { include: { service: true } }, company: { include: { clientType: true } } },
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>{user.companyName}</Eyebrow>
          <h1 className="mt-2 font-display text-title leading-tight font-bold">Mis tickets</h1>
        </div>
        <ButtonLink href="/tickets/nuevo">Reportar un problema</ButtonLink>
      </div>

      {tickets.length === 0 ? (
        <Card className="mt-8 px-6 py-10 text-center">
          <p className="font-medium">Todavía no has reportado nada.</p>
          <p className="mt-1 text-muted">Cuando algo falle o necesites un servicio, repórtalo aquí y sigue su avance.</p>
        </Card>
      ) : (
        <Card className="mt-8">
          <ul className="divide-y divide-line">
            {tickets.map((ticket) => {
              const sla = currentSla(ticket, ticket.company.clientType, now);
              return (
                <li key={ticket.id}>
                  <Link
                    href={`/tickets/${ticket.number}`}
                    className="grid gap-3 px-5 py-4 transition-colors duration-150 hover:bg-canvas sm:grid-cols-[1fr_14rem] sm:gap-8"
                  >
                    <div className="min-w-0">
                      <p className="text-caption text-muted tabular-nums">
                        #{ticket.number} · {ticket.catalogItem.service.name} · {formatDate(ticket.createdAt)}
                      </p>
                      <p className="mt-0.5 truncate font-medium">{ticket.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <PriorityBadge priority={ticket.priority} />
                        <StatusBadge status={ticket.status} />
                      </div>
                    </div>
                    {sla && <SlaMeter label={sla.label} progress={sla.progress} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
