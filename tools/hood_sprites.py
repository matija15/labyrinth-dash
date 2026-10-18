"""Builds the Red Hood player sprite sheet from the idle GIF (assets/skins/hood/source.gif).

The run, dash and air poses are made from the idle art with code: the upper body bobs and leans
forward, the boots are moved into stride poses, and the cloak trails back.
Usage: python3 tools/hood_sprites.py  (writes sheet.png, plus 8x preview GIFs with --preview)
"""

import sys
from pathlib import Path

from PIL import Image, ImageSequence

DIR = Path(__file__).resolve().parent.parent / "assets" / "skins" / "hood"
CELL_W, CELL_H = 40, 36
PAD = 4  # source x offset inside a cell, room for lean and trailing cloak
SRC_W, SRC_H = 32, 36
BOOT_ROWS = range(32, 36)
CLOAK = {(118, 22, 53), (201, 50, 60), (177, 36, 73), (228, 87, 66)}
BOOT = {(30, 21, 22), (72, 51, 51), (102, 80, 72)}

# Animation rows in the sheet, in order. Keep in sync with HOOD_SHEET in src/skins/art.ts.
ROWS = ["idle", "run", "dash", "air"]


def px(img):
    return {(x, y): img.getpixel((x, y)) for y in range(img.height) for x in range(img.width) if img.getpixel((x, y))[3]}


LEG_TOP = 29
SHADOW = (72, 51, 51, 255)


def split(frame):
    """Body pixels and the two legs (rows LEG_TOP+ that aren't cloak), relative to the source."""
    body, legs = {}, {"back": {}, "front": {}}
    for (x, y), c in frame.items():
        if y >= LEG_TOP and c[:3] not in CLOAK and 9 <= x <= 22:
            legs["back" if x < 16 else "front"][(x, y)] = c
            if y < 32:
                body[(x, y)] = SHADOW  # gap between the legs once they move
        else:
            body[(x, y)] = c
    return body, legs


def stride(leg, dx, dy):
    """Thighs move half as far as the boots, so the leg bends instead of sliding."""
    out = {}
    for (x, y), c in leg.items():
        k = 0.5 if y < 32 else 1
        out[(x + round(dx * k), y + round(dy * k) if y < 32 else y + dy)] = c
    return out


def compose(parts):
    img = Image.new("RGBA", (CELL_W, CELL_H))
    for layer, dx, dy in parts:
        for (x, y), c in layer.items():
            X, Y = x + dx + PAD, y + dy
            if 0 <= X < CELL_W and 0 <= Y < CELL_H:
                img.putpixel((X, Y), c)
    return img


def lean(body, head_dx, bob, trail=0, shear=0.0):
    """Shift the head forward, bob the body, and stretch the back of the cloak by up to `trail` px."""
    out = {}
    for (x, y), c in body.items():
        dx = round((28 - y) * shear) if shear else 0
        if y <= 12:
            dx += head_dx
        out[(x + dx, y + bob)] = c
    if trail:
        by_row = {}
        for (x, y), c in out.items():
            if c[:3] in CLOAK and 14 + bob <= y <= 31 + bob:
                by_row.setdefault(y, []).append(x)
        for y, xs in by_row.items():
            left = min(xs)
            mid = left + 7
            n = max(0, round(trail * (y - 13 - bob) / 18))  # the hem streams further than the shoulders
            if not n:
                continue
            w = mid - left + 1
            row = {x: out.pop((x, y)) for x in range(left, mid + 1) if (x, y) in out}
            for X in range(left - n, mid + 1):
                sx = left + (X - (left - n)) * w // (w + n)
                if sx in row:
                    out[(X, y)] = row[sx]
    return out


def build():
    src = Image.open(DIR / "source.gif")
    idle = [px(f.convert("RGBA")) for f in ImageSequence.Iterator(src)]
    body0, legs = split(idle[0])
    back, front = legs["back"], legs["front"]

    run_poses = [  # (back dx, dy), (front dx, dy), body bob, cloak trail
        ((-4, 0), (4, 0), 1, 2),
        ((-2, -1), (2, 0), 0, 3),
        ((1, -3), (0, 0), 0, 3),
        ((4, 0), (-4, 0), 1, 2),
        ((2, 0), (-2, -1), 0, 3),
        ((0, 0), (1, -3), 0, 3),
    ]
    run = [
        compose([(lean(body0, 1, bob, trail), 0, 0), (stride(back, bx, by), 0, bob), (stride(front, fx, fy), 0, bob)])
        for (bx, by), (fx, fy), bob, trail in run_poses
    ]
    dash = [
        compose([(lean(body0, 2, 1, trail, shear=0.12), 0, 0), (stride(back, -5, -2), 0, 1), (stride(front, 2, -3), 0, 1)])
        for trail in (6, 8, 7)
    ]
    air = [
        compose([(lean(body0, 1, 0, 2), 0, 0), (stride(back, -2, -2), 0, 0), (stride(front, 3, -2), 0, 0)]),  # rising
        compose([(lean(body0, 0, -1, 0), 0, 0), (stride(back, -1, 0), 0, 0), (stride(front, 1, 0), 0, 0)]),  # falling
    ]
    rows = {"idle": [compose([(f, 0, 0)]) for f in idle], "run": run, "dash": dash, "air": air}
    cols = max(len(r) for r in rows.values())
    sheet = Image.new("RGBA", (CELL_W * cols, CELL_H * len(ROWS)))
    for r, name in enumerate(ROWS):
        for i, f in enumerate(rows[name]):
            sheet.alpha_composite(f, (i * CELL_W, r * CELL_H))
    sheet.save(DIR / "sheet.png")
    print("sheet", sheet.size, {k: len(v) for k, v in rows.items()})
    return rows


def preview(rows, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    ms = {"idle": 100, "run": 70, "dash": 50, "air": 300}
    for name, frames in rows.items():
        big = []
        for f in frames:
            bg = Image.new("RGBA", f.size, (12, 16, 32, 255))
            bg.alpha_composite(f)
            big.append(bg.resize((f.width * 8, f.height * 8), Image.NEAREST).convert("P", palette=Image.ADAPTIVE))
        big[0].save(out_dir / f"hood-{name}.gif", save_all=True, append_images=big[1:], duration=ms[name], loop=0)
    strip = Image.new("RGBA", (CELL_W * 6 * 6, CELL_H * 6 * 4), (12, 16, 32, 255))
    for r, name in enumerate(ROWS):
        for i, f in enumerate(rows[name]):
            strip.alpha_composite(f.resize((CELL_W * 6, CELL_H * 6), Image.NEAREST), (i * CELL_W * 6, r * CELL_H * 6))
    strip.save(out_dir / "hood-sheet-6x.png")


if __name__ == "__main__":
    rows = build()
    if "--preview" in sys.argv:
        preview(rows, Path(sys.argv[sys.argv.index("--preview") + 1]))
