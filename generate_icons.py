#!/usr/bin/env python3
"""
Genera todos los iconos PWA necesarios a partir del obr-logo.png existente.
Requiere Pillow: pip install Pillow

Uso: python3 generate_icons.py
Coloca obr-logo.png en la misma carpeta antes de ejecutar.
"""

import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Instala Pillow: pip install Pillow")
    sys.exit(1)

SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
OUT_DIR = "icons"
os.makedirs(OUT_DIR, exist_ok=True)

# Intentar usar logo existente
SOURCE = "obr-logo.png"
if not os.path.exists(SOURCE):
    print(f"No se encontró {SOURCE}, generando icono placeholder...")
    # Crear icono placeholder con OBR
    src = Image.new("RGBA", (512, 512), (0, 0, 0, 255))
    draw = ImageDraw.Draw(src)
    # Círculo rojo
    draw.ellipse([40, 40, 472, 472], fill=(180, 0, 0), outline=(255, 50, 50), width=8)
    # Texto OBR
    draw.text((180, 200), "OBR", fill=(255, 255, 255))
    draw.text((140, 270), "CAM", fill=(255, 80, 80))
else:
    src = Image.open(SOURCE).convert("RGBA")
    print(f"Usando {SOURCE} ({src.size})")

for size in SIZES:
    img = src.resize((size, size), Image.LANCZOS)
    out = os.path.join(OUT_DIR, f"icon-{size}.png")
    img.save(out, "PNG", optimize=True)
    print(f"  ✅ {out}")

# Screenshot placeholder (1280x720)
shot = Image.new("RGB", (1280, 720), (0, 0, 0))
draw = ImageDraw.Draw(shot)
draw.rectangle([0, 0, 1280, 720], fill=(10, 10, 20))
draw.text((500, 340), "OBR CAM PRO", fill=(255, 50, 50))
shot.save(os.path.join(OUT_DIR, "screenshot-wide.png"), "PNG")
print(f"  ✅ icons/screenshot-wide.png")

print("\n¡Iconos generados! Sube la carpeta 'icons/' a GitHub junto con manifest.json y sw.js")
