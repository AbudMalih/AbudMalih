#!/usr/bin/env python3
"""Renders SYNTHETIC test images for "stops from photo/screenshot":
parcel labels (DHL, Hermes, DPD, GLS, Packstation, parcel shop) with Code 128 barcodes and
chat/maps screenshots. All names, addresses and numbers are fictional (no real customers).

  python3 tools/synthetic_capture_samples.py docs/testing/capture-samples

Requires Pillow; barcodes need python-barcode (pip install python-barcode), otherwise the
code is printed as text only. Print the labels on A6/A4 for device tests or show the
screenshots on a second screen.
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

try:
    from barcode import Code128
    from barcode.writer import ImageWriter
except ImportError:  # pragma: no cover
    Code128 = None

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def barcode_img(code, height_mm=14):
    if Code128 is None:
        return None
    return Code128(code, writer=ImageWriter()).render({"module_height": height_mm, "font_size": 0, "quiet_zone": 2, "write_text": False})


def label(carrier, sender, recipient, code, extra_top=None, recipient_marker="Empfänger:", sender_marker="Absender:"):
    img = Image.new("RGB", (1240, 1750), "white")
    d = ImageDraw.Draw(img)
    d.rectangle([20, 20, 1220, 1730], outline="black", width=6)
    d.text((60, 50), carrier, font=font(72, True), fill="black")
    y = 170
    if extra_top:
        d.text((60, y), extra_top, font=font(34), fill="black")
        y += 60
    if sender_marker:
        d.text((60, y), sender_marker, font=font(28), fill="black")
        y += 40
    for line in sender:
        d.text((60, y), line, font=font(30), fill="black")
        y += 42
    y += 60
    d.line([40, y, 1200, y], fill="black", width=3)
    y += 40
    if recipient_marker:
        d.text((60, y), recipient_marker, font=font(34), fill="black")
        y += 55
    for line in recipient:
        d.text((60, y), line, font=font(64, True), fill="black")
        y += 86
    y += 60
    bc = barcode_img(code)
    if bc is not None:
        bc = bc.resize((1100, 300))
        img.paste(bc, (70, y))
        y += 320
    d.text((70, y), " ".join(code[i:i + 4] for i in range(0, len(code), 4)), font=font(44), fill="black")
    return img


def chat(lines, title="Disposition"):
    """WhatsApp-like screenshot: header, bubbles with timestamps (not a real app UI)."""
    img = Image.new("RGB", (1080, 1920), (236, 229, 221))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 1080, 200], fill=(7, 94, 84))
    d.text((160, 70), title, font=font(52, True), fill="white")
    d.text((160, 135), "online", font=font(32), fill=(220, 240, 235))
    y = 260
    for who, text, time in lines:
        f = font(46)
        rows = text.split("\n")
        w = max(d.textlength(r, font=f) for r in rows) + 80
        h = 58 * len(rows) + 90
        x = 40 if who == "them" else 1040 - w
        d.rounded_rectangle([x, y, x + w, y + h], radius=24, fill="white" if who == "them" else (220, 248, 198))
        for i, r in enumerate(rows):
            d.text((x + 40, y + 30 + 58 * i), r, font=f, fill="black")
        d.text((x + w - 150, y + h - 50), time + (" ✓✓" if who == "me" else ""), font=font(30), fill=(110, 110, 110))
        y += h + 40
    return img


SAMPLES = {
    "dhl_label.png": (lambda: label("DHL PAKET", ["Online-Shop AG", "Lagerweg 3", "04109 Leipzig"], ["Jonas Becker", "Friedrich-König-Str. 7", "98527 Suhl"], "JJD000390007912345678", sender_marker="Von:", recipient_marker="An:"),
                      {"addresses": [{"name": "Jonas Becker", "street": "Friedrich-König-Str.", "no": "7", "plz": "98527", "city": "Suhl"}], "tracking": ["JJD000390007912345678"]}),
    "hermes_label.png": (lambda: label("Hermes", ["Versand GmbH", "Hauptstr. 1", "33100 Paderborn"], ["Erika Musterfrau", "Am Rimbach 4a", "98529 Suhl"], "H1003450012345678901"),
                         {"addresses": [{"name": "Erika Musterfrau", "street": "Am Rimbach", "no": "4a", "plz": "98529", "city": "Suhl"}], "tracking": ["H1003450012345678901"]}),
    "dpd_label.png": (lambda: label("DPD Classic", ["Sport & Co KG", "Ringstraße 9", "90402 Nürnberg"], ["Paula Schmidt", "Steinweg 20", "98527 Suhl"], "01234567890123"),
                      {"addresses": [{"name": "Paula Schmidt", "street": "Steinweg", "no": "20", "plz": "98527", "city": "Suhl"}], "tracking": ["01234567890123"]}),
    "gls_label.png": (lambda: label("GLS", ["Technik UG", "Am Hafen 2", "28195 Bremen"], ["Klaus Richter", "Auenstraße 36", "98529 Suhl"], "41234567890"),
                      {"addresses": [{"name": "Klaus Richter", "street": "Auenstraße", "no": "36", "plz": "98529", "city": "Suhl"}], "tracking": ["41234567890"]}),
    "packstation_label.png": (lambda: label("DHL PAKET", ["Online-Shop AG", "Lagerweg 3", "04109 Leipzig"], ["Max Mustermann", "12345678", "Packstation 123", "98527 Suhl"], "JJD000390007955555555", sender_marker="Von:", recipient_marker="An:"),
                              {"addresses": [{"name": "Max Mustermann", "street": "Packstation", "no": "123", "plz": "98527", "city": "Suhl", "kind": "packstation", "postNumber": "12345678"}], "tracking": ["JJD000390007955555555"]}),
    "whatsapp_single.png": (lambda: chat([("them", "Hallo Samir, bitte noch heute:", "14:31"), ("them", "Max Mustermann\nBahnhofstraße 12\n98527 Suhl\nTel. 0170 1234567", "14:32"), ("me", "Ok, mache ich", "14:33")]),
                            {"addresses": [{"name": "Max Mustermann", "street": "Bahnhofstraße", "no": "12", "plz": "98527", "city": "Suhl"}], "tracking": []}),
    "whatsapp_multi.png": (lambda: chat([("them", "Nachtrag für heute:", "09:02"), ("them", "1) Anna Krüger\nSteinweg 20\n98527 Suhl", "09:02"), ("them", "2) Klaus Richter\nAuenstraße 36\n98529 Suhl", "09:03"), ("them", "3) Erika Muster\nHoher Rain 5\n98527 Suhl", "09:03")]),
                           {"addresses": [{"name": "Anna Krüger", "plz": "98527"}, {"name": "Klaus Richter", "plz": "98529"}, {"name": "Erika Muster", "plz": "98527"}], "tracking": []}),
    "maps_share.png": (lambda: chat([("them", "Würzburger Str. 21, 98529 Suhl, Deutschland", "11:15")], title="Kunde"),
                       {"addresses": [{"street": "Würzburger Str.", "no": "21", "plz": "98529", "city": "Suhl"}], "tracking": []}),
}


def main(out):
    os.makedirs(out, exist_ok=True)
    expected = {}
    for name, (make, exp) in SAMPLES.items():
        make().save(os.path.join(out, name))
        expected[name] = exp
    # Rotated copy for the on-device rotation handling (ML Kit tries 0/90/270/180).
    Image.open(os.path.join(out, "hermes_label.png")).rotate(90, expand=True).save(os.path.join(out, "hermes_label_rotated.png"))
    with open(os.path.join(out, "expected.json"), "w", encoding="utf-8") as f:
        json.dump(expected, f, ensure_ascii=False, indent=2)
    print(f"{len(SAMPLES) + 1} images written to {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "docs/testing/capture-samples")
