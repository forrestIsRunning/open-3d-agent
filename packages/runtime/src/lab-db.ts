import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type LabMessage = { role: string; text: string; createdAt: number };

export class LabDb {
  private db: DatabaseSync;

  constructor(file: string) {
    mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  getMeta(k: string): string | undefined {
    const row = this.db.prepare("SELECT v FROM meta WHERE k = ?").get(k) as { v: string } | undefined;
    return row?.v;
  }

  setMeta(k: string, v: string): void {
    this.db.prepare("INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(k, v);
  }

  addMessage(role: string, text: string): void {
    this.db.prepare("INSERT INTO messages(role, text, created_at) VALUES(?, ?, ?)").run(role, text, Date.now());
  }

  listMessages(): LabMessage[] {
    const rows = this.db.prepare("SELECT role, text, created_at AS createdAt FROM messages ORDER BY id").all() as Array<{
      role: string;
      text: string;
      createdAt: number;
    }>;
    return rows;
  }

  close(): void {
    this.db.close();
  }
}

export function openLabDb(workspace: string): LabDb {
  return new LabDb(join(workspace, ".lab/lab.sqlite"));
}
