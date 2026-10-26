import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/eyebrow";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

// Compromisos del SLA. Si cambian los tiempos de ClientType en prisma/seed.ts, actualizar aquí también
const commitments = [
  {
    client: "Clientes VIP",
    detail: "Primera respuesta en menos de 2 horas, todos los días y a toda hora.",
  },
  {
    client: "Clientes Normal",
    detail: "Primera respuesta en menos de 24 horas de atención, de lunes a viernes de 07:00 a 19:00.",
  },
];

export default function LoginPage() {
  return (
    <main className="grid flex-1 lg:grid-cols-[1fr_1.15fr]">
      <section className="flex items-center justify-center px-6 py-16 sm:px-10">
        <div className="w-full max-w-sm animate-enter">
          <Eyebrow>Service Desk</Eyebrow>
          <h1 className="mt-3 font-display text-title leading-tight font-bold">Ingresa a la mesa de servicio</h1>
          <p className="mt-3 text-muted">Reporta un problema, pide un servicio o da seguimiento a tus tickets.</p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </section>

      <aside className="flex items-start bg-olive px-6 py-12 text-white sm:px-10 lg:items-center lg:px-16 lg:py-20">
        <div className="mx-auto w-full max-w-sm animate-enter sm:max-w-lg lg:mx-0">
          <Eyebrow tone="lime">TechSupport Pro</Eyebrow>
          <p className="mt-4 font-display text-title leading-snug font-bold sm:text-hero sm:leading-[1.15]">
            Cada reporte entra a una cola que se atiende <span className="text-lime">por prioridad</span>.
          </p>
          <dl className="mt-10 divide-y divide-white/15 border-y border-white/15">
            {commitments.map((item) => (
              <div key={item.client} className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr] sm:gap-6">
                <dt className="font-semibold text-lime">{item.client}</dt>
                <dd className="text-white/85">{item.detail}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-caption text-white/70">Horarios en hora de Guatemala.</p>
        </div>
      </aside>
    </main>
  );
}
