# Open 3D Agent

Local desktop **3D agent**: chat on the left, a Three.js stage on the right. The host owns generation (Tripo / headless Blender). Codex talks to an OpenAI-compatible LLM and never launches `Blender.app`.

Default workspace: `~/3d-agent-workspaces/default`.

## What it does

- **Talk about the model on stage.** Each turn includes `Stage: cat · v2`. Transcript is SQLite; the Codex thread is reused (`ephemeral: false`).
- **Text to 3D.** Host runs `tripo make` → `lab-<name>_N.glb` and loads it in the viewer.
- **Image to 3D / edit.** `+` / drop / paste a picture. Send → image-to-model. “make the coat red” on the current family → image-to-image then image-to-model → `lab-<family>_N+1`.
- **Import GLB.** The same `+` accepts `.glb` / `.gltf`.
- **Deterministic edits.** “align to ground” / “height 1.7 m” run headless Blender on the current GLB.
- **Stage.** Orbit, pick, lights, version filmstrip, product-shot capture (no grid) as the edit condition, lookbook (before / concept / result).
- **Approval.** `APPROVAL_POLICY=on-request` blocks shell until Allow / Deny.

A learning lab. No commercial skill packs, cookies, or billing.

## Design

```text
┌──────────── Electron (Vue 3 + Three.js) ────────────┐
│  chat  │  stage + filmstrip                         │
│  + attach (image / glb)                             │
└──────────── IPC lab:* ──────────────────────────────┘
                      │ JSONL envelope
                      ▼
┌──────────── host.ts (tsx, owns tools) ──────────────┐
│  classifyIntent → generate | edit | transform | cube│
│                                                     │
│  Codex app-server ──OpenAI-compatible API──► LLM    │
│  tripo CLI        ──optional proxy──────► 3D mesh   │
│  Blender --background --factory-startup → GLB       │
└─────────────────────┬───────────────────────────────┘
                      ▼
         ~/3d-agent-workspaces/default
         lab-cat_1.glb  lab-cat_2.glb  .lab/lab.sqlite
```

**Who does what**

| Job | Owner |
|---|---|
| Mesh / GLB | Host → Tripo CLI or headless Blender |
| Chat, check, verbal comments | Codex → OpenAI-compatible API (`MODEL`, `OPENAI_BASE_URL`) |
| Scale / ground / yaw | `templates/scripts/lab-transform.py` |
| Scene compose (plaza) | `lab-plaza.py` (script, not the chat loop) |

The LLM never deforms vertices. “make it thinner” re-runs generation or a Blender script.

Pinned Codex CLI: `CODEX_VERSION` → **0.158.0**. Isolated `CODEX_HOME` in-repo; `wire_api = responses`.

## Third-party dependencies

### npm (this repo)

| Package | Where | Role |
|---|---|---|
| **vue** ^3.5 | `apps/desktop` | UI |
| **three** ^0.180 | `apps/desktop` | GLB viewer (GLTFLoader, RoomEnvironment, OrbitControls) |
| **pinia** ^3 | `apps/desktop` | listed; stage state is mostly Vue refs |
| **electron** ^37 | `apps/desktop` | window, IPC, `lab-asset://` |
| **electron-vite** ^4 + **vite** ^7 + `@vitejs/plugin-vue` | `apps/desktop` | desktop bundler |
| **tsx** ^4 | `packages/runtime` | run `host.ts` / tests |
| **typescript** ^5.9 | workspace | typecheck |
| **@types/node** / **@types/three** | workspace | types |
| Node **sqlite** (`node:sqlite` DatabaseSync) | runtime | chat DB; no extra npm driver |

Workspace packages `@lab3d/protocol` and `@lab3d/runtime` have **no** third-party runtime npm besides the protocol package itself.

### System binaries (not in package.json)

| Binary | Used for | Notes |
|---|---|---|
| **Node.js** ≥ 22, **pnpm** 10 | install / `pnpm dev` | |
| **codex** 0.158.0 | `codex app-server` stdio JSON-RPC | doctor checks version |
| **Blender** (`BLENDER_BIN`) | cube, lamb, transform, plaza | always `--factory-startup --background`. GUI `Blender.app` can SIGSEGV on Metal |
| **tripo** CLI | text-to-3D, image-to-image, image-to-model | logged-in Tripo account / credits |

