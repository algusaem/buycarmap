# AlertZone

La zona que vigila una alerta: un círculo sobre el mapa con el radio elegido. Tiene que leerse como zona, no gritar.

- Borde `lime` continuo de 2px al 80%. Nunca discontinuo.
- Relleno `lime` al 10%: un velo, el mapa y los pines se siguen viendo debajo.
- Punto de centro: `text` de 7px con borde `bg` de 3px.
- Encima, a la izquierda del mapa, una StatusPill con la alerta y su zona: «Corolla híbrido · Madrid · 50 km», la zona en `lime`.
- Los pines (PricePin) de las coincidencias van por encima de la zona; el activo, sin borde y con su halo.
- Es decorativa: el radio ya está en la píldora y en los criterios de la alerta, así que el círculo va con `aria-hidden`.
- Solo en la pantalla de Alertas en escritorio (y al crear una), una zona cada vez. En móvil, Alertas no lleva mapa: la zona va en el resumen de cada AlertCard.
