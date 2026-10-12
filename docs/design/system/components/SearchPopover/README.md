# SearchPopover

El selector de cada segmento del buscador (ver [SearchPill](../SearchPill/README.md)): Dónde, Coche y Precio. Es un `role="dialog"` con el nombre del segmento. En escritorio, un desplegable anclado bajo la píldora; en móvil, los tres van juntos en la hoja «BUSCAR».

## Escritorio: desplegable

- Una tarjeta flotante de 420px anclada 8px bajo la píldora y alineada al borde izquierdo de su segmento: `surface`, borde 1px `line`, `radius-card` y `shadow-float`, padding 20px y 16px entre piezas.
- **Segmento abierto**: lleva `aria-expanded="true"` (los demás, `false`; todos `aria-haspopup="dialog"`) y un subrayado `lime` de 2px con `radius-pill`, a 22px de cada lado del segmento, pegado a su borde inferior.
- **Campo**: 52px, fondo `bg`, borde `line` (`lime` con foco), `radius-field`, la lupa de 18px (trazo 2,4) en `text-muted` a la izquierda y el texto a 16px. Con texto, a la derecha el botón de borrar de 44px con la `x` de 16px en `text-muted` («Borrar texto»).
- **Resultados**: un `listbox` de opciones de 44px, 15px peso 500, `radius-option`, 14px de padding a la izquierda. La que está bajo el ratón o con foco, en `surface-strong`; lo elegido, a peso 700 con un check `violet` de 18px a la derecha, sin rellenar la fila. Los títulos de grupo, como `section-label` (12px peso 700, mayúsculas, `text-muted`).
- **Al pie**, un botón fantasma de 44px a todo el ancho (15px peso 700) que quita el criterio: «Toda España», «Cualquier marca», «Cualquier precio».
- Lo elegido se aplica al momento: el valor de la píldora cambia en cuanto se elige.
- Se cierra al pulsar fuera de la tarjeta o con Escape.

## Dónde

- El campo «Ciudad o código postal» busca mientras escribes; cada sitio es una opción, con su provincia o comunidad en una segunda línea a 13px `text-muted` cuando la tiene («Madrid» · «Comunidad de Madrid»).
- Debajo, un divisor `line-soft` a todo el ancho de la tarjeta y la sección «Radio»: chips de 10, 25, 50, 100 y 200 km que se reparten el ancho (un grupo de radios); el elegido en `violet` con `on-violet` y peso 800, los demás con borde `line` y peso 600.
- Al pie, «Toda España».

## Coche

Un solo campo que busca mientras escribes, «Marca o modelo…».

- **Escribiendo** («Toy»): los resultados agrupados en «Marcas» («Toyota») y «Modelos» («Toyota Corolla», «Toyota Yaris», «Toyota C-HR»).- **Con una marca elegida**: arriba, la marca como chip `violet` de 36px que se quita con su `x` (botón de 44px, «Quitar Toyota»); debajo, el campo pasa a «Modelo de Toyota…» y lista solo sus modelos, sin repetir la marca («Corolla», «Yaris», «C-HR»).
- **Reabierto** con un modelo elegido: el modelo lleva el check `violet` a la derecha.
- La píldora muestra lo elegido: «Cualquier marca», «Toyota», «Toyota Corolla».
- Al pie, «Cualquier marca».

## Precio

- El rango de [FilterSheet](../FilterSheet/README.md): pista de 4px en `line`, el tramo elegido y los dos mandos de 24px en `lime` (sliders con su valor en texto, «20.000 €»), y debajo las cajas «Mínimo» / «Máximo» (`surface`, borde `line`, `radius-field`, padding 10px 14px; etiqueta a 11px `text-muted` y valor a 16px).
- Atajos: chips «Hasta 5.000 €», «Hasta 10.000 €», «Hasta 20.000 €» y «Hasta 30.000 €» (un grupo de radios, padding 10px 16px), en varias líneas; el activo en `violet`.
- Al pie, «Cualquier precio».

## Móvil: la hoja «BUSCAR»

- Tocar la fila del buscador (el resumen) abre la hoja. `surface`, borde superior `line`, `radius-sheet` arriba, pegada abajo y con el asa (`handle`, 40 × 5) arriba al centro. Detrás, el mapa oscurecido.
- **Cabecera** de 70px, padding lateral 20px y divisor `line-soft`: a la izquierda cerrar (botón de icono de 40px con borde `line` y la `x` de 14px), en medio «BUSCAR» en Unbounded 16 peso 800, a la derecha «Borrar» (botón de texto de 14px peso 700, subrayado).
- **Cuerpo**: padding 22px 20px y 26px entre secciones, cada una con su `section-label`: «Dónde» (el campo y los chips de radio, de 44px de alto, que se reparten el ancho), «Coche» (el mismo campo que en escritorio, con el chip de la marca cuando la hay) y «Precio» (el rango y las cajas).
- **Pie**: padding 14px 20px 28px con divisor `line-soft` arriba, y «VER COCHES»: principal de 56px a todo el ancho con `button-display`.
- Se cierra con su botón de cerrar o con «Ver coches».

## Teclado y lectores de pantalla

- Cada campo es un `combobox` de su `listbox`: con las flechas se recorren las opciones, Intro elige la que tiene el foco y Escape cierra el desplegable y devuelve el foco a su segmento.
- El número de resultados se anuncia en un texto oculto con `role="status"` y `aria-live="polite"` («4 resultados»).
- Los chips de radio y los atajos de precio son grupos de radios; los mandos del rango, sliders con su valor en texto.

## Movimiento

- El desplegable y la hoja aparecen y desaparecen con Motion.
