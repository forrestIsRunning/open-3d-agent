import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SECRET = /(api[_-]?key|authorization|sk-[A-Za-z0-9_-]+|tsk_[A-Za-z0-9_-]+)/gi;

export function redact(text: string): string {
  return text.replace(SECRET, "[redacted]");
}

export function appendRpcLog(file: string, direction: "in" | "out", raw: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const line = JSON.stringify({
    t: new Date().toISOString(),
    direction,
    raw: JSON.parse(redact(raw)),
  });
  appendFileSync(file, line + "\n");
}
