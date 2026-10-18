# BuyCarMap 2.0

Todos los coches de segunda mano de Wallapop, coches.net y Milanuncios en un solo mapa. El sistema es negro, macarra y limpio: mucho negro, dos tintas complementarias (lime y violeta) y titulares en mayúsculas que hablan como un colega.

## Voz

Hablamos como alguien del barrio que sabe de coches, no como un banco. Frases cortas, coloquiales, con chulería, sin vender humo: nunca prometemos cifras que no tenemos.

- Titular de la landing: «¿EN BUSCA DE COCHE? **MIRA EL MAPA**».
- Titular de Entrar: «¿TE MOLA UN COCHE? **GUÁRDALO**».
- Subtítulo de la landing: «Una web, toda la segunda mano, sin cincuenta pestañas.»
- Alertas: «El que no corre vuela, guárdalo y nosotros te avisamos.»
- Entrar: «Recibir alertas es gratis, regístrate y nos encargamos del resto.»

Reglas:
- Los titulares son **pregunta y remate**. La pregunta plantea, el remate golpea. Sin punto final en el remate.
- Botones y controles dicen lo que pasa, sin rollo: «Buscar», «Guardar», «Ver anuncio», «Crear alerta».
- Nunca «Bienvenido a…», «Descubre…», «La mejor forma de…», ni cifras inventadas («50K+», «100 %»).
- Nombres de las fuentes tal cual: Wallapop, coches.net, Milanuncios.
- Precios en formato español, siempre con punto de miles: `14.500 €`, `9.500 €`. Igual en tarjetas, vista previa, pines, chips y buscador. Kilómetros: `95.000 km`. Metadatos separados por « · ».

## Color

Una noche con una sola luz. `bg` y `surface` hacen el 95 % de la pantalla; `lime` es la luz.

- **`lime` solo para** lo que haces o miras ahora: precios, el «MAP» del logo, el remate del titular, los botones principales, el pin activo y su tarjeta, el borde de la alerta abierta, la barra del índice de las páginas legales, los enlaces de texto «Créala» y «Entra», el hover de los enlaces, el anillo de foco y la acción del aviso («Deshacer»). Encima, siempre `on-lime`.
- **Botones principales**: uno por tarea, como mucho dos por vista cuando son tareas distintas: en la landing «Crear cuenta» (cabecera) y «Buscar»; en Alertas «Nueva alerta» y «Ver anuncio» de la vista previa.
- **`violet`**, el complementario del lime, para lo que es tuyo y los estados: corazón guardado, chip activo y filtro puesto, número de filtros, avatar de la cuenta y la sección actual de la barra inferior. Encima, siempre `on-violet`. Regla rápida: lime = lo que haces o miras ahora; violeta = lo tuyo.
- **`surface-strong`** (`#1E1E22`), un escalón sobre `surface`: la opción bajo el ratón en un selector y la barra del precio en el esqueleto de carga.
- **Fotos vacías**: cada coche sin foto lleva su tinte (`photo-tint-1` a `photo-tint-8`) con el icono de coche en `photo-icon`; `photo-placeholder` queda para la hoja inferior y lo que aún carga.
- **Tokens de un solo sitio**: `handle` (asa del panel inferior), `text-legal` (cuerpo de las páginas legales), `map-road-minor` (calles pequeñas), `scrim` (insignias y botones sobre una foto, al 85 %) y `google-bg`, `google-line`, `google-text`, que impone Google para su botón y no son de la marca.
- **`danger`** (`#FF5C5C`) solo para lo que no tiene vuelta atrás (Eliminar cuenta, Eliminar alerta) y para el hover de deshacer («Quitar filtros»).
- **Nunca** lime en texto corrido, en bordes decorativos ni en fondos grandes.
- Texto en `text` (blanco roto) y `text-muted`; nunca blanco puro ni negro puro dentro de la app.
- Bordes de 1px en `line`; divisores en `line-soft`. Sin sombras salvo `shadow-float` (la vista previa sobre el mapa, el aviso y la lista de un selector), `shadow-pin-active` y el aro del avatar en Cuenta en escritorio (`shadow-current`).
- El color de las fuentes (Wallapop, coches.net, Milanuncios) no entra: la fuente va como insignia oscura con texto, no como mancha de color de marca.

