// Carga las reglas del servicio y los usuarios de demostración.
// Se puede correr varias veces: actualiza las reglas y no toca usuarios que ya existen.

import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  PrismaClient,
  type Impact,
  type Priority,
  type Role,
  type ServiceKind,
  type TicketType,
  type Urgency,
} from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

config({ path: ".env.local" });

const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DIRECT_URL }),
});

// Tipos de cliente según el SLA de la Fase 1, con los ajustes aprobados por el equipo
const clientTypes = [
  {
    code: "VIP",
    name: "VIP",
    minPriority: "P2" as Priority,
    alwaysAttended: true,
    workingDays: [1, 2, 3, 4, 5, 6, 7],
    dayStartMinute: null,
    dayEndMinute: null,
    responseCommitMinutes: 120,
    responseAlertMinutes: 90,
    escalationMinutes: 120,
    escalateTo: "AGENT" as Role,
    escalateToLevel: 2,
  },
  {
    code: "NORMAL",
    name: "Normal",
    minPriority: null,
    alwaysAttended: false,
    workingDays: [1, 2, 3, 4, 5],
    dayStartMinute: 7 * 60,
    dayEndMinute: 19 * 60,
    responseCommitMinutes: 24 * 60,
    responseAlertMinutes: 16 * 60,
    escalationMinutes: 24 * 60,
    escalateTo: "SUPERVISOR" as Role,
    escalateToLevel: null,
  },
];

const matrix: [Impact, Urgency, Priority][] = [
  ["HIGH", "HIGH", "P1"],
  ["HIGH", "MEDIUM", "P2"],
  ["HIGH", "LOW", "P3"],
  ["MEDIUM", "HIGH", "P2"],
  ["MEDIUM", "MEDIUM", "P3"],
  ["MEDIUM", "LOW", "P4"],
  ["LOW", "HIGH", "P3"],
  ["LOW", "MEDIUM", "P4"],
  ["LOW", "LOW", "P5"],
];

// Un día hábil son 12 horas de atención, de 07:00 a 19:00
const BUSINESS_DAY = 12 * 60;

const priorityLevels = [
  {
    priority: "P1" as Priority,
    name: "Crítica",
    responseMinutes: 15,
    resolutionMinutes: null,
    updateEveryMinutes: 30,
    responseLabel: "15 min",
    resolutionLabel: "Trabajo continuo hasta restaurar, con actualización cada 30 min",
  },
  {
    priority: "P2" as Priority,
    name: "Alta",
    responseMinutes: 60,
    resolutionMinutes: 4 * 60,
    updateEveryMinutes: null,
    responseLabel: "1 h",
    resolutionLabel: "4 h",
  },
  {
    priority: "P3" as Priority,
    name: "Media",
    responseMinutes: 4 * 60,
    resolutionMinutes: BUSINESS_DAY,
    updateEveryMinutes: null,
    responseLabel: "4 h",
    resolutionLabel: "1 día hábil",
  },
  {
    priority: "P4" as Priority,
    name: "Baja",
    responseMinutes: BUSINESS_DAY,
    resolutionMinutes: 3 * BUSINESS_DAY,
    updateEveryMinutes: null,
    responseLabel: "1 día hábil",
    resolutionLabel: "3 días hábiles",
  },
  {
    priority: "P5" as Priority,
    name: "Planificada",
    responseMinutes: null,
    resolutionMinutes: null,
    updateEveryMinutes: null,
    responseLabel: "Sin compromiso inmediato",
    resolutionLabel: "Entra a la cola de planificación",
  },
];

const services: { code: string; name: string; description: string; kind: ServiceKind }[] = [
  {
    code: "AUTH",
    name: "Autenticación",
    description: "Iniciar y cerrar sesión, renovar sesión, alta y lista de usuarios.",
    kind: "CORE",
  },
  {
    code: "TICKETS",
    name: "Gestión de tickets",
    description: "Crear, listar, cambiar estado, asignar agente y borrar tickets.",
    kind: "CORE",
  },
  {
    code: "EXCEL",
    name: "Carga de Excel",
    description: "Carga de archivos con tickets, procesados en una cola con reintentos.",
    kind: "SUPPORT",
  },
  {
    code: "REPORTS",
    name: "Reportes",
    description: "Reportes de resolución, escalamientos, agentes y estado semanal.",
    kind: "SUPPORT",
  },
  {
    code: "QUEUE",
    name: "Métricas de cola",
    description: "Estado de la cola de procesamiento y trabajos descartados.",
    kind: "SUPPORT",
  },
  {
    code: "ATTENTION",
    name: "Atención y tiempos de respuesta",
    description: "Cumplimiento de los tiempos de respuesta de la mesa de servicio.",
    kind: "ATTENTION",
  },
];

type Item = {
  code: string;
  service: string;
  name: string;
  type: TicketType;
  reportedBy: string;
  impact: Impact;
  urgency: Urgency;
  onlyFor?: string;
  other?: true;
  approvalQuestion?: string;
};

