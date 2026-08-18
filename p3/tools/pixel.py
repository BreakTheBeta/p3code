#!/usr/bin/env python3
"""Pixel-level inspection of Pebble screenshots.

  zoom   crop a region and magnify it with nearest-neighbour so individual
         pixels are visible
  glyphs segment a text run into glyphs and report each one's box and stems

Nearest-neighbour matters: any smoothing would invent detail and hide exactly
the stem-weight problems this is meant to find.
"""
import struct, sys, zlib


def read_png(path):
    d = open(path, "rb").read()
    pos, w, h, idat, pal, depth, ctype = 8, 0, 0, b"", None, 8, 6
    while pos < len(d):
        ln = struct.unpack(">I", d[pos:pos + 4])[0]
        typ, data = d[pos + 4:pos + 8], d[pos + 8:pos + 8 + ln]
        if typ == b"IHDR":
            w, h, depth, ctype = struct.unpack(">IIBB", data[:10])
        elif typ == b"PLTE":
            pal = data
        elif typ == b"IDAT":
            idat += data
        pos += 12 + ln
    raw = zlib.decompress(idat)
    bpp = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ctype]
    stride = w * bpp if depth == 8 else (w * depth * bpp + 7) // 8
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i + stride]); i += stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else (b if pb <= pc else c))) & 255
        rows.append(bytes(line)); prev = line
    px = []
    for line in rows:
        row = []
        if ctype == 3:
            if depth == 8:
                idxs = list(line)
            else:
                idxs, per, mask = [], 8 // depth, (1 << depth) - 1
                for byte in line:
                    for k in range(per):
                        idxs.append((byte >> (8 - depth * (k + 1))) & mask)
                idxs = idxs[:w]
            row = [(pal[v * 3], pal[v * 3 + 1], pal[v * 3 + 2]) for v in idxs]
        else:
            row = [tuple(line[x * bpp:x * bpp + 3]) for x in range(w)]
        px.append(row)
    return w, h, px


def write_png(path, px):
    h, w = len(px), len(px[0])
    raw = b"".join(b"\x00" + bytes(v for p in row for v in p) for row in px)
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    open(path, "wb").write(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b""))


def zoom(src, dst, x0, y0, x1, y1, factor):
    _, _, px = read_png(src)
    out = []
    for y in range(y0, y1):
        row = []
        for x in range(x0, x1):
            row.extend([px[y][x]] * factor)
        for _ in range(factor):
            out.append(list(row))
    write_png(dst, out)
    print(f"{dst}: {(x1-x0)*factor}x{(y1-y0)*factor} ({factor}x of {x1-x0}x{y1-y0} at {x0},{y0})")


def glyphs(src, y0, y1, x0, x1):
    from collections import Counter
    _, _, px = read_png(src)
    region = [px[y][x] for y in range(y0, y1) for x in range(x0, x1)]
    bg = Counter(region).most_common(1)[0][0]
    ink = [[px[y][x] != bg for x in range(x0, x1)] for y in range(y0, y1)]
    cols = [any(ink[r][c] for r in range(len(ink))) for c in range(x1 - x0)]

    # Split on gaps of >=2 blank columns: a 1px gap is internal to a glyph
    # (the waist of an S, the bowl of a D), a 2px gap separates letters.
    runs, start, blank = [], None, 0
    for c, v in enumerate(cols):
        if v:
            if start is None: start = c
            blank = 0
        elif start is not None:
            blank += 1
            if blank >= 2:
                runs.append((start, c - blank)); start = None
    if start is not None: runs.append((start, len(cols) - 1))

    print(f"bg={bg}  glyphs={len(runs)}")
    print(f"{'#':>2} {'x':>4} {'w':>3} {'h':>3} {'top':>4} {'stems':>16}")
    for i, (a, b) in enumerate(runs):
        w = b - a + 1
        rowsy = [r for r in range(len(ink)) if any(ink[r][c] for c in range(a, b + 1))]
        top, hgt = (rowsy[0], rowsy[-1] - rowsy[0] + 1) if rowsy else (-1, 0)
        # Horizontal stem widths on the glyph's thickest row.
        widths = []
        for r in rowsy:
            run = mx = 0
            for c in range(a, b + 1):
                run = run + 1 if ink[r][c] else 0
                mx = max(mx, run)
            widths.append(mx)
        print(f"{i:>2} {x0+a:>4} {w:>3} {hgt:>3} {y0+top:>4} {str(sorted(set(widths))):>16}")
    if len(runs) > 1:
        adv = [runs[i + 1][0] - runs[i][0] for i in range(len(runs) - 1)]
        print("advances:", adv, "->", "UNIFORM" if len(set(adv)) == 1 else "VARIES")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "zoom":
        zoom(sys.argv[2], sys.argv[3], *[int(v) for v in sys.argv[4:9]])
    elif cmd == "glyphs":
        glyphs(sys.argv[2], *[int(v) for v in sys.argv[3:7]])
