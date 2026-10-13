# StatusPill

Una píldora arriba a la izquierda del mapa que dice qué estás viendo o qué está pasando.

- `surface`, borde `line`, `radius-pill`, padding 10px 16px, 14px peso 700. A 18px de los bordes del mapa.
- Estados, con `role="status"` para que se anuncien: «Buscando coches…» (cargando), «Ningún coche en 50 km» (sin resultados; «Ningún coche con estos filtros» sin sitio o a 200 km, sin nombrar un radio), «Sin conexión con los anuncios» (error de búsqueda), «Aquí saldrán tus guardados» y «Aquí verás la zona de cada alerta» (vacíos).
- Títulos del mapa, sin `role`: «Tus guardados en el mapa» en Guardados y, en Alertas, la alerta con su zona: «Corolla híbrido · Madrid · 50 km», la zona en `lime`.
- Una sola a la vez. En escritorio, sobre el mapa; en móvil el estado va en la hoja inferior.
- En móvil, la única píldora es el título de la zona en la página de una alerta: solo la zona, toda en `lime` («Madrid · 50 km»), porque el nombre de la alerta ya es el título de la página.
