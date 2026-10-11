# BuyCarMap 2.0

Todos los coches de segunda mano de Wallapop, coches.net y Milanuncios en un solo mapa. El sistema es negro, macarra y limpio: mucho negro, una sola tinta de acento (lime) y titulares en mayúsculas que hablan como un colega.

## Voz

Hablamos como alguien del barrio que sabe de coches, no como un banco. Frases cortas, coloquiales, con chulería, sin vender humo: nunca prometemos cifras que no tenemos.

- Titular de la landing: «¿EN BUSCA DE COCHE? **MIRA EL MAPA**».
- Titular de Entrar: «¿TE MOLA UN COCHE? **GUÁRDALO**».
- Subtítulo de la landing: «Una web, toda la segunda mano, sin cincuenta pestañas.»
- Alertas: «El que no corre vuela, guárdalo y nosotros te avisamos.»
- Entrar: «Recibir alertas es gratis, regístrate y nos encargamos del resto.»

Reglas:
- Los titulares son **pregunta y remate**. La pregunta plantea, el remate golpea. Sin punto final en el remate.
- Botones y controles dicen lo que pasa, sin rollo: «Buscar», «Guardar», «Ver anuncio ↗», «Crear alerta».
- Nunca «Bienvenido a…», «Descubre…», «La mejor forma de…», ni cifras inventadas («50K+», «100 %»).
- Nombres de las fuentes tal cual: Wallapop, coches.net, Milanuncios.
- Precios en formato español: `14.500 €`. Kilómetros: `95.000 km`. Metadatos separados por « · ».

## Color

Una noche con una sola luz. `bg` y `surface` hacen el 95 % de la pantalla; `lime` es la luz.

- **`lime` solo para**: precios, el «MAP» del logo, el remate del titular, el botón principal (uno por vista), el pin activo y su tarjeta. Encima, siempre `on-lime`.
- **`violet`**, el complementario del lime, para lo que es tuyo y los estados: corazón guardado, chip activo, número de filtros, avatar de la cuenta y la sección actual de la barra inferior. Encima, siempre `on-violet`. Regla rápida: lime = lo que haces o miras ahora; violeta = lo tuyo.
- **Nunca** lime en texto corrido, en bordes decorativos ni en fondos grandes.
- Texto en `text` (blanco roto) y `text-muted`; nunca blanco puro ni negro puro dentro de la app.
- Bordes de 1px en `line`; divisores en `line-soft`. Sin sombras salvo `shadow-float` (lo que flota sobre el mapa) y `shadow-pin-active`.
- El color de las fuentes (Wallapop, coches.net, Milanuncios) no entra: la fuente va como insignia oscura con texto, no como mancha de color de marca.

## Tipografía

Dos familias, las dos de Google Fonts:

- **Unbounded** (`display`): ancha, gorda, siempre en MAYÚSCULAS. Logo, titulares, contadores y precios. Peso 800–900.
- **Rethink Sans** (`sans`): todo lo demás. 400 para texto, 600–700 para controles.

Reglas de los titulares grandes, que se han ajustado a ojo:
- Varias líneas: interlineado **1,04** en escritorio y **1,06** en móvil. Unbounded tiene las mayúsculas muy altas y las tildes (Á, Í, Ó) chocan si se baja de ahí. Una línea sola: 0,9.
- Espacio entre letras **-0,01 em**; con -0,03 las letras se tocan.
- La pregunta va a **0,56** del tamaño del remate, en una línea, en `text`. El remate, en `lime`.
- Cortes de línea con sentido: nunca una palabra sola en una línea. `text-wrap: balance`.
- Recorte del cuadro a la altura de las mayúsculas (`text-box: trim-both cap alphabetic`), para medir los espacios desde las letras.

## Estructura de pantalla

- **Mapa en escritorio**: cabecera de 80px (logo, buscador píldora «Dónde · Coche · Precio», Crear alerta, favoritos, cuenta); fila de chips rápidos + «Filtros»; rejilla de tres columnas a la izquierda y mapa a la derecha con pines de precio.
- **Mapa en móvil**: mapa a pantalla completa, buscador píldora flotando arriba con chips, y la hoja inferior con el contador y las tarjetas.
- **Mapa**: oscuro y mínimo (`map-ground`, `map-road`, `map-road-major`, `map-water`), casi sin etiquetas. Los pines son píldoras con el precio; el activo pasa a lime con halo.
- **Lista y mapa van sincronizados en toda pantalla con mapa** (Mapa, Guardados, Alertas): al pulsar un pin se activa, se abre la vista previa encima del mapa (no una página nueva) y su tarjeta de la lista se marca con el contorno lime. Pasar el ratón o el foco por una tarjeta activa su pin.
- **Guardados y Alertas en escritorio**: nunca sin mapa. Lista de 830px a la izquierda y mapa a la derecha, con el título de página (40px, sin contador). En Guardados, un pin por coche guardado. En Alertas, la alerta elegida se abre con sus criterios y sus últimas coincidencias; las demás se pliegan a una línea de resumen.
- **Zona de alerta** en el mapa: círculo con borde `lime` de 2px al 80% y relleno `lime` al 10%, más un punto de centro en `text`. Sin discontinuo: tiene que leerse como zona, no gritar.
- **Títulos de página sin contador**: «GUARDADOS», «ALERTAS». El único contador es el de resultados del mapa («312 COCHES»).

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

- `text-muted` sobre `bg` 7,6:1; `on-lime` sobre `lime` más de 15:1; `on-violet` sobre `violet` 4,8:1.
- Lo activo no se marca solo con color: el chip activo cambia de relleno y peso; el pin activo, de relleno, tamaño y halo.
- Controles de 44px mínimo en móvil; campos a 16px.
