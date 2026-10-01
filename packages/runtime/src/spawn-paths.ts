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

export function sessionEnv(base: NodeJS.ProcessEnv, extra: Record<string, string>): NodeJS.ProcessEnv {
  return {
    ...base,
    PATH: extraPath(),
    ...extra,
  };
}

export function nodeBin(): string {
  return process.env.npm_node_execpath || process.execPath;
}
