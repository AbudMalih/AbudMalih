"""Environment for the journey: logistics hall (start), yard, Autobahn,
arrival hub, landscape and traffic. World axes: +X = driving direction,
the truck drives on the right-hand lane centred on y = 0, the camera side
is -Y. Units are metres.
"""

import math
import random

import bmesh
import bpy
from mathutils import Vector

from lib import (area_light, array, asphalt, bevel, box, cylinder, emissive, empty, extrude_profile, mesh_obj,
                 noise_rough, pbr, plane, point_light, spot_light)

RNG = random.Random(7)

HALL_DOOR_X = 0.0          # façade plane of the start hall
DOOR_W, DOOR_H = 4.6, 4.9
HWY_START, HWY_END = 45.0, 340.0
HUB_X0 = 350.0             # start of the hub site


def materials():
    M = {}
    M["asphalt"] = asphalt("asphalt", wet=0.12)
    M["asphalt_yard"] = asphalt("asphalt_yard", wet=0.22, tint=(0.05, 0.05, 0.052))
    M["paint"] = noise_rough(pbr("marking", (0.72, 0.72, 0.7), rough=0.45), 0.35, 0.7, scale=3, bump=0.2)
    M["concrete"] = noise_rough(pbr("concrete", (0.36, 0.355, 0.34), rough=0.8), 0.7, 0.9, scale=2, bump=0.25, bump_scale=40)
    M["floor"] = noise_rough(pbr("hall_floor", (0.3, 0.3, 0.295), rough=0.25, coat=0.3), 0.12, 0.4, scale=0.4, bump=0.05)
    M["cladding"] = cladding("cladding", (0.24, 0.25, 0.27))
    M["cladding_dark"] = cladding("cladding_dark", (0.04, 0.043, 0.047))
    M["ribbon"] = emissive("ribbon", (0.93, 0.96, 1.0), 0.0, base=(0.05, 0.05, 0.05))
    M["plinth"] = noise_rough(pbr("plinth", (0.22, 0.22, 0.215), rough=0.85), 0.75, 0.95, scale=3, bump=0.3)
    M["door"] = cladding("door_panel", (0.33, 0.34, 0.35))
    M["frame"] = pbr("door_frame", (0.04, 0.042, 0.045), rough=0.4, metal=0.6)
    M["shelter"] = pbr("dock_shelter", (0.012, 0.012, 0.012), rough=0.9)
    M["steel"] = noise_rough(pbr("galvanised", (0.55, 0.56, 0.57), rough=0.35, metal=1.0), 0.25, 0.5, scale=6)
    M["rack_blue"] = pbr("rack_upright", (0.015, 0.06, 0.25), rough=0.35, metal=0.3)
    M["rack_orange"] = pbr("rack_beam", (0.75, 0.18, 0.015), rough=0.35, metal=0.2)
    M["cardboard"] = noise_rough(pbr("cardboard", (0.4, 0.28, 0.16), rough=0.85), 0.75, 0.95, scale=10, bump=0.2)
    M["wrap"] = pbr("wrapped", (0.62, 0.6, 0.56), rough=0.3, coat=0.5)
    M["pallet"] = pbr("pallet_wood", (0.36, 0.27, 0.16), rough=0.85)
    M["grass"] = grass()
    M["foliage"] = noise_rough(pbr("foliage", (0.018, 0.03, 0.012), rough=0.75), 0.6, 0.85, scale=2, bump=0.5, bump_scale=8)
    M["bark"] = pbr("bark", (0.05, 0.04, 0.03), rough=0.9)
    M["leaves"] = leaves()
    M["needles"] = leaves("needles", 6.0, (0.008, 0.018, 0.01), (0.02, 0.035, 0.018))
    M["blades"] = noise_rough(pbr("blades", (0.02, 0.03, 0.01), rough=0.7), 0.55, 0.85, scale=4)
    M["sign_blue"] = pbr("sign_blue", (0.0, 0.05, 0.3), rough=0.35)
    M["sign_white"] = emissive("sign_white", (1, 1, 1), 0.4, base=(0.8, 0.8, 0.8))
    M["reflector"] = emissive("delineator_reflector", (1.0, 0.6, 0.1), 3.0, base=(0.6, 0.3, 0.0))
    M["post_white"] = pbr("delineator", (0.75, 0.75, 0.74), rough=0.5)
    M["black"] = pbr("black", (0.01, 0.01, 0.01), rough=0.6)
    M["lamp_warm"] = emissive("lamp_warm", (1.0, 0.78, 0.52), 60.0, base=(0.9, 0.9, 0.9))
    M["lamp_cool"] = emissive("lamp_cool", (0.92, 0.95, 1.0), 0.0, base=(0.9, 0.9, 0.9))
    M["lamp_hall"] = emissive("lamp_hall", (0.95, 0.97, 1.0), 0.0, base=(0.9, 0.9, 0.9))
    M["window_warm"] = emissive("window_warm", (1.0, 0.85, 0.65), 2.5, base=(0.05, 0.05, 0.05))
    M["window_dim"] = emissive("window_dim", (0.95, 0.9, 0.8), 1.2, base=(0.05, 0.05, 0.05))
    M["car_paint"] = [pbr(f"car{i}", c, rough=0.25, metal=0.5, coat=1.0) for i, c in
                      enumerate([(0.3, 0.31, 0.33), (0.02, 0.02, 0.025), (0.55, 0.56, 0.58), (0.08, 0.1, 0.16), (0.25, 0.02, 0.02)])]
    M["car_glass"] = pbr("car_glass", (0.005, 0.005, 0.006), rough=0.03, coat=1.0)
    M["head_on"] = emissive("car_head", (1.0, 0.95, 0.85), 80.0, base=(0.9, 0.9, 0.9))
    M["tail_on"] = emissive("car_tail", (1.0, 0.02, 0.01), 25.0, base=(0.3, 0.0, 0.0))
    M["aviation"] = emissive("aviation", (1.0, 0.02, 0.0), 0.0, base=(0.2, 0.0, 0.0))
    M["turbine"] = pbr("turbine", (0.45, 0.46, 0.47), rough=0.5)
    return M


