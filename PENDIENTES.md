# Pendientes

Cosas que quedan en tu mano tras los cambios de Hallazgos + Post-explotación +
página Vulnerabilidades. Borra cada punto según lo cierres.

## 1. Verificar el build en local (importante)
El entorno donde se hicieron los cambios no tiene Ruby/Jekyll, así que **no se ha
podido compilar el sitio**. Antes de dar por bueno el push:

```bash
bash dev/tools/test.sh      # build de producción + validación de enlaces
bash dev/tools/run.sh       # servidor local para verlo
```

Revisar a ojo en `/vulnerabilidades`:
- Los **dos modales**: botón del mapa (leyenda de tipos) y botón **CVE** (tabla con severidad coloreada).
- El **buscador de vulnerabilidades** y su botón de lista (📋) con todas las vulns agrupadas por tipo.
- Que los colores del tema Chirpy no pisen los de la página (rojo rosado, «Tipo» en amarillo oscuro).
- Que la pestaña salga **justo debajo de Write-ups** en el menú.

## 2. Revisar etiquetas de tipo discutibles (opcional)
Las vulns se clasificaron por criterio; estas son opinables. Si no te convencen,
edita el campo `vulns` del JSON y regenera con `writeup.py --edit`:
- **Shellshock** (Shocker) e **IIS WebDAV BOF** (Grandpa/Granny) → marcados `web` (van por HTTP).
- **GPP cpassword** y **Kerberoasting** (Active) → marcados `ad`.
- **«Datos borrados recuperables»** (Mirai) → marcado `config`.

## 3. Rellenar el módulo «Post-explotación» (opcional, cuando edites)
El módulo ya existe pero está **vacío** en todos los writeups (solo se pinta si
tiene contenido). Cuando quieras, mueve el enum interno / loot que hoy está en
Escalada a Post-explotación. Candidato claro: **Nexus** (el «buen rato de
enumeración como www-data»). Se hace editando el JSON y regenerando.

## Ya resuelto
- ~~Gráfica de dificultad de Nexus~~ → regenerado `_data/htb_machines.yml` (el token
  seguía válido; solo faltaban los datos de votos de la comunidad, que Nexus aún
  no tenía la última vez que se generó).
