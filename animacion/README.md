# animacion/ — recorrido animado del blog

Herramienta de desarrollo (no forma parte del sitio; está excluida del build).
Abre el navegador con un "vídeo" determinista que recorre el blog: intro ciber
(tipo TV encendiéndose), scroll por **Inicio → Write-ups → Herramientas →
Roadmap**, y outro ciber a negro.

## Uso

```bash
python3 animacion/animacion.py
```

Levanta un proxy local del blog publicado (`https://jimyhn.github.io`) para que
los iframes sean del **mismo origen** y se les pueda controlar el scroll, y abre
el navegador (Chrome/Chromium a pantalla completa si lo encuentra; si no, el
navegador por defecto). Necesita conexión a internet.

Para usar tu **Jekyll local** en vez del sitio en vivo (arráncalo antes con
`bash dev/tools/run.sh`):

```bash
BLOG_URL="http://127.0.0.1:4000" python3 animacion/animacion.py
```

## Controles

- **Play / Pausa** y **barra de tiempo** abajo (clic o arrastre para ir a un punto).
- **Espacio**: play/pausa.
- **← / →**: saltar ±5 s. Aparece 0,2 s un círculo verde con la flecha y los
  segundos; si repites, se acumulan (5s, 10s, 15s…).
- **Bucle** (icono de flechas en círculo): si está activo (morado claro) el
  recorrido se repite al terminar; apagado (morado oscuro) se para al final.
- Al cargar siempre empieza en el segundo 0 y en pausa, esperando play.

## Ajustes

En `player.js`, arriba: `PAGES` (páginas y orden del recorrido) y `DUR`
(duración de intro, scroll por página, transición y outro).

## Ficheros

- `animacion.py` — proxy + servidor local + lanzador del navegador.
- `player.html` / `player.css` / `player.js` — el reproductor determinista.
