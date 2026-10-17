# Button

Píldoras `radius-pill`. El principal va en `lime` con texto `on-lime`, para lo que la pantalla viene a hacer (Buscar, Ver anuncio, Entrar, Ver coches). Uno por tarea: como mucho dos por vista cuando son tareas distintas (landing: «Crear cuenta» y «Buscar»; Alertas: «Nueva alerta» y «Ver anuncio»).

- **Principal**: `lime` / `on-lime`, peso 800. Si lleva icono, a la izquierda; el de un portal externo, a la derecha.
  - 56px a ancho completo, estilo `button-display` (Unbounded en mayúsculas), al final de un formulario o de los filtros: «ENTRAR», «VER COCHES».
  - 54px, «Buscar» del buscador de la landing: padding 0 24px, lupa de 17px y 7px de hueco (las proporciones de «Ver anuncio»), 16px.
  - 52px a ancho completo, «Buscar» de la landing móvil, 16px, sin icono.
  - 48px, acciones de un EmptyState: padding 0 22px, 15px.
  - 48px a ancho completo, «Ver anuncio» de la hoja del coche en móvil: 15px, icono a 6px.
  - 42px, «Ver anuncio» de la vista previa: padding 0 16px, 14px.
  - Pequeño, por padding: 11px 20px a 15px («Crear cuenta» en la cabecera de la landing) y 10px 16px a 14px («Nueva alerta»).
- **Secundario**: borde 1px `line`, texto `text`, peso 700. 48px a 15px con padding 0 20px («Volver al mapa» en un error de página) y a ancho completo («Guardar» o «Quitar de guardados» en la hoja del coche, con el corazón de 16px a 8px); 44px a 14px con padding 0 18px (botones de AccountCard); 10px 16px a 14px («Cerrar sesión»).
  - Con icono: «Filtros», 10px 16px a 14px, icono de ajustes de tres mandos de 16px, 8px de hueco y la insignia `violet` con el número.
- **Fantasma**: solo texto, peso 700, en `text`.
  - Navegación de cabecera: 15px, padding 10px 16px («Entrar», «Mapa»).
  - Deshacer sin drama: «Quitar filtros», 48px a 15px con padding 0 14px. Al pasar el ratón o con foco, el texto pasa a `danger`.
- **Peligro**: 44px, padding 0 18px, 14px peso 700, borde `danger` al 60 % y texto `danger`. Solo para lo que no tiene vuelta atrás, con una excepción reversible: «Desactivar dos pasos», que rebaja la seguridad y pide la contraseña y un código («Eliminar mi cuenta»; «Desactivar dos pasos» a todo el ancho en su diálogo; «Eliminar alerta» al final de la página de una alerta y «Eliminar» en su hoja de confirmación, los dos a ancho completo en móvil; en escritorio, «Eliminar alerta» va a su ancho), siempre con confirmación.
  - **Confirmar en escritorio**: un diálogo centrado (`role="alertdialog"`) sobre la página oscurecida (`bg` al 72 %, como las hojas del móvil), con lo mismo que la hoja de confirmar: «¿ELIMINAR «COROLLA HÍBRIDO»?», con el nombre de la alerta (Unbounded 15px peso 800, centrado) y, a 4px, «Eliminar» (peligro) y «Cancelar» (fantasma de 44px), los dos a todo el ancho. `surface`, borde `line`, `radius-card`, `shadow-float`, 380px de ancho y padding 20px, como el desplegable de Crear alerta; sin asa. Se cierra con «Cancelar», con Escape o pulsando fuera, y el foco vuelve a «Eliminar alerta».
- **De icono**: 42px redondo con borde `line` y `aria-label` obligatorio (Guardar, Favoritos). Guardado: relleno `violet` sin borde y el corazón relleno en `on-violet`. 40px para cerrar un panel (FilterSheet), con la `x` de 14px, y para el «Cerrar» de la hoja del coche y de la hoja «BUSCAR», que solo se ve con el foco del teclado; y «Volver» de la página de una alerta en móvil, un enlace de 40px con `chevron-left` de 18px.
- **De texto**: «Borrar» del panel de filtros, 14px peso 700 subrayado.
- **Enlaces de texto**: en `text`; al pasar el ratón, `lime`. «Créala» y «Entra», al pie de los formularios de acceso, ya van en `lime` peso 700 porque son la siguiente acción.
- El enlace a un portal externo lleva a la derecha el icono `arrow-up-right` de Lucide (15px, a 6px del texto; nunca el carácter «↗») y abre en pestaña nueva.
- Foco visible: contorno 2px `lime` separado 3px.
