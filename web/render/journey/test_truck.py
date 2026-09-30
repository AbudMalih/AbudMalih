import math, sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from lib import *
import truck

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = int(os.environ.get("S", 32))
sc.cycles.use_denoising = True
sc.cycles.denoiser = "OPENIMAGEDENOISE"
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast"
sc.render.resolution_x, sc.render.resolution_y = 1280, 720

sky_world(float(os.environ.get("SUN", -2.5)), float(os.environ.get("ROT", 200)), float(os.environ.get("SKY", 1.0)))
g = asphalt()
bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=200); mesh_obj("ground", bm, g)
sc.view_settings.exposure = float(os.environ.get("EXP", 0))
sc.render.resolution_x, sc.render.resolution_y = int(os.environ.get("W", 1280)), int(os.environ.get("H", 720))
T = truck.build()
for m in ("head","drl","tail","amber"):
    key_emission(T["M"][m], 1, {"head":40,"drl":25,"tail":6,"amber":8}[m])
for l in T["lights"]["head"]: l.data.energy = 900

cam = bpy.data.cameras.new("c"); co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co); sc.camera = co
cam.lens = float(os.environ.get("LENS", 35))
view = os.environ.get("VIEW", "34")
if view == "34":
    co.location = (9, -13, 1.6); tgt = (-6.5, 0, 1.9)
elif view == "side":
    co.location = (-8, -19, 1.4); tgt = (-8, 0, 2.0)
else:
    co.location = (3.2, -3.4, 1.2); tgt = (-0.5, 0, 1.4)
d = Vector(tgt) - Vector(co.location); co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
cam.dof.use_dof = True; cam.dof.focus_distance = d.length; cam.dof.aperture_fstop = 4
sc.render.filepath = os.environ.get("OUT", "/tmp/truck.png")
t = time.time(); bpy.ops.render.render(write_still=True); print("render", time.time() - t)
