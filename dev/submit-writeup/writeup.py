#!/usr/bin/env python3
"""Editor y gestor de write-ups del blog.

Uso:
    python3 dev/submit-writeup/writeup.py --add
        Abre el editor en el navegador para redactar un write-up nuevo.

    python3 dev/submit-writeup/writeup.py --edit /writeups/blue
        Abre el editor cargado con el write-up de Blue para editarlo.

    python3 dev/submit-writeup/writeup.py --remove /writeups/blue
        Borra el write-up de Blue del blog (pide confirmación).

Flags:
    --add              Redactar un write-up nuevo.
    --edit  RUTA       Editar un write-up ya publicado (p. ej. /writeups/blue).
    --remove RUTA      Borrar un write-up ya publicado.
    -p/--port PUERTO   Puerto del servidor (por defecto 8099).
    --no-open          No abrir el navegador automáticamente.

Cada write-up guarda su fuente editable en dev/submit-writeup/write-ups/<slug>.json,
que es lo que se recarga al usar --edit.
"""

import argparse
import base64
import io
import json
import re
import subprocess
import sys
import threading
import urllib.parse
import urllib.request
import webbrowser
from datetime import datetime
from html import escape as _html_escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent  # dev/submit-writeup -> dev -> raíz del repo
POSTS = ROOT / "_posts"
SOURCES = HERE / "write-ups"
MACHINES_DIR = ROOT / "assets" / "img" / "machines"
DEFAULT_IP = "10.10.10.10"
AUTHOR = "Jaime Hereza Niño"
UA = {"User-Agent": "Mozilla/5.0"}

# Secciones disponibles (id, nombre, color RGB). El editor usa esta misma lista.
SECTIONS = [
    ("resumen", "Resumen", "255 94 135"),
    ("vulnerabilidad", "Vulnerabilidad", "255 62 62"),
    ("reconocimiento", "Reconocimiento", "46 230 214"),
    ("enumeracion", "Enumeración", "94 180 248"),
    ("explotacion", "Explotación", "255 175 0"),
    ("movimiento", "Movimiento lateral", "46 230 214"),
    ("escalada", "Escalada de privilegios", "193 108 255"),
    ("flags", "Flags", "255 214 10"),
    ("arreglo", "Cómo se arregla", "46 230 214"),
    ("conclusiones", "Conclusiones", "200 210 220"),
]
SEC_NOM = {s[0]: s[1] for s in SECTIONS}
SEC_COL = {s[0]: s[2] for s in SECTIONS}

# ==========================================================================
#  Consola con color
# ==========================================================================
_TTY = sys.stdout.isatty()


class Col:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    GREEN = "\033[38;2;159;239;0m"
    CYAN = "\033[38;2;46;230;214m"
    RED = "\033[38;2;255;62;62m"
    YELLOW = "\033[38;2;255;214;10m"
    ORANGE = "\033[38;2;255;175;0m"
    MAGENTA = "\033[38;2;193;108;255m"
    BLUE = "\033[38;2;94;180;248m"
    GREY = "\033[38;2;125;139;153m"


def _c(txt, color):
    return f"{color}{txt}{Col.RESET}" if _TTY else txt


def banner():
    print()
    print(_c("  ╔═══════════════════════════════════╗", Col.GREEN))
    print(_c("  ║", Col.GREEN) + _c("   ▚ writeup · gestor de write-ups  ", Col.BOLD + Col.GREEN) + _c("║", Col.GREEN))
    print(_c("  ╚═══════════════════════════════════╝", Col.GREEN))
    print()


def step(msg):
    print(_c("  ▸ ", Col.CYAN) + msg)


def ok(msg):
    print(_c("  ✓ ", Col.GREEN) + _c(msg, Col.GREEN))


def warn(msg):
    print(_c("  ! ", Col.YELLOW) + _c(msg, Col.YELLOW))


def err(msg):
    print(_c("  ✗ ", Col.RED) + _c(msg, Col.RED))


def ask(msg):
    return input(_c("  ? ", Col.MAGENTA) + msg).strip()


# ==========================================================================
#  Utilidades
# ==========================================================================
def slugify(name: str) -> str:
    s = (name or "").strip().lower()
    for a, b in zip("áéíóúñ", "aeioun"):
        s = s.replace(a, b)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "maquina"


def resolve_slug(raw: str) -> str:
    """De '/writeups/blue', '/posts/blue/', 'blue' -> 'blue'."""
    raw = (raw or "").strip().strip("/")
    if "/" in raw:
        raw = raw.rstrip("/").split("/")[-1]
    return slugify(raw)


def esc(t: str) -> str:
    return _html_escape(t, quote=False)


# ==========================================================================
#  Resaltado y marcado en línea
# ==========================================================================
# <b> = negrita blanca (general). Colores explícitos: <bc> cian (binarios),
# <by> amarillo (usuarios), <br> rojo (vulnerabilidades), <bg> verde,
# <bo> naranja, <ba> ámbar, <bm> magenta, <bw> blanca (alias de <b>).
COLORS = {
    "b": "hx-cw", "bw": "hx-cw", "bg": "hx-cg", "bc": "hx-cc", "bm": "hx-cm",
    "br": "hx-cr", "by": "hx-cy", "bo": "hx-co", "ba": "hx-ca", "bp": "hx-cp",
}
_TAG_RE = re.compile(r"<(/?)(bc|bm|br|by|bo|bw|ba|bg|bp|b)>")