def cladding(name="cladding", color=(0.42, 0.44, 0.46)):
    """Horizontal sandwich panels: fine ribs (bump) plus darker panel joints
    every ~1 m, slightly varied per panel like real façades."""
    m = noise_rough(pbr(name, color, rough=0.34, metal=0.8), 0.26, 0.46, scale=1.5)
    n, l = m.node_tree.nodes, m.node_tree.links
    b = n["Principled BSDF"]
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Object"], sep.inputs["Vector"])
    ribs = n.new("ShaderNodeMath")
    ribs.operation = "SINE"
    mul = n.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = 2 * math.pi / 0.2  # 20 cm rib pitch
    l.new(sep.outputs["Z"], mul.inputs[0])
    l.new(mul.outputs["Value"], ribs.inputs[0])
    # panel joints (1 m pitch)
    fr = n.new("ShaderNodeMath")
    fr.operation = "FRACT"
    l.new(sep.outputs["Z"], fr.inputs[0])
    joint = n.new("ShaderNodeMapRange")
    joint.inputs["From Min"].default_value = 0.0
    joint.inputs["From Max"].default_value = 0.012
    l.new(fr.outputs["Value"], joint.inputs["Value"])
    h = n.new("ShaderNodeMath")
    h.operation = "MULTIPLY_ADD"
    h.inputs[1].default_value = 0.15
    l.new(ribs.outputs["Value"], h.inputs[0])
    l.new(joint.outputs["Result"], h.inputs[2])
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.01
    l.new(h.outputs["Value"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    col = n.new("ShaderNodeMix")
    col.data_type = "RGBA"
    col.inputs["A"].default_value = (color[0] * 0.25, color[1] * 0.25, color[2] * 0.25, 1)
    col.inputs["B"].default_value = (*color, 1)
    l.new(joint.outputs["Result"], col.inputs["Factor"])
    l.new(col.outputs["Result"], b.inputs["Base Color"])
    return m


def leaves(name="leaves", scale=7.0, c0=(0.012, 0.022, 0.008), c1=(0.04, 0.05, 0.018)):
    """Leaf-card material: clustered leaf shapes cut out with alpha."""
    m = pbr(name, (0.02, 0.034, 0.012), rough=0.7)
    n, l = m.node_tree.nodes, m.node_tree.links
    b = n["Principled BSDF"]
    tc = n.new("ShaderNodeTexCoord")
    vor = n.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = scale
    l.new(tc.outputs["UV"], vor.inputs["Vector"])
    edge = n.new("ShaderNodeMapRange")
    edge.inputs["From Min"].default_value = 0.2
    edge.inputs["From Max"].default_value = 0.34
    edge.inputs["To Min"].default_value = 1.0
    edge.inputs["To Max"].default_value = 0.0
    l.new(vor.outputs["Distance"], edge.inputs["Value"])
    # fade the card borders so no square edges show
    grad = n.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Location"].default_value = (-0.5, -0.5, 0)
    mp.inputs["Scale"].default_value = (2.0, 2.0, 2.0)
    l.new(tc.outputs["UV"], mp.inputs["Vector"])
    # mapping order: scale then translate -> use location after scale
    mp.inputs["Location"].default_value = (-1.0, -1.0, 0)
    l.new(mp.outputs["Vector"], grad.inputs["Vector"])
    mul = n.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    l.new(edge.outputs["Result"], mul.inputs[0])
    l.new(grad.outputs["Fac"], mul.inputs[1])
    thr = n.new("ShaderNodeMath")
    thr.operation = "GREATER_THAN"
    thr.inputs[1].default_value = 0.05
    l.new(mul.outputs["Value"], thr.inputs[0])
    l.new(thr.outputs["Value"], b.inputs["Alpha"])
    # colour variation per card
    obj = n.new("ShaderNodeObjectInfo")
    rnd = n.new("ShaderNodeTexNoise")
    rnd.inputs["Scale"].default_value = 0.8
    l.new(tc.outputs["Object"], rnd.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*c0, 1)
    ramp.color_ramp.elements[1].color = (*c1, 1)
    l.new(rnd.outputs["Fac"], ramp.inputs["Fac"])
    l.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return m


def grass():
    m = noise_rough(pbr("grass", (0.03, 0.045, 0.018), rough=0.9, spec=0.3), 0.8, 0.95, scale=0.5, bump=0.6, bump_scale=35)
    n, l = m.node_tree.nodes, m.node_tree.links
    b = n["Principled BSDF"]
    tc = n.new("ShaderNodeTexCoord")
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 0.15
    nz.inputs["Detail"].default_value = 6
    l.new(tc.outputs["Object"], nz.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.009, 0.014, 0.005, 1)
    ramp.color_ramp.elements[1].color = (0.03, 0.028, 0.014, 1)
    l.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    l.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return m


def ground(M):
    # yard / apron around the hall
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    bmesh.ops.scale(bm, vec=(90, 70, 1), verts=bm.verts)
    mesh_obj("yard", bm, M["asphalt_yard"], loc=(10, -2, 0))
    # carriageways
    road = lambda nm, x0, x1, y0, y1, mat: box(nm, (x1 - x0, y1 - y0, 0.1), ((x0 + x1) / 2, (y0 + y1) / 2, -0.045), mat)
    road("hwy_main", 50, HUB_X0 - 40, -4.4, 5.9, M["asphalt"])
    road("hwy_opposite", 50, HWY_END - 5, 8.9, 19.2, M["asphalt"])
    road("hub_yard", HUB_X0 - 60, HUB_X0 + 150, -16, 42, M["asphalt_yard"])
    # grass verges / fields
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    bmesh.ops.scale(bm, vec=(1600, 1400, 1), verts=bm.verts)
    g = mesh_obj("fields", bm, M["grass"], loc=(250, 0, -0.08))
    # gentle terrain far away
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=160, y_segments=40, size=0.5)
    bmesh.ops.scale(bm, vec=(2400, 600, 1), verts=bm.verts)
    hills = mesh_obj("hills", bm, M["grass"], loc=(250, 520, -0.5))
    tex = bpy.data.textures.new("hills", "CLOUDS")
    tex.noise_scale = 180
    d = hills.modifiers.new("disp", "DISPLACE")
    d.texture = tex
    d.strength = 38
    d.mid_level = 0.35


def markings(M):
    """German Autobahn markings: 0.30 m edge lines, 6 m dashes / 12 m gaps."""
    def line(nm, x0, x1, y, w):
        return box(nm, (x1 - x0, w, 0.012), ((x0 + x1) / 2, y, 0.012), M["paint"])
    line("edge_r", 50, HWY_END + 40, -1.95, 0.3)
    line("edge_l", 50, HWY_END - 5, 5.55, 0.3)
    dash = box("dash", (6, 0.15, 0.012), (60, 1.875, 0.012), M["paint"])
    array(dash, int((HWY_END - 60) / 18), (18, 0, 0))
    line("opp_edge_l", 50, HWY_END - 5, 9.35, 0.3)
    line("opp_edge_r", 50, HWY_END - 5, 18.6, 0.3)
    dash2 = box("dash_opp", (6, 0.15, 0.012), (64, 13.1, 0.012), M["paint"])
    array(dash2, int((HWY_END - 64) / 18), (18, 0, 0))
    # yard: stop line and parking bays at the hub
    for k in range(25):
        box(f"bay_line{k}", (0.15, 14, 0.012), (HUB_X0 + 15.9 + k * 4.2, 27.5, 0.012), M["paint"])


def median(M):
    """Concrete step barrier (Betonschutzwand) with glare screen lamp posts."""
    prof = [(-0.3, 0.0), (0.3, 0.0), (0.3, 0.08), (0.2, 0.2), (0.1, 0.9), (0.08, 1.05),
            (-0.08, 1.05), (-0.1, 0.9), (-0.2, 0.2), (-0.3, 0.08)]
    seg = extrude_profile("barrier", prof, HWY_END - 55, M["concrete"], axis="X", loc=((HWY_END + 55) / 2, 7.4, 0))
    bevel(seg, 0.01, 1, angle=math.radians(30), harden=False)
    # highway lighting on the median, every 48 m
    x = 70.0
    k = 0
    while x < HWY_END - 10:
        mast = cylinder(f"mast{k}", 0.11, 11.5, (x, 7.4, 5.75 + 1.05), axis="Z", mat=M["steel"], seg=16, r2=0.075)
        for sy in (-1, 1):
            arm = box(f"arm{k}{sy}", (0.12, 2.2, 0.1), (x, 7.4 + sy * 1.05, 12.2), M["steel"], bev=0.02)
            head = box(f"lum{k}{sy}", (0.7, 0.35, 0.12), (x, 7.4 + sy * 2.1, 12.15), M["steel"], bev=0.04)
            box(f"lumg{k}{sy}", (0.6, 0.28, 0.02), (x, 7.4 + sy * 2.1, 12.08), M["lamp_warm"])
            spot_light(f"hwy_light{k}{sy}", (x, 7.4 + sy * 2.1, 12.0), (0, 0, 0), 5200, 125, 0.7, (1.0, 0.78, 0.52), 0.25)
        x += 48
        k += 1


def delineators(M):
    """Leitpfosten: white posts with a black band and amber reflector."""
    post = box("leitpfosten", (0.12, 0.1, 1.0), (52, -3.6, 0.5), M["post_white"], bev=0.02)
    array(post, int((HWY_END - 52) / 25), (25, 0, 0))
    band = box("leit_band", (0.125, 0.105, 0.25), (52, -3.6, 0.83), M["black"])
    array(band, int((HWY_END - 52) / 25), (25, 0, 0))
    refl = box("leit_refl", (0.02, 0.06, 0.14), (52.065, -3.6, 0.83), M["reflector"])
    array(refl, int((HWY_END - 52) / 25), (25, 0, 0))


def gantry(M, x=205.0):
    """Sign gantry across the carriageway with two blue direction signs."""
    for y in (-4.2, 7.0):
        cylinder(f"gantry_leg{y}", 0.3, 7.2, (x, y, 3.6), axis="Z", mat=M["steel"], seg=20)
    for dz in (6.4, 7.6):
        cylinder(f"gantry_chord{dz}", 0.12, 11.6, (x, 1.4, dz), axis="Y", mat=M["steel"], seg=12)
    for k in range(11):
        d = box(f"gantry_diag{k}", (0.06, 0.06, 1.55), (x, -4.0 + k * 1.08, 7.0), M["steel"])
        d.rotation_euler = (math.radians(38 if k % 2 else -38), 0, 0)
    for k, (y, label, arrow) in enumerate(((0.0, "Hannover", "↓"), (3.8, "Kassel", "↓"))):
        box(f"sign{k}", (0.08, 3.4, 1.8), (x - 0.25, y, 5.3), M["sign_blue"], bev=0.02)
        box(f"sign_border{k}", (0.07, 3.3, 1.7), (x - 0.27, y, 5.3), M["sign_white"])
        box(f"sign_inner{k}", (0.07, 3.2, 1.6), (x - 0.29, y, 5.3), M["sign_blue"])
        cu = bpy.data.curves.new(f"sign_text{k}", "FONT")
        cu.body = label
        cu.size = 0.5
        cu.align_x = "CENTER"
        cu.extrude = 0.005
        t = bpy.data.objects.new(f"sign_text{k}", cu)
        t.location = (x - 0.34, y, 5.35)
        t.rotation_euler = (math.radians(90), 0, math.radians(-90))
        t.data.materials.append(M["sign_white"])
        bpy.context.scene.collection.objects.link(t)
        a = box(f"sign_arrow{k}", (0.02, 0.1, 0.45), (x - 0.34, y, 4.85), M["sign_white"])


def tree_proto(M, name, h, r, kind="broad"):
    """Irregular tree silhouettes: broadleaf crowns built from many small
    displaced clumps, or spruces from stacked ragged cones."""
    root = empty(name, (0, 0, -500))
    cylinder(name + "_trunk", 0.08 * r, h * 0.45, (0, 0, h * 0.22), axis="Z", mat=M["bark"], parent=root, seg=8)
    tex = bpy.data.textures.get("leaves") or bpy.data.textures.new("leaves", "CLOUDS")
    tex.noise_scale = 0.22
    tex.noise_depth = 4
    def cards(nm, pts, mat):
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new()
        for c, ax, bx in pts:
            cs = [c - ax - bx, c + ax - bx, c + ax + bx, c - ax + bx]
            f = bm.faces.new([bm.verts.new(p) for p in cs])
            for loop, (uu, vv) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
                loop[uv].uv = (uu, vv)
        return mesh_obj(nm, bm, mat, root)

    if kind == "spruce":
        # drooping branch cards arranged around a cone, denser near the trunk
        pts = []
        for i in range(2600):
            t = RNG.random() ** 0.8
            z = h * (0.12 + t * 0.86)
            rad = r * (1 - t) ** 1.05 * RNG.uniform(0.35, 1.0)
            a = RNG.uniform(0, 2 * math.pi)
            c = Vector((math.cos(a) * rad, math.sin(a) * rad, z))
            out = Vector((math.cos(a), math.sin(a), -0.35)).normalized()
            side = Vector((-math.sin(a), math.cos(a), 0))
            sz = RNG.uniform(0.5, 0.9) * (0.45 + (1 - t))
            pts.append((c, out * sz, side * sz * 0.6))
        cards(name + "_needles", pts, M["needles"])
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=r * 0.7, radius2=0.02, depth=h * 0.82)
        mesh_obj(name + "_core", bm, M["foliage"], root, (0, 0, h * 0.52), smooth=True)
        return root
    # leaf cards: many small alpha-textured quads give airy, irregular edges
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    lobes = [Vector((RNG.uniform(-0.55, 0.55) * r, RNG.uniform(-0.55, 0.55) * r, h * 0.55 + RNG.uniform(-0.45, 0.5) * r))
             for _ in range(7)]
    for i in range(2200):
        # denser towards the crown surface, clustered into irregular lobes
        u, v = RNG.uniform(0, 2 * math.pi), RNG.uniform(-1, 1)
        rad = r * 0.75 * (RNG.random() ** 0.35)
        lobe = lobes[i % len(lobes)]
        c = lobe + Vector((math.cos(u) * math.sqrt(1 - v * v) * rad, math.sin(u) * math.sqrt(1 - v * v) * rad, v * rad * 0.8))
        sz = RNG.uniform(0.35, 0.7) * (r / 3.0) ** 0.5
        ax = Vector((RNG.uniform(-1, 1), RNG.uniform(-1, 1), RNG.uniform(-1, 1))).normalized()
        bx = ax.cross(Vector((0.3, 0.2, 1))).normalized()
        cs = [c - ax * sz - bx * sz, c + ax * sz - bx * sz, c + ax * sz + bx * sz, c - ax * sz + bx * sz]
        f = bm.faces.new([bm.verts.new(p) for p in cs])
        for loop, (uu, vv) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop[uv].uv = (uu, vv)
    mesh_obj(name + "_leaves", bm, M["leaves"], root)
    # a dark inner core so the crown is not see-through
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r * 0.7)
    mesh_obj(name + "_core", bm, M["foliage"], root, (0, 0, h * 0.55), smooth=True).scale = (0.95, 0.95, 0.85)
    return root


