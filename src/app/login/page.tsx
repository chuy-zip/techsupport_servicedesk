import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

// Pantalla provisional: se estiliza cuando exista la guía de diseño
export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-semibold">Service Desk TechSupport Pro</h1>
        <LoginForm />
      </div>
    </main>
  );
}
