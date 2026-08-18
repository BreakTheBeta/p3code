#!/usr/bin/env python3
"""Round-trip proof for the dot-matrix conversion.

Compares the set of inked pixel positions in a common coordinate space —
x from the pen origin, y measured down from the baseline — rather than raw
bitmap arrays. Outline-derived bitmaps are tight-cropped while the source
includes blank rows, so a raw array compare reports differences that are not
there.
"""
import sys, freetype

src, dst, scale = sys.argv[1], sys.argv[2], int(sys.argv[3])
a = freetype.Face(src); cell_h = a.available_sizes[0].height
a.set_pixel_sizes(0, cell_h)
b = freetype.Face(dst); b.set_pixel_sizes(0, cell_h * scale)


def ink(face, code):
    """Inked pixels as {(x, y)} with x from the origin and y down from baseline."""
    face.load_char(code, freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_MONO)
    g, bm = face.glyph, face.glyph.bitmap
    out = set()
    for y in range(bm.rows):
        for x in range(bm.width):
            if (bm.buffer[y * bm.pitch + (x >> 3)] >> (7 - (x & 7))) & 1:
                out.add((g.bitmap_left + x, y - g.bitmap_top))
    return out, g.advance.x // 64


bad, ok, advs, stems = [], 0, set(), set()
for code in list(range(32, 127)) + list(range(160, 256)):
    if a.get_char_index(code) == 0 and code != 32:
        continue
    src_ink, src_adv = ink(a, code)
    got_ink, got_adv = ink(b, code)
    advs.add(got_adv)
    want = {(x * scale + dx, y * scale + dy)
            for (x, y) in src_ink for dx in range(scale) for dy in range(scale)}
    if got_ink == want and got_adv == src_adv * scale:
        ok += 1
    else:
        bad.append(chr(code) if 32 < code < 127 else "U+%04X" % code)
    rows = {}
    for (x, y) in got_ink:
        rows.setdefault(y, []).append(x)
    for xs in rows.values():
        xs.sort()
        run = 1
        for i in range(1, len(xs)):
            if xs[i] == xs[i - 1] + 1:
                run += 1
            else:
                stems.add(run); run = 1
        stems.add(run)

total = ok + len(bad)
print("%d/%d glyphs reproduce the source bitmap exactly at %dx" % (ok, total, scale))
if bad:
    print("  MISMATCH:", " ".join(bad[:40]))
print("advances :", sorted(advs), "->", "MONOSPACED" if len(advs) == 1 else "PROPORTIONAL")
print("stems    :", sorted(stems), "->",
      "all whole multiples of scale" if all(s % scale == 0 for s in stems) else "RAGGED")

# U+2026 has no source glyph to compare against, so it is checked for existence
# and shape instead. It is the one codepoint whose absence is not cosmetic: the
# app draws almost everything with GTextOverflowModeTrailingEllipsis, and a font
# missing this glyph hangs the firmware's text layout outright.
ell_ink, ell_adv = ink(b, 0x2026)
dots = sorted({x for (x, y) in ell_ink})
expected = sorted({x * scale + dx for x in (0, 2, 4) for dx in range(scale)})
print("ellipsis : U+2026", "present" if ell_ink else "MISSING",
      "advance", ell_adv, "dot columns", dots,
      "->", "OK" if dots == expected and ell_adv in advs else "UNEXPECTED")
if not ell_ink or dots != expected or ell_adv not in advs:
    sys.exit(1)
