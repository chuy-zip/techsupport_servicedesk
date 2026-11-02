import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import type { ProblemStatus } from "@/generated/prisma/client";
import { PriorityBadge, ProblemStatusBadge, StatusBadge } from "@/components/tickets/badges";
import { ActionForm } from "@/components/ui/action-form";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SelectField } from "@/components/ui/select-field";
import { TextArea, TextField } from "@/components/ui/text-field";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageProblems, problemTransitionLabel, problemTransitions } from "@/lib/problems";
import { formatDate, problemStatusNames } from "@/lib/tickets/labels";
import { assignProblem, changeProblemStatus, linkTicket, saveAnalysis, unlinkTicket } from "../actions";

export const metadata: Metadata = { title: "Problema" };

// El recorrido de la Fase 1, para mostrar en qué paso va
const FLOW: ProblemStatus[] = ["IDENTIFIED", "DIAGNOSING", "KNOWN_ERROR", "SOLUTION_PROPOSED", "CLOSED"];

export default function ProblemPage({ params }: PageProps<"/problemas/[number]">) {
  return (
    <Suspense fallback={<p className="text-muted">Cargando el problema…</p>}>
      <ProblemDetail params={params} />
    </Suspense>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <h3 className="text-caption font-semibold">{title}</h3>
      {children}
    </div>
  );
}

