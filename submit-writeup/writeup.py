#!/usr/bin/env python3
"""Editor de write-ups del blog.

Arranca un servidor local y abre el editor en el navegador. Desde el editor
escribes cada sección, pegas la URL de la máquina y al pulsar "Publicar" se
genera el post en _posts/ y se guardan las imágenes de la máquina.

Uso:
    python3 submit-writeup/writeup.py            # abre el editor
    python3 submit-writeup/writeup.py -n Blue -ip 10.10.10.40 \
        -u https://labs.hackthebox.com/achievement/machine/2772097/51
    python3 submit-writeup/writeup.py -h

Flags (opcionales, solo rellenan el editor al abrirlo):
    -n/--name   Nombre de la máquina (obligatorio para traer la imagen).
    -ip         IP de la máquina (si no, se usa una por defecto).
    -u/--url    URL del logro de HackTheBox (de ahí sale la imagen y la prueba).
    -p/--port   Puerto del servidor (por defecto 8099).
    --no-open   No abrir el navegador automáticamente.
"""

import argparse
import io
import json
import re
import sys
import urllib.parse
import urllib.request
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
POSTS = ROOT / "_posts"
MACHINES_DIR = ROOT / "assets" / "img" / "machines"
DEFAULT_IP = "10.10.10.10"
UA = {"User-Agent": "Mozilla/5.0"}


def slugify(name: str) -> str:
    s = name.strip().lower()
    s = s.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "maquina"


def fetch_machine_images(url: str, slug: str):
    """Descarga el banner del logro de HTB y recorta el avatar de la máquina.

    Devuelve {'avatar': ruta_web, 'banner': ruta_web, 'proof': url}.
    """
    from PIL import Image, ImageDraw

    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20).read().decode("utf-8", "ignore")
    m = re.search(r'og:image"\s+content="([^"]+)"', html)
    if not m:
        raise RuntimeError("No se encontró la imagen (og:image) en esa URL.")
    banner_url = m.group(1)
    raw = urllib.request.urlopen(urllib.request.Request(banner_url, headers=UA), timeout=20).read()

    MACHINES_DIR.mkdir(parents=True, exist_ok=True)
    banner = Image.open(io.BytesIO(raw)).convert("RGBA")
    banner_path = MACHINES_DIR / f"{slug}-banner.png"
    banner.save(banner_path)

    # El avatar circular está centrado arriba; coordenadas sobre el banner 700x360.
    w, h = banner.size
    sx, sy = w / 700.0, h / 360.0
    cx, cy, r = int(350 * sx), int(70 * sy), int(41 * min(sx, sy))
    crop = banner.crop((cx - r, cy - r, cx + r, cy + r)).resize((256, 256), Image.LANCZOS)
    mask = Image.new("L", (256, 256), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, 255, 255), fill=255)
    avatar = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    avatar.paste(crop, (0, 0), mask)
    avatar_path = MACHINES_DIR / f"{slug}.png"
    avatar.save(avatar_path)

    return {
        "avatar": f"/assets/img/machines/{slug}.png",
        "banner": f"/assets/img/machines/{slug}-banner.png",
        "proof": url,
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
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
            self._send(200, (HERE / "editor.html").read_text(encoding="utf-8"), "text/html; charset=utf-8")
            return
        if u.path == "/hacker.css":
            self._send(200, (ROOT / "assets/css/hacker.css").read_text(encoding="utf-8"), "text/css; charset=utf-8")
            return
        if u.path.startswith("/assets/"):
            f = (ROOT / u.path.lstrip("/")).resolve()
            if ROOT in f.parents and f.is_file():
                ctypes = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                          ".css": "text/css", ".js": "application/javascript", ".svg": "image/svg+xml",
                          ".woff2": "font/woff2", ".pdf": "application/pdf"}
                self._send(200, f.read_bytes(), ctypes.get(f.suffix.lower(), "application/octet-stream"))
            else:
                self._send(404, {"error": "not found"})
            return
        if u.path == "/api/image":
            q = urllib.parse.parse_qs(u.query)
            url = (q.get("url") or [""])[0]
            name = (q.get("name") or [""])[0]
            if not url or not name:
                self._send(400, {"error": "Faltan 'url' y 'name'."})
                return
            try:
                self._send(200, fetch_machine_images(url, slugify(name)))
            except Exception as e:  # noqa: BLE001
                self._send(500, {"error": str(e)})
            return
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != "/api/publish":
            self._send(404, {"error": "not found"})
            return
        n = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(n) or b"{}")
        slug = slugify(data.get("name", ""))
        date = data.get("date") or datetime.now().strftime("%Y-%m-%d")
        content = data.get("content", "")
        POSTS.mkdir(exist_ok=True)
        path = POSTS / f"{date}-{slug}.html"
        path.write_text(content, encoding="utf-8")
        self._send(200, {"path": str(path.relative_to(ROOT))})


def main():
    p = argparse.ArgumentParser(description="Editor de write-ups del blog.")
    p.add_argument("-n", "--name", default="", help="Nombre de la máquina")
    p.add_argument("-ip", "--ip", default="", help="IP de la máquina")
    p.add_argument("-u", "--url", default="", help="URL del logro de HackTheBox")
    p.add_argument("-p", "--port", type=int, default=8099, help="Puerto del servidor")
    p.add_argument("--no-open", action="store_true", help="No abrir el navegador")
    args = p.parse_args()

    qs = urllib.parse.urlencode({k: v for k, v in
                                 {"name": args.name, "ip": args.ip or DEFAULT_IP, "url": args.url}.items() if v})
    editor_url = f"http://localhost:{args.port}/editor.html" + (f"?{qs}" if qs else "")

    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"\n  Editor de write-ups en marcha:\n    {editor_url}\n\n  Ctrl+C para parar.\n")
    if not args.no_open:
        webbrowser.open(editor_url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  Parado.\n")


if __name__ == "__main__":
    main()
