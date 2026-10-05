#!/usr/bin/env python3
"""Actualiza _data/htb.yml con el rango y el avatar reales de HackTheBox.

Pensado para correr en un GitHub Action programado: la web es estática y no
puede leer HTB desde el navegador (login + CORS), así que los datos se refrescan
en el build consultando la API de HTB con un App Token.

Uso:
    HTB_TOKEN=<app-token> python3 dev/tools/htb_update.py

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

ROOT = Path(__file__).resolve().parent.parent.parent  # dev/tools -> dev -> raíz del repo
HTB_YML = ROOT / "_data" / "htb.yml"
API = "https://labs.hackthebox.com/api/v4"
WEB = "https://www.hackthebox.com"
UA = "JimyHN-blog-htb-updater/1.0"

HEADER = """# Datos del perfil de HackTheBox para la sección "Nivel HackTheBox" del panel derecho.
#
# "rank", "avatar", "points" y "ranking" los actualiza solo el workflow diario
# (.github/workflows/htb-update.yml). "level" y "badge" se ponen a mano aquí
# y el workflow los RESPETA (no los pisa) mientras no encuentre el campo en la API.
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


def existing_value(key):
    """Valor actual de una clave en _data/htb.yml (para preservar lo puesto a mano)."""
    if HTB_YML.is_file():
        m = re.search(rf'^{key}:\s*"?(.*?)"?\s*$', HTB_YML.read_text(encoding="utf-8"), re.M)
        if m:
            return m.group(1)
    return ""


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

    def pick(*keys):
        for k in keys:
            v = prof.get(k)
            if v not in (None, ""):
                return v
        return ""

    rank = (str(pick("rank")) or "").strip() or "—"
    # "level" y "badge" se mantienen a mano: solo se sobrescriben si la API los trae
    level = str(pick("level", "user_level", "account_level", "vip_level")).strip() or existing_value("level")
    badge = abs_avatar(str(pick("badge", "badge_url", "level_badge")).strip()) or existing_value("badge")
    avatar = abs_avatar(prof.get("avatar") or "")
    points = str(pick("points")).strip()
    ranking = str(pick("ranking", "rank_ownership")).strip()
    profile_url = f"https://app.hackthebox.com/users/{uid}"

    out = (
        HEADER
        + f"rank: {yaml_str(rank)}\n"
        + f"level: {yaml_str(level)}\n"
        + f"badge: {yaml_str(badge)}\n"
        + f"profile: {yaml_str(profile_url)}\n"
        + f"avatar: {yaml_str(avatar)}\n"
        + f"points: {yaml_str(points)}\n"
        + f"ranking: {yaml_str(ranking)}\n"
    )
    HTB_YML.write_text(out, encoding="utf-8")
    print(f"OK: rank={rank!r} level={level or '-'} badge={'sí' if badge else 'no'} avatar={'sí' if avatar else 'no'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
