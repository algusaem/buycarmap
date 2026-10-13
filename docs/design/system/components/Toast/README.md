# Toast

El aviso que confirma o explica algo que acaba de pasar. Es la tarjeta flotante del mapa en pequeño.

- `surface`, borde 1px `line`, `radius-card`, `shadow-float`; 380px de ancho como mucho, arriba al centro.
- Icono de 18px (trazo 2,4) a la izquierda: `check-circle` en `lime` si salió bien, `alert-circle` en `danger` si falló. El texto, en `text` a 15px peso 600, una frase corta. Sin punto final.
- Una acción opcional («Deshacer») como botón fantasma con el texto en `lime`: es lo que puedes hacer ahora. Y el botón de cerrar de 32px, con la `x` de 16px en `text-muted` y `aria-label`.
- En móvil, a 16px de los lados y 12px por debajo de la cabecera. Al quitar un guardado: «Quitado de guardados» con «Deshacer».
- Nunca para un error de formulario: eso va junto al campo.
- Sonner lo anima; se anuncia con `aria-live="polite"`.
