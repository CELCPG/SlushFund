#!/usr/bin/env python3
"""Self-test for the R10c Gemma guards (no GPU, no network beyond a loopback stub server).

Covers: runaway detection, the per-strip token cap, strict official-band validation, the strip -> 2-row -> 1-row
fallback with unreadable bands, printed-# gap ranges, a streamed runaway being cut off, and the health endpoint.
Run: python src/scripts/test_oge_guard.py
"""
import http.server
import json
import tempfile
import threading
import time
from pathlib import Path

import oge_extract as X
import load_executive_trades as L
import run_oge_load as R

X.gaming_active = lambda: False  # never spawn the gaming check in a test

# ── runaway detection ───────────────────────────────────────────────────────
assert X.runaway('{"rows":[{"n":1,"amount":"$1,000,00000000') == "digit run"          # the 10/4 failure
assert X.runaway('"over30":"No","$15,001 - $50,0000000000000000000000') == "digit run"
assert X.runaway("Z/0/1/2/3/4/5/6/7/8/9/!/@/#/$/%/&/" + "/" * 20) == "char run"
chunk = '"description":"AB",'  # 19 chars: pad to 20
assert X.runaway("x" + (chunk + " ") * 3) == "repeated chunk"
assert X.runaway('{"rows":[{"n":3,"description":"APPLE INC","type":"purchase","date":"5/11/2026","over30":"No",'
                 '"amount":"$1,000,001 - $5,000,000"},{"n":4,"description":"CUSIP 0000000 BOND"}') is None  # 7 zeros, fine
assert X.runaway("$1,000,000") is None and X.runaway("") is None
assert X.token_cap(8) == 8 * 120 + 200 and X.token_cap(1) == 320 and X.token_cap(0) == 320

# ── official bands only ─────────────────────────────────────────────────────
for b in ("$1,001 - $15,000", "$15,001-$50,000", "$50,001 - $100,000", "$100,001 - $250,000", "$250,001 - $500,000",
          "$500,001 - $1,000,000", "$1,000,001 - $5,000,000", "$5,000,001 - $25,000,000", "$25,000,001 - $50,000,000",
          "Over $50,000,000", "Over $1,000,000"):
    assert X.official_band(b) is not None, b
for b in ("$1,000,00000000", "$15,001 - $50,0000000", "$15,001 - $50,001", "$1,001 - $15,001", "$100 - $200", "", None,
          "$250,001 - $500,00"):
    assert X.official_band(b) is None, b
GOOD = {"n": 5, "description": "APPLE INC - COMMON STOCK", "type": "purchase", "date": "5/11/2026", "over30": "No",
        "amount": "$15,001 - $50,000"}
assert X.valid_row(GOOD)
assert not X.valid_row({**GOOD, "amount": "$15,001 - $50,0000000000"})
assert not X.valid_row({**GOOD, "amount": "$15,001 - $50,001"})          # not rounded to a band, never a guess
assert not X.valid_row({**GOOD, "extra": "x"})
assert X.odd_row({**GOOD, "date": "N/A"}) and not X.valid_row({**GOOD, "date": "N/A"})
assert not X.odd_row({**GOOD, "date": "N/A", "amount": "$1,000,00000"})

# ── fallback: strip -> 2-row crops -> 1-row crops -> unreadable ─────────────
from PIL import Image  # noqa: E402

tmp = Path(tempfile.mkdtemp(prefix="oge-guard-"))
png = tmp / "p001.200.png"
Image.new("RGB", (400, 900), "white").save(png)
img = Image.open(png)
bands = [{"y0": 10 + i * 100, "y1": 10 + (i + 1) * 100, "ink": 0.05} for i in range(8)]
calls: list = []


def row_for(i: int) -> dict:
    return {**GOOD, "n": 100 + i, "description": f"ROW {i}"}


