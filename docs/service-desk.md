# Service Desk

Los clientes de TechSupport Pro reportan problemas y piden servicios; el equipo de soporte los atiende por prioridad. Las reglas vienen de la Fase 1 con los ajustes que aprobó el equipo, y sus valores viven en `prisma/seed.ts`.

## Tipos de cliente

| | VIP | Normal |
|---|---|---|
| Prioridad mínima | P2 | Ninguna |
| Horario de atención | Todos los días, a toda hora | Lunes a viernes, 07:00 a 19:00 |
| Primera respuesta comprometida | 2 horas | 24 horas de atención |
| Alerta a supervisión | 90 minutos sin primera respuesta | 16 horas de atención |
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

* **Cómo se calcula.** Los incidentes preguntan a quiénes afecta y qué pasa si se espera, con los valores típicos del elemento preseleccionados. Las solicitudes usan los valores del catálogo.
* **Piso de prioridad.** Un ticket de un cliente VIP nunca queda por debajo de P2.
* **Vencimientos.** Se guardan en el ticket al crearlo, contados con el reloj del tipo de cliente. Un día hábil son 12 horas de atención.
* **Reclasificar** recalcula la prioridad y los vencimientos con la misma regla, desde la fecha de creación.

## Catálogo

Son 23 elementos en seis servicios. Cada servicio tiene al menos uno, y los dos servicios núcleo tienen un caso P1.

| Servicio | Código | Elemento | Prioridad típica |
|---|---|---|---|
| **Autenticación**, núcleo | I-5 | Nadie puede iniciar sesión | P1 |
| | I-6 | Un usuario no puede iniciar sesión | P4 |
| | S-3 | Alta de un usuario; si es ADMIN, con autorización | P4 |
| | I-13 | Otro problema con la autenticación | P3 |
| **Gestión de tickets**, núcleo | I-7 | No se pueden crear tickets | P1 |
| | I-8 | La lista de tickets no carga | P1 |
| | I-4 | Un analista no puede cerrar un ticket | P4 |
| | S-2 | Cerrar un ticket ingresado por error | P5 |
| | I-14 | Otro problema con la gestión de tickets | P3 |
| **Carga de Excel**, soporte | I-9 | La carga falla o se queda procesando | P3 |
| | I-10 | Faltan tickets tras una carga por filas descartadas | P3 |
| | S-4 | Reprocesar filas descartadas | P4 |
| | I-15 | Otro problema con la carga de Excel | P3 |
| **Reportes**, soporte | I-3 | El reporte no se exporta con la data | P3 |
| | I-11 | Un reporte no carga o da error | P3 |
| | S-1 | Reporte de uptime | P5 |
| | I-16 | Otro problema con los reportes | P3 |
| **Métricas de cola**, soporte | I-12 | La cola acumula trabajos o descartes | P2 |
| | I-17 | Otro problema con la cola de procesamiento | P3 |
| **Atención y tiempos** | I-1 | Primera respuesta a un VIP después de 2 horas, solo VIP | P2 |
| | I-2 | Primera respuesta a un Normal después de 24 horas de atención, solo Normal | P3 |
| | S-5 | Cambio de horario de atención de un cliente | P5 |
| | I-18 | Otro problema con la atención | P3 |

* **Los códigos I son incidentes y los S, solicitudes.** El tipo del ticket sale del elemento elegido.
* **Otro.** Cada servicio cierra con un elemento para lo que no encaja en la lista: el cliente nunca elige algo que no es, y el servicio, que es la categoría del enunciado, queda bien. El personal lo pasa al elemento correcto con "Cambiar elemento", y la prioridad se ajusta aparte con Reclasificar. Si un servicio acumula tickets "Otro", falta un elemento en el catálogo: es mejora continua.
* **I-1 e I-2** solo se ofrecen al tipo de cliente que les corresponde.
* **S-3** pregunta si el usuario nuevo será ADMIN; si sí, necesita aprobación antes de atenderse.

## Qué puede hacer cada rol

