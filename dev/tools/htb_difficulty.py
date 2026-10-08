#!/usr/bin/env python3
"""Actualiza _data/htb_difficulty.json con la gráfica "User-Rated Difficulty".

La web es estática y no puede leer HTB desde el navegador (login + CORS), así que
igual que htb_update.py esto se corre en un GitHub Action programado: consulta la
API de HTB con un App Token, lee los 10 contadores de votos de dificultad de cada
máquina del roadmap (_data/oscp.yml) y los guarda para que la tabla los pinte.

Uso:
    HTB_TOKEN=<app-token> python3 dev/tools/htb_difficulty.py

Si una máquina falla, se conserva su último dato bueno (no se borra nada).
Si la API entera falla, el fichero no se toca.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent  # dev/tools -> dev -> raíz
OSCP_YML = ROOT / "_data" / "oscp.yml"
OUT_JSON = ROOT / "_data" / "htb_difficulty.json"
API = "https://labs.hackthebox.com/api/v4"
UA = "JimyHN-blog-htb-updater/1.0"

# Orden canónico de los 10 "buckets" de dificultad de HTB (izq. a dcha. en la
# gráfica). Los 3 primeros se pintan verdes, los 4 siguientes naranjas y los 3
# últimos rojos (eso lo decide la plantilla por el índice).
BUCKETS = [
    "counterCake",
    "counterVeryEasy",
    "counterEasy",
    "counterTooEasy",
    "counterMedium",
    "counterBitHard",
    "counterHard",
    "counterTooHard",
    "counterExHard",
    "counterBrainFuck",
]


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


def machine_names():
    """Nombres de máquina de _data/oscp.yml, sin repetir y en orden de aparición."""
    text = OSCP_YML.read_text(encoding="utf-8")
    seen, names = set(), []
    for m in re.finditer(r'name:\s*"([^"]+)"', text):
        name = m.group(1)
        if name not in seen:
            seen.add(name)
            names.append(name)
    return names


def find_counters(obj):
    """Busca (recursivo) un dict que tenga los contadores de la gráfica y
    devuelve la lista de 10 votos en orden canónico, o None si no aparece."""
    if isinstance(obj, dict):
        hits = [k for k in BUCKETS if k in obj]
        if len(hits) >= 6:  # suficientes para considerarlo la gráfica
            return [int(obj.get(k) or 0) for k in BUCKETS]
        for v in obj.values():
            found = find_counters(v)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = find_counters(v)
            if found is not None:
                return found
    return None


def bars_from_votes(votes):
    """Alturas 0-100 (%) relativas al bucket más votado; un bucket con votos
    nunca baja de un mínimo visible."""
    mx = max(votes) if votes else 0
    if mx <= 0:
        return [0] * len(votes)
    return [0 if v <= 0 else max(8, round(v * 100 / mx)) for v in votes]


def fetch_machine(name, token):
    """Devuelve {'votes', 'bars', 'total'} para una máquina, o None si falla."""
    data = api_get(f"/machine/profile/{urllib.parse.quote(name)}", token)
    votes = find_counters(data)
    if votes is None:
        return None
    return {"votes": votes, "bars": bars_from_votes(votes), "total": sum(votes)}


def main():
    token = os.environ.get("HTB_TOKEN", "").strip()
    if not token:
        print("ERROR: falta HTB_TOKEN", file=sys.stderr)
        return 1

    # Partimos de lo que ya hubiera (para preservar en caso de fallo puntual).
    old = {}
    if OUT_JSON.is_file():
        try:
            old = json.loads(OUT_JSON.read_text(encoding="utf-8")).get("machines", {})
        except (ValueError, OSError):
            old = {}

    machines = {}
    ok = fail = 0
    for name in machine_names():
        try:
            res = fetch_machine(name, token)
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError) as e:
            res = None
            print(f"  aviso: {name}: {e}", file=sys.stderr)
        if res and res["total"] > 0:
            machines[name] = res
            ok += 1
        elif name in old:
            machines[name] = old[name]  # conservamos el último dato bueno
            fail += 1
        else:
            fail += 1
        time.sleep(0.4)  # cortesía con la API

    if ok == 0:
        print("ERROR: la API no devolvió ninguna gráfica; no se toca el fichero", file=sys.stderr)
        return 1

    out = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "machines": machines,
    }
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK: {ok} máquinas con gráfica, {fail} sin datos nuevos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
