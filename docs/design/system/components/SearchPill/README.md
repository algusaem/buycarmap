# SearchPill

El buscador de toda la app: una píldora `surface` con tres segmentos (Dónde · Coche · Precio) y el botón redondo `lime` al final.

- Cada segmento tiene etiqueta `overline` en `text-muted` y valor en 15px; sin valor, el valor va en `text-muted` acabado en «…».
- Pulsar un segmento abre su selector (ubicación y radio, marca y modelo, rango de precio).
- En la landing va más grande (padding 8px, botón con texto «Buscar»); en el mapa, compacto en la cabecera; en móvil, una sola fila con el resumen y un botón de filtros.
- Es un `role="search"`; el botón de icono lleva `aria-label="Buscar"`.