def fake_image(p, max_tokens=6000, rows=None):
    """Reads each crop 'p<tag>' from its band count: the whole strip and pair 4 (bands 6-7) runaway; band 7 never reads."""
    calls.append(("img", Path(p).name, rows))
    name = Path(p).name
    if rows == 8:
        return [], 1.0, "runaway (digit run) after 40 chunks: '0000'"
    if name.endswith(".r8-1p4.png"):  # bands 6-7
        return [], 1.0, "runaway (digit run) after 40 chunks: '0000'"
    if name.endswith(".r8-1p4s2.png"):  # band 7 alone at 200 DPI
        return [], 1.0, "bad json: x"
    first = {"p1": 0, "p2": 2, "p3": 4, "p4": 6}[name.split(".r8-1")[1][:2]] if "p4s" not in name else None
    if name.endswith(".r8-1p4s1.png"):
        return [row_for(6)], 1.0, "ok"
    return [row_for(first), row_for(first + 1)], 1.0, "ok"


def fake_row(png_, band, tag, dpi_from=200, dpi=300):
    calls.append(("row", tag, dpi))
    return None, 1.0, "runaway (digit run) after 40 chunks: '0000'"


X.gemma_image, X.gemma_row_uncached = fake_image, fake_row
notes, flags = [], []
rows, secs = X._read_group(img, png, bands, 0, "r8-1", notes, flags)
assert [r["band_idx"] for r in rows] == [0, 1, 2, 3, 4, 5, 6], rows            # band 7 is not read, nothing invented
assert {"band_idx": 7, "flag": "unreadable"} in flags
assert [c for c in calls if c[0] == "row"] == [("row", "r8-1p4s2.d300", 300), ("row", "r8-1p4s2.d400", 400)]
assert [c[2] for c in calls if c[0] == "img"] == [8, 2, 2, 2, 2, 1, 1], calls    # strip, 4 pairs, then singles of 6-7
runs = X.unreadable_runs(rows, 8)
assert runs == [{"bands": [7, 7], "count": 1, "n_from": 107, "n_to": 107}], runs  # printed # taken from the neighbour above
assert X.unreadable_runs(rows[1:], 8)[0] == {"bands": [0, 0], "count": 1, "n_from": 100, "n_to": 100}
assert X.unreadable_runs([], 4) == [{"bands": [0, 3], "count": 4, "n_from": None, "n_to": None}]

# a reply with an unofficial band is a failure that falls back, not a stored guess
calls.clear()
bad_band = [{**row_for(i), "amount": "$1,000,00000"} for i in range(2)]
X.gemma_image = lambda p, max_tokens=6000, rows=None: (bad_band[:rows] if rows == 2 else [], 1.0, "ok")
X.gemma_row_uncached = lambda *a_, **k_: (None, 1.0, "bad json")
fl2: list = []
rows, _ = X._read_group(img, png, bands[:2], 0, "t2", [], fl2)
assert rows == [] and [f["flag"] for f in fl2] == ["unreadable", "unreadable"], (rows, fl2)

# single band: a date-only fault is kept as odd_row, an official-band reading at 400 DPI wins over an odd one at 300
X.gemma_image = lambda p, max_tokens=6000, rows=None: ([], 1.0, "bad json")
seq = iter([{**row_for(0), "date": "N/A"}, row_for(0)])
X.gemma_row_uncached = lambda *a_, **k_: (next(seq), 1.0, "ok")
fl3: list = []
rows, _ = X._read_group(img, png, bands[:1], 0, "t3", [], fl3)
assert len(rows) == 1 and X.valid_row({k: v for k, v in rows[0].items() if k != "band_idx"}) and fl3 == [{"band_idx": 0, "flag": "read_at_400dpi"}], (rows, fl3)

