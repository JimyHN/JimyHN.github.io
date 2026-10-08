# animacion/ — recorrido animado del blog

Herramienta de desarrollo (no forma parte del sitio; está excluida del build).
Abre el navegador con un "vídeo" determinista que recorre el blog con fundidos a
negro entre páginas:

Las transiciones **solapan el movimiento**: cada página ya se mueve cuando se
quita el fundido de entrada, y el fundido de salida empieza antes de que termine
su movimiento (sigue moviéndose tapada por el negro).

1. Fundido **de negro al Inicio**, que hace zoom-out (empieza a la vez que el
   fundido); antes de acabar el zoom ya empieza a fundir a negro.
2. **Write-ups**: scroll hacia abajo por las máquinas (rápido).
3. **Writeup de Dolibarr**: arranca en la sección Enumeración y baja despacio, lo justo para leerla.
4. **Roadmap**: scroll hacia abajo; al pasar las "easy" empieza el fundido y
   sigue bajando tapado por el negro.
5. **Inicio** otra vez (zoom-out) y a negro.

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

### Windows

Doble clic en **`Recorrido animado.bat`** (necesita Python 3 instalado desde
python.org con la opción *Add to PATH*, y conexión a internet). Abre el
navegador por defecto; deja la ventana negra abierta mientras ves la animación
y ciérrala para apagar el servidor. Para crear un acceso directo en el
escritorio: clic derecho sobre el `.bat` → *Enviar a* → *Escritorio (crear
acceso directo)*.

## Controles

- **Play / Pausa** y **barra de tiempo** abajo (clic o arrastre para ir a un punto).
- **Espacio**: play/pausa.
- **← / →**: saltar ±5 s. Aparece 0,2 s un círculo verde con la flecha y los
  segundos; si repites, se acumulan (5s, 10s, 15s…).
- **Bucle** (icono de flechas en círculo): si está activo (morado claro) el
  recorrido se repite al terminar; apagado (morado oscuro) se para al final.
- Al cargar siempre empieza en el segundo 0 y en pausa, esperando play.

## Ajustes

En `player.js`, arriba: `PAGES` (páginas), `HIDE_CHROME` (cuáles se muestran sin
columnas laterales), `PLAN` (orden, tipo de movimiento y duración de cada tramo y
transición) e `INTRO`/`OUTRO` (fundidos de entrada y salida).

## Ficheros

- `animacion.py` — proxy + servidor local + lanzador del navegador.
- `player.html` / `player.css` / `player.js` — el reproductor determinista.
