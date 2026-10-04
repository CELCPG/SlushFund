#!/usr/bin/env python3
"""
Build SlushFund favicons.

Generates a sharp, on-brand app icon for every size we need:
  - favicon-16.png   (browser tab)
  - favicon-32.png   (browser tab hi-dpi)
  - favicon-48.png   (Windows taskbar)
  - favicon-180.png  (Apple touch icon)
  - favicon-192.png  (Android / PWA)
  - favicon-512.png  (manifest / large)
  - favicon.ico      (multi-size: 16, 32, 48 embedded in one)

Design: dark slate squircle (#0a0a0f) with a Slush Red dollar sign
(#E63946) cut out of the middle. The $ is built from rectangles —
no font dependency, sharp at every size.
"""

import os
from PIL import Image, ImageDraw

SLATE = (10, 10, 15)         # #0a0a0f
RED = (230, 57, 70)          # #E63946

# Squircle corner radius as fraction of size (iOS-style ~22%)
RADIUS = 0.22

OUTPUT = os.path.join(os.path.dirname(__file__), '..', 'public')
os.makedirs(OUTPUT, exist_ok=True)


def round_mask(size: int) -> Image.Image:
    """Return a single-channel alpha mask with a rounded squircle cut out."""
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    r = int(size * RADIUS)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=255)
    return mask


def draw_dollar(d: ImageDraw.ImageDraw, size: int) -> None:
    """Draw a $ made of rectangles, centered, filling ~70% of the icon."""
    # Coordinates work in 'size' units; we'll scale to actual pixels.
    s = size
    # Bar widths as fractions of size
    BAR = int(s * 0.13)               # vertical bar width
    BOWL = int(s * 0.62)              # total width of the S-bowls
    H = int(s * 0.10)                 # horizontal bar thickness
    V_OVERHANG = int(s * 0.16)        # how much the bowls extend past the bar
    BAR_TALL = int(s * 0.88)          # bar height
    V_GAP = int(s * 0.04)             # gap between the two bowls

    cx = s // 2
    bar_left = cx - BAR // 2
    bar_right = cx + BAR // 2
    bar_top = (s - BAR_TALL) // 2
    bar_bottom = bar_top + BAR_TALL

    # The two horizontal "S" bars: each is H thick, with V_OVERHANG on
    # both sides of the vertical bar.
    top_bowl_top = bar_top
    top_bowl_bottom = top_bowl_top + H
    bot_bowl_top = bar_bottom - H
    bot_bowl_bottom = bar_bottom

    # Top bowl (rounded to the right only — left side is hidden by the bar)
    # Draw it as a rounded rectangle that extends past the bar on the right
    # and the left.
    # We'll draw the top bowl as: left bar of width BAR, right extension of
    # width (BOWL/2 - BAR/2).
    bowl_half = (BOWL - BAR) // 2

    # Top bowl: horizontal bar from cx - BOWL/2 to cx + BOWL/2
    d.rounded_rectangle(
        (cx - BOWL // 2, top_bowl_top, cx + BOWL // 2, top_bowl_bottom),
        radius=H // 2,
        fill=RED,
    )
    # Bottom bowl: same x-extent, near the bottom
    d.rounded_rectangle(
        (cx - BOWL // 2, bot_bowl_top, cx + BOWL // 2, bot_bowl_bottom),
        radius=H // 2,
        fill=RED,
    )
    # Vertical bar
    d.rectangle(
        (bar_left, bar_top, bar_right, bar_bottom),
        fill=RED,
    )
    # The two "tips" of the $ — small vertical bars poking past the top bowl
    # and the bottom bowl (so the vertical line extends the full bar length).
    # Already done by the central vertical bar covering bar_top..bar_bottom.
    # The bowls visually break the bar into three segments, which is the
    # classic $ look.


def render_icon(size: int) -> Image.Image:
    """Render the full icon (slate background + red $ + rounded corners)."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    # Background slate — full square
    bg = Image.new('RGBA', (size, size), SLATE + (255,))
    img.paste(bg, (0, 0), bg)

    # Draw the dollar on top
    d = ImageDraw.Draw(img)
    draw_dollar(d, size)

    # Apply squircle mask
    mask = round_mask(size)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main() -> None:
    sizes = [16, 32, 48, 64, 180, 192, 256, 512]
    for size in sizes:
        icon = render_icon(size)
        path = os.path.join(OUTPUT, f'favicon-{size}.png')
        icon.save(path, 'PNG', optimize=True)
        print(f'wrote {path} ({size}x{size})')

    # Multi-size .ico (16, 32, 48)
    base = render_icon(256)
    ico_path = os.path.join(OUTPUT, 'favicon.ico')
    base.save(
        ico_path,
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print(f'wrote {ico_path} (multi-size ICO)')

    # Apple touch icon (180x180, with no transparency — iOS applies its own corner)
    apple = Image.new('RGB', (180, 180), SLATE)
    ad = ImageDraw.Draw(apple)
    draw_dollar(ad, 180)
    apple_path = os.path.join(OUTPUT, 'apple-touch-icon.png')
    apple.save(apple_path, 'PNG', optimize=True)
    print(f'wrote {apple_path} (180x180 Apple touch icon)')


if __name__ == '__main__':
    main()
