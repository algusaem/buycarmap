# AccountCard

Cada bloque de la cuenta es una tarjeta con la misma estructura, para que en la rejilla todas midan lo mismo y los bordes casen.

- `surface`, borde `line`, `radius-card`, 24px de relleno, alto mínimo 196px.
- Arriba: título en Unbounded 16 en mayúsculas y, a la derecha, la insignia. Insignia de algo activo («Verificado», «Conectada») en `violet`; de algo inactivo («Desactivada», «2 abiertas») en contorno `line` con texto `text-muted`.
- En medio: dos líneas en `text-muted`.
- Abajo: **un** botón secundario con lo que hace («Cambiar correo», «Activar», «Descargar mis datos»). Sin puntos suspensivos.
- La primera tarjeta es la tuya: avatar `violet` de 56px con la inicial, nombre en Unbounded, correo y «8 guardados · 3 alertas».
- «Eliminar cuenta» lleva el título y el botón en `danger`, el borde en `danger` al 35 %, ocupa dos columnas y siempre pide confirmación.
- Escritorio: rejilla de 3 columnas, 20px de hueco. Móvil: una columna. La cuenta no lleva mapa.
