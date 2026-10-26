# Infraestructura

## Dónde corre cada parte

| | Local | Producción |
|---|---|---|
| Aplicación | `npm run dev` | Vercel, región `iad1` |
| Base de datos | Rama `dev` de Neon | Rama `production` de Neon |
| Variables | `.env.local` | Vercel y secretos de GitHub |

* **Neon.** PostgreSQL serverless en AWS US East 1, plan gratuito. Usa dos ramas de base de datos, explicadas abajo.
* **Vercel.** Plan Hobby. No está conectado al repositorio: solo publica el pipeline. `vercel.json` desactiva el despliegue automático por si alguien lo conecta desde el panel.
* **Conexiones.** La aplicación usa la cadena con pooler, `DATABASE_URL`. Las migraciones y el seed usan la directa, `DIRECT_URL`.

## Ramas de Neon

Neon permite ramificar la base de datos. No tienen relación con las ramas de Git.

| Rama | Para qué | Quién la toca |
|---|---|---|
| `production` | La aplicación publicada y la demo | Solo el pipeline, con migraciones y seed |
| `dev` | Desarrollo y pruebas en local | Todo el equipo, compartida |

* **Cómo funcionan.** Una rama es una copia completa de la base, con esquema y datos, creada a partir de otra. Se crea al instante porque comparte el almacenamiento y solo guarda lo que cambia. Cada rama tiene sus propias cadenas de conexión.
* **No se unen.** No existe pasar `dev` a `production`. El esquema llega a producción por las migraciones del repositorio; los datos de prueba se quedan en `dev`.
* **Si `dev` queda en mal estado,** se reconstruye con `npx prisma migrate reset`, que borra la base y aplica las migraciones desde cero, y luego `npx prisma db seed`. Avisar antes, porque es compartida. No conviene reiniciarla desde `production`: copiaría los usuarios con las contraseñas de producción.

## Variables

| Variable | Local | Producción |
|---|---|---|
| `DATABASE_URL` | Cadena con pooler de `dev` | Vercel, solo Production |
| `DIRECT_URL` | Cadena directa de `dev` | Secreto de GitHub, cadena directa de `production` |
| `SEED_PASSWORD` | Contraseña de los usuarios demo en local | Secreto de GitHub, distinta a la local |
| `SESSION_SECRET` | Uno propio | Vercel, solo Production, distinto al local |

Las cadenas de `dev` se piden al dueño del repositorio por un canal seguro. Nunca se sube un `.env.local` ni se pega una cadena en un chat. Rotar `SESSION_SECRET` cierra todas las sesiones.

## Correr en local

1. Node.js 24.
2. `npm ci`. También genera el cliente de Prisma en `src/generated/prisma`, que no se sube.
3. Copiar `.env.example` a `.env.local` y llenarlo. `SESSION_SECRET` se genera con `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
4. `npm run dev` y abrir `http://localhost:3000`.

Usuarios de demostración, todos con `SEED_PASSWORD`: `admin@servicedesk.demo`, `supervisor@servicedesk.demo`, `agente.n1@`, `agente.n2@` y `agente.n3@servicedesk.demo`, `cliente.vip@altamira.demo` y `cliente.normal@elroble.demo`.

## Base de datos

* **Cambiar el esquema.** Editar `prisma/schema.prisma` y correr `npx prisma migrate dev --name descripcion-corta` contra `dev`. La carpeta de la migración va en el pull request.
* **Una persona a la vez.** Todos comparten la rama `dev`; avisar antes de migrar.
* **Reglas y catálogo.** Viven en `prisma/seed.ts` y se cargan con `npx prisma db seed`. El seed no duplica datos ni toca usuarios existentes.
* **Ver los datos.** `npx prisma studio`.
* **Prisma fijado en 7.10.1.** No instalar `prisma@latest`, que hoy apunta a una versión candidata de la 8.
