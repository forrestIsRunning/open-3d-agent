---
name: blender-edit
description: Edit or create GLB with Blender headless Python.
---

Write a script under `scripts/lab-*.py`. Run:

```
"$BLENDER_BIN" --factory-startup --background --python-exit-code 1 --python scripts/lab-cube.py
```

The script must:

1. Create or import mesh
2. Export GLB to `exports/`
3. Ask the host to `workspace_commit_model`

Minimal cube:

```python
import bpy, sys
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(size=1)
out = Path("exports/lab-cube.glb")
out.parent.mkdir(exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_extras=True)
```
