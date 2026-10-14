#!/usr/bin/env bash
#
# Refresca en el repo todo lo que se saca de HackTheBox y, si algo ha cambiado,
# lo comitea y lo sube.
#
#   ./update_blog.sh            actualiza, comitea y hace push
#   ./update_blog.sh --check    solo comprueba que el token sirve
#   ./update_blog.sh --dry-run  actualiza pero NO comitea ni sube
#
# El token se lee de ~/.config/jimyhn/htb_token (ver dev/tools/HTB-TOKEN.md).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT" || exit 1

TOKEN_FILE="${HTB_TOKEN_FILE:-$HOME/.config/jimyhn/htb_token}"
FICHEROS=(_data/htb.yml _data/htb_machines.yml)

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
gris()  { printf '\033[90m%s\033[0m\n' "$*"; }
tit()   { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }

CHECK=0
DRY=0
for a in "$@"; do
  case "$a" in
    --check)   CHECK=1 ;;
    --dry-run) DRY=1 ;;
    -h|--help) sed -n '3,12p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) rojo "Opción desconocida: $a"; exit 2 ;;
  esac
done

# ---------------------------------------------------------------- token
if [[ ! -f "$TOKEN_FILE" ]]; then
  rojo "No existe $TOKEN_FILE"
  gris "Sigue los pasos de dev/tools/HTB-TOKEN.md para crearlo."
  exit 1
fi

HTB_TOKEN="$(tr -d ' \t\r\n' < "$TOKEN_FILE")"
if [[ -z "$HTB_TOKEN" ]]; then
  rojo "$TOKEN_FILE está vacío"
  gris "Pega dentro el App Token de HTB (pasos en dev/tools/HTB-TOKEN.md)."
  exit 1
fi
export HTB_TOKEN

# Al arrancar el ordenador la red puede tardar en estar lista: si no hay
# conexión se reintenta un rato antes de rendirse.
codigo=000
for intento in 1 2 3 4 5 6; do
  codigo="$(curl -s --max-time 20 -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $HTB_TOKEN" \
    -H 'Accept: application/json' \
    -H 'User-Agent: JimyHN-blog-htb-updater/1.0' \
    https://labs.hackthebox.com/api/v4/user/info)"
  [[ "$codigo" != "000" ]] && break
  if [[ $intento -lt 6 ]]; then
    gris "  sin conexión todavía; reintento en 30 s ($intento/5)"
    sleep 30
  fi
done

case "$codigo" in
  200) verde "Token OK" ;;
  401) rojo "Token caducado o revocado (401)."
       gris "Crea uno nuevo siguiendo dev/tools/HTB-TOKEN.md y vuelve a intentarlo."
       exit 1 ;;
  000) rojo "No hay conexión con labs.hackthebox.com"; exit 1 ;;
  *)   rojo "HTB respondió $codigo al validar el token"; exit 1 ;;
esac

[[ $CHECK -eq 1 ]] && exit 0

# ---------------------------------------------------------------- datos
tit "Perfil de HackTheBox (nivel, rango y avatar)"
if ! python3 dev/tools/htb_update.py; then
  rojo "Falló la actualización del perfil; se conservan los datos anteriores."
fi

tit "Dificultad votada de cada máquina"
if ! python3 dev/tools/htb_machines.py; then
  rojo "Falló la actualización de las máquinas; se conservan los datos anteriores."
fi

# ---------------------------------------------------------------- git
tit "Cambios"
# "updated:" cambia en cada ejecución aunque no cambie ningún dato: si lo único
# que varía es esa línea, no merece un commit.
cambios=0
for f in "${FICHEROS[@]}"; do
  [[ -f "$f" ]] || continue
  # Fichero nuevo (aún sin seguimiento): git diff no lo ve, hay que subirlo igual
  if ! git ls-files --error-unmatch -- "$f" >/dev/null 2>&1; then
    cambios=1
    gris "  $f: nuevo"
    continue
  fi
  if ! git diff --quiet -- "$f"; then
    reales="$(git diff -U0 -- "$f" | grep -E '^[+-]' | grep -Ev '^(\+\+\+|---)' | grep -Ev '^[+-]updated:' | wc -l)"
    if [[ "$reales" -gt 0 ]]; then
      cambios=1
      gris "  $f: $reales líneas"
    else
      gris "  $f: solo la marca de tiempo, se descarta"
      git checkout -- "$f"
    fi
  fi
done

if [[ $cambios -eq 0 ]]; then
  verde "Nada que subir: los datos de HTB están al día."
  exit 0
fi

if [[ $DRY -eq 1 ]]; then
  verde "--dry-run: hay cambios, pero no se comitea ni se sube."
  git --no-pager diff --stat -- "${FICHEROS[@]}"
  exit 0
fi

rama="$(git rev-parse --abbrev-ref HEAD)"
# Ojo: el commit va limitado a esos ficheros a propósito. Sin el `--`, se
# llevaría por delante cualquier otra cosa que hubiera en el índice y la
# metería en este commit con un mensaje que no le corresponde.
git add -- "${FICHEROS[@]}"
git commit -m "HTB: actualizar datos del perfil y la dificultad votada de las máquinas" \
  -- "${FICHEROS[@]}" || { rojo "El commit falló"; exit 1; }

if git push origin "$rama"; then
  verde "Subido a origin/$rama"
else
  rojo "El commit está hecho pero el push falló. Sube a mano con: git push origin $rama"
  exit 1
fi