// Catálogo aprobado por el equipo, agrupado por servicio. Cada servicio cierra con un "Otro" para lo que
// no encaja en la lista: el nivel 1 lo reclasifica, y si se repite, es señal de que falta un elemento
const catalog: Item[] = [
  { code: "I-5", service: "AUTH", name: "Nadie puede iniciar sesión", type: "INCIDENT", reportedBy: "Cualquier usuario", impact: "HIGH", urgency: "HIGH" },
  { code: "I-6", service: "AUTH", name: "Un usuario no puede iniciar sesión", type: "INCIDENT", reportedBy: "El usuario afectado", impact: "LOW", urgency: "MEDIUM" },
  { code: "S-3", service: "AUTH", name: "Alta de un usuario; si es ADMIN, con autorización", type: "SERVICE_REQUEST", reportedBy: "El supervisor o el cliente", impact: "LOW", urgency: "MEDIUM", approvalQuestion: "¿El usuario nuevo tendrá rol ADMIN?" },
  { code: "I-13", service: "AUTH", name: "Otro problema con la autenticación", type: "INCIDENT", reportedBy: "Cualquier usuario", impact: "MEDIUM", urgency: "MEDIUM", other: true },
  { code: "I-7", service: "TICKETS", name: "No se pueden crear tickets", type: "INCIDENT", reportedBy: "Cualquier usuario", impact: "HIGH", urgency: "HIGH" },
  { code: "I-8", service: "TICKETS", name: "La lista de tickets no carga", type: "INCIDENT", reportedBy: "Agentes y clientes", impact: "HIGH", urgency: "HIGH" },
  { code: "I-4", service: "TICKETS", name: "Un analista no puede cerrar un ticket", type: "INCIDENT", reportedBy: "El analista que atiende los tickets", impact: "LOW", urgency: "MEDIUM" },
  { code: "S-2", service: "TICKETS", name: "Cerrar un ticket ingresado por error", type: "SERVICE_REQUEST", reportedBy: "El cliente", impact: "LOW", urgency: "LOW" },
  { code: "I-14", service: "TICKETS", name: "Otro problema con la gestión de tickets", type: "INCIDENT", reportedBy: "Cualquier usuario", impact: "MEDIUM", urgency: "MEDIUM", other: true },
  { code: "I-9", service: "EXCEL", name: "La carga falla o se queda procesando", type: "INCIDENT", reportedBy: "Quien carga tickets", impact: "MEDIUM", urgency: "MEDIUM" },
  { code: "I-10", service: "EXCEL", name: "Faltan tickets tras una carga por filas descartadas", type: "INCIDENT", reportedBy: "Quien carga tickets", impact: "MEDIUM", urgency: "MEDIUM" },
  { code: "S-4", service: "EXCEL", name: "Reprocesar filas descartadas", type: "SERVICE_REQUEST", reportedBy: "Quien carga tickets", impact: "LOW", urgency: "MEDIUM" },
  { code: "I-15", service: "EXCEL", name: "Otro problema con la carga de Excel", type: "INCIDENT", reportedBy: "Cualquier usuario", impact: "MEDIUM", urgency: "MEDIUM", other: true },
  { code: "I-3", service: "REPORTS", name: "El reporte no se exporta con la data", type: "INCIDENT", reportedBy: "Los analistas que necesitan el reporte", impact: "MEDIUM", urgency: "MEDIUM" },
  { code: "I-11", service: "REPORTS", name: "Un reporte no carga o da error", type: "INCIDENT", reportedBy: "Gerencia o analistas", impact: "MEDIUM", urgency: "MEDIUM" },
  { code: "S-1", service: "REPORTS", name: "Reporte de uptime", type: "SERVICE_REQUEST", reportedBy: "El líder técnico", impact: "LOW", urgency: "LOW" },
  { code: "I-16", service: "REPORTS", name: "Otro problema con los reportes", type: "INCIDENT", reportedBy: "Cualquier usuario", impact: "MEDIUM", urgency: "MEDIUM", other: true },
  { code: "I-12", service: "QUEUE", name: "La cola acumula trabajos o descartes", type: "INCIDENT", reportedBy: "ADMIN o equipo de plataforma", impact: "MEDIUM", urgency: "HIGH" },
  { code: "I-17", service: "QUEUE", name: "Otro problema con la cola de procesamiento", type: "INCIDENT", reportedBy: "Cualquier usuario", impact: "MEDIUM", urgency: "MEDIUM", other: true },
  { code: "I-1", service: "ATTENTION", name: "Primera respuesta a un VIP después de 2 horas", type: "INCIDENT", reportedBy: "El usuario VIP", impact: "LOW", urgency: "MEDIUM", onlyFor: "VIP" },
  { code: "I-2", service: "ATTENTION", name: "Primera respuesta a un Normal después de 24 horas de atención", type: "INCIDENT", reportedBy: "El usuario Normal", impact: "LOW", urgency: "HIGH", onlyFor: "NORMAL" },
  { code: "S-5", service: "ATTENTION", name: "Cambio de horario de atención de un cliente", type: "SERVICE_REQUEST", reportedBy: "El cliente o su supervisor", impact: "LOW", urgency: "LOW" },
  { code: "I-18", service: "ATTENTION", name: "Otro problema con la atención", type: "INCIDENT", reportedBy: "Cualquier usuario", impact: "MEDIUM", urgency: "MEDIUM", other: true },
];

