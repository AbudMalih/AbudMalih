"""Procedural 40-t European Sattelzug (cab-over tractor + 13.6 m box trailer).

Local frame: +X = driving direction, front face of the cab at x = 0,
ground at z = 0, vehicle centred on y = 0. Overall length ≈ 16.55 m.
Generic tractor design – no manufacturer styling or badges.
"""

import math
import os

import bmesh
import bpy
from mathutils import Vector

from lib import (HERE, array, quad_grid, round_corners, bevel, box, cylinder, decal, emissive, empty, extrude_profile, grime, lathe, mesh_obj,
                 noise_rough, pbr, plane, point_light, spot_light)

TIRE_R = 0.535
TRACTOR_AXLES = (-1.35, -5.05)
TRAILER_AXLES = (-12.35, -13.66, -14.97)
TRAILER_FRONT = -2.95
TRAILER_REAR = -16.55
LENGTH = -TRAILER_REAR


def thin_glass():
    """Thin automotive glass: tinted see-through plus Fresnel reflection
    (no refraction offset, like a real laminated windscreen)."""
    m = bpy.data.materials.new("glass_thin")
    m.use_nodes = True
    n, l = m.node_tree.nodes, m.node_tree.links
    n.remove(n["Principled BSDF"])
    tr = n.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = (0.3, 0.34, 0.34, 1)
    gl = n.new("ShaderNodeBsdfGlossy")
    gl.inputs["Roughness"].default_value = 0.015
    lw = n.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.12
    mix = n.new("ShaderNodeMixShader")
    l.new(lw.outputs["Fresnel"], mix.inputs["Fac"])
    l.new(tr.outputs[0], mix.inputs[1])
    l.new(gl.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], n["Material Output"].inputs["Surface"])
    return m


def materials():
    M = {}
    M["graphite"] = grime(pbr("paint_graphite", (0.016, 0.018, 0.021), rough=0.3, metal=0.6, coat=1.0, coat_rough=0.035),
                          height=1.6, color=(0.05, 0.047, 0.043), amount=0.5)
    M["graphite_trim"] = noise_rough(pbr("graphite_trim", (0.03, 0.032, 0.036), rough=0.45, metal=0.5), 0.35, 0.55)
    M["white"] = grime(pbr("paint_white", (0.78, 0.785, 0.78), rough=0.24, coat=0.7, coat_rough=0.07),
                       height=1.75, color=(0.42, 0.39, 0.35), amount=0.55)
    M["red"] = pbr("paint_red", (0.62, 0.004, 0.008), rough=0.25, coat=1.0, coat_rough=0.03)
    M["plastic"] = noise_rough(pbr("black_plastic", (0.014, 0.014, 0.015), rough=0.55), 0.45, 0.7, bump=0.15)
    M["rubber"] = noise_rough(pbr("rubber", (0.016, 0.016, 0.017), rough=0.82, spec=0.35), 0.75, 0.92, bump=0.35, bump_scale=140)
    M["alu"] = pbr("alu_polished", (0.92, 0.92, 0.93), rough=0.1, metal=1.0)
    M["alu_brushed"] = pbr("alu_brushed", (0.8, 0.81, 0.82), rough=0.28, metal=1.0, aniso=0.7)
    M["steel_dark"] = noise_rough(pbr("steel_dark", (0.05, 0.05, 0.05), rough=0.45, metal=0.9), 0.35, 0.6)
    M["chrome"] = pbr("chrome", (0.95, 0.95, 0.96), rough=0.04, metal=1.0)
    M["chrome_dark"] = pbr("chrome_dark", (0.3, 0.31, 0.32), rough=0.08, metal=1.0)
    M["piano"] = pbr("piano_black", (0.006, 0.006, 0.007), rough=0.12, coat=1.0, coat_rough=0.02)
    M["satin"] = pbr("satin_silver", (0.42, 0.43, 0.45), rough=0.24, metal=1.0, aniso=0.4)
    M["glass"] = thin_glass()
    M["fabric"] = noise_rough(pbr("fabric", (0.035, 0.036, 0.04), rough=0.9), 0.85, 0.95, scale=40, bump=0.3, bump_scale=200)
    M["screen"] = emissive("screen", (0.55, 0.75, 1.0), 1.2, base=(0.01, 0.01, 0.01))
    M["hole"] = pbr("hole", (0.004, 0.004, 0.004), rough=0.9)
    M["lens"] = pbr("lens", (0.9, 0.9, 0.9), rough=0.03, transmission=1.0, ior=1.5)
    M["head"] = emissive("headlamp", (1.0, 0.96, 0.9), 0.0, base=(0.6, 0.6, 0.62))
    M["drl"] = emissive("drl", (0.85, 0.92, 1.0), 0.0, base=(0.5, 0.52, 0.55))
    M["tail"] = emissive("taillamp", (1.0, 0.02, 0.01), 0.0, base=(0.25, 0.005, 0.005))
    M["amber"] = emissive("marker", (1.0, 0.38, 0.02), 0.0, base=(0.35, 0.12, 0.0))
    M["logo"] = decal("logo_trailer", os.path.join(HERE, "logo.png"))
    M["logo_white"] = decal("logo_cab", os.path.join(HERE, "logo-white.png"), rough=0.3, coat=1.0)
    return M


