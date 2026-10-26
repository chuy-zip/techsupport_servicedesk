# Guía de estilo del Service Desk

Reglas visuales del Service Desk. Se inspiran en dos referencias: una landing editorial en verde oliva, de donde salen el verde, la tipografía serif para títulos y las etiquetas pequeñas en mayúsculas; y una página de evento con acento lima, de donde salen el lima, las fichas redondeadas y las tarjetas blancas sobre fondo claro.

Los valores viven en `src/app/globals.css` como variables de Tailwind. En el código se usan siempre los nombres de la tabla, nunca un color escrito a mano.

## Idea central

Es una herramienta de trabajo, no una landing. La personalidad está en la tipografía y en el verde; todo lo demás es callado. El elemento propio del sistema es el **medidor de SLA**: una línea delgada bajo cada ticket que muestra cuánto del tiempo comprometido ya se consumió. Toma la idea de una barra de progreso, pero con un dato real en vez de un adorno.

## Color

| Nombre | Valor | Uso |
|---|---|---|
| `olive` | `#556B2F` | Marca. Botón principal, enlaces, etiquetas, panel de la portada |
| `olive-dark` | `#3F5022` | Hover del botón principal y texto verde sobre fondos claros |
| `lime` | `#D6F29B` | Acento. Como fondo detrás de íconos o texto oscuro, o como texto solo sobre `olive`. Nunca como texto sobre fondos claros |
| `ink` | `#2B2E26` | Títulos y texto principal |
| `muted` | `#62665C` | Texto secundario y etiquetas de campos |
| `line` | `#E3E5DD` | Bordes y divisores |
| `canvas` | `#F5F6F1` | Fondo de la página |
| `surface` | `#FFFFFF` | Tarjetas, formularios y tablas |

* **Contraste.** `ink`, `muted` y `olive` cumplen AA sobre `canvas` y `surface`. El gris `#888888` de la referencia original no cumple para texto pequeño; por eso `muted` es más oscuro.
* **Sin modo oscuro por ahora.** Se agrega solo si sobra tiempo.

### Prioridades y estados

Las prioridades tienen color propio, distinto del verde, para que lo urgente se vea de lejos. El color nunca va solo: siempre acompaña al texto, como "P1 Crítica".

| Prioridad | Texto | Fondo |
|---|---|---|
| P1 Crítica | `#9F1D14` | `#FBE4E1` |
| P2 Alta | `#9A4A0B` | `#FCEBD9` |
| P3 Media | `#7A5A06` | `#FAF0CC` |
| P4 Baja | `#35556E` | `#E3EDF4` |
| P5 Planificada | `#62665C` | `#ECEDE8` |

Los estados del ticket usan fichas neutras con borde. Solo RESOLVED y CLOSED usan `lime` de fondo.

## Tipografía

| Rol | Fuente | Uso |
|---|---|---|
| Títulos | Libre Baskerville, 700 | Título de cada página y el panel de la portada. Con moderación: nunca en botones, tablas ni formularios |
| Texto | Inter, 400 a 600 | Todo lo demás |
| Etiquetas | Inter 600, 11 px, mayúsculas, espaciado 0.16em, en `olive` | Nombre de sección o de servicio sobre un título |
| Cifras | Inter con números tabulares | Folios, tiempos y conteos, para que no bailen al cambiar |

Escala: 44 px para el título de la portada, 30 px para títulos de página, 20 px para subtítulos, 15 px para texto y 13 px para detalles.

Las etiquetas en mayúsculas nombran algo real, como el servicio o la sección. No se numeran 01, 02 salvo que el contenido sea de verdad una secuencia.

## Componentes

* **Botón principal.** Fondo `olive`, texto blanco, esquinas de 10 px. Hover en `olive-dark`. Un solo botón principal por pantalla.
* **Botón secundario.** Fondo `surface`, borde `line`, texto `ink`.
* **Campos.** Fondo `surface`, borde `line`, esquinas de 10 px y etiqueta arriba en `muted`. Con foco, borde `olive`.
* **Foco con teclado.** Contorno de 2 px en `olive`, separado 2 px. Nunca se quita.
* **Tarjetas.** Fondo `surface`, borde `line`, esquinas de 16 px y una sombra muy tenue en capas.
* **Fichas.** Forma de píldora, para categoría, prioridad y estado.
* **Errores.** Texto en el rojo de P1, que diga qué pasó y cómo seguir.

## Movimiento

* **Portada y login.** Solo una entrada: el contenido sube 12 px y aparece en 500 ms con la curva `cubic-bezier(0.16, 1, 0.3, 1)`.
* **Pantallas de trabajo.** Solo transiciones de color u opacidad de menos de 200 ms.
* **Prohibido.** Barras que avanzan solas, rebotes, pulsos repetidos y animaciones al hacer scroll en el tablero.
* **Movimiento reducido.** Si el sistema lo pide, no hay ninguna animación.

## Cómo se escribe en el código

* **`src/app/globals.css` solo tiene lo global.** Tokens de color, fuente, tamaño de texto, radio y sombra; estilos base del cuerpo y del foco; y la regla de movimiento reducido. No crece con cada pantalla.
* **Lo que se repite es un componente, no una clase.** Botones, campos, tarjetas, etiquetas y fichas viven en `src/components/ui`, con sus clases en un solo lugar. Si cambia el botón, se cambia en un archivo.
* **En las páginas, solo clases de acomodo.** Márgenes, columnas, anchos y alineación. Los colores, bordes y radios salen de los componentes o de los tokens, como `text-muted` o `rounded-control`, nunca de valores sueltos como `text-[13px]`.
* **Sin archivos CSS por componente.** Con Tailwind serían un segundo sistema para lo mismo, y no quedaría claro dónde buscar un estilo.
* **Variantes con una propiedad.** Por ejemplo `<Button variant="secondary">`. El `className` que recibe un componente es solo para acomodo.
* **Comentarios que se sostienen solos.** Explican el porqué sin apuntar a un documento; los documentos cambian de lugar y el código se lee sin ellos.

## Medidor de SLA

* Una línea de 3 px bajo el ticket, sobre fondo `line`.
* Se llena según el tiempo consumido del SLA: `olive` hasta la alerta interna, el naranja de P2 desde la alerta y el rojo de P1 cuando se incumple.
* Es estático: se calcula al cargar y no se anima solo.
* Siempre va con el tiempo restante en texto, como "Faltan 35 min".
