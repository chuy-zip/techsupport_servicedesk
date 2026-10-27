import Form from "next/form";
import Link from "next/link";
import type { Priority } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { DropdownChevron, SelectField, dropdownClass } from "@/components/ui/select-field";
import { priorityNames } from "@/lib/tickets/labels";

export type Filters = {
  assigned: string;
  clients: string[];
  service: string;
  priority: string;
};

type Option = { id: string; name: string };

// Número de tickets en una pastilla oscura, para no confundirlo con el nombre del agente
function Count({ value }: { value: number }) {
  return (
    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-label font-semibold text-white tabular-nums">
      {value}
    </span>
  );
}

// Filtros en la URL: sobreviven al recargar, el botón de atrás los respeta y se pueden compartir
export function BoardFilters({
  filters,
  companies,
  services,
  agents,
  unassigned,
  showWorkload,
}: {
  filters: Filters;
  companies: (Option & { vip: boolean })[];
  services: { code: string; name: string }[];
  agents: (Option & { open: number })[];
  unassigned: number;
  showWorkload: boolean;
}) {
  const active = Boolean(filters.assigned || filters.clients.length || filters.service || filters.priority);
  const clientSummary =
    filters.clients.length === 0 ? "Todos" : filters.clients.length === 1 ? "1 seleccionado" : `${filters.clients.length} seleccionados`;

  return (
    <div className="mt-6 flex flex-col gap-3">
      {/* La llave rearma el formulario cuando el filtro cambia por un enlace */}
      <Form
        key={JSON.stringify(filters)}
        action="/tablero"
        className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-3"
      >
        <SelectField label="Asignación" name="asignados" defaultValue={filters.assigned}>
          <option value="">Todos</option>
          <option value="mios">Asignados a mí</option>
          {showWorkload && (
            <>
              <option value="ninguno">Sin asignar ({unassigned})</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.open})
                </option>
              ))}
            </>
          )}
        </SelectField>

        <div className="flex flex-col gap-1.5">
          <span className="text-caption font-medium text-muted">Clientes</span>
          <details className="relative">
            <summary className={`${dropdownClass} block min-w-40 cursor-pointer list-none`}>
              {clientSummary}
              <DropdownChevron />
            </summary>
            <fieldset className="absolute z-10 mt-1 flex w-64 flex-col gap-1 rounded-control border border-line bg-surface p-2 shadow-card">
              <legend className="sr-only">Clientes</legend>
              {companies.map((company) => (
                <label key={company.id} className="flex items-center gap-2 rounded-control px-2 py-1.5 text-caption hover:bg-canvas">
                  <input
                    type="checkbox"
                    name="cliente"
                    value={company.id}
                    defaultChecked={filters.clients.includes(company.id)}
                    className="accent-olive"
                  />
                  <span className="flex-1">{company.name}</span>
                  {company.vip && <span className="text-label font-semibold text-olive">VIP</span>}
                </label>
              ))}
            </fieldset>
          </details>
        </div>

        <SelectField label="Servicio" name="servicio" defaultValue={filters.service}>
          <option value="">Todos</option>
          {services.map((service) => (
            <option key={service.code} value={service.code}>
              {service.name}
            </option>
          ))}
        </SelectField>

        <SelectField label="Prioridad" name="prioridad" defaultValue={filters.priority}>
          <option value="">Todas</option>
          {(Object.keys(priorityNames) as Priority[]).map((priority) => (
            <option key={priority} value={priority}>
              {priority} {priorityNames[priority]}
            </option>
          ))}
        </SelectField>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary">
            Aplicar
          </Button>
          {active && (
            <Link href="/tablero" className="text-caption font-medium text-muted hover:text-ink">
              Limpiar filtros
            </Link>
          )}
        </div>
      </Form>

      {showWorkload && (
        <nav aria-label="Carga por agente" className="flex flex-wrap items-center gap-2 text-caption">
          <span className="text-muted">Pendientes por agente:</span>
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/tablero?asignados=${agent.id}`}
              className="inline-flex items-center rounded-full border border-line bg-surface py-0.5 pr-1 pl-3 transition-colors duration-150 hover:border-olive/50"
            >
              {agent.name}
              <Count value={agent.open} />
            </Link>
          ))}
          <Link
            href="/tablero?asignados=ninguno"
            className="inline-flex items-center rounded-full border border-line bg-surface py-0.5 pr-1 pl-3 transition-colors duration-150 hover:border-olive/50"
          >
            Sin asignar
            <Count value={unassigned} />
          </Link>
        </nav>
      )}
    </div>
  );
}
