"""Import current GLB, ground / height / yaw, export GLB. Env: LAB_SRC LAB_OUT LAB_HEIGHT LAB_YAW."""
import os
from pathlib import Path
import bpy

src = os.environ.get("LAB_SRC", "")
out = os.environ.get("LAB_OUT", "exports/lab-transform.glb")
height = float(os.environ.get("LAB_HEIGHT") or "0")
yaw = float(os.environ.get("LAB_YAW") or "0")

if not src:
    raise RuntimeError("LAB_SRC missing")

bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=src)
new = [o for o in bpy.data.objects if o not in before]
if not new:
    raise RuntimeError("import empty")
bpy.ops.object.select_all(action="DESELECT")
for o in new:
    o.select_set(True)
bpy.context.view_layer.objects.active = new[0]
if len(new) > 1:
    bpy.ops.object.join()
obj = bpy.context.object
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
xs = [obj.matrix_world @ v.co for v in obj.data.vertices]
zs = [p.z for p in xs]
h = max(zs) - min(zs) or 1.0
if height > 0:
    s = height / h
    obj.scale = (s, s, s)
    bpy.ops.object.transform_apply(scale=True)
    xs = [obj.matrix_world @ v.co for v in obj.data.vertices]
    zs = [p.z for p in xs]
min_z = min(p.z for p in xs)
obj.location.z -= min_z
if yaw:
    import math
    obj.rotation_euler[2] += math.radians(yaw)
Path(out).parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_extras=True)
