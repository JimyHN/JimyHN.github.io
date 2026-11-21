# Pendientes

Estado de la feature de Vulnerabilidades + Post-explotación. Borra cada punto según lo cierres.

## 1. Verificar el build en local (importante, sigue tuyo)
El entorno de los cambios no tiene Ruby/Jekyll, así que **no se ha compilado el sitio**.

```bash
bash dev/tools/test.sh      # build de producción + validación de enlaces
bash dev/tools/run.sh       # servidor local para verlo
```

Revisar a ojo:
- `/vulnerabilidades`: filtros, buscadores, botón-lista (📋), leyenda (🗺) y tabla CVE funcionando.
- **Colores del menú**: que TODAS las pestañas tengan su color correcto (se reasignaron por `nth-child`).
- Título de Vulnerabilidades en **rojo rosado**, nombres de vuln en **rojo fuerte**, «Tipo» en **amarillo oscuro**.
- **Nexus**: que se vean las secciones Explotación → Post-explotación → Movimiento lateral → Escalada.

## 2. Post-explotación en el resto de máquinas (siguiente paso)
Ya hecho en **Nexus** (modelo a seguir). Cuando valides cómo quedó, repasamos el
resto de writeups y movemos a Post-explotación / Movimiento lateral lo que hoy
esté metido en Explotación o Escalada. Candidatas probables: las de cadena larga
(Poison, Love, Netmon, Nibbles…).

## Ya resuelto
- ~~Gráfica de dificultad de Nexus~~ → regenerado `_data/htb_machines.yml`.
- ~~Revisar etiquetas de tipo~~ → revisadas; taxonomía consistente. Única opinable:
  BOF de IIS WebDAV (Grandpa/Granny) en `web` (por ser HTTP); se puede pasar a `servicio` si se prefiere.
- ~~Color naranja de la pestaña + botones muertos~~ → eran la paleta del menú por
  `nth-child` descolocada y el JS/CSS inline que no corría; movido a `hacker.js`/`hacker.css`.
- ~~Post-explotación en Nexus~~ → Explotación / Post-explotación / Movimiento lateral separados.
