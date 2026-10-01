---
name: tripo-generate
description: Generate a GLB from text or image with the local tripo CLI.
---

```
export http_proxy=http://127.0.0.1:1087
export https_proxy=http://127.0.0.1:1087
export ALL_PROXY=socks5://127.0.0.1:1080
tripo make "<prompt>" --yes --quiet --no-open -o exports/lab-tripo
```

Image:

```
tripo generate image ./ref.png --visibility private --wait -o exports/lab-tripo.glb
```

Then call `workspace_commit_model` with `name` and `exportPath`.
If the CLI fails, surface stderr and stop.
