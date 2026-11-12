#!/usr/bin/env python3
"""Loads OpenStreetMap addresses into the geodb database and switches the geocoder to them atomically.

Runs in the geodb-prepare image:  deploy.sh --geodb-refresh  (docker compose ... run --rm geodb-prepare)

  GEODB_REGIONS          Geofabrik Germany sub-regions, default "niedersachsen bremen" (+ "hessen" for Kassel/Haiger)
  GEODB_PBF_FILES        instead of downloading: space-separated local .osm.pbf files (tests, offline)
  GEODB_MIN_ROWS         refuse to activate an import with fewer rows (default 300000)
  GEODB_WORK             work directory (default /work); downloads and the CSV are deleted afterwards
  GEODB_LOCATION_INDEX   pyosmium node-location index; default: a sparse file in the work directory
                         (Niedersachsen + Bremen: 175 MB anonymous memory instead of ~2.2 GB)
  PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE   the geodb server (admin); GEODB_READER_PASSWORD for geo_reader

Safety: new data goes into geo.addresses_new and is validated (row count, per-region samples) before one
short transaction swaps it in. A failed or refused run leaves the active data untouched.
Data: (c) OpenStreetMap contributors, ODbL - attribution is shown wherever results appear.
"""
import csv
import hashlib
import os
import shutil
import sys
import time
import urllib.request
from pathlib import Path

import psycopg
from psycopg import sql

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
if not (HERE / "osm_addresses.py").exists():  # in a checkout the extractor lives in tools/
    sys.path.insert(0, str(HERE.parent.parent / "tools"))
from osm_addresses import Addresses  # noqa: E402

REGION_PREFIX = {"niedersachsen": "301", "bremen": "281", "hessen": "341"}


def log(msg: str) -> None:
    print(msg, flush=True)


def refuse(msg: str, code: int) -> None:
    print(f"REFUSED: {msg}; active data unchanged", file=sys.stderr, flush=True)
    sys.exit(code)


def md5(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, dest: Path) -> None:
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(url, timeout=120) as r, dest.open("wb") as f:
                shutil.copyfileobj(r, f, 1 << 20)
            return
        except OSError as e:
            if attempt == 3:
                raise
            log(f"download failed ({e}), retrying")
            time.sleep(10 * attempt)


