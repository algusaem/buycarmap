# MapPreview

La ficha rápida que se abre encima del mapa al pulsar un pin, en Mapa, Guardados y Alertas: foto, nombre, metadatos, precio, Guardar y «Ver anuncio» con el icono `arrow-up-right`.

- Flota: `surface`, borde `line`, `radius-preview`, 12px de relleno, 10px entre bloques y `shadow-float`. 340px de ancho.
- Foto de 170px, `radius-field`, con el tinte del coche. Encima, la insignia de fuente y el botón de cerrar de 32px, los dos sobre `scrim`.
- Nombre 16px y la ciudad a la derecha en 13px `text-muted`; debajo los metadatos en `meta`, subidos 6px.
- Fila del precio: precio Unbounded 24px en `lime`, sin espacio entre letras; Guardar (botón de icono de 42px) y «Ver anuncio» (principal de 42px).
- Guardado: el botón pasa a `violet` sin borde, con el corazón relleno en `on-violet`, y su `aria-label` cambia a «Quitar de guardados».
- Al abrirse, el foco pasa a la vista previa. Se cierra con su botón, con Escape (desde el pin o desde dentro) o pulsando fuera, y el foco vuelve al pin.
- En escritorio va anclada a su pin y se mueve con el mapa. Abrir «Crear alerta» la cierra.
- Si el pin agrupa varios coches, la vista previa los lista en orden, con scroll.
- En escritorio, abrirla marca y desplaza hasta su tarjeta en la lista.
- **Móvil**: no flota sobre el mapa. Su contenido va en la hoja del coche (BottomSheet › Hojas modales), que abre un pin del mapa, una fila de Guardados o una coincidencia de una alerta.

## Movimiento

- Abierta con el ratón, aparece y desaparece con un fundido de 180ms (`crossFade`). Abierta desde un pin con Intro o Espacio, o cerrada con Escape, aparece y desaparece al instante (MOTION-11).
- **Hover y pulsación** (en la transición de estado de 120ms, curva `ease-out`): el botón de cerrar se rellena de `surface-strong`; «Ver anuncio» se aclara un poco; el corazón pasa a `lime` y, ya guardado, se oscurece un poco (brillo 92 %) para que su contenido mantenga el contraste. Todos se encogen a 0,97 mientras se pulsan, salvo con movimiento reducido.
