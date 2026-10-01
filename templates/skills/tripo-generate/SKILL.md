---
name: tripo-generate
description: Generate a GLB from text or image with the local tripo CLI.
---

```
tripo generate text "<prompt>" --visibility private --wait -o exports/lab-tripo.glb
```

Image:

```
tripo generate image ./ref.png --visibility private --wait -o exports/lab-tripo.glb
```

Then call `workspace.commitModel` with `name` and `exportPath`.
If the CLI fails, surface stderr and stop.