## Tipografía

Dos familias, las dos de Google Fonts:

- **Unbounded** (`display`): ancha, gorda, siempre en MAYÚSCULAS. Logo, titulares, contadores y precios. Peso 800–900.
- **Rethink Sans** (`sans`): todo lo demás. 400 para texto, 500 para las opciones de una lista, 600–700 para controles.
- Estilos propios de una pantalla: `form-title`, `page-title-mobile`, `empty-title`, `legal-h1`, `legal-h2`, `legal-body`, `lead-mobile`, `body-15`, `small`, `field-label`, `account-name` (22px, el nombre de la tarjeta propia de Cuenta en escritorio) y `section-label` (secciones de filtros, 12px; `overline`, 11px, queda para el buscador píldora).
- Tamaños de móvil y de componente: `count-mobile` (15px, el número de coches en la hoja inferior), `empty-title-mobile` (28px / 1,06 / -0,01 em), `headline-setup` (la pregunta de un Headline: 0,56 em / 1,1 / 0), `sheet-title` (15px, título de una hoja), `box-label` (11px, cajas del panel de filtros), `tab-label` (11px, pestañas de la barra inferior), `pin` (13px, pin en móvil), `empty-line` (17px / 1,5, línea de un EmptyState en escritorio), `alert-name` (17px, el nombre de una AlertCard en escritorio) y `alert-title` (40px / 1,04 / -0,01 em, el nombre de una alerta como título de su página en escritorio, que puede ocupar dos líneas).
- Espacios con margen seguro y medidas de móvil: `space-tab-clearance` (88px + margen seguro inferior), `space-sheet-bottom` (2,125 rem + inferior), `space-band-top` / `space-band-left` / `space-band-right` (la banda de arriba del mapa en móvil: 1,25 rem arriba y 1 rem a los lados, más su margen seguro), `space-sheet-full-bottom` (1,5 rem + inferior: el final de la lista de la hoja en completa), `space-sheet-above-tabs` (4 rem + inferior), `space-sheet-middle` (la hoja media: `min(32.5rem, 100% − barra inferior − margen seguro inferior − 0,75rem)`, bajo la banda de arriba), `space-sheet-footer` (1,75 rem + inferior), `space-safe-top` y `space-safe-bottom` (los márgenes seguros superior e inferior, sin más: el panel de filtros a pantalla completa y la barra inferior), `space-sheet-max` (alto máximo de una hoja inferior: `100dvh` menos el margen seguro superior), `space-dialog-max` (alto máximo del diálogo centrado de Cuenta: `100dvh` menos 2 rem), `grid-template-columns-legal` (las columnas de las páginas legales: el índice de 16,25 rem y la lectura de 45 rem como mucho), `space-headline-gap` (0,22 em entre pregunta y remate) y `space-filters-max` (alto máximo del desplegable de filtros: `min(40rem, altura disponible)`).
- Trazo propio: `border-thin` (1,5px), el aro del círculo de Cuenta sin marcar en la barra inferior y el borde de la casilla.
- Radios propios: `radius-panel` (28, formularios y mapa de la landing), `radius-preview` (24), `radius-thumb` (18), `radius-option` (12) y `radius-skeleton` / `radius-skeleton-sm` (8 / 6).

Reglas de los titulares grandes, que se han ajustado a ojo:
- Varias líneas: interlineado **1,04** en escritorio y **1,06** en móvil. Unbounded tiene las mayúsculas muy altas y las tildes (Á, Í, Ó) chocan si se baja de ahí. Una línea sola: 0,9.
- Espacio entre letras **-0,01 em** (también en móvil); con -0,03 las letras se tocan. El logo y los precios, sin espacio entre letras.
- La pregunta va a **0,56** del tamaño del remate, en una línea, en `text`. El remate, en `lime`.
- Cortes de línea con sentido: nunca una palabra sola en una línea. `text-wrap: balance`.
- Recorte del cuadro a la altura de las mayúsculas (`text-box: trim-both cap alphabetic`), para medir los espacios desde las letras.

## Estructura de pantalla

