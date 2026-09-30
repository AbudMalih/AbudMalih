"""Builds and animates the complete journey scene.

Usage (headless Blender via the `bpy` Python module):
    python render.py --cam desktop --frames 0-149 --out out/desktop

Timeline: 150 frames that map onto the scroll timeline 0–88 of the
homepage sequence (the finale wipe is HTML on top).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import truck as truck_mod  # noqa: E402
import world  # noqa: E402
from lib import key_emission, sky_world  # noqa: E402

N = 150
V = 4.8                  # cruising distance per frame (m)
T_START, T_CRUISE, T_BRAKE = 34, 64, 128
X0 = -3.4                # cab front inside the hall


def smoothstep(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def front_x(f):
    """Cab front position along the road for (fractional) frame f."""
    if f <= T_START:
        return X0
    acc_len = T_CRUISE - T_START
    if f <= T_CRUISE:
        # integral of V * smoothstep(s) ds
        s = (f - T_START) / acc_len
        return X0 + V * acc_len * (s ** 3 - s ** 4 / 2)
    x1 = X0 + V * acc_len * 0.5
    if f <= T_BRAKE:
        return x1 + V * (f - T_CRUISE)
    x2 = x1 + V * (T_BRAKE - T_CRUISE)
    bl = (N - 1) - T_BRAKE
    s = min(1.0, (f - T_BRAKE) / bl)
    # v = V (1 - s)^2  ->  x = V bl (1 - (1 - s)^3) / 3
    return x2 + V * bl * (1 - (1 - s) ** 3) / 3


def speed(f):
    return front_x(f + 0.5) - front_x(f - 0.5)


STOP_X = front_x(N - 1)

# ----------------------------------------------------------------- cameras
# Key = (frame, anchor, pos, target, lens). anchor "T" = relative to the cab
# front (x offset), "W" = world coordinates.
CAMS = {
    "desktop": {
        "res": (1280, 720),
        "keys": [
            (0, "W", (27.0, -21.0, 1.9), (-2.0, -3.0, 5.2), 30),
            (30, "W", (21.0, -16.0, 1.75), (-1.5, -1.5, 4.2), 30),
            (46, "W", (19.0, -16.0, 1.8), ("T", -5.0, 0.0, 3.0), 30),
            (64, "T", (-1.0, -19.0, 2.3), (-8.0, 0.0, 3.2), 35),
            (84, "T", (-9.0, -18.0, 2.1), (-8.5, 0.0, 3.1), 35),
            (96, "T", (3.2, -4.7, 1.05), (-2.6, 0.0, 1.55), 32),
            (106, "T", (1.6, -4.5, 1.0), (-3.4, 0.0, 1.6), 32),
            (120, "T", (2.0, -19.0, 2.4), (-8.0, 0.0, 3.2), 35),
            (138, "W", (STOP_X + 7.5, -12.0, 1.9), (STOP_X - 8.0, 6.0, 3.7), 32),
            (149, "W", (STOP_X + 8.5, -12.8, 2.0), (STOP_X - 8.0, 6.0, 3.7), 32),
        ],
    },
    "mobile": {
        "res": (640, 1136),
        "keys": [
            (0, "W", (16.0, -11.0, 1.6), (-1.0, -1.5, 5.0), 26),
            (30, "W", (12.5, -8.2, 1.5), (-1.5, -0.6, 4.2), 26),
            (46, "W", (12.0, -8.5, 1.6), ("T", -4.0, 0.0, 3.0), 26),
            (64, "T", (6.8, -7.0, 1.6), (-6.0, 0.0, 2.9), 26),
            (84, "T", (5.5, -8.4, 1.7), (-6.5, 0.0, 3.0), 26),
            (96, "T", (2.6, -3.9, 1.0), (-2.2, 0.0, 1.9), 24),
            (106, "T", (1.6, -3.8, 1.0), (-2.8, 0.0, 1.9), 24),
            (120, "T", (6.8, -7.0, 1.6), (-6.0, 0.0, 2.9), 26),
            (138, "W", (STOP_X + 7.0, -8.0, 1.7), (STOP_X - 6.5, 2.5, 3.4), 26),
            (149, "W", (STOP_X + 7.8, -8.6, 1.8), (STOP_X - 6.5, 2.5, 3.4), 26),
        ],
    },
}


def _resolve(v, anchor, f):
    """Evaluate a key position at frame f (truck-relative keys follow the truck)."""
    if isinstance(v[0], str):  # ("T", dx, y, z) inside a world key
        return Vector((front_x(f) + v[1], v[2], v[3]))
    if anchor == "T":
        return Vector((front_x(f) + v[0], v[1], v[2]))
    return Vector(v)


def _catmull(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)


def camera_at(keys, f):
    frames = [k[0] for k in keys]
    i = max(0, min(len(keys) - 2, max(j for j in range(len(keys)) if frames[j] <= f)))
    k1, k2 = keys[i], keys[i + 1]
    k0 = keys[max(0, i - 1)]
    k3 = keys[min(len(keys) - 1, i + 2)]
    t = smoothstep((f - k1[0]) / (k2[0] - k1[0])) * 0.35 + ((f - k1[0]) / (k2[0] - k1[0])) * 0.65
    pos = _catmull(*[_resolve(k[2], k[1], f) for k in (k0, k1, k2, k3)], t)
    tgt = _catmull(*[_resolve(k[3], k[1], f) for k in (k0, k1, k2, k3)], t)
    lens = k1[4] + (k2[4] - k1[4]) * t
    return pos, tgt, lens


# ------------------------------------------------------------------ build

def setup_render(cam_name, samples):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.03
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.max_bounces = 6
    sc.cycles.glossy_bounces = 3
    sc.cycles.transmission_bounces = 4
    sc.cycles.diffuse_bounces = 2
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 1.0
    sc.cycles.sample_clamp_indirect = 8.0
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.15
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = float(os.environ.get("EXPOSURE", 0.7))
    sc.render.resolution_x, sc.render.resolution_y = CAMS[cam_name]["res"]
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_depth = "8"
    sc.render.film_transparent = False
    sc.frame_start, sc.frame_end = 0, N - 1
    sc.render.use_persistent_data = True
    if os.environ.get("THREADS"):
        sc.render.threads_mode = "FIXED"
        sc.render.threads = int(os.environ["THREADS"])


def build(cam_name="desktop", samples=64):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_render(cam_name, samples)
    sky_world(sun_elev_deg=float(os.environ.get("SUN_EL", -2.0)), sun_rot_deg=float(os.environ.get("SUN_ROT", 5)), strength=float(os.environ.get("SKY", 1.2)))

    WM = world.materials()
    TM = truck_mod.materials()
    world.ground(WM)
    world.markings(WM)
    world.median(WM)
    world.delineators(WM)
    world.verge(WM)
    world.gantry(WM)
    world.forest(WM)
    rotors = world.turbines(WM)
    hall = world.start_hall(WM)
    world.hub(WM, TM)
    if float(os.environ.get("HAZE", 0)) > 0:
        world.haze(float(os.environ["HAZE"]))
    T = truck_mod.build(TM)

    cars = []
    for k, (y, x0, v, col, d) in enumerate((
        (11.2, 260, -9.5, 0, -1), (15.4, 330, -8.0, 2, -1), (11.2, 470, -9.0, 1, -1), (15.4, 560, -8.5, 3, -1),
        (11.2, 720, -9.5, 2, -1), (15.4, 900, -8.5, 4, -1), (3.75, -80, 6.2, 1, 1), (3.75, -150, 6.0, 3, 1),
    )):
        c = world.car(WM, f"car{k}", col, d)
        cars.append((c, y, x0, v))

    # --------------------------------------------------------- animate
    sc = bpy.context.scene
    head_on = 16
    for f in range(N):
        x = front_x(f)
        T["root"].location = (x, 0, 0)
        T["root"].keyframe_insert("location", frame=f)
        for w in T["wheels"]:
            w.rotation_euler = (0, x / truck_mod.TIRE_R, 0)
            w.keyframe_insert("rotation_euler", frame=f)
        # suspension: squat on pull-away, dive while braking, road texture
        a = speed(f + 0.5) - speed(f - 0.5)
        pitch = max(-0.006, min(0.008, a * 0.012))
        bob = 0.006 * math.sin(x * 0.9) + 0.004 * math.sin(x * 2.3 + 1.0) if speed(f) > 0.05 else 0.0
        if f > N - 12:  # settle after the stop
            pitch += 0.004 * math.exp(-(f - (N - 12)) * 0.45) * math.sin((f - (N - 12)) * 0.9)
        T["body"].location = (0, 0, bob)
        T["body"].rotation_euler = (0, pitch, 0)
        T["body"].keyframe_insert("location", frame=f)
        T["body"].keyframe_insert("rotation_euler", frame=f)
        for c, y, cx0, v in cars:
            c.location = (cx0 + v * f, y, 0)
            c.keyframe_insert("location", frame=f)
        for r in rotors:
            r.rotation_euler = (f * 0.035, 0, 0)
            r.keyframe_insert("rotation_euler", frame=f)
        # sectional door
        d = smoothstep((f - 18) / 22)
        hall["door"].location = (0, 0, d * (world.DOOR_H + 0.4))
        hall["door"].keyframe_insert("location", frame=f)

    # lights (keyframed once per change)
    M, TMt = WM, TM
    for f in range(N):
        on = lambda start, dur=4: smoothstep((f - start) / dur)
        hl = [on(2 + i * 2.5, 2) for i in range(4)]
        for i, l in enumerate(hall["hall_lights"]):
            l.data.energy = 650 * hl[i // 3]
            l.data.keyframe_insert("energy", frame=f)
        key_emission(M["lamp_hall"], f, 14 * on(2, 8))
        key_emission(M["ribbon"], f, 3.0 * on(2, 8))
        hall["leak"].data.energy = 700 * on(2, 8)
        hall["leak"].data.keyframe_insert("energy", frame=f)
        hall["door_lamp"].data.energy = 1100
        hall["door_lamp"].data.keyframe_insert("energy", frame=f)
        key_emission(M["lamp_cool"], f, 25)
        key_emission(TMt["drl"], f, 30 * on(head_on - 2, 2))
        key_emission(TMt["amber"], f, 10 * on(head_on - 2, 2))
        key_emission(TMt["head"], f, 45 * on(head_on, 3))
        for l in T["lights"]["head"]:
            l.data.energy = 1500 * on(head_on, 3)
            l.data.keyframe_insert("energy", frame=f)
        brake = on(T_BRAKE - 1, 2)
        key_emission(TMt["tail"], f, 5 + 16 * brake)
        for l in T["lights"]["tail"]:
            l.data.energy = (4 + 22 * brake) * on(head_on, 3)
            l.data.keyframe_insert("energy", frame=f)
        key_emission(M["aviation"], f, 30 if (f // 12) % 2 == 0 else 2)

    # ---------------------------------------------------------- camera
    cfg = CAMS[cam_name]
    cd = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    cd.sensor_width = 36
    cd.clip_start = 0.1
    cd.clip_end = 3000
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = 3.2
    cd.dof.aperture_blades = 7
    # soft film light travelling with the camera car (as on real shoots)
    rig = bpy.data.lights.new("rig", "AREA")
    rig.shape = "RECTANGLE"
    rig.size, rig.size_y = 5.0, 2.5
    rig.color = (0.85, 0.9, 1.0)
    rig.energy = 0.0
    rig_o = bpy.data.objects.new("rig", rig)
    sc.collection.objects.link(rig_o)
    # overhead soft box travelling with the truck: never seen directly, only
    # in the reflections of paint and glass (classic car-commercial lighting)
    card = bpy.data.lights.new("card", "AREA")
    card.shape = "RECTANGLE"
    card.size, card.size_y = 14.0, 5.0
    card.color = (0.9, 0.93, 1.0)
    card_o = bpy.data.objects.new("card", card)
    card_o.visible_camera = False
    sc.collection.objects.link(card_o)
    for f in range(N):
        pos, tgt, lens = camera_at(cfg["keys"], f)
        # a hint of hand-held float so the camera never feels robotic
        pos = pos + Vector((0.03 * math.sin(f * 0.21), 0.02 * math.sin(f * 0.13 + 1), 0.025 * math.sin(f * 0.17 + 2)))
        cam.location = pos
        cam.rotation_euler = (tgt - pos).to_track_quat("-Z", "Y").to_euler()
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_euler", frame=f)
        cd.lens = lens
        cd.keyframe_insert("lens", frame=f)
        # focus on the cab
        cab = Vector((front_x(f) - 1.2, 0, 2.0))
        mid = Vector((front_x(f) - 7.0, 0, 2.0))
        lp = pos + (pos - tgt).normalized() * 2.0 + Vector((0, 0, 2.5))
        rig_o.location = lp
        rig_o.rotation_euler = (mid - lp).to_track_quat("-Z", "Y").to_euler()
        rig_o.keyframe_insert("location", frame=f)
        rig_o.keyframe_insert("rotation_euler", frame=f)
        dist = (mid - lp).length
        rig.energy = float(os.environ.get("RIG", 7)) * dist * dist * smoothstep((f - 48) / 14) * (1 - 0.35 * smoothstep((f - 128) / 12))
        rig.keyframe_insert("energy", frame=f)
        card_o.location = (front_x(f) - 5.0, -3.0, 9.0)
        card_o.rotation_euler = (math.radians(-18), 0, 0)
        card_o.keyframe_insert("location", frame=f)
        card.energy = float(os.environ.get("CARD", 2500)) * smoothstep((f - 40) / 16)
        card.keyframe_insert("energy", frame=f)
        cd.dof.focus_distance = (cab - pos).length
        cd.dof.keyframe_insert("focus_distance", frame=f)

    # linear interpolation for all keys – every frame is keyed anyway
    for a in bpy.data.actions:
        for fc in _fcurves(a):
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"
    return T, hall


def _fcurves(action):
    """Blender 4.4+ layered actions keep curves in channelbags."""
    if hasattr(action, "fcurves") and len(getattr(action, "fcurves", [])):
        return list(action.fcurves)
    out = []
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in getattr(strip, "channelbags", []):
                out.extend(bag.fcurves)
    return out
