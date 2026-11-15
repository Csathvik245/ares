"""Draw the browser tab icon: a white letter "A" on the app's dark background.

The icon is drawn by this script from plain shapes, so it is not AI-generated and is not
the mission patch. Colours are the Mono theme's: background --void (#0a0a0a), letter
white (--mars, #ffffff).

    python pipeline/make_favicon.py

Writes favicon.svg, favicon.png (64 x 64) and favicon.ico (16, 32, 48) into
app/public/ and site/public/.
"""
from pathlib import Path

from PIL import Image, ImageDraw

BACKGROUND = "#0a0a0a"
LETTER = "#ffffff"

# The letter "A" on a 64 x 64 grid: an outer triangle-like shape with flat feet,
# minus the inner triangle and the gap under the crossbar.
OUTER = [(26, 10), (38, 10), (56, 54), (45, 54), (41, 43), (23, 43), (19, 54), (8, 54)]
COUNTER = [(32, 21), (38, 35), (26, 35)]  # the hole above the crossbar


def draw(size: int) -> Image.Image:
    """The icon at `size` pixels, drawn 8 times larger and scaled down for smooth edges."""
    scale = 8 * size / 64
    big = Image.new("RGB", (8 * size, 8 * size), BACKGROUND)
    pen = ImageDraw.Draw(big)
    pen.polygon([(x * scale, y * scale) for x, y in OUTER], fill=LETTER)
    pen.polygon([(x * scale, y * scale) for x, y in COUNTER], fill=BACKGROUND)
    return big.resize((size, size), Image.LANCZOS)


def svg() -> str:
    points = lambda shape: " ".join(f"{x},{y}" for x, y in shape)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        f'<rect width="64" height="64" fill="{BACKGROUND}"/>'
        f'<polygon points="{points(OUTER)}" fill="{LETTER}"/>'
        f'<polygon points="{points(COUNTER)}" fill="{BACKGROUND}"/>'
        "</svg>\n"
    )


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    for folder in (root / "app" / "public", root / "site" / "public"):
        if not folder.is_dir():
            continue
        (folder / "favicon.svg").write_text(svg(), encoding="utf-8", newline="\n")
        draw(64).save(folder / "favicon.png", optimize=True)
        draw(48).save(folder / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
        print("wrote", folder / "favicon.svg", folder / "favicon.png", folder / "favicon.ico")


if __name__ == "__main__":
    main()
