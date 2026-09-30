"""Small helpers for building the journey scene with Blender's Python API (bpy).

Everything is procedural: geometry is built from bmesh primitives and
profiles, materials are physically based node setups. No third-party
models or textures are used, so every asset is owned by the project.
"""

import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------- objects

def link(obj, parent=None, coll=None):
    (coll or bpy.context.scene.collection).objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    o.location = loc
    return link(o, parent)


def mesh_obj(name, bm, mat=None, parent=None, loc=(0, 0, 0), smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    o.location = loc
    if mat is not None:
        mats = mat if isinstance(mat, (list, tuple)) else [mat]
        for m in mats:
            me.materials.append(m)
    return link(o, parent)


def bevel(o, width, segments=3, angle=None, harden=True, clamp=True):
    m = o.modifiers.new("bevel", "BEVEL")
    m.width = width
    m.segments = segments
    m.use_clamp_overlap = clamp
    if angle is not None:
        m.limit_method = "ANGLE"
        m.angle_limit = angle
    else:
        m.limit_method = "NONE"
    m.harden_normals = harden
    if harden:
        for p in o.data.polygons:
            p.use_smooth = True
    return m


def subsurf(o, levels=2):
    m = o.modifiers.new("subd", "SUBSURF")
    m.levels = levels
    m.render_levels = levels
    return m


def box(name, size, loc=(0, 0, 0), mat=None, parent=None, bev=0.0, seg=3, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if rot is not None:
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(rot[1], 3, rot[0]), verts=bm.verts)
    o = mesh_obj(name, bm, mat, parent, loc)
    if bev:
        bevel(o, bev, seg)
    return o


def cylinder(name, r, depth, loc=(0, 0, 0), axis="Y", mat=None, parent=None, seg=48, bev=0.0, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    if axis == "Y":
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "X"), verts=bm.verts)
    elif axis == "X":
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "Y"), verts=bm.verts)
    o = mesh_obj(name, bm, mat, parent, loc, smooth=True)
    if bev:
        bevel(o, bev, 2, angle=math.radians(50))
    return o


def extrude_profile(name, pts, width, mat=None, parent=None, loc=(0, 0, 0), axis="Y"):
    """Polygon in the XZ plane (x, z), extruded symmetrically along Y (or X)."""
    bm = bmesh.new()
    h = width / 2
    if axis == "Y":
        a = [bm.verts.new((x, -h, z)) for x, z in pts]
        b = [bm.verts.new((x, h, z)) for x, z in pts]
    else:  # profile in YZ, extruded along X
        a = [bm.verts.new((-h, x, z)) for x, z in pts]
        b = [bm.verts.new((h, x, z)) for x, z in pts]
    n = len(pts)
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, mat, parent, loc)


def lathe(name, profile, steps=64, mat=None, parent=None, loc=(0, 0, 0)):
    """Revolve a (radius, y) profile around the Y axis (wheel axis)."""
    bm = bmesh.new()
    vs = [bm.verts.new((r, y, 0)) for r, y in profile]
    es = [bm.edges.new((vs[i], vs[i + 1])) for i in range(len(vs) - 1)]
    bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 1, 0), angle=2 * math.pi, steps=steps, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, mat, parent, loc, smooth=True)


def array(o, count, offset, relative=False):
    m = o.modifiers.new("array", "ARRAY")
    m.count = count
    m.use_relative_offset = relative
    m.use_constant_offset = not relative
    if relative:
        m.relative_offset_displace = offset
    else:
        m.constant_offset_displace = offset
    return m


# -------------------------------------------------------------- materials

def _mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree.nodes, m.node_tree.links, m.node_tree.nodes["Principled BSDF"]


