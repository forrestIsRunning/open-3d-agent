import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadDotenv } from "./dotenv.ts";
import { runLamb } from "./run-cube.ts";
import { repoRoot, seedWorkspace } from "./workspace.ts";

loadDotenv();
const ws = join(repoRoot, "tmp-ws");
seedWorkspace(ws);
mkdirSync(join(ws, ".lab"), { recursive: true });
const dest = runLamb(ws);
const n = statSync(dest).size;
if (n < 1500) throw new Error(`lamb glb too small: ${n} ${dest}`);
console.log("LAMB_OK", dest, n);
