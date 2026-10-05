#!/usr/bin/env python3
"""Editor y publicador de herramientas del blog (análogo a writeup.py).

Las herramientas no son posts: viven en _data/herramientas.yml. Este editor
permite añadir/editar/borrar entradas con vista previa y publicarlas (git).

  python3 dev/submit-writeup/herramientas.py --add [Nombre]
  python3 dev/submit-writeup/herramientas.py --edit <nombre>
  python3 dev/submit-writeup/herramientas.py --remove <nombre>
"""
import argparse
import json
import re
import subprocess
import sys
import threading
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import yaml

import writeup  # reutiliza ROOT, slugify, colores y logging

ROOT = writeup.ROOT
HERE = Path(__file__).resolve().parent
TOOLS_YML = ROOT / "_data" / "herramientas.yml"
UA = {"User-Agent": "Mozilla/5.0"}

Col = writeup.Col
_c = writeup._c
step, ok, err, warn, banner = writeup.step, writeup.ok, writeup.err, writeup.warn, writeup.banner
esc = writeup.esc
slugify = writeup.slugify

# Paleta de colores (sin verde: el verde no se usa para no chocar con nada)
PALETTE = [
    ["Cian", "46 230 214"], ["Turquesa", "0 214 170"], ["Azul", "94 180 248"],
    ["Azul claro", "125 211 252"], ["Azul marino", "59 130 246"], ["Índigo", "129 140 248"],
    ["Morado", "193 108 255"], ["Lavanda", "180 130 255"], ["Rosa", "255 94 135"],
    ["Fucsia", "240 100 200"], ["Coral", "255 120 60"], ["Naranja", "255 175 0"],
    ["Ámbar", "255 196 0"], ["Amarillo", "255 214 10"], ["Blanco", "240 246 252"], ["Gris", "148 163 184"],
]

# GitHub language -> tipo que se muestra
LANG_MAP = {
    "shell": "Bash", "powershell": "Bash", "batchfile": "Bash",
    "python": "Python", "go": "Go", "rust": "Rust", "c": "C", "c++": "C++",
    "java": "Java", "ruby": "Ruby", "php": "Web", "perl": "Perl",
    "html": "Web", "css": "Web", "javascript": "Web", "typescript": "Web", "vue": "Web",
}
LANG_ICON = {
    "Bash": "fas fa-terminal", "Python": "fab fa-python", "Web": "fas fa-code-branch",
    "Go": "fas fa-code", "Rust": "fas fa-gear", "C": "fas fa-code", "C++": "fas fa-code",
    "Java": "fab fa-java", "Ruby": "fas fa-gem", "Perl": "fas fa-code",
}


# ==========================================================================
#  YAML de herramientas
# ==========================================================================
def load_tools():
    if TOOLS_YML.is_file():
        return yaml.safe_load(TOOLS_YML.read_text(encoding="utf-8")) or []
    return []


def save_tools(tools):
    TOOLS_YML.parent.mkdir(parents=True, exist_ok=True)
    body = yaml.safe_dump(tools, allow_unicode=True, sort_keys=False, default_flow_style=False, width=100)
    TOOLS_YML.write_text("# Herramientas propias. Cada una se despliega al pulsarla.\n" + body, encoding="utf-8")


def _norm(tool: dict) -> dict:
    """Ordena las claves y limpia el item."""
    tags = tool.get("tags") or []
    if isinstance(tags, str):
        tags = [t.lstrip("#").strip() for t in re.split(r"[\s,]+", tags) if t.strip()]
    out = {
        "nombre": (tool.get("nombre") or "").strip(),
        "lenguaje": (tool.get("lenguaje") or "").strip(),
        "color": (tool.get("color") or "46 230 214").strip(),
        "icono": (tool.get("icono") or "fas fa-code").strip(),
        "repo": (tool.get("repo") or "").strip(),
        "resumen": (tool.get("resumen") or "").strip(),
        "tags": tags,
    }
    return out


def find_index(tools, name):
    nl = slugify(name)
    for i, t in enumerate(tools):
        if slugify(t.get("nombre", "")) == nl:
            return i
    return -1


def upsert_tool(tool: dict):
    tools = load_tools()
    tool = _norm(tool)
    i = find_index(tools, tool["nombre"])
    if i >= 0:
        tools[i] = tool
    else:
        tools.append(tool)
    save_tools(tools)
    return tool


