# AlertZone

La zona que vigila una alerta: un círculo sobre el mapa con el radio elegido. Tiene que leerse como zona, no gritar.

- Borde `lime` continuo de 2px al 80%. Nunca discontinuo.
- Relleno `lime` al 10%: un velo, el mapa y los pines se siguen viendo debajo.
- Punto de centro: `text` de 7px con borde `bg` de 3px.
- En escritorio, encima, a la izquierda del mapa, una StatusPill con la alerta y su zona: «Corolla híbrido · Madrid · 50 km», la zona en `lime`.
- Los pines (PricePin) de las coincidencias van por encima de la zona; el activo, sin borde y con su halo.
- Es decorativa: el radio ya está en la píldora y en los criterios de la alerta, así que el círculo va con `aria-hidden`.
- En escritorio, en la pantalla de Alertas (y al crear una), una zona cada vez.
- **En `/map`, alrededor de tu ubicación** (MAP-34): cuando la posición del navegador hace de sitio, el mapa dibuja la misma zona, con su punto de centro, en el radio elegido alrededor de esa posición (50 km por defecto), y se encuadra en ella, en escritorio y en móvil; el buscador dice «Tu ubicación · 50 km».
- En móvil, la lista de Alertas no lleva mapa (la zona va en el resumen de cada AlertCard), pero la página de una alerta sí: un mapa de 180px de alto a todo el ancho del contenido, `radius-card` y borde `line`, con la zona y, como título, la StatusPill solo con la zona («Madrid · 50 km», toda en `lime`). Sin pines: las coincidencias van debajo, en la lista.
- El mapa de la zona en la página de una alerta (móvil) es fijo: no se mueve ni se acerca.
- **Alerta sin sitio** (solo marca, combustible o precio): no hay zona. En escritorio, ni círculo ni punto de centro; la StatusPill dice solo el nombre de la alerta («Serie 3 diésel») y el mapa se ajusta a todos los pines. En la página de la alerta en móvil no hay mapa: tras «Creada el …» vienen las coincidencias.
- **Texto largo**: un texto que no cabe se corta en una línea con «…»: la StatusPill, en escritorio y en el mapa de la zona del móvil, deja a la derecha el mismo margen que a la izquierda y nunca se sale del mapa.
- **Zona sin nombre** (alertas creadas antes de guardar el sitio): el círculo sale igual y la zona dice solo el radio: «Clio barato · 50 km», «50 km» en `lime`.
