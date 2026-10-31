# CreateAlert

Guarda la búsqueda del mapa como una alerta. Lo abre «Crear alerta» (ver HeaderNav en escritorio y, en móvil, el botón de la hoja inferior). Es un `role="dialog"` con el nombre de la alerta, el resumen de la búsqueda y dos botones.

- **Escritorio**: un desplegable de 380px anclado 8px bajo «Crear alerta» de la cabecera y alineado a su borde derecho. `surface`, borde 1px `line`, `radius-card`, `shadow-float`, padding 20px y 14px entre piezas.
- **Móvil**: arriba de la hoja inferior, bajo su título, un botón secundario de 44px a todo el ancho (borde `line`, `radius-pill`, 14px peso 700) con el icono bell-plus de Lucide de 18px. Abre la misma tarjeta como hoja inferior: `surface`, borde superior `line`, `radius-sheet` arriba, padding 10px 20px 34px, con el asa (`handle`) y el título centrados. Detrás, el mapa oscurecido (`bg` al 72 %), con la barra inferior debajo. Se cierra arrastrando el asa hacia abajo, tocando fuera, con Escape o con «Cancelar» (ver [BottomSheet](../BottomSheet/README.md) › Hojas modales).
- **Título** «CREAR ALERTA» en Unbounded peso 800, 16px en escritorio y 15px en móvil.
- **Nombre**: la etiqueta «Nombre» (`field-label`) y un campo de 52px (`bg`, borde `line`, `radius-field`, 16px), ya relleno con la marca, el modelo y el sitio de la búsqueda: «Toyota Corolla · Madrid». Se puede cambiar.
- **Sin nombre**: si el nombre queda vacío (quitando los espacios), al pulsar «Crear alerta» no se envía nada y bajo el campo sale el error, con el mismo estilo que el aviso de «Demasiado amplia» (`alert-circle` de 18px en `danger`, texto en `text` a 14px peso 600): «Ponle un nombre a la alerta.» (`role="alert"`).
- **Resumen**: la búsqueda que guarda, en una línea a 14px `text-muted`, con « · » entre criterios: «Toyota Corolla · Hasta 20.000 € · Madrid · 50 km». Los kilómetros se escriben «Hasta 100.000 km», «Desde 50.000 km» o, con los dos, «50.000 – 100.000 km». La alerta no guarda «Publicado», así que el resumen nunca lo muestra.
- **Botones**: «Crear alerta» principal de 48px a todo el ancho y, debajo, «Cancelar» fantasma de 44px.
- **Demasiado amplia**: si la búsqueda no tiene marca, ni precio máximo, ni zona, el resumen lo dice («Cualquier marca · Cualquier precio») y debajo va el aviso, con `alert-circle` de 18px en `danger` y el texto en `text` a 14px peso 600: «Añade una marca, un precio máximo o una zona para crear la alerta.» (`role="alert"`). «Crear alerta» queda desactivado (`aria-disabled="true"`, al 40 %).
- **Sin red**: si la alerta no se puede crear por un fallo de red, bajo el resumen sale el aviso, con el mismo estilo que el de «Demasiado amplia» (`alert-circle` de 18px en `danger`, texto en `text` a 14px peso 600): «No hemos podido crear la alerta. Vuelve a intentarlo.» (`role="alert"`).
- **Creada**: se cierra y sale el aviso (Toast) «Alerta creada» con la acción «Ver alertas», arriba al centro.
- **Ya la tienes**: si ya tienes una alerta activa con esa misma búsqueda, se cierra igual y sale el mismo aviso con «Ya tienes esta alerta» y la acción «Ver alertas». Pasa también si ya tienes 20 alertas, porque no se crea ninguna nueva.
- **Pausada o borrada**: si esa alerta estaba pausada desde el correo o la habías borrado, vuelve a activarse con el nombre nuevo y el aviso es «Alerta creada».
- **La búsqueda que guarda**: los criterios del mapa sin «Publicado» y sin el texto libre que llega de la landing (`?q=`).
- Abrir «Crear alerta» cierra la vista previa (MapPreview) que esté abierta.
- Movimiento: el diálogo se funde en 180ms (en el móvil, la hoja sube en 240ms) cuando se abre o cierra con el ratón; con el teclado aparece y desaparece al instante. Los avisos se funden tras un clic y aparecen al instante tras una tecla.