def forest(M):
    """Tree lines as instanced collections (cheap to render)."""
    protos = []
    for i, (h, r, kind) in enumerate(((16, 3.4, "broad"), (12, 2.8, "broad"), (21, 4.2, "broad"), (18, 2.6, "spruce"),
                                      (14, 2.2, "spruce"), (10, 2.4, "broad"))):
        coll = bpy.data.collections.new(f"tree{i}")
        root = tree_proto(M, f"tree{i}", h, r, kind)
        for o in [root, *root.children_recursive]:
            for c in o.users_collection:
                c.objects.unlink(o)
            coll.objects.link(o)
        root.location = (0, 0, 0)
        protos.append(coll)

    def inst(coll, loc, s, rot):
        o = bpy.data.objects.new("tree_inst", None)
        o.instance_type = "COLLECTION"
        o.instance_collection = coll
        o.location = loc
        o.scale = (s, s, s)
        o.rotation_euler = (0, 0, rot)
        bpy.context.scene.collection.objects.link(o)

    # far side belts (behind opposite carriageway) and camera-side scattered trees
    for band, (y0, y1, step) in enumerate(((34, 60, 4.5), (60, 130, 5.5), (-80, -50, 8.0))):
        x = -80.0
        while x < 520:
            tx, ty = x + RNG.uniform(-3, 3), RNG.uniform(y0, y1)
            if not (HUB_X0 - 25 < tx < HUB_X0 + 175 and -12 < ty < 90):
                inst(RNG.choice(protos), (tx, ty, 0), RNG.uniform(0.8, 1.25), RNG.uniform(0, 6.28))
            x += step * RNG.uniform(0.6, 1.3)
    # dense screen between highway and hub (hides the transition)
    x = HWY_END - 30
    while x < HUB_X0 - 22:
        inst(RNG.choice(protos), (x, RNG.uniform(22, 30), 0), RNG.uniform(0.9, 1.2), RNG.uniform(0, 6.28))
        x += 4


