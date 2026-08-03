Genera un resumen de lo que hice hoy para reportar a mis superiores.

## Pasos

1. Obtén el nombre del usuario de git con `git config user.name`
2. Ejecuta `git log --author="<nombre>" --since="$(TZ='Europe/Madrid' date +%Y-%m-%dT00:00:00)" --format="%h %s%n%b" --all` para obtener todos los commits de hoy (hora España)
3. Si no hay commits, informa que no se encontraron commits para hoy

## Formato de salida

Escribe un listado en **español** con viñetas, resumiendo el trabajo realizado. Agrupa por tema si hay varios commits relacionados. No incluyas hashes de commits ni detalles técnicos de git. El tono debe ser profesional pero conciso, listo para leer en una daily/standup.

Usa **participio pasado impersonal** para describir cada tarea (ej: "Creada la...", "Añadidos los...", "Implementada la..."). No uses primera persona con verbos conjugados (no "Creé", "Añadí", "Implementé").

No uses ningún carácter de viñeta (`-`, `•`, `*`, etc.). Cada línea es texto plano separado por un salto de línea.

Ejemplo de formato:

**Trabajo realizado hoy:**
Implementada la validación del formulario de login con mensajes de error traducidos
Creado el componente Sidebar con navegación colapsable y animaciones
Corregidos los estilos de los botones para usar las variables del tema

**No ejecutes ningún otro comando. Solo muestra el resumen.**
