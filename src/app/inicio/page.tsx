import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "../login/actions";

export const metadata: Metadata = { title: "Inicio" };

// Pantalla provisional para comprobar el login
export default function InicioPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Hola, {user.name}</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt>Rol</dt>
        <dd>{user.role}</dd>
        {user.supportLevel && (
          <>
            <dt>Nivel</dt>
            <dd>{user.supportLevel}</dd>
          </>
        )}
        {user.companyName && (
          <>
            <dt>Empresa</dt>
            <dd>
              {user.companyName}, cliente {user.clientTypeCode}
            </dd>
          </>
        )}
      </dl>
      <form action={logout}>
        <button type="submit" className="rounded border border-zinc-300 px-3 py-2 text-sm">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
