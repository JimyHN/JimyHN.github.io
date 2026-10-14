#!/usr/bin/env python3
"""Graba el recorrido animado en un vídeo (mp4).

    python3 animacion/grabar.py [--salida fichero.mp4] [--fps 30] [--ancho 1920] [--alto 1080]

Levanta el mismo proxy que `animacion.py` y abre el reproductor en un Chromium
sin ventana, pero NO lo deja correr en tiempo real: lo mueve fotograma a
fotograma con `window.ANIM.seek()` y captura cada uno. Así el vídeo sale
exactamente igual que el recorrido y sin tirones, por lento que vaya el equipo
o la red. Al final junta los fotogramas con GStreamer (x264) o con ffmpeg.

El reproductor se abre con `?rec=1`: sin barra de controles ni avisos.

Para grabar tu Jekyll local en vez del sitio publicado (arráncalo antes con
`bash dev/tools/run.sh`):

    BLOG_URL="http://127.0.0.1:4000" python3 animacion/grabar.py

Solo usa la librería estándar de Python (el cliente de WebSocket/CDP va aquí
dentro). Necesita Chromium/Chrome y GStreamer (o ffmpeg).
"""
import argparse
import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import sys
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import animacion as proxy  # noqa: E402  (proxy + free_port, el mismo que el reproductor)


