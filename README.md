# ⚽ Rogue Manager — Football Roguelike

Prototipo web jugable de un juego de gestión de fútbol **roguelike**: mezcla de *Football Manager* y *Balatro*. Todo el contenido (equipos, jugadores, cartas, tácticas rivales) se genera proceduralmente. En español.

## Cómo jugar

Abre `index.html` en un navegador (o sirve la carpeta con `python3 -m http.server` y visita `http://localhost:8000`). No hay build ni dependencias: Phaser 3 se carga desde CDN, con copia local en `lib/` como fallback offline. En móvil la interfaz cambia sola a un modo táctil tipo app (forzable con `?mobile=1`).

## El juego

- **Una run = una temporada** de 14 jornadas en una liga de 8 equipos ficticios.
- **Victoria:** ser campeón de liga. **Derrota:** 3 derrotas seguidas o no ser campeón al final.
- **Partidos jefe** en las jornadas 5, 10 y 14: rival potenciado y botín de rareza alta garantizado.

### Sistemas

| Sistema | Detalle |
|---|---|
| Atributos | 33 atributos estilo FM en escala 1-20, en 4 grupos (Técnica, Mental, Físico y Portería), generados por perfil de posición y rareza. Ficha completa por jugador con código de color |
| Cartas de jugador | Posición, rareza (Común/Rara/Épica/Legendaria), edad, tag de sinergia, 0-2 habilidades pasivas (Clutch, Muro, Killer, Motor, Capitán, Velocista, Cerrojo, Francotirador, Fajador, Estrella) y estadísticas de temporada |
| Formaciones | 7 formaciones (4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 3-4-3, 5-3-2, 4-1-4-1) con roles por slot (carrilero, pivote, mediapunta, extremo…). La **cohesión** con cada formación crece jugándola |
| Instrucciones | Mentalidad, presión, estilo de pase y amplitud. Cambio de mentalidad/presión en el descanso (pizarra) |
| Choque táctico | Cada rival IA tiene su propia plantilla de 11 jugadores, formación y plan de partido. El informe del ojeador analiza el enfrentamiento (superioridades por zona, presión, espacios) para que lo contrarrestes |
| Motor de partido | Simulación espacial continua en un campo de 105×68: 22 agentes con anclas de formación que basculan con el balón, pases planificados con error e intercepciones por atributos, regates, entradas, faltas, tarjetas (con expulsiones y sanciones), penaltis, córners, saques de banda/puerta, centros disputados de cabeza, paradas con rechace, fatiga en vivo y ratings por jugador. El mismo motor corre el modo visual, el skip y los partidos IA vs IA |
| Partido visible | Phaser dibuja el estado del motor: campo con bandas de siega, balón con vuelo/sombra/estela, anillo de portador, tarjetas animadas, celebraciones, HUD con posesión/tiros/córners en vivo y x1/x2/x4/saltar |
| Condición y forma | Jugar cansa según Resistencia; la condición baja se traduce en peor rendimiento y más lesiones. La forma sigue a las notas del jugador; la moral, a los resultados |
| Sinergias | 4 tags con umbrales que dan bonos de atributo al equipo — el "multiplicador Balatro" |
| Staff | 8 cartas (Ojeador, Preparador, Agente, Mecenas, Táctico, Motivador, Cazatalentos, Economista), máx. 3 |
| Economía | Oro por victorias/objetivos/ventas (incluye bonus por actuación estelar), salarios por jornada, tienda con reroll y negociación con IA (paciencia y precio de reserva ocultos) |
| Post-partido | Estadísticas completas (posesión, tiros, xG, pases, faltas, tarjetas, córners), notas del once con MVP, goleadores con asistencias y drop de cartas a elegir |
| Liga | Clasificación, calendario con la formación de cada rival y pichichi. El resto de la jornada se juega con el motor real |
| Sprites | Retratos pixel-art procedurales y deterministas por jugador (canvas, sin assets externos) |
| UI móvil | Barra de navegación inferior tipo app, banquillo deslizable, modales bottom-sheet, controles táctiles |
| Meta | Récord de runs/títulos en localStorage |

### Estructura

```
index.html         Pantallas y layout (+ detector de móvil)
css/style.css      UI dark estilo Balatro (tweens, glow por rareza, flip 3D)
css/mobile.css     Capa móvil: barra inferior, bottom-sheets, targets táctiles
js/attrs.js        33 atributos estilo FM: perfiles, medias, resúmenes
js/formations.js   Formaciones con slots/roles, tácticas y análisis de choque
js/sprite.js       Retratos pixel-art procedurales (canvas)
js/gen.js          Generación procedural (cartas, plantillas IA, liga, staff)
js/synergy.js      Sinergias/habilidades/forma/moral → atributos efectivos
js/engine.js       Motor de partido continuo (espacial, headless o visual)
js/state.js        Estado de run, táctica, cohesión, alineación, meta
js/league.js       Clasificación, jornadas IA vs IA, pichichi, fin de run
js/economy.js      Tienda, salarios, recompensas, lesiones, condición
js/nego.js         IA de negociación
js/ui.js           Render DOM: gestión, táctica, ficha, post-partido, liga
js/match.js        Render Phaser del partido + HUD + pizarra del descanso
js/mobile.js       Reestructura la UI para táctil (nav inferior, steppers)
js/main.js         Flujo de la run
js/audio.js        Sonido sintetizado con WebAudio (sin assets)
```

El motor es independiente del render: `Engine.MatchEngine.step(dt)` avanza la simulación tanto para el partido visible como para el skip y los resultados instantáneos del resto de la jornada.
