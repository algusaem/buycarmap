# SkipLink

El enlace «Saltar al contenido» para quien navega con el teclado: lo primero que se enfoca en cada página y lleva al contenido sin recorrer la cabecera.

- **Cuándo sale**: solo con el foco. El primer Tab de una página recién cargada lo enfoca; sin foco no se dibuja. Va en todas las páginas, con o sin sesión, también en el mapa.
- **Aspecto**: el botón secundario de 48px de [Button](../Button/README.md) («Volver al mapa»): radio de píldora, alto 48px, padding 0 20px, texto `text` a 15px peso 700 y borde 1px `line`, con relleno `surface` para tapar lo que queda debajo. Sin icono y sin sombra.
- **Foco**: el de todo control, contorno 2px `lime` separado 3px. Siempre lo lleva, porque solo se ve con el foco. Mientras el enlace tiene el foco, el logo no se dibuja (conserva su hueco, así que nada se mueve). Por eso el enlace no tiene que medir lo mismo que el logo en ningún idioma.
- **Posición**: arriba a la izquierda, flotando sobre la cabecera, sin empujar nada. Su borde izquierdo es el del Wordmark y queda centrado en vertical en la primera fila de la cabecera, tapando el Wordmark mientras tiene el foco:
  - Escritorio: a 48px del borde izquierdo y 16px del de arriba (la fila de 80px de la landing, Entrar y las legales; en el mapa, la primera fila de 48px de la banda, a 24px de arriba). En las cabeceras `surface` de las páginas, el Wordmark empieza a 32px y el enlace también.
  - Móvil: a 20px del borde izquierdo y 8px del de arriba (la cabecera de 64px).  - Por encima de todo lo demás de la página: el mapa, las hojas y la barra inferior.
- **Texto**: «Saltar al contenido» (es) y «Skip to content» (en).
- **Accesibilidad**: es un enlace (`<a href="#contenido">`) y el primer elemento enfocable del documento, antes de la cabecera. Enter lleva el foco al `main` de la página, así que el siguiente Tab enfoca el primer control después de la cabecera. Se esconde fuera de la vista sin `display: none` ni `visibility: hidden`, para que siga en el orden del teclado y los lectores de pantalla lo anuncien.
