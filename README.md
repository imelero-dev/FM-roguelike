# ⚽ Rogue Manager — Football Roguelike

Prototipo web jugable de un juego de gestión de fútbol **roguelike**: mezcla de *Football Manager* y *Balatro*. Todo el contenido (equipos, jugadores, cartas) se genera proceduralmente. En español.

## Cómo jugar

Abre `index.html` en un navegador (o sirve la carpeta con `python3 -m http.server` y visita `http://localhost:8000`). No hay build ni dependencias: Phaser 3 se carga desde CDN, con copia local en `lib/` como fallback offline.

## El juego

- **Una run = una temporada** de 14 jornadas en una liga de 8 equipos ficticios.
- **Victoria:** ser campeón de liga. **Derrota:** 3 derrotas seguidas o no ser campeón al final.
- **Partidos jefe** en las jornadas 5, 10 y 14: rival potenciado y botín de rareza alta garantizado.

### Sistemas

| Sistema | Detalle |
|---|---|
| Cartas de jugador | Posición (POR/DEF/MED/DEL), rareza (Común/Rara/Épica/Legendaria), 4 stats (1-99) y 0-2 habilidades pasivas (Clutch, Muro, Killer, Motor, Capitán, Velocista, Cerrojo, Francotirador, Fajador, Estrella) |
| Sinergias | 4 tags (Cantera, Galáctico, Físico, Técnico) con bonos de equipo por umbral de cartas alineadas — el "multiplicador Balatro" |
| Staff | 3 slots, 8 cartas distintas con efectos globales de run (Ojeador, Preparador, Agente, Mecenas, Táctico, Motivador, Cazatalentos, Economista) |
| Economía | Oro por victorias/objetivos/ventas; salarios que drenan cada jornada; tienda con reroll pagando |
| Negociación | Minijuego de oferta/contraoferta contra una IA con paciencia y precio de reserva ocultos (compra y venta) |
| Partido | Simulación tick-based en Phaser (~65 s a x1, controles x1/x2/x4 y skip), con eventos, partículas, shake y activación visible de habilidades |
| Meta | Récord de runs/títulos en localStorage |

### Estructura

```
index.html         Pantallas y layout
css/style.css      UI dark estilo Balatro (tweens, glow por rareza, flip 3D)
js/gen.js          Generación procedural (nombres, equipos, cartas, staff, drops)
js/synergy.js      Sinergias por tag + stats efectivos (habilidades/staff)
js/engine.js       Motor de partido tick-based, independiente del render
js/state.js        Estado de run, alineación, calendario, meta-progresión
js/league.js       Clasificación, cierre de jornada, condiciones de fin
js/economy.js      Tienda, salarios, recompensas, lesiones
js/nego.js         IA de negociación
js/ui.js           Render DOM de todas las pantallas
js/match.js        Escena Phaser + HUD del partido
js/main.js         Flujo de la run
js/audio.js        Sonido sintetizado con WebAudio (sin assets)
```

El motor de simulación es determinista respecto a su estado interno y se puede ejecutar headless (se usa para el skip y para los resultados instantáneos del resto de la jornada).
