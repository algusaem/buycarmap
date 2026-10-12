# Toast

El aviso que confirma o explica algo que acaba de pasar. Es la tarjeta flotante del mapa en pequeño.

- `surface`, borde 1px `line`, `radius-card`, `shadow-float`; 380px de ancho como mucho, arriba al centro.
- Icono a la izquierda: `check-circle` en `lime` si salió bien, `alert-circle` en `danger` si falló. El texto, en `text` a 15px peso 600, una frase sin punto final de más.
- Una acción opcional («Deshacer») como botón fantasma con el texto en `lime`: es lo que puedes hacer ahora. Y el botón de cerrar con `aria-label`.
- Nunca para un error de formulario: eso va junto al campo.
- Sonner lo anima; se anuncia con `aria-live="polite"`.
