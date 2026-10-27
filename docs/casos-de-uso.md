# Casos de uso validados

Escenarios comprobados de punta a punta y su resultado esperado. Las reglas están en `service-desk.md`; aquí está qué se probó que funciona.

## Cómo se validaron

* **Fecha.** 26 de octubre de 2026, sobre el código que agrega comentarios, filtros, notas obligatorias, aprobaciones, "Otro" y los datos de demostración.
* **Cómo.** Chrome sin ventana, manejado por un script que inicia sesión con cada usuario de demostración, usa las pantallas como una persona y revisa la base después de cada paso. Contra la rama `dev` de Neon y el build de producción en local.
* **Resultado.** Todos los casos de este documento pasaron, sin errores en el log del servidor.
* **Antes de la demo,** repetirlos a mano con los usuarios de `infraestructura.md`. Los datos de demostración ayudan: cada caso tiene un ticket que lo muestra, como se ve al final.
* **Las reglas** de cada caso están en `service-desk.md`, incluida la tabla de qué puede hacer cada rol.

## Cliente

| Caso | Pasos | Resultado esperado |
|---|---|---|
| CU-01 Iniciar sesión | Entrar con correo y contraseña | Llega a "Mis tickets" |
| CU-02 Reportar un incidente | Elegir servicio y elemento, escribir título y descripción, responder alcance y urgencia | Se crea con prioridad y vencimientos calculados; el detalle lo muestra |
| CU-03 Piso VIP | Cliente VIP reporta un caso que la matriz deja en P4 | Queda en P2 |
| CU-04 Reloj de cliente Normal | Cliente Normal reporta un sábado | La primera respuesta vence el lunes, dentro del horario de atención |
| CU-05 Caso que no está en la lista | Elegir "Otro problema con…" | Se crea sin bloquear; el servicio queda correcto |
| CU-06 Solicitud con autorización | Elegir S-3 y responder que será ADMIN | El ticket avisa que necesita autorización |
| CU-07 Etiquetas | Escribir "Excel, Carga lenta, excel" | Se guardan "excel" y "carga lenta", sin repetir |
| CU-08 Ver su ticket | Abrir el detalle | Ve estado, quién lo atiende y "Primera respuesta antes de…"; no ve prioridad, impacto, urgencia, nivel ni medidor |
| CU-09 Conversar | Agregar un comentario | Su mensaje sale a la derecha como "Tú"; los agentes aparecen como "Equipo de soporte" |
| CU-10 Saber por qué cambió su ticket | El agente resuelve y luego reabre | Ve las notas con etiqueta Solución y Reapertura |

## Personal de soporte

| Caso | Pasos | Resultado esperado |
|---|---|---|
| CU-11 Entrar al tablero | Iniciar sesión como agente | Llega a `/tablero` con cinco columnas por estado |
| CU-12 Orden de la cola | Ver la columna Abierto | P1 primero; entre iguales, el vencimiento más cercano |
| CU-13 Avisos en tarjetas | Ver un VIP vencido y una solicitud pendiente | Marcas "Escalar a nivel 2" y "Por aprobar" |
| CU-14 Tomar y atender | Tomar ticket y ponerlo en progreso | Queda asignado; se guarda la primera respuesta; el medidor pasa a Resolución |
| CU-15 Escalar | Escalar a nivel 2 con nota | Pasa a Escalado y nivel 2; si el agente no tiene ese nivel, queda sin asignar |
| CU-16 Resolver y cerrar | Resolver y cerrar, cada uno con su nota | Llega a Cerrado; ya no recibe comentarios |
| CU-17 Reabrir | Reabrir un resuelto con nota | Vuelve a En progreso |
| CU-18 Reclasificar | Cambiar impacto y urgencia | Recalcula prioridad y vencimientos; Normal de P4 a P1 |
| CU-19 Clasificar un "Otro" | Cambiar el elemento del catálogo a S-3 | Cambia el tipo a solicitud y exige aprobación por precaución |
| CU-20 Nota interna | Comentar marcando "Es nota interna" | El personal la ve resaltada; el cliente no |
| CU-21 Pedir aprobación | Un agente pide aprobación con nota en un ticket en progreso | Queda "Por aprobar"; no se puede resolver hasta que se apruebe |
| CU-22 Historial | Abrir el detalle tras varios cambios | Cada cambio aparece con quién y cuándo |
| CU-23 Filtros | Filtrar por cliente, servicio, prioridad o "Asignados a mí" | El tablero muestra solo lo que coincide |

## Supervisión y administración

| Caso | Pasos | Resultado esperado |
|---|---|---|
| CU-24 Aprobar | Aprobar una solicitud o un ticket con aprobación pedida | Queda aprobado y el agente puede atenderlo |
| CU-25 Asignar a cualquiera | Asignar un escalado a un agente de nivel 2 | Queda asignado |
| CU-26 Carga por agente | Ver "Pendientes por agente" y filtrar por una persona | Muestra cuántos tiene cada uno y sus tickets |
| CU-27 Ciclo completo | Asignar, poner en progreso, resolver y cerrar | Llega a Cerrado con su historial |

## Seguridad: lo que debe fallar

