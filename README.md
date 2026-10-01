# desktop-3d-agent

Local learning app: **Codex app-server + Blender/Tripo + Electron 3D viewer**.

Pinned Codex CLI: `CODEX_VERSION` (0.158.0).

**Default `pnpm dev` talks to a real `codex app-server`.**  
Fake mode is explicit: `pnpm dev:fake` / `LAB_FAKE=1`. The window shows a red **FAKE** badge.

## Setup

```bash
cp .env.example .env   # fill OPENAI_API_KEY + OPENAI_BASE_URL + MODEL
pnpm install
pnpm electron:install  # if Electron dist is incomplete; uses https_proxy
pnpm lab-doctor
```

Electron download honors `https_proxy` / `http_proxy`. Do **not** set `ALL_PROXY=socks5://…` for this installer.

## Commands

```bash
pnpm test              # fake app-server
pnpm lab:fake -- --prompt "列出文件"
pnpm lab -- --prompt "介绍一下自己" --timeout 90
pnpm e2e:cube          # Blender, no LLM
pnpm e2e:tripo         # tripo CLI, needs login
pnpm dev               # LIVE desktop
pnpm dev:fake          # FAKE desktop
```

Desktop buttons **Blender cube** / **Tripo fox** run the hard paths (no model required). Chat uses Codex.

Chat transcript lives in workspace SQLite (`~/3d-agent-workspaces/default/.lab/lab.sqlite`). Codex keeps the durable thread (`ephemeral: false`); the db only stores `threadId` + UI messages + last GLB. Refresh resumes the same Codex thread.

## Check

| Item | How |
|---|---|
| LIVE Codex | `pnpm dev`, green LIVE, 「介绍一下自己」 is the model |
| FAKE | `pnpm dev:fake`, red FAKE, canned AGENTS.md reply |
| Blender cube | button or 「做一个立方体」 → orange GLB in the viewer, `~/3d-agent-workspaces/default/lab-cube_N.glb` |
| Tripo | **Tripo fox**, logged-in `tripo`, `lab-fox_N.glb` |
| Approval | `.env` `APPROVAL_POLICY=on-request`, Allow/Deny blocks the command; `pnpm test` includes wait-until-respond |
| Electron zip | `pnpm install` / `pnpm electron:install` with `https_proxy`; doctor checks Frameworks |
