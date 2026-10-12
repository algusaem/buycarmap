# BottomNav

En móvil, una píldora flotante abajo con Mapa · Guardados · Alertas; la sección actual va en `violet` con `aria-current="page"`.

- 62px de alto, `surface`, borde `line`; texto 13px peso 700.
- Solo la sección actual lleva relleno (`violet`, padding 10px 16px); las demás son texto sin caja.
- En Cuenta no hay sección actual en la barra: lo marca el aro del avatar de la cabecera (`shadow-current-sm`).
- Flota a 16px de los bordes y 24px del fondo, respetando la zona segura del teléfono.
- Va en Guardados, Alertas y Cuenta. En el mapa móvil no hay barra: manda la hoja inferior.
- Solo con sesión iniciada; sin sesión, la cabecera ofrece «Entrar».
- En escritorio no existe: esas tres van en la cabecera (HeaderNav).
