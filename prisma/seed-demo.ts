// Datos de demostración: tickets en todos los estados, con historial y comentarios, para mostrar el sistema.
// No corre en el pipeline. Se ejecuta a mano y siempre vuelve al mismo punto de partida:
//
//   npm run seed:demo                  muestra qué haría en la base de desarrollo, sin cambiar nada
//   npm run seed:demo -- --yes         lo ejecuta en desarrollo
//   npm run seed:demo -- --prod        muestra qué haría en producción, sin cambiar nada
//   npm run seed:demo -- --prod --yes  lo ejecuta en producción
//
// Borra todos los tickets, comentarios, historial y problemas, y los vuelve a crear. Los tiempos se calculan
// respecto a "ahora", así que conviene correrlo poco antes de una demostración para que los plazos estén vivos.
// Necesita las reglas y los usuarios: en desarrollo, `npx prisma db seed`; en producción los carga el pipeline.

import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  PrismaClient,
  type CommentKind,
  type Impact,
  type Priority,
  type TicketEventKind,
  type TicketStatus,
  type Urgency,
  type User,
} from "../src/generated/prisma/client";
import { classifyFrom } from "../src/lib/tickets/classify";
import {
  APPROVAL_NOTE,
  ESCALATION_NOTE,
  canEscalate,
  canHandle,
  canTransition,
  statusNote,
} from "../src/lib/tickets/workflow";

config({ path: ".env.local", quiet: true });

const args = new Set(process.argv.slice(2));
const prod = args.has("--prod");
const confirmed = args.has("--yes");

const url = prod ? process.env.DIRECT_URL_PROD : process.env.DIRECT_URL;
if (!url) {
  throw new Error(prod ? "Falta DIRECT_URL_PROD en .env.local." : "Falta DIRECT_URL en .env.local.");
}
const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });

// ---------------------------------------------------------------------------
// Personas y empresas
// ---------------------------------------------------------------------------

const staffEmails = {
  n1: "agente.n1@servicedesk.demo",
  n2: "agente.n2@servicedesk.demo",
  n3: "agente.n3@servicedesk.demo",
  sup: "supervisor@servicedesk.demo",
  admin: "admin@servicedesk.demo",
};

const companyClients = {
  ALT: { company: "Comercial Altamira", email: "cliente.vip@altamira.demo" },
  QUE: { company: "Grupo Quetzal", email: "cliente.vip@quetzal.demo" },
  ROB: { company: "Distribuidora El Roble", email: "cliente.normal@elroble.demo" },
  UNI: { company: "Ferretería La Unión", email: "cliente.normal@launion.demo" },
};

type Who = keyof typeof staffEmails | "client";
type Company = keyof typeof companyClients;

// ---------------------------------------------------------------------------
// Guion de cada ticket. Cada paso ocurre "at" minutos después de crearse
// ---------------------------------------------------------------------------

type Step =
  | { at: number; do: "assign"; by: Who; to: Who | null }
  | { at: number; do: "start"; by: Who }
  | { at: number; do: "escalate"; by: Who; level: 2 | 3; note: string }
  | { at: number; do: "resolve"; by: Who; note: string }
  | { at: number; do: "reopen"; by: Who; note: string }
  | { at: number; do: "close"; by: Who; note: string }
  | { at: number; do: "ask"; by: Who; note: string }
  | { at: number; do: "approve"; by: Who }
  | { at: number; do: "category"; by: Who; item: string }
  | { at: number; do: "comment"; by: Who; body: string; internal?: boolean };

const assign = (at: number, by: Who, to: Who | null): Step => ({ at, do: "assign", by, to });
const start = (at: number, by: Who): Step => ({ at, do: "start", by });
const escalate = (at: number, by: Who, level: 2 | 3, note: string): Step => ({ at, do: "escalate", by, level, note });
const resolve = (at: number, by: Who, note: string): Step => ({ at, do: "resolve", by, note });
const reopen = (at: number, by: Who, note: string): Step => ({ at, do: "reopen", by, note });
const close = (at: number, by: Who, note: string): Step => ({ at, do: "close", by, note });
const ask = (at: number, by: Who, note: string): Step => ({ at, do: "ask", by, note });
const approve = (at: number, by: Who): Step => ({ at, do: "approve", by });
const category = (at: number, by: Who, item: string): Step => ({ at, do: "category", by, item });
const say = (at: number, by: Who, body: string, internal = false): Step => ({ at, do: "comment", by, body, internal });