def turbines(M):
    blades = []
    for k, (x, y, s) in enumerate(((120, 620, 1.0), (260, 700, 0.9), (410, 640, 1.05))):
        h = 110 * s
        cylinder(f"tower{k}", 2.2 * s, h, (x, y, h / 2), axis="Z", mat=M["turbine"], seg=24, r2=1.3 * s)
        box(f"nacelle{k}", (8 * s, 3 * s, 3 * s), (x, y, h + 1), M["turbine"], bev=0.8)
        hub = empty(f"rotor{k}", (x - 4.5 * s, y, h + 1))
        for b in range(3):
            bl = box(f"blade{k}{b}", (0.5, 2.4 * s, 55 * s), (0, 0, 27 * s), M["turbine"])
            piv = empty(f"blade_piv{k}{b}", (0, 0, 0), hub)
            piv.rotation_euler = (b * 2 * math.pi / 3, 0, 0)
            bl.parent = piv
        box(f"aviation{k}", (0.6, 0.6, 0.4), (x, y, h + 2.8), M["aviation"])
        blades.append(hub)
    return blades


# ------------------------------------------------------------------ halls

def hall(M, name, x0, x1, y0, y1, h, doors, drive_door=None, lit=True):
    """Logistics building. Façade facing +X (drive_door) or -Y (docks)."""
    root = empty(name)
    t = 0.3
    L, W = x1 - x0, y1 - y0
    xc, yc = (x0 + x1) / 2, (y0 + y1) / 2
    box(name + "_roof", (L + 0.6, W + 0.6, 0.5), (xc, yc, h + 0.25), M["cladding_dark"], root)
    box(name + "_attic", (L + 0.8, W + 0.8, 0.35), (xc, yc, h + 0.55), M["frame"], root, bev=0.03)
    box(name + "_back", (t, W, h), (x0, yc, h / 2), M["cladding"], root)
    box(name + "_side_far", (L, t, h), (xc, y1, h / 2), M["cladding"], root)
    if drive_door is not None:
        # façade at x1 with an opening for the drive-through door
        dy0, dy1 = drive_door - DOOR_W / 2, drive_door + DOOR_W / 2
        box(name + "_side_near", (L, t, h), (xc, y0, h / 2), M["cladding"], root)
        box(name + "_fa_l", (t, dy0 - y0, h), (x1, (y0 + dy0) / 2, h / 2), M["cladding"], root)
        box(name + "_fa_r", (t, y1 - dy1, h), (x1, (dy1 + y1) / 2, h / 2), M["cladding"], root)
        box(name + "_fa_top", (t, DOOR_W, h - DOOR_H), (x1, drive_door, DOOR_H + (h - DOOR_H) / 2), M["cladding"], root)
        # plinth
        box(name + "_plinth_l", (0.1, dy0 - y0, 1.0), (x1 + 0.2, (y0 + dy0) / 2, 0.5), M["plinth"], root)
        box(name + "_plinth_r", (0.1, y1 - dy1, 1.0), (x1 + 0.2, (dy1 + y1) / 2, 0.5), M["plinth"], root)
        # door frame and yellow/black bump posts
        for sy, y in ((-1, dy0), (1, dy1)):
            box(f"{name}_jamb{sy}", (0.35, 0.18, DOOR_H + 0.2), (x1 + 0.15, y + sy * 0.09, (DOOR_H + 0.2) / 2), M["frame"], root)
            cylinder(f"{name}_bollard{sy}", 0.14, 1.2, (x1 + 0.6, y + sy * 0.35, 0.6), axis="Z", mat=M["door"], parent=root, seg=24)
        box(name + "_header", (0.35, DOOR_W + 0.36, 0.25), (x1 + 0.15, drive_door, DOOR_H + 0.12), M["frame"], root)
        # canopy lamp above the door
        box(name + "_door_lamp", (0.5, 1.2, 0.12), (x1 + 0.5, drive_door, DOOR_H + 0.9), M["frame"], root, bev=0.03)
        box(name + "_door_lamp_g", (0.42, 1.1, 0.02), (x1 + 0.5, drive_door, DOOR_H + 0.83), M["lamp_cool"], root)
        # ribbon of clerestory windows (glow once hall lights are on)
        box(name + "_ribbon_l", (0.05, dy0 - y0 - 2, 1.0), (x1 + 0.17, (y0 + dy0) / 2, h - 2.2), M["ribbon"], root)
        box(name + "_ribbon_r", (0.05, y1 - dy1 - 2, 1.0), (x1 + 0.17, (dy1 + y1) / 2, h - 2.2), M["ribbon"], root)
    else:
        box(name + "_fa", (L, t, h), (xc, y0, h / 2), M["cladding"], root)
        box(name + "_side_x1", (t, W, h), (x1, yc, h / 2), M["cladding"], root)
        box(name + "_plinth", (L, 0.1, 1.2), (xc, y0 - 0.2, 0.6), M["plinth"], root)
        box(name + "_ribbon", (L - 6, 0.05, 0.9), (xc, y0 - 0.17, h - 2.0), M["window_dim"] if lit else M["black"], root)
    # dock doors (on the -Y façade for the hub, on the +X façade for the start hall)
    for i, pos in enumerate(doors):
        if drive_door is not None:
            dock(M, f"{name}_dock{i}", (x1 + 0.15, pos, 0), "+X", root)
        else:
            dock(M, f"{name}_dock{i}", (pos, y0 - 0.15, 0), "-Y", root)
    return root


