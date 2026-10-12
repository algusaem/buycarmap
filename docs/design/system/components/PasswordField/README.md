# PasswordField

El campo de contraseña del registro y de «nueva contraseña», con el medidor debajo.

- Campo estándar (52px, `radius-field`, fondo `bg`, borde `line`; con foco, borde `lime`), con la etiqueta `field-label` a 8px encima. También en móvil el campo va sobre `bg`.
- Medidor de 4 tramos de 4px con 6px entre tramos, a 10px del campo; los superados en `lime`, el resto en `line`. A 6px por debajo, «Seguridad: **buena**» en 12px `text-muted`, con el nivel en `text`.
- Es una pista: la regla de verdad está en el servidor. Se acepta pegar.
- La repetición va en un segundo campo «Repite la contraseña».