def pbr(name, color, rough=0.5, metal=0.0, coat=0.0, coat_rough=0.03, spec=0.5, aniso=0.0, transmission=0.0, ior=1.45, alpha=1.0):
    m, n, l, b = _mat(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = coat_rough
    b.inputs["Specular IOR Level"].default_value = spec
    b.inputs["Anisotropic"].default_value = aniso
    b.inputs["Transmission Weight"].default_value = transmission
    b.inputs["IOR"].default_value = ior
    b.inputs["Alpha"].default_value = alpha
    return m


def emissive(name, color, strength=0.0, base=(0.02, 0.02, 0.02), rough=0.2):
    """Emission material whose strength is animated per frame."""
    m = pbr(name, base, rough=rough)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Emission Color"].default_value = (*color, 1)
    b.inputs["Emission Strength"].default_value = strength
    return m


def key_emission(mat, frame, strength):
    b = mat.node_tree.nodes["Principled BSDF"]
    s = b.inputs["Emission Strength"]
    s.default_value = strength
    s.keyframe_insert("default_value", frame=frame)


def noise_rough(mat, lo, hi, scale=8.0, bump=0.0, bump_scale=60.0, detail=6.0):
    """Break up perfect CG surfaces: roughness variation plus fine bump."""
    n, l = mat.node_tree.nodes, mat.node_tree.links
    b = n["Principled BSDF"]
    tc = n.new("ShaderNodeTexCoord")
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = detail
    l.new(tc.outputs["Object"], nz.inputs["Vector"])
    mr = n.new("ShaderNodeMapRange")
    mr.inputs["To Min"].default_value = lo
    mr.inputs["To Max"].default_value = hi
    l.new(nz.outputs["Fac"], mr.inputs["Value"])
    l.new(mr.outputs["Result"], b.inputs["Roughness"])
    if bump:
        nb = n.new("ShaderNodeTexNoise")
        nb.inputs["Scale"].default_value = bump_scale
        nb.inputs["Detail"].default_value = 4.0
        l.new(tc.outputs["Object"], nb.inputs["Vector"])
        bp = n.new("ShaderNodeBump")
        bp.inputs["Strength"].default_value = bump
        bp.inputs["Distance"].default_value = 0.002
        l.new(nb.outputs["Fac"], bp.inputs["Height"])
        l.new(bp.outputs["Normal"], b.inputs["Normal"])
    return mat


def grime(mat, height=0.9, color=(0.18, 0.16, 0.14), amount=0.55, space="Object"):
    """Road grime rising from the bottom edge (object Z) – sells real use."""
    n, l = mat.node_tree.nodes, mat.node_tree.links
    b = n["Principled BSDF"]
    base = tuple(b.inputs["Base Color"].default_value)
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs[space], sep.inputs["Vector"])
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 3.0
    nz.inputs["Detail"].default_value = 8.0
    l.new(tc.outputs[space], nz.inputs["Vector"])
    add = n.new("ShaderNodeMath")
    add.operation = "MULTIPLY_ADD"
    l.new(nz.outputs["Fac"], add.inputs[0])
    add.inputs[1].default_value = 0.35
    l.new(sep.outputs["Z"], add.inputs[2])
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = height * 0.35
    ramp.color_ramp.elements[1].position = height
    l.new(add.outputs["Value"], ramp.inputs["Fac"])
    mix = n.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (*color, 1)
    mix.inputs["B"].default_value = base
    l.new(ramp.outputs["Color"], mix.inputs["Factor"])
    # limit how strong the grime gets
    mix2 = n.new("ShaderNodeMix")
    mix2.data_type = "RGBA"
    mix2.inputs["Factor"].default_value = amount
    mix2.inputs["A"].default_value = base
    l.new(mix.outputs["Result"], mix2.inputs["B"])
    l.new(mix2.outputs["Result"], b.inputs["Base Color"])
    return mat


def decal(name, image_path, rough=0.28, coat=0.6):
    """Printed livery: image colour with alpha, same clear coat as the paint."""
    m, n, l, b = _mat(name)
    img = bpy.data.images.load(image_path)
    tex = n.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Cubic"
    l.new(tex.outputs["Color"], b.inputs["Base Color"])
    l.new(tex.outputs["Alpha"], b.inputs["Alpha"])
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.06
    return m


