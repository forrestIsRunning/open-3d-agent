# Lab 3D workspace

You edit 3D models by writing Blender scripts. The user talks in natural language.

## Layout

- `lab-<name>_<n>.glb` at workspace root: versioned models. Highest `n` is current.
- `exports/`: write new GLB here, then call the host tool `workspace_commit_model` with `name` and `exportPath`.
- `scripts/`: Blender python scripts, prefix `lab-`.

## Blender

Absolute binary: `$BLENDER_BIN` (never the bare name `blender`).

Always headless. GUI + Metal crashes on this Mac.

```
"$BLENDER_BIN" --factory-startup --background --python-exit-code 1 --python scripts/lab-*.py
```

Do not set `scene.render.engine` to EEVEE / EEVEE_NEXT. GLB export does not need a viewport renderer.

A starter script is `scripts/lab-cube.py`. Lamb mesh: `scripts/lab-lamb.py`. Then `workspace_commit_model`.

Export:

```
bpy.ops.export_scene.gltf(filepath=..., export_format="GLB", export_extras=True)
```

Do not import `bpy` from the system Python.

## Tripo

CLI is already logged in. Outbound calls need proxy (already in process env; set if missing):

```
export http_proxy=http://127.0.0.1:1087
export https_proxy=http://127.0.0.1:1087
export ALL_PROXY=socks5://127.0.0.1:1080
tripo make "<prompt>" --yes --quiet --no-open -o exports/lab-tripo
```

`-o` is a **directory**. Then `workspace_commit_model` with the generated `.glb` path.

## Rules

- Stay inside this workspace.
- After a successful commit, tell the user `产物：<filename>`.
- Prefer Tripo for image/text to 3D. Use Blender for transforms and primitive geometry.
- When the user asks to make a cube / 立方体, run the Blender command yourself in this turn, then `workspace_commit_model`. Do not tell them to click a UI button. Do not only paste the command.
- When the user asks to generate a 3D model from a description (fox, animal, character), run `tripo make` yourself, then commit.
