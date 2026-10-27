# techsupport_servicedesk

Service Desk de TechSupport Pro: los clientes reportan problemas y piden servicios, y el equipo de soporte los atiende por prioridad. Next.js en Vercel con PostgreSQL en Neon.

## Documentación

Está en [`docs/`](docs/README.md): reglas del servicio y pendientes, infraestructura, CI/CD y guía de estilo.

## Desarrollo local

Requiere Node.js 24 y un `.env.local` armado a partir de `.env.example`. Los detalles y los usuarios de demostración para probar cada rol están en [`docs/infraestructura.md`](docs/infraestructura.md#usuarios-de-demostración).

```bash
npm ci          # instala dependencias y genera el cliente de Prisma
npm run dev     # servidor de desarrollo en http://localhost:3000
```

## Datos de demostración

`npm run seed:demo` crea 24 tickets de ejemplo en todos los estados para mostrar el sistema, y permite volver siempre al mismo punto de partida. Sin `--yes` solo muestra qué haría. Los detalles y las advertencias están en [`docs/infraestructura.md`](docs/infraestructura.md#datos-de-demostración).

## Validación

Son los mismos pasos que corre el pipeline antes de publicar:

```bash
npm run lint       # reglas de ESLint
npm run typecheck  # verificación de tipos de TypeScript
npm run build      # build de producción
```

## Stack

* Next.js 16 con App Router, TypeScript y Cache Components
* Tailwind CSS 4
* PostgreSQL en Neon con Prisma 7
* Despliegue en Vercel mediante GitHub Actions, solo desde la rama `main`