def plane(name, w, h, loc=(0, 0, 0), mat=None, parent=None, facing="-Y"):
    """Rectangle with UVs 0..1, facing the given axis."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    hw, hh = w / 2, h / 2
    if facing == "-Y":
        co = [(-hw, 0, -hh), (hw, 0, -hh), (hw, 0, hh), (-hw, 0, hh)]
    elif facing == "+Y":
        co = [(hw, 0, -hh), (-hw, 0, -hh), (-hw, 0, hh), (hw, 0, hh)]
    elif facing == "+X":
        co = [(0, -hw, -hh), (0, hw, -hh), (0, hw, hh), (0, -hw, hh)]
    elif facing == "-X":
        co = [(0, hw, -hh), (0, -hw, -hh), (0, -hw, hh), (0, hw, hh)]
    else:  # +Z
        co = [(-hw, -hh, 0), (hw, -hh, 0), (hw, hh, 0), (-hw, hh, 0)]
    vs = [bm.verts.new(c) for c in co]
    f = bm.faces.new(vs)
    for loop, (u, v) in zip(f.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop[uv].uv = (u, v)
    return mesh_obj(name, bm, mat, parent, loc)


def point_light(name, loc, energy, color=(1, 0.9, 0.8), radius=0.1, parent=None):
    d = bpy.data.lights.new(name, "POINT")
    d.energy = energy
    d.color = color
    d.shadow_soft_size = radius
    o = bpy.data.objects.new(name, d)
    o.location = loc
    return link(o, parent)


def spot_light(name, loc, rot, energy, size_deg=70, blend=0.5, color=(1, 0.95, 0.88), radius=0.05, parent=None):
    d = bpy.data.lights.new(name, "SPOT")
    d.energy = energy
    d.color = color
    d.spot_size = math.radians(size_deg)
    d.spot_blend = blend
    d.shadow_soft_size = radius
    o = bpy.data.objects.new(name, d)
    o.location = loc
    o.rotation_euler = rot
    return link(o, parent)


def area_light(name, loc, rot, energy, size=(1, 1), color=(1, 1, 1), parent=None, spread=None):
    d = bpy.data.lights.new(name, "AREA")
    d.energy = energy
    d.color = color
    d.shape = "RECTANGLE"
    d.size, d.size_y = size
    if spread is not None:
        d.spread = math.radians(spread)
    o = bpy.data.objects.new(name, d)
    o.location = loc
    o.rotation_euler = rot
    return link(o, parent)


def asphalt(name="asphalt", wet=0.45, tint=(0.042, 0.042, 0.045)):
    """Damp asphalt: aggregate colour + bump, rough dry areas and glossy
    wet patches that pick up reflections of every light source."""
    m, n, l, b = _mat(name)
    tc = n.new("ShaderNodeTexCoord")
    # aggregate grains
    vor = n.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 180.0
    l.new(tc.outputs["Object"], vor.inputs["Vector"])
    fine = n.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 90.0
    fine.inputs["Detail"].default_value = 8.0
    l.new(tc.outputs["Object"], fine.inputs["Vector"])
    # large patches: wear, repairs, wetness
    big = n.new("ShaderNodeTexNoise")
    big.inputs["Scale"].default_value = 0.09
    big.inputs["Detail"].default_value = 6.0
    big.inputs["Roughness"].default_value = 0.62
    l.new(tc.outputs["Object"], big.inputs["Vector"])
    col = n.new("ShaderNodeMapRange")
    col.inputs["To Min"].default_value = 0.65
    col.inputs["To Max"].default_value = 1.35
    l.new(fine.outputs["Fac"], col.inputs["Value"])
    mul = n.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    mul.inputs["A"].default_value = (*tint, 1)
    l.new(col.outputs["Result"], mul.inputs["B"])
    # wetness mask
    wm = n.new("ShaderNodeMapRange")
    wm.inputs["From Min"].default_value = 0.5 - wet * 0.12
    wm.inputs["From Max"].default_value = 0.5 + 0.06 - wet * 0.12
    l.new(big.outputs["Fac"], wm.inputs["Value"])
    rough = n.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.72
    rough.inputs["To Max"].default_value = 0.12
    l.new(wm.outputs["Result"], rough.inputs["Value"])
    l.new(rough.outputs["Result"], b.inputs["Roughness"])
    dark = n.new("ShaderNodeMix")
    dark.data_type = "RGBA"
    l.new(wm.outputs["Result"], dark.inputs["Factor"])
    l.new(mul.outputs["Result"], dark.inputs["A"])
    dmul = n.new("ShaderNodeMix")
    dmul.data_type = "RGBA"
    dmul.blend_type = "MULTIPLY"
    dmul.inputs["Factor"].default_value = 1.0
    dmul.inputs["B"].default_value = (0.55, 0.55, 0.55, 1)
    l.new(mul.outputs["Result"], dmul.inputs["A"])
    l.new(dmul.outputs["Result"], dark.inputs["B"])
    l.new(dark.outputs["Result"], b.inputs["Base Color"])
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.004
    l.new(vor.outputs["Distance"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def sky_world(sun_elev_deg=-2.5, sun_rot_deg=200, strength=1.0, name="sky"):
    w = bpy.data.worlds.new(name)
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_elevation = math.radians(sun_elev_deg)
    sky.sun_rotation = math.radians(sun_rot_deg)
    bg = nt.nodes["Background"]
    nt.links.new(sky.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = strength
    return w, sky, bg


def quad_grid(name, corners, mat=None, parent=None, n=10, corner_radius=0.0):
    """Subdivided quad (bilinear) – deforms smoothly under Cast/Subsurf.
    Optional rounded corners limited to the four corner vertices."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    p0, p1, p2, p3 = [Vector(c) for c in corners]
    grid = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            u, v = i / n, j / n
            row.append(bm.verts.new(p0.lerp(p1, u).lerp(p3.lerp(p2, u), v)))
        grid.append(row)
    for j in range(n):
        for i in range(n):
            f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            for loop, (du, dv) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
                loop[uv].uv = ((i + du) / n, (j + dv) / n)
    bm.verts.index_update()
    corner_idx = [grid[0][0].index, grid[0][n].index, grid[n][n].index, grid[n][0].index]
    o = mesh_obj(name, bm, mat, parent)
    for p in o.data.polygons:
        p.use_smooth = True
    if corner_radius:
        vg = o.vertex_groups.new(name="corners")
        vg.add(corner_idx, 1.0, "REPLACE")
        o["corner_radius"] = corner_radius
    return o


def round_corners(o, segments=6):
    """Add the vertex bevel last (after any deformation)."""
    r = o.get("corner_radius")
    if not r:
        return
    m = o.modifiers.new("round", "BEVEL")
    m.affect = "VERTICES"
    m.width = r
    m.segments = segments
    m.limit_method = "VGROUP"
    m.vertex_group = "corners"
