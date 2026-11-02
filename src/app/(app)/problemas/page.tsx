import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProblemStatusBadge } from "@/components/tickets/badges";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SelectField } from "@/components/ui/select-field";
import { TextArea, TextField } from "@/components/ui/text-field";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageProblems } from "@/lib/problems";
import { formatDate } from "@/lib/tickets/labels";
import { createProblem } from "./actions";

export const metadata: Metadata = { title: "Problemas" };

// Ventana y umbral para avisar de incidentes que se repiten y todavía no tienen un problema
const SIGNAL_DAYS = 30;
const SIGNAL_MIN = 2;

export default function ProblemsPage() {
  return (
    <>
      <Eyebrow>Gestión de problemas</Eyebrow>
      <h1 className="mt-2 font-display text-title leading-tight font-bold">Problemas</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Un problema es la causa raíz detrás de varios incidentes. Se investiga aparte para que los incidentes dejen de
        repetirse, y mientras tanto la mesa usa su workaround.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Cargando…</p>}>
        <Problems />
      </Suspense>
    </>
  );
}

async function Problems() {
  await connection();
  const user = await getCurrentUser();
  if (user.role === "CLIENT") redirect("/inicio");
  const manages = canManageProblems(user);

  const now = new Date();
  const since = new Date(now.getTime() - SIGNAL_DAYS * 24 * 60 * 60_000);
  const [problems, services, recurring] = await Promise.all([
    db.problem.findMany({
      include: { service: true, owner: true, _count: { select: { tickets: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.service.findMany({ orderBy: { sortOrder: "asc" } }),
    // Gestión proactiva: el mismo incidente varias veces, sin un problema que lo explique
    db.ticket.groupBy({
      by: ["catalogItemId"],
      where: { type: "INCIDENT", problemId: null, createdAt: { gte: since } },
      _count: true,
      having: { catalogItemId: { _count: { gte: SIGNAL_MIN } } },
    }),
  ]);
  const signalItems = await db.catalogItem.findMany({
    where: { id: { in: recurring.map((row) => row.catalogItemId) } },
    include: { service: true },
  });
  const signals = recurring
    .map((row) => ({ item: signalItems.find((item) => item.id === row.catalogItemId)!, count: row._count }))
    .sort((a, b) => b.count - a.count);

  // Los abiertos primero; los cerrados quedan como referencia
  const sorted = [...problems].sort((a, b) => Number(a.status === "CLOSED") - Number(b.status === "CLOSED"));

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0">
        {sorted.length === 0 ? (
          <Card className="px-6 py-10 text-center">
            <p className="font-medium">Todavía no hay problemas registrados.</p>
            <p className="mt-1 text-muted">Cuando varios incidentes compartan una causa, regístrala aquí.</p>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {sorted.map((problem) => (
                <li key={problem.id}>
                  <Link
                    href={`/problemas/${problem.number}`}
                    className="flex flex-col gap-2 px-5 py-4 transition-colors duration-150 hover:bg-canvas"
                  >
                    <p className="text-caption text-muted tabular-nums">
                      PRB-{problem.number} · {problem.service?.name ?? "Varios servicios"} · {formatDate(problem.updatedAt)}
                    </p>
                    <p className="font-medium">{problem.title}</p>
                    <div className="flex flex-wrap items-center gap-2 text-caption">
                      <ProblemStatusBadge status={problem.status} />
                      <span className="text-muted">
                        {problem._count.tickets} {problem._count.tickets === 1 ? "incidente" : "incidentes"} ·{" "}
                        {problem.owner?.name ?? "Sin responsable"}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <aside className="flex flex-col gap-4">
        <Card className="px-5 py-4">
          <h2 className="text-caption font-semibold">Incidentes que se repiten</h2>
          <p className="mt-1 text-caption text-muted">
            {SIGNAL_MIN} o más en los últimos {SIGNAL_DAYS} días, sin un problema ligado.
          </p>
          {signals.length === 0 ? (
            <p className="mt-3 text-caption text-muted">Ninguno por ahora.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-caption">
              {signals.map(({ item, count }) => (
                <li key={item.id}>
                  <Link
                    href={`/tablero?servicio=${item.service.code}`}
                    className="flex justify-between gap-3 hover:text-olive-dark"
                  >
                    <span>
                      <span className="text-muted">{item.code}</span> {item.name}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {manages ? (
          <Card className="px-5 py-4">
            <h2 className="text-caption font-semibold">Registrar un problema</h2>
            <ActionForm action={createProblem} className="mt-3 flex flex-col gap-3">
              <TextField label="Título" name="title" required minLength={5} maxLength={120} />
              <TextArea
                label="Qué se observa"
                name="description"
                required
                maxLength={4000}
                hint="Los síntomas y desde cuándo. La causa se documenta después."
                className="[&_textarea]:min-h-24"
              />
              <SelectField label="Servicio" name="serviceId" defaultValue="">
                <option value="">Varios servicios</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </SelectField>
              <Button type="submit" className="self-start">
                Registrar
              </Button>
            </ActionForm>
          </Card>
        ) : (
          <p className="text-caption text-muted">
            Los problemas los registran y gestionan agentes de nivel 2 o 3 y supervisión. Desde aquí puedes consultar sus
            workarounds.
          </p>
        )}
      </aside>
    </div>
  );
}