def dock(M, name, loc, facing, parent):
    x, y, _ = loc
    if facing == "+X":
        box(name + "_shelter", (0.6, 3.6, 3.9), (x + 0.3, y, 2.95), M["shelter"], parent, bev=0.05)
        box(name + "_door", (0.08, 2.9, 2.9), (x + 0.62, y, 2.55), M["door"], parent)
        box(name + "_leveller", (1.2, 2.6, 0.15), (x + 0.6, y, 1.1), M["frame"], parent)
        box(name + "_bumper", (0.15, 2.8, 0.3), (x + 0.65, y, 0.95), M["black"], parent)
        box(name + "_lamp", (0.3, 0.5, 0.2), (x + 0.4, y + 2.0, 4.8), M["lamp_cool"], parent)
    else:
        box(name + "_shelter", (3.6, 0.6, 3.9), (x, y - 0.3, 2.95), M["shelter"], parent, bev=0.05)
        box(name + "_door", (2.9, 0.08, 2.9), (x, y - 0.62, 2.55), M["door"], parent)
        box(name + "_bumper", (2.8, 0.15, 0.3), (x, y - 0.65, 0.95), M["black"], parent)
        box(name + "_lampbox", (0.6, 0.35, 0.18), (x, y - 0.35, 5.2), M["frame"], parent, bev=0.03)
        box(name + "_lampg", (0.5, 0.3, 0.02), (x, y - 0.35, 5.1), M["lamp_warm"], parent)
        spot_light(name + "_light", (x, y - 0.6, 5.0), (math.radians(-20), 0, 0), 900, 120, 0.8, (1.0, 0.8, 0.6), 0.2)