def main() -> None:
    regions = os.environ.get("GEODB_REGIONS", "niedersachsen bremen").split()
    min_rows = int(os.environ.get("GEODB_MIN_ROWS", "300000"))
    work = Path(os.environ.get("GEODB_WORK", "/work"))
    reader_pw = os.environ.get("GEODB_READER_PASSWORD") or refuse("set GEODB_READER_PASSWORD", 2)
    local_files = os.environ.get("GEODB_PBF_FILES", "").split()

    need_mb = (len(local_files) or len(regions)) * 1500 + 2000  # pbf + CSV + sparse node index
    free_mb = shutil.disk_usage(work).free // (1 << 20)
    log(f"preflight: regions={' '.join(regions)} free disk in {work}: {free_mb} MB (needs ~{need_mb} MB)")
    if free_mb < need_mb:
        refuse(f"not enough disk in {work}", 3)

    run = work / time.strftime("run-%Y%m%dT%H%M%SZ", time.gmtime())
    run.mkdir(parents=True)
    try:
        # ---- 1. source files ----------------------------------------------------------------
        files: list[Path] = []
        sources: list[str] = []
        if local_files:
            for f in map(Path, local_files):
                files.append(f)
                sources.append(f"file:{f.name}@{md5(f)[:12]}")
        else:
            for r in regions:
                url = f"https://download.geofabrik.de/europe/germany/{r}-latest.osm.pbf"
                dest = run / f"{r}.osm.pbf"
                log(f"downloading {url}")
                download(url, dest)
                with urllib.request.urlopen(url + ".md5", timeout=60) as resp:
                    want = resp.read().decode().split()[0]
                got = md5(dest)
                if got != want:
                    refuse(f"checksum mismatch for {r} ({got} != {want})", 4)
                files.append(dest)
                sources.append(f"geofabrik:{r}@{want}")

        # ---- 2. extract addresses -----------------------------------------------------------
        csv_path = run / "addresses.csv"
        idx = os.environ.get("GEODB_LOCATION_INDEX") or f"sparse_file_array,{run / 'node-locations.idx'}"
        with csv_path.open("w", newline="") as out:
            writer = csv.writer(out, delimiter=";")
            for f in files:
                log(f"extracting addresses from {f.name}")
                h = Addresses(writer)
                h.apply_file(str(f), locations=True, idx=idx)
                log(f"  {h.count} addresses")
                (run / "node-locations.idx").unlink(missing_ok=True)

        # ---- 3. load into geo.addresses_new -------------------------------------------------
        with psycopg.connect(autocommit=True) as db:
            db.execute((HERE / "schema.sql").read_text())
            db.execute(sql.SQL("alter role geo_reader password {}").format(sql.Literal(reader_pw)))
            db.execute("drop table if exists geo.addresses_new")
            db.execute("create table geo.addresses_new (like geo.addresses including defaults including generated including identity including constraints)")
            db.execute("create unique index addresses_new_uniq on geo.addresses_new (street_norm, hn_norm, postcode)")
            db.execute("drop table if exists geo.load_raw")
            db.execute("create unlogged table geo.load_raw (street text, house_number text, postcode text, city text, lat double precision, lng double precision)")
            with db.cursor() as cur, cur.copy("copy geo.load_raw from stdin with (format csv, delimiter ';')") as cp, csv_path.open("rb") as f:
                for chunk in iter(lambda: f.read(1 << 20), b""):
                    cp.write(chunk)
            log("indexing")
            # The unique index is the conflict arbiter: OSM duplicates (node + building) keep the first row.
            db.execute("""insert into geo.addresses_new (street, house_number, postcode, city, lat, lng)
                          select street, nullif(house_number, ''), postcode, city, lat, lng from geo.load_raw
                           where postcode ~ '^[0-9]{5}$' and lat between -90 and 90 and lng between -180 and 180
                          on conflict do nothing""")
            db.execute("drop table geo.load_raw")
            db.execute("create index addresses_new_street_idx on geo.addresses_new (street_norm text_pattern_ops, postcode)")
            db.execute("create index addresses_new_postcode_idx on geo.addresses_new (postcode)")
            db.execute("create index addresses_new_city_idx on geo.addresses_new (city_norm text_pattern_ops)")
            db.execute("create index addresses_new_latlng_idx on geo.addresses_new (lat, lng)")
            db.execute("analyze geo.addresses_new")

            # ---- 4. validate before activating ----------------------------------------------
            rows = db.execute("select count(*) from geo.addresses_new").fetchone()[0]
            log(f"loaded {rows} unique addresses")
            if rows < min_rows:
                db.execute("drop table geo.addresses_new")
                refuse(f"only {rows} rows (< GEODB_MIN_ROWS={min_rows})", 5)
            if not local_files:
                for r in regions:
                    prefix = REGION_PREFIX.get(r)
                    if not prefix:
                        continue
                    n = db.execute("select count(*) from geo.addresses_new where postcode like %s", (prefix + "%",)).fetchone()[0]
                    log(f"check {r}: {n} addresses with postcode {prefix}...")
                    if n <= 1000:
                        db.execute("drop table geo.addresses_new")
                        refuse(f"region {r} looks empty", 6)

            # ---- 5. atomic switch -----------------------------------------------------------
            version = f"osm-{time.strftime('%Y%m%d', time.gmtime())}-{hashlib.md5(' '.join(sources).encode()).hexdigest()[:8]}"
            with db.transaction():
                db.execute("alter table geo.addresses rename to addresses_previous")
                for old in ("street_idx", "postcode_idx", "city_idx", "uniq", "latlng_idx"):
                    db.execute(f"alter index if exists geo.addresses_{old} rename to addresses_previous_{old}")
                db.execute("alter table geo.addresses_new rename to addresses")
                for name in ("street_idx", "postcode_idx", "city_idx", "uniq", "latlng_idx"):
                    db.execute(f"alter index geo.addresses_new_{name} rename to addresses_{name}")
                db.execute("grant select on geo.addresses to geo_reader")
                db.execute(
                    """insert into geo.meta (version, regions, rows, source) values (%s, %s, %s, %s)
                       on conflict (version) do update set rows = excluded.rows, imported_at = now()""",
                    (version, " ".join(regions), rows, " ".join(sources)),
                )
            db.execute("drop table geo.addresses_previous")
        log(f"ACTIVE: {version} ({rows} addresses). Set ADDRESS_DATA_VERSION={version} in .env.")
    finally:
        shutil.rmtree(run, ignore_errors=True)


if __name__ == "__main__":
    main()
