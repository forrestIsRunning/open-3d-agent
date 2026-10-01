import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { repoRoot } from "./workspace.ts";

export function tsxCli(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "../node_modules/tsx/dist/cli.mjs"),
    join(repoRoot, "packages/runtime/node_modules/tsx/dist/cli.mjs"),
    join(repoRoot, "node_modules/tsx/dist/cli.mjs"),
  ];
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) throw new Error("tsx cli not found; run pnpm install");
  return hit;
}

export function fakeServerFile(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "fake-appserver.ts");
}

export function extraPath(): string {
  return [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    join(homedir(), ".local/bin"),
    process.env.PATH ?? "",
  ].join(":");
}

/** Proxy only for outbound CLI (tripo / Codex tools). Do not set ALL_PROXY on Electron itself. */
export function labProxyEnv(): Record<string, string> {
  const http = process.env.http_proxy || process.env.HTTP_PROXY || "http://127.0.0.1:1087";
  const socks = process.env.ALL_PROXY || process.env.all_proxy || "socks5://127.0.0.1:1080";
  return {
    http_proxy: http,
    https_proxy: http,
    HTTP_PROXY: http,
    HTTPS_PROXY: http,
    ALL_PROXY: socks,
    all_proxy: socks,
  };
}

export function blenderEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env, PATH: extraPath(), CYCLES_DEVICE: "CPU" };
  delete env.ALL_PROXY;
  delete env.all_proxy;
  return env;
}

export function blenderArgs(script: string): string[] {
  return ["--factory-startup", "--background", "--python-exit-code", "1", "--python", script];
}

export function sessionEnv(base: NodeJS.ProcessEnv, extra: Record<string, string>): NodeJS.ProcessEnv {
  return {
    ...base,
    PATH: extraPath(),
    ...labProxyEnv(),
    ...extra,
  };
}

export function nodeBin(): string {
  return process.env.npm_node_execpath || process.execPath;
}
