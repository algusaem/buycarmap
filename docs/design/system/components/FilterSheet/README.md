# FilterSheet

El panel completo de filtros, como `role="dialog"`. Lo abre «Filtros» (ver Chip). En móvil es una pantalla completa; en escritorio, un desplegable anclado bajo «Filtros». El cuerpo es idéntico en los dos: las mismas siete secciones (Precio, Combustible, Cambio, Kilómetros, Año, Publicado, Marca y modelo), en el mismo orden, con los mismos controles, medidas y textos. Solo cambian la cabecera, el marco y cómo se cierra.

## Móvil: pantalla completa

- **Cabecera** de 70px, padding lateral 20px y divisor `line-soft`: a la izquierda cerrar (botón de icono de 40px con borde `line` y la `x` de 14px), en medio «FILTROS» en Unbounded 16 peso 800, a la derecha «Borrar» (botón de texto de 14px peso 700, subrayado).
- **Cuerpo**: el mismo que en escritorio. Ocupa el alto que queda entre la cabecera y el pie y se desliza por dentro (scroll vertical con barra fina); el panel no crece más que la pantalla.
- **Pie**: padding 14px 20px 28px con divisor `line-soft` arriba, y «VER COCHES»: principal de 56px a todo el ancho con `button-display`. Mientras el teclado del móvil está abierto se oculta y el cuerpo gana su sitio; vuelve al cerrarlo.
- Lo elegido no se aplica al momento: la búsqueda, la insignia de «Filtros» y los filtros rápidos cambian al pulsar «Ver coches», como en la hoja «BUSCAR» de [SearchPopover](../SearchPopover/README.md). Cerrar el panel descarta lo elegido; «Borrar» vacía el panel, que tampoco se aplica hasta «Ver coches».
- Se cierra con su botón de cerrar o con «Ver coches».

## Escritorio: desplegable

- Una tarjeta flotante de 460px anclada 8px bajo «Filtros» y alineada a su borde izquierdo: `surface`, borde 1px `line`, `radius-card` y `shadow-float`. Mide 640px de alto como mucho.
- **Cabecera** de 70px, padding lateral 20px y divisor `line-soft`: «FILTROS» (Unbounded 16 peso 800) a la izquierda y «Borrar» a la derecha. Sin botón de cerrar.
- **Cuerpo**: se desliza por dentro (scroll vertical con barra fina) cuando no cabe; la cabecera y el pie quedan fijos.
- **Pie**: el mismo que en móvil, con «VER COCHES» de 56px.
- Lo elegido se aplica al momento: la búsqueda, la insignia de «Filtros» y los filtros rápidos cambian en cuanto se elige, y «Ver coches» solo cierra.
- Con muchos filtros activos, la fila no cambia: «Filtros» lleva el número y los filtros rápidos que coinciden van pulsados, sin chips que quitar (ver [Chip](../Chip/README.md)). El desplegable sigue anclado bajo «Filtros», en la segunda fila de la cabecera.
- Se cierra con «Ver coches», al pulsar fuera de la tarjeta o con Escape.

## Cuerpo (móvil y escritorio)

- Padding 22px 20px, 26px entre secciones y 12px dentro de cada una. Cada sección empieza con su `section-label` (12px peso 700, mayúsculas, `text-muted`).
- **Precio**: un rango de 0 a 30.000 € en pasos de 500 €, con la pista de 4px en `line`, el tramo elegido y los dos mandos de 24px en `lime`; el mando derecho al final quiere decir sin máximo. Debajo, dos cajas `surface` con borde `line`, `radius-field` y padding 10px 14px: «Mínimo» / «Máximo» a 11px `text-muted` y el valor a 16px. Las cajas aceptan cualquier cantidad: por encima de 30.000 € el mando se queda al final y la caja guarda la cantidad exacta.
- **Combustible**: chips del panel (padding 10px 16px), en varias líneas, varios activos a la vez.
- **Cambio**: «Todos», «Manual» y «Automático»; solo hay dos tipos de cambio, así que «Todos» cubre cualquier combinación. Un control segmentado `surface` con borde `line`, `radius-pill` y 4px de relleno; las opciones se reparten el ancho (flex 1, padding 10px, 14px peso 600) y la elegida va invertida, relleno `text` con texto `bg` y peso 800.
- **Kilómetros**: dos campos como las cajas de precio, `surface` con borde `line`, `radius-field` y padding 10px 14px, sin chevron, cada uno con su etiqueta visible a 11px `text-muted` sobre el valor a 16px: «Mínimo» y «Máximo». El valor va sin repetir la etiqueta: «50.000 km», «100.000 km»; vacíos, el ejemplo «50.000…» y «100.000…» en `text-muted`.
- **Año**: un solo campo igual, de la mitad del ancho, con la etiqueta «Desde»: «2017»; vacío, el ejemplo «2017…» en `text-muted`.
- **Publicado**: chips del panel, uno activo: «Cualquier momento», «Últimas 24 h», «Última semana», «Último mes».
- **Marca y modelo**: un solo campo de 52px que busca mientras escribes, «Marca o modelo…», el mismo que Coche en [SearchPopover](../SearchPopover/README.md): fondo `bg`, borde `line`, `radius-field` y la lupa de 18px en `text-muted`.
- Los mandos del rango son sliders con su valor en texto («20.000 €»); el segmentado es un grupo de radios.
- Movimiento: el desplegable «Filtros» se funde y se mueve 4px en 180ms al abrirlo o cerrarlo con el ratón; con Intro, Espacio o Escape aparece y desaparece al instante.
