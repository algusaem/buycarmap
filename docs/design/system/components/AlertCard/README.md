# AlertCard

Cada alerta guardada en la lista de Alertas. La elegida se abre con sus criterios y sus últimas coincidencias; las demás se pliegan a una línea de resumen.

- `surface`, borde `line`, `radius-card`, padding 18px 20px, 12px entre bloques.
- Abierta: el borde pasa a `lime` (es la que estás mirando, y su zona está en el mapa).
- Arriba: el nombre en Unbounded 17 peso 800 en mayúsculas y, a la derecha, la insignia con las coincidencias («4 coincidencias», «Sin coincidencias»): 13px peso 800, padding 6px 11px, contorno `line` y texto `text-muted`.
- Plegada: los criterios en una línea de 14px `text-muted`, separados por « · ».
- Abierta: los criterios como etiquetas (13px peso 600, contorno `line`, padding 6px 11px, 6px de hueco) y debajo una rejilla de 4 coincidencias con 14px de hueco (la tarjeta de coincidencia de ListingCard); la activa lleva el contorno `lime` y su pin está abierto.
- Tocar la tarjeta la abre; no hay acción para abrirla.
- Pie: «Creada el 2 de octubre» en 13px `text-muted`. La abierta lleva a la derecha «Eliminar» en `text` peso 700; las cerradas no llevan acción, solo la fecha.
- **Móvil**: sin mapa ni coincidencias; padding 16px, 10px entre bloques, nombre a 14px y el resumen a 13px. 14px entre tarjetas.