def colorize(t: str) -> str:
    """Convierte <b>..</b>, <bc>.. etc. en spans de color; escapa el resto."""
    t = _TAG_RE.sub(lambda m: f"\x00{'/' if m.group(1) else ''}{m.group(2)}\x01", t)
    t = esc(t)
    t = re.sub(r"\x00/(?:bc|bm|br|by|bo|bw|ba|bg|bp|b)\x01", "</span>", t)
    t = re.sub(r"\x00(bc|bm|br|by|bo|bw|ba|bg|bp|b)\x01", lambda m: f'<span class="{COLORS[m.group(1)]}">', t)
    return t


def render_inline(t: str) -> str:
    """Marcado en línea: `código`, [texto](url), **negrita**, <b>verde</b>, etc."""
    store = []

    def stash(html_):
        store.append(html_)
        return f"\x02{len(store) - 1}\x03"

    # subrayado <u> y cursiva <i> (se respetan tal cual, protegidos del escapado)
    t = re.sub(r"</?[ui]>", lambda m: stash(m.group(0)), t)
    # código en línea
    t = re.sub(r"`([^`]+)`", lambda m: stash(f"<code>{esc(m.group(1))}</code>"), t)
    # enlaces [texto](url)
    t = re.sub(
        r"\[([^\]]+)\]\(([^)]+)\)",
        lambda m: stash(f'<a href="{esc(m.group(2))}" target="_blank" rel="noopener">{esc(m.group(1))}</a>'),
        t,
    )
    # *cursiva* -> <i> (protegida del escapado)
    t = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", lambda m: stash(f"<i>{esc(m.group(1))}</i>"), t)
    # **negrita** -> verde (<b> lo procesa colorize)
    t = re.sub(r"\*\*([^*]+)\*\*", lambda m: f"<b>{m.group(1)}</b>", t)
    t = colorize(t)
    t = re.sub(r"\x02(\d+)\x03", lambda m: store[int(m.group(1))], t)
    return t


# ==========================================================================
#  Terminales
# ==========================================================================
PS1 = '<span class="hx-t-ps1">┌──(<b>jaime</b>㉿<b>kali</b>)-[~]</span><span class="hx-t-ps2">└─$</span>'


def _out_block(txt: str) -> str:
    return f'<div class="hx-t-out">{colorize(txt.strip(chr(10)))}</div>'


def _term_cmd(line: str) -> str:
    return f'<div class="hx-t-cmd">{PS1} <span class="hx-t-in">{colorize(line)}</span></div>'


_IS_CMD = re.compile(r"^\s*[$#]\s+")


def render_term(lang: str, block) -> str:
    """Renderiza un bloque de terminal.

    lang 'term'/'console' (por defecto): mezcla. Las líneas que empiezan por
    '$ ' o '# ' son comandos (prompt de Kali, naranja); el resto, salida.
    lang 'out'/'salida': todo salida.  lang 'in'/'entrada': todo comandos.
    """
    html_ = '<div class="hx-term2">'
    if lang in ("out", "output", "salida"):
        html_ += _out_block("\n".join(block))
    elif lang in ("in", "input", "entrada"):
        for l in block:
            if l.strip():
                html_ += _term_cmd(_IS_CMD.sub("", l))
    else:
        k, nb = 0, len(block)
        while k < nb:
            if _IS_CMD.match(block[k]):
                html_ += _term_cmd(_IS_CMD.sub("", block[k]))
                k += 1
            else:
                outs = []
                while k < nb and not _IS_CMD.match(block[k]):
                    outs.append(block[k])
                    k += 1
                html_ += _out_block("\n".join(outs))
    return html_ + "</div>"


# ==========================================================================
#  Bloques de prosa (párrafos, listas, tablas, avisos)
# ==========================================================================
_CALLOUT_TYPES = {"tip": "tip", "info": "info", "note": "info", "warn": "warning",
                  "warning": "warning", "danger": "danger"}


def _render_table(rows):
    def cells(r):
        return [c.strip() for c in r.strip().strip("|").split("|")]

    header = cells(rows[0])
    body = rows[2:]
    h = "<table><thead><tr>" + "".join(f"<th>{render_inline(x)}</th>" for x in header) + "</tr></thead><tbody>"
    for r in body:
        h += "<tr>" + "".join(f"<td>{render_inline(x)}</td>" for x in cells(r)) + "</tr>"
    return h + "</tbody></table>"


def _render_callout(typ, body):
    cls = _CALLOUT_TYPES.get(typ, "info")
    return f'<blockquote class="prompt-{cls}">{render_prose(body)}</blockquote>'


# Listas: viñetas (-, *, •) y ordenadas (1. / a. / i.), con marcadores cortos
# para no confundir un párrafo ("No. ", "Windows. ") con una lista.
_UL_RE = re.compile(r"^[-*•]\s+")
_OL_RE = re.compile(r"^(\d{1,3}|[a-z]|[ivxl]{1,4})[.)]\s+")


def _marker_kind(mark: str) -> str:
    if mark.isdigit():
        return "decimal"
    if mark and all(ch in "ivxl" for ch in mark.lower()):
        return "lower-roman"
    return "lower-alpha"


def _starts_block(line: str) -> bool:
    t = line.strip()
    return (not t) or t.startswith(("|", "::")) or bool(_UL_RE.match(t)) or bool(_OL_RE.match(t))