const companies = [
  { name: "Comercial Altamira", clientType: "VIP" },
  { name: "Grupo Quetzal", clientType: "VIP" },
  { name: "Distribuidora El Roble", clientType: "NORMAL" },
  { name: "Ferretería La Unión", clientType: "NORMAL" },
];

const users: {
  email: string;
  name: string;
  role: Role;
  supportLevel?: number;
  company?: string;
}[] = [
  { email: "admin@servicedesk.demo", name: "Administración", role: "ADMIN" },
  { email: "supervisor@servicedesk.demo", name: "Supervisión", role: "SUPERVISOR" },
  { email: "agente.n1@servicedesk.demo", name: "Agente nivel 1", role: "AGENT", supportLevel: 1 },
  { email: "agente.n2@servicedesk.demo", name: "Agente nivel 2", role: "AGENT", supportLevel: 2 },
  { email: "agente.n3@servicedesk.demo", name: "Equipo de plataforma", role: "AGENT", supportLevel: 3 },
  { email: "cliente.vip@altamira.demo", name: "Cliente VIP", role: "CLIENT", company: "Comercial Altamira" },
  { email: "cliente.normal@elroble.demo", name: "Cliente Normal", role: "CLIENT", company: "Distribuidora El Roble" },
  { email: "cliente.vip@quetzal.demo", name: "Cliente Quetzal", role: "CLIENT", company: "Grupo Quetzal" },
  { email: "cliente.normal@launion.demo", name: "Cliente La Unión", role: "CLIENT", company: "Ferretería La Unión" },
];

async function seedRules() {
  for (const { code, ...data } of clientTypes) {
    await db.clientType.upsert({ where: { code }, create: { code, ...data }, update: data });
  }

  for (const [impact, urgency, priority] of matrix) {
    await db.priorityRule.upsert({
      where: { impact_urgency: { impact, urgency } },
      create: { impact, urgency, priority },
      update: { priority },
    });
  }

  for (const { priority, ...data } of priorityLevels) {
    await db.priorityLevel.upsert({ where: { priority }, create: { priority, ...data }, update: data });
  }

  for (const [index, { code, ...data }] of services.entries()) {
    const values = { ...data, sortOrder: index + 1 };
    await db.service.upsert({ where: { code }, create: { code, ...values }, update: values });
  }

  const serviceIds = new Map(
    (await db.service.findMany({ select: { id: true, code: true } })).map((s) => [s.code, s.id]),
  );
  const clientTypeIds = new Map(
    (await db.clientType.findMany({ select: { id: true, code: true } })).map((t) => [t.code, t.id]),
  );

  for (const [index, item] of catalog.entries()) {
    const values = {
      name: item.name,
      type: item.type,
      serviceId: serviceIds.get(item.service)!,
      reportedBy: item.reportedBy,
      defaultImpact: item.impact,
      defaultUrgency: item.urgency,
      clientTypeId: item.onlyFor ? clientTypeIds.get(item.onlyFor)! : null,
      approvalQuestion: item.approvalQuestion ?? null,
      isOther: item.other ?? false,
      sortOrder: index + 1,
      active: true,
    };
    await db.catalogItem.upsert({
      where: { code: item.code },
      create: { code: item.code, ...values },
      update: values,
    });
  }
}

async function seedDemoData() {
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    throw new Error("Falta SEED_PASSWORD: la contraseña de los usuarios de demostración no va en el código.");
  }

  const clientTypeIds = new Map(
    (await db.clientType.findMany({ select: { id: true, code: true } })).map((t) => [t.code, t.id]),
  );

  for (const { name, clientType } of companies) {
    const clientTypeId = clientTypeIds.get(clientType)!;
    await db.company.upsert({ where: { name }, create: { name, clientTypeId }, update: { clientTypeId } });
  }

  const companyIds = new Map(
    (await db.company.findMany({ select: { id: true, name: true } })).map((c) => [c.name, c.id]),
  );

  for (const user of users) {
    const exists = await db.user.findUnique({ where: { email: user.email }, select: { id: true } });
    if (exists) continue;

    await db.user.create({
      data: {
        email: user.email,
        name: user.name,
        role: user.role,
        supportLevel: user.supportLevel ?? null,
        companyId: user.company ? companyIds.get(user.company)! : null,
        passwordHash: await hashPassword(password),
      },
    });
  }
}

async function main() {
  await seedRules();
  await seedDemoData();
  console.log(`Reglas cargadas: ${catalog.length} elementos del catálogo, ${services.length} servicios.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
