"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";

export type LoginState = { error?: string; email?: string } | undefined;

const LoginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

const INVALID = "Correo o contraseña incorrectos.";

// Hash de relleno para comparar aunque el correo no exista, y que ambos casos tarden lo mismo.
// Se crea en el primer intento de login y no al cargar el archivo: el encabezado importa `logout`
// de aquí, y un valor aleatorio al cargar rompe el prerender de las páginas
let dummyHash: Promise<string> | undefined;

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: INVALID, email };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  dummyHash ??= hashPassword("contraseña-de-relleno");
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await dummyHash));

  // El mismo mensaje en todos los casos, para no revelar qué correos existen
  if (!user || !user.active || !valid) return { error: INVALID, email };

  await createSession({ userId: user.id, role: user.role });
  redirect(user.role === "CLIENT" ? "/inicio" : "/tablero");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
