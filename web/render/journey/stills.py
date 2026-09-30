"""Art-direction stills at production quality.

    /opt/bl/bin/python stills.py --out /tmp/stills [--only hall,hub] [--samples 32]
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import scene  # noqa: E402

# name: (frame, anchor, cam pos, target, lens). "T" = relative to the cab front.
STILLS = {
    "1-hall": (30, "W", (-1.3, -6.9, 1.55), (-8.8, 0.6, 2.25), 26),
    "2-emerging": (50, "W", (25.0, -9.8, 1.35), (5.0, 0.2, 2.5), 32),
    "3-autobahn": (74, "T", (4.5, -17.5, 1.9), (-8.3, 0.0, 2.35), 35),
    "4-hub": (149, "W", (scene.STOP_X + 8.5, -12.8, 2.0), (scene.STOP_X - 8.0, 6.0, 3.7), 32),
}


def place(cam, f, anchor, pos, tgt):
    fx = scene.front_x(f) if anchor == "T" else 0.0
    p = Vector(pos) + Vector((fx, 0, 0))
    t = Vector(tgt) + Vector((fx, 0, 0))
    cam.location = p
    cam.rotation_euler = (t - p).to_track_quat("-Z", "Y").to_euler()
    return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/stills")
    ap.add_argument("--only", default="")
    ap.add_argument("--samples", type=int, default=32)
    ap.add_argument("--res", default="1600x900")
    a = ap.parse_args()
    scene.build("desktop", a.samples)
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = map(int, a.res.split("x"))
    sc.render.use_persistent_data = False
    cam = sc.camera
    cam.animation_data_clear()
    cam.data.animation_data_clear()
    os.makedirs(a.out, exist_ok=True)
    for name, (f, anchor, pos, tgt, lens) in STILLS.items():
        if a.only and not any(name.endswith(o) or name.startswith(o) for o in a.only.split(",")):
            continue
        cam.animation_data_clear()
        cam.parent = None
        sc.frame_set(f)
        if anchor == "T":
            # tracking shot: the camera rides with the truck (clean motion blur)
            cam.parent = bpy.data.objects["truck"]
            cam.location = pos
            cam.rotation_euler = (Vector(tgt) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
        sc.frame_set(f)
        p = place(cam, f, anchor, pos, tgt) if anchor == "W" else cam.matrix_world.translation.copy()
        cam.data.lens = lens
        cam.data.dof.focus_distance = (Vector((scene.front_x(f) - 1.5, 0, 2.0)) - p).length
        sc.render.filepath = os.path.join(a.out, name + ".png")
        bpy.ops.render.render(write_still=True)
        print("still", name, flush=True)


if __name__ == "__main__":
    main()
