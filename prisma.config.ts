import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// La CLI de Prisma no lee .env.local por su cuenta; Next.js sí
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Las migraciones usan la conexión directa, sin el pooler
    url: process.env.DIRECT_URL,
  },
});
