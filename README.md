# Open 3D Agent

Chat on the left. A live GLB stage on the right. You talk; the **host** builds the mesh (Tripo or headless Blender). The LLM only comments — it never launches Blender.

<p align="center">
  <img src="assets/screenshot.png" alt="Open 3D Agent: fox on the stage, version filmstrip below" width="920" />
</p>

## How it works

<p align="center">
  <img src="assets/architecture.svg" alt="You → Desktop → Host → Tripo/Blender → GLB on stage; LLM talks only" width="880" />
</p>

| You | Host | LLM |
|---|---|---|
| “generate a fox”, drop an image, “make it red”, “align to ground” | Tripo or headless Blender writes `lab-<name>_N.glb` | Describes the stage |

## Try it

```bash
git clone git@github.com:forrestIsRunning/open-3d-agent.git
cd open-3d-agent
cp .env.example .env    # OPENAI_API_KEY + optional OPENAI_BASE_URL
pnpm install && pnpm lab-doctor && pnpm dev
```

Needs macOS, Node 22, Codex CLI **0.158.0**, Blender, and a logged-in `tripo` CLI. Fake UI: `pnpm dev:fake`.

Type `generate a fox`, or hit **+** and send a photo. Edit is a new version of the same family (`fox · v2`), not a new identity.

## Limits

No in-chat sculpting. No cancel mid-Tripo. Codex must not open `Blender.app` (use the host). `.env` is gitignored.
