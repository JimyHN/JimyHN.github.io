# Token de HackTheBox

Los datos que el blog saca de HackTheBox (tu nivel, tu avatar y la gráfica de
"dificultad votada" de cada máquina) se piden a la API de HTB, y esa API exige
un **App Token** personal. Sin él, `update_blog.sh` no hace nada.

## Dónde vive el token

```
~/.config/jimyhn/htb_token
```

Un fichero de una sola línea con el token y nada más. Está **fuera del repo** a
propósito: así no hay forma de comitearlo por accidente.

## Cómo sacarlo (una vez)

1. Abre <https://app.hackthebox.com/profile/settings> con tu cuenta iniciada.
   (También se llega pulsando tu avatar arriba a la derecha → **Profile Settings**.)
2. Busca la sección **App Tokens**.
3. Pulsa **Create App Token**.
4. Ponle un nombre que reconozcas, por ejemplo `blog-jimyhn`.
5. Elige la caducidad entre las opciones que te dé HTB. Apunta la fecha en algún
   sitio: cuando caduque, el script empezará a responder 401.
6. Pulsa **Create**. **El token se enseña una sola vez**: cópialo ya, porque al
   cerrar el aviso no hay forma de volver a verlo (habría que crear otro).

## Cómo ponerlo

```bash
mkdir -p ~/.config/jimyhn
printf '%s' 'PEGA_AQUI_EL_TOKEN' > ~/.config/jimyhn/htb_token
chmod 600 ~/.config/jimyhn/htb_token
```

El `printf` (en vez de `echo`) es para que no se cuele un salto de línea al
final. El `chmod 600` deja el fichero legible solo por ti.

Comprueba que ha quedado bien:

```bash
bash update_blog.sh --check
```

Si responde `Token OK`, ya está.

## Cuándo hay que renovarlo

Cuando `update_blog.sh` falle con **401 Unauthorized**, el token ha caducado o
lo has revocado. Repite los pasos de arriba y sobrescribe el fichero: no hay que
tocar nada más.

## El mismo token en GitHub Actions

El workflow `.github/workflows/actualizar-htb.yml` usa el secreto `HTB_TOKEN` del
repositorio, que es independiente del fichero local. Si renuevas el token,
actualiza también:

**Settings → Secrets and variables → Actions → `HTB_TOKEN` → Update**

## Qué NO hacer

- No metas el token en `_data/`, en `_config.yml` ni en ningún fichero del repo:
  GitHub Pages publica todo lo que haya ahí y el token quedaría a la vista.
- No lo pegues en un issue, en un commit ni en una captura.
- Si crees que se te ha escapado, revócalo en **App Tokens** y crea otro.
