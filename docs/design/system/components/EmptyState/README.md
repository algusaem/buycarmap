# EmptyState

Lo que se ve cuando una lista no tiene nada o una carga falla. Va dentro de la pantalla real (misma cabecera, mismo buscador, el mapa a la derecha sin pines), nunca en una página aparte.

- Titular de **pregunta y remate** (Headline con `empty-title`: 48px en escritorio, 28px con interlineado 1,06 en móvil), una línea en `text-muted` (17px; 15px en móvil) y las acciones. Sin icono encima.
- Entre bloques, 22px en escritorio y 16px en móvil; nada más antes de las acciones.
- Acciones de 48px a 15px, separadas 10px: la principal en `lime` (una) y, si hace falta, una segunda:
  - Fantasma para deshacer («Quitar filtros», padding 0 14px), que pasa a `danger` al pasar el ratón o con foco.
  - Secundaria con borde `line` para salir («Volver al mapa», padding 0 20px) en el error de página.
- Textos: «¿NADA POR AQUÍ? AMPLÍA EL RADIO», «¿SE HA CAÍDO ALGO? PRUEBA OTRA VEZ», «¿AÚN NADA? GUARDA ALGUNO», «¿SIN ALERTAS? CREA UNA», «¿SE HA ROTO ALGO? NO ES CULPA TUYA».
- **Error de página en el mapa**: el mismo error de página («¿SE HA ROTO ALGO? NO ES CULPA TUYA») con la línea «Error al cargar el mapa. Vuelve a intentarlo más tarde.» y solo «Reintentar», que vuelve a cargar la página; sin «Volver al mapa», porque ya es el mapa.
- Sobre el mapa, una StatusPill que explica el vacío («Ningún coche en 50 km»).
- **Sin resultados y sin ningún filtro puesto** (solo sitio y radio): titular «¿Nada por aquí? / Amplía el radio», la línea «No hay coches en {km} km.» y la acción principal «Ampliar a {siguiente} km», sin «Quitar filtros»; sobre el mapa, la StatusPill «Ningún coche en {km} km». Ya a 200 km: la línea «No hay coches en 200 km.» y la acción principal «Toda España»; la StatusPill, «Ningún coche en 200 km».
- **Sin resultados con algún filtro puesto, sin sitio o a 200 km**: no hay radio que ampliar, así que no sale «Ampliar a … km» y ni la línea ni la StatusPill nombran un radio. El remate pasa a «Quita algún filtro» («¿Nada por aquí? / Quita algún filtro»), la línea es «Con estos filtros no hay coches. Prueba a quitar algún filtro.», «Quitar filtros» pasa a ser la acción principal en `lime` y, sobre el mapa, «Ningún coche con estos filtros».
- **Cargando** no es un EmptyState: se dibujan tarjetas vacías con la forma de ListingCard (foto y barras en `surface`, la barra del precio en `surface-strong`; dentro de la hoja inferior del móvil, que ya es `surface`, la foto y las barras van en `surface-strong`; barras de texto `radius-skeleton-sm`, la del precio `radius-skeleton`) y, en escritorio, «Buscando coches…» como StatusPill con `role="status"` sobre el mapa.
- **Cargando en móvil** es la misma pantalla que con resultados: el mapa a pantalla completa con el buscador flotante y la fila de filtros, y la hoja de resultados (BottomSheet) en su posición media, encima de la barra inferior, con el asa, el título «BUSCANDO COCHES…» y una sola tarjeta vacía dentro. Nunca una tarjeta vacía suelta arriba de la pantalla.
- **Cargando en Guardados**: el titular y el orden ya se ven; tarjetas vacías con la foto 20:17 y, en el mapa, ningún pin, solo «Tus guardados en el mapa». En móvil, filas compactas vacías: la miniatura de 110×86 y tres barras.
- En móvil va dentro de la hoja inferior o de la lista, debajo del título.
- **Pequeño**, dentro de una sección de una página: sin titular ni acciones, el título de la sección (`section-label`) y una línea de 15px con interlineado 1,5 en `text-muted`. Lo usa la página de una alerta sin coincidencias: «SIN COINCIDENCIAS» y «Te avisaremos en cuanto salga un coche que encaje.»