def racking(M, x0, x1, y, levels=4, parent=None, name="rack"):
    """Pallet racking (blue uprights, orange beams) with loaded pallets."""
    bay = 2.8
    n = int((x1 - x0) / bay)
    for sy in (-0.55, 0.55):
        up = box(f"{name}_up{sy}", (0.1, 0.08, 9.0), (x0, y + sy, 4.5), M["rack_blue"], parent)
        array(up, n + 1, (bay, 0, 0))
    for k in range(levels):
        z = 0.2 + k * 2.2
        for sy in (-0.55, 0.55):
            b = box(f"{name}_beam{k}{sy}", (bay - 0.1, 0.05, 0.12), (x0 + bay / 2, y + sy, z + 1.9), M["rack_orange"], parent)
            array(b, n, (bay, 0, 0))
        for i in range(n):
            for j in range(2):
                if RNG.random() < 0.18:
                    continue
                px = x0 + i * bay + 0.75 + j * 1.3
                box(f"{name}_pal{k}{i}{j}", (1.2, 0.8, 0.14), (px, y, z + 0.07 + (0 if k == 0 else 1.98)), M["pallet"], parent)
                hh = RNG.uniform(1.0, 1.55)
                zb = z + (0 if k == 0 else 1.98) + 0.14 + hh / 2
                box(f"{name}_load{k}{i}{j}", (1.18, 0.78, hh), (px, y, zb), M["wrap"] if RNG.random() < 0.45 else M["cardboard"], parent, bev=0.02)


