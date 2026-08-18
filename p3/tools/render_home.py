#!/usr/bin/env python3
"""Render the home screen layout offline, from the same numbers as main.c.

This is a geometry proof, not a screenshot. It draws the same rectangles at the
same coordinates with the same font files rasterised mono at the same pixel
sizes, so it shows whether the layout fits, overlaps or clips. What it cannot
show is what the firmware does with those calls -- for that you need
capture-p3-screenshots.sh and a working emulator.

The one knowing deviation: main.c draws its small captions in the system Gothic
face, which is inside the firmware and not available here, so captions render
in the dot face instead. They are a couple of pixels narrower than reality.

Usage: render_home.py <out.png> [--needs N --run N --idle N --settled N]
"""
import sys

import freetype
from PIL import Image, ImageDraw

W, H = 200, 228
LEGEND_H, RAIL_H, PANEL_INSET, GLASS_PAD = 16, 2, 4, 8
TOP_CHROME = BOTTOM_CHROME = LEGEND_H + RAIL_H

CHASSIS = (0, 0, 0)
GLASS = (170, 170, 85)          # GColorBrass
GHOST = (255, 255, 170)         # GColorPastelYellow
INK = (0, 0, 0)
DIM = (85, 85, 85)              # GColorDarkGray
LEGEND = (85, 170, 255)         # GColorPictonBlue
RULE = (255, 0, 85)             # GColorFolly
ALERT = (170, 0, 0)             # GColorDarkCandyAppleRed
ACTIVE = (0, 0, 170)            # GColorDukeBlue

DOT10 = "resources/fonts/Dot6x10-1x.ttf"
DOT20 = "resources/fonts/Dot6x10-2x.ttf"
DSEG = "resources/fonts/DSEG7Classic-Bold.ttf"

_faces = {}


def face(path, px):
    key = (path, px)
    if key not in _faces:
        f = freetype.Face(path)
        f.set_pixel_sizes(0, px)
        _faces[key] = f
    return _faces[key]


def text_size(path, px, s):
    f = face(path, px)
    w = 0
    for ch in s:
        f.load_char(ch, freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_MONO)
        w += f.glyph.advance.x // 64
    return w, px


def draw_text(img, path, px, s, x, y_top, colour):
    """Draw with y_top as the layout box top, the way graphics_draw_text does."""
    f = face(path, px)
    ascent = f.size.ascender // 64
    pen = x
    for ch in s:
        f.load_char(ch, freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_MONO)
        g, b = f.glyph, f.glyph.bitmap
        for row in range(b.rows):
            for col in range(b.width):
                if (b.buffer[row * b.pitch + (col >> 3)] >> (7 - (col & 7))) & 1:
                    px_x, px_y = pen + g.bitmap_left + col, y_top + ascent - g.bitmap_top + row
                    if 0 <= px_x < W and 0 <= px_y < H:
                        img.putpixel((px_x, px_y), colour)
        pen += g.advance.x // 64
    return pen - x


def seg_value(img, x, y, value, colour, ghost, px=34):
    """The readout: "88" in the ghost tone, the live value lit on top of it."""
    block_w, _ = text_size(DSEG, px, "88")
    live = str(value)
    live_w, _ = text_size(DSEG, px, live)
    draw_text(img, DSEG, px, "88", x, y, ghost)
    draw_text(img, DSEG, px, live, x + block_w - live_w, y, colour)
    return block_w


