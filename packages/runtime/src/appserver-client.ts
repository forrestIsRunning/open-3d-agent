/**
 * Codex app-server client over stdio JSON-RPC.
 * Handshake: initialize (ClientRequest) then initialized notify.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { ClientMethod, ClientNotify, OptOutDeltas, ServerMethod } from "@lab3d/protocol";
import { appendRpcLog } from "./rpc-log.ts";
import {
  isNotification,
  isRequest,
  isResponse,
  parseLine,
  type JsonRpcId,
  type JsonRpcMessage,
} from "./jsonrpc.ts";

export type ServerRequestHandler = (
  id: JsonRpcId,
  method: string,
  params: unknown,
) => Promise<unknown>;

export type NotificationHandler = (method: string, params: unknown) => void;

export type AppServerClientOptions = {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  rpcLogPath?: string;
  onNotification?: NotificationHandler;
  onServerRequest?: ServerRequestHandler;
};

export class AppServerClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<
    JsonRpcId,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private opts: AppServerClientOptions;
  private bufClosed = false;

  constructor(opts: AppServerClientOptions) {
    this.opts = opts;
  }

  async start(): Promise<void> {
    const child = spawn(this.opts.command, this.opts.args, {
      cwd: this.opts.cwd,
      env: this.opts.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      process.stderr.write(chunk);
    });
    child.on("exit", (code, signal) => {
      this.bufClosed = true;
      for (const [, p] of this.pending) {
        p.reject(new Error(`app-server exited code=${code} signal=${signal}`));
      }
      this.pending.clear();
    });
    const rl = createInterface({ input: child.stdout });
    rl.on("line", (line) => {
      this.onLine(line);
    });
  }

  async initialize(): Promise<unknown> {
    const result = await this.request(ClientMethod.initialize, {
      clientInfo: {
        name: "desktop-3d-agent",
        title: "Lab 3D Agent",
        version: "0.1.0",
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
        optOutNotificationMethods: [...OptOutDeltas],
      },
    });
    await this.notify(ClientNotify.initialized, {});
    return result;
  }

  request(method: string, params: unknown, timeoutMs = 60_000): Promise<unknown> {
    const id = this.nextId++;
    const msg = { jsonrpc: "2.0" as const, id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.write(msg);
    });
  }

  notify(method: string, params: unknown): Promise<void> {
    this.write({ jsonrpc: "2.0", method, params });
    return Promise.resolve();
  }

  respond(id: JsonRpcId, result: unknown): void {
    this.write({ jsonrpc: "2.0", id, result });
  }

  respondError(id: JsonRpcId, message: string): void {
    this.write({ jsonrpc: "2.0", id, error: { code: -32000, message } });
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    this.child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        this.child?.kill("SIGKILL");
        resolve();
      }, 2000);
      this.child?.on("exit", () => {
        clearTimeout(t);
        resolve();
      });
    });
    this.child = null;
  }

  private write(msg: object): void {
    if (!this.child?.stdin.writable) throw new Error("app-server stdin closed");
    const raw = JSON.stringify(msg);
    if (this.opts.rpcLogPath) appendRpcLog(this.opts.rpcLogPath, "out", raw);
    this.child.stdin.write(raw + "\n");
  }

  private onLine(line: string): void {
    let msg: JsonRpcMessage | null;
    try {
      msg = parseLine(line);
    } catch {
      return;
    }
    if (!msg) return;
    if (this.opts.rpcLogPath) appendRpcLog(this.opts.rpcLogPath, "in", line);

    if (isResponse(msg)) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
      return;
    }

    if (isRequest(msg)) {
      void this.handleServerRequest(msg.id, msg.method, msg.params);
      return;
    }

    if (isNotification(msg)) {
      this.opts.onNotification?.(msg.method, msg.params);
    }
  }

  private async handleServerRequest(id: JsonRpcId, method: string, params: unknown): Promise<void> {
    try {
      if (method === ServerMethod.currentTime) {
        this.respond(id, { currentTimeAt: Math.floor(Date.now() / 1000) });
        return;
      }
      const handler = this.opts.onServerRequest;
      if (!handler) {
        this.respondError(id, `unhandled server request ${method}`);
        return;
      }
      const result = await handler(id, method, params);
      this.respond(id, result);
    } catch (err) {
      this.respondError(id, err instanceof Error ? err.message : String(err));
    }
  }
}
