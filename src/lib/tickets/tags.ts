export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 30;

// Etiquetas separadas por comas, en minúscula y sin repetidas, para que "Login" y "login " cuenten igual
export function parseTags(raw: string): { tags: string[]; error?: string } {
  const tags = [
    ...new Set(
      raw
        .split(",")
        .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, " "))
        .filter(Boolean),
    ),
  ];
  if (tags.length > MAX_TAGS) return { tags, error: `Usa como máximo ${MAX_TAGS} etiquetas.` };
  if (tags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    return { tags, error: `Cada etiqueta puede tener hasta ${MAX_TAG_LENGTH} caracteres.` };
  }
  return { tags };
}
