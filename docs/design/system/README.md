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
- Precios en formato español: `14.500 €`. Kilómetros: `95.000 km`. Metadatos separados por « · ».

## Color

Una noche con una sola luz. `bg` y `surface` hacen el 95 % de la pantalla; `lime` es la luz.

- **`lime` solo para** lo que haces o miras ahora: precios, el «MAP» del logo, el remate del titular, los botones principales, el pin activo y su tarjeta, el borde de la alerta abierta, la barra del índice de las páginas legales, los enlaces de texto «Créala» y «Entra», el hover de los enlaces, el anillo de foco y la acción del aviso («Deshacer»). Encima, siempre `on-lime`.
- **Botones principales**: uno por tarea, como mucho dos por vista cuando son tareas distintas: en la landing «Crear cuenta» (cabecera) y «Buscar»; en Alertas «Nueva alerta» y «Ver anuncio» de la vista previa.
- **`violet`**, el complementario del lime, para lo que es tuyo y los estados: corazón guardado, chip activo, número de filtros, avatar de la cuenta y la sección actual de la barra inferior. Encima, siempre `on-violet`. Regla rápida: lime = lo que haces o miras ahora; violeta = lo tuyo.
- **`surface-strong`** (`#1E1E22`), un escalón sobre `surface`: la opción bajo el ratón en un selector y la barra del precio en el esqueleto de carga.
- **Fotos vacías**: cada coche sin foto lleva su tinte (`photo-tint-1` a `photo-tint-8`) con el icono de coche en `photo-icon`; `photo-placeholder` queda para la hoja inferior y lo que aún carga.
- **Tokens de un solo sitio**: `handle` (asa del panel inferior), `text-legal` (cuerpo de las páginas legales), `map-road-minor` (calles pequeñas), `scrim` (insignias y botones sobre una foto, al 85 %) y `google-bg`, `google-line`, `google-text`, que impone Google para su botón y no son de la marca.
- **`danger`** (`#FF5C5C`) solo para lo que no tiene vuelta atrás (Eliminar cuenta) y para el hover de deshacer («Quitar filtros»).
- **Nunca** lime en texto corrido, en bordes decorativos ni en fondos grandes.
- Texto en `text` (blanco roto) y `text-muted`; nunca blanco puro ni negro puro dentro de la app.
- Bordes de 1px en `line`; divisores en `line-soft`. Sin sombras salvo `shadow-float` (la vista previa sobre el mapa, el aviso y la lista de un selector), `shadow-pin-active` y el aro del avatar en Cuenta (`shadow-current`, `shadow-current-sm` en móvil).
- El color de las fuentes (Wallapop, coches.net, Milanuncios) no entra: la fuente va como insignia oscura con texto, no como mancha de color de marca.

## Tipografía

Dos familias, las dos de Google Fonts:

- **Unbounded** (`display`): ancha, gorda, siempre en MAYÚSCULAS. Logo, titulares, contadores y precios. Peso 800–900.
- **Rethink Sans** (`sans`): todo lo demás. 400 para texto, 500 para las opciones de una lista, 600–700 para controles.
- Estilos propios de una pantalla: `form-title`, `page-title-mobile`, `empty-title`, `legal-h1`, `legal-h2`, `legal-body`, `lead-mobile`, `body-15`, `small`, `field-label` y `section-label` (secciones de filtros, 12px; `overline`, 11px, queda para el buscador píldora).
- Radios propios: `radius-panel` (28, formularios y mapa de la landing), `radius-preview` (24), `radius-thumb` (18), `radius-option` (12) y `radius-skeleton` / `radius-skeleton-sm` (8 / 6).

Reglas de los titulares grandes, que se han ajustado a ojo:
- Varias líneas: interlineado **1,04** en escritorio y **1,06** en móvil. Unbounded tiene las mayúsculas muy altas y las tildes (Á, Í, Ó) chocan si se baja de ahí. Una línea sola: 0,9.
- Espacio entre letras **-0,01 em** (también en móvil); con -0,03 las letras se tocan. El logo y los precios, sin espacio entre letras.
- La pregunta va a **0,56** del tamaño del remate, en una línea, en `text`. El remate, en `lime`.
- Cortes de línea con sentido: nunca una palabra sola en una línea. `text-wrap: balance`.
- Recorte del cuadro a la altura de las mayúsculas (`text-box: trim-both cap alphabetic`), para medir los espacios desde las letras.

