"""Convierte una imagen en arte ASCII para la portada.

Uso: python3 dev/tools/ascii.py <imagen> [columnas] > _includes/hx-ascii.txt
"""
import sys
from PIL import Image, ImageOps

RAMP = " .:-=+*#%@"

src = sys.argv[1]
cols = int(sys.argv[2]) if len(sys.argv) > 2 else 44
im = ImageOps.autocontrast(Image.open(src).convert("L"), cutoff=2)
rows = round(cols * im.height / im.width * 0.5)  # las celdas de texto son el doble de altas que anchas
im = im.resize((cols, rows), Image.LANCZOS)
px = im.load()
for y in range(rows):
    print("".join(RAMP[px[x, y] * (len(RAMP) - 1) // 255] for x in range(cols)).rstrip())
