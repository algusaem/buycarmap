# FilterSheet

El panel completo de filtros, como `role="dialog"`. Lo abre «Filtros» (ver Chip). En móvil es una pantalla completa; en escritorio, un desplegable anclado bajo «Filtros». El cuerpo es idéntico en los dos: las mismas seis secciones (Precio, Combustible, Cambio, Kilómetros y año, Publicado, Marca y modelo), en el mismo orden, con los mismos controles, medidas y textos. Solo cambian la cabecera, el marco y cómo se cierra.

## Móvil: pantalla completa

- **Cabecera** de 70px, padding lateral 20px y divisor `line-soft`: a la izquierda cerrar (botón de icono de 40px con borde `line` y la `x` de 14px), en medio «FILTROS» en Unbounded 16 peso 800, a la derecha «Borrar» (botón de texto de 14px peso 700, subrayado).
- **Cuerpo**: el mismo que en escritorio. Ocupa el alto que queda entre la cabecera y el pie y se desliza por dentro (scroll vertical con barra fina); el panel no crece más que la pantalla.
- **Pie**: padding 14px 20px 28px con divisor `line-soft` arriba, y «VER COCHES»: principal de 56px a todo el ancho con `button-display`.
- Se cierra con su botón de cerrar o con «Ver coches».

## Escritorio: desplegable

- Una tarjeta flotante de 460px anclada 8px bajo «Filtros» y alineada a su borde izquierdo: `surface`, borde 1px `line`, `radius-card` y `shadow-float`. Mide 640px de alto como mucho.
- **Cabecera** de 70px, padding lateral 20px y divisor `line-soft`: «FILTROS» (Unbounded 16 peso 800) a la izquierda y «Borrar» a la derecha. Sin botón de cerrar.
- **Cuerpo**: se desliza por dentro (scroll vertical con barra fina) cuando no cabe; la cabecera y el pie quedan fijos.
- **Pie**: el mismo que en móvil, con «VER COCHES» de 56px.
- Se cierra con «Ver coches», al pulsar fuera de la tarjeta o con Escape.

## Cuerpo (móvil y escritorio)

- Padding 22px 20px, 26px entre secciones y 12px dentro de cada una. Cada sección empieza con su `section-label` (12px peso 700, mayúsculas, `text-muted`).
- **Precio**: un rango con la pista de 4px en `line`, el tramo elegido y los dos mandos de 24px en `lime`; debajo, dos cajas `surface` con borde `line`, `radius-field` y padding 10px 14px: «Mínimo» / «Máximo» a 11px `text-muted` y el valor a 16px.
- **Combustible**: chips del panel (padding 10px 16px), en varias líneas, varios activos a la vez.
- **Cambio**: un control segmentado `surface` con borde `line`, `radius-pill` y 4px de relleno; las opciones se reparten el ancho (flex 1, padding 10px, 14px peso 600) y la elegida va invertida, relleno `text` con texto `bg` y peso 800.
- **Kilómetros y año**: dos campos `surface` con borde `line`, `radius-field`, padding 12px 14px y 15px, sin chevron.
- **Publicado**: chips del panel, uno activo: «Cualquier momento», «Últimas 24 h», «Última semana», «Último mes».
- **Marca y modelo**: un solo campo de 52px que busca mientras escribes, «Marca o modelo…», el mismo que Coche en [SearchPopover](../SearchPopover/README.md): fondo `bg`, borde `line`, `radius-field` y la lupa de 18px en `text-muted`.
- Los mandos del rango son sliders con su valor en texto («20.000 €»); el segmentado es un grupo de radios.
