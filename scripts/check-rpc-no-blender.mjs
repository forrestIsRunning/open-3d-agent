import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/check-rpc-no-blender.mjs <rpc.jsonl>");
  process.exit(2);
}
const text = readFileSync(file, "utf8");
if (/Blender\.app\/Contents\/MacOS\/Blender/.test(text)) {
  console.error("rpc log contains Blender.app spawn");
  process.exit(1);
}
console.log("RPC_NO_BLENDER_OK");