def start_hall(M):
    """Start hall: x from -58 to 0, the truck waits inside behind the door."""
    root = hall(M, "hall", -58, HALL_DOOR_X, -16, 22, 12.5, doors=(-9.0, -13.0), drive_door=0.0)
    box("hall_floor", (58, 38, 0.1), (-29, 3, 0.0), M["floor"], root)
    # interior lighting: rows of LED high-bay fixtures (animated)
    fix = box("hall_fixture", (1.2, 0.35, 0.08), (-4, -8, 10.8), M["lamp_hall"], root)
    array(fix, 8, (-6.5, 0, 0))
    fix2 = box("hall_fixture2", (1.2, 0.35, 0.08), (-4, 0.5, 10.8), M["lamp_hall"], root)
    array(fix2, 8, (-6.5, 0, 0))
    fix3 = box("hall_fixture3", (1.2, 0.35, 0.08), (-4, 9, 10.8), M["lamp_hall"], root)
    array(fix3, 8, (-6.5, 0, 0))
    hall_lights = []
    for i in range(4):
        for y in (-6, 3, 12):
            hall_lights.append(area_light(f"hall_area{i}{y}", (-6 - i * 12, y, 10.6), (0, 0, 0), 0.0, (6, 3),
                                          (0.93, 0.96, 1.0)))
    # racking along both sides and at the back
    racking(M, -54, -8, -12.5, parent=root, name="rackA")
    racking(M, -54, -12, 7.5, parent=root, name="rackB")
    racking(M, -54, -14, 14.5, parent=root, name="rackC")
    # floor markings: yellow walkway lines
    ymat = pbr("floor_yellow", (0.75, 0.5, 0.02), rough=0.4)
    for y in (-2.9, 2.9):
        box(f"walk{y}", (40, 0.1, 0.01), (-24, y, 0.055), ymat, root)
    # the drive-through sectional door (animated upwards)
    door = empty("door")
    for k in range(5):
        box(f"door_panel{k}", (0.06, DOOR_W, DOOR_H / 5 - 0.02), (-0.12, 0, DOOR_H / 10 + k * DOOR_H / 5), M["door"], door, bev=0.008)
        if k == 3:
            for j in range(5):
                box(f"door_win{j}", (0.07, 0.6, 0.35), (-0.12, -1.8 + j * 0.9, DOOR_H / 10 + k * DOOR_H / 5), M["lamp_hall"], door, bev=0.02)
    # light leaking under/around the door once the hall is lit
    leak = area_light("door_leak", (-0.4, 0, 2.4), (0, math.radians(-90), 0), 0.0, (4.4, 4.6), (0.93, 0.96, 1.0))
    door_lamp = spot_light("door_lamp", (0.6, 0.0, DOOR_H + 0.8), (0, 0, 0), 0.0, 110, 0.8, (0.92, 0.95, 1.0), 0.3)
    # yard lamp masts
    masts = [(14, -18), (40, 18), (-10, -26)]
    for k, (x, y) in enumerate(masts):
        cylinder(f"yard_mast{k}", 0.16, 14, (x, y, 7), axis="Z", mat=M["steel"], seg=16, r2=0.1)
        box(f"yard_head{k}", (0.9, 0.5, 0.2), (x, y, 14.1), M["steel"], bev=0.04)
        box(f"yard_headg{k}", (0.8, 0.4, 0.02), (x, y, 13.99), M["lamp_warm"])
        spot_light(f"yard_light{k}", (x, y, 13.9), (0, 0, 0), 9000, 130, 0.8, (1.0, 0.8, 0.58), 0.3)
    # a couple of parked trailers on the start hall docks
    return {"door": door, "hall_lights": hall_lights, "leak": leak, "door_lamp": door_lamp}


def parked_trailer(M, TM, name, loc, rot=0.0):
    """Unbranded white trailer parked at a dock (no tractor)."""
    root = empty(name, loc)
    root.rotation_euler = (0, 0, rot)
    box(name + "_box", (13.6, 2.55, 2.78), (0, 0, 2.6), TM["white"], root, bev=0.05, seg=3)
    for sy in (-1, 1):
        box(f"{name}_rail{sy}", (13.6, 0.03, 0.2), (0, sy * 1.285, 1.25), TM["alu_brushed"], root)
        box(f"{name}_skirt{sy}", (6.6, 0.025, 0.62), (0.6, sy * 1.23, 0.86), TM["white"], root)
        for i, x in enumerate((-4.3, -5.61, -6.92)):
            cylinder(f"{name}_tire{sy}{i}", 0.535, 0.385, (x, sy * 0.97, 0.535), axis="Y", mat=TM["rubber"], parent=root, seg=32)
            cylinder(f"{name}_rim{sy}{i}", 0.29, 0.39, (x, sy * 0.97, 0.535), axis="Y", mat=TM["alu"], parent=root, seg=32)
        box(f"{name}_leg{sy}", (0.12, 0.12, 0.85), (3.6, sy * 0.85, 0.72), TM["plastic"], root)
    box(name + "_sub", (12.5, 1.9, 0.22), (0, 0, 1.08), TM["steel_dark"], root)
    box(name + "_rear", (0.06, 2.56, 2.8), (-6.82, 0, 2.6), TM["alu_brushed"], root)
    for k, y in enumerate((-0.95, -0.35, 0.35, 0.95)):
        cylinder(f"{name}_bar{k}", 0.018, 2.6, (-6.86, y, 2.62), axis="Z", mat=TM["chrome"], parent=root, seg=10)
    for sy in (-1, 1):
        box(f"{name}_tl{sy}", (0.04, 0.42, 0.15), (-6.86, sy * 0.95, 0.95), TM["tail"], root)
    return root


