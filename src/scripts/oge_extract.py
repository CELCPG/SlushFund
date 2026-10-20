"""R10: read transaction rows from OGE 278-T / 278e (Part 7) PDFs.

Methods (step 3 compares them on hand-checked pilot pages):
  textlayer  the PDF's own text layer (Adobe Paper Capture OCR on these scans), parsed by regex
  gemma      local vision: Gemma 4 26B-A4B on the B65 via workspace scripts/local-llm.mjs,
             one request at a time, on horizontal strips of the page image

Every page result is cached as JSON under <cache>/<unid>/p<NNN>.<method>.json, so a re-run
continues where it stopped. Gemma refuses while Colin is gaming (local-llm.mjs checks); this
script also runs the gaming check before each page and stops with exit 3.

    python src/scripts/oge_extract.py compare --cache-dir %TEMP%\\slush-r10\\oge --truth <pilot-truth.json> --out <dir>
    python src/scripts/oge_extract.py extract --cache-dir ... --unid <UNID> --pages 2-3 --method gemma
"""
from __future__ import annotations

import argparse
import csv
import difflib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

LOCAL_LLM = r"C:\Users\clong\.openclaw\workspace\scripts\local-llm.mjs"
NOWIN = getattr(subprocess, "CREATE_NO_WINDOW", 0)  # no console flashes when run by the scheduled task
GAMING = os.environ.get("SLUSHFUND_GAMING_CHECK", r"C:\Users\clong\.openclaw\workspace\scripts\gaming-mode.mjs")

BAND_RE = r"(?:Over\s*\$[\d,]+|\$[\d,.]+\s*[-–~\"]+\s*\$?[\d,.]+)"
DATE_TOKEN = r"\S{3,10}"


# ---------- normalisation shared by every method ----------
def norm_type(t: str | None) -> str | None:
    if not t:
        return None
    s = t.lower().strip()
    if "rch" in s or s.startswith(("purch", "ourch", "oun")):
        return "purchase"
    if s.startswith(("sal", "sa1", "s ale")) or s in ("sold", "salo"):
        return "sale"
    if "exch" in s:
        return "exchange"
    return s


def norm_date(d: str | None) -> str | None:
    """M/D/YYYY (or YY) as printed -> ISO; None when the text is not a valid date."""
    if not d:
        return None
    m = re.fullmatch(r"\s*(\d{1,2})/(\d{1,2})/(\d{2}|\d{4})\s*", d)
    if not m:
        return None
    mo, dy, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if yr < 100:
        yr += 2000
    if not (1 <= mo <= 12 and 1 <= dy <= 31):
        return None
    return f"{yr:04d}-{mo:02d}-{dy:02d}"


def norm_band(b: str | None) -> str | None:
    if not b:
        return None
    s = b.replace("–", "-").replace('"', "").replace("~", "-")
    s = re.sub(r"\s+", "", s)
    m = re.fullmatch(r"Over\$?([\d,]+)", s, re.I)
    if m:
        return f"Over ${m.group(1)}"
    m = re.fullmatch(r"\$?([\d,.]+)-+\$?([\d,.]+)", s)
    if not m:
        return None
    lo, hi = (x.replace(".", ",") for x in m.groups())
    return f"${lo} - ${hi}"


# OGE value bands (5 C.F.R. 2634.301 / Form 278 instructions); "Over $1,000,000" is the spouse / dependent-child band.
BANDS = [(1001, 15000), (15001, 50000), (50001, 100000), (100001, 250000), (250001, 500000),
         (500001, 1000000), (1000001, 5000000), (5000001, 25000000), (25000001, 50000000)]
BAND_TEXT = {f"${lo:,} - ${hi:,}": (lo, hi) for lo, hi in BANDS}
BAND_TEXT["Over $50,000,000"] = (50000001, None)
BAND_TEXT["Over $1,000,000"] = (1000001, None)


def official_band(b: str | None) -> str | None:
    """The band in its canonical text when it is one of the official OGE bands, else None: a reading such as
    "$1,000,00000000" or "$15,001 - $50,001" is unreadable, never rounded to the nearest band."""
    n = norm_band(b)
    return n if n in BAND_TEXT else None


def norm_desc(s: str | None) -> str:
    s = (s or "").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", s).strip().upper()


# ---------- page images ----------
def render(pdf_path: Path, page_no: int, cache: Path, dpi: int = 200) -> Path:
    out = cache / f"p{page_no:03d}.{dpi}.png"
    if not out.exists():
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(str(pdf_path))
        pdf[page_no - 1].render(scale=dpi / 72).to_pil().save(out)
    return out


def strips(png: Path, n: int, top: float = 0.0, bottom: float = 1.0, overlap: float = 0.03) -> list[Path]:
    from PIL import Image
    img = Image.open(png)
    w, h = img.size
    span = (bottom - top) / n
    outs = []
    for i in range(n):
        a = max(0.0, top + i * span - overlap)
        b = min(1.0, top + (i + 1) * span + overlap)
        p = png.with_name(f"{png.stem}.s{n}-{i + 1}.png")
        if not p.exists():
            img.crop((0, int(a * h), w, int(b * h))).save(p)
        outs.append(p)
    return outs