def render_prose(chunk: str) -> str:
    lines = chunk.split("\n")
    out = []
    i, n = 0, len(lines)
    while i < n:
        s = lines[i].strip()
        if not s:
            i += 1
            continue
        # aviso ::tip ... ::
        if s.startswith("::"):
            m = re.match(r"^::\s*(\w*)\s*(.*)$", s)
            typ = (m.group(1) or "info").lower()
            body = []
            if m.group(2):
                body.append(m.group(2))
            i += 1
            while i < n and lines[i].strip() != "::":
                body.append(lines[i])
                i += 1
            i += 1
            out.append(_render_callout(typ, "\n".join(body)))
            continue
        # tabla
        if s.startswith("|") and i + 1 < n and re.match(r"^\s*\|[\s:|-]+\|\s*$", lines[i + 1]) and "-" in lines[i + 1]:
            rows = []
            while i < n and lines[i].strip().startswith("|"):
                rows.append(lines[i].strip())
                i += 1
            out.append(_render_table(rows))
            continue
        # lista no ordenada (viñetas, con forma según el caracter: -, *, •)
        if _UL_RE.match(s):
            cls = {"*": " hx-ul-sq", "•": " hx-ul-disc"}.get(s[0], "")
            items = []
            while i < n and _UL_RE.match(lines[i].strip()):
                items.append(_UL_RE.sub("", lines[i].strip()))
                i += 1
            out.append(f'<ul class="hx-wu-list{cls}">' + "".join(f"<li>{render_inline(x)}</li>" for x in items) + "</ul>")
            continue
        # lista ordenada (1. / a. / i.)
        mo = _OL_RE.match(s)
        if mo:
            kind = _marker_kind(mo.group(1))
            items = []
            while i < n and _OL_RE.match(lines[i].strip()):
                items.append(_OL_RE.sub("", lines[i].strip()))
                i += 1
            out.append(f'<ol class="hx-wu-list hx-wu-ol" style="list-style-type:{kind}">'
                       + "".join(f"<li>{render_inline(x)}</li>" for x in items) + "</ol>")
            continue
        # párrafo
        para = []
        while i < n and lines[i].strip() and not _starts_block(lines[i]):
            para.append(lines[i].strip())
            i += 1
        out.append("<p>" + "<br>".join(render_inline(p) for p in para) + "</p>")
    return "".join(out)


_TBL_TXT = {"g": "#9fef00", "c": "#2ee6d6", "m": "#c16cff", "r": "#ff3e3e",
            "y": "#ffd60a", "o": "#ffaf00", "w": "#ffffff", "a": "#5eb4f8"}
_TBL_ALIGN = {"l": "left", "c": "center", "r": "right"}


def render_table_block(block_text: str) -> str:
    """Renderiza una tabla de diseño (bloque ```table con JSON)."""
    try:
        d = json.loads(block_text)
    except Exception:
        return '<p class="hx-tbl-err">Tabla con formato inválido.</p>'
    cells = d.get("cells") or []
    R = len(cells)
    C = len(cells[0]) if R else 0
    v = d.get("v") or []
    h = d.get("h") or []

    def sep(arr, i):
        s = arr[i] if 0 <= i < len(arr) else None
        if not s or not s.get("on"):
            return "0"
        color = s.get("color", "#243244")
        if color == "page":
            color = "rgb(var(--page, 159 239 0))"
        return f"{s.get('w', 1)}px solid {color}"

    rad = "12px" if d.get("corners", "round") == "round" else "0"
    rows_html = []
    for r in range(R):
        tds = []
        for c in range(C):
            cell = cells[r][c] or {}
            st = [
                f"border-top:{sep(h, r)}",
                f"border-left:{sep(v, c)}",
                f"text-align:{_TBL_ALIGN.get(cell.get('a', 'l'), 'left')}",
            ]
            if r == R - 1:
                st.append(f"border-bottom:{sep(h, R)}")
            if c == C - 1:
                st.append(f"border-right:{sep(v, C)}")
            if cell.get("b"):
                st.append("font-weight:700")
            if cell.get("c"):
                if cell["c"] == "p":
                    st.append("color:rgb(var(--page, 159 239 0))")
                else:
                    st.append(f"color:{_TBL_TXT.get(cell['c'], 'inherit')}")
            if cell.get("bg"):
                st.append(f"background:{cell['bg']}")
            tds.append(f'<td style="{";".join(st)}">{render_inline(cell.get("t", ""))}</td>')
        rows_html.append("<tr>" + "".join(tds) + "</tr>")
    return f'<table class="hx-tbl" style="border-radius:{rad}"><tbody>{"".join(rows_html)}</tbody></table>'


def render_img_block(block, counter=None) -> str:
    """Renderiza un bloque ```img.  Cada línea admite:

        ruta
        ruta | pie
        ruta | Etiqueta | pie

    La etiqueta por defecto es «Figura» y el número se autodetecta según cuántas
    figuras de esa misma etiqueta van por delante en el write-up. El pie sale en
    negrita y en gris, con el prefijo «Etiqueta N:». La imagen va centrada, con
    borde del color de la máquina, y al pulsarla se abre ampliada en un visor.
    """
    if counter is None:
        counter = {}
    figs = []
    for line in block:
        line = line.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split("|")]
        # Opciones al final (w=NNN / h=NNN / dim), si las hay
        opt_w = opt_h = None
        dim = False
        if len(parts) >= 2 and re.fullmatch(r"(?:\s*(?:w=\d+|h=\d+|dim)\s*)+", parts[-1] or ""):
            for tok in parts.pop().split():
                if tok == "dim":
                    dim = True
                elif tok.startswith("w="):
                    opt_w = tok[2:]
                elif tok.startswith("h="):
                    opt_h = tok[2:]
        src = parts[0] if parts else ""
        if len(parts) >= 3:
            label, cap = parts[1], " | ".join(parts[2:]).strip()
        elif len(parts) == 2:
            label, cap = "Figura", parts[1]
        else:
            label, cap = "Figura", ""

        # Tamaño: por defecto ancho fijo (CSS --fig-w); w/h lo sobreescriben y el
        # otro eje queda en automático para conservar la proporción.
        istyle = ""
        if opt_w:
            istyle = f' style="width:{opt_w}px;height:auto"'
        elif opt_h:
            istyle = f' style="height:{opt_h}px;width:auto"'

        fcls = "hx-fig" + (" hx-fig-dim" if dim else "")
        if src:
            alt = esc(cap) if cap else "Captura del write-up"
            media = ('<button type="button" class="hx-fig-zoom" aria-label="Ampliar imagen">'
                     f'<img src="{esc(src)}" alt="{alt}" loading="lazy" decoding="async"{istyle}></button>')
        else:
            # Hueco sin imagen (el editor le engancha el botón de carga)
            media = ('<div class="hx-fig-ph2" role="img" aria-label="Sin imagen">'
                     '<i class="fas fa-image" aria-hidden="true"></i><span>Sin imagen</span></div>')
        f = f'<figure class="{fcls}">{media}'
        if label:
            counter[label] = counter.get(label, 0) + 1
            num = counter[label]
            lbl = f'<span class="hx-fig-lbl">{esc(label)}&nbsp;{num}:</span>'
            body = f" {render_inline(cap)}" if cap else ""
            f += f'<figcaption class="hx-fig-cap">{lbl}{body}</figcaption>'
        elif cap:
            f += f'<figcaption class="hx-fig-cap">{render_inline(cap)}</figcaption>'
        f += "</figure>"
        figs.append(f)
    return "".join(figs)


def render_section(text: str, fig_counter=None) -> str:
    """Convierte el texto de una sección (marcado) en HTML.

    Bloques cercados:  ```term / ```out / ```in  (terminales),  ```table  (tabla
    de diseño con JSON)  y  ```img  (imágenes con lightbox). El resto es prosa
    (párrafos, listas, tablas Markdown, avisos).

    `fig_counter` lleva la numeración de figuras compartida entre secciones.
    """
    lines = text.split("\n")
    out = []
    buf = []
    i, n = 0, len(lines)

    def flush():
        if any(x.strip() for x in buf):
            out.append(render_prose("\n".join(buf)))
        buf.clear()

    while i < n:
        st = lines[i].strip()
        if st.startswith("```"):
            flush()
            lang = st[3:].strip().lower()
            j = i + 1
            block = []
            while j < n and lines[j].strip() != "```":
                block.append(lines[j])
                j += 1
            i = j + 1
            if lang == "table":
                out.append(render_table_block("\n".join(block)))
            elif lang in ("img", "imagen", "captura"):
                out.append(render_img_block(block, fig_counter))
            else:
                out.append(render_term(lang, block))
            continue
        buf.append(lines[i])
        i += 1
    flush()
    return "".join(out)


# ==========================================================================
#  Construcción del write-up (cuerpo + front matter)
# ==========================================================================
def _os_class(os_name: str) -> str:
    o = (os_name or "").lower()
    if "win" in o:
        return "win"
    if "lin" in o:
        return "lin"
    return "otros"


def _fmt_date(iso: str) -> str:
    """'2026-09-26' -> '26/09/2026'."""
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", iso or "")
    if not m:
        return iso or ""
    y, mo, d = m.groups()
    return f"{d}/{mo}/{y}"


def _reading_minutes(secs: dict) -> int:
    text = " ".join((secs or {}).values())
    text = re.sub(r"<[^>]+>", " ", text)          # quita etiquetas
    text = re.sub(r"```table\s*\{.*?\}\s*```", " ", text, flags=re.S)  # tablas JSON no cuentan
    words = len(re.findall(r"\S+", text))
    return max(1, round(words / 200))


def render_body(data: dict) -> str:
    name = (data.get("name") or "Máquina").strip()
    slug = slugify(name)
    ip = (data.get("ip") or DEFAULT_IP).strip()
    os_name = data.get("os") or ""
    diff = data.get("diff") or ""
    version = (data.get("version") or "").strip()
    osc = _os_class(os_name)
    img = data.get("img") or {}
    avatar = img.get("avatar") or data.get("thumb") or ""
    banner_img = img.get("banner") or data.get("banner") or ""
    proof = img.get("proof") or data.get("url") or data.get("proof") or ""
    secs = data.get("sections") or {}

    _acc = data.get("accent", "")
    _svars = []
    if _acc:
        _svars.append(f"--m:{_acc}")
    if data.get("img_w"):
        _svars.append(f"--fig-w:{int(data['img_w'])}px")
    _acc_style = f' style="{";".join(_svars)}"' if _svars else ""
    h = f'<div class="hx-wu" data-os="{osc}"{f" data-accent=\"{_acc}\"" if _acc else ""}{_acc_style}>'
    # Cabecera: avatar + nombre + autor, y botón de certificado a la derecha
    h += '<header class="hx-wu-head">'
    if avatar:
        h += f'<span class="hx-wu-img" style="background-image:url(\'{avatar}\')" role="img" aria-label="{esc(name)}"></span>'
    h += '<div class="hx-wu-headtext">'
    _ver = f' <span class="hx-wu-ver">{esc(version)}</span>' if version else ""
    h += f'<h1 class="hx-wu-title">{esc(name)}{_ver}</h1>'
    h += f'<p class="hx-wu-meta">Publicado por <b>{esc(AUTHOR)}</b></p>'
    # Fila: fechas (publicado / actualizado) a la izquierda, tiempo de lectura a la derecha
    pub = (data.get("date") or "")[:10]
    upd = (data.get("updated") or "")[:10]
    dates = f'<span class="hx-wu-date"><i class="fas fa-calendar-day" aria-hidden="true"></i> Publicado {_fmt_date(pub)}</span>'
    if upd and upd != pub:
        dates += f'<span class="hx-wu-date"><i class="fas fa-rotate" aria-hidden="true"></i> Actualizado {_fmt_date(upd)}</span>'
    try:
        read_min = int(data.get("read_min") or 3)
    except (TypeError, ValueError):
        read_min = 3
    h += (f'<div class="hx-wu-sub"><div class="hx-wu-dates">{dates}</div>'
          f'<span class="hx-wu-read"><i class="fas fa-clock" aria-hidden="true"></i> {read_min} min de lectura</span></div>')
    h += "</div>"
    h += "</header>"
    # Tabla ficha
    h += ('<table class="hx-wu-table"><thead><tr><th>Máquina</th><th>SO</th>'
          '<th>Dificultad</th><th>IP</th></tr></thead><tbody><tr>')
    h += f'<td class="wu-name">{esc(name)}{(" " + esc(version)) if version else ""}</td>'
    h += f'<td class="wu-os wu-os-{osc}">{esc(os_name)}</td>'
    h += f'<td><span class="hx-badge hx-diff-{diff.lower()}">{esc(diff)}</span></td>'
    h += f'<td class="wu-ip">{esc(ip)}</td></tr></tbody></table>'
    # Botón del certificado, debajo de la tabla
    if proof:
        h += (f'<button type="button" class="hx-wu-cert" data-cert="{esc(proof)}" '
              f'data-img="{esc(banner_img or avatar)}" data-name="{esc(name)}">'
              f'<i class="fas fa-certificate" aria-hidden="true"></i> Mostrar certificado</button>')
    # Aviso antes del terminal de hosts
    h += '<p class="hx-wu-note"><b><i>A tener en cuenta...</i></b></p>'
    # Terminal de hosts
    h += render_term("term", ["$ sudo nano /etc/hosts", f"{ip}   {slug}"])
    # Índice (solo secciones con contenido)
    present = [s for s in SECTIONS if (secs.get(s[0]) or "").strip()]
    if present:
        h += '<nav class="hx-wu-index">'
        for sid, nom, col in present:
            h += f'<a href="#{sid}" style="--c:{col}">{esc(nom)}</a>'
        h += "</nav>"
    # Secciones (numeración de figuras compartida entre todas)
    fig_counter = {}
    for sid, nom, col in present:
        h += f'<section class="hx-wu-sec" id="{sid}" style="--c:{col}"><h2>{esc(nom)}</h2>'
        h += render_section(secs[sid], fig_counter)
        h += "</section>"
    # Tarjeta de verificación
    accent = data.get("accent", "")
    _m = f' style="--m:{accent}"' if accent else ""
    if proof:
        h += (f'<a class="hx-wu-card" data-os="{osc}"{_m} href="{esc(proof)}" target="_blank" rel="noopener">'
              f'<span class="hx-wu-cardimg" style="background-image:url(\'{avatar}\')"></span>'
              f'<div><b>{esc(name)}</b><small>{esc(os_name)} · {esc(diff)}</small></div>'
              f'<span class="hx-wu-verify"><i class="fas fa-shield-halved"></i> Verificar</span></a>')
    h += "</div>"
    return h


def front_matter(data: dict) -> str:
    name = (data.get("name") or "Máquina").strip()
    date = (data.get("date") or datetime.now().strftime("%Y-%m-%d")).strip()
    tags = re.findall(r"#?[\wáéíóúñ-]+", (data.get("tags") or ""), re.IGNORECASE)
    tags = [t.lstrip("#").lower() for t in tags if t.strip("#")]
    img = data.get("img") or {}
    fm = {
        "layout": "post",
        "title": name,
        "date": date + " 18:00:00 +0200",
        "categories": ["Writeups", data.get("plat") or "HackTheBox"],
        "tags": tags,
        "machine": name,
        "platform": data.get("plat") or "HackTheBox",
        "os": data.get("os") or "",
        "difficulty": data.get("diff") or "",
        "thumb": img.get("avatar") or data.get("thumb") or "",
        "proof": img.get("proof") or data.get("url") or data.get("proof") or "",
        "banner": img.get("banner") or data.get("banner") or "",
        "description": data.get("desc") or "",
        "toc": False,
    }
    # Un write-up publicado siempre está "Resuelta" (el roadmap lo cruza por machine+platform).
    fm["status"] = "Resuelta"
    if data.get("updated"):
        fm["last_modified_at"] = data["updated"][:10] + " 18:00:00 +0200"
    if data.get("accent"):
        fm["accent"] = data["accent"]
    y = "---\n"
    for k, v in fm.items():
        if isinstance(v, list):
            y += f"{k}: [{', '.join('\"%s\"' % x for x in v)}]\n"
        elif isinstance(v, bool):
            y += f"{k}: {str(v).lower()}\n"
        elif v != "" and v is not None:
            y += f'{k}: "{str(v).replace(chr(34), chr(92) + chr(34))}"\n'
    y += "---\n"
    return y


def build_post(data: dict) -> str:
    return front_matter(data) + render_body(data) + "\n"


# ==========================================================================
#  Fuentes editables (JSON)
# ==========================================================================
def source_path(slug: str) -> Path:
    return SOURCES / f"{slug}.json"


def save_source(data: dict) -> Path:
    SOURCES.mkdir(parents=True, exist_ok=True)
    slug = slugify(data.get("name") or "")
    p = source_path(slug)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return p


def load_source(slug: str):
    p = source_path(slug)
    if p.is_file():
        return json.loads(p.read_text(encoding="utf-8"))
    return None


def post_files(slug: str, date: str = ""):
    """Devuelve los ficheros de _posts que correspondan a ese slug."""
    hits = []
    for f in POSTS.glob(f"*-{slug}.html"):
        hits.append(f)
    for f in POSTS.glob(f"*-{slug}.md"):
        hits.append(f)
    return hits


def publish(data: dict, mode: str = "add") -> str:
    slug = slugify(data.get("name") or "")
    today = datetime.now().strftime("%Y-%m-%d")
    # La fecha de publicado se calcula sola al crear; al editar se actualiza "actualizado".
    if mode == "add" and not (data.get("date") or "").strip():
        data["date"] = today
    if mode == "edit":
        data["updated"] = today
    date = (data.get("date") or today).strip()
    # Un write-up publicado siempre queda como "Resuelta".
    data["status"] = "Resuelta"
    # Borra cualquier versión previa del mismo slug (p. ej. un .md antiguo)
    for old in post_files(slug):
        old.unlink()
    POSTS.mkdir(exist_ok=True)
    path = POSTS / f"{date}-{slug}.html"
    path.write_text(build_post(data), encoding="utf-8")
    save_source(data)
    return str(path.relative_to(ROOT))


def git_publish(slug: str, name: str) -> dict:
    """Hace commit y push de los ficheros del write-up (post + JSON + imágenes).
    Devuelve {ok, pushed, msg}."""
    files = []
    for f in post_files(slug):
        files.append(str(f.relative_to(ROOT)))
    sj = source_path(slug)
    if sj.is_file():
        files.append(str(sj.relative_to(ROOT)))
    for suf in (".png", "-banner.png"):
        img = MACHINES_DIR / f"{slug}{suf}"
        if img.is_file():
            files.append(str(img.relative_to(ROOT)))
    if not files:
        return {"ok": False, "pushed": False, "msg": "No hay ficheros que subir."}

    def run(*args):
        return subprocess.run(args, cwd=str(ROOT), capture_output=True, text=True)

    try:
        run("git", "add", "--", *files)
        c = run("git", "commit", "-m", f"Write-up: {name}")
        combined = (c.stdout + c.stderr).lower()
        if c.returncode != 0 and "nothing to commit" not in combined:
            return {"ok": False, "pushed": False, "msg": (c.stderr or c.stdout).strip()}
        nothing = "nothing to commit" in combined
        p = run("git", "push")
        if p.returncode != 0:
            return {"ok": False, "pushed": False, "msg": (p.stderr or p.stdout).strip()}
        return {"ok": True, "pushed": not nothing,
                "msg": "Sin cambios que subir." if nothing else "Subido al blog."}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "pushed": False, "msg": str(e)}


def is_published(slug: str) -> bool:
    """¿Existe ya un post en el blog para este slug?"""
    return bool(post_files(slug))


def rename_machine(old_slug: str, new_name: str) -> dict:
    """Renombra una máquina: su JSON, sus imágenes y, si está publicada, su post.
    Devuelve {slug, name, published}."""
    old_slug = resolve_slug(old_slug)
    new_name = (new_name or "").strip()
    if not new_name:
        raise ValueError("El nuevo nombre está vacío.")
    new_slug = slugify(new_name)
    if not new_slug:
        raise ValueError("El nuevo nombre no es válido.")

    data = load_source(old_slug)
    if data is None:
        raise ValueError(f"No existe la fuente de '{old_slug}'.")

    # Solo cambia la capitalización/acentos (mismo slug): basta con actualizar el nombre.
    if new_slug == old_slug:
        data["name"] = new_name
        was_pub = is_published(old_slug)
        if was_pub:
            publish(data, "edit")
        else:
            save_source(data)
        return {"slug": new_slug, "name": new_name, "published": was_pub, "img": data.get("img")}

    # Slug distinto: no puede chocar con otra máquina existente.
    if load_source(new_slug) is not None or is_published(new_slug):
        raise ValueError(f"Ya existe una máquina con el nombre '{new_name}'.")

    was_pub = is_published(old_slug)

    # Renombra las imágenes <slug>.png y <slug>-banner.png si existen.
    img = data.get("img") or {}
    for key, suffix in (("avatar", ".png"), ("banner", "-banner.png")):
        old_img = MACHINES_DIR / f"{old_slug}{suffix}"
        new_img = MACHINES_DIR / f"{new_slug}{suffix}"
        if old_img.is_file():
            old_img.rename(new_img)
            img[key] = f"/assets/img/machines/{new_slug}{suffix}"
    if img:
        data["img"] = img
    data["name"] = new_name

    # Borra el post y el JSON antiguos, y recrea con el nuevo slug.
    for old in post_files(old_slug):
        old.unlink()
    old_json = source_path(old_slug)
    if old_json.is_file():
        old_json.unlink()

    if was_pub:
        publish(data, "edit")
    else:
        save_source(data)
    return {"slug": new_slug, "name": new_name, "published": was_pub, "img": data.get("img")}


# ==========================================================================
#  Imagen de la máquina (logro de HackTheBox)
# ==========================================================================
def fetch_machine_images(url: str, slug: str):
    from PIL import Image, ImageDraw

    html_ = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20).read().decode("utf-8", "ignore")
    m = re.search(r'og:image"\s+content="([^"]+)"', html_)
    if not m:
        raise RuntimeError("No se encontró la imagen (og:image) en esa URL.")
    banner_url = m.group(1)
    raw = urllib.request.urlopen(urllib.request.Request(banner_url, headers=UA), timeout=20).read()

    MACHINES_DIR.mkdir(parents=True, exist_ok=True)
    banner = Image.open(io.BytesIO(raw)).convert("RGBA")
    banner_path = MACHINES_DIR / f"{slug}-banner.png"
    banner.save(banner_path)

    w, h = banner.size
    sx, sy = w / 700.0, h / 360.0
    cx, cy, r = int(350 * sx), int(70 * sy), int(41 * min(sx, sy))
    crop = banner.crop((cx - r, cy - r, cx + r, cy + r)).resize((256, 256), Image.LANCZOS)
    mask = Image.new("L", (256, 256), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, 255, 255), fill=255)
    avatar = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    avatar.paste(crop, (0, 0), mask)
    avatar.save(MACHINES_DIR / f"{slug}.png")

    return {
        "avatar": f"/assets/img/machines/{slug}.png",
        "banner": f"/assets/img/machines/{slug}-banner.png",
        "proof": url,
    }


# ==========================================================================
#  Servidor HTTP del editor
# ==========================================================================
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
        if u.path == "/api/list":
            out = []
            for p in sorted(SOURCES.glob("*.json")):
                try:
                    d = json.loads(p.read_text(encoding="utf-8"))
                except Exception:  # noqa: BLE001
                    continue
                out.append({
                    "slug": p.stem, "name": d.get("name", p.stem), "os": d.get("os", ""),
                    "diff": d.get("diff", ""), "date": (d.get("date") or "")[:10],
                    "accent": d.get("accent", ""), "thumb": (d.get("img") or {}).get("avatar", ""),
                    "published": is_published(p.stem),
                })
            out.sort(key=lambda x: x["date"], reverse=True)
            self._send(200, out)
            return
        if u.path == "/api/load":
            q = urllib.parse.parse_qs(u.query)
            slug = resolve_slug((q.get("slug") or [""])[0])
            src = load_source(slug)
            if src is None:
                self._send(404, {"error": f"No hay fuente para '{slug}'."})
            else:
                self._send(200, src)
            return
        if u.path == "/api/exists":
            q = urllib.parse.parse_qs(u.query)
            name = (q.get("name") or [""])[0]
            slug = slugify(name)
            exists = bool(slug) and (load_source(slug) is not None or is_published(slug))
            self._send(200, {"slug": slug, "exists": exists, "published": is_published(slug)})
            return
        if u.path == "/api/published":
            q = urllib.parse.parse_qs(u.query)
            slug = resolve_slug((q.get("slug") or [""])[0])
            self._send(200, {"slug": slug, "published": is_published(slug)})
            return
        if u.path == "/api/image":
            q = urllib.parse.parse_qs(u.query)
            url = (q.get("url") or [""])[0]
            name = (q.get("name") or [""])[0]
            if not url or not name:
                self._send(400, {"error": "Faltan 'url' y 'name'."})
                return
            try:
                step(f"Trayendo la imagen de {_c(name, Col.BOLD)}…")
                res = fetch_machine_images(url, slugify(name))
                ok("Imagen descargada y recortada.")
                self._send(200, res)
            except Exception as e:  # noqa: BLE001
                err(f"No se pudo traer la imagen: {e}")
                self._send(500, {"error": str(e)})
            return
        self._send(404, {"error": "not found"})

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        n = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(n) or b"{}")
        if u.path == "/api/render":
            try:
                self._send(200, {"html": render_body(data)}, "application/json; charset=utf-8")
            except Exception as e:  # noqa: BLE001
                self._send(500, {"error": str(e)})
            return
        if u.path == "/api/save":
            # Guarda la fuente JSON (incluidas las notas) SIN regenerar el post del blog.
            if not (data.get("name") or "").strip():
                self._send(400, {"error": "Falta el nombre de la máquina."})
                return
            try:
                p = save_source(data)
                slug = slugify(data.get("name") or "")
                self._send(200, {"path": str(p.relative_to(ROOT)), "published": is_published(slug)})
            except Exception as e:  # noqa: BLE001
                err(f"Error al guardar el borrador: {e}")
                self._send(500, {"error": str(e)})
            return
        if u.path == "/api/upload-image":
            # Guarda una imagen subida desde el navegador en assets/img/writeups/<slug>/.
            try:
                slug = slugify(data.get("slug") or data.get("name") or "writeup")
                raw = (data.get("data") or "").strip()
                if raw.startswith("data:") and "," in raw:
                    raw = raw.split(",", 1)[1]
                content = base64.b64decode(raw)
                src_name = Path(data.get("filename") or "captura.png")
                ext = src_name.suffix.lower()
                if ext not in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"):
                    ext = ".png"
                base = slugify(src_name.stem) or "captura"
                dest_dir = ROOT / "assets" / "img" / "writeups" / slug
                dest_dir.mkdir(parents=True, exist_ok=True)
                dest = dest_dir / f"{base}{ext}"
                k = 2
                while dest.exists():
                    dest = dest_dir / f"{base}-{k}{ext}"
                    k += 1
                dest.write_bytes(content)
                rel = "/" + str(dest.relative_to(ROOT)).replace("\\", "/")
                ok(f"Imagen guardada: {_c(rel, Col.BOLD)}")
                self._send(200, {"path": rel})
            except Exception as e:  # noqa: BLE001
                err(f"No se pudo guardar la imagen: {e}")
                self._send(500, {"error": str(e)})
            return
        if u.path == "/api/rename":
            try:
                res = rename_machine(data.get("old_slug") or "", data.get("new_name") or "")
                ok(f"Máquina renombrada a {_c(res['name'], Col.BOLD)} ({res['slug']}).")
                self._send(200, res)
            except Exception as e:  # noqa: BLE001
                self._send(400, {"error": str(e)})
            return
        if u.path == "/api/shutdown":
            # Para el servidor del editor (se usa al publicar).
            self._send(200, {"ok": True})
            step("Editor cerrado tras publicar.")
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return
        if u.path == "/api/publish":
            mode = data.get("mode") or self.mode
            try:
                rel = publish(data, mode)
                name = (data.get("name") or "").strip()
                slug = slugify(name)
                ok(f"Write-up {'editado' if mode == 'edit' else 'publicado'}: {_c(rel, Col.BOLD)}")
                step("Subiendo al blog con git…")
                git = git_publish(slug, name)
                if git["ok"]:
                    ok(f"git: {git['msg']}")
                else:
                    err(f"git: {git['msg']}")
                self._send(200, {"path": rel, "git": git})
            except Exception as e:  # noqa: BLE001
                err(f"Error al publicar: {e}")
                self._send(500, {"error": str(e)})
            return
        self._send(404, {"error": "not found"})


