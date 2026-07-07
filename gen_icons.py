import struct, zlib, os

def make_png(path, size):
    ink = (0x11, 0x11, 0x11)
    paper = (0xF7, 0xF5, 0xF0)
    accent = (0xFF, 0xD2, 0x00)
    accent2 = (0xFF, 0x4B, 0x26)

    inset = int(size * 0.14)
    border = max(2, int(size * 0.035))
    dot_r = size * 0.135
    dot_cx = size - inset - dot_r * 0.6
    dot_cy = inset + dot_r * 0.6

    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            in_square = (inset <= x < size - inset) and (inset <= y < size - inset)
            on_border = in_square and (
                x < inset + border or x >= size - inset - border or
                y < inset + border or y >= size - inset - border
            )
            dx, dy = x - dot_cx, y - dot_cy
            in_dot = (dx * dx + dy * dy) <= dot_r * dot_r

            if in_dot:
                c = accent2
            elif on_border:
                c = ink
            elif in_square:
                c = accent
            else:
                c = ink
            row += bytes(c)
        rows.append(bytes([0]) + row)

    raw = b"".join(rows)
    compressed = zlib.compress(raw, 9)

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)

base = os.path.dirname(os.path.abspath(__file__))
make_png(os.path.join(base, "icons", "icon-192.png"), 192)
make_png(os.path.join(base, "icons", "icon-512.png"), 512)
make_png(os.path.join(base, "icons", "apple-touch-icon.png"), 180)
print("done")