type Spec = {
  age: number; // minutos desde que se creó
  company: Company;
  item: string; // código del catálogo
  title: string;
  description: string;
  tags?: string[];
  impact?: Impact; // solo incidentes; si falta, el valor típico del elemento
  urgency?: Urgency;
  approval?: boolean; // respuesta a la pregunta de autorización del elemento
  steps?: Step[];
};

const HOUR = 60;
const DAY = 24 * HOUR;

const specs: Spec[] = [
  // Cerrados, de días atrás: sirven de historia y para las estadísticas
  {
    age: 7 * DAY, company: "UNI", item: "I-8", tags: ["lista", "portal"],
    title: "La lista de tickets no carga",
    description: "Al entrar al portal, la lista de tickets se queda en blanco para todo el equipo de la sucursal.",
    steps: [
      assign(5, "n1", "n1"), start(8, "n1"),
      say(20, "n1", "Reproducimos el problema con otra cuenta; lo vamos a escalar."),
      escalate(30, "n1", 2, "No se reproduce con datos de prueba; parece un fallo de la aplicación."),
      assign(32, "sup", "n2"),
      resolve(95, "n2", "Se reinició el servicio que arma la lista y se vació su caché. Ya carga con normalidad."),
      close(600, "sup", "El cliente confirmó por correo que la lista carga."),
    ],
  },
  {
    age: 6 * DAY, company: "ROB", item: "S-2",
    title: "Cerrar un ticket que ingresamos por error",
    description: "Creamos dos veces el mismo reporte. Necesitamos cerrar el duplicado.",
    steps: [
      assign(300, "n1", "n1"), start(305, "n1"),
      say(310, "client", "Es el que tiene el título repetido, el más reciente."),
      resolve(320, "n1", "Se cerró el duplicado y se dejó abierto el original."),
      close(340, "n1", "El cliente confirmó por correo."),
    ],
  },
  {
    age: 5 * DAY, company: "UNI", item: "I-6", tags: ["login"],
    title: "Una persona de bodega no puede iniciar sesión",
    description: "Desde el lunes no puede entrar. Los demás compañeros sí pueden.",
    steps: [
      assign(60, "n1", "n1"), start(65, "n1"),
      say(70, "n1", "¿Puedes confirmarnos el correo con el que intenta entrar?"),
      say(95, "client", "Es el que termina en @launion.demo."),
      resolve(130, "n1", "Se restableció la contraseña de la cuenta y se le envió el enlace para crear una nueva."),
      close(400, "n1", "Confirmó por teléfono que ya entra."),
    ],
  },
  {
    age: 4 * DAY, company: "ALT", item: "I-4",
    title: "Un analista no puede cerrar un ticket",
    description: "Al intentar cerrar un ticket resuelto, la pantalla no deja confirmar el cierre.",
    steps: [
      assign(10, "n1", "n1"), start(12, "n1"),
      resolve(80, "n1", "Se corrigió el permiso del rol de analista para cerrar tickets."),
      say(380, "client", "Apareció el problema otra vez con otro analista."),
      reopen(400, "n1", "El cliente indica que el problema apareció otra vez con otro analista."),
      resolve(440, "n1", "Se corrigió también el permiso heredado del grupo de analistas."),
      close(700, "sup", "El cliente confirmó por teléfono que ya puede cerrar tickets."),
    ],
  },
  {
    age: 3 * DAY, company: "QUE", item: "I-5", tags: ["portal", "acceso"],
    title: "Nadie puede iniciar sesión en el portal",
    description: "Ninguna persona de nuestra empresa puede entrar desde hace unos minutos.",
    steps: [
      assign(3, "n1", "n1"), start(5, "n1"),
      escalate(25, "n1", 3, "La falla es del servicio de autenticación; requiere al equipo de plataforma."),
      assign(27, "sup", "n3"),
      say(35, "n3", "Detectamos el servicio detenido. Estamos reiniciándolo."),
      resolve(70, "n3", "Se reinició el servicio de autenticación y se restableció el acceso."),
      close(400, "sup", "El cliente confirmó por correo que ya todos pueden entrar."),
    ],
  },
  {
    age: 2 * DAY, company: "ALT", item: "I-1",
    title: "Nos respondieron después de 2 horas",
    description: "Reportamos una falla anoche y la primera respuesta tardó más de dos horas.",
    steps: [
      assign(170, "sup", "n1"), start(175, "n1"),
      say(176, "sup", "Revisar la cobertura de la guardia de VIP en ese horario.", true),
      resolve(200, "n1", "Se ajustó la guardia de clientes VIP para cubrir ese horario."),
      close(500, "sup", "El cliente confirmó por correo."),
    ],
  },
  {
    age: 2 * DAY, company: "QUE", item: "I-11", tags: ["reporte", "error 500"],
    title: "El reporte de resolución da error 500",
    description: "Al generar el reporte de tiempo de resolución del mes completo aparece un error 500.",
    steps: [
      assign(20, "n1", "n1"), start(22, "n1"),
      say(40, "n1", "Reproducimos el error cuando el rango de fechas pasa de dos semanas."),
      resolve(90, "n1", "Se corrigió la consulta que fallaba con rangos largos."),
      close(300, "n1", "El cliente generó el reporte sin errores y lo confirmó por correo."),
    ],
  },
  // Resueltos, esperando que el cliente confirme
  {
    age: DAY, company: "ROB", item: "I-6", tags: ["login"],
    title: "No puedo entrar con mi usuario desde esta mañana",
    description: "Al iniciar sesión me dice que la contraseña es incorrecta, pero mis compañeros sí pueden entrar.",
    steps: [
      assign(300, "n1", "n1"), start(305, "n1"),
      say(306, "n1", "Estamos revisando el estado de tu cuenta."),
      resolve(600, "n1", "Se restableció el acceso de la cuenta. ¿Puedes confirmarnos que ya entras?"),
    ],
  },
  {
    age: 5 * HOUR, company: "ALT", item: "S-5",
    title: "Cambiar el horario de atención de nuestra sede norte",
    description: "Queremos que la sede norte se atienda en el mismo horario que la sede central.",
    steps: [
      assign(15, "n1", "n1"), start(20, "n1"),
      resolve(200, "n1", "Se registró el nuevo horario de atención y quedó vigente desde hoy."),
    ],
  },
  // En progreso
  {
    age: 3 * DAY, company: "UNI", item: "S-1", tags: ["uptime"],
    title: "Reporte de uptime del último mes",
    description: "Necesitamos el reporte de disponibilidad del servicio de todo el mes pasado para una auditoría.",
    steps: [
      assign(400, "n1", "n1"), start(410, "n1"),
      say(420, "n1", "Estamos consolidando los datos de disponibilidad; te lo enviamos esta semana."),
    ],
  },
  {
    age: DAY, company: "ROB", item: "I-9", tags: ["excel", "carga lenta"],
    title: "La carga de Excel se queda procesando",
    description: "Subimos el archivo con los tickets del mes y lleva horas en procesando.",
    steps: [
      assign(60, "n1", "n1"), start(65, "n1"),
      say(70, "client", "El archivo tiene unas 3000 filas."),
      say(75, "n1", "Revisar la cola de descartes por si hay filas con formato inválido.", true),
      say(80, "n1", "Estamos revisando la cola de procesamiento y te avisamos en cuanto avance."),
    ],
  },
  {
    age: 400, company: "ROB", item: "I-13", tags: ["usuarios", "baja"],
    impact: "LOW", urgency: "MEDIUM",
    title: "Necesitamos dar de baja a un usuario que ya no trabaja con nosotros",
    description: "Una persona con permisos de administración dejó la empresa y su cuenta debe darse de baja hoy.",
    steps: [
      assign(50, "n1", "n1"), start(55, "n1"),
      ask(90, "n1", "Es una baja de un usuario con permisos de administración; confirmar que quien la pide tiene autoridad."),
    ],
  },
  {
    age: 200, company: "UNI", item: "I-13", tags: ["login", "correo"],
    title: "No nos llegan los correos para restablecer la contraseña",
    description: "Las personas que piden restablecer su contraseña no reciben el correo con el enlace.",
    steps: [
      assign(20, "n1", "n1"),
      category(25, "n1", "I-6"),
      start(30, "n1"),
      say(35, "n1", "Lo reclasificamos como un problema de acceso de usuario y lo estamos revisando."),
    ],
  },
  {
    age: 180, company: "ALT", item: "I-12", tags: ["cola"],
    title: "La cola de procesamiento acumula trabajos",
    description: "Vemos cada vez más trabajos pendientes en la cola y varios descartados.",
    steps: [
      assign(8, "n1", "n1"), start(10, "n1"),
      escalate(14, "n1", 3, "La cola de procesamiento es responsabilidad del equipo de plataforma."),
      assign(16, "sup", "n3"), start(18, "n3"),
      say(30, "n3", "Detectamos un pico de trabajos descartados; estamos reprocesándolos."),
    ],
  },
  {
    age: 100, company: "QUE", item: "I-3", tags: ["reporte"],
    title: "El reporte no se exporta con toda la data",
    description: "Al exportar el reporte semanal faltan las filas de los últimos dos días.",
    steps: [
      assign(8, "n1", "n1"), start(10, "n1"),
      say(25, "n1", "Comparar el conteo del reporte contra la base antes de responder.", true),
      say(30, "n1", "Estamos comparando el reporte contra los datos originales para ubicar las filas que faltan."),
    ],
  },
  {
    age: 60, company: "ALT", item: "S-3", approval: true, tags: ["usuarios", "alta"],
    title: "Alta de un usuario para el área de contabilidad",
    description: "Necesitamos una cuenta nueva para una persona que entra a contabilidad el lunes.",
    steps: [
      assign(5, "n1", "n1"),
      approve(20, "sup"),
      start(25, "n1"),
    ],
  },
  // Escalados
  {
    age: 5 * HOUR, company: "QUE", item: "I-10", tags: ["excel"],
    title: "Faltan tickets después de una carga de Excel",
    description: "Cargamos 500 tickets y solo aparecen 430 en el sistema.",
    steps: [
      assign(10, "n1", "n1"), start(12, "n1"),
      escalate(120, "n1", 3, "Hay filas descartadas por la cola; es un tema de infraestructura."),
      assign(125, "sup", "n3"),
      say(140, "n3", "Revisando la cola de descartes para recuperar las filas.", true),
    ],
  },
  {
    age: 150, company: "ALT", item: "I-8", tags: ["lista", "portal"],
    title: "La lista de tickets no carga a la mitad del equipo",
    description: "A la mitad de las personas les aparece la lista vacía; a la otra mitad sí les carga.",
    steps: [
      assign(4, "n1", "n1"), start(6, "n1"),
      escalate(60, "n1", 2, "No se reproduce en la mesa; parece un fallo de la aplicación."),
      assign(62, "sup", "n2"),
      say(80, "n2", "Estamos revisando los registros del servicio para ubicar la causa."),
    ],
  },
  // Abiertos
  {
    // Seis días sin atender: suficientes horas de atención para que venza aunque se corra en fin de semana
    age: 6 * DAY, company: "ROB", item: "I-6", tags: ["login"],
    title: "Un usuario no puede iniciar sesión",
    description: "Una persona del área de ventas no puede entrar desde hace varios días.",
  },
  {
    age: 90, company: "UNI", item: "I-11", tags: ["reporte"],
    title: "El reporte semanal no carga",
    description: "Al abrir el reporte semanal la pantalla se queda cargando.",
  },
  {
    age: 40, company: "ALT", item: "S-3", approval: true, tags: ["usuarios", "admin"],
    title: "Alta de un administrador para el área de finanzas",
    description: "Necesitamos dar de alta a una persona nueva con rol de administración para finanzas.",
  },
  {
    age: 30, company: "QUE", item: "I-13",
    title: "Necesitamos cambiar el correo de varios usuarios",
    description: "Cambiamos de dominio de correo y hay que actualizar el de unas veinte cuentas.",
  },
  {
    age: 25, company: "QUE", item: "I-9", tags: ["excel"],
    title: "La carga de Excel no termina",
    description: "El archivo de tickets lleva un rato en procesando y no avanza.",
  },
  {
    age: 12, company: "ALT", item: "I-7", tags: ["portal"],
    title: "No podemos crear tickets desde el portal",
    description: "Al enviar el formulario de un ticket nuevo aparece un error y no se crea.",
  },
];