def remove_tool(name: str) -> bool:
    tools = load_tools()
    i = find_index(tools, name)
    if i < 0:
        return False
    del tools[i]
    save_tools(tools)
    return True


def repo_lang(repo_url: str) -> dict:
    """Detecta el lenguaje principal del repo de GitHub y propone tipo + icono."""
    m = re.search(r"github\.com/([^/]+)/([^/#?]+)", repo_url or "")
    if not m:
        return {"lenguaje": "", "icono": "fas fa-code"}
    owner, name = m.group(1), m.group(2).replace(".git", "")
    api = f"https://api.github.com/repos/{owner}/{name}"
    req = urllib.request.Request(api, headers={**UA, "Accept": "application/vnd.github+json"})
    data = json.loads(urllib.request.urlopen(req, timeout=15).read())
    gh = data.get("language") or ""
    tipo = LANG_MAP.get(gh.lower(), gh)
    return {"lenguaje": tipo, "icono": LANG_ICON.get(tipo, "fas fa-code"), "github_lang": gh}


# ==========================================================================
#  Render de la tarjeta (igual que _tabs/herramientas.html)
# ==========================================================================
def render_tool(t: dict) -> str:
    t = _norm(t)
    tags = "".join(f"<span>#{esc(tg)}</span>" for tg in t["tags"])
    tags_html = f'<div class="hx-tool-tags">{tags}</div>' if tags else ""
    icon = esc(t["icono"])
    return (
        f'<div class="hx-tools"><article class="hx-tool" style="--c: {esc(t["color"])}">'
        f'<i class="{icon} hx-tool-watermark" aria-hidden="true"></i>'
        f'<div class="hx-tool-head-row">'
        f'<i class="{icon} hx-tool-icon" aria-hidden="true"></i>'
        f'<span class="hx-tool-head"><b>{esc(t["nombre"] or "Nombre")}</b><small>{esc(t["lenguaje"])}</small></span>'
        f'</div>'
        f'{tags_html}'
        f'<p class="hx-tool-resumen">{esc(t["resumen"])}</p>'
        f'<div class="hx-tool-cta"><a class="hx-btn" href="{esc(t["repo"])}" target="_blank" rel="noopener">'
        f'<i class="fab fa-github" aria-hidden="true"></i> Abrir herramienta</a></div>'
        f'</article></div>'
    )


def git_publish(name: str) -> dict:
    rel = str(TOOLS_YML.relative_to(ROOT))

    def run(*a):
        return subprocess.run(a, cwd=str(ROOT), capture_output=True, text=True)

    try:
        run("git", "add", "--", rel)
        c = run("git", "commit", "-m", f"Herramienta: {name}")
        combined = (c.stdout + c.stderr).lower()
        if c.returncode != 0 and "nothing to commit" not in combined:
            return {"ok": False, "msg": (c.stderr or c.stdout).strip()}
        nothing = "nothing to commit" in combined
        p = run("git", "push")
        if p.returncode != 0:
            return {"ok": False, "msg": (p.stderr or p.stdout).strip()}
        return {"ok": True, "msg": "Sin cambios que subir." if nothing else "Subido al blog."}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "msg": str(e)}


# ==========================================================================
#  Servidor + editor
# ==========================================================================
EDITOR_HTML = (HERE / "herramientas_editor.html")


