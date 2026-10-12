# BottomSheet

En móvil, los resultados viven en una hoja `surface` que sube sobre el mapa a pantalla completa, con tres posiciones: asomada, media y completa.

- Asomada enseña solo el título («CERCA DE MADRID»); media (520px de alto), la primera tarjeta; completa, la lista.
- Esquinas superiores `radius-sheet` (las de abajo, rectas), borde superior `line`, relleno 10px 20px 0 y 14px entre bloques.
- El asa: 40×5px en `handle`, centrada. Es un botón: pulsarlo alterna entre completa y asomada; `aria-expanded` solo es verdadero en completa.
- Título en Unbounded 15px peso 800, en mayúsculas y centrado.
- La tarjeta: foto de 250px `radius-card` con el icono de coche (70px) en `photo-icon` y la insignia de fuente sobre `scrim`; nombre y ciudad; metadatos subidos 10px; precio Unbounded 22px en `lime`, sin espacio entre letras.
- Arrastrar es un atajo, nunca la única forma (se puede todo con el asa y el teclado).