// ---------------------------------------------------------------------------
// Simulación: aplica las mismas reglas que las acciones de la aplicación y falla si el guion las rompe
// ---------------------------------------------------------------------------

type Loaded = Awaited<ReturnType<typeof load>>;

async function load() {
  const [clientTypes, companies, users, items, rules, levels] = await Promise.all([
    db.clientType.findMany(),
    db.company.findMany(),
    db.user.findMany(),
    db.catalogItem.findMany(),
    db.priorityRule.findMany(),
    db.priorityLevel.findMany(),
  ]);
  return { clientTypes, companies, users, items, rules, levels };
}

function build(spec: Spec, data: Loaded, now: Date) {
  const need = <T>(value: T | undefined, what: string): T => {
    if (value === undefined) throw new Error(`Falta ${what}. Corre primero las reglas y los usuarios (npx prisma db seed).`);
    return value;
  };
  const created = new Date(now.getTime() - spec.age * 60_000);
  const at = (minutes: number) => new Date(created.getTime() + minutes * 60_000);

  const client = companyClients[spec.company];
  const company = need(data.companies.find((c) => c.name === client.company), `la empresa ${client.company}`);
  const clientType = need(data.clientTypes.find((t) => t.id === company.clientTypeId), "el tipo de cliente");
  const requester = need(data.users.find((u) => u.email === client.email), `el usuario ${client.email}`);
  const itemByCode = (code: string) => need(data.items.find((i) => i.code === code), `el elemento ${code}`);
  const person = (who: Who): User =>
    who === "client" ? requester : need(data.users.find((u) => u.email === staffEmails[who]), `el usuario ${staffEmails[who]}`);

  const classify = (impact: Impact, urgency: Urgency) => {
    const rule = need(
      data.rules.find((r) => r.impact === impact && r.urgency === urgency),
      "la matriz de prioridad",
    );
    return classifyFrom(
      rule.priority,
      (priority) => need(data.levels.find((l) => l.priority === priority), "los tiempos de prioridad"),
      clientType,
      created,
    );
  };

  let item = itemByCode(spec.item);
  const impact = item.type === "INCIDENT" ? (spec.impact ?? item.defaultImpact) : item.defaultImpact;
  const urgency = item.type === "INCIDENT" ? (spec.urgency ?? item.defaultUrgency) : item.defaultUrgency;
  const classification = classify(impact, urgency);

  const state = {
    status: "OPEN" as TicketStatus,
    level: 1,
    assignee: null as User | null,
    requiresApproval: Boolean(item.approvalQuestion && spec.approval),
    approvedAt: null as Date | null,
    approvedBy: null as User | null,
    firstResponseAt: null as Date | null,
    resolvedAt: null as Date | null,
    closedAt: null as Date | null,
  };

  const events: { kind: TicketEventKind; actorId: string | null; fromValue: string | null; toValue: string | null; createdAt: Date }[] = [
    { kind: "CREATED", actorId: requester.id, fromValue: null, toValue: classification.priority, createdAt: created },
  ];
  const comments: { authorId: string; body: string; internal: boolean; kind: CommentKind; createdAt: Date }[] = [];
  const log = (kind: TicketEventKind, who: User, minutes: number, from: string | null = null, to: string | null = null) =>
    events.push({ kind, actorId: who.id, fromValue: from, toValue: to, createdAt: at(minutes) });
  const note = (who: User, minutes: number, body: string, internal: boolean, kind: CommentKind) =>
    comments.push({ authorId: who.id, body, internal, kind, createdAt: at(minutes) });

  const fail = (step: Step, why: string): never => {
    throw new Error(`Guion inválido en "${spec.title}", paso ${step.do} a los ${step.at} min: ${why}`);
  };
  const changeStatus = (step: Step, who: User, to: TicketStatus) => {
    if (!canTransition(state.status, to)) fail(step, `no se puede pasar de ${state.status} a ${to}`);
    log("STATUS_CHANGED", who, step.at, state.status, to);
    state.status = to;
  };
  const gated = (step: Step) => {
    if (state.requiresApproval && !state.approvedAt) fail(step, "el ticket espera aprobación");
  };

  for (const step of [...(spec.steps ?? [])].sort((a, b) => a.at - b.at)) {
    const who = person(step.by);
    switch (step.do) {
      case "assign": {
        const to = step.to ? person(step.to) : null;
        if (to && !canHandle(to.supportLevel, state.level)) fail(step, `${to.name} no atiende el nivel ${state.level}`);
        log("ASSIGNED", who, step.at, state.assignee?.name ?? null, to?.name ?? null);
        state.assignee = to;
        break;
      }
      case "start": {
        if (!state.assignee) fail(step, "no tiene agente asignado");
        gated(step);
        changeStatus(step, who, "IN_PROGRESS");
        state.firstResponseAt ??= at(step.at);
        break;
      }
      case "escalate": {
        if (!canEscalate(state.status, state.level) || step.level <= state.level) fail(step, "no se puede escalar");
        log("LEVEL_CHANGED", who, step.at, String(state.level), String(step.level));
        if (state.status !== "ESCALATED") {
          log("STATUS_CHANGED", who, step.at, state.status, "ESCALATED");
          state.status = "ESCALATED";
        }
        state.level = step.level;
        if (state.assignee && !canHandle(state.assignee.supportLevel, state.level)) {
          log("ASSIGNED", who, step.at, state.assignee.name, null);
          state.assignee = null;
        }
        note(who, step.at, step.note, ESCALATION_NOTE.internal, ESCALATION_NOTE.kind);
        break;
      }
      case "resolve": {
        gated(step);
        changeStatus(step, who, "RESOLVED");
        state.resolvedAt = at(step.at);
        const rule = statusNote("IN_PROGRESS", "RESOLVED");
        note(who, step.at, step.note, rule?.internal ?? false, rule?.kind ?? "NOTE");
        break;
      }
      case "reopen": {
        changeStatus(step, who, "IN_PROGRESS");
        state.resolvedAt = null;
        const rule = statusNote("RESOLVED", "IN_PROGRESS");
        note(who, step.at, step.note, rule?.internal ?? false, rule?.kind ?? "NOTE");
        break;
      }
      case "close": {
        changeStatus(step, who, "CLOSED");
        state.closedAt = at(step.at);
        const rule = statusNote("RESOLVED", "CLOSED");
        note(who, step.at, step.note, rule?.internal ?? true, rule?.kind ?? "NOTE");
        break;
      }
      case "ask": {
        if (who.role !== "AGENT") fail(step, "solo un agente pide aprobación");
        state.requiresApproval = true;
        state.approvedAt = null;
        state.approvedBy = null;
        log("APPROVAL_REQUESTED", who, step.at);
        note(who, step.at, step.note, APPROVAL_NOTE.internal, APPROVAL_NOTE.kind);
        break;
      }
      case "approve": {
        if (who.role !== "SUPERVISOR" && who.role !== "ADMIN") fail(step, "solo supervisión o administración aprueban");
        if (!state.requiresApproval) fail(step, "no hay nada que aprobar");
        state.approvedAt = at(step.at);
        state.approvedBy = who;
        log("APPROVED", who, step.at);
        break;
      }
      case "category": {
        const next = itemByCode(step.item);
        log("CATEGORY_CHANGED", who, step.at, item.code, next.code);
        if (next.approvalQuestion && !state.approvedAt) state.requiresApproval = true;
        item = next;
        break;
      }
      case "comment": {
        note(who, step.at, step.body, Boolean(step.internal), "NOTE");
        break;
      }
    }
  }

  return {
    data: {
      title: spec.title,
      description: spec.description,
      tags: spec.tags ?? [],
      type: item.type,
      catalogItemId: item.id,
      impact,
      urgency,
      priority: classification.priority as Priority,
      status: state.status,
      level: state.level,
      requesterId: requester.id,
      companyId: company.id,
      assigneeId: state.assignee?.id ?? null,
      requiresApproval: state.requiresApproval,
      approvedById: state.approvedBy?.id ?? null,
      approvedAt: state.approvedAt,
      responseDueAt: classification.responseDueAt,
      resolutionDueAt: classification.resolutionDueAt,
      createdAt: created,
      firstResponseAt: state.firstResponseAt,
      resolvedAt: state.resolvedAt,
      closedAt: state.closedAt,
    },
    events,
    comments,
  };
}