| Rol | En la Fase 1 | En el Service Desk |
|---|---|---|
| Cliente | Usuario del servicio | Reporta, da seguimiento y conversa con el equipo |
| Agente nivel 1 | Mesa de servicio: registra, clasifica, da la primera respuesta y resuelve lo documentado | Atiende tickets de nivel 1 y escala si no puede |
| Agente nivel 2 | Especializado: lo que nivel 1 no resuelve | Atiende tickets hasta de nivel 2 |
| Agente nivel 3 | Equipo de plataforma: infraestructura y colas | Atiende tickets de cualquier nivel |
| Supervisión | Autoridad: no resuelve lo técnico; decide ante un incumplimiento y reasigna recursos | Asigna a cualquiera, aprueba, ve la carga por agente y actúa sobre cualquier ticket |
| Administración | Administra la plataforma y autoriza los cambios de mayor riesgo | Igual que supervisión: el flujo de cambios de la Fase 1 queda fuera de este sistema |

| Acción | Cliente | Agente | Supervisión y administración |
|---|---|---|---|
| Iniciar sesión | Sí | Sí | Sí |
| Reportar un ticket | Sí | No | No |
| Ver sus tickets en "Mis tickets" | Los que reportó | No aplica | No aplica |
| Abrir un ticket | Solo los de su empresa | Cualquiera | Cualquiera |
| Ver prioridad, impacto, urgencia, nivel, historial y medidor de SLA | No | Sí | Sí |
| Comentar | Sí, en los de su empresa | Sí | Sí |
| Dejar una nota interna | No | Sí | Sí |
| Ver el tablero y filtrarlo por asignación, cliente, servicio y prioridad | No | Sí | Sí |
| Filtrar por agente, ver "Sin asignar" y la carga por agente | No | No | Sí |
| Tomar o soltar un ticket | No | Sí, si es de su nivel o inferior | No: asignan a otra persona |
| Asignar a otro agente | No | No | Sí, a un agente con el nivel del ticket |
| Poner en progreso, resolver, cerrar y reabrir | No | Sí, si es de su nivel o inferior | Sí |
| Escalar | No | Sí, si es de su nivel o inferior | Sí |
| Reclasificar impacto y urgencia, y cambiar el elemento del catálogo | No | Sí, si es de su nivel o inferior | Sí |
| Pedir aprobación | No | Sí | No: son quienes aprueban |
| Aprobar | No | No | Sí |

* **Cómo llega un ticket a alguien.** Hay una cola única ordenada por prioridad y el nivel 1 toma de ella. Supervisión vigila la carga y reasigna si alguien se satura o un ticket se atasca; no hay que repartir uno por uno.
* **Quién clasifica.** El cliente responde dos preguntas sobre su situación y eso da la clasificación inicial; el personal la revisa y la ajusta, como dice la Fase 1.
* **Quién escala.** El agente que lo atiende, o supervisión. Es una decisión técnica.
* **Niveles.** Un agente solo actúa sobre tickets de su nivel o inferior. Al escalar, el ticket sube de nivel y, si el agente asignado no tiene ese nivel, queda sin asignar.

## Ciclo de vida del ticket

| Desde | Puede pasar a |
|---|---|
| OPEN | IN_PROGRESS; o ESCALATED al escalar |
| IN_PROGRESS | RESOLVED; o ESCALATED al escalar |
| ESCALATED | IN_PROGRESS, RESOLVED, o un nivel más al escalar |
| RESOLVED | CLOSED, o IN_PROGRESS para reabrir |
| CLOSED | Ninguno |

* **De la Fase 1** vienen el orden OPEN, IN_PROGRESS, RESOLVED y CLOSED, y ESCALATED desde OPEN o IN_PROGRESS. Las salidas de ESCALATED y la reapertura se definieron al implementar la edición.
* **Para pasar a IN_PROGRESS** el ticket necesita agente asignado.
* **Primera respuesta.** Es la primera vez que pasa a IN_PROGRESS con agente asignado; la mide el SLO 2.
* **Cierre.** La Fase 1 pide cerrar tras la confirmación del usuario. La mesa la obtiene, por ejemplo preguntando en los comentarios, y el personal cierra. El cliente no tiene que entrar a cerrar.
* **Cerrado** ya no recibe comentarios ni cambios.
* **Dos personas a la vez.** Si alguien más cambió el ticket entre medio, el cambio se rechaza con un aviso y no se pisa el de la otra persona.

### Notas obligatorias