| Caso | Intento | Resultado esperado |
|---|---|---|
| CU-28 Tablero para clientes | Un cliente abre `/tablero` | Vuelve a "Mis tickets" |
| CU-29 Ticket de otra empresa | Un cliente abre un ticket ajeno | Página de "no existe" |
| CU-30 Sesión falsa | Cookie de ADMIN fabricada sin el secreto | Vuelve al login |
| CU-31 Nota interna inyectada | Un cliente agrega a mano la casilla al formulario | El servidor guarda el comentario como público |
| CU-32 Nota interna en el navegador | Revisar el HTML y los datos de la página del cliente | El texto de la nota no aparece |
| CU-33 Asignar fuera de nivel | Alterar el formulario para asignar un escalado a nivel 1 | El servidor lo rechaza |
| CU-34 Nota vacía | Forzar el botón y enviar solo espacios | El servidor responde "Falta la nota" y no cambia nada |
| CU-35 Atender sin aprobación | Poner en progreso o resolver algo pendiente de aprobación | Se rechaza |
| CU-36 Actuar fuera de nivel | Agente de nivel 1 en un ticket de nivel 2 | No ve acciones de estado ni de clasificación |
| CU-37 Aprobar sin rol | Un agente busca el botón de aprobar | No aparece |
| CU-38 Filtrar por otra persona | Un agente pone en la URL el filtro de otro agente | Se ignora; no ve la carga de otros |
| CU-39 URL inventada | `prioridad=P9` o un cliente que no existe | Se ignora sin romper la página |
| CU-40 Más de 5 etiquetas | Escribir seis | Error junto al campo, sin perder lo escrito |
| CU-41 Supervisión pide aprobación | Supervisión o administración abren un ticket | No ven "Pedir aprobación": son quienes aprueban |

## Datos de demostración

| Caso | Pasos | Resultado esperado |
|---|---|---|
| CU-42 Ver qué haría | `npm run seed:demo` sin `--yes` | Imprime la base de destino y cuántos tickets borraría y crearía; no cambia nada |
| CU-43 Volver al punto de partida | `npm run seed:demo -- --yes`, dos veces seguidas | Deja los mismos 24 tickets; el primero es el #1 |
| CU-44 Cobertura | Abrir el tablero con supervisión | Cinco columnas con 6, 7, 2, 2 y 7 tickets; los seis servicios tienen tickets; hay VIP y Normal, de las cuatro empresas |
| CU-45 Historial coherente | Abrir cualquier ticket con historia | Los cambios, las notas y las etiquetas siguen las mismas reglas que la aplicación: el script falla si un guion las rompe |

## Recorrido con los datos de demostración

Cada ticket de ejemplo muestra una función. Para recorrerlos, entrar como supervisión al tablero y, para la vista del cliente, como `cliente.vip@altamira.demo`.

| Ticket | Qué muestra |
|---|---|
| No podemos crear tickets desde el portal | La cola ordenada por prioridad: un P1 de un servicio núcleo, de un cliente VIP, arriba de todo y con la primera respuesta a punto de vencer |
| La carga de Excel no termina | El piso VIP: la matriz da P3 y queda en P2 |
| El reporte semanal no carga | Un cliente Normal: su plazo depende del horario de atención |
| Un usuario no puede iniciar sesión | Un cliente Normal sin atender por seis días: vencido y con el aviso "Avisar a supervisión" |
| Alta de un administrador para el área de finanzas | Una solicitud con autorización: "Por aprobar" hasta que supervisión apruebe |
| Alta de un usuario para el área de contabilidad | La misma solicitud ya aprobada y atendida |
| Necesitamos cambiar el correo de varios usuarios | Un "Otro" sin clasificar, que el agente pasa al elemento correcto con "Cambiar elemento" |
| No nos llegan los correos para restablecer la contraseña | Un "Otro" ya reclasificado: el historial muestra el cambio de elemento |
| Necesitamos dar de baja a un usuario que ya no trabaja con nosotros | Un caso delicado que el catálogo no prevé: el agente pidió aprobación |
| La lista de tickets no carga a la mitad del equipo | Un P1 escalado a nivel 2, sin fecha de resolución porque la atención es continua |
| Faltan tickets después de una carga de Excel | Un ticket escalado a nivel 3 y atendido por plataforma, con la resolución vencida |
| La cola de procesamiento acumula trabajos | Un servicio de soporte que sube a P2 por urgencia, escalado a plataforma |
| La carga de Excel se queda procesando | Una conversación entre cliente y agente, con una nota interna que el cliente no ve |
| No puedo entrar con mi usuario desde esta mañana | Un ticket resuelto que espera la confirmación del cliente |
| Cambiar el horario de atención de nuestra sede norte | Una solicitud resuelta |
| Un analista no puede cerrar un ticket | La historia completa de una reapertura: Solución, Reapertura, otra Solución y Cierre |
| Nadie puede iniciar sesión en el portal | Un P1 que se escaló, se resolvió y se cerró, con sus notas |
| Reporte de uptime del último mes | Un P5: sin compromiso inmediato |
| El reporte de resolución da error 500 | Un ticket cerrado con etiquetas |

Para mostrar la diferencia entre lo que ve el personal y el cliente, abrir el mismo ticket con las dos cuentas. Los tiempos se calculan al momento de correr los datos de demostración; conviene ejecutarlos poco antes de empezar.
