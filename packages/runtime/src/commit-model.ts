import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { nextModelPath } from "./workspace.ts";

export function commitModel(workspace: string, name: string, exportPath: string): string {
  const src = isAbsolute(exportPath) ? exportPath : resolve(workspace, exportPath);
  if (!existsSync(src)) {
    throw new Error(`export not found: ${src}`);
  }
  const dest = nextModelPath(workspace, name);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  return dest;
}

export function ensurePlaceholderGlb(workspace: string, relative = "exports/cube.glb"): string {
  const dest = join(workspace, relative);
  mkdirSync(dirname(dest), { recursive: true });
  if (!existsSync(dest)) {
    const buf = Buffer.alloc(12);
    buf.write("glTF", 0);
    writeFileSync(dest, buf);
  }
  return dest;
}