Algunas acciones exigen una nota, como la descripción obligatoria de un pull request. Se guarda como comentario en la misma transacción que el cambio, y el servidor rechaza una nota vacía.

| Acción | Pregunta | Etiqueta en el hilo | Quién la ve |
|---|---|---|---|
| Marcar como resuelto | ¿Qué se hizo para resolverlo? | Solución | También el cliente |
| Cerrar | ¿Cómo se confirmó con el cliente? | Cierre | Solo el personal |
| Reabrir | ¿Por qué se reabre? | Reapertura | También el cliente, para que sepa por qué su ticket volvió a En progreso |
| Escalar | ¿Por qué se escala? | Escalamiento | Solo el personal |
| Pedir aprobación | ¿Por qué necesita autorización? | Aprobación pedida | Solo el personal; el cliente ve que su ticket espera autorización, sin la razón |

### Aprobaciones

Requiere autorización lo que el agente no debe ejecutar solo: lo que cambia accesos o permisos, como dar rol ADMIN o dar de baja a un usuario, lo que tiene riesgo, y lo que cambia lo acordado con el cliente.

* **Predefinida.** El elemento del catálogo la exige; hoy, S-3 cuando el usuario nuevo será ADMIN. Si un ticket se cambia a un elemento que la exige, se pide por precaución.
* **Pedida por el agente.** Quien atiende detecta un caso delicado que el catálogo no previó y usa "Pedir aprobación". Es la red de seguridad para lo que no está en la lista.
* **Mientras espera,** el ticket no se pone en progreso ni se resuelve. Aprueban supervisión o administración, sin nota: el historial registra quién y cuándo, y la razón está en la nota de quien la pidió.

## Comentarios

* **Hilo tipo chat.** Los mensajes propios salen a la derecha, en verde claro y con el autor "Tú"; los demás, a la izquierda.
* **Notas internas.** El personal marca "Es nota interna" y el cliente no la ve. El filtro está en la consulta a la base, así que el texto nunca llega al navegador del cliente. Un cliente no puede crear una, aunque altere el formulario.
* **Etiquetas del hilo.** Las notas que salen de una acción llevan su etiqueta: Solución, Reapertura, Cierre, Escalamiento o Aprobación pedida.
* **Autores.** El cliente ve a los agentes como "Equipo de soporte", sin su rol interno.

## Etiquetas

Campo opcional al crear el ticket, separadas por comas, como "login, error 500". Se guardan en minúscula y sin repetir, para que "Login" y "login" cuenten igual en las estadísticas. Máximo 5, de hasta 30 caracteres cada una. Se ven en el detalle y en las tarjetas del tablero.

## Tablero

* **Columnas.** Abierto, En progreso, Escalado, Resuelto y Cerrado, como en la referencia del enunciado. Cerrado muestra los 10 más recientes.
* **Orden.** Dentro de cada columna, primero la prioridad y, entre iguales, el vencimiento más cercano: lo crítico siempre arriba.
* **Tarjeta.** Número, servicio, título, prioridad, etiquetas, empresa, agente asignado y medidor de SLA. Las marcas avisan de VIP, de "Por aprobar" y del escalamiento que toca: "Escalar a nivel 2" para un VIP que pasó sus 2 horas, o "Avisar a supervisión" para un Normal que pasó sus 24 horas de atención.
* **Alertas sin tareas programadas.** Vercel Hobby no permite tareas frecuentes, así que las alertas se calculan al consultar, con los vencimientos guardados en el ticket.
* **Filtros.** Van en la URL: sobreviven al recargar y se pueden compartir. Los valores inválidos se ignoran en vez de romper la página.
* **Carga por agente.** Solo supervisión y administración ven cuántos tickets pendientes tiene cada persona, sin contar resueltos ni cerrados, y filtran por ella. Para un agente ese filtro se ignora.

## Lo que ve el cliente

El cliente ve su caso y el compromiso del equipo, no la clasificación interna.

| | Cliente | Personal |
|---|---|---|
| Estado, número, servicio, etiquetas y descripción | Sí | Sí |
| Quién lo atiende | Sí, como "Te atiende" | Sí |
| Quién lo reportó | Sí, con su correo | Sí, con su correo |
| Prioridad, impacto, urgencia y nivel | No | Sí |
| Plazo | Fecha comprometida: "Primera respuesta antes de" y luego "Resolución antes de"; en P1, "Atención continua" | Medidor de SLA con alerta y vencido |
| Comentarios | Los públicos; los suyos marcados como "Tú" | Todos, con las notas internas resaltadas |
| Historial de cambios | No | Sí |

