"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import type { Impact, ServiceKind, TicketType, Urgency } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Choice, ChoiceGroup } from "@/components/ui/choice";
import { TextArea, TextField } from "@/components/ui/text-field";
import { impactOptions, serviceKindNames, typeNames, urgencyOptions } from "@/lib/tickets/labels";
import { createTicket, type CreateTicketState } from "./actions";

export type FormService = {
  code: string;
  name: string;
  description: string;
  kind: ServiceKind;
  items: {
    id: string;
    code: string;
    name: string;
    type: TicketType;
    approvalQuestion: string | null;
    defaultImpact: Impact;
    defaultUrgency: Urgency;
  }[];
};

const kindChips: Record<ServiceKind, { label: string; className: string }> = {
  CORE: { label: "Núcleo", className: "bg-olive text-white" },
  SUPPORT: { label: "Soporte", className: "border border-line text-muted" },
  ATTENTION: { label: "Atención", className: "border border-line text-muted" },
};

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-6">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="mt-1 text-caption text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function NewTicketForm({ services }: { services: FormService[] }) {
  const [state, action, pending] = useActionState(createTicket, undefined);

  const [serviceCode, setServiceCode] = useState<string>();
  const [itemId, setItemId] = useState<string>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState<Impact>();
  const [urgency, setUrgency] = useState<Urgency>();
  const [approval, setApproval] = useState<string>();

  // Un error deja de mostrarse en cuanto el usuario cambia ese campo
  const [edited, setEdited] = useState<{ state: CreateTicketState; fields: Set<string> }>({ state, fields: new Set() });
  if (edited.state !== state) setEdited({ state, fields: new Set() });
  const errors: Partial<Record<string, string>> = Object.fromEntries(
    Object.entries(state?.errors ?? {}).filter(([field]) => !edited.fields.has(field)),
  );
  const touch = (field: string) =>
    setEdited((current) => ({ ...current, fields: new Set(current.fields).add(field) }));

  // Next conserva oculta la página al navegar; al salir se descarta el borrador para no reenviar un ticket ya creado
  useEffect(
    () => () => {
      setServiceCode(undefined);
      setItemId(undefined);
      setTitle("");
      setDescription("");
      setImpact(undefined);
      setUrgency(undefined);
      setApproval(undefined);
    },
    [],
  );

  const service = services.find((s) => s.code === serviceCode);
  const item = service?.items.find((i) => i.id === itemId);

  function chooseItem(id: string) {
    const next = service?.items.find((i) => i.id === id);
    setItemId(id);
    touch("catalogItemId");
    // Valores sugeridos para el caso típico; el usuario puede cambiarlos
    setImpact(next?.defaultImpact);
    setUrgency(next?.defaultUrgency);
    setApproval(undefined);
  }

  return (
    <form action={action} className="mt-8 flex flex-col gap-8">
      <Section
        title="¿Qué servicio está involucrado?"
        hint="Los servicios núcleo son los que, si fallan, impiden trabajar a todos. Los de soporte complementan."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {services.map((s) => (
            <Choice
              key={s.code}
              name="service"
              value={s.code}
              checked={serviceCode === s.code}
              onChange={() => {
                setServiceCode(s.code);
                setItemId(undefined);
              }}
              title={s.name}
              description={s.description}
              aside={
                <span
                  className={`rounded-full px-2 py-0.5 text-label font-semibold whitespace-nowrap ${kindChips[s.kind].className}`}
                  title={serviceKindNames[s.kind]}
                >
                  {kindChips[s.kind].label}
                </span>
              }
            />
          ))}
        </div>
      </Section>

      {service && (
        <Section title="¿Qué está pasando?">
          <ChoiceGroup legend={service.name} error={errors.catalogItemId}>
            {service.items.map((i) => (
              <Choice
                key={i.id}
                name="catalogItemId"
                value={i.id}
                checked={itemId === i.id}
                onChange={() => chooseItem(i.id)}
                title={i.name}
                description={`${typeNames[i.type]} · ${i.code}`}
              />
            ))}
          </ChoiceGroup>
        </Section>
      )}

      {item && (
        <>
          <Section title="Detalles">
            <TextField
              label="Título"
              name="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                touch("title");
              }}
              placeholder="Ej. No puedo iniciar sesión desde esta mañana"
              maxLength={120}
              error={errors.title}
            />
            <TextArea
              label="Descripción"
              name="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                touch("description");
              }}
              hint="Qué intentabas hacer, qué pasó y desde cuándo."
              maxLength={4000}
              error={errors.description}
            />
          </Section>

          {item.type === "INCIDENT" && (
            <Section title="Alcance">
              <ChoiceGroup legend="¿A quiénes afecta?" error={errors.impact}>
                {impactOptions.map((o) => (
                  <Choice
                    key={o.value}
                    name="impact"
                    value={o.value}
                    checked={impact === o.value}
                    onChange={() => {
                      setImpact(o.value);
                      touch("impact");
                    }}
                    title={o.label}
                  />
                ))}
              </ChoiceGroup>
              <ChoiceGroup legend="¿Qué pasa si se espera?" error={errors.urgency}>
                {urgencyOptions.map((o) => (
                  <Choice
                    key={o.value}
                    name="urgency"
                    value={o.value}
                    checked={urgency === o.value}
                    onChange={() => {
                      setUrgency(o.value);
                      touch("urgency");
                    }}
                    title={o.label}
                  />
                ))}
              </ChoiceGroup>
            </Section>
          )}

          {item.approvalQuestion && (
            <Section title="Autorización">
              <ChoiceGroup legend={item.approvalQuestion} error={errors.approval}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Choice
                    name="approval"
                    value="yes"
                    checked={approval === "yes"}
                    onChange={() => {
                      setApproval("yes");
                      touch("approval");
                    }}
                    title="Sí"
                    description="Supervisión debe autorizarla antes de atenderla."
                  />
                  <Choice
                    name="approval"
                    value="no"
                    checked={approval === "no"}
                    onChange={() => {
                      setApproval("no");
                      touch("approval");
                    }}
                    title="No"
                  />
                </div>
              </ChoiceGroup>
            </Section>
          )}

          <div className="border-t border-line pt-6">
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando…" : "Enviar reporte"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
