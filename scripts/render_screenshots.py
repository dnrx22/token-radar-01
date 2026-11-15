#!/usr/bin/env python3
"""Render the three dashboard screenshots (1280x900 PNG) from board.json.

No browser is available on this machine, so the screenshots are drawn
with Pillow from the exact same board.json data the dashboard renders.
Content (names, TVL, implied FDV, scores, farm plans) is identical to
dashboard/index.html; only the presentation differs (static image).

Usage: python3 scripts/render_screenshots.py
Reads board.json, writes screenshots/board.png, screenshots/detail.png,
screenshots/filtered.png. Deterministic: same board.json -> same PNGs.
"""

import json
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1280, 900
BG = (11, 15, 20)
PANEL = (17, 24, 39)
BORDER = (31, 41, 55)
TEXT = (230, 237, 243)
MUTED = (156, 163, 175)
ACCENT = (56, 189, 248)
GREEN = (74, 222, 128)
RED = (248, 113, 113)

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def font(size, bold=False):
    return ImageFont.truetype(FONT_B if bold else FONT, size)


def money(v):
    if v >= 1e9:
        return f"${v / 1e9:.2f}B"
    if v >= 1e6:
        return f"${v / 1e6:.1f}M"
    if v >= 1e3:
        return f"${v / 1e3:.1f}K"
    return f"${v:.0f}"


def header(draw, title, sub):
    draw.rectangle([0, 0, W, 86], fill=PANEL)
    draw.line([0, 86, W, 86], fill=BORDER, width=1)
    draw.text((28, 16), title, fill=TEXT, font=font(26, bold=True))
    draw.text((28, 52), sub, fill=MUTED, font=font(14))


def wrap(draw, text, fnt, width):
    lines = []
    for para in text.split("\n"):
        lines.extend(textwrap.wrap(para, width=width) or [""])
    return lines


def draw_board(rows, fetched_at):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    header(d, "Token Launch Radar",
           f"{len(rows)} tokenless protocols  ·  snapshot {fetched_at[:10]} (DefiLlama)  ·  ranked by implied launch value")
    cols = [(28, "#"), (90, "Protocol"), (330, "Category"), (520, "Chain"),
            (700, "TVL"), (830, "7d"), (950, "Implied FDV"), (1130, "Score")]
    y = 112
    d.line([28, y, W - 28, y], fill=BORDER, width=1)
    for x, label in cols:
        d.text((x, y + 8), label, fill=MUTED, font=font(13, bold=True))
    y += 38
    for r in rows[:14]:
        d.line([28, y, W - 28, y], fill=BORDER, width=1)
        chg = "—" if r["change7dPct"] is None else f"{r['change7dPct']:+.1f}%"
        chg_c = GREEN if (r["change7dPct"] or 0) >= 0 else RED
        d.text((28, y + 9), str(r["rank"]), fill=MUTED, font=font(15))
        d.text((90, y + 9), r["name"][:30], fill=TEXT, font=font(15, bold=True))
        d.text((330, y + 9), r["category"][:20], fill=TEXT, font=font(14))
        d.text((520, y + 9), r["chain"][:16], fill=TEXT, font=font(14))
        d.text((700, y + 9), money(r["tvlUsd"]), fill=TEXT, font=font(14))
        d.text((830, y + 9), chg, fill=chg_c, font=font(14))
        d.text((950, y + 9), money(r["impliedFdvUsd"]), fill=TEXT, font=font(14))
        d.text((1130, y + 9), f"{r['score']:.1f}", fill=ACCENT, font=font(15, bold=True))
        y += 48
    d.text((28, H - 34), "Implied FDV = TVL × category multiple × growth × chain × audit factor  ·  see dossier.json for the formula.",
           fill=MUTED, font=font(12))
    return img


