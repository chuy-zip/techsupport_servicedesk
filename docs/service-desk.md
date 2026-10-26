# Service Desk

Los clientes de TechSupport Pro reportan problemas y piden servicios; el equipo de soporte los atiende por prioridad. Las reglas vienen de la Fase 1 con los ajustes que aprobó el equipo, y sus valores viven en `prisma/seed.ts`.

## Tipos de cliente

| | VIP | Normal |
|---|---|---|
| Prioridad mínima | P2 | Ninguna |
| Horario de atención | Todos los días, a toda hora | Lunes a viernes, 07:00 a 19:00 |
| Primera respuesta comprometida | 2 horas | 24 horas de atención |
| Alerta a supervisión | 90 minutos sin respuesta | 16 horas de atención |
| Escalamiento | A nivel 2 a las 2 horas sin resolver | Aviso a supervisión a las 24 horas de atención |

El tipo pertenece a la empresa. Para Normal, el reloj se detiene fuera de su horario.

## Prioridad

Sale de la matriz de impacto por urgencia; el usuario nunca la elige.

| Impacto \ Urgencia | Alta | Media | Baja |
|---|---|---|---|
| **Alto** | P1 | P2 | P3 |
| **Medio** | P2 | P3 | P4 |
| **Bajo** | P3 | P4 | P5 |

| Prioridad | Primera respuesta | Resolución |
|---|---|---|
| P1 Crítica | 15 min | Trabajo continuo, con actualización cada 30 min |
| P2 Alta | 1 h | 4 h |
| P3 Media | 4 h | 1 día hábil |
| P4 Baja | 1 día hábil | 3 días hábiles |
| P5 Planificada | Sin compromiso inmediato | Cola de planificación |

Un día hábil son 12 horas de atención. Los incidentes preguntan a quiénes afecta y qué pasa si se espera; las solicitudes usan los valores del catálogo.

## Catálogo

| Servicio | Código | Elemento | Prioridad típica |
|---|---|---|---|
| **Autenticación**, núcleo | I-5 | Nadie puede iniciar sesión | P1 |
| | I-6 | Un usuario no puede iniciar sesión | P4 |
| | S-3 | Alta de un usuario; si es ADMIN, con autorización | P4 |
| **Gestión de tickets**, núcleo | I-7 | No se pueden crear tickets | P1 |
| | I-8 | La lista de tickets no carga | P1 |
| | I-4 | Un analista no puede cerrar un ticket | P4 |
| | S-2 | Cerrar un ticket ingresado por error | P5 |
| **Carga de Excel**, soporte | I-9 | La carga falla o se queda procesando | P3 |
| | I-10 | Faltan tickets tras una carga por filas descartadas | P3 |
| | S-4 | Reprocesar filas descartadas | P4 |
| **Reportes**, soporte | I-3 | El reporte no se exporta con la data | P3 |
| | I-11 | Un reporte no carga o da error | P3 |
| | S-1 | Reporte de uptime | P5 |
| **Métricas de cola**, soporte | I-12 | La cola acumula trabajos o descartes | P2 |
| **Atención y tiempos** | I-1 | Primera respuesta a un VIP después de 2 horas, solo VIP | P2 |
| | I-2 | Primera respuesta a un Normal después de 24 horas de atención, solo Normal | P3 |
| | S-5 | Cambio de horario de atención de un cliente | P5 |

Los códigos I son incidentes y los S, solicitudes. S-3 pregunta si el usuario nuevo será ADMIN; si sí, necesita aprobación de supervisión antes de atenderse.

## Ciclo de vida del ticket

De la Fase 1: OPEN, IN_PROGRESS, RESOLVED y CLOSED en ese orden, y ESCALATED desde OPEN o IN_PROGRESS.

* Un ticket escalado solo se asigna a agentes de nivel 2 o superior.
* La primera respuesta es la primera vez que pasa a IN_PROGRESS con agente asignado.
* RESOLVED pasa a CLOSED cuando el cliente confirma.
* **Por definir al implementar la edición.** Qué sigue después de ESCALATED y si un ticket resuelto se puede reabrir.

## Cómo está armado

* **Sesión.** Cookie firmada con `SESSION_SECRET` que solo lleva id y rol. `src/proxy.ts` filtra las páginas sin sesión; `getCurrentUser` y `requireUser`, en `src/lib/auth.ts`, confirman en la base que el usuario existe, está activo y tiene el rol.
* **Reglas de seguridad.** Toda acción de servidor y ruta de API llama a `requireUser`, aunque la pantalla oculte el botón. La prioridad y los vencimientos se calculan en el servidor. Un cliente solo ve los tickets de su empresa.
* **Reloj de SLA.** `src/lib/tickets/sla.ts`, en hora de Guatemala. Los vencimientos se guardan en el ticket al crearlo.
* **Next 16 con Cache Components.** Leer la sesión o los parámetros de la ruta va dentro de `Suspense`, y antes de usar la hora actual se llama a `connection()`. La documentación de esta versión está en `node_modules/next/dist/docs`.

## Estado y pendientes

| Requisito del enunciado | Estado |
|---|---|
| Ingreso de un problema o solicitud | Hecho |
| Tablero de seguimiento para soporte | Pendiente |
| Vista del ticket con comentarios | Vista hecha, comentarios pendientes |
| Edición y actualización por soporte | Pendiente |
| Gráfica de tickets por categoría | Pendiente |

Pendientes, en orden. Al tomar uno, anotar el nombre de quien lo hace.

1. **Tablero.** `/tablero` para el personal, con columnas Abierto, En progreso, Escalado, Resuelto y Cerrado. Cada tarjeta con servicio, prioridad y medidor de SLA, ordenadas por prioridad y tiempo restante. Responsable:
2. **Edición.** Cambiar estado y nivel, asignar, reclasificar impacto y urgencia recalculando prioridad, y aprobar solicitudes. Cada cambio crea un `TicketEvent`. Responsable:
3. **Comentarios.** En el detalle, con autor y fecha, notas internas que el cliente no ve, y cierre confirmado por el cliente. Responsable:
4. **Etiquetas.** Campo opcional al crear el ticket, visible en el detalle y en el tablero. El modelo ya tiene `tags`; las imágenes de referencia del enunciado las usan. Responsable:
5. **Estadísticas.** Tickets por servicio, que es la categoría que pide el enunciado, y por etiqueta, prioridad y tipo. Responsable:
6. **Problemas en el sistema.** Ligar incidentes a un problema y seguir su flujo. Responsable:
7. **Análisis de gestión de problemas.** Documento que mapea los problemas probables de cada servicio: causa raíz posible, incidentes que lo delatan y workaround. Lo pide un objetivo del enunciado y no es una pantalla. Responsable:
8. **Demo.** Datos de ejemplo, borrar los tickets de prueba de `dev` y guion. Responsable:
9. **Presentación en clase.** Vale el 25%. Debe justificar el catálogo y las prioridades, y mostrar los ajustes a la Fase 1 como mejora continua. Responsable:
