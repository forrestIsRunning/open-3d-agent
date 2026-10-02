import { readdirSync } from "node:fs";

export function listAssets(workspace: string): string[] {
  return readdirSync(workspace)
    .filter((n) => /^lab-[\w-]+_\d+\.glb$/i.test(n))
    .sort();
}
