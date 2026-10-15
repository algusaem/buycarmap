# BottomNav

En móvil, la barra de pestañas de abajo, a todo el ancho: Mapa · Guardados · Alertas · Cuenta. La pestaña actual va en `violet` con `aria-current="page"`.

- Pegada abajo, a todo el ancho: `surface` y borde superior de 1px `line`. Pestañas de 64px y, debajo, la zona segura del teléfono (34px en los diseños): 99px en total.
- Cuatro pestañas iguales, cada una un enlace: «Mapa» (icono `map` de Lucide), «Guardados» (`heart`), «Alertas» (`bell`) y «Cuenta» (un círculo de 22px con la inicial). Icono de 22px con trazo 2 y, 4px debajo, el texto a 11px: peso 800 en la actual y 600 en las demás.
- La actual: icono y texto en `violet`, texto en peso 800, con `aria-current="page"`. Las demás, en `text-muted` y peso 600. El peso marca la actual además del color, para que no dependa solo del color.
- «Cuenta» sin marcar: círculo de 22px transparente, con borde de 1,5px `text-muted` y la inicial (Unbounded 11 peso 800) en `text-muted`. Marcada: círculo relleno `violet` con la inicial en `on-violet`, y el texto en `violet`. Es la única marca de Cuenta en móvil: la cabecera ya no lleva avatar.
- Sin sesión, dos pestañas: «Mapa» y «Entrar» (icono `log-in`). Solo se ve en el mapa, porque las demás páginas piden sesión.
- Va en el mapa móvil, debajo de la hoja inferior, y en Guardados, Alertas, Cuenta y la página de una alerta. En la landing, solo con sesión: las cuatro pestañas sin ninguna marcada (ninguna en `violet` ni con `aria-current`), porque la landing no es ninguna de ellas; sin sesión, la landing no lleva barra. No va en Entrar, las pantallas de acceso ni las legales.
- En el mapa se esconde solo cuando la hoja inferior está completa y vuelve al bajarla; desplazar el mapa o la lista de la hoja no la esconde. En las páginas se esconde al desplazar hacia abajo y vuelve al desplazar hacia arriba.
- Las hojas modales (la del coche, la de confirmar, Crear alerta, Buscar) y los filtros a pantalla completa van por encima: la barra queda debajo de la pantalla oscurecida.
- En escritorio no existe: esas secciones van en la cabecera (HeaderNav).
