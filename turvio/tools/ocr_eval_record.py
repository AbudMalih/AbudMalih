#!/usr/bin/env python3
"""Records REAL OCR + barcode output for the synthetic capture samples (development aid).

  python3 tools/ocr_eval_record.py docs/testing/capture-samples packages/shared/src/__tests__/fixtures/ocr-recorded.json

Uses Tesseract 5 (deu+eng) as a stand-in for the on-device engines (ML Kit / Apple Vision):
lines with block number and frame, like the TURVIO OCR module returns, plus barcodes
decoded by zbar. The recorded JSON drives a unit test that needs no OCR installed.
"""
import csv
import io
import json
import os
import subprocess
import sys


def ocr_lines(path):
    tsv = subprocess.run(["tesseract", path, "stdout", "-l", "deu+eng", "--psm", "3", "tsv"], capture_output=True, text=True, check=True).stdout
    lines = {}
    for r in csv.DictReader(io.StringIO(tsv), delimiter="\t", quoting=csv.QUOTE_NONE):
        if r["level"] != "5" or not r["text"].strip():
            continue
        key = (int(r["block_num"]), int(r["par_num"]), int(r["line_num"]))
        left, top, w, h, conf = int(r["left"]), int(r["top"]), int(r["width"]), int(r["height"]), float(r["conf"])
        e = lines.setdefault(key, {"words": [], "x0": left, "y0": top, "x1": left + w, "y1": top + h, "conf": []})
        e["words"].append(r["text"])
        e["x0"], e["y0"] = min(e["x0"], left), min(e["y0"], top)
        e["x1"], e["y1"] = max(e["x1"], left + w), max(e["y1"], top + h)
        e["conf"].append(conf)
    out = []
    for (block, _, _), e in sorted(lines.items()):
        out.append({"text": " ".join(e["words"]), "confidence": round(sum(e["conf"]) / len(e["conf"]) / 100, 2), "block": block,
                    "frame": {"x": e["x0"], "y": e["y0"], "width": e["x1"] - e["x0"], "height": e["y1"] - e["y0"]}})
    return out


def barcodes(path):
    r = subprocess.run(["zbarimg", "--quiet", "--raw", "-Sdisable", "-Scode128.enable", path], capture_output=True, text=True)
    return [{"data": l.strip(), "type": "code128"} for l in r.stdout.splitlines() if l.strip()]


def main(src, out):
    rec = {}
    for name in sorted(os.listdir(src)):
        if name.endswith(".png") and "rotated" not in name:
            p = os.path.join(src, name)
            rec[name] = {"lines": ocr_lines(p), "barcodes": barcodes(p)}
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"engine": subprocess.run(["tesseract", "--version"], capture_output=True, text=True).stdout.splitlines()[0], "samples": rec}, f, ensure_ascii=False, indent=1)
    print(f"recorded {len(rec)} samples -> {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