class Handler(BaseHTTPRequestHandler):
    mode = "add"

    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path in ("/", "/editor.html"):
            self._send(200, EDITOR_HTML.read_text(encoding="utf-8"), "text/html; charset=utf-8")
            return
        if u.path == "/hacker.css":
            self._send(200, (ROOT / "assets/css/hacker.css").read_text(encoding="utf-8"), "text/css; charset=utf-8")
            return
        if u.path.startswith("/assets/"):
            f = (ROOT / u.path.lstrip("/")).resolve()
            if ROOT in f.parents and f.is_file():
                ctypes = {".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
                          ".woff2": "font/woff2", ".css": "text/css", ".js": "application/javascript"}
                self._send(200, f.read_bytes(), ctypes.get(f.suffix.lower(), "application/octet-stream"))
            else:
                self._send(404, {"error": "not found"})
            return
        if u.path == "/api/tools":
            self._send(200, [_norm(t) for t in load_tools()])
            return
        if u.path == "/api/tool":
            q = urllib.parse.parse_qs(u.query)
            name = (q.get("name") or [""])[0]
            tools = load_tools()
            i = find_index(tools, name)
            self._send(200, _norm(tools[i]) if i >= 0 else {"error": "no existe"})
            return
        if u.path == "/api/lang":
            q = urllib.parse.parse_qs(u.query)
            repo = (q.get("repo") or [""])[0]
            try:
                self._send(200, repo_lang(repo))
            except Exception as e:  # noqa: BLE001
                self._send(200, {"lenguaje": "", "icono": "fas fa-code", "error": str(e)})
            return
        self._send(404, {"error": "not found"})

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        n = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(n) or b"{}")
        if u.path == "/api/render":
            self._send(200, {"html": render_tool(data)})
            return
        if u.path == "/api/publish":
            name = (data.get("nombre") or "").strip()
            if not name:
                self._send(400, {"error": "Falta el nombre de la herramienta."})
                return
            try:
                upsert_tool(data)
                ok(f"Herramienta guardada: {_c(name, Col.BOLD)}")
                step("Subiendo al blog con git…")
                git = git_publish(name)
                (ok if git["ok"] else err)(f"git: {git['msg']}")
                self._send(200, {"git": git})
            except Exception as e:  # noqa: BLE001
                err(f"Error al publicar: {e}")
                self._send(500, {"error": str(e)})
            return
        if u.path == "/api/remove":
            name = (data.get("nombre") or "").strip()
            if remove_tool(name):
                git = git_publish(name)
                ok(f"Herramienta borrada: {_c(name, Col.BOLD)}")
                self._send(200, {"git": git})
            else:
                self._send(404, {"error": "no existe"})
            return
        if u.path == "/api/shutdown":
            self._send(200, {"ok": True})
            step("Editor de herramientas cerrado.")
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return
        self._send(404, {"error": "not found"})


def serve(mode, name, port, no_open):
    Handler.mode = mode
    qs = {"mode": mode}
    if name:
        qs["name"] = name
    url = f"http://localhost:{port}/editor.html?{urllib.parse.urlencode(qs)}"
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    step("Editor de herramientas en marcha: " + _c(url, Col.CYAN))
    print(_c("    (Ctrl+C para parar)\n", Col.DIM))
    if not no_open:
        webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print()
        step("Servidor parado.")


def main():
    p = argparse.ArgumentParser(prog="herramientas", description="Editor de herramientas del blog.")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--add", nargs="?", const=True, default=None, metavar="NOMBRE",
                   help="Añadir una herramienta nueva (abre el editor).")
    g.add_argument("--edit", metavar="NOMBRE", help="Editar una herramienta existente.")
    g.add_argument("--remove", metavar="NOMBRE", help="Borrar una herramienta.")
    p.add_argument("-p", "--port", type=int, default=8100)
    p.add_argument("--no-open", action="store_true")
    args = p.parse_args()

    if args.add:
        banner()
        name = args.add if isinstance(args.add, str) else ""
        if name and find_index(load_tools(), name) >= 0:
            err(f"Ya existe una herramienta llamada '{name}'. Usa --edit.")
            sys.exit(1)
        step("Modo " + _c("añadir", Col.BOLD) + " herramienta.")
        serve("add", name, args.port, args.no_open)
    elif args.edit:
        banner()
        if find_index(load_tools(), args.edit) < 0:
            err(f"No existe la herramienta '{args.edit}'.")
            sys.exit(1)
        step("Modo " + _c("editar", Col.BOLD) + f": {args.edit}")
        serve("edit", args.edit, args.port, args.no_open)
    elif args.remove:
        banner()
        if not remove_tool(args.remove):
            err(f"No existe la herramienta '{args.remove}'.")
            sys.exit(1)
        ok(f"Herramienta '{args.remove}' borrada de {TOOLS_YML.relative_to(ROOT)}.")
        step("Haz " + _c("git add -A && git commit && git push", Col.CYAN) + " para reflejarlo.")
    else:
        banner()
        warn("Indica una acción: --add [NOMBRE] | --edit NOMBRE | --remove NOMBRE")


if __name__ == "__main__":
    main()
