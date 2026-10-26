# CI/CD

El pipeline está en `.github/workflows/ci-cd.yml`. Dos reglas: solo se publica `main`, y nada se publica sin validar.

## Trabajos

* **Validar.** En cada pull request hacia `main` y en cada push a `main`: `npm ci`, lint, tipos y build.
* **Desplegar a producción.** Solo en push a `main` y si Validar pasó:
  1. Aplica las migraciones pendientes a la base de producción. Si una falla, no se publica.
  2. Corre el seed, para que reglas y catálogo de producción sean iguales a los del código.
  3. Construye y publica con la CLI de Vercel.

Los pull requests no generan vista previa; un cambio se prueba en local contra la rama `dev` de Neon.

## Protección de `main`

Ruleset `proteger-main`, sin excepciones:

* No se puede borrar `main` ni hacer force push.
* Todo entra por pull request.
* La verificación `Validar`, reportada por GitHub Actions, tiene que pasar.

## Cómo se trabaja

1. Rama nueva desde `main` actualizada, una por tarea.
2. Antes del pull request, correr lo mismo que Validar: `npm run lint`, `npm run typecheck` y `npm run build`.
3. Pull request hacia `main`. Al unirse, se publica solo.

## Secretos de GitHub Actions

`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DIRECT_URL` y `SEED_PASSWORD`.

* **`DIRECT_URL` debe ser la cadena de `production`.** Con la de `dev`, el pipeline pasa en verde pero no toca producción.
* **`VERCEL_TOKEN`** tiene alcance solo al proyecto y fecha de vencimiento. Al vencer, se crea otro y se reemplaza el secreto.
* **El repositorio es público.** Nunca usar el evento `pull_request_target`, que expondría los secretos a pull requests de terceros.
