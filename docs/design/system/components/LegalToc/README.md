# LegalToc

El índice «En esta página» de Privacidad y Términos: un enlace por apartado, que lleva a su título.

- **Escritorio** (también a 1024px): columna de 260px a 72px del texto, fija mientras el texto baja. «En esta página» en 12px peso 700 `text-muted` y, a 8px, los apartados en 14px peso 600 con 7px de relleno vertical. El apartado que está en pantalla, en `text` con la barra `lime` de 2px a la izquierda (12px hasta el texto) y `aria-current="location"`; los demás, en `text-muted` a 14px.
- **Móvil**: plegado en un botón `surface` con borde `line` y `radius-field` (padding 12px 16px, 14px peso 700) con `chevron-down`, tras la fecha. Pulsarlo lo abre (`aria-expanded`): la lista va dentro del mismo campo, tras un divisor `line-soft`, con el apartado que se lee marcado igual que en escritorio, y el chevron mira arriba. Al tocar un apartado, la página baja hasta su título y el índice se pliega.
- Los apartados son los títulos de la página; las dos páginas usan la misma plantilla.