# ---------- method 1: text layer ----------
LINE_RE = re.compile(
    rf"^(?:(?P<n>\d{{1,3}})\s+)?(?P<desc>.+?)\s+(?P<type>[A-Za-z:,.]{{3,10}})\s+(?P<date>{DATE_TOKEN})\s+"
    rf"(?:(?P<over30>Yes|No|Y|N|Ves|N0)\s+)?(?P<band>{BAND_RE})\s*$")


def textlayer_rows(pdf_path: Path, page_no: int) -> list[dict]:
    import pdfplumber
    with pdfplumber.open(str(pdf_path)) as pdf:
        t = pdf.pages[page_no - 1].extract_text() or ""
    rows = []
    for line in t.splitlines():
        m = LINE_RE.match(line.strip())
        if not m:
            continue
        rows.append({"n": int(m["n"]) if m["n"] else None, "description": m["desc"].strip(),
                     "type": m["type"], "date": m["date"], "over30": m["over30"], "amount": m["band"]})
    return rows


# ---------- method 2: Gemma vision ----------
GEMMA_PROMPT = (
    "This image is part of a table from a U.S. OGE financial disclosure form (Periodic Transaction Report "
    "or Part 7 Transactions). Transcribe EVERY filled-in table row visible in the image, top to bottom. "
    "Copy text exactly as printed (keep abbreviations, punctuation, %, @, B/E etc.; do not expand or correct). "
    "Skip the header row, blank rows and any row cut off at the image's top or bottom edge. "
    'Return JSON: {"rows":[{"n":<row number printed in the # column or null>,"description":"...",'
    '"type":"purchase|sale|exchange|other as printed","date":"date exactly as printed",'
    '"over30":"Yes|No|null (the Notification Received Over 30 Days Ago column, if present)",'
    '"amount":"amount range exactly as printed"}]}'
)


def gaming_active() -> bool:
    r = subprocess.run(["node", GAMING, "check"], capture_output=True, text=True, creationflags=NOWIN)
    return r.returncode == 3


# ---- the Gemma call (R10c): one request at a time to the B65's llama-server, streamed so a runaway is cut off ----
GEMMA_URL = os.environ.get("SLUSHFUND_GEMMA_URL", "http://127.0.0.1:8084")
GEMMA_MODEL = "gemma-4-26b-a4b"
GEMMA_SYSTEM = ("You are a careful assistant doing bulk reading for another agent. Be terse and factual. "
                "Use only the provided material; if something is not in it, say 'not stated'. "
                "Never invent names, numbers, dates or URLs.")  # same system prompt as local-llm.mjs
GEMMA_USAGE_LOG = Path(r"C:\Users\clong\.openclaw\local-models\usage-dash\data\gemma-clients.jsonl")
ROW_TOKENS, TOKEN_MARGIN = 120, 200  # a JSON row is 50-110 tokens; a runaway fills the whole cap, so the cap is tight


class GemmaServerError(RuntimeError):
    """The server did not answer (down, loading, HTTP 5xx, timeout). Not the page's fault: never counts against a page."""


def token_cap(rows: int) -> int:
    return ROW_TOKENS * max(1, rows) + TOKEN_MARGIN


def runaway(text: str) -> str | None:
    """Why a (partial) reply is a degenerate repetition, else None: 8+ identical digits in a row ("$1,000,00000000..."),
    the same 20 characters 3 times in a row, or 16+ of the same non-space character."""
    if re.search(r"(\d)\1{7,}", text):
        return "digit run"
    if re.search(r"([^\s\d])\1{15,}", text):
        return "char run"
    t = text[-60:]
    if len(t) == 60 and t[:20] == t[20:40] == t[40:]:
        return "repeated chunk"
    return None


def gemma_health() -> str:
    """'ok' | 'loading' (HTTP 503 while the model loads) | 'down' (no answer). GET /health, no inference."""
    import urllib.error
    import urllib.request
    try:
        with urllib.request.urlopen(GEMMA_URL + "/health", timeout=5) as r:
            return "ok" if json.loads(r.read().decode("utf-8")).get("status") == "ok" else "loading"
    except urllib.error.HTTPError as e:
        return "loading" if e.code == 503 else "down"
    except Exception:  # noqa: BLE001
        return "down"


def wait_gemma(max_wait: float = 300.0, poll: float = 10.0) -> bool:
    """True once the server answers /health ok; waits while it is loading or briefly unreachable, False after max_wait."""
    t0 = time.time()
    while True:
        if gemma_health() == "ok":
            return True
        if time.time() - t0 >= max_wait:
            return False
        time.sleep(poll)


def _log_gemma_usage(started: float, out_chunks: int) -> None:
    try:
        with open(GEMMA_USAGE_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps({"t": int(time.time() * 1000), "client": "slushfund-oge", "in": None, "out": out_chunks,
                                "wall_ms": int((time.time() - started) * 1000), "img": True}) + "\n")
    except Exception:  # noqa: BLE001
        pass


