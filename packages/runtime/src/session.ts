import { ClientMethod, HostTool, ServerMethod, ServerNotify } from "@lab3d/protocol";
import { AppServerClient, type JsonRpcId } from "./appserver-client.ts";
import { listAssets } from "./assets.ts";
import { commitModel } from "./commit-model.ts";
import { runBlenderScript } from "./run-blender.ts";
import { runEdit3d } from "./run-edit.ts";
import { runFillHoles } from "./run-repair.ts";
import { runTransform } from "./run-transform.ts";
import { runTripo } from "./run-tripo.ts";

export type SessionEvents = {
  onText?: (text: string) => void;
  onTool?: (info: { command?: string; text?: string }) => void;
  onTurnDone?: (status: string) => void;
  onTurnError?: (message: string) => void;
  onApproval?: (id: JsonRpcId, method: string, params: unknown) => void;
  onUserInput?: (id: JsonRpcId, params: unknown) => void;
  onModelReady?: (path: string) => void;
};

export type StartSessionOptions = {
  workspace: string;
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  rpcLogPath?: string;
  model?: string;
  approvalPolicy?: "never" | "on-request";
  sandbox?: "workspace-write" | "read-only";
  autoApprove?: boolean;
  threadId?: string;
  events?: SessionEvents;
};

export class AgentSession {
  readonly client: AppServerClient;
  threadId = "";
  private workspace: string;
  private opts: StartSessionOptions;
  private pending = new Map<string, (result: unknown) => void>();

  constructor(opts: StartSessionOptions) {
    this.opts = opts;
    this.workspace = opts.workspace;
    this.client = new AppServerClient({
      command: opts.command,
      args: opts.args,
      env: opts.env,
      cwd: opts.workspace,
      rpcLogPath: opts.rpcLogPath,
      onNotification: (method, params) => this.onNotify(method, params),
      onServerRequest: (id, method, params) => this.onServerRequest(id, method, params),
    });
  }

  async start(): Promise<unknown> {
    await this.client.start();
    const init = await this.client.initialize();
    const threadParams = {
      cwd: this.workspace,
      model: this.opts.model,
      approvalPolicy: this.opts.approvalPolicy ?? "never",
      sandbox: this.opts.sandbox ?? "workspace-write",
      ephemeral: false,
      experimentalRawEvents: false,
      dynamicTools: hostTools(),
    };
    if (this.opts.threadId) {
      try {
        const resumed = (await this.client.request(ClientMethod.threadResume, {
          threadId: this.opts.threadId,
          cwd: this.workspace,
          model: this.opts.model,
          approvalPolicy: this.opts.approvalPolicy ?? "never",
          sandbox: this.opts.sandbox ?? "workspace-write",
        })) as { thread?: { id?: string } };
        this.threadId = resumed.thread?.id ?? this.opts.threadId;
        if (this.threadId) return init;
      } catch {
        /* start a new durable thread */
      }
    }
    const started = (await this.client.request(ClientMethod.threadStart, threadParams)) as {
      thread?: { id?: string };
    };
    this.threadId = started.thread?.id ?? "";
    if (!this.threadId) throw new Error("thread/start returned empty thread.id");
    return init;
  }

  async send(text: string): Promise<{ turnId: string }> {
    const result = (await this.client.request(ClientMethod.turnStart, {
      threadId: this.threadId,
      input: [{ type: "text", text, text_elements: [] }],
      approvalPolicy: this.opts.approvalPolicy ?? "never",
    })) as { turn?: { id?: string } };
    const turnId = result.turn?.id ?? "";
    if (!turnId) throw new Error("turn/start returned empty turn.id");
    return { turnId };
  }

  async interrupt(turnId: string): Promise<void> {
    await this.client.request(ClientMethod.turnInterrupt, {
      threadId: this.threadId,
      turnId,
    });
  }

  async stop(): Promise<void> {
    await this.client.stop();
  }

  private async onServerRequest(id: JsonRpcId, method: string, params: unknown): Promise<unknown> {
    if (method === ServerMethod.toolCall) {
      const p = params as {
        tool?: string;
        arguments?: {
          name?: string;
          exportPath?: string;
          prompt?: string;
          script?: string;
          family?: string;
          imagePath?: string;
          source?: string;
          op?: string;
          height?: number;
          yaw?: number;
        };
      };
      try {
        const dest = this.runHostTool(p.tool ?? "", p.arguments ?? {});
        if (p.tool !== HostTool.listAssets && dest.endsWith(".glb")) {
          this.opts.events?.onModelReady?.(dest);
        }
        return {
          success: true,
          contentItems: [{ type: "inputText", text: dest || "ok" }],
        };
      } catch (err) {
        return {
          success: false,
          contentItems: [{ type: "inputText", text: err instanceof Error ? err.message : String(err) }],
        };
      }
    }

    if (
      method === ServerMethod.commandApproval ||
      method === ServerMethod.fileChangeApproval
    ) {
      if (this.opts.autoApprove) return { decision: "accept" };
      const pending = this.waitPending(String(id));
      this.opts.events?.onApproval?.(id, method, params);
      return await pending;
    }

    if (method === ServerMethod.permissionsApproval) {
      if (this.opts.autoApprove) {
        return { permissions: {}, scope: "turn" };
      }
      const pending = this.waitPending(String(id));
      this.opts.events?.onApproval?.(id, method, params);
      return await pending;
    }

    if (method === ServerMethod.requestUserInput) {
      if (this.opts.autoApprove) return { answers: {} };
      const pending = this.waitPending(String(id));
      this.opts.events?.onUserInput?.(id, params);
      return await pending;
    }

    return {};
  }