// ---------------------------------------------------------------------------

async function main() {
  const endpoint = new URL(url!).hostname.split(".")[0];
  console.log(`Destino: ${prod ? "PRODUCCIÓN" : "desarrollo"}, endpoint ${endpoint}`);

  const data = await load();
  const now = new Date();
  // Los más antiguos primero, para que el folio siga el orden cronológico
  const built = [...specs].sort((a, b) => b.age - a.age).map((spec) => build(spec, data, now));

  const existing = await db.ticket.count();
  console.log(`Tickets actuales que se borrarían: ${existing}. Tickets que se crearían: ${built.length}.`);

  if (!confirmed) {
    console.log("No se cambió nada. Para ejecutarlo, agrega --yes.");
    return;
  }

  await db.problem.deleteMany();
  await db.ticket.deleteMany(); // también borra comentarios e historial
  // Que el primer folio vuelva a ser el #1
  await db.$queryRaw`SELECT setval(pg_get_serial_sequence('"Ticket"', 'number'), 1, false)::int AS n`;

  for (const { data: ticket, events, comments } of built) {
    await db.ticket.create({ data: { ...ticket, events: { create: events }, comments: { create: comments } } });
  }

  const byStatus = await db.ticket.groupBy({ by: ["status"], _count: true });
  console.log(
    `Listo: ${built.length} tickets. ` + byStatus.map((row) => `${row.status} ${row._count}`).join(", ") + ".",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