def wheel(name, parent, loc, M, outer=+1, width=0.315, dish=0.0):
    """Tyre + polished rim. `outer` = which Y side faces outwards."""
    w = empty(name, loc, parent)
    hw = width / 2
    s = hw / 0.158
    prof = [(0.29, -0.13), (0.33, -0.150), (0.42, -0.160), (0.49, -0.152), (0.52, -0.135), (0.535, -0.11),
            (0.535, -0.075), (0.525, -0.07), (0.525, -0.058), (0.535, -0.053), (0.535, -0.015), (0.525, -0.01),
            (0.525, 0.01), (0.535, 0.015), (0.535, 0.053), (0.525, 0.058), (0.525, 0.07), (0.535, 0.075),
            (0.535, 0.11), (0.52, 0.135), (0.49, 0.152), (0.42, 0.16), (0.33, 0.15), (0.29, 0.13)]
    tire = lathe(name + "_tire", [(r, y * s) for r, y in prof], 72, M["rubber"], w)
    rim_prof = [(0.288, 0.13 * s), (0.292, 0.118 * s), (0.284, 0.095 * s), (0.268, 0.088 * s - dish), (0.24, 0.075 * s - dish),
                (0.205, 0.058 * s - dish), (0.19, 0.055 * s - dish), (0.14, 0.055 * s - dish), (0.125, 0.07 * s - dish),
                (0.1, 0.083 * s - dish), (0.07, 0.09 * s - dish), (0.0, 0.092 * s - dish)]
    rim = lathe(name + "_rim", rim_prof, 64, M["alu"], w)
    barrel = cylinder(name + "_barrel", 0.286, 0.2 * s, mat=M["steel_dark"], parent=w, seg=48)
    # hand holes (dark openings to the brake drum) and wheel nuts
    for i in range(10):
        a = i / 10 * 2 * math.pi
        cylinder(f"{name}_hole{i}", 0.034, 0.01, (math.cos(a) * 0.232, 0.071 * s - dish + 0.004, math.sin(a) * 0.232),
                 mat=M["hole"], parent=w, seg=20)
        a2 = a + math.pi / 10
        cylinder(f"{name}_nut{i}", 0.017, 0.035, (math.cos(a2) * 0.112, 0.08 * s - dish, math.sin(a2) * 0.112),
                 mat=M["chrome"], parent=w, seg=6)
    cylinder(name + "_cap", 0.062, 0.05, (0, 0.1 * s - dish, 0), mat=M["chrome"], parent=w, seg=32, r2=0.045)
    if outer < 0:
        for c in w.children:
            c.rotation_euler = (0, 0, math.pi)
    return w


