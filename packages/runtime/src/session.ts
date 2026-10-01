import { ClientMethod, HostTool, ServerMethod, ServerNotify } from "@lab3d/protocol";
import { AppServerClient, type JsonRpcId } from "./appserver-client.ts";
import { commitModel } from "./commit-model.ts";

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
    const started = (await this.client.request(ClientMethod.threadStart, {
      cwd: this.workspace,
      model: this.opts.model,
      approvalPolicy: this.opts.approvalPolicy ?? "never",
      sandbox: this.opts.sandbox ?? "workspace-write",
      ephemeral: true,
      experimentalRawEvents: false,
      dynamicTools: [
        {
          type: "function",
          name: HostTool.commitModel,
          description: "Register an exported GLB as the next lab-<name>_<n>.glb version.",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string" },
              exportPath: { type: "string" },
            },
            required: ["name", "exportPath"],
          },
        },
      ],
    })) as { thread?: { id?: string } };
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
      const p = params as { tool?: string; arguments?: { name?: string; exportPath?: string } };
      if (p.tool === HostTool.commitModel) {
        const dest = commitModel(
          this.workspace,
          p.arguments?.name ?? "model",
          p.arguments?.exportPath ?? "",
        );
        this.opts.events?.onModelReady?.(dest);
        return {
          success: true,
          contentItems: [{ type: "inputText", text: dest }],
        };
      }
      return {
        success: false,
        contentItems: [{ type: "inputText", text: `unknown tool ${p.tool}` }],
      };
    }

    if (
      method === ServerMethod.commandApproval ||
      method === ServerMethod.fileChangeApproval
    ) {
      if (this.opts.autoApprove) return { decision: "accept" };
      this.opts.events?.onApproval?.(id, method, params);
      return await this.waitPending(String(id));
    }

    if (method === ServerMethod.permissionsApproval) {
      if (this.opts.autoApprove) {
        return { permissions: {}, scope: "turn" };
      }
      this.opts.events?.onApproval?.(id, method, params);
      return await this.waitPending(String(id));
    }

    if (method === ServerMethod.requestUserInput) {
      if (this.opts.autoApprove) return { answers: {} };
      this.opts.events?.onUserInput?.(id, params);
      return await this.waitPending(String(id));
    }

    return {};
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