- **Mapa en escritorio**: la cabecera es una banda `surface` de 151px, sin divisor, a 48px de los lados: arriba el logo, el buscador píldora «Dónde · Coche · Precio» de 48px con «Crear alerta» justo al lado, y a la derecha idioma ES · EN, Favoritos, Alertas y el avatar; debajo, centrados, «Filtros» (abre el panel en un desplegable anclado debajo, con el número de criterios activos), un divisor y los filtros rápidos (Gasolina, Diésel, Manual, Automático, Hasta 100.000 km), sin chips que quitar. Bajo la banda, la lista y el mapa se reparten el ancho entre márgenes de 48px, en dos mitades a 48px: la lista a la izquierda, con el número de coches como título (una línea, 24px bajo la banda), sin control de orden y en dos columnas (tres desde 1920px, a 24px entre columnas y 40px entre filas); el mapa a la derecha, una tarjeta con `radius-card` y sin borde, alineada arriba con el título y a 24px del borde de abajo, con pines de precio. Cada segmento del buscador abre su SearchPopover anclado debajo. «Crear alerta», junto al buscador, abre CreateAlert anclado debajo.
- **Mapa en móvil**: una banda `surface` arriba, sin borde, con el resumen del buscador (tocarlo abre la hoja «BUSCAR», ver SearchPopover), «Filtros» redondo de 44px con su insignia y, debajo, los filtros rápidos, que se deslizan en horizontal; el mapa debajo de la banda, la hoja inferior con el número de coches, «Crear alerta» (abre CreateAlert como hoja inferior) y las tarjetas, y debajo la barra inferior (BottomNav), que se esconde con la hoja completa. «Filtros» abre el panel a pantalla completa. Un pin abre la hoja del coche (BottomSheet).
- **Páginas en móvil** (Guardados, Alertas, Cuenta y la página de una alerta): cabecera `surface` de 64px, sin divisor, con el wordmark y el idioma, sin avatar (la página de una alerta, con «Volver» delante); el contenido; y la barra inferior, que se esconde al desplazar hacia abajo y vuelve al subir. Una fila de Guardados abre la hoja del coche; una alerta abre su página, con la zona, las coincidencias y «Eliminar alerta».
- **Landing con sesión en móvil**: cabecera con el wordmark y el idioma, sin avatar, y la barra inferior sin ninguna pestaña marcada (ver HeaderNav y BottomNav).
- **Esto no existe** (no encontrado): sin sesión, la cabecera de Entrar («Volver al mapa») y sin barra inferior; con sesión, la cabecera de las páginas sin sección actual y, en móvil, la barra inferior sin ninguna pestaña marcada, como la landing con sesión (ver HeaderNav y BottomNav).
- **Mapa**: oscuro y mínimo (`map-ground`, `map-road`, `map-road-major`, `map-water`), casi sin etiquetas. Los pines son píldoras con el precio; el activo pasa a lime con halo.
- **Lista y mapa van sincronizados en toda pantalla con mapa** (Mapa, Guardados, Alertas): al pulsar un pin se activa, se abre la vista previa encima del mapa (no una página nueva) y su tarjeta de la lista se marca con el contorno lime. Pasar el ratón o el foco por una tarjeta activa su pin.
- **Guardados y Alertas en escritorio**: nunca sin mapa. Lista de 830px a la izquierda y mapa a la derecha, con el título de página (40px, sin contador). En Guardados, un pin por coche guardado. En Alertas, la alerta elegida se abre con sus criterios y sus últimas coincidencias; las demás se pliegan a una línea de resumen. Con más de 4, «Ver las N coincidencias» lleva a la página de la alerta, que en escritorio también tiene lista y mapa: todas las coincidencias en 3 columnas y el mapa con la zona y sus pines. Desde 1024px, la lista mide 546px.
- **Zona de alerta** en el mapa: círculo con borde `lime` de 2px al 80% y relleno `lime` al 10%, más un punto de centro en `text`. Sin discontinuo: tiene que leerse como zona, no gritar.
- **Títulos de página sin contador**: «GUARDADOS», «ALERTAS». La lista del mapa, en cambio, lleva el número como título, en escritorio y en la hoja inferior: «MÁS DE 40 COCHES» mientras quedan páginas por traer, «24 COCHES» cuando las fuentes se acaban, «1 COCHE»; «MÁS DE 1 COCHE» con uno y más por traer. Sin número: «BUSCANDO COCHES…» mientras carga, «NINGÚN COCHE» sin resultados y «COCHES» si la búsqueda falla, sin el sitio debajo.