La clasificación se oculta porque un cliente que ve su caso marcado como urgencia baja puede sentir que no se le toma en serio, aunque la regla sea correcta.

## Cómo está armado

* **Sesión.** Cookie firmada con `SESSION_SECRET` que solo lleva id y rol. `src/proxy.ts` filtra las páginas sin sesión; `getCurrentUser` y `requireUser`, en `src/lib/auth.ts`, confirman en la base que el usuario existe, está activo y tiene el rol.
* **Reglas de seguridad.** Toda acción de servidor y ruta de API llama a `requireUser`, aunque la pantalla oculte el botón. La prioridad y los vencimientos se calculan en el servidor. Un cliente solo ve los tickets de su empresa.
* **Reglas del flujo.** `src/lib/tickets/workflow.ts` define transiciones, niveles, roles y notas obligatorias; las acciones de `src/app/(app)/tickets/[number]/actions.ts` las vuelven a validar y registran cada cambio en `TicketEvent`.
* **Prioridad y plazos.** `src/lib/tickets/classify.ts` es la regla pura que usan la creación, la reclasificación y los datos de demostración, para que no haya dos versiones.
* **Reloj de SLA.** `src/lib/tickets/sla.ts`, en hora de Guatemala.
* **Next 16 con Cache Components.** Leer la sesión o los parámetros de la ruta va dentro de `Suspense`, y antes de consultar la base o usar la hora actual se llama a `connection()`. La documentación de esta versión está en `node_modules/next/dist/docs`.

## Estado y pendientes

| Requisito del enunciado | Estado |
|---|---|
| Ingreso de un problema o solicitud | Hecho |
| Tablero de seguimiento para soporte | Hecho, con filtros y carga por agente |
| Vista del ticket con comentarios | Hecho, con notas internas |
| Edición y actualización por soporte | Hecho |
| Gráfica de tickets por categoría | Pendiente |

**Hecho:** login, creación de tickets con prioridad y vencimientos, etiquetas, "Otro", tablero con filtros, edición con notas obligatorias, escalamiento, aprobaciones, comentarios y vista del cliente. Los datos de demostración, con 24 tickets, están en `prisma/seed-demo.ts`; ver `infraestructura.md`.

Pendientes, en orden.

1. **Estadísticas.** Gráficas de tickets por servicio, que es la categoría que pide el enunciado, y por etiqueta, prioridad y tipo. Los datos de demostración ya reparten tickets en los seis servicios.
2. **Problemas en el sistema.** Ligar incidentes a un problema y seguir su flujo, para agentes de nivel 2 o 3 y supervisión. El modelo ya existe; falta la pantalla.
3. **Análisis de gestión de problemas.** Documento que mapea los problemas probables de cada servicio: causa raíz posible, incidentes que lo delatan y workaround. Lo pide un objetivo del enunciado y no es una pantalla.
4. **Guion de la demostración.** El recorrido con los datos de demostración está en `casos-de-uso.md`; falta el guion con el orden y el tiempo de cada parte.
5. **Presentación en clase.** Vale el 25%. Debe justificar el catálogo y las prioridades, y mostrar los ajustes a la Fase 1 como mejora continua.

Opcional, solo si sobra tiempo:

* **Pruebas unitarias de las reglas puras.** El reloj de SLA, el piso VIP, el cálculo de prioridad y vencimientos, el ciclo de vida y las etiquetas. Son rápidas y no necesitan base de datos. Se pueden sumar al pipeline. Las pruebas de navegador quedan fuera: `casos-de-uso.md` sirve como lista para repasar a mano antes de la demostración.
* **Revisar las pantallas en móvil.**

Por decidir con el equipo:

* **El catálogo pasó de 17 a 23 elementos** con los "Otro". El equipo aprobó 17.
* **Qué más requiere aprobación de forma predefinida.** Hoy solo S-3. S-5 cambia lo acordado con el cliente, y una baja de usuario no está en el catálogo.
* **Límite de intentos de inicio de sesión** en el firewall de Vercel. Opcional.