## Estructura de pantalla

- **Mapa en escritorio**: cabecera de 80px (logo, buscador píldora «Dónde · Coche · Precio» con «Crear alerta» justo al lado, y a la derecha idioma ES · EN, Favoritos, Alertas y el avatar); fila de chips rápidos + «Filtros»; rejilla de tres columnas a la izquierda y mapa a la derecha con pines de precio.
- **Mapa en móvil**: mapa a pantalla completa, buscador píldora flotando arriba con chips, y la hoja inferior con el contador y las tarjetas.
- **Mapa**: oscuro y mínimo (`map-ground`, `map-road`, `map-road-major`, `map-water`), casi sin etiquetas. Los pines son píldoras con el precio; el activo pasa a lime con halo.
- **Lista y mapa van sincronizados en toda pantalla con mapa** (Mapa, Guardados, Alertas): al pulsar un pin se activa, se abre la vista previa encima del mapa (no una página nueva) y su tarjeta de la lista se marca con el contorno lime. Pasar el ratón o el foco por una tarjeta activa su pin.
- **Guardados y Alertas en escritorio**: nunca sin mapa. Lista de 830px a la izquierda y mapa a la derecha, con el título de página (40px, sin contador). En Guardados, un pin por coche guardado. En Alertas, la alerta elegida se abre con sus criterios y sus últimas coincidencias; las demás se pliegan a una línea de resumen.
- **Zona de alerta** en el mapa: círculo con borde `lime` de 2px al 80% y relleno `lime` al 10%, más un punto de centro en `text`. Sin discontinuo: tiene que leerse como zona, no gritar.
- **Títulos de página sin contador**: «GUARDADOS», «ALERTAS». Tampoco hay contador de resultados en el mapa hasta que exista un total real (issue abierto).

- **Cuenta**: sin mapa. Título «CUENTA», una línea («Tus datos, tus reglas.») y una rejilla de 3 columnas de AccountCard, la primera la tuya. Eliminar cuenta, abajo, en `danger`.
- **Pantallas de acceso** (registro, recuperar y nueva contraseña, confirmar cuenta): la misma estructura que Entrar, titular a la izquierda y formulario a la derecha; el registro con la ilustración, el resto sin ella. En móvil, titular arriba y la acción abajo del todo.
- **Vacíos, errores y carga**: dentro de la pantalla real, con EmptyState. Nunca un icono decorativo encima del titular.
- **Legales**: página de lectura de 720px con índice a la izquierda y el pie.

## Ilustraciones y flechas

Solo en la landing y en Entrar, para romper la caja sin restar sitio al mapa.

- **Ilustraciones**: de Storyset (Freepik), estilo «Cuate», con el fondo oculto. Landing: «Vehicle sale». Entrar: «By my car».
- **Color**: el coche y las hojas en `lime`; la ropa que venía en el color de acento, en `text` (blanco); suelo y sombra oscurecidos a tonos de superficie. El resto, como viene.
- **Sitio**: detrás del contenido, abajo a la izquierda, grande y saliéndose por el borde inferior. Nunca encima de un campo, botón o texto.
- **Flechas**: trazo `lime` de 3,5px con punta abierta, detrás del contenido. En la landing salen del final del titular, una al borde del mapa a la altura del pin activo y otra al centro del lado derecho de «Buscar». En Entrar va del titular a la «o» entre los dos botones, fuera del formulario. Nunca cruzan un campo ni un botón.
- **Móvil**: sin flechas. Landing: la ilustración aparcada dentro del mapa, abajo. Entrar: debajo de los botones.
- **Atribución obligatoria** (licencia gratuita de Freepik): «Ilustraciones de Storyset» con enlace a storyset.com, en el pie.

## Iconos

Lucide, trazo 2px (2,4–2,6 en botones pequeños sobre lime), esquinas redondas, en el color del texto que los rodea. Sin emojis. Logo: solo tipografía, «BUYCAR» en `text` y «MAP» en `lime`; no hay archivo de logo.

## Accesibilidad

- `text-muted` sobre `bg` 7,6:1; `on-lime` sobre `lime` más de 15:1; `on-violet` sobre `violet` 4,6:1.
- Lo activo no se marca solo con color: el chip activo cambia de relleno y peso; el pin activo, de relleno, tamaño y halo.
- Controles de 44px mínimo en móvil; campos a 16px.
