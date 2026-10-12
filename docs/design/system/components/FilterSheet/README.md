# FilterSheet

El panel completo de filtros en móvil, a pantalla completa, como `role="dialog"`.

- **Cabecera** de 70px, padding lateral 20px y divisor `line-soft`: a la izquierda cerrar (botón de icono de 40px con borde `line` y la `x` de 14px), en medio «FILTROS» en Unbounded 16 peso 800, a la derecha «Borrar» (botón de texto de 14px peso 700, subrayado).
- **Cuerpo**: padding 22px 20px, 26px entre secciones y 12px dentro de cada una. Cada sección empieza con su `section-label` (12px peso 700, mayúsculas, `text-muted`).
- **Precio**: un rango con la pista de 4px en `line`, el tramo elegido y los dos mandos de 24px en `lime`; debajo, dos cajas `surface` con borde `line`, `radius-field` y padding 10px 14px: «Mínimo» / «Máximo» a 11px `text-muted` y el valor a 16px.
- **Combustible**: chips del panel (padding 10px 16px), en varias líneas, varios activos a la vez.
- **Cambio**: un control segmentado `surface` con borde `line`, `radius-pill` y 4px de relleno; las opciones se reparten el ancho (flex 1, padding 10px, 14px peso 600) y la elegida va invertida, relleno `text` con texto `bg` y peso 800.
- **Kilómetros y año**: dos campos `surface` con borde `line`, `radius-field`, padding 12px 14px y 15px, sin chevron.
- **Pie**: padding 14px 20px 28px con divisor `line-soft` arriba, y «VER COCHES»: principal de 56px a todo el ancho con `button-display`.
- Los mandos del rango son sliders con su valor en texto («3.000 €»); el segmentado es un grupo de radios.
