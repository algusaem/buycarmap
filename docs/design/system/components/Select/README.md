# Select

El campo de elegir entre opciones (marca, modelo, orden). El disparador es un campo; la lista, una tarjeta pequeña.

- Disparador: como cualquier campo, 52px, `radius-field`, fondo `bg`, borde `line` (`lime` con foco o abierto) y el icono `chevron-down` a la derecha.
- Lista: `surface`, borde `line`, `radius-field`, `shadow-float`, 6px de relleno.
- Opciones de 44px con radio de 12px: la que está bajo el ratón o con foco, en `surface-strong`; lo elegido se marca en `violet` (es «lo tuyo») y peso 700, sin rellenar la fila: un `check` a la derecha si se elige una sola opción; una casilla de 20px (radio 6px, borde `text-muted` vacía, rellena de `violet` con check `on-violet` marcada) a la izquierda si se eligen varias.
- El campo muestra los valores elegidos separados por comas y los corta con «…» si no caben. Sin contador.
- Teclado completo: flechas, Intro, Escape y escribir para saltar; lo da el primitivo de Radix.
- Aparece y desaparece con Motion.
