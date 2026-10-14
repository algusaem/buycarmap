# MapZoom

Acercar y alejar el mapa en escritorio, abajo a la derecha (18px del borde, 24px del fondo).

- Una columna `surface` con borde `line` y `radius-pill`: dos botones de 42×42px, «+» arriba y «−» abajo, a 20px, separados por un divisor `line`.
- Cada botón lleva `aria-label` («Acercar», «Alejar»).
- Estados de cada botón:
  - Reposo: sin relleno (se ve el `surface` de la columna) y el signo en `text`.
  - Al pasar el ratón: el fondo del botón pasa a `surface-strong` y el signo sigue en `text`.
  - Con foco: contorno 2px `lime` por dentro del botón.
- El mapa móvil no lo lleva.
