import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type LabMessage = { role: string; text: string; createdAt: number };
export type LabSession = {
  id: number;
  title: string;
  threadId: string;
  createdAt: number;
  updatedAt: number;
};

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
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        thread_id TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    this.migrate();
  }

  private migrate(): void {
    const cols = this.db.prepare("PRAGMA table_info(messages)").all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "session_id")) {
      this.db.exec("ALTER TABLE messages ADD COLUMN session_id INTEGER NOT NULL DEFAULT 0");
    }
    const n = (this.db.prepare("SELECT COUNT(*) AS n FROM sessions").get() as { n: number }).n;
    if (n === 0) {
      const now = Date.now();
      const thread = this.getMeta("threadId") ?? "";
      const ins = this.db
        .prepare("INSERT INTO sessions(title, thread_id, created_at, updated_at) VALUES(?, ?, ?, ?)")
        .run("Chat", thread, now, now);
      const id = Number(ins.lastInsertRowid);
      this.db.prepare("UPDATE messages SET session_id = ? WHERE session_id = 0").run(id);
      this.setMeta("sessionId", String(id));
    }
    if (!this.getMeta("sessionId")) {
      const row = this.db.prepare("SELECT id FROM sessions ORDER BY id DESC LIMIT 1").get() as
        | { id: number }
        | undefined;
      if (row) this.setMeta("sessionId", String(row.id));
    }
  }

  getMeta(k: string): string | undefined {
    const row = this.db.prepare("SELECT v FROM meta WHERE k = ?").get(k) as { v: string } | undefined;
    return row?.v;
  }

  setMeta(k: string, v: string): void {
    this.db.prepare("INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(k, v);
  }

  currentSessionId(): number {
    return Number(this.getMeta("sessionId") ?? 0);
  }

  listSessions(): LabSession[] {
    return this.db
      .prepare(
        "SELECT id, title, thread_id AS threadId, created_at AS createdAt, updated_at AS updatedAt FROM sessions ORDER BY updated_at DESC",
      )
      .all() as LabSession[];
  }

  getSession(id: number): LabSession | undefined {
    return this.db
      .prepare(
        "SELECT id, title, thread_id AS threadId, created_at AS createdAt, updated_at AS updatedAt FROM sessions WHERE id = ?",
      )
      .get(id) as LabSession | undefined;
  }

  createSession(threadId: string, title = "New chat"): LabSession {
    const now = Date.now();
    const ins = this.db
      .prepare("INSERT INTO sessions(title, thread_id, created_at, updated_at) VALUES(?, ?, ?, ?)")
      .run(title, threadId, now, now);
    const id = Number(ins.lastInsertRowid);
    this.setMeta("sessionId", String(id));
    this.setMeta("threadId", threadId);
    return this.getSession(id)!;
  }

  bindThread(sessionId: number, threadId: string): void {
    this.db
      .prepare("UPDATE sessions SET thread_id = ?, updated_at = ? WHERE id = ?")
      .run(threadId, Date.now(), sessionId);
    this.setMeta("sessionId", String(sessionId));
    this.setMeta("threadId", threadId);
  }

  openSession(id: number): LabSession {
    const s = this.getSession(id);
    if (!s) throw new Error(`unknown session ${id}`);
    this.setMeta("sessionId", String(s.id));
    if (s.threadId) this.setMeta("threadId", s.threadId);
    this.db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(Date.now(), id);
    return s;
  }

  addMessage(role: string, text: string): void {
    const sid = this.currentSessionId();
    this.db
      .prepare("INSERT INTO messages(role, text, created_at, session_id) VALUES(?, ?, ?, ?)")
      .run(role, text, Date.now(), sid);
    if (sid && role === "user") this.maybeTitle(sid, text);
    if (sid) this.db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(Date.now(), sid);
  }

  private maybeTitle(sessionId: number, text: string): void {
    const s = this.getSession(sessionId);
    if (!s || (s.title !== "New chat" && s.title !== "Chat")) return;
    let line = text.trim();
    const user = line.split("\nUser: ").pop();
    if (user) line = user.trim();
    line = line.replace(/^Stage:[^\n]*\n/, "").slice(0, 42);
    if (line.length < 2) return;
    this.db.prepare("UPDATE sessions SET title = ? WHERE id = ?").run(line, sessionId);
  }

  listMessages(sessionId?: number): LabMessage[] {
    const sid = sessionId ?? this.currentSessionId();
    const rows = this.db
      .prepare(
        "SELECT role, text, created_at AS createdAt FROM messages WHERE session_id = ? ORDER BY id",
      )
      .all(sid) as Array<{ role: string; text: string; createdAt: number }>;
    return rows;
  }

  close(): void {
    this.db.close();
  }
}

export function openLabDb(workspace: string): LabDb {
  return new LabDb(join(workspace, ".lab/lab.sqlite"));
}
