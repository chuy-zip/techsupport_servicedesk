import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "../login/actions";

const roleNames = {
  CLIENT: "Cliente",
  AGENT: "Agente",
  SUPERVISOR: "Supervisión",
  ADMIN: "Administración",
} as const;

// Marco de las pantallas con sesión. La sesión se lee dentro de un Suspense, no en el layout
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6">
          <Link href="/inicio">
            <Eyebrow>TechSupport Pro · Service Desk</Eyebrow>
          </Link>
          <div className="flex items-center gap-4">
            <Suspense>
              <CurrentUser />
            </Suspense>
            <form action={logout}>
              <Button type="submit" variant="secondary">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </>
  );
}

async function CurrentUser() {
  const user = await getCurrentUser();
  const detail = user.companyName ?? (user.supportLevel ? `Nivel ${user.supportLevel}` : roleNames[user.role]);
  return (
    <p className="hidden text-right text-caption leading-tight sm:block">
      <span className="block font-medium">{user.name}</span>
      <span className="text-muted">{detail}</span>
    </p>
  );
}
