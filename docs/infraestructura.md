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
| `DIRECT_URL_PROD` | Cadena directa de `production`, solo para quien corra los datos de demostración en producción | No existe: allá el pipeline usa `DIRECT_URL` |
| `SEED_PASSWORD` | Contraseña de los usuarios demo en local | Secreto de GitHub, distinta a la local |
| `SESSION_SECRET` | Uno propio | Vercel, solo Production, distinto al local |

Las cadenas de `dev` se piden al dueño del repositorio por un canal seguro. Nunca se sube un `.env.local` ni se pega una cadena en un chat. Rotar `SESSION_SECRET` cierra todas las sesiones.

## Correr en local

1. Node.js 24.
2. `npm ci`. También genera el cliente de Prisma en `src/generated/prisma`, que no se sube.
3. Copiar `.env.example` a `.env.local` y llenarlo. `SESSION_SECRET` se genera con `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
4. `npm run dev` y abrir `http://localhost:3000`.

### Usuarios de demostración

Todos usan `SEED_PASSWORD`: la de `.env.local` en local y la de los secretos de GitHub en producción.

| Correo | Rol | Qué puede hacer |
|---|---|---|
| `admin@servicedesk.demo` | Administración | Todo lo del personal, aprobar y ver la carga por agente |
| `supervisor@servicedesk.demo` | Supervisión | Igual que administración: asignar a cualquiera, aprobar y ver la carga por agente |
| `agente.n1@servicedesk.demo` | Agente, nivel 1 | Tomar y atender tickets de nivel 1, escalar y pedir aprobación |
| `agente.n2@servicedesk.demo` | Agente, nivel 2 | Lo mismo, sobre tickets hasta de nivel 2 |
| `agente.n3@servicedesk.demo` | Agente, nivel 3 | Lo mismo, sobre tickets de cualquier nivel |
| `cliente.vip@altamira.demo` | Cliente de Comercial Altamira, VIP | Reportar, ver sus tickets y conversar con el equipo |
| `cliente.vip@quetzal.demo` | Cliente de Grupo Quetzal, VIP | Lo mismo |
| `cliente.normal@elroble.demo` | Cliente de Distribuidora El Roble, Normal | Lo mismo, con las reglas de cliente Normal |
| `cliente.normal@launion.demo` | Cliente de Ferretería La Unión, Normal | Lo mismo |

Hay cuatro empresas para que el filtro por cliente del tablero tenga qué filtrar. Qué puede hacer cada rol, con detalle, está en `service-desk.md`.

### Datos de demostración

Los usuarios y las reglas los carga `npx prisma db seed`, y en producción el pipeline. Los tickets de ejemplo son aparte: `prisma/seed-demo.ts` crea 24 tickets en todos los estados, con su historial y comentarios, repartidos entre los seis servicios y las cuatro empresas. Sirve como punto de partida para la demostración y para volver a él cuando se quiera.

| Comando | Qué hace |
|---|---|
| `npm run seed:demo` | Muestra a qué base apunta y qué haría, sin cambiar nada |
| `npm run seed:demo -- --yes` | Lo ejecuta en desarrollo |
| `npm run seed:demo -- --prod` | Muestra qué haría en producción, sin cambiar nada |
| `npm run seed:demo -- --prod --yes` | Lo ejecuta en producción |

* **Es destructivo.** Borra todos los tickets, comentarios, historial y problemas de esa base, y los crea de nuevo. Los usuarios y las reglas no se tocan. El primer ticket vuelve a ser el #1.
* **Siempre antes, sin `--yes`.** Imprime el endpoint de la base de destino; revisarlo antes de confirmar.
* **En producción,** `--prod` usa `DIRECT_URL_PROD` de `.env.local`. Antes, el pipeline tiene que haber desplegado la versión que trae los usuarios nuevos.
* **No corre en el pipeline.** Solo se ejecuta a mano, para que un despliegue nunca borre tickets reales.
* **Los plazos están vivos.** Los tiempos se calculan respecto al momento en que se corre, así que lo ideal es ejecutarlo poco antes de una demostración. Con el paso de las horas, los tickets irán pasando de "en plazo" a "vencido", como pasaría de verdad.
* **El recorrido** de qué ticket muestra qué está en `casos-de-uso.md`.

## Base de datos

* **Cambiar el esquema.** Editar `prisma/schema.prisma` y correr `npx prisma migrate dev --name descripcion-corta` contra `dev`. La carpeta de la migración va en el pull request.
* **Después de migrar, reiniciar `npm run dev`.** El servidor carga el cliente de Prisma al arrancar; si sigue abierto, usa el anterior y falla con errores como "Invalid value for argument `kind`". Si persiste, borrar la carpeta `.next` y arrancar de nuevo.
* **Al traer cambios de otra persona** con migraciones nuevas, correr `npx prisma migrate dev` para aplicarlas en `dev` y reiniciar el servidor.
* **Una persona a la vez.** Todos comparten la rama `dev`; avisar antes de migrar.
* **Reglas, catálogo y usuarios.** Viven en `prisma/seed.ts` y se cargan con `npx prisma db seed`. El seed no duplica datos ni toca usuarios existentes. Los tickets de ejemplo son otro script, descrito arriba.
* **Ver los datos.** `npx prisma studio`.
* **Prisma fijado en 7.10.1.** No instalar `prisma@latest`, que hoy apunta a una versión candidata de la 8.
