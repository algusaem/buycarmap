# SearchPill

El buscador de toda la app: una píldora `surface` con borde `line` y tres segmentos (Dónde · Coche · Precio) separados por divisores `line`, y el botón `lime` al final.

- Cada segmento: etiqueta `overline` en `text-muted` y valor en peso 600. Sin valor, el valor va en `text-muted`: «Ciudad o código postal…», «Marca o modelo…» y, en Precio, «Cualquiera» sin «…».
- Precio es el último segmento y no lleva divisor antes del botón.
- Pulsar un segmento abre su selector (ubicación y radio, marca y modelo, rango de precio).
- **Cabecera del mapa** (compacto): padding 6px 6px 6px 8px, segmentos 6px 22px, valor 15px, botón redondo de 46px con la lupa y `aria-label="Buscar"`.
- **Landing**: padding 8px 8px 8px 10px, segmentos 6px 26px, valor 16px, botón de 54px con la lupa y «Buscar» (padding 0 24px, lupa de 17px, hueco 7px, 16px peso 800).
- **Móvil en el mapa**: una sola fila `surface` flotando a 16px de los bordes (padding 9px 9px 9px 18px, hueco 12px): lupa de 18px (trazo 2,4), el resumen en 14px y debajo una línea de 12px en `text-muted`, y a la derecha el botón de filtros redondo de 38px en `violet`, sin número.
- **Móvil en la landing**: una tarjeta apilada `radius-sheet` con 6px de relleno, solo Dónde y Coche (segmentos 12px 16px, divisor entre los dos, valor 16px) y debajo «Buscar» de 52px a todo el ancho, sin icono.
- Es un `role="search"`; el botón de icono lleva `aria-label="Buscar"`.
- Los valores nunca parten línea; si no caben, se cortan con «…».