- **Cuenta**: sin mapa. Título «CUENTA», una línea («Tus datos, tus reglas.») y una rejilla de 3 columnas de AccountCard, la primera la tuya. Eliminar cuenta, abajo, en `danger`.
- **Pantallas de acceso** (registro, recuperar y nueva contraseña, confirmar cuenta): la misma estructura que Entrar, titular a la izquierda y formulario a la derecha; el registro con la ilustración, el resto sin ella. En móvil, titular arriba y la acción abajo del todo. El panel de 440px y los campos de Entrar (`/login`) son el patrón que reutilizan estas pantallas en F7.
- **Vacíos, errores y carga**: dentro de la pantalla real, con EmptyState. Nunca un icono decorativo encima del titular.
- **Legales**: página de lectura de 720px con índice a la izquierda y el pie.

## Ilustraciones y flechas

Solo en la landing, en Entrar y en el registro, para romper la caja sin restar sitio al mapa.

- **Ilustraciones**: de Storyset (Freepik), estilo «Cuate», con el fondo oculto. Landing: «Vehicle sale». Entrar y registro: «By my car».
- **Color**: el coche y las hojas en `lime`; la ropa que venía en el color de acento, en `text` (blanco); suelo y sombra oscurecidos a tonos de superficie. El resto, como viene.
- **Sitio**: detrás del contenido, abajo a la izquierda, siempre entera, con su suelo, y por encima de la fila del pie: nunca la corta el borde inferior ni una franja. Nunca encima de un campo, botón o texto. En portátil y escritorio (desde 1024px) ocupa el alto que queda entre el contenido y el pie, a su proporción y con tope (480px de ancho en la landing de portátil, 440px en Entrar de portátil, el tamaño de los tableros en 1440px), con el hueco normal de la pantalla medido hasta el dibujo; si en ese alto no caben 150px de dibujo, no sale, y la página nunca baja por ella. En Entrar y Registro de escritorio, el bloque de la izquierda (titular, subtítulo e ilustración) va centrado en vertical, como un solo grupo, a la altura del formulario.
- **Flechas**: trazo `lime` de 3,5px con punta abierta, detrás del contenido. En la landing salen del final del titular, una al borde del mapa a la altura del pin activo y otra al centro del lado derecho de «Buscar». En Entrar va del titular a la «o» entre los dos botones, fuera del formulario. Nunca cruzan un campo ni un botón.
- **Móvil**: sin flechas. Landing: el mapa muestra la tarjeta ([ListingCard](components/ListingCard/README.md), «Tarjeta del mapa de la landing»), sin ilustración; la ilustración se queda en la landing de escritorio, en Entrar y en el registro. Entrar: debajo de los botones, centrada.
- **Portátil (1024px)**: la landing sin la vista previa del mapa ni flechas, con el contenido centrado, la ilustración centrada debajo y los enlaces del pie justo debajo de ella; Entrar con la composición del móvil en una columna centrada de 440px, la ilustración centrada debajo, y la cabecera y el pie de escritorio. La vista previa del mapa y las dos columnas de Entrar empiezan en 1440px, el ancho de escritorio.
- **Atribución obligatoria** (licencia gratuita de Freepik): «Ilustraciones de Storyset» con enlace a storyset.com, en el pie.

## Iconos

Lucide, trazo 2px (2,4–2,6 en botones pequeños sobre lime), esquinas redondas, en el color del texto que los rodea. Sin emojis. Logo: solo tipografía, «BUYCAR» en `text` y «MAP» en `lime`; no hay archivo de logo.

## Accesibilidad

- `text-muted` sobre `bg` 7,6:1; `on-lime` sobre `lime` más de 15:1; `on-violet` sobre `violet` 4,6:1.
- Lo activo no se marca solo con color: el chip activo cambia de relleno y peso; el pin activo, de relleno, tamaño y halo.
- Controles de 44px mínimo en móvil; campos a 16px.