# ============================================================
#  Cliente mínimo de WebSocket (RFC 6455) para hablar CDP
# ============================================================
class WS:
    """Lo justo para el protocolo de DevTools: texto, sin extensiones."""

    def __init__(self, url, timeout=120):
        if not url.startswith("ws://"):
            raise ValueError("solo ws://")
        hostport, _, path = url[5:].partition("/")
        host, _, port = hostport.partition(":")
        self.sock = socket.create_connection((host, int(port or 80)), timeout=timeout)
        self.sock.settimeout(timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall((
            f"GET /{path} HTTP/1.1\r\n"
            f"Host: {hostport}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        ).encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise RuntimeError("el navegador cerró la conexión en el saludo")
            buf += chunk
        head, _, rest = buf.partition(b"\r\n\r\n")
        if b" 101" not in head.split(b"\r\n")[0]:
            raise RuntimeError("saludo WebSocket rechazado: " + head.split(b"\r\n")[0].decode())
        self._buf = rest
        self._next_id = 0

    # ---- bytes ----
    def _read(self, n):
        while len(self._buf) < n:
            chunk = self.sock.recv(max(65536, n - len(self._buf)))
            if not chunk:
                raise RuntimeError("conexión cerrada por el navegador")
            self._buf += chunk
        out, self._buf = self._buf[:n], self._buf[n:]
        return out

    def _send_frame(self, opcode, payload):
        head = bytearray([0x80 | opcode])
        n = len(payload)
        if n < 126:
            head.append(0x80 | n)
        elif n < 65536:
            head.append(0x80 | 126)
            head += struct.pack(">H", n)
        else:
            head.append(0x80 | 127)
            head += struct.pack(">Q", n)
        mask = os.urandom(4)
        head += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(bytes(head) + masked)

    def _recv_frame(self):
        b0, b1 = self._read(2)
        fin, opcode = b0 & 0x80, b0 & 0x0F
        n = b1 & 0x7F
        if n == 126:
            n = struct.unpack(">H", self._read(2))[0]
        elif n == 127:
            n = struct.unpack(">Q", self._read(8))[0]
        data = self._read(n) if n else b""
        if b1 & 0x80:  # el servidor no debería enmascarar, pero por si acaso
            key = data[:4]
            data = bytes(b ^ key[i % 4] for i, b in enumerate(data[4:]))
        return fin, opcode, data

    def recv(self):
        """Devuelve el siguiente mensaje de texto (juntando fragmentos)."""
        while True:
            fin, opcode, data = self._recv_frame()
            if opcode == 0x9:            # ping → pong
                self._send_frame(0xA, data)
                continue
            if opcode == 0x8:
                raise RuntimeError("el navegador cerró la conexión")
            if opcode == 0xA:
                continue
            payload = data
            while not fin:               # continuación
                fin, _, more = self._recv_frame()
                payload += more
            return payload.decode("utf-8", "replace")

    # ---- CDP ----
    def call(self, method, params=None, timeout=120):
        self._next_id += 1
        mid = self._next_id
        self._send_frame(0x1, json.dumps({"id": mid, "method": method,
                                          "params": params or {}}).encode())
        limit = time.time() + timeout
        while True:
            msg = json.loads(self.recv())
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error'].get('message')}")
                return msg.get("result", {})
            if time.time() > limit:
                raise TimeoutError(method)

    def eval(self, expr, timeout=120):
        r = self.call("Runtime.evaluate",
                      {"expression": expr, "returnByValue": True,
                       "awaitPromise": True}, timeout)
        if r.get("exceptionDetails"):
            raise RuntimeError("JS: " + json.dumps(r["exceptionDetails"])[:300])
        return r.get("result", {}).get("value")

    def close(self):
        try:
            self._send_frame(0x8, b"")
        except Exception:  # noqa: BLE001
            pass
        try:
            self.sock.close()
        except Exception:  # noqa: BLE001
            pass


# ============================================================
#  Navegador
# ============================================================
CHROMES = ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
           "brave-browser", "microsoft-edge", "chrome")


def find_chrome():
    for cand in CHROMES:
        exe = shutil.which(cand)
        if exe:
            return exe
    return None


def launch(exe, url, port, profile, w, h):
    args = [exe,
            "--headless=new",
            f"--remote-debugging-port={port}",
            f"--user-data-dir={profile}",
            f"--window-size={w},{h}",
            "--force-device-scale-factor=1",
            "--hide-scrollbars",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            "--disable-backgrounding-occluded-windows",
            "--autoplay-policy=no-user-gesture-required",
            url]
    if os.geteuid() == 0:
        args.insert(1, "--no-sandbox")
    return subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def devtools_url(port, timeout=40):
    """Espera a que DevTools levante y devuelve el WebSocket de la pestaña."""
    limit = time.time() + timeout
    while time.time() < limit:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=3) as r:
                for t in json.load(r):
                    if t.get("type") == "page" and t.get("webSocketDebuggerUrl"):
                        return t["webSocketDebuggerUrl"]
        except Exception:  # noqa: BLE001
            pass
        time.sleep(0.4)
    raise RuntimeError("no se pudo hablar con el navegador (DevTools no respondió)")


# ============================================================
#  Codificación
# ============================================================
def encode(frames_dir, fps, out):
    """Junta los PNG en un mp4. GStreamer primero; ffmpeg si no está."""
    pattern = str(frames_dir / "f%06d.png")
    gst = shutil.which("gst-launch-1.0")
    if gst:
        pipe = [gst, "-q",
                "multifilesrc", f"location={pattern}", "index=0", "start-index=0",
                f"caps=image/png,framerate=(fraction){fps}/1",
                "!", "pngdec", "!", "videoconvert", "!", "video/x-raw,format=I420",
                "!", "x264enc", "pass=quant", "quantizer=20", "speed-preset=slow",
                f"key-int-max={fps * 2}",
                "!", "h264parse", "!", "mp4mux", "faststart=true",
                "!", "filesink", f"location={out}"]
        if subprocess.call(pipe) == 0:
            return "GStreamer (x264)"
    ff = shutil.which("ffmpeg")
    if ff:
        cmd = [ff, "-y", "-loglevel", "error", "-framerate", str(fps), "-i", pattern,
               "-c:v", "libx264", "-preset", "slow", "-crf", "20",
               "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)]
        if subprocess.call(cmd) == 0:
            return "ffmpeg (x264)"
    raise RuntimeError("no hay con qué codificar: instala GStreamer (gst-launch-1.0) o ffmpeg")


# ============================================================
def main():
    ap = argparse.ArgumentParser(description="Graba el recorrido animado en un vídeo.")
    ap.add_argument("--salida", "-o", default=None, help="fichero mp4 de salida")
    ap.add_argument("--fps", type=int, default=30, help="fotogramas por segundo (30)")
    ap.add_argument("--ancho", type=int, default=1920)
    ap.add_argument("--alto", type=int, default=1080)
    ap.add_argument("--conservar", action="store_true", help="no borrar los PNG al terminar")
    args = ap.parse_args()
    args.ancho -= args.ancho % 2   # I420 no admite lados impares
    args.alto -= args.alto % 2

    videos = Path.home() / "Vídeos"
    if not videos.is_dir():
        videos = Path.home() / "Videos"
    if not videos.is_dir():
        videos = Path.home()
    out = Path(args.salida).expanduser().resolve() if args.salida else videos / "recorrido-jimyhn.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    # Ojo: Chromium instalado como snap no puede escribir en /tmp ni en carpetas
    # ocultas del home, así que el directorio de trabajo cuelga de la salida.
    work = out.parent / (out.stem + "-grabacion")
    frames_dir = work / "frames"
    if work.exists():
        shutil.rmtree(work)
    frames_dir.mkdir(parents=True)

    exe = find_chrome()
    if not exe:
        print("  No encuentro Chrome/Chromium.", file=sys.stderr)
        return 1

    # --- proxy del blog (el mismo que usa el reproductor) ---
    port = proxy.free_port(proxy.BASE_PORT)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), proxy.Handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{port}{proxy.PLAYER_PREFIX}?rec=1"

    print("\n  \033[92m▶ Grabando el recorrido\033[0m")
    print(f"    Blog (proxy): {proxy.BLOG}")
    print(f"    Salida      : {out}  ({args.ancho}x{args.alto} @ {args.fps} fps)")

    dbg = proxy.free_port(9222)
    browser = launch(exe, "about:blank", dbg, work / "perfil", args.ancho, args.alto)
    cdp = None
    try:
        cdp = WS(devtools_url(dbg))
        cdp.call("Page.enable")
        cdp.call("Runtime.enable")
        # La ventana del headless descuenta su propia barra, así que el hueco
        # visible NO mide lo que pides (y si sale impar, x264 ni arranca):
        # se fija el viewport exacto ANTES de cargar nada.
        cdp.call("Emulation.setDeviceMetricsOverride",
                 {"width": args.ancho, "height": args.alto,
                  "deviceScaleFactor": 1, "mobile": False})
        cdp.call("Page.navigate", {"url": url})

        # El reproductor precarga las 4 páginas (imágenes incluidas) antes de
        # dar por bueno el play: esperamos a esa misma señal.
        print("    Precargando las páginas…", flush=True)
        limit = time.time() + 240
        while True:
            try:
                if cdp.eval("!!(window.ANIM && window.ANIM.ready())"):
                    break
            except RuntimeError:
                pass  # aún navegando
            if time.time() > limit:
                raise TimeoutError("las páginas no acabaron de cargar (¿sin internet?)")
            time.sleep(0.5)

        total = float(cdp.eval("window.ANIM.total()"))
        n = int(round(total * args.fps)) + 1
        print(f"    Duración    : {total:.1f} s → {n} fotogramas")

        t0 = time.time()
        for i in range(n):
            cdp.eval(f"window.ANIM.seek({i / args.fps:.4f})")
            shot = cdp.call("Page.captureScreenshot",
                            {"format": "png", "fromSurface": True,
                             "captureBeyondViewport": False})
            (frames_dir / f"f{i:06d}.png").write_bytes(base64.b64decode(shot["data"]))
            if i % 25 == 0 or i == n - 1:
                done = (i + 1) / n
                eta = (time.time() - t0) / max(done, 1e-6) * (1 - done)
                print(f"\r    Capturando  : {done * 100:5.1f}%  (quedan ~{eta:4.0f} s)",
                      end="", flush=True)
        print()
    finally:
        if cdp:
            cdp.close()
        browser.terminate()
        try:
            browser.wait(timeout=10)
        except Exception:  # noqa: BLE001
            browser.kill()
        httpd.shutdown()

    print("    Codificando…", flush=True)
    how = encode(frames_dir, args.fps, out)
    if not args.conservar:
        shutil.rmtree(work, ignore_errors=True)

    size = out.stat().st_size / 1e6
    print(f"\n  \033[92m✔ Listo\033[0m  {out}  ({size:.1f} MB, {how})\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
