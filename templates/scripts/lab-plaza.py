"""Compose a navigable plaza from lab-*.glb cast, real-world relative scale."""
from pathlib import Path
import glob
import math
import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, roughness=0.7):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = roughness
    return m


ground_m = mat("Plaza stone", (0.42, 0.41, 0.38), 0.9)
path_m = mat("Warm path", (0.55, 0.48, 0.38), 0.85)
hedge_m = mat("Hedge", (0.18, 0.32, 0.16), 0.8)
wood_m = mat("Bench wood", (0.35, 0.22, 0.12), 0.75)
lamp_m = mat("Lamp", (0.15, 0.16, 0.18), 0.4)


def mesh_obj(name, fn, loc, scale, material):
    fn()
    o = bpy.context.object
    o.name = name
    o.location = loc
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.location = loc
    if o.data.materials:
        o.data.materials[0] = material
    else:
        o.data.materials.append(material)
    return o


bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=12, depth=0.12, location=(0, 0, -0.06))
plaza = bpy.context.object
plaza.name = "Plaza ground"
plaza.data.materials.append(ground_m)

bpy.ops.mesh.primitive_torus_add(major_radius=6.2, minor_radius=0.55, major_segments=48, location=(0, 0, 0.04))
ring = bpy.context.object
ring.name = "Walking ring"
ring.data.materials.append(path_m)

for i, ang in enumerate(range(0, 360, 45)):
    r = math.radians(ang)
    x, y = math.cos(r) * 9.2, math.sin(r) * 9.2
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0.45))
    h = bpy.context.object
    h.name = f"Hedge {i}"
    h.scale = (1.6, 0.45, 0.9)
    bpy.ops.object.transform_apply(scale=True)
    h.location = (x, y, 0.45)
    h.rotation_euler[2] = r + math.pi / 2
    h.data.materials.append(hedge_m)

for i, (x, y) in enumerate([(-4.2, 3.2), (4.2, 3.2), (0, -5.4)]):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0.28))
    b = bpy.context.object
    b.name = f"Bench {i}"
    b.scale = (1.4, 0.38, 0.28)
    bpy.ops.object.transform_apply(scale=True)
    b.location = (x, y, 0.28)
    b.data.materials.append(wood_m)

for i, (x, y) in enumerate([(-5.5, -5.5), (5.5, -5.5), (-5.5, 5.5), (5.5, 5.5)]):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.08, depth=2.4, location=(x, y, 1.2))
    p = bpy.context.object
    p.name = f"Lamp post {i}"
    p.data.materials.append(lamp_m)


def latest(prefix):
    files = sorted(Path(".").glob(f"lab-{prefix}_*.glb"))
    return files[-1] if files else None


def import_fit(path: Path, name: str, height: float, loc, yaw=0.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    if not new:
        raise RuntimeError(f"import empty {path}")
    bpy.ops.object.select_all(action="DESELECT")
    for o in new:
        o.select_set(True)
    bpy.context.view_layer.objects.active = new[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    xs = [obj.matrix_world @ v.co for v in obj.data.vertices]
    zs = [p.z for p in xs]
    h = max(zs) - min(zs) or 1.0
    s = height / h
    obj.scale = (s, s, s)
    bpy.ops.object.transform_apply(scale=True)
    xs = [obj.matrix_world @ v.co for v in obj.data.vertices]
    min_z = min(p.z for p in xs)
    cx = sum(p.x for p in xs) / len(xs)
    cy = sum(p.y for p in xs) / len(xs)
    obj.location = (loc[0] - cx, loc[1] - cy, loc[2] - min_z)
    obj.rotation_euler[2] = yaw
    return obj


CAST = [
    ("cat", "Kitten", 0.28, (3.4, 1.6, 0), 2.4),
    ("puppy", "Puppy", 0.42, (-3.6, 1.8, 0), -0.6),
    ("lamb", "Lamb", 0.52, (-2.4, -3.2, 0), 0.8),
    ("fox", "Fox", 0.40, (3.2, -2.8, 0), 3.5),
    ("woman", "Woman", 1.62, (1.1, 0.2, 0), 3.3),
    ("man", "Man", 1.75, (-1.1, 0.15, 0), -0.2),
]

missing = []
for prefix, name, height, loc, yaw in CAST:
    p = latest(prefix)
    if not p:
        missing.append(prefix)
        continue
    import_fit(p, name, height, loc, yaw)

if missing:
    raise RuntimeError("missing cast glb: " + ",".join(missing))

out = Path("exports/lab-plaza.glb")
out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_extras=True)
