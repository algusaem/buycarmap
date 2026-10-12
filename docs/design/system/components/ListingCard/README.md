# ListingCard

La tarjeta de coche: foto protagonista (una sola: el carrusel va en un issue aparte), nombre, ciudad, metadatos y el precio en Unbounded `lime`.

- Foto `radius-card`, proporción 20:19; mientras carga, `photo-placeholder`.
- Encima de la foto: insignia de fuente arriba a la izquierda y corazón arriba a la derecha, los dos sobre `scrim`.
- Guardado: el corazón pasa a `violet` relleno, con el corazón en `on-violet` y su `aria-label` cambia a «Quitar de guardados».
- Activa (su pin está abierto en el mapa): contorno de 2px `lime` en la foto.
- Metadatos en orden fijo: año · km · combustible. Precio con `price`.
- Toda la tarjeta enlaza al anuncio; el corazón es un botón aparte.
