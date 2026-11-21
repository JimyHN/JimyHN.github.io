# Pendientes

Borra cada punto según lo cierres.

## 1. Verificar el build en local (sigue tuyo — aquí no hay Ruby/Jekyll)
```bash
bash dev/tools/test.sh      # build de producción + validación de enlaces
bash dev/tools/run.sh       # servidor local para verlo
```
Revisar a ojo:
- **Vulnerabilidades**: la barra de vulns abre el modal directamente (ya no hay botón de lista); botón **clear**; filtros por **grupo** canónico (FTP anónimo, Abuso de sudo, etc.); click en una vuln de una tarjeta → **popup con la sección Vulnerabilidad** del write-up + «Ir al Write-up»; mapa de **CVE** con filas clicables → detalle con **Descripción / Impacto / Amenaza / Solución / Explotación**.
- **Etiquetas**: igual que vulns (sin pestañas), color **lima**, barra que abre el modal de etiquetas por categoría, **clear**, All/Any. Que el **menú** mantenga sus colores.

## 2. Post-explotación en el resto de máquinas
Hecho en **Nexus**. Pendiente: Poison, Love, Netmon, Nibbles… (cuando valides).

## 3. Afinar categorías/grupos (opcional)
- Etiquetas: «Otros» (~25) se afina en `CAT_SET` de `initTags()` (hacker.js).
- Grupos de vulns: se editan en el campo `grupo` de cada JSON (y se regenera).

## Ya resuelto
- ~~Gráfica de Nexus~~, ~~etiquetas de tipo~~, ~~colores menú + botones~~, ~~Post-explotación Nexus~~.
- ~~Vulnerabilidades: selección múltiple, All/Any, mapa de CVE con detalle~~.
- ~~Página de Etiquetas~~ (reescrita dos veces: ahora al estilo vulns, sin pestañas).
- ~~Grupos canónicos de vulns~~ (FTP anónimo, Abuso de sudo, Reutilización de credenciales, etc.).
- ~~CVE: descripción/impacto más completos + Amenaza~~.
- ~~Vulns: botón clear, lista al pinchar la barra, popup de la sección Vulnerabilidad~~.
