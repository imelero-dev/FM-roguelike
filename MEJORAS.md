# MEJORAS — revisión para demo publicable

## Cambios realizados

### Bugs corregidos
- **Las expulsiones y las lesiones de 1 jornada no se cumplían nunca** (`js/main.js`). La baja se ponía al acabar el partido y se descontaba antes del siguiente, así que el jugador volvía a estar disponible. Ahora las bajas anteriores se descuentan *antes* de aplicar las nuevas: una roja o una lesión de N jornadas hace perder N partidos. Además, el expulsado sale del once, igual que ya pasaba con los lesionados.
- **Se podía jugar con un sancionado o lesionado en el once** (`js/state.js`). `onceCompleto()` solo comprobaba que la carta existiera; ahora exige que esté disponible.
- **Aceptar una contraoferta sin oro suficiente rompía la negociación** (`js/ui.js`). La sesión se cerraba y la siguiente oferta acababa en «no hay trato». Ahora avisa del oro disponible y deja seguir negociando.
- **Mensaje de once incompleto poco útil** (`js/main.js`). Si a la formación actual le faltan efectivos (por bajas o ventas), el aviso indica que hay que cambiar de formación en Táctica o fichar.

### Consola / carga
- **Phaser se carga desde `lib/`** en lugar del CDN de jsDelivr con `document.write` como alternativa (`index.html`). Con este cambio el juego funciona abriendo `index.html` por `file://`, sin conexión y sin depender de terceros.
- **El hover ya no crea el AudioContext** (`js/audio.js`). Antes, al pasar el ratón por una carta antes de cualquier clic, Chrome avisaba de que el AudioContext estaba bloqueado.
- **Audio interno de Phaser desactivado** (`audio: { noAudio: true }` en `js/match.js`). El juego suena con `AudioFX`, así que Phaser ya no crea un segundo AudioContext.

### Pruebas añadidas (sin dependencias)
- `node tests/smoke.js [n]`: carga los módulos reales con un DOM simulado y juega `n` temporadas completas pulsando botones al azar (fichar, vender, formación, táctica, reroll, drops). Comprueba que no haya excepciones, que no se alinee a nadie no disponible, que las bajas se cumplan, que el oro no sea negativo, que no se supere el máximo de plantilla, que la jornada avance y que todos los equipos jueguen los mismos partidos. Resultado: 100 temporadas sin fallos.
- `node --experimental-websocket tests/browser-check.js [chrome] [?query]`: abre `index.html` por `file://` en Chrome headless, juega dos partidos (uno visible con descanso y pizarra, otro saltado) y lista los errores y avisos de consola. Resultado: 0 errores y 0 avisos, tanto en escritorio como con `?mobile=1`. Los únicos avisos que aparecen son de WebGL por software, propios del entorno headless.

### Privacidad
- En los archivos del proyecto no hay claves, tokens, emails ni datos personales, y no se hacen peticiones externas: el favicon es un SVG inline y los sprites y el sonido se generan en el propio juego. Solo se usa `localStorage` (`rm_meta`) para el récord de runs.
- **Ojo:** el **historial de git** sí contiene un email personal como autor de commits. No lo he tocado (reescribir el historial es irreversible). Si se va a publicar el repositorio y no solo los archivos, conviene revisarlo.

## Pendiente para considerarlo terminado
1. **Equilibrio de dificultad.** Con decisiones aleatorias, el test gana ~1 título de cada 100 temporadas. Falta jugarlo de verdad y ajustar el ritmo de oro, las rarezas y el crecimiento de los rivales (`League.cerrarJornada`).
2. **Bloqueo extremo sin solución.** Si las bajas y las ventas dejan la plantilla sin efectivos para *ninguna* formación (p. ej. sin porteros disponibles) y no hay oro para fichar, no se puede jugar. La venta solo protege la formación actual y las rojas no tienen salvaguarda. En el test no ha ocurrido, pero es posible.
3. **No se guarda la run en curso.** Al recargar la página se pierde la temporada; solo se conserva el récord en `localStorage`.
4. **Marca y nombre.** El juego cita «Football Manager» en README/comentarios y usa el término «Pichichi». Hay que revisarlo antes de publicar (no se ha tocado, según lo indicado).
5. **Licencias.** Falta un archivo LICENSE propio y el aviso de la licencia MIT de Phaser incluido en `lib/`.
6. **Accesibilidad y teclado.** La UI depende del ratón/táctil: no hay foco visible en las cartas, `Esc` no cierra los modales y no hay textos alternativos más allá de los emojis.
7. **Pruebas en navegadores reales.** Solo se ha probado en Chrome headless; falta probarlo en Safari/iOS y Firefox, sobre todo la capa móvil y el desbloqueo de WebAudio en iOS.
