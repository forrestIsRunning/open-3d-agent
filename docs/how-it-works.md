# How it works

The product looks like a chatbot with a 3D viewport. Internally it is a **host that owns every mesh pipeline**, with Codex attached as a talker that may *request* those pipelines through named tools.

```text
You  →  Electron (Vue + Three.js)
              │  lab:* IPC
              ▼
         host.ts  ──envelope──►  generate / edit / Blender
              │
              ├── Codex app-server  ──OpenAI-compatible API──►  LLM
              │         ▲
              │         └── item/tool/call  (workspace_* tools)
              ▼
         lab-<family>_<n>.glb  →  stage
```

## Principle

**The LLM cannot see vertices and must not spawn DCC GUIs.**  
On this machine, Codex launching `Blender.app` SIGSEGVs (Metal). `tripo` needs a logged-in CLI plus `http_proxy` / `ALL_PROXY`. Those constraints belong in one process: the host.

So we split three jobs:

| Layer | Job | Must not |
|---|---|---|
| Desktop | Chat UI, stage, filmstrip, intent routing | Talk to Tripo/Blender itself |
| Host | Spawn Codex, run Tripo/Blender headless, version GLBs | Let Codex exec `Blender.app` or `tripo make` |
| LLM (Codex) | Read `AGENTS.md`, call `workspace_*` tools, comment on the stage | Invent a new mesh in Python, poll Tripo, open a GUI |

Two paths hit the same host functions:

1. **Fast path (desktop).** `classifyIntent` sees “generate a husky” / “make it red” / “align to ground” and calls `lab:generate` / `lab:edit` / `lab:transform` over IPC. Codex is only asked for a one-line recap after the GLB exists.
2. **Talk path (Codex).** Free-form chat goes to `turn/start`. If the model needs a mesh, it emits `item/tool/call` with a `workspace_*` name. The host runs the tool and returns the new `lab-…glb` path as `inputText`.

Same `runTripo` / `runEdit3d` / `runTransform` either way. The filmstrip always shows `family · vN` because `commitModel` is the only writer of workspace GLBs.

## Why tools instead of a shell

Codex’s default move is `zsh -lc "tripo make …"` or a Blender GUI script. That bypasses proxy, timeout, unique export dirs, and the Metal crash.

Tools are **narrow functions** registered on `thread/start`:

- Name matches `^[a-zA-Z0-9_-]+$` (Codex 0.158 rejects dotted names).
- Arguments are JSON (`prompt`, `family`, `source`, …).
- The host returns `{ success, contentItems: [{ type: "inputText", text }] }`.
- `AGENTS.md` (copied into the workspace) forbids `Blender.app` and raw `tripo`.

If a tool fails, the model must report the error, not “try Blender in the GUI instead”.

## Codex tools we added

| Tool | Arguments | What the host actually runs | Why it exists |
|---|---|---|---|
| `workspace_generate_3d` | `prompt`, `name`, `imagePath?` | `tripo make` or `tripo generate image-to-model` → `lab-<name>_N.glb` | Text/image to 3D with proxy, timeout, unique out dir. |
| `workspace_edit_3d` | `prompt`, `family`, `imagePath?` | image-to-image → image-to-model → **same family** `N+1` | Restyle the model on stage, not a new identity. |
| `workspace_transform_model` | `source`, `op`, `height?`, `yaw?` | Headless `lab-transform.py` (`ground` / `height` / `yaw`) | Deterministic pose/scale. No Tripo credits. |
| `workspace_fill_holes` | `source` | Headless `lab-fill-holes.py` (`mesh.fill_holes`) | Mesh repair without a DCC session. |
| `workspace_run_plaza` | — | Headless `lab-plaza.py` | Relative-scale layout from current `lab-*.glb`. |
| `workspace_run_blender` | `script`, `name` | Only `scripts/lab-*.py` (cube, lamb) | Allowlisted scripts; path must stay under `scripts/`. |
| `workspace_commit_model` | `name`, `exportPath` | Copy a GLB into `lab-<name>_N.glb` | Single versioning rule for every pipeline. |
| `workspace_list_assets` | — | List `lab-*.glb` | So the model can name what is on disk. |

Not tools (on purpose): animation, video, skinning weights, print split/connectors. Those asks are classified `unsupported` in the desktop so Codex is not tempted to fake them in the shell.

## Versioning

Every successful mesh write goes through `commitModel`:

```text
lab-husky_1.glb   generate
lab-husky_2.glb   edit (golden-red fur)
```

The stage title and filmstrip label are `husky · v2`. Edit **must** keep `family`, or the conversation subject breaks.

## Desktop vs Codex

The architecture drawing is the product view: you talk, the host makes the mesh, the LLM only talks.

The implementation detail: **Electron never calls the LLM.** It only JSONL-talks to `host.ts`. The host is the one that starts `codex app-server` (isolated `CODEX_HOME`, `wire_api = responses`) and that execs Tripo/Blender with `--factory-startup --background`.

That is why the green **LIVE** badge is “Codex is up”, and why a FAKE mode can still generate cubes: the host tools do not require a smart model.
