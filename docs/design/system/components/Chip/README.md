# Chip

La fila de filtros bajo el buscador del mapa: «Filtros» primero y, detrás, solo los filtros que tienes puestos, cada uno con su botón para quitarlo. No hay fila de filtros rápidos («Todos», «Diésel»…): los filtros se eligen en el panel (FilterSheet).

- **«Filtros»** va el primero: un botón secundario (padding 10px 16px, borde `line`, `radius-pill`, 14px peso 700) con el icono de ajustes de tres mandos (16px) y, a 8px, el número de filtros activos en una insignia `violet` (12px peso 800, padding 1px 8px). Abre el panel de filtros (`aria-haspopup="dialog"`).
- **Filtros activos**: a 8px, un chip `violet` por filtro, con el texto en `on-violet` a 14px peso 800, 36px de alto y padding izquierdo 16px. A la derecha, la `x` de 14px (trazo 2,6) en un botón de icono de 44 × 44 que se solapa con el borde del chip (margen -4px), con `aria-label` «Quitar Diésel». Quitar un chip quita ese filtro.
- Texto corto, en el idioma del comprador, el mismo que el valor elegido: «Diésel», «Hasta 20.000 €», «Automático», «Últimas 24 h».
- **Sin filtros**: la fila solo tiene «Filtros», sin número.
- **Móvil, sobre el mapa**: la misma fila, a 10px bajo el buscador. «Filtros» lleva relleno `surface` para leerse encima del mapa y ninguna pieza se encoge: la fila se corta por la derecha y se desliza en horizontal; no se parte en dos líneas.
- **Panel de filtros** (FilterSheet): chips de elegir con `aria-pressed`, padding 10px 16px, en varias líneas, y se pueden activar varios a la vez. El activo se rellena de `violet`, sin borde, y sube a peso 800; el resto es un borde `line` con peso 600. El estado no va solo en el color: también cambia el relleno y el peso.
- **Orden**: en Guardados, «Recientes · Precio · Km» son chips de elegir que fijan el orden; solo uno activo. El mapa no tiene control de orden.