# ── gap ranges on a filing ──────────────────────────────────────────────────
mk = lambda pg, ln, n: {"page_number": pg, "line_on_page": ln, "row_number_printed": n}  # noqa: E731
gaps = L.fill_gap_ranges([{"page": 3, "bands": None, "count": 4, "n_from": None, "n_to": None},
                          {"page": 2, "bands": [1, 1], "count": 1, "n_from": 12, "n_to": 12}],
                         [mk(2, 1, 10), mk(2, 2, 11), mk(4, 1, 20), mk(4, 2, 21)])
assert (gaps[0]["n_from"], gaps[0]["n_to"]) == (12, 19) and (gaps[1]["n_from"], gaps[1]["n_to"]) == (12, 12), gaps
assert R.gaps_text([{"page": 3, "n_from": 12, "n_to": 19}, {"page": 4, "n_from": 7, "n_to": 7},
                    {"page": 5, "n_from": None, "n_to": None}]) == ["p3:#12-#19", "p4:#7", "p5:#?"]

# ── the stream is cut off on a runaway; /health tells loading from down ─────
state = {"health": 200, "mode": "runaway", "sent": 0, "disconnected": False}


class Stub(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a_):
        pass

    def do_GET(self):
        body = json.dumps({"status": "ok"} if state["health"] == 200 else {"error": {"message": "Loading model"}}).encode()
        self.send_response(state["health"])
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if state["mode"] == "503":
            self.send_response(503)
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"{}")
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()

        def ev(text, finish=None):
            return ("data: " + json.dumps({"choices": [{"delta": {"content": text}, "finish_reason": finish}]}) + "\n\n").encode()
        try:
            if state["mode"] == "runaway":
                self.wfile.write(ev('{"rows":[{"n":1,"description":"X","type":"purchase","date":"5/11/2026","amount":"$1,000,'))
                for _ in range(5000):  # would run for minutes
                    self.wfile.write(ev("0"))
                    self.wfile.flush()
                    state["sent"] += 1
                    time.sleep(0.01)
            else:
                self.wfile.write(ev(json.dumps({"rows": [GOOD]}), "stop"))
                self.wfile.write(b"data: [DONE]\n\n")
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            state["disconnected"] = True


srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Stub)
threading.Thread(target=srv.serve_forever, daemon=True).start()
X.GEMMA_URL = f"http://127.0.0.1:{srv.server_address[1]}"
X.GEMMA_USAGE_LOG = tmp / "usage.jsonl"
import importlib  # noqa: E402

importlib.reload(X)  # drop the fakes above, keep the real gemma_image
X.gaming_active = lambda: False
X.GEMMA_URL = f"http://127.0.0.1:{srv.server_address[1]}"
X.GEMMA_USAGE_LOG = tmp / "usage.jsonl"

t0 = time.time()
got, dt, note = X.gemma_image(png, rows=8)
assert got == [] and note.startswith("runaway (digit run)"), note
assert time.time() - t0 < 5 and state["sent"] < 200, (time.time() - t0, state["sent"])  # cut off, not run to the cap
time.sleep(0.3)
assert state["disconnected"] or state["sent"] < 200

state["mode"] = "ok"
got, dt, note = X.gemma_image(png, rows=1)
assert got == [GOOD] and note.startswith("ok"), (got, note)
assert (tmp / "usage.jsonl").exists()

state["mode"] = "503"
try:
    X.gemma_image(png, rows=1)
    raise AssertionError("HTTP 503 must raise GemmaServerError")
except X.GemmaServerError:
    pass
assert X.gemma_health() == "ok"
state["health"] = 503
assert X.gemma_health() == "loading"
assert X.wait_gemma(max_wait=0.2, poll=0.1) is False
state["health"] = 200
assert X.wait_gemma(max_wait=1, poll=0.1) is True
srv.shutdown()
srv.server_close()
X.GEMMA_URL = "http://127.0.0.1:9"  # nothing listens
assert X.gemma_health() == "down"
try:
    X.gemma_image(png, rows=1)
    raise AssertionError("an unreachable server must raise GemmaServerError")
except X.GemmaServerError:
    pass

print("test_oge_guard: all passed")
