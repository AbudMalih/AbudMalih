"""Synthetic bulk-import test data (deterministic): 1,000 parcels at 100 Hannover addresses.

    python3 apps/api/test/fixtures/bulk-import/generate.py

Addresses: real public OSM addresses (../osm-addresses.json, ODbL). People, companies and tracking
numbers are fictional. Writes, next to this script:
  parcels.csv            UTF-8 with BOM, ";" separated, German headers (auto-detected)
  parcels-win1252.csv    Windows-1252, "," separated, quoted, English headers (Excel on German Windows)
  parcels.xlsx           Excel, headers TURVIO does not know (needs column mapping)
  duplicates.csv         parcels.csv + 3 exact repeats + 2 tracking numbers at a second address
  incomplete.csv         20 valid rows + 6 rows with missing/invalid address parts
  manifest.json          expected results (per address: parcel count, tracking numbers)
Formatting differences of the SAME address are mixed into every file (Straße/Str./strasse,
"12a"/"12 a", case, spaces, ü/ue) – they must still give one stop per address.
"""
import csv, json, random
from pathlib import Path

HERE = Path(__file__).parent
addrs = json.loads((HERE.parent / "osm-addresses.json").read_text())["hannover"]["addresses"]
assert len(addrs) == 100
rnd = random.Random(20261108)

FIRST = ["Anna", "Ben", "Clara", "David", "Elif", "Finn", "Greta", "Hamza", "Ida", "Jonas", "Klara", "Luca", "Mia", "Noah", "Olga", "Paul", "Rana", "Sven", "Tara", "Yusuf"]
LAST = ["Schulz", "Becker", "Yilmaz", "Hoffmann", "Wagner", "Nowak", "Kaya", "Richter", "Klein", "Wolf", "Popescu", "Neumann", "Schröder", "Krüger", "Haddad", "Lehmann"]
COMPANY = ["Praxis am Park GmbH", "Bäckerei Sonnenkorn", "Kanzlei Weber & Partner", "Blumen Lindner", "Optik Hellwig", "IT-Service Nord GmbH", "Café Feldblick", "Apotheke am Markt", "Fahrradhaus Lenz", "Steuerbüro Arslan"]

# Parcel counts: one large customer with 120 parcels, the other 99 addresses share 880 (1..20 each).
counts = [120] + [1] * 99
left = 1000 - sum(counts)
while left:
    i = rnd.randrange(1, 100)
    if counts[i] < 20:
        counts[i] += 1
        left -= 1
assert sum(counts) == 1000

def tracking(n: int) -> str:
    # Mixed carrier-like formats, all unique after normalization.
    return f"JJD{14000000000 + n * 7919:014d}" if n % 3 == 0 else f"TVO{8000000 + n:07d}DE" if n % 3 == 1 else f"{340000000000 + n * 104729:012d}"

def spell(a: dict, k: int) -> dict:
    """Formatting differences of the same address (k-th parcel there)."""
    street, no, pc = a["street"], a["houseNumber"], a["postalCode"]
    v = k % 5
    if v == 1 and "straße" in street.lower():
        street = street.replace("straße", "str.").replace("Straße", "Str.")
    elif v == 2:
        street = street.replace("ß", "ss").lower()
        no = f"{no[:-1]} {no[-1]}" if no[-1:].isalpha() and len(no) > 1 else f" {no} "
    elif v == 3:
        street = street.replace("ü", "ue").replace("ö", "oe").replace("ä", "ae")
        pc = f" {pc}"
    elif v == 4:
        street = street.upper()
    return {"street": street, "houseNumber": no, "postalCode": pc, "city": a["city"] if v != 4 else a["city"].upper()}

rows, manifest = [], []
n = 0
for i, (a, c) in enumerate(zip(addrs, counts)):
    company = "Großhandel Leinetal GmbH (Wareneingang)" if i == 0 else (rnd.choice(COMPANY) if rnd.random() < 0.4 else "")
    tns = []
    for k in range(c):
        n += 1
        tn = tracking(n)
        tns.append(tn)
        person = f"{rnd.choice(FIRST)} {rnd.choice(LAST)}"
        rows.append({"tracking": tn, "recipient": person, "company": company, **spell(a, k), "addressIndex": i})
    manifest.append({"index": i, "canonical": a, "parcels": c, "company": company, "trackingNumbers": tns})
rnd.shuffle(rows)  # a manifest is not sorted by address

DE = ["Sendungsnummer", "Empfänger", "Firma", "Straße", "Hausnummer", "PLZ", "Ort"]
EN = ["Tracking number", "Recipient", "Company", "Street", "House number", "Postcode", "City"]
XL = ["Sdg-Nr", "Empf.", "Firmenname", "Anschrift Zeile 1", "Nr.", "PLZ/Code", "Zielort"]
cells = lambda r: [r["tracking"], r["recipient"], r["company"], r["street"], r["houseNumber"], r["postalCode"], r["city"]]

def write_csv(path, header, data, enc, delim, bom=False):
    with open(path, "w", newline="", encoding=enc) as f:
        if bom:
            f.write("﻿")
        w = csv.writer(f, delimiter=delim, quoting=csv.QUOTE_MINIMAL if delim == ";" else csv.QUOTE_ALL)
        w.writerow(header)
        for r in data:
            w.writerow(cells(r))

write_csv(HERE / "parcels.csv", DE, rows, "utf-8", ";", bom=True)
write_csv(HERE / "parcels-win1252.csv", EN, rows, "cp1252", ",")

from openpyxl import Workbook
wb = Workbook(); ws = wb.active; ws.title = "Sendungen"
ws.append(XL)
for r in rows:
    ws.append(cells(r))
wb.save(HERE / "parcels.xlsx")

# Duplicates: 3 exact repeats (same parcel listed twice) + 2 tracking numbers also listed at ANOTHER address.
dups = rows[:]
exact = [dict(rows[5]), dict(rows[50]), dict(rows[500])]
other = []
for src, dst in ((rows[10], 7), (rows[20], 8)):
    a = addrs[(src["addressIndex"] + dst) % 100]
    other.append({**src, **spell(a, 0), "recipient": "Wrong Address", "addressIndex": (src["addressIndex"] + dst) % 100})
dups += exact + other
write_csv(HERE / "duplicates.csv", DE, dups, "utf-8", ";", bom=True)

# Incomplete addresses: 20 valid rows + 6 broken ones.
bad = [dict(r) for r in rows[100:106]]
bad[0]["street"] = ""                 # street missing
bad[1]["postalCode"] = ""             # postcode missing
bad[2]["city"] = ""                   # city missing
bad[3]["postalCode"] = "3016"         # 4 digits (Excel dropped a digit? not a leading zero for Hannover)
bad[4]["houseNumber"] = ""            # house number missing (warning only)
bad[5]["street"], bad[5]["houseNumber"] = "Gibtsnichtweg", "999"  # does not exist (geocoding fails)
write_csv(HERE / "incomplete.csv", DE, rows[:20] + bad, "utf-8", ";", bom=True)

(HERE / "manifest.json").write_text(json.dumps({
    "parcels": 1000, "addresses": 100, "largestAddressParcels": max(counts),
    "duplicates": {"exact": [r["tracking"] for r in exact], "otherAddress": [r["tracking"] for r in other]},
    "addresses_detail": manifest,
}, ensure_ascii=False, indent=0))
print("rows", len(rows), "max per address", max(counts), "files written")
