# PasswordField

El campo de contraseña del registro y de «nueva contraseña», con el medidor debajo.

- Campo estándar (52px, `radius-field`, fondo `bg`, borde `line`; con foco, borde `lime`), con la etiqueta `field-label` a 8px encima. También en móvil el campo va sobre `bg`.
- Medidor de 4 tramos de 4px con 6px entre tramos, a 10px del campo; los superados en `lime`, el resto en `line`. A 6px por debajo, «Seguridad: **buena**» en 12px `text-muted`, con el nivel en `text`.
- Es una pista: la regla de verdad está en el servidor. Se acepta pegar.
- La repetición va en un segundo campo «Repite la contraseña».
- El campo lleva un botón de mostrar/ocultar a su derecha, `eye` / `eye-off` (Lucide), objetivo de 44px, con nombre accesible «Mostrar contraseña» / «Ocultar contraseña»; se usa en `/login` y en todos los campos de contraseña de F7.
- **Con error**: al enviar con el campo vacío o no válido, el mensaje va justo debajo del campo, a 8px, con el mismo estilo que el error de «Ponle un nombre a la alerta.» en Crear alerta (`circle-alert` de 18px en `danger`, texto en `text` a 14px peso 600, `role="alert"`); el borde del campo no cambia. En `/login`, «La contraseña es obligatoria» (`authErrors.passwordRequired`). El error va fuera del contenedor del ojo, así que el botón sigue centrado en el campo y no en campo y error. El mismo patrón vale para el campo de email («El email es obligatorio», «Introduce un email válido»).
- **Con error y medidor** (registro, nueva contraseña, cambiar contraseña): la contraseña que rechaza el servidor (filtrada, demasiado fácil de adivinar o la misma de antes) va bajo el campo, a 8px, y el medidor debajo del error, a 10px. Nunca en un aviso flotante. El medidor es una pista: puede decir «muy buena» y el servidor rechazarla.
- **Lo que falla**: bajo «Seguridad: …», una línea por cosa, 12px en `text-muted` con interlineado 1,4 y 4px entre líneas: «Demasiado corta: usa al menos 12 caracteres», «Evita secuencias como “abcd” o “1234”» (`passwordStrength.issues.*`). Sin nada concreto que falle y por debajo de «buena», la pista, con el mismo estilo: «Tres o cuatro palabras sin relación entre sí forman una contraseña segura y fácil de recordar.» No bloquea: es una pista.
- Niveles, en minúscula tras «Seguridad:»: «muy débil», «débil», «aceptable», «buena», «muy buena».
