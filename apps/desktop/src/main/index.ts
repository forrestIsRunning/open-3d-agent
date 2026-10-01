import { app, BrowserWindow, ipcMain, protocol, net } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { EnvelopeMethod } from "@lab3d/protocol";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const workspace = join(homedir(), "3d-agent-workspaces/default");
mkdirSync(workspace, { recursive: true });

protocol.registerSchemesAsPrivileged([
  { scheme: "lab-asset", privileges: { standard: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

let win: BrowserWindow | null = null;
let host: ChildProcessWithoutNullStreams | null = null;
let nextId = 1;
const pending = new Map<number, (v: unknown) => void>();

function sendHost(method: string, params: unknown): Promise<unknown> {
  if (!host?.stdin.writable) throw new Error("host not running");
  const id = nextId++;
  host.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return new Promise((resolve) => pending.set(id, resolve));
}

function startHost(): void {
  const tsxCli = join(repoRoot, "packages/runtime/node_modules/tsx/dist/cli.mjs");
  const hostFile = join(repoRoot, "packages/runtime/src/host.ts");
  host = spawn(process.execPath, [tsxCli, hostFile], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      LAB_FAKE: process.env.LAB_FAKE ?? "",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  host.on("error", (err) => {
    process.stderr.write(`host spawn error: ${err.message}\n`);
  });
  host.stderr.on("data", (c) => process.stderr.write(c));
  const rl = createInterface({ input: host.stdout });
  rl.on("line", (line) => {
    try {
      const msg = JSON.parse(line) as { id?: number; method?: string; result?: unknown; params?: unknown };
      if (msg.id != null && pending.has(msg.id)) {
        pending.get(msg.id)!(msg.result);
        pending.delete(msg.id);
        return;
      }
      if (msg.method) win?.webContents.send("runtime-event", { method: msg.method, params: msg.params });
    } catch (err) {
      process.stderr.write(`host line: ${line}\n`);
    }
  });
}

async function createWindow(): Promise<void> {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(dirname(fileURLToPath(import.meta.url)), "../preload/index.mjs"),
      contextIsolation: true,
      sandbox: false,
    },
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    await win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await win.loadFile(join(dirname(fileURLToPath(import.meta.url)), "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  protocol.handle("lab-asset", (req) => {
    const u = new URL(req.url);
    const rel = decodeURIComponent(u.pathname.replace(/^\/workspace\//, ""));
    const file = join(workspace, rel);
    return net.fetch(pathToFileURL(file).toString());
  });
  startHost();
  ipcMain.handle("lab:open", async () => {
    await sendHost(EnvelopeMethod.workspaceOpen, { path: workspace });
    await sendHost(EnvelopeMethod.runtimeStart, { fake: process.env.LAB_FAKE === "1" });
    return { workspace };
  });
  ipcMain.handle("lab:send", async (_e, text: string) => sendHost(EnvelopeMethod.turnSend, { text }));
  ipcMain.handle("lab:approve", async (_e, payload: { id: string; result: unknown }) =>
    sendHost(EnvelopeMethod.approvalRespond, payload),
  );
  ipcMain.handle("lab:stop", async () => sendHost(EnvelopeMethod.runtimeStop, {}));
  await createWindow();
});

app.on("before-quit", () => {
  host?.kill("SIGTERM");
});
