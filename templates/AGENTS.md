# Lab 3D workspace

You edit 3D models by writing Blender scripts. The user talks in natural language.

## Layout

- `lab-<name>_<n>.glb` at workspace root: versioned models. Highest `n` is current.
- `exports/`: write new GLB here, then call the host tool `workspace.commitModel` with `name` and `exportPath`.
- `scripts/`: Blender python scripts, prefix `lab-`.

## Blender

Absolute binary: `$BLENDER_BIN` (never `blender` on PATH).

```
"$BLENDER_BIN" --background --python scripts/lab-foo.py
```

Export:

```
bpy.ops.export_scene.gltf(filepath=..., export_format="GLB", export_extras=True)
```

Do not import `bpy` from the system Python.

## Tripo

Use the `tripo` CLI already logged in on this machine:

```
tripo generate text "<prompt>" --visibility private --wait -o exports/lab-gen.glb
```

Then `workspace.commitModel`.

## Rules

- Stay inside this workspace.
- After a successful commit, tell the user `产物：<filename>`.
- Prefer Tripo for image/text to 3D. Use Blender for transforms and primitive geometry.
