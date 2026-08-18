#!/usr/bin/env python3
"""Convert an X11 dot-matrix bitmap font (PCF/BDF) into a TTF that stays
pixel-exact on the Pebble Time 2.

Why a converter at all: Pebble's resource pipeline takes outline fonts, so a
bitmap face has to be wrapped in one. Done naively the outlines get re-hinted
and the strokes go soft — which is exactly what went wrong with Share Tech
Mono, where a single glyph ended up with 1, 2, 3 and 5 pixel stems.

The wrapping here is lossless by construction:

  * each glyph is read as its literal 1-bit bitmap, never re-rasterised
  * set pixels become axis-aligned rectangles on integer coordinates
  * units per em is cellHeight * scale * 64, so one pixel is exactly 64 units
  * asked for at cellHeight * scale px, the rasteriser has nothing to round

Scale must be a whole number. 5x7 is around 0.9mm tall on the Time 2's ~200ppi
panel, which is legible only for short tags, so 2x is the useful body size.
"""
import sys
import freetype
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

UPP = 64  # font units per pixel


def glyph_pixels(face, code, cell_h):
    """(rows, left, top, advance) with rows as literal 1-bit scanlines."""
    face.load_char(code, freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_MONO)
    g, b = face.glyph, face.glyph.bitmap
    rows = [[(b.buffer[y * b.pitch + (x >> 3)] >> (7 - (x & 7))) & 1
             for x in range(b.width)] for y in range(b.rows)]
    return rows, g.bitmap_left, g.bitmap_top, g.advance.x // 64


def ellipsis_pixels(cell_w, cell_h):
    """(rows, left, top, advance) for U+2026, which X11 6x10 does not carry.

    The app asks for GTextOverflowModeTrailingEllipsis nearly everywhere, and a
    Pebble font without U+2026 does not fall back — the firmware's layout never
    returns and the watch stops answering the protocol entirely. So the glyph is
    not decoration: it is what stops a long title from hanging the app.

    A 6px cell cannot hold three of the source font's periods, which are 3px
    plus-shapes. Three single pixels on the same row the period's body sits on
    is what a real dot-matrix panel does at this size, and it keeps a clear
    column before the next glyph.
    """
    row = [1 if x % 2 == 0 else 0 for x in range(min(5, cell_w - 1))]
    return [row], 0, 1, cell_w


# Codepoints the source bitmap font has no glyph for, drawn in its own idiom.
SYNTHETIC = {0x2026: ellipsis_pixels}


def rectangles(rows):
    """Set pixels as rectangles, merging vertically where a run repeats.

    Fewer contours keeps the font small; correctness does not depend on it.
    """
    spans = []
    for y, row in enumerate(rows):
        x = 0
        while x < len(row):
            if row[x]:
                x0 = x
                while x < len(row) and row[x]:
                    x += 1
                spans.append([y, x0, x, False])
            else:
                x += 1
    out = []
    for span in spans:
        if span[3]:
            continue
        span[3] = True
        y, x0, x1, _ = span
        h = 1
        while True:
            nxt = next((s for s in spans if not s[3] and s[0] == y + h
                        and s[1] == x0 and s[2] == x1), None)
            if not nxt:
                break
            nxt[3] = True
            h += 1
        out.append((x0, y, x1 - x0, h))
    return out


def convert(src, dst, scale, family, codes):
    face = freetype.Face(src)
    size = face.available_sizes[0]
    cell_w, cell_h = size.width, size.height
    face.set_pixel_sizes(0, cell_h)

    upem = cell_h * scale * UPP
    glyphs, advances, order, cmap = {}, {}, [".notdef"], {}
    glyphs[".notdef"] = TTGlyphPen(None).glyph()
    advances[".notdef"] = (cell_w * scale * UPP, 0)

    widths = set()
    lsbs = {}
    for code in codes:
        if face.get_char_index(code) == 0 and code != 32:
            if code not in SYNTHETIC:
                continue
            rows, left, top, adv = SYNTHETIC[code](cell_w, cell_h)
        else:
            rows, left, top, adv = glyph_pixels(face, code, cell_h)
        widths.add(adv)
        name = "uni%04X" % code
        pen = TTGlyphPen(None)
        xmin = None
        for (px, py, w, h) in rectangles(rows):
            # Scale whole pixels, then place relative to the baseline: bitmap
            # rows run downward from `top`, font y runs upward from 0.
            x0 = (left + px) * scale * UPP
            x1 = (left + px + w) * scale * UPP
            y1 = (top - py) * scale * UPP
            y0 = (top - py - h) * scale * UPP
            pen.moveTo((x0, y0))
            pen.lineTo((x0, y1))
            pen.lineTo((x1, y1))
            pen.lineTo((x1, y0))
            pen.closePath()
            xmin = x0 if xmin is None else min(xmin, x0)
        glyphs[name] = pen.glyph()
        # TrueType requires the left side bearing to equal the glyph's xMin.
        # Setting it to zero while xMin was non-zero made the rasteriser shift
        # the glyph left to reconcile them, which knocked every narrow glyph
        # (I, 1, colon, brackets) one pixel out of position.
        advances[name] = (adv * scale * UPP, xmin or 0)
        order.append(name)
        cmap[code] = name

    asc = int(face.size.ascender / 64) or (cell_h - 1)
    desc = int(face.size.descender / 64) or -1
    fb = FontBuilder(upem, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(advances)
    fb.setupHorizontalHeader(ascent=asc * scale * UPP, descent=desc * scale * UPP)
    fb.setupNameTable({"familyName": family, "styleName": "Regular",
                       "fullName": family, "psName": family.replace(" ", "")})
    fb.setupOS2(sTypoAscender=asc * scale * UPP, sTypoDescender=desc * scale * UPP,
                usWinAscent=asc * scale * UPP, usWinDescent=abs(desc) * scale * UPP)
    fb.setupPost()
    fb.save(dst)
    print(f"{dst}: {len(order)-1} glyphs from {cell_w}x{cell_h} at {scale}x "
          f"-> cell {cell_w*scale}x{cell_h*scale}, advance {sorted(widths)[0]*scale}px, "
          f"request at {cell_h*scale}px")
    return cell_h * scale


if __name__ == "__main__":
    src, dst, scale, family = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
    codes = list(range(32, 127)) + list(range(160, 256)) + [0x2026]  # ASCII + Latin-1 + ellipsis
    convert(src, dst, scale, family, codes)
