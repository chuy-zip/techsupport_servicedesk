import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCurrentUser } from "@/lib/auth";
import { roleNames } from "@/lib/tickets/labels";
import { logout } from "../login/actions";

// Marco de las pantallas con sesión. La sesión se lee dentro de un Suspense, no en el layout
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-8">
            <Link href="/inicio">
              <Eyebrow>TechSupport Pro · Service Desk</Eyebrow>
            </Link>
            <Suspense>
              <Navigation />
            </Suspense>
          </div>
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </>
  );
}

async function Navigation() {
  const user = await getCurrentUser();
  const links =
    user.role === "CLIENT"
      ? [
          { href: "/inicio", label: "Mis tickets" },
          { href: "/tickets/nuevo", label: "Reportar" },
        ]
      : [{ href: "/tablero", label: "Tablero" }];

  return (
    <nav className="hidden gap-5 md:flex">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-caption font-medium text-muted transition-colors duration-150 hover:text-ink"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

async function CurrentUser() {
  const user = await getCurrentUser();
  const detail = user.companyName ?? (user.supportLevel ? `Nivel ${user.supportLevel}` : roleNames[user.role]);
  return (
    <p className="hidden text-right text-caption leading-tight sm:block">
      <span className="block font-medium">{user.name}</span>
      {detail !== user.name && <span className="text-muted">{detail}</span>}
    </p>
  );
}
