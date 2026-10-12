# PricePin

Cada coche en el mapa es una píldora con su precio; el activo pasa a `lime` con halo `shadow-pin-active`.

- Normal: `surface`, borde `line`, texto `text` peso 700. Escritorio: 14px, padding 7px 13px. Móvil: 13px, padding 6px 11px.
- Activo (abierto o con su tarjeta bajo el ratón): `lime` / `on-lime`, peso 800, sin borde, y halo de 7px (`shadow-pin-active`) en escritorio y en móvil. No va solo en el color: también cambia el peso y aparece el halo.
- Varios coches en el mismo punto: un solo pin «3 coches · desde 9.500 €».
- Es un botón: con Enter o Espacio abre la vista previa (MapPreview).
- Sobre el mapa oscuro mínimo: `map-ground`, `map-road`, `map-road-major`, `map-road-minor` (calles pequeñas, trazo 3px) y `map-water`.
- Lo que explica el mapa va en una StatusPill arriba a la izquierda; el zoom, en MapZoom abajo a la derecha.
