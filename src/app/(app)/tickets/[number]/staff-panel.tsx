import type { ReactNode } from "react";
import type { Impact, TicketStatus, Urgency } from "@/generated/prisma/client";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectField } from "@/components/ui/select-field";
import type { CurrentUser } from "@/lib/auth";
import { impactNames, urgencyNames } from "@/lib/tickets/labels";
import { APPROVER_ROLES, canEscalate, canHandle, canWork, transitionLabel, transitions } from "@/lib/tickets/workflow";
import { approve, assign, changeStatus, escalate, reclassify } from "./actions";

type PanelTicket = {
  id: string;
  status: TicketStatus;
  level: number;
  assigneeId: string | null;
  impact: Impact;
  urgency: Urgency;
  requiresApproval: boolean;
  approvedAt: Date | null;
  updatedAt: Date;
};

type Agent = { id: string; name: string; supportLevel: number | null };

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <h3 className="text-caption font-semibold">{title}</h3>
      {children}
    </div>
  );
}

// Controles del equipo de soporte. Las reglas se vuelven a validar en cada acción del servidor
export function StaffPanel({ ticket, user, agents }: { ticket: PanelTicket; user: CurrentUser; agents: Agent[] }) {
  const pendingApproval = ticket.requiresApproval && !ticket.approvedAt;
  const eligible = agents.filter((agent) => canHandle(agent.supportLevel, ticket.level));
  const closed = ticket.status === "CLOSED";
  const works = canWork(user, ticket.level);
  // Al cambiar el ticket, los formularios se rearman con los valores nuevos
  const key = ticket.updatedAt.getTime();

  return (
    <Card key={key} className="divide-y divide-line">
      <Block title="Estado">
        {pendingApproval && APPROVER_ROLES.includes(user.role) && (
          <ActionForm action={approve}>
            <input type="hidden" name="ticketId" value={ticket.id} />
            <Button type="submit" className="w-full">
              Aprobar solicitud
            </Button>
          </ActionForm>
        )}
        {transitions[ticket.status].length === 0 && <p className="text-caption text-muted">Ticket cerrado.</p>}
        {!works && (
          <p className="text-caption text-muted">
            Este ticket es de nivel {ticket.level}; lo atiende un agente de ese nivel o superior.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {works && transitions[ticket.status].map((to) => (
            <ActionForm key={to} action={changeStatus}>
              <input type="hidden" name="ticketId" value={ticket.id} />
              <input type="hidden" name="status" value={to} />
              <Button type="submit" variant="secondary">
                {transitionLabel(ticket.status, to)}
              </Button>
            </ActionForm>
          ))}
        </div>
      </Block>

      {!closed && (
        <Block title="Asignación">
          {user.role === "AGENT" ? (
            ticket.assigneeId === user.id ? (
              <ActionForm action={assign}>
                <input type="hidden" name="ticketId" value={ticket.id} />
                <input type="hidden" name="agentId" value="" />
                <Button type="submit" variant="secondary">
                  Soltar ticket
                </Button>
              </ActionForm>
            ) : works ? (
              <ActionForm action={assign}>
                <input type="hidden" name="ticketId" value={ticket.id} />
                <input type="hidden" name="agentId" value={user.id} />
                <Button type="submit" variant="secondary">
                  Tomar ticket
                </Button>
              </ActionForm>
            ) : (
              <p className="text-caption text-muted">Sin acciones disponibles para tu nivel.</p>
            )
          ) : (
            <ActionForm action={assign} className="flex flex-col gap-2">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <SelectField label="Agente" name="agentId" defaultValue={ticket.assigneeId ?? ""}>
                <option value="">Sin asignar</option>
                {eligible.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
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

      {works && canEscalate(ticket.status, ticket.level) && (
        <Block title="Escalamiento">
          <ActionForm action={escalate} className="flex items-end gap-2">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <SelectField label={`Nivel actual: ${ticket.level}`} name="level" defaultValue={ticket.level + 1} className="flex-1">
              {[2, 3]
                .filter((level) => level > ticket.level)
                .map((level) => (
                  <option key={level} value={level}>
                    Nivel {level}
                  </option>
                ))}
            </SelectField>
            <Button type="submit" variant="secondary">
              Escalar
            </Button>
          </ActionForm>
        </Block>
      )}

      {works && !closed && (
        <Block title="Clasificación">
          <ActionForm action={reclassify} className="flex flex-col gap-2">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <div className="grid grid-cols-2 gap-2">
              <SelectField label="Impacto" name="impact" defaultValue={ticket.impact}>
                {(["HIGH", "MEDIUM", "LOW"] as const).map((value) => (
                  <option key={value} value={value}>
                    {impactNames[value]}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Urgencia" name="urgency" defaultValue={ticket.urgency}>
                {(["HIGH", "MEDIUM", "LOW"] as const).map((value) => (
                  <option key={value} value={value}>
                    {urgencyNames[value]}
                  </option>
                ))}
              </SelectField>
            </div>
            <Button type="submit" variant="secondary" className="self-start">
              Reclasificar
            </Button>
          </ActionForm>
        </Block>
      )}
    </Card>
  );
}