### Network services

| Service | Env | Role |
|---|---|---|
| OpenAI-compatible LLM | `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `MODEL`, `PROVIDER` | any `/v1` relay |
| Tripo cloud | `tripo` login + optional proxy | generation |
| Optional HTTP proxy | `http_proxy` / `https_proxy` | Codex + Tripo |
| Optional SOCKS | `ALL_PROXY=socks5://127.0.0.1:1080` | **Codex/Tripo only**. Do not set `ALL_PROXY` on the Electron installer |

`.env` is gitignored. `.env.example` has an empty `OPENAI_API_KEY`.

## Get started

### Prerequisites

- macOS, Node 22+, pnpm 10
- Codex CLI **0.158.0** on `PATH`
- Blender (path in `.env`)
- `tripo` CLI logged in (for real 3D)
- An API key for an OpenAI-compatible `/v1` endpoint

### 1. Install

```bash
git clone git@github.com:forrestIsRunning/open-3d-agent.git
cd open-3d-agent
cp .env.example .env   # fill OPENAI_API_KEY
pnpm install
pnpm electron:install  # if Electron Frameworks are missing; uses https_proxy, not ALL_PROXY
pnpm lab-doctor
```

### 2. Environment

```bash
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
MODEL=gpt-4o
PROVIDER=openai

# optional
# http_proxy=http://127.0.0.1:1087
# https_proxy=http://127.0.0.1:1087
# ALL_PROXY=socks5://127.0.0.1:1080

BLENDER_BIN=/Applications/Blender.app/Contents/MacOS/Blender
APPROVAL_POLICY=never   # or on-request
```

### 3. Run

```bash
pnpm dev          # LIVE: real Codex + Tripo/Blender
pnpm dev:fake     # red FAKE badge; canned AGENTS.md, no LLM
```

Green **LIVE** in the rail means Codex is up. Chat is the product surface (`+` to attach files). Cube / lamb still work by typing “make a cube” / “lamb”.

## Usage

| You type / do | What runs |
|---|---|
| `generate a kitten` | `tripo make` → `lab-cat_N.glb` |
| `+` image, send | `tripo generate image-to-model` |
| `make the coat red` | screenshot or attach → image-to-image → image-to-model → next family version |
| `align to ground` / `height 1.7 m` | headless `lab-transform.py` |
| drop `.glb` | copy into workspace, load stage |
| `make a cube` | `lab-cube.py` |

Assets: `lab-<family>_<n>.glb`. Filmstrip label: `cat · v2`.

## Tests

```bash
pnpm test              # runtime L0 (fake app-server, stub Tripo, intent, edit family)
pnpm e2e:cube          # Blender cube, no LLM
pnpm e2e:transform     # Blender ground on cube
pnpm e2e:tripo         # live tripo (needs login)
pnpm lab:fake -- --prompt "list the files"
pnpm lab -- --prompt "introduce yourself" --timeout 90
```

`pnpm lab-doctor` checks Codex version, Blender path, Electron Frameworks, API key, Tripo login.

## Repo layout

```text
apps/desktop/           Electron + Vue + Three.js
packages/protocol/      JSON-RPC names, intents, Codex-generated schema
packages/runtime/       host, Codex session, Tripo, Blender, sqlite
templates/AGENTS.md     what Codex reads
templates/scripts/      lab-cube.py, lab-lamb.py, lab-plaza.py, lab-transform.py
docs/                   ADR + learn path
```

Learn path: [`docs/learn-path.md`](docs/learn-path.md).

## Limits

- No mesh sculpting in chat. Edit is regenerate-from-image or Blender transform.
- No interrupt / cancel of an in-flight Tripo job.
- Codex must not spawn `Blender.app` (Metal SIGSEGV). Host is headless only.
- `loadDotenv` does not override already-set env; change `.env` then restart Electron.
- FAKE is a badge for tests, not the product path.