def build(M=None, name="truck"):
    M = M or materials()
    root = empty(name)
    body = empty(name + "_body", parent=root)  # suspension bob lives here
    wheels = []

    # ------------------------------------------------------------ cab
    # modern cab-over: large raked screen, roof lip acting as integrated sun
    # visor, slightly bulged front with generous corner radii
    cab = [(0.07, 1.18), (0.1, 1.5), (0.09, 1.8), (0.05, 2.05), (0.0, 2.12), (-0.37, 3.12), (-0.26, 3.18),
           (-0.27, 3.42), (-0.48, 3.58), (-0.78, 3.85), (-1.1, 3.96), (-2.27, 3.97), (-2.3, 3.92), (-2.3, 1.18)]
    c = extrude_profile("cab", cab, 2.49, M["graphite"], body)
    bevel(c, 0.22, 8, angle=math.radians(30))
    ctrl = empty("cab_centre", (-1.25, 0, 2.45), body)

    def raked_quad(nm, x0, z0, x1, z1, half, off, mat, r=0.1):
        d = Vector((x1 - x0, 0, z1 - z0)).normalized()
        o = Vector((d.z, 0, -d.x)) * off  # along the outward normal
        cs = [Vector(p) + o for p in ((x0, -half, z0), (x0, half, z0), (x1, half, z1), (x1, -half, z1))]
        return quad_grid(nm, cs, mat, body, 12, r)
    # panoramic windscreen with black ceramic border and wiper blades
    raked_quad("windscreen_frit", 0.0, 2.12, -0.362, 3.11, 1.2, 0.01, M["plastic"], 0.18)
    raked_quad("windscreen", -0.012, 2.17, -0.345, 3.07, 1.16, 0.016, M["glass"], 0.16)
    for k, y in enumerate((-0.55, 0.45)):
        w_ = box(f"wiper{k}", (0.02, 0.95, 0.014), (0.03, y, 2.2), M["plastic"], body)
        w_.rotation_euler = (math.radians(3), math.radians(-14), 0)
    # white JARBOU logo on the visor lip
    plane("visor_logo", 0.62, 0.62 * 569 / 2048, (-0.248, 0, 3.31), M["logo_white"], body, facing="+X")
    # grille: piano-black trapezoid with two satin bars and fine chrome trims
    quad_grid("grille", [(0.1, -0.82, 1.42), (0.1, 0.82, 1.42), (0.07, 0.99, 2.02), (0.07, -0.99, 2.02)],
              M["piano"], body, 10, 0.06)
    for k, z in enumerate((1.55, 1.72, 1.89)):
        wdt = 1.66 + k * 0.1
        box(f"grille_bar{k}", (0.035, wdt, 0.06), (0.108 - k * 0.01, 0, z), M["satin"], body, bev=0.022)
    grille_mesh = box("grille_mesh", (0.01, 1.7, 0.01), (0.1, 0, 1.46), M["steel_dark"], body)
    array(grille_mesh, 14, (0, 0, 0.038))
    box("accent", (0.02, 1.56, 0.018), (0.07, 0, 2.075), M["red"], body, bev=0.006)
    # sculpted bumper: body-colour upper, textured black lower, LED strips
    box("bumper", (0.34, 2.48, 0.58), (-0.08, 0, 0.9), M["graphite"], body, bev=0.14, seg=6)
    box("bumper_lip", (0.3, 2.3, 0.2), (-0.06, 0, 0.5), M["plastic"], body, bev=0.06, seg=4)
    box("bumper_plate", (0.03, 0.9, 0.2), (0.085, 0, 0.84), M["plastic"], body, bev=0.02)
    box("skid", (0.14, 1.0, 0.03), (0.03, 0, 0.41), M["satin"], body, bev=0.01)
    for sy in (-1, 1):
        box(f"fog{sy}", (0.02, 0.36, 0.028), (0.085, sy * 0.86, 0.66), M["head"], body, bev=0.008)
        # slim angular LED headlamps wrapping the lower cab corners
        inner, outer = 0.52, 1.14
        quad_grid(f"hl_back{sy}", [(0.108, sy * inner, 1.2), (0.035, sy * outer, 1.23), (0.015, sy * outer, 1.46),
                                   (0.095, sy * (inner + 0.07), 1.4)][:: -sy], M["chrome_dark"], body, 4)
        quad_grid(f"hl_lens{sy}", [(0.13, sy * inner, 1.195), (0.058, sy * outer, 1.225), (0.036, sy * outer, 1.465),
                                   (0.117, sy * (inner + 0.07), 1.405)][:: -sy], M["lens"], body, 4)
        # LED signature: top strip + outer vertical strip
        drl = box(f"hl_drl{sy}", (0.012, 0.52, 0.018), (0.105, sy * 0.86, 1.41), M["drl"], body, bev=0.006)
        drl.rotation_euler = (math.radians(-sy * 5), 0, math.radians(sy * 8))
        box(f"hl_drl_v{sy}", (0.012, 0.018, 0.2), (0.05, sy * 1.1, 1.33), M["drl"], body, bev=0.006)
        for k, dy in enumerate((0.66, 0.8, 0.94)):
            x = 0.1 - (dy - 0.66) * 0.12
            cylinder(f"hl_ring{sy}{k}", 0.048, 0.02, (x, sy * dy, 1.3), axis="X", mat=M["chrome"], parent=body, seg=32)
            cylinder(f"hl_lamp{sy}{k}", 0.034, 0.024, (x + 0.004, sy * dy, 1.3), axis="X", mat=M["head"], parent=body, seg=32)
        # corner deflector seam
        box(f"deflector{sy}", (0.012, 0.012, 1.5), (-0.06, sy * 1.19, 2.3), M["plastic"], body)
        # side windows, door seams, handle, logo
        ys = sy * 1.247
        pts = [(-0.42, 2.02), (-1.32, 2.22), (-1.32, 3.08), (-0.52, 3.08)]
        cs = [(x, ys + sy * 0.004, z) for x, z in pts]
        quad_grid(f"sidewin{sy}", cs if sy < 0 else [cs[1], cs[0], cs[3], cs[2]], M["glass"], body, 8, 0.05)
        for nm, x, z, wx, hz in (("seam_f", -0.39, 2.2, 0.012, 1.95), ("seam_r", -1.42, 2.2, 0.012, 1.95),
                                 ("seam_b", -0.81, 1.23, 1.22, 0.012)):
            box(f"{nm}{sy}", (wx, 0.012, hz), (x, ys, z), M["plastic"], body)
        box(f"handle{sy}", (0.2, 0.02, 0.035), (-1.2, ys + sy * 0.005, 2.1), M["plastic"], body, bev=0.008)
        plane(f"door_logo{sy}", 0.8, 0.8 * 569 / 2048, (-0.8, ys + sy * 0.006, 1.8), M["logo_white"], body,
              facing="-Y" if sy < 0 else "+Y")
        box(f"door_stripe{sy}", (1.9, 0.01, 0.03), (-1.15, ys + sy * 0.004, 1.3), M["red"], body)
        # slim aero mirror arms with compact mirror heads
        arm = box(f"mirror_arm{sy}", (0.12, 0.42, 0.05), (-0.3, sy * 1.43, 2.98), M["graphite"], body, bev=0.022)
        arm.rotation_euler = (0, 0, math.radians(-sy * 12))
        box(f"mirror_main{sy}", (0.16, 0.13, 0.36), (-0.2, sy * 1.64, 2.82), M["graphite"], body, bev=0.05)
        box(f"mirror_glass{sy}", (0.008, 0.1, 0.31), (-0.282, sy * 1.64, 2.82), M["chrome"], body, bev=0.01)
        box(f"mirror_wide{sy}", (0.14, 0.12, 0.16), (-0.2, sy * 1.64, 2.5), M["graphite"], body, bev=0.04)
        box(f"mirror_wglass{sy}", (0.008, 0.09, 0.12), (-0.272, sy * 1.64, 2.5), M["chrome"], body)
        # body-colour aero skirts over the chassis
        box(f"side_skirt{sy}", (2.2, 0.035, 0.7), (-3.4, sy * 1.23, 0.8), M["graphite"], body, bev=0.04)
        box(f"skirt_trim{sy}", (2.2, 0.02, 0.018), (-3.4, sy * 1.25, 0.7), M["red"], body)
        # steps
        for k, z in enumerate((0.62, 0.95)):
            box(f"step{sy}{k}", (0.5, 0.2, 0.05), (-2.05, sy * 1.12, z), M["alu_brushed"], body, bev=0.01)
        box(f"step_panel{sy}", (0.4, 0.06, 0.62), (-2.08, sy * 1.2, 0.87), M["graphite"], body, bev=0.02)
        # cab side extenders towards the trailer
        box(f"extender{sy}", (0.42, 0.03, 2.25), (-2.47, sy * 1.23, 2.75), M["graphite"], body, bev=0.012)
        # front mudguard
        mg = cylinder(f"arch{sy}", 0.6, 0.34, (TRACTOR_AXLES[0], sy * 1.06, 0.0), mat=M["plastic"], parent=body, seg=48)
        bm2 = bmesh.new()
        bm2.from_mesh(mg.data)
        bmesh.ops.delete(bm2, geom=[v for v in bm2.verts if v.co.z < 0.05], context="VERTS")
        bm2.to_mesh(mg.data)
        bm2.free()
        mg.location.z = TIRE_R
        sol = mg.modifiers.new("shell", "SOLIDIFY")
        sol.thickness = 0.03
        # fuel tank / battery box
        if sy < 0:
            cylinder("fuel_tank", 0.31, 1.35, (-3.3, -0.9, 0.78), axis="X", mat=M["alu_brushed"], parent=body, seg=48, bev=0.05)
        else:
            box("battery_box", (1.2, 0.5, 0.55), (-3.3, 0.95, 0.8), M["plastic"], body, bev=0.03)
        # rear mudguards
        box(f"rear_guard{sy}", (1.25, 0.34, 0.05), (TRACTOR_AXLES[1], sy * 1.0, 1.18), M["plastic"], body, bev=0.02)
        box(f"rear_flap{sy}", (0.03, 0.34, 0.55), (TRACTOR_AXLES[1] - 0.65, sy * 1.0, 0.72), M["plastic"], body)
        # tractor tail lamps
        box(f"t_tail{sy}", (0.05, 0.3, 0.12), (-5.8, sy * 0.95, 0.95), M["tail"], body, bev=0.015)

    # gently crowned panels (real cabs are never flat): every cab-mounted
    # part gets the same deformation field so nothing sinks into the skin
    CAB_PARTS = ("cab", "windscreen", "wiper", "sidewin", "seam_", "handle", "door_logo", "door_stripe", "grille",
                 "accent", "visor", "deflector")
    for o in list(body.children):
        if o.type == "MESH" and o.name.startswith(CAB_PARTS):
            if not o.get("corner_radius"):  # grids are already dense
                sd = o.modifiers.new("dense", "SUBSURF")
                sd.subdivision_type = "SIMPLE"
                sd.levels = sd.render_levels = 2
            cast = o.modifiers.new("crown", "CAST")
            cast.cast_type = "SPHERE"
            cast.factor = 0.05
            cast.size = 1.9
            cast.use_radius_as_size = False
            cast.object = ctrl
            round_corners(o)

    # hollow shell with window openings so the cab interior is visible
    sol = c.modifiers.new("shell", "SOLIDIFY")
    sol.thickness = 0.035
    sol.offset = -1
    cutters = []
    for nm, size, loc in (("cut_ws", (1.0, 2.2, 0.84), (-0.15, 0, 2.63)),
                          ("cut_sw_l", (0.8, 0.5, 0.78), (-0.9, 1.2, 2.66)),
                          ("cut_sw_r", (0.8, 0.5, 0.78), (-0.9, -1.2, 2.66))):
        k = box(nm, size, loc, None, body)
        k.hide_render = True
        k.display_type = "WIRE"
        cutters.append(k)
    for k in cutters:
        bo = c.modifiers.new("open_" + k.name, "BOOLEAN")
        bo.operation = "DIFFERENCE"
        bo.solver = "EXACT"
        bo.object = k
    # bake the cab skin (booleans are static – avoids per-frame re-evaluation
    # and keeps motion blur consistent)
    dg = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(c.evaluated_get(dg))
    c.modifiers.clear()
    old_me = c.data
    c.data = baked
    bpy.data.meshes.remove(old_me)
    for k in cutters:
        bpy.data.objects.remove(k)
    # interior: dashboard, instrument screens, steering wheel, seats, lining
    box("dash", (0.55, 2.3, 0.32), (-0.5, 0, 2.02), M["fabric"], body, bev=0.06)
    box("dash_top", (0.35, 2.2, 0.06), (-0.42, 0, 2.2), M["plastic"], body, bev=0.02)
    box("screen_drv", (0.02, 0.36, 0.14), (-0.58, 0.52, 2.3), M["screen"], body)
    box("screen_mid", (0.02, 0.26, 0.16), (-0.52, 0.02, 2.28), M["screen"], body)
    ring = lathe("steering", [(0.2 + 0.022 * math.cos(a / 8 * math.pi * 2), 0.022 * math.sin(a / 8 * math.pi * 2))
                              for a in range(9)], 40, M["plastic"], body, (-0.72, 0.52, 2.35))
    ring.rotation_euler = (0, math.radians(90 - 35), math.radians(90))
    for sy in (-1, 1):
        box(f"seat{sy}", (0.55, 0.55, 0.14), (-1.55, sy * 0.52, 1.72), M["fabric"], body, bev=0.05)
        sb = box(f"seat_back{sy}", (0.14, 0.52, 0.85), (-1.85, sy * 0.52, 2.2), M["fabric"], body, bev=0.06)
        sb.rotation_euler = (0, math.radians(-12), 0)
        box(f"headrest{sy}", (0.1, 0.3, 0.2), (-1.94, sy * 0.52, 2.72), M["fabric"], body, bev=0.04)
    box("lining", (0.04, 2.3, 2.6), (-2.2, 0, 2.6), M["fabric"], body)
    box("bunk", (0.7, 2.3, 0.1), (-1.85, 0, 1.6), M["fabric"], body)

    # chassis, fifth wheel, cab back, exhaust
    for sy in (-1, 1):
        box(f"rail{sy}", (5.6, 0.08, 0.28), (-3.3, sy * 0.43, 0.98), M["steel_dark"], body)
    box("fifth_wheel", (0.95, 0.9, 0.08), (-4.75, 0, 1.2), M["plastic"], body, bev=0.02)
    box("cab_back", (0.03, 2.4, 2.7), (-2.3, 0, 2.55), M["graphite_trim"], body)
    box("cab_underside", (2.1, 2.2, 0.35), (-1.2, 0, 1.05), M["plastic"], body)
    box("air_tank", (1.0, 0.3, 0.3), (-4.3, 0.75, 0.75), M["steel_dark"], body, bev=0.05)

    # tractor wheels
    for i, x in enumerate(TRACTOR_AXLES):
        for sy in (-1, 1):
            wheels.append(wheel(f"tw{i}{'L' if sy > 0 else 'R'}", root, (x, sy * 0.99, TIRE_R), M, sy,
                                dish=0.0 if i == 0 else 0.05))

    # ----------------------------------------------------------- trailer
    L = TRAILER_FRONT - TRAILER_REAR
    xc = (TRAILER_FRONT + TRAILER_REAR) / 2
    tr = box("trailer", (L, 2.55, 2.78), (xc, 0, 2.6), M["white"], body, bev=0.05, seg=4)
    for sy in (-1, 1):
        y = sy * 1.285
        box(f"rail_bottom{sy}", (L, 0.03, 0.2), (xc, y, 1.25), M["alu_brushed"], body, bev=0.008)
        box(f"rail_top{sy}", (L, 0.03, 0.1), (xc, y, 3.95), M["alu_brushed"], body, bev=0.008)
        box(f"stripe{sy}", (L - 0.3, 0.004, 0.05), (xc, sy * 1.2775, 1.42), M["red"], body)
        for x in (TRAILER_FRONT - 0.03, TRAILER_REAR + 0.03):
            box(f"post{sy}{x:.0f}", (0.08, 0.035, 2.85), (x, y, 2.6), M["alu_brushed"], body, bev=0.008)
        # printed livery
        lw = 6.4
        plane(f"trailer_logo{sy}", lw, lw * 1139 / 4096, (-9.4 if sy < 0 else -9.4, sy * 1.279, 2.72), M["logo"], body,
              facing="-Y" if sy < 0 else "+Y")
        # aero side skirts, landing gear, fenders
        box(f"skirt{sy}", (6.6, 0.025, 0.62), (-8.4, sy * 1.23, 0.86), M["white"], body, bev=0.01)
        box(f"skirt_rail{sy}", (6.6, 0.03, 0.03), (-8.4, sy * 1.235, 1.16), M["alu_brushed"], body)
        box(f"leg{sy}", (0.12, 0.12, 0.85), (-5.2, sy * 0.85, 0.72), M["plastic"], body, bev=0.01)
        box(f"foot{sy}", (0.25, 0.22, 0.05), (-5.2, sy * 0.85, 0.3), M["steel_dark"], body)
        box(f"fender{sy}", (4.2, 0.43, 0.05), (-13.66, sy * 1.03, 1.15), M["plastic"], body, bev=0.02)
        box(f"fender_side{sy}", (4.2, 0.02, 0.18), (-13.66, sy * 1.245, 1.06), M["plastic"], body)
        box(f"flap{sy}", (0.03, 0.4, 0.55), (-15.75, sy * 1.03, 0.72), M["plastic"], body)
        # amber side markers along the bottom rail
        for k in range(6):
            box(f"marker{sy}{k}", (0.08, 0.02, 0.04), (TRAILER_FRONT - 0.6 - k * 2.4, sy * 1.302, 1.18), M["amber"], body, bev=0.005)
        # rear lamps
        box(f"tr_tail{sy}", (0.04, 0.42, 0.15), (TRAILER_REAR - 0.04, sy * 0.95, 0.95), M["tail"], body, bev=0.015)
    # sub-frame and rear
    box("subframe", (L - 0.6, 1.9, 0.22), (xc - 0.3, 0, 1.08), M["steel_dark"], body)
    box("underride", (0.12, 2.35, 0.14), (TRAILER_REAR + 0.25, 0, 0.55), M["steel_dark"], body, bev=0.02)
    box("rear_frame", (0.06, 2.55, 2.8), (TRAILER_REAR - 0.02, 0, 2.6), M["alu_brushed"], body)
    box("rear_door_seam", (0.02, 0.02, 2.6), (TRAILER_REAR - 0.05, 0, 2.62), M["plastic"], body)
    for k, y in enumerate((-0.95, -0.35, 0.35, 0.95)):
        cylinder(f"lockbar{k}", 0.018, 2.6, (TRAILER_REAR - 0.07, y, 2.62), axis="Z", mat=M["chrome"], parent=body, seg=12)
    box("front_wall_top", (0.03, 2.5, 0.1), (TRAILER_FRONT + 0.02, 0, 3.94), M["alu_brushed"], body)

    for i, x in enumerate(TRAILER_AXLES):
        for sy in (-1, 1):
            wheels.append(wheel(f"rw{i}{'L' if sy > 0 else 'R'}", root, (x, sy * 0.97, TIRE_R), M, sy, width=0.385))
    for x in TRAILER_AXLES:
        cylinder(f"axle{x:.0f}", 0.07, 1.8, (x, 0, TIRE_R), mat=M["steel_dark"], parent=root, seg=16)
    for x in TRACTOR_AXLES:
        cylinder(f"taxle{x:.0f}", 0.08, 1.7, (x, 0, TIRE_R), mat=M["steel_dark"], parent=root, seg=16)

    # --------------------------------------------------------- lights
    lights = {"head": [], "tail": []}
    for sy in (-1, 1):
        s = spot_light(f"beam{sy}", (0.25, sy * 0.86, 1.3), (0, math.radians(-86), 0), 0.0, 55, 0.6, parent=body)
        lights["head"].append(s)
        lights["tail"].append(point_light(f"tail_glow{sy}", (TRAILER_REAR - 0.25, sy * 0.95, 0.95), 0.0, (1, 0.05, 0.02), 0.08, body))

    return {"root": root, "body": body, "wheels": wheels, "M": M, "lights": lights}
