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
let sessionReady: Promise<{
  workspace: string;
  fake: boolean;
  model?: string;
  approvalPolicy?: string;
}> | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function sendHost(method: string, params: unknown): Promise<unknown> {
  if (!host?.stdin.writable) throw new Error("host not running");
  const id = nextId++;
  host.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
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
      const msg = JSON.parse(line) as {
        id?: number;
        method?: string;
        result?: unknown;
        params?: unknown;
        error?: { message?: string };
      };
      if (msg.id != null && pending.has(msg.id)) {
        const p = pending.get(msg.id)!;
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message ?? "host error"));
        else p.resolve(msg.result);
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
    if (!sessionReady) {
      sessionReady = (async () => {
        await sendHost(EnvelopeMethod.workspaceOpen, { path: workspace });
        const started = (await sendHost(EnvelopeMethod.runtimeStart, {
          fake: process.env.LAB_FAKE === "1",
        })) as { fake?: boolean; model?: string; approvalPolicy?: string };
        return {
          workspace,
          fake: Boolean(started.fake),
          model: started.model,
          approvalPolicy: started.approvalPolicy,
        };
      })();
    }
    return sessionReady;
  });
  ipcMain.handle("lab:send", async (_e, text: string) => sendHost(EnvelopeMethod.turnSend, { text }));
  ipcMain.handle("lab:approve", async (_e, payload: { id: string; result: unknown }) =>
    sendHost(EnvelopeMethod.approvalRespond, payload),
  );
  ipcMain.handle("lab:runCube", async () => sendHost(EnvelopeMethod.runCube, {}));
  ipcMain.handle("lab:runTripo", async (_e, prompt?: string) =>
    sendHost(EnvelopeMethod.runTripo, { prompt: prompt ?? "a cute low poly fox" }),
  );
  ipcMain.handle("lab:stop", async () => sendHost(EnvelopeMethod.runtimeStop, {}));
  await createWindow();
});

app.on("before-quit", () => {
  host?.kill("SIGTERM");
});
