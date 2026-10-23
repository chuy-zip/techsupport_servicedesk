import { connection } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  // Que se ejecute en cada petición y nunca durante el build
  await connection();

  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "up" });
  } catch {
    return Response.json({ status: "error", database: "down" }, { status: 503 });
  }
}
