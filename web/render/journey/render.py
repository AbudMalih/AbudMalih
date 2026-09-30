"""Render frames of the journey.

    /opt/bl/bin/python render.py --cam desktop --frames 0-149 --samples 64 --out out/desktop
    /opt/bl/bin/python render.py --cam mobile --frames 0,40,96 --scale 50 --out /tmp/preview
"""

import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import scene  # noqa: E402


def frames(spec):
    out = []
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            step = 1
            if ":" in b:
                b, step = b.split(":")
            out.extend(range(int(a), int(b) + 1, int(step)))
        else:
            out.append(int(part))
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--cam", default="desktop")
    p.add_argument("--frames", default="0-119")
    p.add_argument("--samples", type=int, default=64)
    p.add_argument("--scale", type=int, default=100)
    p.add_argument("--out", default="out")
    p.add_argument("--skip-existing", action="store_true")
    p.add_argument("--count", type=int, default=scene.N, help="output frames, spread over the film")
    a = p.parse_args()
    scene.build(a.cam, a.samples)
    sc = bpy.context.scene
    sc.render.resolution_percentage = a.scale
    os.makedirs(a.out, exist_ok=True)
    for f in frames(a.frames):
        path = os.path.join(a.out, f"f{f:03d}.png")
        if a.skip_existing and os.path.exists(path):
            continue
        d = f * (scene.N - 1) / (a.count - 1)  # design frame (may be fractional)
        sc.frame_set(int(d), subframe=d - int(d))
        sc.render.filepath = path
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"frame {f} {time.time() - t:.1f}s", flush=True)


if __name__ == "__main__":
    main()
