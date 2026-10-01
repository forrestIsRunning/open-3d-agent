import bpy
from pathlib import Path

bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, roughness=0.8):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = roughness
    return m


wool = mat("Warm white wool", (0.92, 0.88, 0.78))
face = mat("Soft charcoal face", (0.18, 0.16, 0.14))
hoof = mat("Dark hooves", (0.08, 0.07, 0.06))
horn = mat("Tiny golden horns", (0.72, 0.48, 0.18))
pink = mat("Ear pink", (0.75, 0.40, 0.38))
eye = mat("Glossy eyes", (0.015, 0.01, 0.008), 0.15)


def uv(name, loc, scale, material, seg=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    return o


def cyl(name, loc, radius, depth, material, rotation=(0, 0, 0), vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation
    )
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    return o


uv("Woolly body", (0, 0, 1.25), (1.18, 0.62, 0.72), wool)
for i, (x, y, z, s) in enumerate(
    [
        (-0.78, -0.04, 1.52, 0.42),
        (-0.38, -0.45, 1.62, 0.38),
        (0.12, -0.49, 1.65, 0.40),
        (0.62, -0.35, 1.54, 0.40),
        (0.82, 0.03, 1.42, 0.36),
        (-0.55, 0.34, 1.58, 0.36),
        (0.18, 0.39, 1.62, 0.38),
    ]
):
    uv(f"Fluffy wool tuft {i + 1}", (x, y, z), (s, s * 0.72, s), wool)

for i, (x, y) in enumerate([(-0.62, -0.36), (0.58, -0.36), (-0.62, 0.30), (0.58, 0.30)]):
    cyl(f"Leg {i + 1}", (x, y, 0.62), 0.14, 0.75, wool)
    uv(f"Hoof {i + 1}", (x, y - 0.02, 0.25), (0.18, 0.16, 0.11), hoof)

uv("Lamb head", (1.05, -0.02, 1.65), (0.55, 0.48, 0.62), face)
uv("Muzzle", (1.38, -0.04, 1.47), (0.34, 0.33, 0.25), face)
for side in (-1, 1):
    uv(f"Floppy ear {side}", (1.02, side * 0.43, 1.92), (0.30, 0.12, 0.19), wool)
    uv(f"Pink inner ear {side}", (1.04, side * 0.455, 1.92), (0.18, 0.035, 0.11), pink)
    uv(f"Eye {side}", (1.27, side * 0.37, 1.82), (0.075, 0.045, 0.085), eye, 16, 10)
    cyl(f"Tiny horn {side}", (0.93, side * 0.29, 2.18), 0.075, 0.22, horn, rotation=(0, side * 0.45, 0), vertices=12)

uv("Fluffy tail", (-1.12, 0.08, 1.47), (0.28, 0.24, 0.30), wool)

out = Path("exports/lab-lamb.glb")
out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_extras=True)
