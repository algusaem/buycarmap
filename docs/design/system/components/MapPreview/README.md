# MapPreview

La ficha rápida que se abre encima del mapa al pulsar un pin, en Mapa, Guardados y Alertas: foto, nombre, metadatos, precio, Guardar y «Ver anuncio» con el icono `arrow-up-right`.

- Flota: `surface`, borde `line`, `radius-preview`, 12px de relleno, 10px entre bloques y `shadow-float`. 340px de ancho.
- Foto de 170px, `radius-field`, con el tinte del coche. Encima, la insignia de fuente y el botón de cerrar de 32px, los dos sobre `scrim`.
- Nombre 16px y la ciudad a la derecha en 13px `text-muted`; debajo los metadatos en `meta`, subidos 6px.
- Fila del precio: precio Unbounded 24px en `lime`, sin espacio entre letras; Guardar (botón de icono de 42px) y «Ver anuncio» (principal de 42px).
- Guardado: el botón pasa a `violet` sin borde, con el corazón relleno en `on-violet`, y su `aria-label` cambia a «Quitar de guardados».
- Se cierra con su botón, con Escape o pulsando fuera, y el foco vuelve al pin.
- Si el pin agrupa varios coches, la vista previa los lista en orden, con scroll.
- En escritorio, abrirla marca y desplaza hasta su tarjeta en la lista.
