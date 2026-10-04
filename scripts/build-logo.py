#!/usr/bin/env python3
"""
Build the SlushFund wordmark logo.

Pure dark-bg wordmark: "Slush" white, "Fund" Slush Red, on transparent.
Drawn with Helvetica Bold for the heavy, financial look.
"""

import os
from PIL import Image, ImageDraw, ImageFont

WHITE = (255, 255, 255)
RED = (230, 57, 70)        # #E63946 Slush Red
H_PAD = 40                 # horizontal padding in pixels (final @ 2x)

OUTPUT = os.path.join(os.path.dirname(__file__), '..', 'public')


def render_wordmark(size_px: int) -> Image.Image:
    """Render a transparent wordmark at the given pixel size."""
    # Use a 2x render then downsample for crispness
    factor = 2
    s = size_px * factor

    # The wordmark: "Slush" + space + "Fund"
    text = 'SlushFund'
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', s, index=1)  # Bold

    # Measure text
    dummy = Image.new('RGBA', (1, 1))
    dd = ImageDraw.Draw(dummy)
    bbox = dd.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    canvas_w = text_w + H_PAD * 2 * factor
    canvas_h = text_h + int(s * 0.4)  # vertical padding
    img = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # The "Slush" portion is the first 5 chars, "Fund" is the last 4.
    # We need to measure each separately so we can color them.
    slush_text = 'Slush'
    fund_text = 'Fund'

    # Measure Slush width
    sb = dd.textbbox((0, 0), slush_text, font=font)
    slush_w = sb[2] - sb[0]

    # Position the text
    x_start = H_PAD * factor + bbox[0]
    y_start = (canvas_h - text_h) // 2 - bbox[1]

    # Draw "Slush" in white
    d.text((x_start, y_start), slush_text, font=font, fill=WHITE)
    # Draw "Fund" in red, starting at the right edge of "Slush"
    d.text((x_start + slush_w, y_start), fund_text, font=font, fill=RED)

    # Downsample for crispness
    return img.resize((canvas_w // factor, canvas_h // factor), Image.LANCZOS)


def main() -> None:
    # 256 width (used in nav), 512 width (high-DPI)
    img_256 = render_wordmark(80)
    img_256.save(os.path.join(OUTPUT, 'slushfund-logo.png'), 'PNG', optimize=True)
    print(f'wrote public/slushfund-logo.png ({img_256.size})')

    img_512 = render_wordmark(160)
    img_512.save(os.path.join(OUTPUT, 'slushfund-logo@2x.png'), 'PNG', optimize=True)
    print(f'wrote public/slushfund-logo@2x.png ({img_512.size})')


if __name__ == '__main__':
    main()
