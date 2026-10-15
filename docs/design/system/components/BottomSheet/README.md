# BottomSheet

En móvil, los resultados viven en una hoja `surface` que sube sobre el mapa, apoyada en la barra inferior (BottomNav), con tres posiciones: asomada, media y completa. Las mismas piezas hacen las hojas modales: la del coche y la de confirmar.

- Asomada enseña solo el título; media (520px de alto), la primera tarjeta; completa, la lista. Asomada y media quedan encima de la barra; completa sube hasta arriba y la barra se esconde hasta que la hoja baja.
- El título es el número de coches: «MÁS DE 40 COCHES» mientras quedan páginas por traer, «24 COCHES» cuando las fuentes se acaban y «1 COCHE» si solo hay uno; con uno y más por traer, «MÁS DE 1 COCHE». Sin número todavía: «BUSCANDO COCHES…» mientras carga, «NINGÚN COCHE» sin resultados y «COCHES» si la búsqueda falla. Una sola línea, sin el sitio debajo.
- Esquinas superiores `radius-sheet` (las de abajo, rectas), borde superior `line`, relleno 10px 20px 0 y 14px entre bloques.
- En completa, con la barra inferior escondida, el final de la lista lleva un padding inferior de 24px más el margen seguro inferior (`space-sheet-full-bottom`), para que la última tarjeta y el indicador de carga de la página siguiente queden por encima de la barra de inicio del iPhone.
- El asa: 40×5px en `handle`, centrada. Es un botón: pulsarlo alterna entre completa y asomada; `aria-expanded` solo es verdadero en completa. Su nombre para lectores de pantalla es «Lista de resultados».
- Título en Unbounded 15px peso 800, en mayúsculas y centrado.
- La tarjeta: foto de 250px `radius-card` con el icono de coche (70px) en `photo-icon` y la insignia de fuente sobre `scrim`; nombre y ciudad; metadatos subidos 10px; precio Unbounded 22px en `lime`, sin espacio entre letras.
- Arrastrar es un atajo, nunca la única forma (se puede todo con el asa y el teclado). **Aún no está hecho**: arrastrar la hoja falta y está pendiente en la issue [#126](https://github.com/algusaem/buycarmap/issues/126). Hoy la hoja se mueve con el asa y con el teclado.

## Hojas modales

Suben desde abajo por encima de todo, la barra inferior incluida, sobre la pantalla oscurecida (`bg` al 72 %, como Crear alerta). Mismo `surface`, borde superior `line`, `radius-sheet` arriba, relleno 10px 20px 34px y 14px entre bloques. No llevan `x` de cerrar a la vista: en el móvil no tiene sentido. Se cierran arrastrando el asa hacia abajo, tocando fuera o con Escape, y el foco vuelve a lo que la abrió.

- **Arrastrar para cerrar**: se arrastra desde el asa, una franja a todo el ancho en lo alto de la hoja, y nunca desde el contenido, para no quitarle el scroll. Si la hoja baja más de 100px, o se suelta con un gesto rápido hacia abajo (más de 800px/s), se cierra; si no, vuelve a su sitio. Hacia arriba no sube: cede un poco y vuelve. Con movimiento reducido vuelve a su sitio sin animación.
- **«Cerrar» para lectores de pantalla**: la hoja del coche y la hoja «BUSCAR» (SearchPopover) conservan su botón «Cerrar», oculto a la vista pero anunciado y alcanzable con el teclado. Con el foco del teclado aparece donde estaba la `x`: botón de icono de 40px con la `x` de 14px, su anillo de foco y su área de 44px. Crear alerta ya tiene «Cancelar».

- **Hoja del coche** (`role="dialog"`, con el nombre del coche): lo que en escritorio es la vista previa (MapPreview). La abre un pin del mapa, una fila de Guardados o una coincidencia de una alerta. Arriba, el asa centrada, sin `x` de cerrar. «Cerrar» (`aria-label="Cerrar"`) queda oculto y, con el foco del teclado, aparece arriba a la derecha: botón de icono de 40px con la `x` de 14px. Foto de 200px `radius-card` con la insignia de fuente sobre `scrim`; nombre (16px) y ciudad (14px `text-muted`) en una fila; «año · km · combustible» en `meta`, subido 10px; precio Unbounded 22px en `lime`. Debajo, apilados a 10px y a todo el ancho: el secundario de 48px «Guardar» (corazón de contorno de 16px a 8px) o, si ya está guardado, «Quitar de guardados» (corazón relleno `violet`), y «Ver anuncio», principal de 48px con `arrow-up-right`, que abre el portal en pestaña nueva.
- **Quitar de guardados** desde Guardados: la hoja se cierra, la fila sale de la lista y sale el aviso (Toast) «Quitado de guardados» con «Deshacer».
- **Confirmar** (`role="alertdialog"`): el asa, el título centrado (Unbounded 15px peso 800, en mayúsculas: «¿ELIMINAR ESTA ALERTA?») y a 4px los dos botones a todo el ancho: «Eliminar», el de peligro (44px, borde `danger` al 60 % y texto `danger`, ver Button), y «Cancelar», fantasma de 44px.
