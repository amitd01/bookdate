#!/usr/bin/env python3
"""Generates the app icon (1024², opaque — App Store requirement) and splash
mark: a cream open book with a burgundy heart rising from its pages.
Re-run after tweaking colours:  python3 scripts/make-icons.py  (needs Pillow)"""
import math
from PIL import Image, ImageDraw

BURGUNDY, CREAM, INK = (140, 28, 58), (251, 246, 238), (222, 206, 184)
S = 2048  # draw at 2x, downsample for smooth edges

def heart(d, cx, cy, size, fill):
    pts = []
    for i in range(360):
        t = math.radians(i)
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * size / 32, cy - y * size / 32))
    d.polygon(pts, fill=fill)

def mark(img, bg_is_burgundy):
    d = ImageDraw.Draw(img)
    page, spine = (CREAM, INK) if bg_is_burgundy else (BURGUNDY, (110, 20, 45))
    cx, top, bot, w = S / 2, S * 0.52, S * 0.78, S * 0.30
    # Two pages, gently curved at the top edge.
    for side in (-1, 1):
        edge = [(cx + side * w * t, top - S * 0.05 * math.sin(math.pi * t)) for t in [i / 40 for i in range(41)]]
        d.polygon([(cx, top)] + edge + [(cx + side * w, bot), (cx, bot + S * 0.03)], fill=page)
    d.line([(cx, top), (cx, bot + S * 0.03)], fill=spine, width=int(S * 0.012))
    # Page lines.
    for k in range(1, 5):
        y = top + (bot - top) * k / 5.5
        for side in (-1, 1):
            d.line([(cx + side * w * 0.15, y), (cx + side * w * 0.85, y - S * 0.01)], fill=spine, width=int(S * 0.008))
    heart(d, cx, S * 0.34, S * 0.30, (230, 70, 100) if bg_is_burgundy else BURGUNDY)

icon = Image.new('RGB', (S, S), BURGUNDY)
mark(icon, True)
icon.resize((1024, 1024), Image.LANCZOS).save('assets/images/icon.png')

splash = Image.new('RGBA', (S, S), (0, 0, 0, 0))
mark(splash, False)
splash.resize((1024, 1024), Image.LANCZOS).save('assets/images/splash-icon.png')
print('icons written')
