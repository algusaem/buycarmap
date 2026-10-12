# Chip

Filtros rápidos en una fila bajo el buscador; el activo se rellena de `violet`, sin borde, y sube a peso 800; el resto es un borde `line` con peso 600.

- Es un botón con `aria-pressed`: el estado no va solo en el color, también cambia el relleno y el peso.
- Texto corto, en el idioma del comprador: «Diésel», «Automático», «Menos de 100.000 km», «Últimas 24 h».
- **Escritorio**: 14px, padding 9px 16px, 8px entre chips. Sin relleno los inactivos.
- **Móvil, sobre el mapa**: 13px, padding 8px 14px; los inactivos llevan relleno `surface` para leerse encima del mapa. La fila se corta por la derecha y se desliza en horizontal; no se parte en dos líneas.
- **Panel de filtros** (FilterSheet): padding 10px 16px, en varias líneas, y se pueden activar varios a la vez.
- **Orden**: en Guardados, «Recientes · Precio · Km» son chips que eligen el orden; solo uno activo.
- **«Filtros»** no es un chip: es un botón secundario aparte, al final de la fila (padding 10px 16px, peso 700), con el icono de ajustes de tres mandos (16px) y, a 8px, el número de filtros activos en una insignia `violet`. Abre el panel completo.
