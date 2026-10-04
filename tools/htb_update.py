#!/usr/bin/env python3
"""Actualiza _data/htb.yml con el rango y el avatar reales de HackTheBox.

Pensado para correr en un GitHub Action programado: la web es estática y no
puede leer HTB desde el navegador (login + CORS), así que los datos se refrescan
en el build consultando la API de HTB con un App Token.

Uso:
    HTB_TOKEN=<app-token> python3 tools/htb_update.py

Variables de entorno:
    HTB_TOKEN     (obligatoria) App Token de HTB (perfil -> App Tokens).
    HTB_USER_ID   (opcional)    Id del usuario; por defecto se saca de _data/htb.yml
                                o, si no, de /api/v4/user/info.

Si la API falla, NO se toca el fichero (se conservan los últimos datos buenos).
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTB_YML = ROOT / "_data" / "htb.yml"
API = "https://labs.hackthebox.com/api/v4"
WEB = "https://www.hackthebox.com"
UA = "JimyHN-blog-htb-updater/1.0"

HEADER = """# Datos del perfil de HackTheBox para la sección "Nivel HackTheBox" del panel derecho.
#
# Este fichero lo REGENERA el workflow .github/workflows/htb-update.yml
# (tools/htb_update.py) consultando la API de HTB con un App Token.
# No hace falta editarlo a mano; si lo haces, el siguiente build lo sobrescribe.
"""


def api_get(path, token):
    req = urllib.request.Request(
        f"{API}{path}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "User-Agent": UA,
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def current_user_id():
    """Id guardado en _data/htb.yml (profile URL), si existe."""
    if HTB_YML.is_file():
        m = re.search(r"/users/(\d+)", HTB_YML.read_text(encoding="utf-8"))
        if m:
            return m.group(1)
    return None


def abs_avatar(url):
    if not url:
        return ""
    if url.startswith("http"):
        return url
    return WEB + ("" if url.startswith("/") else "/") + url


def yaml_str(value):
    """Serializa de forma segura entre comillas dobles."""
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'


def main():
    token = os.environ.get("HTB_TOKEN", "").strip()
    if not token:
        print("ERROR: falta HTB_TOKEN", file=sys.stderr)
        return 1

    uid = os.environ.get("HTB_USER_ID", "").strip() or current_user_id()
    try:
        if not uid:
            info = api_get("/user/info", token)
            uid = str(info.get("info", {}).get("id", "")).strip()
        if not uid:
            raise RuntimeError("no se pudo determinar el id de usuario")
        data = api_get(f"/user/profile/basic/{uid}", token)
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, RuntimeError) as e:
        print(f"ERROR consultando HTB: {e}", file=sys.stderr)
        return 1

    prof = data.get("profile") or {}

    # --- Diagnóstico: el "Lvl 22" NO está en profile/basic, así que sondeamos
    #     varios endpoints y los volcamos a _data/htb_debug.json para localizar
    #     el campo del nivel y la URL de la insignia (se quita al mapearlo). ---
    probes = {
        "profile_basic": f"/user/profile/basic/{uid}",
        "user_info": "/user/info",
        "dashboard": "/user/dashboard",
        "profile_content": f"/user/profile/content/{uid}",
        "season_user": "/season/user/rank",
        "profile_level": f"/user/profile/level/{uid}",
    }
    debug = {}
    for key, path in probes.items():
        try:
            debug[key] = api_get(path, token)
        except Exception as e:  # noqa: BLE001 - solo diagnóstico
            debug[key] = {"_error": str(e)}
    try:
        (ROOT / "_data" / "htb_debug.json").write_text(
            json.dumps(debug, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except OSError:
        pass
    print("===== claves sondeadas:", ", ".join(probes), "=====")

    def pick(*keys):
        for k in keys:
            v = prof.get(k)
            if v not in (None, ""):
                return v
        return ""

    rank = (str(pick("rank")) or "").strip() or "—"
    # Candidatos razonables para el "nivel"; si ninguno existe, queda vacío
    level = str(pick("level", "user_level", "account_level", "vip_level")).strip()
    avatar = abs_avatar(prof.get("avatar") or "")
    points = str(pick("points")).strip()
    ranking = str(pick("ranking", "rank_ownership")).strip()
    profile_url = f"https://app.hackthebox.com/users/{uid}"

    out = (
        HEADER
        + f"rank: {yaml_str(rank)}\n"
        + f"level: {yaml_str(level)}\n"
        + f"profile: {yaml_str(profile_url)}\n"
        + f"avatar: {yaml_str(avatar)}\n"
        + f"points: {yaml_str(points)}\n"
        + f"ranking: {yaml_str(ranking)}\n"
    )
    HTB_YML.write_text(out, encoding="utf-8")
    print(f"OK: rank={rank!r} level={level or '-'} avatar={'sí' if avatar else 'no'} points={points or '-'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
