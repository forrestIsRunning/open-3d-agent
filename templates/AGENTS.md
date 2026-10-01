# Lab 3D workspace

You edit 3D models by writing Blender scripts. The user talks in natural language.

## Layout

- `lab-<name>_<n>.glb` at workspace root: versioned models. Highest `n` is current.
- `exports/`: write new GLB here, then call the host tool `workspace_commit_model` with `name` and `exportPath`.
- `scripts/`: Blender python scripts, prefix `lab-`.

## Blender

Absolute binary: `$BLENDER_BIN` (never the bare name `blender`).

A starter script is `scripts/lab-cube.py`. For “做一个立方体”:

```
"$BLENDER_BIN" --background --python scripts/lab-cube.py
```

then call host tool `workspace_commit_model` with `name=cube` and `exportPath=exports/lab-cube.glb`.

Export:

```
bpy.ops.export_scene.gltf(filepath=..., export_format="GLB", export_extras=True)
```

Do not import `bpy` from the system Python.

## Tripo

Use the `tripo` CLI already logged in on this machine:

```
tripo make "<prompt>" --yes -o exports/lab-gen.glb
```

Then `workspace_commit_model`.

## Rules

- Stay inside this workspace.
- After a successful commit, tell the user `产物：<filename>`.
- Prefer Tripo for image/text to 3D. Use Blender for transforms and primitive geometry.
- When the user asks to make a cube / 立方体, run the Blender command yourself in this turn, then `workspace_commit_model`. Do not tell them to click a UI button. Do not only paste the command.
- When the user asks to generate a 3D model from a description (fox, animal, character), run `tripo make` yourself, then commit.