  private runHostTool(
    tool: string,
    args: {
      name?: string;
      exportPath?: string;
      prompt?: string;
      script?: string;
      family?: string;
      imagePath?: string;
      source?: string;
      op?: string;
      height?: number;
      yaw?: number;
    },
  ): string {
    if (tool === HostTool.commitModel) {
      return commitModel(this.workspace, args.name ?? "model", args.exportPath ?? "");
    }
    if (tool === HostTool.generate3d) {
      return runTripo(
        this.workspace,
        args.prompt ?? "a 3d model",
        args.name ?? "gen",
        args.imagePath,
      );
    }
    if (tool === HostTool.edit3d) {
      return runEdit3d(this.workspace, {
        prompt: args.prompt ?? "",
        family: args.family ?? args.name ?? "",
        imagePath: args.imagePath,
      });
    }
    if (tool === HostTool.transformModel) {
      return runTransform(this.workspace, {
        source: args.source ?? "",
        op: (args.op as "ground" | "height" | "yaw") ?? "ground",
        height: args.height,
        yaw: args.yaw,
      });
    }
    if (tool === HostTool.fillHoles) {
      return runFillHoles(this.workspace, args.source ?? "");
    }
    if (tool === HostTool.runPlaza) {
      return runBlenderScript(this.workspace, "lab-plaza.py", "plaza");
    }
    if (tool === HostTool.runBlender) {
      return runBlenderScript(this.workspace, args.script ?? "lab-cube.py", args.name ?? "model");
    }
    if (tool === HostTool.listAssets) {
      return listAssets(this.workspace).join("\n");
    }
    throw new Error(`unknown tool ${tool}`);
  }

  resolvePending(id: string, result: unknown): void {
    const fn = this.pending.get(id);
    if (fn) {
      this.pending.delete(id);
      fn(result);
    }
  }

  private waitPending(id: string): Promise<unknown> {
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
    });
  }

  private onNotify(method: string, params: unknown): void {
    const p = params as {
      item?: { type?: string; text?: string; command?: string };
      turn?: { status?: string; error?: { message?: string } };
    };
    if (method === ServerNotify.itemCompleted) {
      if (p.item?.type === "agentMessage" && p.item.text) {
        this.opts.events?.onText?.(p.item.text);
      }
      if (p.item?.type === "commandExecution") {
        this.opts.events?.onTool?.({ command: p.item.command });
      }
    }
    if (method === ServerNotify.turnCompleted) {
      const status = p.turn?.status ?? "completed";
      if (status === "failed") {
        this.opts.events?.onTurnError?.(p.turn?.error?.message ?? "turn failed");
      } else {
        this.opts.events?.onTurnDone?.(status);
      }
    }
  }
}

function hostTools(): unknown[] {
  return [
    {
      type: "function",
      name: HostTool.generate3d,
      description:
        "Generate a GLB from text, or from an uploaded image (imagePath) via the host Tripo CLI. Never run Blender.app or tripo in the shell.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          name: { type: "string" },
          imagePath: { type: "string" },
        },
        required: ["prompt", "name"],
      },
    },
    {
      type: "function",
      name: HostTool.edit3d,
      description:
        "Edit the current family: image-to-image then image-to-model, commit lab-<family>_N+1. Pass family plus prompt; optional imagePath (viewport shot or user ref). Never run tripo or Blender.app in the shell.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          family: { type: "string" },
          imagePath: { type: "string" },
        },
        required: ["prompt", "family"],
      },
    },
    {
      type: "function",
      name: HostTool.transformModel,
      description:
        "Headless Blender: ground / height / yaw the current lab-*_n.glb and commit the next version. Forbidden: Blender.app GUI.",
      inputSchema: {
        type: "object",
        properties: {
          source: { type: "string" },
          op: { type: "string" },
          height: { type: "number" },
          yaw: { type: "number" },
        },
        required: ["source", "op"],
      },
    },
    {
      type: "function",
      name: HostTool.fillHoles,
      description: "Headless Blender fill_holes on lab-*_n.glb, commit next family version.",
      inputSchema: {
        type: "object",
        properties: { source: { type: "string" } },
        required: ["source"],
      },
    },
    {
      type: "function",
      name: HostTool.runPlaza,
      description: "Compose a scaled plaza from current lab-*.glb assets. Headless Blender.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      type: "function",
      name: HostTool.runBlender,
      description:
        "Run an existing scripts/lab-*.py with headless Blender. Forbidden: launching Blender.app GUI.",
      inputSchema: {
        type: "object",
        properties: { script: { type: "string" }, name: { type: "string" } },
        required: ["script", "name"],
      },
    },
    {
      type: "function",
      name: HostTool.commitModel,
      description: "Register an exported GLB as lab-<name>_<n>.glb.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" }, exportPath: { type: "string" } },
        required: ["name", "exportPath"],
      },
    },
    {
      type: "function",
      name: HostTool.listAssets,
      description: "List committed lab-*_n.glb files in the workspace.",
      inputSchema: { type: "object", properties: {} },
    },
  ];
}