def serve(mode, slug, port, no_open, name=""):
    Handler.mode = mode
    qs = {"mode": mode}
    if slug:
        qs["slug"] = slug
    if name:
        qs["name"] = name
    editor_url = f"http://localhost:{port}/editor.html?{urllib.parse.urlencode(qs)}"
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    step("Servidor en marcha: " + _c(editor_url, Col.CYAN))
    print(_c("    (Ctrl+C para parar)\n", Col.DIM))
    if not no_open:
        webbrowser.open(editor_url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print()
        step("Servidor parado.")


# ==========================================================================
#  Acciones de la CLI
# ==========================================================================
def cmd_add(args):
    banner()
    name = args.add if isinstance(args.add, str) else ""
    if name:
        slug = slugify(name)
        if load_source(slug) is not None or is_published(slug):
            err(f"Ya existe una máquina con el nombre '{name}'.")
            warn("Usa --edit para editarla, o elige otro nombre.")
            sys.exit(1)
        step("Modo " + _c("añadir", Col.BOLD) + f": nueva máquina {_c(name, Col.BOLD)}.")
        serve("add", "", args.port, args.no_open, name=name)
    else:
        step("Modo " + _c("añadir", Col.BOLD) + ": elige el nombre de la máquina en el editor.")
        serve("add", "", args.port, args.no_open)


def cmd_edit(args):
    banner()
    slug = resolve_slug(args.edit)
    if load_source(slug) is None:
        err(f"No existe la fuente editable de '{slug}' en {SOURCES.relative_to(ROOT)}/.")
        warn("Solo se pueden editar write-ups que tengan su fuente .json.")
        sys.exit(1)
    step("Modo " + _c("editar", Col.BOLD) + f": cargando el write-up de {_c(slug, Col.BOLD)}.")
    serve("edit", slug, args.port, args.no_open)


def cmd_remove(args):
    banner()
    slug = resolve_slug(args.remove)
    src = load_source(slug)
    name = (src or {}).get("name") or slug.capitalize()
    files = post_files(slug)
    if not files and src is None:
        err(f"No se encontró ningún write-up con el nombre '{slug}'.")
        sys.exit(1)

    step(f"Vas a borrar el write-up {_c(name, Col.BOLD)}.")
    for f in files:
        print(_c("      · ", Col.GREY) + str(f.relative_to(ROOT)))
    r = ask(f"¿Seguro que quieres borrar el WriteUp {_c(name, Col.BOLD)}? [Y/n] ").lower()
    if r not in ("", "y", "s", "yes", "si", "sí"):
        warn("Cancelado. No se ha borrado nada.")
        return
    conf = ask(f'Escribe "{_c(name, Col.BOLD)}" para confirmarlo: ')
    if slugify(conf) != slugify(name):
        err("El nombre no coincide. Cancelado, no se ha borrado nada.")
        return

    step("Borrando…")
    for f in files:
        f.unlink()
        print(_c("      - ", Col.RED) + str(f.relative_to(ROOT)))
    sp = source_path(slug)
    if sp.is_file():
        sp.unlink()
        print(_c("      - ", Col.RED) + str(sp.relative_to(ROOT)))
    for suf in (f"{slug}.png", f"{slug}-banner.png"):
        img = MACHINES_DIR / suf
        if img.is_file():
            img.unlink()
            print(_c("      - ", Col.RED) + str(img.relative_to(ROOT)))
    ok(f"Write-up {name} borrado del blog.")
    step("Haz " + _c("git add -A && git commit && git push", Col.CYAN) + " para reflejarlo en el blog.")


def main():
    p = argparse.ArgumentParser(
        prog="writeup",
        description="Editor y gestor de write-ups del blog.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    g = p.add_mutually_exclusive_group()
    g.add_argument("--add", nargs="?", const=True, default=None, metavar="NOMBRE",
                   help="Redactar un write-up nuevo (abre el editor). Opcional: nombre de la máquina.")
    g.add_argument("--edit", metavar="RUTA", help="Editar un write-up publicado (p. ej. /writeups/blue).")
    g.add_argument("--remove", metavar="RUTA", help="Borrar un write-up publicado (p. ej. /writeups/blue).")
    p.add_argument("-p", "--port", type=int, default=8099, help="Puerto del servidor (por defecto 8099).")
    p.add_argument("--no-open", action="store_true", help="No abrir el navegador automáticamente.")
    args = p.parse_args()

    if args.add:
        cmd_add(args)
    elif args.edit:
        cmd_edit(args)
    elif args.remove:
        cmd_remove(args)
    else:
        banner()
        warn("No has indicado ninguna acción.")
        print()
        print("  Usa una de estas:")
        print(_c("    python3 dev/submit-writeup/writeup.py --add", Col.GREEN) + "                 redactar uno nuevo")
        print(_c("    python3 dev/submit-writeup/writeup.py --edit /writeups/blue", Col.CYAN) + "   editar Blue")
        print(_c("    python3 dev/submit-writeup/writeup.py --remove /writeups/blue", Col.RED) + " borrar Blue")
        print()
        print(_c("    -h / --help", Col.DIM) + " para ver todas las opciones.")
        print()


if __name__ == "__main__":
    main()
