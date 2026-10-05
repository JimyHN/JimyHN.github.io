#!/usr/bin/env python3
"""Recorrido animado del blog JimyHN.github.io.

    python3 animacion/animacion.py

Levanta un proxy local del blog publicado (así los iframes son del mismo origen
y se les puede controlar el scroll) y abre el navegador con el reproductor
determinista (recorrido = función del tiempo: scrubbing, play/pausa, ±5s, bucle).

Solo usa la librería estándar de Python. Necesita conexión a internet para el
proxy del sitio en vivo.
"""
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import urllib.error
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
BLOG = os.environ.get("BLOG_URL", "https://jimyhn.github.io").rstrip("/")
PLAYER_PREFIX = "/__player__"
STATIC_PREFIX = "/__static__/"
BASE_PORT = 8777

TEXT_CT = {".css": "text/css", ".js": "application/javascript", ".html": "text/html",
           ".svg": "image/svg+xml", ".json": "application/json"}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # silencio
        pass

    def do_GET(self):
        path = self.path
        if path.startswith(PLAYER_PREFIX):
            return self._local("player.html", "text/html; charset=utf-8")
        if path.startswith(STATIC_PREFIX):
            name = path[len(STATIC_PREFIX):].split("?")[0]
            if "/" in name or ".." in name:
                return self._status(404, b"404")
            ext = os.path.splitext(name)[1]
            ct = TEXT_CT.get(ext, "application/octet-stream")
            if ext in (".css", ".js", ".html", ".svg", ".json"):
                ct += "; charset=utf-8"
            return self._local(name, ct)
        return self._proxy(path)

    def _local(self, name, ctype):
        f = HERE / name
        if not f.is_file():
            return self._status(404, b"404")
        self._status(200, f.read_bytes(), ctype)

    def _proxy(self, path):
        url = BLOG + path
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (animacion-proxy)"})
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                data = r.read()
                ctype = r.headers.get("Content-Type", "application/octet-stream")
                code = r.getcode()
        except urllib.error.HTTPError as e:
            body = e.read() if e.fp else b""
            return self._status(e.code, body, e.headers.get("Content-Type", "text/html"))
        except Exception as e:  # noqa: BLE001
            return self._status(502, ("Proxy error: " + str(e)).encode(), "text/plain; charset=utf-8")
        if "text/html" in ctype:
            html = data.decode("utf-8", "replace")
            # quitar CSP meta (podría bloquear el iframe/scripts del reproductor)
            html = re.sub(r'<meta[^>]+http-equiv=["\']?[Cc]ontent-[Ss]ecurity-[Pp]olicy["\']?[^>]*>', "", html)
            data = html.encode("utf-8")
        self._status(code, data, ctype)

    def _status(self, code, body, ctype="text/plain; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass


def free_port(start):
    for p in range(start, start + 60):
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    return start


def open_browser(url):
    # Ventana normal maximizada (con barra del navegador, para poder salir con
    # Esc/cerrar). Nada de kiosk/fullscreen.
    for cand in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
                 "brave-browser", "microsoft-edge", "chrome"):
        exe = shutil.which(cand)
        if exe:
            try:
                subprocess.Popen([exe, "--new-window", "--start-maximized", url],
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return
            except Exception:  # noqa: BLE001
                pass
    webbrowser.open(url)


def main():
    port = free_port(BASE_PORT)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    httpd.daemon_threads = True
    url = f"http://127.0.0.1:{port}{PLAYER_PREFIX}"
    print("\n  \033[92m▶ Recorrido animado\033[0m")
    print(f"    Reproductor : {url}")
    print(f"    Blog (proxy): {BLOG}")
    print("    Espacio = play/pausa · ← → = ±5s · Ctrl+C para salir.\n")
    threading.Timer(0.8, lambda: open_browser(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Cerrado.")
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    sys.exit(main())
