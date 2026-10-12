# EmptyState

Lo que se ve cuando una lista no tiene nada o una carga falla. Va dentro de la pantalla real (misma cabecera, mismo buscador, el mapa a la derecha sin pines), nunca en una página aparte.

- Titular de **pregunta y remate** (Headline a 48px en escritorio, 28px en móvil), una línea en `text-muted` y las acciones. Sin icono encima.
- Acción principal en `lime` (una) y, si hace falta, una fantasma («Quitar filtros», que pasa a `danger` al pasar el ratón).
- Textos: «¿NADA POR AQUÍ? AMPLÍA EL RADIO», «¿SE HA CAÍDO ALGO? PRUEBA OTRA VEZ», «¿AÚN NADA? GUARDA ALGUNO», «¿SIN ALERTAS? CREA UNA», «¿SE HA ROTO ALGO? NO ES CULPA TUYA».
- Sobre el mapa, una píldora que explica el vacío («Ningún coche en 50 km»).
- **Cargando** no es un EmptyState: se dibujan tarjetas vacías con la forma de ListingCard y «Buscando coches…» como `role="status"` sobre el mapa.
- En móvil va dentro de la hoja inferior o de la lista, debajo del título.
