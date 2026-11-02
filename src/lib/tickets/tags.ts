export const MAX_TAGS = 5;

// Lista cerrada: así no hay etiquetas repetidas con otro nombre y las estadísticas por etiqueta cuentan lo mismo
export const TAGS = [
  "login",
  "acceso",
  "usuarios",
  "portal",
  "excel",
  "reporte",
  "cola",
  "correo",
  "uptime",
  "error 500",
  "lentitud",
  "no carga",
  "datos incompletos",
] as const;

// Quita lo que no esté en la lista y lo repetido; el formulario solo envía valores de la lista, así que lo demás viene de una petición manual
export function parseTags(values: string[]): { tags: string[]; error?: string } {
  const known: readonly string[] = TAGS;
  const tags = [...new Set(values)].filter((tag) => known.includes(tag));
  if (tags.length > MAX_TAGS) return { tags, error: `Elige como máximo ${MAX_TAGS} etiquetas.` };
  return { tags };
}
