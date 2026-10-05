# Chirpy Starter

[![Gem Version](https://img.shields.io/gem/v/jekyll-theme-chirpy)][gem]&nbsp;
[![GitHub license](https://img.shields.io/github/license/cotes2020/chirpy-starter.svg?color=blue)][mit]

A minimal, ready-to-use template for creating a blog with the [**Chirpy**][chirpy] Jekyll theme. Get up and running in minutes with all critical files pre-configured.

## Why This Starter Exists

When installing Chirpy through [RubyGems.org][gem], Jekyll can only read a subset of theme files (`_data`, `_layouts`, `_includes`, `_sass`, `assets`) and limited `_config.yml` options from the gem. As a result, users cannot enjoy the full out-of-the-box experience that Chirpy offers.

To unlock all features, the following files must be present in your Jekyll site:

```shell
.
├── _config.yml
├── _plugins
├── _tabs
└── index.html
```

This starter bundles those files from the latest **Chirpy** release along with a [CD][CD] workflow, so you can start writing immediately.

## Usage

Check out the [theme's docs](https://github.com/cotes2020/jekyll-theme-chirpy/wiki).

## Contributing

This repository is automatically updated with new releases from the theme repository. If you encounter any issues or want to contribute to its improvement, please visit the [theme repository][chirpy] to provide feedback.

## License

This work is published under [MIT][mit] License.

[gem]: https://rubygems.org/gems/jekyll-theme-chirpy
[chirpy]: https://github.com/cotes2020/jekyll-theme-chirpy/
[CD]: https://en.wikipedia.org/wiki/Continuous_deployment
[mit]: https://github.com/cotes2020/chirpy-starter/blob/master/LICENSE

## Estructura del proyecto (JimyHN.github.io)

Blog de writeups CTF/HackTheBox (tema Chirpy, en español). Carpetas propias:

- `_posts/` — writeups publicados. **Generados**, no se editan a mano.
- `_tabs/` — pestañas del menú (writeups, maquinas, herramientas, titulos, roadmap, about…).
- `_data/*.yml` — contenido de tablas/pestañas (titulos, certificaciones, herramientas, oscp, htb, destacadas…).
- `_includes/`, `_layouts/` — plantillas propias (prefijo `hx-`).
- `assets/` — `css/hacker.css`, `js/hacker.js`, `img/machines/`, `img/writeups/`, `docs/`…
- `dev/` — utilidades de desarrollo (**excluida del build**):
  - `dev/submit-writeup/` — generador de writeups (`writeup.py` + `editor.html`) y herramientas (`herramientas.py`). Fuente en `write-ups/*.json`.
  - `dev/tools/` — `run.sh` (servidor local), `test.sh` (build + htmlproofer), `htb_update.py` (Action diario), `ascii.py`.
- `animacion/` — herramienta Python aparte: abre el navegador con un recorrido animado del blog (**excluida del build**).

### Desarrollo

```bash
bundle install            # solo la primera vez
bash dev/tools/run.sh     # servidor local http://127.0.0.1:4000
bash dev/tools/test.sh    # build de producción + validación de enlaces

# Writeups (no editar el HTML a mano):
python3 dev/submit-writeup/writeup.py --add | --edit /writeups/<slug> | --remove /writeups/<slug>
```
