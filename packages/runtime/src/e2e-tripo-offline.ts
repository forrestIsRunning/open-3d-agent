import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadDotenv } from "./dotenv.ts";
import { runTripo } from "./run-tripo.ts";
import { repoRoot, seedWorkspace } from "./workspace.ts";

loadDotenv();
delete process.env.LAB_TRIPO_STUB;
process.env.http_proxy = "http://127.0.0.1:1";
process.env.https_proxy = "http://127.0.0.1:1";
process.env.ALL_PROXY = "http://127.0.0.1:1";
process.env.LAB_TRIPO_TIMEOUT_MS = "8000";
const ws = join(repoRoot, "tmp-ws");
seedWorkspace(ws);
mkdirSync(join(ws, ".lab"), { recursive: true });
let threw = false;
try {
  runTripo(ws, "offline puppy", "puppy");
} catch (err) {
  threw = true;
  const msg = String(err);
  if (!/network|fetch|ECONNREFUSED|tripo|fail/i.test(msg)) {
    throw new Error(`expected network-like error, got ${msg}`);
  }
  console.log("TRIP0_OFFLINE_OK", msg.slice(0, 180));
}
if (!threw) throw new Error("tripo offline should fail");
