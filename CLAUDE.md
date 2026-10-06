# CLAUDE.md

Blog Jekyll (tema Chirpy) de writeups de CTF/HackTheBox, en español. Se publica en GitHub Pages.

## Arrancar

```bash
bundle install        # solo la primera vez
bash dev/tools/run.sh     # servidor local con live-reload en http://127.0.0.1:4000
```

Build de producción + validación de enlaces: `bash dev/tools/test.sh`.

## Convenciones que rompen algo si no se siguen

- **Los writeups NO se editan a mano.** Cada post `_posts/AAAA-MM-DD-<slug>.html` lo **genera** `dev/submit-writeup/writeup.py` a partir de `dev/submit-writeup/write-ups/<slug>.json` (esa es la fuente de verdad). Si editas el `.html` directamente, se pierde al regenerar. Para crear/editar/borrar usa el script:
  `python3 dev/submit-writeup/writeup.py --add | --edit /writeups/<slug> | --remove /writeups/<slug>`
- **Las herramientas NO son posts:** viven en `_data/herramientas.yml` y se gestionan con `python3 dev/submit-writeup/herramientas.py`.
- **El nombre del fichero del post fija la fecha:** `AAAA-MM-DD-<slug>.html`. Si el formato no es ese, Jekyll no lo publica.
- **La categoría es lo que lista cada pestaña.** Un writeup necesita `categories: ["Writeups", ...]` o no sale en /writeups; una herramienta-post necesita `"Herramientas"` en `categories`.
- **Front matter obligatorio** entre `---` al inicio de cada post y pestaña. Los colores (`accent`, `--c`) son tripletes RGB con espacios (`"193 108 255"`), nunca hex.

## Estructura

- `_posts/` — writeups publicados (HTML **generado**, no tocar a mano).
- `dev/` — utilidades de desarrollo (no forma parte del sitio; excluida en `_config.yml`):
  - `dev/submit-writeup/` — generadores: `writeup.py`, `herramientas.py`, sus editores HTML y `write-ups/*.json` (fuente de cada writeup).
  - `dev/tools/` — scripts: `run.sh` (servidor local), `test.sh` (build + enlaces), `htb_update.py` (lo llama el Action), `ascii.py`.
- `animacion/` — herramienta aparte (Python) que abre el navegador con un recorrido animado del blog (excluida del build).
- `_tabs/` — pestañas del menú (writeups, maquinas, herramientas, titulos, certificaciones, roadmap, about…). Filtran posts por categoría o leen `_data/`.
- `_data/*.yml` — contenido de tablas y pestañas (titulos, certificaciones, herramientas, oscp, contact…).
- `_includes/`, `_layouts/` — plantillas propias (lo custom lleva prefijo `hx-`).
- `assets/img/machines/` — imágenes y banners de cada máquina.
- `_config.yml` — config de Jekyll (lang `es-ES`, zona `Europe/Madrid`).

## Reglas que aplican casi siempre

- Contenido y mensajes de commit en **español**, como el histórico.
- No comitear generado ni dependencias: `_site/`, `.jekyll-cache/`, `__pycache__/`, `vendor/`, `node_modules/` ya están en `.gitignore`.
- No leer enteros los ficheros grandes (`dev/submit-writeup/editor.html`, posts largos): ir directo a la parte que haga falta.