def state_band(img, d, band, label, count, total, colour, alert):
    x, y, w, h = band
    ink = colour if count > 0 else DIM
    unlit = GHOST
    if alert:
        d.rounded_rectangle([x, y, x + w - 1, y + h - 1], 3, fill=INK)
        ink, unlit = GLASS, DIM
    else:
        d.rounded_rectangle([x, y, x + w - 1, y + h - 1], 2, outline=DIM)

    pad = 5
    block_h = 34
    block_w = seg_value(img, x + pad, y + (h - block_h) // 2, count, ink, unlit)

    text_x = x + pad + block_w + 8
    text_w = x + w - pad - text_x

    share = "%d/%d" % (count, total)
    share_w, _ = text_size(DOT10, 10, share)
    draw_text(img, DOT10, 10, share, x + w - pad - share_w, y + 7, ink)
    draw_text(img, DOT10, 10, label, text_x, y + 7, ink)

    cell, step = 5, 7
    cells = text_w // step
    lit = (count * cells) // total if total else 0
    if lit < 1 and count > 0:
        lit = 1
    for i in range(cells):
        c = ink if i < lit else unlit
        d.rectangle([text_x + i * step, y + 24, text_x + i * step + cell - 1, y + 30], fill=c)


def render(out, needs, run, idle, settled, title="WORKBENCH"):
    total = needs + run + idle + settled
    img = Image.new("RGB", (W, H), CHASSIS)
    d = ImageDraw.Draw(img)

    panel = (PANEL_INSET, TOP_CHROME, W - 2 * PANEL_INSET, H - TOP_CHROME - BOTTOM_CHROME)
    px_, py, pw, ph = panel
    d.rounded_rectangle([px_, py, px_ + pw - 1, py + ph - 1], 2, fill=GLASS, outline=DIM)

    # legend band + rails
    draw_text(img, DOT10, 10, "P3", GLASS_PAD, 3, LEGEND)
    rw, _ = text_size(DOT10, 10, "1/3")
    draw_text(img, DOT10, 10, "1/3", W - GLASS_PAD - rw, 3, LEGEND)
    d.rectangle([7, LEGEND_H, W - 8, LEGEND_H + RAIL_H - 1], fill=RULE)
    d.rectangle([7, H - BOTTOM_CHROME, W - 8, H - BOTTOM_CHROME + RAIL_H - 1], fill=RULE)
    draw_text(img, DOT10, 10, "HOST", GLASS_PAD, H - LEGEND_H + 1, LEGEND)
    ow, _ = text_size(DOT10, 10, "OPEN")
    draw_text(img, DOT10, 10, "OPEN", W - GLASS_PAD - ow, H - LEGEND_H + 1, LEGEND)

    inner_x, inner_w = px_ + 7, pw - 14
    strip_y = py + ph - 15

    draw_text(img, DOT20, 20, title, inner_x, py + 2, INK)
    draw_text(img, DOT10, 10, "%d THREADS   %d SETTLED" % (total, settled),
              inner_x, py + 21, INK)
    d.rectangle([inner_x, py + 36, inner_x + inner_w - 1, py + 36], fill=DIM)

    bands_top, gap = py + 40, 3
    band_h = (strip_y - 7 - bands_top - 2 * gap) // 3
    channels = [("NEEDS YOU", needs, ALERT, needs > 0),
                ("RUNNING", run, ACTIVE, False),
                ("IDLE", idle, INK, False)]
    for i, (label, count, colour, alert) in enumerate(channels):
        state_band(img, d, (inner_x, bands_top + i * (band_h + gap), inner_w, band_h),
                   label, count, total, colour, alert)

    # indicator row
    d.rectangle([inner_x, strip_y - 5, inner_x + inner_w - 1, strip_y - 5], fill=DIM)
    draw_text(img, DOT10, 10, "ACT", inner_x, strip_y - 4, INK)
    for i in range(6):
        lit = i < (6 * (total - settled) // total if total else 0)
        d.rectangle([inner_x + 24 + i * 5, strip_y + 2, inner_x + 26 + i * 5, strip_y + 8],
                    fill=INK if lit else DIM)
    draw_text(img, DOT10, 10, "SYN now", inner_x + 62, strip_y - 4, INK)
    for i in range(3):
        box = [inner_x + inner_w - 24 + i * 8, strip_y + 1,
               inner_x + inner_w - 20 + i * 8, strip_y + 5]
        d.rectangle(box, fill=INK if i == 0 else None, outline=INK)

    img.save(out)
    print("%s  panel %dx%d  band height %d  bands %d..%d"
          % (out, pw, ph, band_h, bands_top, bands_top + 3 * band_h + 2 * gap))


if __name__ == "__main__":
    args = sys.argv[1:]
    out = args[0] if args else "home.png"
    opts = dict(needs=2, run=1, idle=3, settled=8)
    for i, a in enumerate(args):
        if a.startswith("--") and i + 1 < len(args):
            opts[a[2:]] = int(args[i + 1])
    render(out, **opts)
