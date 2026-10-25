import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";

// Capa de acceso a datos para la identidad. Es la verificación real: el proxy solo filtra.
// La cookie dice quién dice ser el usuario; la base confirma que existe, sigue activo y su rol actual.

export type CurrentUser = {
  id: string;
  name: string;
  role: Role;
  supportLevel: number | null;
  companyId: string | null;
  companyName: string | null;
  clientTypeCode: string | null;
};

async function loadUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { company: { include: { clientType: true } } },
  });
  if (!user || !user.active) return null;

  return {
    id: user.id,
    name: user.name,
    role: user.role,
    supportLevel: user.supportLevel,
    companyId: user.companyId,
    companyName: user.company?.name ?? null,
    clientTypeCode: user.company?.clientType.code ?? null,
  };
}

// Para páginas y componentes de servidor. Debe llamarse dentro de un <Suspense>
export async function getCurrentUser(): Promise<CurrentUser> {
  "use cache: private";

  const user = await loadUser();
  if (!user) redirect("/login");
  return user;
}

// Para acciones de servidor y rutas de API: se verifica en cada llamada, sin caché
export async function requireUser(...roles: Role[]): Promise<CurrentUser> {
  const user = await loadUser();
  if (!user) redirect("/login");
  if (roles.length > 0 && !roles.includes(user.role)) {
    throw new Error("No autorizado");
  }
  return user;
}
