#!/usr/bin/env python3
"""Descarga de HackTheBox la gráfica de "dificultad votada" de cada máquina.

Genera _data/htb_machines.yml, que luego pinta _includes/hx-htb-chart.html en:
  - la tabla del roadmap (_tabs/roadmap.html)
  - las tarjetas de /writeups (_tabs/writeups.html)
  - dentro de cada write-up (lo inserta dev/submit-writeup/writeup.py)

Qué máquinas se consultan: las del roadmap (_data/oscp.yml) más las de los
write-ups cuya plataforma sea HackTheBox (dev/submit-writeup/write-ups/*.json).

Uso:
    HTB_TOKEN=<app-token> python3 dev/tools/htb_machines.py
    python3 dev/tools/htb_machines.py --probe Active   # vuelca el JSON crudo

Si la API falla a mitad, NO se pisa el fichero: se conservan los datos viejos de
las máquinas que no se hayan podido refrescar.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "_data" / "htb_machines.yml"
OSCP = ROOT / "_data" / "oscp.yml"
SOURCES = ROOT / "dev" / "submit-writeup" / "write-ups"
API = "https://labs.hackthebox.com/api/v4"
UA = "JimyHN-blog-htb-updater/1.0"
PAUSE = float(os.environ.get("HTB_PAUSE", "1.2"))  # segundos entre llamadas (HTB limita)

# Los 10 cubos de la gráfica, en el orden en que HTB los pinta (izq -> der).
BUCKETS = [
    ("counterCake", "Cake"),
    ("counterVeryEasy", "Very Easy"),
    ("counterEasy", "Easy"),
    ("counterTooEasy", "Too Easy"),
    ("counterMedium", "Medium"),
    ("counterBitHard", "A bit hard"),
    ("counterHard", "Hard"),
    ("counterTooHard", "Too hard"),
    ("counterExHard", "Extremely hard"),
    ("counterBrainFuck", "Brainfuck"),
]

HEADER = """# Dificultad votada por los usuarios de HackTheBox, por máquina.
#
# GENERADO: lo escribe dev/tools/htb_machines.py (lo llama update_blog.sh).
# No editar a mano: se pisa en la siguiente actualización.
#
# chart = los 10 cubos de la gráfica de HTB, en orden:
#   Cake, Very Easy, Easy, Too Easy, Medium, A bit hard, Hard, Too hard,
#   Extremely hard, Brainfuck
"""


def api_get(path, token, intentos=4):
    """GET a la API. Reintenta con espera creciente si HTB nos está frenando.

    HTB limita las peticiones: con ~110 máquinas seguidas acaba devolviendo 429.
    Sin reintentos se perdían bloques enteros de máquinas, así que ante un 429 o
    un 5xx se espera (respetando Retry-After si viene) y se vuelve a probar.
    """
    req = urllib.request.Request(
        f"{API}{path}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "User-Agent": UA,
        },
    )
    espera = 5
    for n in range(1, intentos + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and n < intentos:
                pausa = espera
                ra = e.headers.get("Retry-After") if e.headers else None
                if ra:
                    try:
                        pausa = max(pausa, int(float(ra)))
                    except ValueError:
                        pass
                print(f"      HTB devolvió {e.code}; espero {pausa}s y reintento ({n}/{intentos - 1})",
                      file=sys.stderr)
                time.sleep(pausa)
                espera = min(espera * 2, 60)
                continue
            raise
        except urllib.error.URLError:
            if n < intentos:
                time.sleep(espera)
                espera = min(espera * 2, 60)
                continue
            raise
    raise RuntimeError("sin reintentos restantes")


def wanted_machines():
    """Nombres de máquinas de HTB que nos interesan: roadmap + write-ups."""
    names = {}
    if OSCP.is_file():
        for m in re.finditer(r'name:\s*"([^"]+)"', OSCP.read_text(encoding="utf-8")):
            names.setdefault(m.group(1).lower(), m.group(1))
    if SOURCES.is_dir():
        for f in sorted(SOURCES.glob("*.json")):
            try:
                d = json.loads(f.read_text(encoding="utf-8"))
            except ValueError:
                continue
            if (d.get("plat") or "").strip().lower().replace(" ", "") != "hackthebox":
                continue
            n = (d.get("name") or "").strip()
            if n:
                names.setdefault(n.lower(), n)
    return names


def machine_index(token):
    """Mapa nombre-en-minúsculas -> datos básicos (id, dificultad, estrellas, owns)."""
    index = {}
    endpoints = [
        "/machine/list/retired/paginated",
        "/machine/list/paginated",
    ]
    for ep in endpoints:
        page = 1
        while True:
            try:
                data = api_get(f"{ep}?per_page=100&page={page}", token)
            except (urllib.error.URLError, urllib.error.HTTPError, ValueError) as e:
                print(f"  aviso: {ep} página {page}: {e}", file=sys.stderr)
                break
            rows = data.get("data") or []
            if not rows:
                break
            for m in rows:
                n = (m.get("name") or "").strip()
                if n:
                    index.setdefault(n.lower(), m)
            meta = data.get("meta") or {}
            last = meta.get("last_page") or 1
            if page >= last:
                break
            page += 1
            time.sleep(PAUSE)
        time.sleep(PAUSE)
    return index


def find_chart(obj):
    """Busca recursivamente el diccionario con los contadores de la gráfica."""
    if isinstance(obj, dict):
        if any(k in obj for k, _ in BUCKETS):
            return obj
        for v in obj.values():
            hit = find_chart(v)
            if hit is not None:
                return hit
    elif isinstance(obj, list):
        for v in obj:
            hit = find_chart(v)
            if hit is not None:
                return hit
    return None


def machine_profile(token, mid):
    """info del perfil de una máquina. Devuelve (datos, motivo_del_fallo)."""
    try:
        data = api_get(f"/machine/profile/{mid}", token)
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}"
    except (urllib.error.URLError, ValueError, RuntimeError) as e:
        return None, str(e)
    return (data.get("info") or data), ""


def to_int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def yaml_str(v):
    return '"' + str(v).replace("\\", "\\\\").replace('"', '\\"') + '"'


def read_existing():
    """Datos ya guardados, para no perderlos si una llamada falla."""
    if not OUT.is_file():
        return {}
    out, cur = {}, None
    for line in OUT.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^  (\S.*?):\s*$", line)
        if m:
            cur = m.group(1).strip('"')
            out[cur] = {}
            continue
        m = re.match(r"^    (\w+):\s*(.*)$", line)
        if m and cur:
            v = m.group(2).strip()
            if len(v) > 1 and v[0] == v[-1] == '"':
                v = v[1:-1].replace('\\"', '"').replace("\\\\", "\\")
            out[cur][m.group(1)] = v
    return out


def write_yaml(machines):
    body = HEADER + f"updated: {yaml_str(time.strftime('%Y-%m-%d %H:%M'))}\nmachines:\n"
    for name in sorted(machines, key=str.lower):
        d = machines[name]
        body += f"  {yaml_str(name)}:\n"
        for k in ("id", "difficulty", "stars", "votes", "owns", "chart", "total"):
            if k in d and d[k] not in (None, ""):
                v = d[k]
                body += f"    {k}: {v if k in ('chart',) or str(v).lstrip('-').isdigit() else yaml_str(v)}\n"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(body, encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", metavar="MAQUINA",
                    help="vuelca el JSON crudo del perfil de una máquina y sale")
    args = ap.parse_args()

    token = os.environ.get("HTB_TOKEN", "").strip()
    if not token:
        print("ERROR: falta HTB_TOKEN (mira dev/tools/HTB-TOKEN.md)", file=sys.stderr)
        return 1

    print("Descargando el índice de máquinas de HTB…")
    index = machine_index(token)
    print(f"  {len(index)} máquinas en el índice")
    if not index:
        print("ERROR: el índice vino vacío, no se toca nada", file=sys.stderr)
        return 1

    if args.probe:
        m = index.get(args.probe.lower())
        if not m:
            print(f"ERROR: '{args.probe}' no está en el índice", file=sys.stderr)
            return 1
        prof, _ = machine_profile(token, m.get("id"))
        print(json.dumps(prof, indent=2, ensure_ascii=False)[:6000])
        print("\n--- gráfica detectada ---")
        print(json.dumps(find_chart(prof), indent=2, ensure_ascii=False))
        return 0

    want = wanted_machines()
    print(f"Máquinas a consultar: {len(want)}")

    machines = read_existing()
    ok = fail = miss = 0
    fallidas = []
    for i, (low, name) in enumerate(sorted(want.items(), key=lambda x: x[1].lower()), 1):
        m = index.get(low)
        if not m:
            miss += 1
            print(f"  [{i}/{len(want)}] {name}: no está en HTB (¿renombrada?)")
            continue
        prof, motivo = machine_profile(token, m.get("id"))
        chart = find_chart(prof) if prof else None
        if not chart:
            fail += 1
            fallidas.append(name)
            print(f"  [{i}/{len(want)}] {name}: sin gráfica ({motivo or 'no viene en el perfil'})"
                  f" — se conserva lo anterior")
            time.sleep(PAUSE)
            continue
        counts = [to_int(chart.get(k)) for k, _ in BUCKETS]
        machines[name] = {
            "id": to_int(m.get("id")),
            "difficulty": m.get("difficultyText") or m.get("difficulty_text") or "",
            "stars": m.get("stars") or "",
            "votes": to_int(m.get("reviews_count") or (prof or {}).get("reviews_count")),
            "owns": to_int(m.get("user_owns_count") or (prof or {}).get("user_owns_count")),
            "chart": "[" + ", ".join(str(c) for c in counts) + "]",
            "total": sum(counts),
        }
        ok += 1
        print(f"  [{i}/{len(want)}] {name}: {sum(counts)} votos")
        time.sleep(PAUSE)

    write_yaml(machines)
    print(f"\nOK -> {OUT.relative_to(ROOT)}  ({ok} actualizadas, {fail} sin datos, {miss} no encontradas)")
    if fallidas:
        print("  Sin datos esta vez: " + ", ".join(fallidas))
        print("  Vuelve a lanzarlo para reintentar solo esas (las demás ya están guardadas).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
