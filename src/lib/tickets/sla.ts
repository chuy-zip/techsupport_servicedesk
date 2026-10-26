// Reloj de SLA. VIP corre siempre; Normal solo dentro de su horario de atención.
// Guatemala es UTC-6 todo el año, sin horario de verano, así que basta con un desfase fijo.

export type Schedule = {
  alwaysAttended: boolean;
  workingDays: number[]; // 1 lunes ... 7 domingo
  dayStartMinute: number | null;
  dayEndMinute: number | null;
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const OFFSET = -6 * 60 * MINUTE;

// Límite de seguridad para los ciclos: más de un año de días
const MAX_DAYS = 400;

function hasWindow(schedule: Schedule) {
  return !schedule.alwaysAttended && schedule.dayStartMinute !== null && schedule.dayEndMinute !== null;
}

// Trabaja con milisegundos en hora local, leídos con los métodos UTC
function dayWindow(localMs: number, schedule: Schedule) {
  const dayStart = Math.floor(localMs / DAY) * DAY;
  const weekday = new Date(dayStart).getUTCDay() || 7;
  return {
    dayStart,
    open: dayStart + schedule.dayStartMinute! * MINUTE,
    close: dayStart + schedule.dayEndMinute! * MINUTE,
    working: schedule.workingDays.includes(weekday),
  };
}

// Fecha en que se cumplen `minutes` minutos de atención contados desde `start`
export function addAttentionMinutes(start: Date, minutes: number, schedule: Schedule): Date {
  if (!hasWindow(schedule)) return new Date(start.getTime() + minutes * MINUTE);

  let t = start.getTime() + OFFSET;
  let remaining = minutes * MINUTE;

  for (let i = 0; i < MAX_DAYS; i++) {
    const { dayStart, open, close, working } = dayWindow(t, schedule);
    if (working && t < close) {
      t = Math.max(t, open);
      if (remaining <= close - t) return new Date(t + remaining - OFFSET);
      remaining -= close - t;
    }
    t = dayStart + DAY;
  }
  throw new Error("El horario de atención no tiene días hábiles");
}

// Minutos de atención transcurridos entre dos fechas
export function attentionMinutesBetween(start: Date, end: Date, schedule: Schedule): number {
  if (end <= start) return 0;
  if (!hasWindow(schedule)) return (end.getTime() - start.getTime()) / MINUTE;

  const until = end.getTime() + OFFSET;
  let t = start.getTime() + OFFSET;
  let total = 0;

  for (let i = 0; i < MAX_DAYS && t < until; i++) {
    const { dayStart, open, close, working } = dayWindow(t, schedule);
    if (working) {
      const from = Math.max(t, open);
      const to = Math.min(until, close);
      if (to > from) total += to - from;
    }
    t = dayStart + DAY;
  }
  return total / MINUTE;
}

export type SlaProgress = {
  ratio: number; // 0 a 1 o más si ya venció
  state: "ok" | "warning" | "breached";
  remainingMinutes: number; // negativo si ya venció
};

// Cuánto del plazo se consumió. La alerta llega en la misma proporción que el objetivo interno del cliente
export function slaProgress(
  start: Date,
  due: Date,
  now: Date,
  schedule: Schedule,
  alertRatio: number,
): SlaProgress {
  const total = attentionMinutesBetween(start, due, schedule);
  const elapsed = attentionMinutesBetween(start, now, schedule);
  const remaining = now < due ? attentionMinutesBetween(now, due, schedule) : -attentionMinutesBetween(due, now, schedule);
  const ratio = total > 0 ? elapsed / total : 1;
  const state = remaining < 0 ? "breached" : ratio >= alertRatio ? "warning" : "ok";
  return { ratio, state, remainingMinutes: remaining };
}
