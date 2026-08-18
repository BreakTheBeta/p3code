#!/usr/bin/env python3
"""Pixel-exactness check for the segment face at the sizes the app asks for.

DSEG7 is an outline font, so unlike the dot-matrix face it is not pixel-exact
by construction -- it is only pixel-exact at sizes where its stems land on
whole pixels. At the wrong size the rasteriser rounds some stems to one pixel
and its neighbours to two, and a seven-segment digit with mixed stem weights
reads as broken rather than as styling. FONT_DSEG_20 was such a size: 12.5% of
its ink sat in one-pixel slivers.

A size passes when, across all ten digits:

  * no ink falls in a one-pixel run (no rounding slivers)
  * every segment body is the same weight
  * the advance is constant, so a two-digit readout stays on its column

Usage: verify_dseg.py <font.ttf> <px> [<px> ...]
"""
import sys
from collections import Counter

import freetype


def digit_runs(face, px, ch):
    """(sliver share, stem widths, advance, bitmap size) for one digit."""
    face.set_pixel_sizes(0, px)
    face.load_char(ch, freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_MONO)
    bitmap = face.glyph.bitmap
    grid = [[(bitmap.buffer[y * bitmap.pitch + (x >> 3)] >> (7 - (x & 7))) & 1
             for x in range(bitmap.width)] for y in range(bitmap.rows)]
    ink = sum(sum(row) for row in grid)
    # Runs are counted along the scanline, so a run length is a stem width.
    # Weight each length by its ink so the share is of pixels, not of runs.
    runs = Counter()
    for row in grid:
        run = 0
        for lit in row:
            if lit:
                run += 1
            elif run:
                runs[run] += run
                run = 0
        if run:
            runs[run] += run
    sliver = runs[1] / ink if ink else 1.0
    body = max(runs.items(), key=lambda kv: kv[1])[0] if runs else 0
    return sliver, body, face.glyph.advance.x // 64, (bitmap.width, bitmap.rows)


def check(path, px):
    face = freetype.Face(path)
    slivers, bodies, advances = [], set(), set()
    for ch in "0123456789":
        sliver, body, advance, _ = digit_runs(face, px, ch)
        slivers.append((ch, sliver))
        bodies.add(body)
        advances.add(advance)
    worst_ch, worst = max(slivers, key=lambda kv: kv[1])
    ok = worst == 0 and len(bodies) == 1 and len(advances) == 1
    print("%s @ %dpx: stem %s, advance %s, worst sliver %.2f%% (%s) -> %s"
          % (path.rsplit("/", 1)[-1], px, sorted(bodies), sorted(advances),
             worst * 100, worst_ch, "PIXEL EXACT" if ok else "RAGGED"))
    return ok


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__.strip().splitlines()[-1])
    font = sys.argv[1]
    sys.exit(0 if all([check(font, int(px)) for px in sys.argv[2:]]) else 1)