def hub(M, TM):
    """Arrival hub: long cross-dock building parallel to the road (+Y side)."""
    x0, x1 = HUB_X0 + 10, HUB_X0 + 140
    y0 = 36.0
    docks = [x0 + 8 + i * 4.2 for i in range(24)]
    hall(M, "hub", x0, x1, y0, y0 + 42, 13.0, docks, lit=True)
    # trailers parked at some docks (backed in, rear to the façade)
    for k, i in enumerate((1, 2, 5, 9, 10, 14)):
        parked_trailer(M, TM, f"docked{k}", (docks[i], y0 - 1.2 - 6.8, 0), math.radians(-90))
    # office block
    box("hub_office", (18, 10, 9), (x0 - 6, y0 + 6, 4.5), M["cladding_dark"])
    box("hub_office_win", (17, 0.05, 1.6), (x0 - 6, y0 + 0.97, 6.4), M["window_warm"])
    box("hub_office_win2", (17, 0.05, 1.6), (x0 - 6, y0 + 0.97, 3.2), M["window_warm"])
    # flood-light masts in the yard
    for k, (x, y) in enumerate(((HUB_X0 + 5, 12), (HUB_X0 + 62, 16), (HUB_X0 + 90, 14), (HUB_X0 + 130, 16), (HUB_X0 + 25, -8))):
        cylinder(f"hub_mast{k}", 0.2, 18, (x, y, 9), axis="Z", mat=M["steel"], seg=16, r2=0.12)
        for sy in (-1, 1):
            box(f"hub_flood{k}{sy}", (0.7, 0.2, 0.5), (x + sy * 0.5, y, 17.8), M["steel"], bev=0.04)
            box(f"hub_floodg{k}{sy}", (0.6, 0.02, 0.4), (x + sy * 0.5, y - 0.11, 17.8), M["lamp_warm"])
        spot_light(f"hub_light{k}", (x, y - 0.3, 17.6), (math.radians(28), 0, 0), 22000, 120, 0.7, (1.0, 0.82, 0.62), 0.4)


# --------------------------------------------------------------- traffic

def car(M, name, color_idx, direction=1):
    """Generic passenger car silhouette – only seen at speed in the distance."""
    root = empty(name)
    body = [(2.3, 0.35), (2.35, 0.75), (1.1, 0.95), (0.3, 1.42), (-1.0, 1.45), (-1.9, 1.05), (-2.3, 0.95), (-2.3, 0.35)]
    b = extrude_profile(name + "_body", body, 1.82, M["car_paint"][color_idx], root)
    bevel(b, 0.12, 3, angle=math.radians(25))
    g = [(1.0, 0.98), (0.28, 1.38), (-0.95, 1.4), (-1.75, 1.06)]
    gl = extrude_profile(name + "_glass", g, 1.84, M["car_glass"], root)
    for sx in (1.45, -1.5):
        for sy in (-1, 1):
            cylinder(f"{name}_w{sx}{sy}", 0.33, 0.22, (sx, sy * 0.8, 0.33), axis="Y", mat=M["black"], parent=root, seg=24)
    for sy in (-1, 1):
        box(f"{name}_hl{sy}", (0.05, 0.4, 0.1), (2.34, sy * 0.62, 0.72), M["head_on"], root)
        box(f"{name}_tl{sy}", (0.05, 0.4, 0.1), (-2.31, sy * 0.62, 0.85), M["tail_on"], root)
    if direction < 0:
        root.rotation_euler = (0, 0, math.pi)
    beam = spot_light(name + "_beam", (2.6, 0, 0.7), (0, math.radians(-86), 0), 400, 60, 0.6, parent=root)
    return root


def haze(density=0.0012):
    """Low-density atmosphere: depth cue and visible light in the air."""
    m = bpy.data.materials.new("haze")
    m.use_nodes = True
    n, l = m.node_tree.nodes, m.node_tree.links
    n.remove(n["Principled BSDF"])
    v = n.new("ShaderNodeVolumePrincipled")
    v.inputs["Density"].default_value = density
    v.inputs["Color"].default_value = (0.75, 0.8, 0.9, 1)
    v.inputs["Anisotropy"].default_value = 0.35
    l.new(v.outputs[0], n["Material Output"].inputs["Volume"])
    o = box("haze", (1400, 1800, 160), (250, 300, 79.9), m)
    o.visible_shadow = False
    return o


def verge(M, x0=56.0, x1=318.0, y0=-4.3, y1=-13.0):
    """Grass tufts along the camera-side verge (geometry, no alpha)."""
    tile = 4.0
    bm = bmesh.new()
    for _ in range(900):
        cx, cy = RNG.uniform(0, tile), RNG.uniform(y1, y0)
        for _ in range(7):
            h = RNG.uniform(0.12, 0.38)
            a = RNG.uniform(0, 2 * math.pi)
            lean = Vector((math.cos(a), math.sin(a), 0)) * RNG.uniform(0.02, 0.12)
            base = Vector((cx + RNG.uniform(-0.08, 0.08), cy + RNG.uniform(-0.08, 0.08), 0))
            side = Vector((-math.sin(a), math.cos(a), 0)) * 0.012
            bm.faces.new((bm.verts.new(base - side), bm.verts.new(base + side), bm.verts.new(base + lean + Vector((0, 0, h)))))
    o = mesh_obj("verge", bm, M["blades"], loc=(x0, 0, -0.06))
    array(o, int((x1 - x0) / tile), (tile, 0, 0))
    return o
