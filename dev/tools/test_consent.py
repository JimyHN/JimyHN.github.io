# -*- coding: utf-8 -*-
"""Comprueba el banner de consentimiento en Chromium headless (via CDP).

    python3 dev/tools/test_consent.py

Necesita Chromium. Sirve el bloque de _includes/metadata-hook.html por HTTP
(en file:// el localStorage lanza SecurityError y no se podría probar que la
elección persiste).

Escenarios: sin elegir (banner visible, GA NO cargado), rechazar (GA sigue
fuera, incluso tras recargar), reabrir desde el pie y aceptar (GA carga), y
recargar ya aceptado (carga solo, sin volver a preguntar).
"""
import sys, time, pathlib, tempfile, shutil, threading, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

RAIZ = pathlib.Path(__file__).resolve().parent.parent.parent  # dev/tools -> dev -> raíz
sys.path.insert(0, str(RAIZ / "animacion"))
import grabar  # cliente CDP ya probado por la animación
src = (RAIZ / "_includes/metadata-hook.html").read_text(encoding="utf-8")
bloque = src[src.index("<!-- Consentimiento"):]

# El harness imita la página real: mismo selector de pie que usa el script.
harness = ('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>t</title>\n'
           + bloque +
           '</head><body><main>contenido</main>'
           '<footer aria-label="Site Info"><p>&copy; 2026 Jaime.</p><p>Hecho con Jekyll.</p></footer>'
           '</body></html>')

# Se sirve por HTTP, no file://: en file:// el localStorage lanza SecurityError
# y no se podria probar que la eleccion persiste al recargar.
base = pathlib.Path(tempfile.mkdtemp(prefix="hx-harness-"))
(base / "harness.html").write_text(harness, encoding="utf-8")

callado = type("H", (SimpleHTTPRequestHandler,), {"log_message": lambda *a, **k: None})
srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(callado, directory=str(base)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{srv.server_address[1]}/harness.html"

perfil = tempfile.mkdtemp(prefix="hx-perfil-")
puerto = grabar.proxy.free_port(9333)
exe = grabar.find_chrome()
proc = grabar.launch(exe, url, puerto, perfil, 1280, 800)
fallos = []
try:
    ws = grabar.WS(grabar.devtools_url(puerto))
    ws.call("Runtime.enable")
    ws.call("Page.enable")
    time.sleep(1.5)

    ev = ws.eval          # ya trae manejo de excepciones de JS

    def recargar():
        ws.call("Page.reload", {"ignoreCache": True})
        time.sleep(1.8)

    def comprueba(nombre, cond):
        print(("  ok    " if cond else "  FALLA ") + nombre)
        if not cond:
            fallos.append(nombre)

    ga = "!!document.querySelector('script[src*=googletagmanager]')"
    banner = "!!document.querySelector('.hx-cookies')"

    print("1) Primera visita, sin elegir")
    comprueba("el banner aparece", ev(banner) is True)
    comprueba("GA NO se carga sin consentimiento", ev(ga) is False)
    comprueba("hay dos botones (Rechazar y Aceptar)",
              ev("document.querySelectorAll('.hx-cookies button[data-v]').length") == 2)
    comprueba("enlace 'Cookies' en el pie", ev("!!document.querySelector('.hx-cookies-link')") is True)

    print("2) Rechazar")
    ev("document.querySelector('.hx-cookies button[data-v=\"no\"]').click()")
    time.sleep(0.4)
    comprueba("el banner se cierra", ev(banner) is False)
    comprueba("GA sigue sin cargarse", ev(ga) is False)
    recargar()
    comprueba("tras recargar no reaparece el banner", ev(banner) is False)
    comprueba("tras recargar GA sigue fuera", ev(ga) is False)

    print("3) Reabrir desde el pie y aceptar")
    ev("document.querySelector('.hx-cookies-link').click()")
    time.sleep(0.4)
    comprueba("el banner vuelve a salir", ev(banner) is True)
    ev("document.querySelector('.hx-cookies button[data-v=\"si\"]').click()")
    time.sleep(0.8)
    comprueba("GA se carga al aceptar", ev(ga) is True)
    comprueba("gtag queda definido", ev("typeof window.gtag") == "function")

    print("4) Ya aceptado, recargando")
    recargar()
    comprueba("GA se carga solo, sin volver a preguntar", ev(ga) is True)
    comprueba("el banner no reaparece", ev(banner) is False)
    ws.close()
finally:
    proc.terminate()
    srv.shutdown()
    shutil.rmtree(perfil, ignore_errors=True)
    shutil.rmtree(base, ignore_errors=True)

print()
print("TODO OK" if not fallos else f"{len(fallos)} FALLO(S): {fallos}")
sys.exit(1 if fallos else 0)
