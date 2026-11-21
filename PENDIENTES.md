# Pendientes

Borra cada punto según lo cierres.

## 1. Verificar el build en local (sigue tuyo — aquí no hay Ruby/Jekyll)
```bash
bash dev/tools/test.sh      # build de producción + validación de enlaces
bash dev/tools/run.sh       # servidor local para verlo
```
Revisar a ojo:
- **Vulnerabilidades**: modal de selección (checks en dos columnas, Aplicar), toggle **All/Any** + minileyenda, «Varias vulns (N)», bloqueo de fondo al abrir modales, y el **mapa de CVE** (filas con hover y clic → detalle con descripción/impacto/solución/explotación).
- **Etiquetas**: color **lima**, dos pestañas (Etiquetas / Máquinas), buscador con chips + autocompletado, All/Any, rejilla por categorías en dos columnas. Que el **menú entero** siga con sus colores correctos.

## 2. Post-explotación en el resto de máquinas
Hecho en **Nexus**. Cuando valides el resto, repasamos máquina a máquina qué mover
de Explotación/Escalada a Post-explotación / Movimiento lateral (candidatas de
cadena larga: Poison, Love, Netmon, Nibbles).

## 3. Afinar categorías de etiquetas (opcional)
«Otros» tiene ~25 etiquetas (servicios como smb/ftp/ssh, AD, config, misc). Si
quieres bajarlo, se edita el mapa `CAT_SET` de `initTags()` en `assets/js/hacker.js`.

## Ya resuelto
- ~~Gráfica de dificultad de Nexus~~ (regenerado el yml).
- ~~Etiquetas de tipo de vulns~~ (revisadas, consistentes).
- ~~Colores del menú + botones muertos de Vulnerabilidades~~ (paleta nth-child + JS/CSS a los globales).
- ~~Post-explotación en Nexus~~.
- ~~Vulnerabilidades: selección múltiple, All/Any, mapa de CVE con detalle~~.
- ~~Página de Etiquetas reescrita~~.
