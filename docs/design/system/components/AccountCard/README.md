# AccountCard

Cada bloque de la cuenta es una tarjeta con la misma estructura, para que en la rejilla todas midan lo mismo y los bordes casen.

- `surface`, borde `line`, `radius-card`, 24px de relleno, 12px entre bloques, alto mínimo 196px.
- Arriba: una fila de 26px de alto mínimo, con 12px de hueco: título en Unbounded 16 en mayúsculas y, a la derecha, la insignia (12px peso 800, padding 5px 10px). Insignia de algo activo («Verificado», «Conectada») en `violet`; de algo inactivo («Desactivada», «2 abiertas») en contorno `line` con texto `text-muted`.
- En medio: dos líneas en `text-muted` (14px, interlineado 1,5).
- Abajo: **un** botón secundario de 44px con lo que hace («Cambiar correo», «Activar», «Descargar mis datos»). Sin puntos suspensivos.
- La primera tarjeta es la tuya: avatar `violet` de 56px con la inicial en Unbounded 22 peso 900, a 14px el nombre en Unbounded 22 peso 900 y el correo debajo; luego «**8 guardados** · **3 alertas** · en BuyCarMap desde marzo», con las cifras en `text` peso 700; y «Cambiar nombre».
- «Eliminar cuenta» lleva el título y el botón en `danger`, el borde de la tarjeta en `danger` al 35 % y el del botón al 60 %, ocupa dos columnas y siempre pide confirmación.
- **Móvil**: una columna, 12px de hueco, relleno 18px y sin alto mínimo; título 14px, avatar 48px con la inicial a 18px y el nombre a 18px.
- Estar en Cuenta lo marca el avatar de la cabecera con su aro (`shadow-current` en escritorio, `shadow-current-sm` en móvil) y `aria-current="page"`.
- «Cerrar sesión» es un secundario (10px 16px) en la cabecera de la página, a la derecha del título.
- Escritorio: rejilla de 3 columnas, 20px de hueco. La cuenta no lleva mapa.
