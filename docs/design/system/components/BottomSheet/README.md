# BottomSheet

En móvil, los resultados viven en una hoja `surface` que sube sobre el mapa a pantalla completa, con tres posiciones: asomada, media y completa.

- Asomada enseña solo el título («CERCA DE MADRID»); media, la primera tarjeta; completa, la lista.
- El asa es un botón: pulsarlo alterna entre completa y asomada; `aria-expanded` solo es verdadero en completa.
- Arrastrar es un atajo, nunca la única forma (se puede todo con el asa y el teclado).
- Esquinas superiores `radius-sheet`, borde superior `line`.
- El asa usa un gris propio (#3A3A40) que aún no es token.
