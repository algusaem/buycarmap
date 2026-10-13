# EmptyState

Lo que se ve cuando una lista no tiene nada o una carga falla. Va dentro de la pantalla real (misma cabecera, mismo buscador, el mapa a la derecha sin pines), nunca en una página aparte.

- Titular de **pregunta y remate** (Headline con `empty-title`: 48px en escritorio, 28px con interlineado 1,06 en móvil), una línea en `text-muted` (17px; 15px en móvil) y las acciones. Sin icono encima.
- Entre bloques, 22px en escritorio y 16px en móvil; nada más antes de las acciones.
- Acciones de 48px a 15px, separadas 10px: la principal en `lime` (una) y, si hace falta, una segunda:
  - Fantasma para deshacer («Quitar filtros», padding 0 14px), que pasa a `danger` al pasar el ratón o con foco.
  - Secundaria con borde `line` para salir («Volver al mapa», padding 0 20px) en el error de página.
- Textos: «¿NADA POR AQUÍ? AMPLÍA EL RADIO», «¿SE HA CAÍDO ALGO? PRUEBA OTRA VEZ», «¿AÚN NADA? GUARDA ALGUNO», «¿SIN ALERTAS? CREA UNA», «¿SE HA ROTO ALGO? NO ES CULPA TUYA».
- Sobre el mapa, una StatusPill que explica el vacío («Ningún coche en 50 km»).
- **Cargando** no es un EmptyState: se dibujan tarjetas vacías con la forma de ListingCard (foto y barras en `surface`, la barra del precio en `surface-strong`; dentro de la hoja inferior del móvil, que ya es `surface`, la foto y las barras van en `surface-strong`; barras de texto `radius-skeleton-sm`, la del precio `radius-skeleton`) y, en escritorio, «Buscando coches…» como StatusPill con `role="status"` sobre el mapa.
- En móvil va dentro de la hoja inferior o de la lista, debajo del título.
- **Pequeño**, dentro de una sección de una página: sin titular ni acciones, el título de la sección (`section-label`) y una línea de 15px con interlineado 1,5 en `text-muted`. Lo usa la página de una alerta sin coincidencias: «SIN COINCIDENCIAS» y «Te avisaremos en cuanto salga un coche que encaje.»
