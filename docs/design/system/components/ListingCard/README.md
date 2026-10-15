# ListingCard

La tarjeta de coche: foto protagonista (una sola: el carrusel va en un issue aparte), nombre, ciudad, metadatos y el precio en Unbounded `lime`.

- Foto `radius-card`, proporción 20:19 en el mapa y 20:17 en Guardados. Sin foto, el tinte del coche (`photo-tint-1` a `photo-tint-8`, uno por coche) con el icono de coche de Lucide (60px en el mapa, 56px en Guardados, trazo 1,1) en `photo-icon`.
- Encima de la foto: insignia de fuente arriba a la izquierda y corazón de 34px arriba a la derecha, los dos sobre `scrim`.
- Guardado: el corazón pasa a `violet`, relleno y con trazo en `on-violet`, y su `aria-label` cambia a «Quitar de guardados».
- Activa (su pin está abierto en el mapa): contorno de 2px `lime` en la foto.
- Texto bajo la foto, a 12px, con 3px entre líneas: nombre (`card-title`) y ciudad a la derecha en `meta`; metadatos en `meta`; precio con `price`, sin espacio entre letras, 6px más abajo.
- Metadatos en el mapa: año · km · combustible. El combustible sale solo cuando se reconoce («Diésel» para `gasoil`); si falta o no se reconoce, «año · km». En Guardados, año · km.
- En Guardados la fila del precio lleva a la derecha «Ver anuncio» (14px peso 700, icono `arrow-up-right` de 15px a 6px del texto, siempre en una línea: no se parte ni se encoge), que abre el portal en pestaña nueva.
- **Fila compacta** (Guardados y las coincidencias de la página de una alerta, en móvil): miniatura de 110×86 `radius-thumb`, 14px de hueco, nombre a 15px, «año · km · ciudad» a 13px en `text-muted` (en las coincidencias, «año · km»), precio Unbounded 18px en `lime`; 2px entre líneas y 4px antes del precio. Tocarla abre la hoja del coche (BottomSheet).
- **Tarjeta del mapa de la landing**: tarjeta `surface` con borde `line`, `radius-card`, 12px de relleno; foto de 120×90 `radius-field`; «Wallapop · Zaragoza» 12px peso 700 en `text-muted`, nombre 16px, «año · km» 13px, precio Unbounded 20px. En móvil sale la misma tarjeta, también dentro del mapa, pegada a sus bordes a 16px: relleno de 8px, 10px de hueco y foto de 80×60; los textos no cambian de tamaño. El mapa de la landing, con sus pines y esta tarjeta, es una ilustración fija: los precios y el coche son de ejemplo, no resultados reales. Pulsarlo lleva a `/map`.
- **Coincidencia de una alerta** (AlertCard abierta): foto de 110px de alto `radius-field`; la fuente como texto 12px peso 700 en `text-muted` (sin insignia), nombre 15px, «año · km» 13px, precio Unbounded 18px; 4px entre líneas. La activa lleva el contorno `lime`.
- Toda la tarjeta enlaza al anuncio; el corazón es un botón aparte. En móvil, la fila compacta abre la hoja del coche, y el anuncio se abre desde ahí.
