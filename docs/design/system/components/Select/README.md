# Select

El campo de elegir entre opciones (combustible). La marca y el modelo no van en un Select: se buscan escribiendo (ver SearchPopover). El disparador es un campo; la lista, una tarjeta pequeña.

- Disparador: como cualquier campo, 52px, `radius-field`, fondo `bg`, borde `line` (`lime` con foco o abierto) y el icono `chevron-down` (18px, trazo 2,4) a la derecha, a 12px del valor.
- Lista: `surface`, borde `line`, `radius-field`, `shadow-float`, 6px de relleno.
- Opciones de 44px, 15px peso 500, con `radius-option`: la que está bajo el ratón o con foco, en `surface-strong`; lo elegido se marca en `violet` (es «lo tuyo») y peso 700, sin rellenar la fila.
- Un solo estilo: el selector lleva siempre casillas, se elija una opción o varias (Combustible). Casilla de 20px a la izquierda, a 12px del texto: radio 6px, borde `text-muted` vacía, rellena de `violet` con un check `on-violet` de 14px y trazo 3,2 marcada.
- El disparador muestra los valores elegidos separados por comas y los corta con «…» si no caben. Sin contador.
- Teclado completo: flechas, Intro, Escape y escribir para saltar; lo da el primitivo de Radix.
- Aparece y desaparece con Motion.
