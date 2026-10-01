import { runBlenderScript } from "./run-blender.ts";

export function runCube(workspace: string): string {
  return runBlenderScript(workspace, "lab-cube.py", "cube");
}

export function runLamb(workspace: string): string {
  return runBlenderScript(workspace, "lab-lamb.py", "lamb");
}
