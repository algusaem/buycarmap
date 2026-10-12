# HeaderNav

La cabecera de cada pantalla: el Wordmark a la izquierda y la navegación a la derecha.

- **Escritorio**: 80px de alto, padding lateral 32px y divisor inferior `line-soft`.
- **Mapa**: en medio el SearchPill compacto; a la derecha, con 10px de hueco, «Crear alerta» (fantasma, 15px peso 700, padding 10px 16px), Favoritos (botón de icono de 42px con el corazón) y el avatar.
- **Páginas** (Guardados, Alertas, Cuenta): Mapa · Guardados · Alertas como enlaces de 15px peso 700, padding 10px 16px y 6px de hueco; la sección actual va invertida, relleno `text` con texto `bg` y `aria-current="page"`. Detrás, a 8px más, el avatar.
- **Avatar**: 42px redondo en `violet` con la inicial en Unbounded 15 peso 800 en `on-violet`; enlaza a Cuenta. En Cuenta no hay enlace invertido: lo marca el aro `shadow-current` del avatar, con `aria-current="page"`.
- **Landing, Entrar y páginas de acceso**: padding lateral 48px, sin divisor. En la landing, «Entrar» (fantasma) y «Crear cuenta» (principal pequeño, 11px 20px a 15px); en Entrar, el registro y las legales, solo «Volver al mapa» (fantasma).
- **Móvil**: 64px de alto, padding lateral 20px, Wordmark de 16px y el avatar de 36px (inicial a 13px; aro `shadow-current-sm` en Cuenta). Con divisor `line-soft` en Guardados, Alertas y Cuenta; sin él en la landing y Entrar, donde a la derecha va un enlace de texto de 14px peso 700 («Entrar», «Mapa», «Volver»).
- Los enlaces pasan a `lime` al pasar el ratón.
