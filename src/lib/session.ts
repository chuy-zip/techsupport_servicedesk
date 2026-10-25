import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@/generated/prisma/client";

const COOKIE_NAME = "session";
const SESSION_DAYS = 7;

// Solo lo mínimo para identificar al usuario. Nada personal ni sensible
export type SessionPayload = {
  userId: string;
  role: Role;
};

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Falta SESSION_SECRET");
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: SessionPayload, expiresAt: Date) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getKey());
}

// Devuelve null si el token no existe, está alterado o ya venció
export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getKey(), { algorithms: ["HS256"] });
    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload) {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const token = await encrypt(payload, expiresAt);

  (await cookies()).set(COOKIE_NAME, token, {
    // El JavaScript del navegador no puede leerla
    httpOnly: true,
    // Solo viaja por HTTPS; en local se permite HTTP
    secure: process.env.NODE_ENV === "production",
    // No se envía en peticiones que otros sitios disparen con POST
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function readSession() {
  return decrypt((await cookies()).get(COOKIE_NAME)?.value);
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE_NAME);
}

export const SESSION_COOKIE = COOKIE_NAME;
