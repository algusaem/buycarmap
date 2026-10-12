# Button

Píldoras de 44px: el principal en `lime` con texto `on-lime`, uno por vista, para lo que la pantalla viene a hacer (Buscar, Ver anuncio, Entrar, Ver coches).

- **Principal**: `lime` / `on-lime`, peso 800. Si lleva icono, a la izquierda.
- **Secundario**: borde 1px `line`, texto `text`. Para Filtros, Guardar, Eliminar.
- **Fantasma**: solo texto, para la navegación de cabecera (Crear alerta, Entrar) y para deshacer sin drama: «Quitar filtros». Al pasar el ratón o con foco, el texto pasa a `danger`.
- **Peligro**: como el secundario, con borde `danger` al 60 % y texto `danger`. Solo para lo que no tiene vuelta atrás («Eliminar mi cuenta»), siempre con confirmación.
- **De icono**: 42px redondo con borde `line` y `aria-label` obligatorio.
- El enlace a un portal externo lleva a la derecha el icono `arrow-up-right` de Lucide (nunca el carácter «↗») y abre en pestaña nueva.
- Foco visible: contorno 2px `lime` separado 3px.
- A ancho completo al final de un formulario se usa el estilo `button-display` (Unbounded en mayúsculas): «VER COCHES», «ENTRAR».
