# desktop-3d-agent

Local learning app: **Codex app-server harness + Blender/Tripo + Electron 3D viewer**.

Pinned Codex CLI: see `CODEX_VERSION` (currently 0.158.0).

Not a Hi3D clone. Private repo for studying stdio JSON-RPC.

## Setup

```bash
cp .env.example .env
# fill OPENAI_API_KEY if you want a real model
pnpm install
pnpm doctor
```

## Fake Codex (no API)

```bash
pnpm lab:fake -- --prompt "列出文件"
# inspect tmp-ws/.lab/rpc.jsonl
pnpm test
```

## Real Codex

Needs `codex` 0.158.0 on PATH and `.env`.

```bash
pnpm lab -- --prompt "列出这个目录里的文件"
```

## Desktop

```bash
pnpm dev                 # real app-server
LAB_FAKE=1 pnpm dev      # fake server
```

Left: chat. Right: Three.js. After `workspace.commitModel`, the latest `lab-*.glb` loads.

## Protocol

- `docs/protocol.md`
- `docs/learn-path.md`
- `pnpm proto:gen` regenerates `packages/protocol/{schema,generated}` from the local CLI

## Layout

```
packages/protocol   generated types + method constants
packages/runtime    JSON-RPC client, fake server, lab, host envelope
apps/desktop        Electron + Vue + Three.js
templates           AGENTS.md + blender/tripo skills
```
