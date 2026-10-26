import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PriorityBadge } from "@/components/tickets/badges";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCatalogFor } from "@/lib/tickets/data";
import { NewTicketForm, type FormService } from "./new-ticket-form";

export const metadata: Metadata = { title: "Reportar un problema" };

export default function NewTicketPage() {
  return (
    <>
      <BackLink href="/inicio">Mis tickets</BackLink>
      <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_17rem]">
        <div className="min-w-0">
          <Eyebrow>Nuevo ticket</Eyebrow>
          <h1 className="mt-2 font-display text-title leading-tight font-bold">Reportar un problema o pedir un servicio</h1>
          <p className="mt-3 text-muted">Elige el servicio y lo que pasa. La prioridad se calcula con tus respuestas.</p>
          <Suspense fallback={<p className="mt-8 text-muted">Cargando el catálogo…</p>}>
            <Form />
          </Suspense>
        </div>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Suspense>
            <PriorityGuide />
          </Suspense>
        </aside>
      </div>
    </>
  );
}

async function Form() {
  const user = await getCurrentUser();
  if (user.role !== "CLIENT" || !user.clientTypeCode) {
    return <p className="mt-8 text-muted">Los tickets se reportan desde una cuenta de cliente.</p>;
  }

  const catalog = await getCatalogFor(user.clientTypeCode);

  // Solo lo que el formulario necesita mostrar
  const services: FormService[] = catalog.map((service) => ({
    code: service.code,
    name: service.name,
    description: service.description,
    kind: service.kind,
    items: service.items.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      type: item.type,
      approvalQuestion: item.approvalQuestion,
      defaultImpact: item.defaultImpact,
      defaultUrgency: item.defaultUrgency,
    })),
  }));

  return <NewTicketForm services={services} />;
}

// Explica con los datos reales de la cuenta cómo se va a priorizar el reporte
async function PriorityGuide() {
  const user = await getCurrentUser();
  if (!user.clientTypeCode) return null;

  const [clientType, levels] = await Promise.all([
    db.clientType.findUnique({ where: { code: user.clientTypeCode } }),
    db.priorityLevel.findMany({ orderBy: { priority: "asc" } }),
  ]);
  if (!clientType) return null;

  const visible = clientType.minPriority
    ? levels.filter((level) => level.priority <= clientType.minPriority!)
    : levels;

  return (
    <Card className="px-5 py-5">
      <h2 className="font-semibold">Cómo se prioriza</h2>
      <p className="mt-2 text-caption text-muted">
        Servicio, alcance y urgencia definen la prioridad. Lo que no puede esperar se atiende primero.
      </p>
      <p className="mt-4 text-caption">
        Tu empresa es cliente <span className="font-semibold">{clientType.name}</span>.{" "}
        {clientType.minPriority
          ? `Tus reportes nunca quedan por debajo de ${clientType.minPriority}, y se atienden a toda hora.`
          : "Se atienden de lunes a viernes de 07:00 a 19:00."}
      </p>
      <dl className="mt-4 divide-y divide-line border-t border-line text-caption">
        {visible.map((level) => (
          <div key={level.priority} className="flex items-center justify-between gap-3 py-2.5">
            <dt>
              <PriorityBadge priority={level.priority} />
            </dt>
            <dd className="text-right text-muted">
              {level.responseMinutes === null ? level.responseLabel : `Respuesta en ${level.responseLabel}`}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