def gemma_image(png: Path, max_tokens: int = 6000, rows: int | None = None) -> tuple[list[dict], float, str]:
    """One Gemma request on an image: {"rows": [...]} JSON out. Returns (rows, seconds, note). A CONTENT failure returns
    ([], secs, note) with note starting 'runaway', 'truncated' or 'bad json' (the caller falls back to a smaller crop);
    a SERVER failure raises GemmaServerError; gaming exits 3. The reply is streamed and cut off the moment it turns into
    a repetition, and capped at token_cap(rows) tokens when the number of rows is known."""
    import base64
    import urllib.error
    import urllib.request
    if gaming_active():
        print("gaming mode active: stopping GPU work", file=sys.stderr)
        sys.exit(3)
    cap = token_cap(rows) if rows else max_tokens
    body = {"model": GEMMA_MODEL, "stream": True, "max_tokens": cap, "temperature": 0.1,
            "reasoning_effort": "none", "chat_template_kwargs": {"enable_thinking": False},
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": GEMMA_SYSTEM},
                         {"role": "user", "content": [
                             {"type": "text", "text": GEMMA_PROMPT},
                             {"type": "image_url", "image_url": {"url": "data:image/png;base64,"
                                                                 + base64.b64encode(Path(png).read_bytes()).decode()}}]}]}
    req = urllib.request.Request(GEMMA_URL + "/v1/chat/completions", data=json.dumps(body).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    t0 = time.time()
    text, chunks, finish, why = "", 0, None, None
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            for raw in resp:
                line = raw.decode("utf-8", "replace").strip()
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                if payload == "[DONE]":
                    break
                ev = json.loads(payload)
                ch = (ev.get("choices") or [{}])[0]
                text += (ch.get("delta") or {}).get("content") or ""
                finish = ch.get("finish_reason") or finish
                chunks += 1
                why = runaway(text)
                if why:  # leaving the with-block closes the connection: llama-server stops generating
                    break
                if time.time() - t0 > 600:
                    raise GemmaServerError("no end of reply after 600 s")
    except urllib.error.HTTPError as e:
        raise GemmaServerError(f"gemma returned HTTP {e.code}: {e.read()[:200].decode('utf-8', 'replace')}") from e
    except (urllib.error.URLError, OSError, TimeoutError) as e:
        raise GemmaServerError(f"gemma server not reachable at {GEMMA_URL}: {e}") from e
    dt = time.time() - t0
    _log_gemma_usage(t0, chunks)
    if why:
        return [], dt, f"runaway ({why}) after {chunks} chunks: {text[-60:]!r}"
    if finish == "length":
        return [], dt, f"truncated at max_tokens={cap}: {text[-60:]!r}"
    try:
        out = re.sub(r"<think>[\s\S]*?</think>\s*", "", text).strip()
        out = re.sub(r"^```(?:json)?\s*|\s*```$", "", out)
        d = json.loads(out)
        got = d.get("rows", d if isinstance(d, list) else []) if isinstance(d, (dict, list)) else []
    except Exception as e:  # noqa: BLE001
        return [], dt, f"bad json: {e}: {text[-60:]!r}"
    return got, dt, f"ok {chunks} chunks"


def row_bands(png: Path, legacy: bool = False) -> list[dict]:
    """Table rows of a page image: [{y0, y1, ink}] top to bottom, filled rows only, the page header dropped.

    Four detectors are tried and the one whose bands are the most regular (most bands within 25% of the median
    height) wins: the printed row numbers (works on every form with a # column, blank rows print none), black heavy
    rules across the page, thin or skewed grey rules, and underlines that only span the description column. A detector
    that merges rows or mistakes text lines for rules produces uneven bands and loses."""
    cands = [row_bands_numbers(png)]
    for thr, frac, x0, x1 in ((140, 0.45, 0.15, 0.85), (180, 0.25, 0.15, 0.85), (180, 0.5, 0.10, 0.55)):
        cands.append(_trim_empty(_drop_header(png, _row_bands(png, thr, frac, x0, x1))))
    best, best_score, best_i = [], 0, -1
    for i, b in enumerate(cands):
        score = _regular(b)
        if score > best_score:
            best, best_score, best_i = b, score, i
    if best_i > 0 and not legacy:  # a rule detector took the header of a non-yellow scan for rows (10.20.2025, 2.26.2026)
        best = _drop_tall_header(best)
    if not legacy:
        best = extend_bottom(best, [c for i, c in enumerate(cands) if i != best_i])
    return best


def extend_bottom(best: list[dict], others: list[list[dict]]) -> list[dict]:
    """R10d: the strict rule detector can miss the table's faint bottom rule and so lose the last row (08.12.2026 p12,
    #363). A band another detector found right below the winner's last band, of normal row height and with clear ink
    (>= 0.02), is appended (repeated while one is found)."""
    if len(best) < 3:
        return best
    hs = sorted(x["y1"] - x["y0"] for x in best)
    med = hs[len(hs) // 2]
    out = list(best)
    while True:
        end = out[-1]["y1"]
        nxt = [b for c in others for b in c
               if end - 6 <= b["y0"] <= end + 6 and abs((b["y1"] - b["y0"]) - med) <= 0.25 * med and b["ink"] >= 0.02]
        if not nxt:
            return out
        b = min(nxt, key=lambda x: x["y0"])
        out.append({"y0": max(b["y0"], end), "y1": b["y1"], "ink": b["ink"]})


def _drop_tall_header(bands: list[dict]) -> list[dict]:
    """The column-title row is much taller than a table row and sits below at least two title bars: drop everything
    down to it. `legacy` pages (read before this existed) keep their old bands so their cached re-reads still map."""
    if len(bands) < 8:
        return bands
    hs = [x["y1"] - x["y0"] for x in bands]
    later = sorted(hs[6:])
    med = later[len(later) // 2]
    k = max((i for i in range(2, 6) if hs[i] >= 1.8 * med), default=-1)
    return bands[k + 1:] if k >= 0 else bands


def page_bands(png: Path, g: dict) -> list[dict]:
    """The bands a cached page reading was made with (stored in the cache since R10b-3), else the legacy detector."""
    return g["bands"] if "bands" in g else row_bands(png, legacy=True)


def _regular(bands: list[dict]) -> int:
    if len(bands) < 3:
        return 0
    hs = sorted(x["y1"] - x["y0"] for x in bands)
    m = hs[len(hs) // 2]
    if not 22 <= m <= 90:
        return 0
    return sum(1 for x in bands if abs((x["y1"] - x["y0"]) - m) <= 0.25 * m)


def row_bands_numbers(png: Path) -> list[dict]:
    """Table rows found from the printed row numbers: every filled row prints its # in the first column, an empty row
    prints nothing, so the digits mark exactly the filled rows whatever the form's rules look like (black grid, thin
    grey lines, faint underlines). [{y0, y1, ink}] top to bottom, [] when fewer than 3 numbers are found.
    The yellow header (top bars and column titles) bounds the table from above; the # column lies between two
    neighbouring vertical rules (tried at three darkness levels, since scans skew and fade the rules); horizontal
    rules are masked; digit blobs = rows; each cut between two rows goes through the emptiest pixel row near the
    midpoint of the two numbers."""
    from PIL import Image
    im = Image.open(png).convert("RGB")
    w, h = im.size
    top = im.crop((int(w * 0.15), 0, int(w * 0.85), int(h * 0.5))).resize((1, int(h * 0.5)), Image.BOX)
    head = -1
    for y, (r, g_, b) in enumerate(top.getdata()):
        if (r + g_) / 2 - b > 20:
            head = y
    if head < 0:
        return []
    g = im.convert("L")
    y0 = head + 4  # R10d: +8 cut into the first row's # on the black-ruled form (# printed right under the header)
    y1 = int(h * 0.975)
    dark = g.crop((0, y0, w, y1)).point(lambda v: 255 if v < 170 else 0)
    colfrac = [v / 255 for v in dark.resize((w, 1), Image.BOX).getdata()]
    full_ink = [v / 255 for v in dark.resize((1, y1 - y0), Image.BOX).getdata()]
    for level in (0.5, 0.35, 0.25):
        rules, x = [], 0
        while x < int(w * 0.40):
            if colfrac[x] > level:
                x2 = x
                while x2 + 1 < w and colfrac[x2 + 1] > level:
                    x2 += 1
                if x2 - x <= 10 and x > int(w * 0.04):
                    rules.append((x, x2))
                x = x2 + 1
            else:
                x += 1
        for (_, ra), (rb, _) in zip(rules, rules[1:]):
            xa, xb = ra + 3, rb - 3
            if not 20 <= xb - xa <= int(w * 0.2):
                continue
            bands = _bands_from_numbers(dark, full_ink, xa, xb, y0, y1)
            if bands:
                return bands
    return []


def _bands_from_numbers(dark, full_ink: list[float], xa: int, xb: int, y0: int, y1: int) -> list[dict]:
    from PIL import Image
    col = dark.crop((xa, 0, xb, y1 - y0))
    rowfrac = [v / 255 for v in col.resize((1, y1 - y0), Image.BOX).getdata()]
    ink = [0.0 if f > 0.7 else f for f in rowfrac]  # horizontal rules masked
    blobs, y = [], 0
    while y < len(ink):
        if ink[y] > 0.004:
            e, gap = y, 0
            while e + 1 < len(ink) and gap <= 5:
                e += 1
                gap = 0 if ink[e] > 0.004 else gap + 1
            e -= gap
            if 8 <= e - y + 1 <= 40:
                blobs.append((y, e))
            y = e + 1
        else:
            y += 1
    if len(blobs) < 3:
        return []
    centers = [(a + b) / 2 for a, b in blobs]
    pitch = sorted(c2 - c1 for c1, c2 in zip(centers, centers[1:]))[len(centers) // 2]
    if not 22 <= pitch <= 90:
        return []

    def cut(c1: float, c2: float) -> int:
        mid = (c1 + c2) / 2
        lo, hi = max(0, int(mid - 0.25 * pitch)), min(len(full_ink) - 1, int(mid + 0.25 * pitch))
        return min(range(lo, hi + 1), key=lambda i: (full_ink[i], abs(i - mid)))

    edges = snap_to_rules(rowfrac, blobs, pitch)
    if edges is None:
        cuts = [cut(c1, c2) for c1, c2 in zip(centers, centers[1:])]
        first = max(0, int(centers[0] - pitch * 0.6))
        last = min(len(full_ink) - 1, int(centers[-1] + pitch * 0.5))
        edges = [first] + cuts + [last]
    return [{"y0": y0 + a, "y1": y0 + b, "ink": 0.05} for a, b in zip(edges, edges[1:])]


def snap_to_rules(rowfrac: list[float], blobs: list[tuple[int, int]], pitch: float) -> list[int] | None:
    """R10d: row edges on the printed horizontal rules of the # column (a rule = pixel row inked across most of the
    column, > 50%). The top of row i is the last rule above its number (within 0.8 pitch; the first row may start at the top
    of the scan area instead); the bottom of the last row is the first rule below its number (within 1.3 pitch).
    Needed on the black-ruled two-line form (08.12.2025), which prints the # at the TOP of a two-line cell: a cut
    halfway between two numbers there puts each description in the band of the next row's #, so every # read one
    too high and the page's last description was cut off. None when the column has no usable rules (the yellow form's
    faint grey lines): the caller then cuts halfway between the numbers, which is right for one-line rows.
    A second blob in the same ruled cell is not a row (a skewed table border inside the # column made a phantom row on
    08.12.2025 p7) and is dropped."""
    rules = [y for y, f in enumerate(rowfrac) if f > 0.5]  # faded rules measure 0.59-0.64 (08.12.2025 p7)
    edges, last_c = [], None
    for i, (a, b) in enumerate(blobs):
        c = (a + b) / 2  # a digit blob can start on the (masked) rule itself, so the rule is looked for above its centre
        above = [y for y in rules if c - 0.8 * pitch <= y < c]
        if above:
            e = max(above)
        elif i == 0 and c < 0.8 * pitch:
            e = 0
        else:
            return None
        if edges and e == edges[-1]:
            continue
        edges.append(e)
        last_c = c
    below = [y for y in rules if last_c < y <= last_c + 1.3 * pitch]
    if not below:
        return None
    edges.append(min(below))
    if any(b - a < 0.5 * pitch for a, b in zip(edges, edges[1:])):
        return None
    return edges


def _trim_empty(bands: list[dict]) -> list[dict]:
    """Keep the table's filled rows: everything down to the last band with clear ink (>= 0.02), plus following bands
    that still carry ink >= 0.010 (faint print). Ink is measured on the middle slice of the band: filled rows measure
    >= 0.0157 (4.20.2026, the faintest) and empty rows <= 0.0016 (the table's bottom border band 0.008)."""
    last = -1
    for i, b in enumerate(bands):
        if b["ink"] >= 0.02:
            last = i
    while last + 1 < len(bands) and bands[last + 1]["ink"] >= 0.010:
        last += 1
    return bands[:last + 1]


MAX_ROW_PX = 110  # 200 DPI; a taller band is two or more rows merged by a missed rule


def _drop_header(png: Path, bands: list[dict]) -> list[dict]:
    from PIL import Image
    im = Image.open(png).convert("RGB")
    w = im.size[0]
    last = -1
    for i, b in enumerate(bands[:8]):
        c = im.crop((int(w * 0.15), b["y0"], int(w * 0.85), b["y1"])).resize((1, 1), Image.BOX).getpixel((0, 0))
        if (c[0] + c[1]) / 2 - c[2] > 20:  # yellow fill
            last = i
    return bands[last + 1:]


def _row_bands(png: Path, thr: int, min_frac: float, x0: float = 0.15, x1: float = 0.85) -> list[dict]:
    from PIL import Image  # PIL only (the shared venv has no numpy): box-resize = mean
    g = Image.open(png).convert("L")
    w, h = g.size
    dark = g.point(lambda v: 255 if v < thr else 0)
    frac = [v / 255 for v in dark.crop((int(w * x0), 0, int(w * x1), h)).resize((1, h), Image.BOX).getdata()]
    lines = []
    for y, f in enumerate(frac):  # group consecutive pixel rows into one rule
        if f <= min_frac:
            continue
        if lines and y - lines[-1][1] <= 3:
            lines[-1][1] = y
        else:
            lines.append([y, y])
    bands = []
    for (a0, a1), (b0, b1) in zip(lines, lines[1:]):
        y0, y1 = a1 + 1, b0
        if y1 - y0 < 12:
            continue
        trim = int((y1 - y0) * 0.22)  # middle slice only: tilted rules leak into the band's top and bottom edges
        band = dark.crop((0, y0 + trim, w, y1 - trim))
        cols = list(band.resize((w, 1), Image.BOX).getdata())
        keep = [c for c in cols if c <= 0.7 * 255]  # drop vertical rules crossing the band
        ink = sum(keep) / 255 / len(keep) if keep else 0.0
        bands.append({"y0": int(a0), "y1": int(b1), "ink": round(ink, 4)})
    return bands


ROW_KEYS = {"n", "description", "type", "date", "over30", "amount"}
ROW_DPI = 300  # single-row re-read and the first high-resolution fallback
LAST_DPI = 400  # the last fallback for a single row (the automatic verifier reads at 400 too)
CONTENT_FAIL = ("runaway", "truncated", "bad json")  # gemma_image notes of a reply that cannot be used (not a server fault)


def valid_row(r) -> bool:
    """A strip reading that looks like a table row: only the asked-for keys (a glitched reply invents keys such as
    "$1,001 - $15,000 Rob},{"), a description, a parseable date and one of the OFFICIAL bands (official_band)."""
    return (isinstance(r, dict) and set(r) <= ROW_KEYS and len((r.get("description") or "").strip()) >= 2
            and norm_date(r.get("date")) is not None and official_band(r.get("amount")) is not None)


def odd_row(r) -> bool:
    """A single-row reading that fails valid_row only because the printed date is not M/D/YYYY: the printed text is
    kept (the date is flagged unreadable later). An amount that is not an official band is never kept."""
    return (isinstance(r, dict) and set(r) <= ROW_KEYS and len((r.get("description") or "").strip()) >= 2
            and official_band(r.get("amount")) is not None)


def _crop(img, png: Path, bands: list[dict], tag: str) -> Path:
    p = png.with_name(f"{png.stem}.{tag}.png")  # always rewritten: a crop left by an older band detection must not be reused
    img.crop((0, max(0, bands[0]["y0"] - 4), img.size[0], min(img.size[1], bands[-1]["y1"] + 4))).save(p)
    return p


def _read_group(img, png: Path, bands: list[dict], first: int, tag: str, notes: list, flags: list) -> tuple[list[dict], float]:
    """Read the rows of `bands` (page row indexes first..first+len-1). ONE request for the whole crop, capped at
    token_cap(len(bands)) and cut off on repetition; the reply must hold one valid row per band. On any failure the
    crop is read as 2-row crops, and a 2-row crop as 1-row crops (200 DPI, then 300, then 400). A band that no crop can
    read gets no row and is flagged 'unreadable' (printed # range filled in by unreadable_runs): never a guess.
    Rows carry band_idx."""
    p = _crop(img, png, bands, tag)
    rows, secs, note = gemma_image(p, rows=len(bands))
    ok = len(rows) == len(bands) and all(valid_row(r) for r in rows)
    notes.append({"strip": p.name, "filled_bands": len(bands), "rows_returned": len(rows), "attempt": 1, "ok": ok,
                  "llm": note[:200]})
    if ok:
        for j, r in enumerate(rows):
            r["band_idx"] = first + j
        return rows, secs
    if not rows and not note.startswith(CONTENT_FAIL) and all(b["ink"] < 0.03 for b in bands):
        flags.append({"band_idx": first, "flag": f"blank_strip_{len(bands)}"})  # blank-looking strip, nothing read
        return [], secs
    if len(bands) == 1:
        return _read_row_hi(png, bands[0], first, tag, notes, flags, secs)
    step = 1 if len(bands) == 2 else 2
    out: list[dict] = []
    for k in range(0, len(bands), step):
        r, s = _read_group(img, png, bands[k:k + step], first + k, f"{tag}{'s' if step == 1 else 'p'}{k // step + 1}", notes, flags)
        out.extend(r)
        secs += s
    return out, secs


def _read_row_hi(png: Path, band: dict, idx: int, tag: str, notes: list, flags: list, secs: float) -> tuple[list[dict], float]:
    """One band the 200 DPI crop could not give: single-row crops at 300 then 400 DPI. The first valid reading wins; a
    reading whose only fault is the printed date is kept as 'odd_row'; otherwise the band is 'unreadable'."""
    odd = None
    for dpi in (ROW_DPI, LAST_DPI):
        row, dt, note = gemma_row_uncached(png, band, f"{tag}.d{dpi}", dpi=dpi)
        secs += dt
        ok = valid_row(row)
        notes.append({"strip": f"{png.stem}.{tag}.d{dpi}.png", "filled_bands": 1, "rows_returned": 1 if row else 0,
                      "attempt": 1, "ok": ok, "llm": note[:200]})
        if ok:
            row["band_idx"] = idx
            flags.append({"band_idx": idx, "flag": f"read_at_{dpi}dpi"})
            return [row], secs
        if odd is None and odd_row(row):
            odd = row
    if odd is not None:
        odd["band_idx"] = idx
        flags.append({"band_idx": idx, "flag": "odd_row"})
        return [odd], secs
    flags.append({"band_idx": idx, "flag": "unreadable"})
    return [], secs


def gemma_row_uncached(png: Path, band: dict, tag: str, dpi_from: int = 200, dpi: int = ROW_DPI) -> tuple[dict | None, float, str]:
    """One single-row crop at `dpi`: (the row or None, seconds, note). A content failure gives (None, secs, note)."""
    from PIL import Image
    full = png.with_name(png.name.replace(f".{dpi_from}.png", f".{dpi}.png"))
    if not full.exists():
        import pypdfium2 as pdfium  # re-render from the PDF named by the cache layout: <cache>/../pdf/<unid>.pdf
        unid = png.parent.name
        page_no = int(png.name[1:4])
        pdfium.PdfDocument(str(png.parent.parent / "pdf" / f"{unid}.pdf"))[page_no - 1].render(scale=dpi / 72).to_pil().save(full)
    k = dpi / dpi_from
    img = Image.open(full)
    crop = png.with_name(f"{png.stem}.{tag}.png")
    img.crop((0, max(0, int((band["y0"] - 4) * k)), img.size[0], min(img.size[1], int((band["y1"] + 4) * k)))).save(crop)
    rows, dt, note = gemma_image(crop, rows=1)
    return (rows[0] if rows and isinstance(rows[0], dict) else None), dt, note


def _printed_n(r: dict) -> int | None:
    try:
        return int(str(r.get("n")).strip(". "))
    except (TypeError, ValueError):
        return None


def unreadable_runs(rows: list[dict], n_bands: int) -> list[dict]:
    """The band runs of a page with no row, each with its printed # range taken from the neighbouring rows: [{bands:
    [first, last], count, n_from, n_to}] (n_from/n_to None when no neighbour on the page carries a number)."""
    got = {r["band_idx"]: _printed_n(r) for r in rows if "band_idx" in r}
    missing = [i for i in range(n_bands) if i not in got]
    runs: list[list[int]] = []
    for i in missing:
        if runs and i == runs[-1][1] + 1:
            runs[-1][1] = i
        else:
            runs.append([i, i])
    out = []
    for a, b in runs:
        cnt = b - a + 1
        prev = next((got[i] for i in range(a - 1, -1, -1) if got.get(i) is not None), None)
        nxt = next((got[i] for i in range(b + 1, n_bands) if got.get(i) is not None), None)
        lo = prev + 1 if prev is not None else (nxt - cnt if nxt is not None else None)
        hi = nxt - 1 if nxt is not None else (lo + cnt - 1 if lo is not None else None)
        out.append({"bands": [a, b], "count": cnt, "n_from": lo, "n_to": hi})
    return out


def gemma_page(pdf_path: Path, page_no: int, cache: Path, rows_per_strip: int, dpi: int = 200) -> dict:
    """Gemma on non-overlapping strips cut on the table's own rules, rows_per_strip filled rows each.
    rows_per_strip=0 sends the whole page in one request. A band (or a whole page) that no fallback can read is
    recorded in res["unreadable"] with its printed # range and the page is still cached: the run goes on."""
    f = cache / f"p{page_no:03d}.gemma-r{rows_per_strip}-d{dpi}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    if gaming_active():
        print("gaming mode active: stopping GPU work", file=sys.stderr)
        sys.exit(3)
    from PIL import Image
    png = render(pdf_path, page_no, cache, dpi)
    bands = row_bands(png)
    img = Image.open(png)
    rows, secs, notes, flags, unreadable = [], 0.0, [], [], []
    if rows_per_strip <= 0 or not bands:  # rules not found: whole page
        r, dt, note = gemma_image(png)
        secs += dt
        bad = note.startswith(CONTENT_FAIL)
        notes.append({"strip": png.name, "filled_bands": None, "rows_returned": len(r), "ok": not bad, "llm": note[:200]})
        if bad:
            flags.append({"band_idx": 0, "flag": "unreadable_page"})
            unreadable.append({"bands": None, "count": len(bands) or None, "n_from": None, "n_to": None, "page": True})
            r = []
        rows.extend(r)
    else:
        for i in range(0, len(bands), rows_per_strip):
            grp = bands[i:i + rows_per_strip]
            r, dt = _read_group(img, png, grp, i, f"r{rows_per_strip}-{i // rows_per_strip + 1}", notes, flags)
            secs += dt
            rows.extend(r)
        unreadable = unreadable_runs(rows, len(bands))
    for i, r in enumerate(rows, 1):  # line_on_page = position among the rows read, top to bottom
        r["line_on_page"] = i
    res = {"rows": rows, "seconds": round(secs, 1), "rows_per_strip": rows_per_strip, "dpi": dpi,
           "filled_bands": len(bands), "bands": bands, "notes": notes, "flags": flags, "unreadable": unreadable}
    f.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    return res


def row_band(g: dict, row: dict) -> int | None:
    """Index (into row_bands of the page) of the table row this reading came from, or None when it cannot be tied to
    one band. Pages cached before band_idx existed map by position when every strip returned as many rows as bands."""
    if "band_idx" in row:
        return row["band_idx"]
    if all(n.get("filled_bands") == n.get("rows_returned") for n in g.get("notes", [])) and g.get("notes"):
        return row["line_on_page"] - 1
    return None


def gemma_row(pdf_path: Path, page_no: int, cache: Path, band: dict, key: str, dpi_from: int = 200,
              dpi: int = ROW_DPI) -> dict:
    """Re-read ONE table row from a single-row crop at `dpi` (default 300; the automatic verifier uses 400).
    band = a row_bands() entry (200 DPI coordinates). Cached as p<NNN>.row<key>.gemma-d<dpi>.json (a reply that cannot
    be used is cached as row None with `failed`, so a rebuild does not ask the GPU again).
    Exits 3 when Colin is gaming (before any GPU work)."""
    f = cache / f"p{page_no:03d}.row{key}.gemma-d{dpi}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    if gaming_active():
        print("gaming mode active: stopping GPU work", file=sys.stderr)
        sys.exit(3)
    from PIL import Image
    png = render(pdf_path, page_no, cache, dpi)
    img = Image.open(png)
    k = dpi / dpi_from
    crop = png.with_name(f"{png.stem}.row{key}.png")
    img.crop((0, max(0, int((band["y0"] - 4) * k)), img.size[0], min(img.size[1], int((band["y1"] + 4) * k)))).save(crop)
    rows, dt, note = gemma_image(crop, rows=1)
    res = {"row": rows[0] if rows and isinstance(rows[0], dict) else None, "n_returned": len(rows), "seconds": round(dt, 1)}
    if note.startswith(CONTENT_FAIL):
        res["failed"] = note[:120]
    f.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    return res


# ---------- scoring ----------
def score(rows: list[dict], truth: list[list]) -> dict:
    """Match each truth row to an extracted row (by row number, else best description) and score fields."""
    by_n = {}
    for r in rows:
        try:
            by_n.setdefault(int(r.get("n")), r)
        except (TypeError, ValueError):
            pass
    fields = {"description": 0, "type": 0, "date": 0, "over30": 0, "amount": 0, "all5": 0}
    misses, sims = [], []
    used = set()
    for n, desc, typ, date, over30, band in truth:
        r = by_n.get(n)
        if r is None:  # fall back to closest description
            best, bs = None, 0.0
            for i, c in enumerate(rows):
                if i in used:
                    continue
                s = difflib.SequenceMatcher(None, norm_desc(c.get("description")), norm_desc(desc)).ratio()
                if s > bs:
                    best, bs = (i, c), s
            if best and bs > 0.6:
                used.add(best[0])
                r = best[1]
        if r is None:
            misses.append({"n": n, "miss": "row not extracted"})
            sims.append(0.0)
            continue
        sim = difflib.SequenceMatcher(None, norm_desc(r.get("description")), norm_desc(desc)).ratio()
        sims.append(sim)
        ok = {
            "description": norm_desc(r.get("description")) == norm_desc(desc),
            "type": norm_type(r.get("type")) == typ,
            "date": norm_date(r.get("date")) == norm_date(date),
            "over30": over30 is None or (str(r.get("over30") or "").strip().lower()[:1] == over30.lower()[:1]),
            "amount": norm_band(r.get("amount")) == norm_band(band),
        }
        for k, v in ok.items():
            fields[k] += int(v)
        fields["all5"] += int(all(ok.values()))
        bad = {k: r.get(k) for k, v in ok.items() if not v}
        if bad:
            misses.append({"n": n, "got": bad, "desc_similarity": round(sim, 3)})
    return {"truth_rows": len(truth), "extracted_rows": len(rows), **fields,
            "mean_desc_similarity": round(sum(sims) / max(1, len(sims)), 4), "misses": misses}


def cmd_compare(a) -> int:
    cache = Path(a.cache_dir)
    truth = json.loads(Path(a.truth).read_text(encoding="utf-8"))
    inv = {r["file"]: r for r in csv.DictReader(open(a.inventory, encoding="utf-8"))}
    out = Path(a.out)
    results = {}
    for key, spec in truth.items():
        if key.startswith("_"):
            continue
        rec = next(r for f, r in inv.items() if f.replace("%20", " ") == spec["file"])
        pdf_path = cache / "pdf" / f"{rec['unid']}.pdf"
        pc = cache / rec["unid"]
        pc.mkdir(parents=True, exist_ok=True)
        page = spec["page"]
        res = {}
        t0 = time.time()
        tl = textlayer_rows(pdf_path, page)
        res["textlayer"] = {"seconds": round(time.time() - t0, 2), **score(tl, spec["rows"])}
        for ns in a.strips:
            g = gemma_page(pdf_path, page, pc, ns, dpi=a.dpi)
            for r in g["rows"]:  # score on position, not on the number Gemma read
                r["n"] = r["line_on_page"]
            res[f"gemma_r{ns}_d{a.dpi}"] = {"seconds": g["seconds"], "filled_bands": g["filled_bands"],
                                           **score(g["rows"], spec["rows"])}
        results[key] = res
        for m, r in res.items():
            print(f"{key:22} {m:10} rows {r['extracted_rows']:>3}/{r['truth_rows']:<3} desc {r['description']:>3} "
                  f"type {r['type']:>3} date {r['date']:>3} band {r['amount']:>3} all5 {r['all5']:>3} "
                  f"sim {r['mean_desc_similarity']:.3f} {r['seconds']:>7}s")
    (out / "method-compare.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("compare")
    c.add_argument("--cache-dir", required=True)
    c.add_argument("--truth", required=True)
    c.add_argument("--inventory", required=True)
    c.add_argument("--out", required=True)
    c.add_argument("--strips", type=int, nargs="+", default=[1])
    c.add_argument("--dpi", type=int, default=200)
    a = ap.parse_args()
    return cmd_compare(a)


if __name__ == "__main__":
    sys.exit(main())
