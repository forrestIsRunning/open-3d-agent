"""Fill unintended mesh holes on LAB_SRC, write LAB_OUT. Preserves overall scale."""
import os
from pathlib import Path
import bpy

src = os.environ.get("LAB_SRC", "")
out = os.environ.get("LAB_OUT", "exports/lab-fill-holes.glb")
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
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.fill_holes(sides=0)
bpy.ops.object.mode_set(mode="OBJECT")
Path(out).parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_extras=True)
