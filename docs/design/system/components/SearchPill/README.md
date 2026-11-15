# SearchPill

El buscador de toda la app: una píldora `surface` con borde `line` y tres segmentos (Dónde · Coche · Precio) separados por divisores `line`, y el botón `lime` al final.

- Cada segmento: etiqueta `overline` en `text-muted` y valor en peso 600. Sin valor, el valor va en `text-muted`: «Ciudad…», «Marca o modelo…» y, en Precio, «Cualquiera» sin «…».
- **Tu ubicación**: cuando la posición del navegador hace de sitio, el valor de Dónde es «Tu ubicación · 50 km», igual que «Madrid · 50 km» con un sitio elegido y «Toda España» sin ninguno. Lo mismo en el resumen del móvil. «Toda España» la quita, y nunca va a la URL.
- Precio es el último segmento y no lleva divisor antes del botón.
- Pulsar un segmento abre su [SearchPopover](../SearchPopover/README.md) (ubicación y radio, marca o modelo, rango de precio). Cada segmento lleva `aria-haspopup="dialog"`; el abierto, `aria-expanded="true"` y un subrayado `lime` de 2px con `radius-pill`, a 22px de cada lado.
- **Cabecera del mapa**: 48px de alto, padding 5px 5px 5px 8px, segmentos 0 22px, valor 15px, botón redondo de 36px con la lupa y `aria-label="Buscar"`. En la fila uno de la banda del mapa, con su borde de arriba a 24px de la ventana (ver [HeaderNav](../HeaderNav/README.md)).
- **Landing**: padding 8px 8px 8px 10px, segmentos 6px 26px, valor 16px, botón de 54px con la lupa y «Buscar» (padding 0 24px, lupa de 17px, hueco 7px, 16px peso 800).
  - Cada segmento abre su SearchPopover, igual que en el mapa (los desplegables son los del mapa, no hay otros).
  - «Buscar» lleva a `/map` con el sitio, el coche y el precio elegidos.
  - Un chip de «Populares» lleva a `/map` con ese coche como filtro de marca y modelo.
- **Móvil en el mapa**: no flota. Va en una banda `surface` arriba, a todo el ancho y sin borde (padding 20px 0 12px, 16px entre filas); el mapa empieza bajo la banda. El resumen es una píldora `surface` de 56px de alto con borde `line` (padding 0 18px, hueco 12px), a 16px del borde izquierdo: lupa de 18px (trazo 2,4), el resumen en 14px («Madrid · 50 km»; «Toda España» sin sitio elegido; «Tu ubicación · 50 km» cuando la posición del navegador hace de sitio) y debajo una línea de 12px en `text-muted` («Cualquier marca · hasta 20.000 €»; con descripción, «BMW · «e46» · hasta 20.000 €»). A 12px a su derecha, «Filtros», el botón redondo de 44px con la insignia del número (ver [Chip](../Chip/README.md)), y debajo de los dos los filtros rápidos. Tocar el resumen abre la hoja «BUSCAR» (ver SearchPopover).
- **Móvil en la landing**: una tarjeta apilada `radius-sheet` con 6px de relleno, solo Dónde y Coche (segmentos 12px 16px, divisor entre los dos, valor 16px) y debajo «Buscar» de 52px a todo el ancho, sin icono.
  - Tocar la tarjeta abre la hoja «BUSCAR» del mapa sobre la landing; «Ver coches» lleva a `/map` con lo elegido.
- **Descripción**: la búsqueda por palabras de los anuncios («e46», «gti», «cabrio») no es un segmento ni parte de Coche: es su propio campo.
  - **Escritorio y portátil**: al final de la fila de filtros, tras un divisor. 240 × 34px, `radius-pill`, borde `line`, lupa de 16px y 13px peso 600, con «Descripción: e46, gti…». Aplicado, borde `violet`, texto a peso 800 y la `x` de «Borrar texto». Con foco, borde `lime`, también con texto aplicado.
  - **Móvil**: la sección «Descripción» de la hoja «BUSCAR», entre Coche y Precio (ver SearchPopover).
  - Intro lo aplica y la `x` lo quita; «Buscar» aplica lo que tenga el campo, igual que Intro, y tras Intro el foco sigue en el campo. Vaciar el campo y pulsar Intro también. Se suma a Dónde, Coche, Precio y los filtros. No cambia el valor de Coche ni cuenta en la insignia de «Filtros».
  - «Borrar» y «Quitar filtros» también lo quitan.
  - En la landing de escritorio no aparece: su píldora sigue siendo Dónde, Coche y Precio.
- Es un `role="search"`; el botón de icono lleva `aria-label="Buscar"`.
- Los valores nunca parten línea; si no caben, se cortan con «…».
- **Hover y pulsación** (en la transición de estado de 120ms, curva `ease-out`): cada segmento pasa su valor a `lime` al pasar el ratón; «Buscar» se aclara un poco. Los dos se encogen a 0,97 mientras se pulsan, salvo con movimiento reducido. La tarjeta del buscador en la landing móvil pasa su borde a `text-muted` al pasar el ratón y se encoge a 0,97 al pulsarla.
