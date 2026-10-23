# techsupport_servicedesk

A service desk web app for managing support tickets using vercel, neon and next.js

## Desarrollo local

Requiere Node.js 20 o superior.

```bash
npm ci          # instala dependencias exactamente como están en package-lock.json
npm run dev     # servidor de desarrollo en http://localhost:3000
```

## Validación

Son los mismos pasos que corre el pipeline antes de publicar:

```bash
npm run lint       # reglas de ESLint
npm run typecheck  # verificación de tipos de TypeScript
npm run build      # build de producción
```

## Stack

* Next.js con App Router y TypeScript
* Tailwind CSS
* PostgreSQL en Neon
* Despliegue en Vercel mediante GitHub Actions, solo desde la rama `main`
