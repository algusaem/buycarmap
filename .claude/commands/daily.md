Genera un resumen de lo que hice hoy para reportar a mis superiores.

Delegation (`CLAUDE.md` › Model delegation) — **The main session (Opus 5.5, high effort) is the mastermind, not the hands; `lacayo-sonnet` (Sonnet 5, high effort) and `lacayo-opus` (Opus 5.5, medium effort) are its hands.**
- **Steps 1 and 2 → one `Agent` with `subagent_type: "lacayo-sonnet"`** with those exact commands; the log pasted verbatim, nothing summarised.
- **The mastermind** handles step 3 and writes the summary in the format below from that log.
Close with the delegation line («Lacayos: N sonnet, M opus, K directos; reencargos: X») on its own line after the summary, apart from it, so it is never pasted with it; a run with «0 sonnet» did not follow this command.

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

**No ejecutes ningún otro comando. Solo muestra el resumen** (y, aparte, la línea de delegación).