async function ProblemDetail({ params }: { params: PageProps<"/problemas/[number]">["params"] }) {
  await connection();
  const number = Number((await params).number);
  if (!Number.isInteger(number)) notFound();

  const user = await getCurrentUser();
  if (user.role === "CLIENT") redirect("/inicio");

  const problem = await db.problem.findUnique({
    where: { number },
    include: {
      service: true,
      owner: true,
      tickets: {
        include: { catalogItem: { include: { service: true } }, company: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!problem) notFound();

  const closed = problem.status === "CLOSED";
  const manages = canManageProblems(user) && !closed;
  const owners = manages
    ? (
        await db.user.findMany({
          where: { active: true, role: { in: ["AGENT", "SUPERVISOR", "ADMIN"] } },
          orderBy: [{ role: "asc" }, { supportLevel: "asc" }, { name: "asc" }],
        })
      ).filter(canManageProblems)
    : [];
  // Al cambiar el problema, los formularios se rearman con los valores nuevos
  const key = problem.updatedAt.getTime();
  const step = FLOW.indexOf(problem.status);

  const details = [
    { label: "Problema", value: `PRB-${problem.number}` },
    { label: "Servicio", value: problem.service?.name ?? "Varios servicios" },
    { label: "Responsable", value: problem.owner?.name ?? "Sin responsable" },
    { label: "Registrado", value: formatDate(problem.createdAt) },
    { label: "Actualizado", value: formatDate(problem.updatedAt) },
    ...(problem.closedAt ? [{ label: "Cerrado", value: formatDate(problem.closedAt) }] : []),
  ];

  return (
    <>
      <BackLink href="/problemas">Problemas</BackLink>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <Eyebrow>{problem.service?.name ?? "Varios servicios"}</Eyebrow>
          <h1 className="mt-2 font-display text-title leading-tight font-bold break-words">{problem.title}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <ProblemStatusBadge status={problem.status} />
          </div>

          <ol className="mt-6 grid grid-cols-5 gap-1.5 text-label font-semibold">
            {FLOW.map((status, index) => (
              <li key={status} aria-current={index === step ? "step" : undefined}>
                <div className={`h-1 rounded-full ${index <= step ? "bg-olive" : "bg-line"}`} />
                <p className={`mt-1.5 ${index === step ? "text-ink" : "text-muted"}`}>{problemStatusNames[status]}</p>
              </li>
            ))}
          </ol>

          <Card className="mt-6 px-6 py-5">
            <h2 className="text-caption font-medium text-muted">Qué se observa</h2>
            <p className="mt-2 whitespace-pre-wrap">{problem.description}</p>
          </Card>

          <Card key={key} className="mt-6 px-6 py-5">
            <h2 className="font-semibold">Análisis</h2>
            {manages ? (
              <ActionForm action={saveAnalysis} className="mt-3 flex flex-col gap-3">
                <input type="hidden" name="problemId" value={problem.id} />
                <TextArea
                  label="Causa raíz"
                  name="rootCause"
                  defaultValue={problem.rootCause ?? ""}
                  maxLength={4000}
                  hint="Por qué ocurre, no solo qué se ve. Se puede dejar vacía mientras se diagnostica."
                  className="[&_textarea]:min-h-24"
                />
                <TextArea
                  label="Workaround"
                  name="workaround"
                  defaultValue={problem.workaround ?? ""}
                  maxLength={4000}
                  hint="Lo que hace la mesa mientras no hay solución definitiva. Lo ven los agentes en cada ticket ligado."
                  className="[&_textarea]:min-h-24"
                />
                <Button type="submit" variant="secondary" className="self-start">
                  Guardar análisis
                </Button>
              </ActionForm>
            ) : (
              <dl className="mt-3 flex flex-col gap-4">
                <div>
                  <dt className="text-caption font-medium text-muted">Causa raíz</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{problem.rootCause ?? "Todavía en diagnóstico."}</dd>
                </div>
                <div>
                  <dt className="text-caption font-medium text-muted">Workaround</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{problem.workaround ?? "Todavía no hay uno documentado."}</dd>
                </div>
              </dl>
            )}
          </Card>

          <section className="mt-8">
            <h2 className="font-semibold">Incidentes ligados</h2>
            {problem.tickets.length === 0 ? (
              <p className="mt-2 text-caption text-muted">Todavía no hay incidentes ligados.</p>
            ) : (
              <Card className="mt-3">
                <ul className="divide-y divide-line">
                  {problem.tickets.map((ticket) => (
                    <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                      <Link href={`/tickets/${ticket.number}`} className="min-w-0 flex-1 hover:text-olive-dark">
                        <p className="text-caption text-muted tabular-nums">
                          #{ticket.number} · {ticket.catalogItem.code} · {ticket.company.name} · {formatDate(ticket.createdAt)}
                        </p>
                        <p className="truncate font-medium">{ticket.title}</p>
                      </Link>
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={ticket.priority} />
                        <StatusBadge status={ticket.status} />
                        {manages && (
                          <ActionForm action={unlinkTicket}>
                            <input type="hidden" name="problemId" value={problem.id} />
                            <input type="hidden" name="ticketId" value={ticket.id} />
                            <Button type="submit" variant="secondary">
                              Desligar
                            </Button>
                          </ActionForm>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {manages && (
              <ActionForm action={linkTicket} className="mt-4 flex flex-wrap items-end gap-2">
                <input type="hidden" name="problemId" value={problem.id} />
                <TextField
                  label="Ligar un incidente por su número"
                  name="ticketNumber"
                  type="number"
                  min={1}
                  required
                  placeholder="Por ejemplo, 12"
                  className="w-56"
                />
                <Button type="submit" variant="secondary">
                  Ligar
                </Button>
              </ActionForm>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <Card key={key} className="divide-y divide-line">
            <Block title="Estado">
              {closed ? (
                <p className="text-caption text-muted">Problema cerrado.</p>
              ) : !manages ? (
                <p className="text-caption text-muted">Lo gestionan agentes de nivel 2 o 3 y supervisión.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {problemTransitions[problem.status].map((to) => (
                    <ActionForm key={to} action={changeProblemStatus}>
                      <input type="hidden" name="problemId" value={problem.id} />
                      <input type="hidden" name="status" value={to} />
                      <Button type="submit" variant="secondary">
                        {problemTransitionLabel(problem.status, to)}
                      </Button>
                    </ActionForm>
                  ))}
                </div>
              )}
            </Block>
            {manages && (
              <Block title="Responsable">
                {user.role === "AGENT" ? (
                  problem.ownerId === user.id ? (
                    <p className="text-caption text-muted">Eres quien lo investiga.</p>
                  ) : (
                    <ActionForm action={assignProblem}>
                      <input type="hidden" name="problemId" value={problem.id} />
                      <input type="hidden" name="ownerId" value={user.id} />
                      <Button type="submit" variant="secondary">
                        Tomar problema
                      </Button>
                    </ActionForm>
                  )
                ) : (
                  <ActionForm action={assignProblem} className="flex flex-col gap-2">
                    <input type="hidden" name="problemId" value={problem.id} />
                    <SelectField label="Quién lo investiga" name="ownerId" defaultValue={problem.ownerId ?? ""}>
                      <option value="">Sin responsable</option>
                      {owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.name}
                        </option>
                      ))}
                    </SelectField>
                    <Button type="submit" variant="secondary" className="self-start">
                      Asignar
                    </Button>
                  </ActionForm>
                )}
              </Block>
            )}
          </Card>
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