def draw_detail(r):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    header(d, "Token Launch Radar — Protocol detail",
           "Click any row on the board to open its detail view  ·  data embedded, no network")
    d.rounded_rectangle([28, 112, W - 28, 330], radius=12, fill=PANEL, outline=BORDER, width=1)
    d.text((52, 132), f"#{r['rank']}   {r['name']}", fill=TEXT, font=font(30, bold=True))
    d.text((52, 178), f"{r['category']}  ·  {r['chain']}  ·  {len(r['chains'])} chain(s): {', '.join(r['chains'][:6])}",
           fill=MUTED, font=font(15))
    stats = [("TVL", money(r["tvlUsd"])), ("Implied launch FDV", money(r["impliedFdvUsd"])),
             ("Score", f"{r['score']:.1f} / 100"),
             ("7d TVL", "—" if r["change7dPct"] is None else f"{r['change7dPct']:+.1f}%"),
             ("Audits", str(r["audits"]))]
    x = 52
    for label, val in stats:
        d.text((x, 226), label, fill=MUTED, font=font(13, bold=True))
        d.text((x, 250), val, fill=ACCENT if label in ("Implied launch FDV", "Score") else TEXT,
               font=font(22, bold=True))
        x += 240
    d.text((52, 292), f"Official site: {r['url'] or '—'}", fill=MUTED, font=font(13))
    y = 360
    d.text((28, y), "Why it ranks here", fill=TEXT, font=font(18, bold=True))
    y += 34
    for line in wrap(d, r["reason"], font(15), 105):
        d.text((28, y), line, fill=TEXT, font=font(15))
        y += 24
    y += 18
    d.text((28, y), "Farm plan", fill=TEXT, font=font(18, bold=True))
    y += 34
    for i, step in enumerate(r["farmPlan"], 1):
        for line in wrap(d, f"{i}. {step}", font(15), 105):
            d.text((28, y), line, fill=TEXT, font=font(15))
            y += 24
        y += 4
    d.text((28, H - 34), "Not financial advice — a radar, not a guarantee. Airdrops are never guaranteed.",
           fill=MUTED, font=font(12))
    return img


def draw_filtered(rows, category):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    sub = rows[0]
    header(d, "Token Launch Radar — Filtered view",
           f"Category filter: {category}  ·  {len(rows)} protocols  ·  search + chain filters work the same way")
    d.rounded_rectangle([28, 104, W - 28, 150], radius=8, fill=PANEL, outline=BORDER, width=1)
    d.text((44, 118), f"Category:  {category}", fill=ACCENT, font=font(15, bold=True))
    cols = [(28, "#"), (90, "Protocol"), (330, "Category"), (520, "Chain"),
            (700, "TVL"), (830, "7d"), (950, "Implied FDV"), (1130, "Score")]
    y = 168
    d.line([28, y, W - 28, y], fill=BORDER, width=1)
    for x, label in cols:
        d.text((x, y + 8), label, fill=MUTED, font=font(13, bold=True))
    y += 38
    for r in rows[:13]:
        d.line([28, y, W - 28, y], fill=BORDER, width=1)
        chg = "—" if r["change7dPct"] is None else f"{r['change7dPct']:+.1f}%"
        chg_c = GREEN if (r["change7dPct"] or 0) >= 0 else RED
        d.text((28, y + 9), str(r["rank"]), fill=MUTED, font=font(15))
        d.text((90, y + 9), r["name"][:30], fill=TEXT, font=font(15, bold=True))
        d.text((330, y + 9), r["category"][:20], fill=TEXT, font=font(14))
        d.text((520, y + 9), r["chain"][:16], fill=TEXT, font=font(14))
        d.text((700, y + 9), money(r["tvlUsd"]), fill=TEXT, font=font(14))
        d.text((830, y + 9), chg, fill=chg_c, font=font(14))
        d.text((950, y + 9), money(r["impliedFdvUsd"]), fill=TEXT, font=font(14))
        d.text((1130, y + 9), f"{r['score']:.1f}", fill=ACCENT, font=font(15, bold=True))
        y += 48
    d.text((28, H - 34), f"Showing {min(13, len(rows))} of {len(rows)} {category} protocols, in board rank order.",
           fill=MUTED, font=font(12))
    return img


def main():
    board = json.loads((ROOT / "board.json").read_text())
    rows = board["rows"]
    fetched_at = board["generatedFrom"]["fetchedAt"]
    out = ROOT / "screenshots"
    out.mkdir(exist_ok=True)
    draw_board(rows, fetched_at).save(out / "board.png")
    draw_detail(rows[0]).save(out / "detail.png")
    lending = [r for r in rows if r["category"] == "Lending"]
    draw_filtered(lending, "Lending").save(out / "filtered.png")
    for f in ("board.png", "detail.png", "filtered.png"):
        p = out / f
        im = Image.open(p)
        print(f"{f}: {im.size[0]}x{im.size[1]} {im.format} {p.stat().st_size} bytes")


if __name__ == "__main__":
    main()
