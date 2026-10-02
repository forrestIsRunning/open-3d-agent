<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { classifyIntent } from "@lab3d/protocol";
import { mountViewer, loadGlbBuffer } from "./viewer.ts";

type Msg = { role: "user" | "agent" | "tool" | "system"; text: string };

const messages = ref<Msg[]>([]);
const input = ref("介绍一下自己");
const ready = ref(false);
const busy = ref(false);
const fake = ref<boolean | null>(null);
const model = ref("");
const policy = ref("");
const workspace = ref("");
const assetName = ref("");
const waiting = ref(false);
const assets = ref<string[]>([]);
const jobs = ref<{ id: number; label: string; status: string }[]>([]);
let jobSeq = 1;
const approval = ref<{ id: string; text: string } | null>(null);
const viewRef = ref<HTMLElement | null>(null);
let unsub: (() => void) | undefined;
let lastModel = "";
let opened = false;

watch(
  viewRef,
  (el) => {
    if (el) mountViewer(el);
  },
  { flush: "post" },
);

onMounted(async () => {
  await nextTick();
  const el = viewRef.value ?? document.querySelector<HTMLElement>(".stage");
  if (el) {
    viewRef.value = el;
    mountViewer(el);
  }
  unsub = window.lab.onEvent((ev) => {
    if (ev.method === "agent.text") {
      waiting.value = false;
      messages.value.push({ role: "agent", text: String((ev.params as { text: string }).text) });
    }
    if (ev.method === "agent.tool") {
      /* host jobs replace raw tool dumps */
    }
    if (ev.method === "turn.done") {
      waiting.value = false;
    }
    if (ev.method === "turn.error") {
      waiting.value = false;
      messages.value.push({ role: "system", text: String((ev.params as { message: string }).message) });
    }
    if (ev.method === "approval.needed") {
      const p = ev.params as { id: string; method: string; params?: { command?: string } };
      approval.value = { id: String(p.id), text: p.params?.command || p.method };
    }
    if (ev.method === "model.ready") {
      const path = String((ev.params as { path: string }).path);
      const name = path.split("/").pop() ?? "";
      void showModel(name, false);
    }
  });
  if (!opened) {
    opened = true;
    const info = await window.lab.open();
    fake.value = Boolean(info.fake);
    model.value = info.model ?? "";
    policy.value = info.approvalPolicy ?? "never";
    workspace.value = info.workspace;
    if (info.messages?.length) {
      messages.value = info.messages.map((m) => ({
        role: m.role as Msg["role"],
        text: m.text,
      }));
    } else {
      messages.value.push({
        role: "system",
        text: `已连接 ${info.workspace} · thread ${info.threadId ?? "new"}`,
      });
    }
    await refreshAssets();
    const latest = info.lastAsset || (await window.lab.latestModel()).name;
    if (latest) await showModel(latest, false);
  }
  ready.value = true;
});

onUnmounted(() => unsub?.());

async function send(): Promise<void> {
  const text = input.value.trim();
  if (!text) return;
  messages.value.push({ role: "user", text });
  input.value = "";
  const intent = classifyIntent(text);
  try {
    if (intent.kind === "blender-cube") await cube();
    else if (intent.kind === "blender-lamb") await lamb();
    else if (intent.kind === "generate") await generate(intent.prompt, intent.name);
    else {
      waiting.value = true;
      await window.lab.send(text);
    }
    if (intent.kind !== "chat") {
      waiting.value = true;
      await window.lab.send(
        `[host] 已在宿主侧处理「${text}」。不要执行 Blender.app 或 tripo。用一两句话回复用户。`,
      );
    }
  } catch (err) {
    waiting.value = false;
    messages.value.push({ role: "system", text: String(err) });
  }
}

async function decide(allow: boolean): Promise<void> {
  if (!approval.value) return;
  await window.lab.approve(approval.value.id, { decision: allow ? "accept" : "decline" });
  approval.value = null;
}

async function refreshAssets(): Promise<void> {
  try {
    const r = await window.lab.listAssets();
    assets.value = r.names ?? [];
  } catch {
    assets.value = [];
  }
}

async function showModel(name: string, notify = true): Promise<void> {
  if (!name || name === lastModel) {
    assetName.value = name;
    return;
  }
  lastModel = name;
  try {
    const el = viewRef.value ?? document.querySelector<HTMLElement>(".stage");
    if (el) mountViewer(el);
    const raw = await window.lab.readModel(name);
    const bin = atob(raw.b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    await loadGlbBuffer(bytes);
    assetName.value = name;
    await refreshAssets();
    if (notify) messages.value.push({ role: "system", text: `已载入 ${name}` });
  } catch (err) {
    lastModel = "";
    messages.value.push({ role: "system", text: `加载失败 ${name}: ${String(err)}` });
  }
}

async function cube(): Promise<void> {
  busy.value = true;
  try {
    const r = await window.lab.runCube();
    const name = r?.path?.split("/").pop();
    if (name) await showModel(name);
  } catch (err) {
    messages.value.push({ role: "system", text: String(err) });
  } finally {
    busy.value = false;
  }
}

async function lamb(): Promise<void> {
  busy.value = true;
  try {
    const r = await window.lab.runLamb();
    const name = r?.path?.split("/").pop();
    if (name) await showModel(name);
  } catch (err) {
    messages.value.push({ role: "system", text: String(err) });
  } finally {
    busy.value = false;
  }
}

async function fox(): Promise<void> {
  await generate("a cute low poly fox", "fox");
}

async function generate(prompt: string, name: string): Promise<void> {
  const job = { id: jobSeq++, label: `Tripo · ${name}`, status: "running" };
  jobs.value.push(job);
  busy.value = true;
  try {
    const r = await window.lab.generate(prompt, name);
    const file = r?.path?.split("/").pop();
    job.status = "ok";
    if (file) await showModel(file);
  } catch (err) {
    job.status = "fail";
    messages.value.push({ role: "system", text: String(err) });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="shell">
    <aside class="rail">
      <header class="brand">
        <div class="mark">3D</div>
        <div>
          <div class="title">Lab 3D Agent</div>
          <div class="sub">Codex · Blender · Tripo</div>
        </div>
        <span v-if="fake === true" class="badge fake">FAKE</span>
        <span v-else-if="fake === false" class="badge live">LIVE</span>
      </header>

      <div class="chips">
        <span class="chip" v-if="model">{{ model }}</span>
        <span class="chip">{{ policy || "never" }}</span>
      </div>
      <div v-if="jobs.length" class="jobs">
        <div v-for="j in jobs" :key="j.id" class="job" :class="j.status">{{ j.label }} · {{ j.status }}</div>
      </div>

      <div class="log">
        <article v-for="(m, i) in messages.filter((x) => x.role !== 'tool')" :key="i" class="msg" :class="m.role">
          <span class="who">{{ m.role }}</span>
          <p>{{ m.text }}</p>
        </article>
        <article v-if="waiting" class="msg agent">
          <span class="who">agent</span>
          <p class="pulse">正在回复…</p>
        </article>
      </div>

      <div v-if="approval" class="approval">
        <div class="ap-label">需要审批</div>
        <code>{{ approval.text }}</code>
        <div class="ap-btns">
          <button class="ok" @click="decide(true)">Allow</button>
          <button class="no" @click="decide(false)">Deny</button>
        </div>
      </div>

      <div class="dock">
        <div class="actions">
          <button class="primary" :disabled="!ready || busy" @click="cube">Blender 立方体</button>
          <button :disabled="!ready || busy" @click="lamb">Blender 小羊</button>
          <button :disabled="!ready || busy" @click="fox">Tripo 狐狸</button>
        </div>
        <form @submit.prevent="send">
          <input v-model="input" :disabled="!ready" placeholder="给模型发一句…" />
          <button class="send" :disabled="!ready">发送</button>
        </form>
      </div>
    </aside>

    <main class="stage-wrap">
      <div class="stage" ref="viewRef"></div>
      <div v-if="busy" class="veil">生成中…</div>
      <div class="assets">
        <button
          v-for="n in assets"
          :key="n"
          :class="{ on: n === assetName }"
          @click="showModel(n, false)"
        >
          {{ n }}
        </button>
      </div>
      <div class="hud">
        <span>{{ assetName || "视窗" }}</span>
        <span v-if="busy">导出中…</span>
        <span v-else-if="waiting">模型思考中…</span>
        <span class="path" :title="workspace">{{ workspace }}</span>
      </div>
    </main>
  </div>
</template>

<style>
:root {
  color-scheme: dark;
  --bg: #101218;
  --rail: #161a22;
  --line: #2a3140;
  --text: #e8ecf3;
  --muted: #8b95a7;
  --live: #3dd68c;
  --fake: #ff6b6b;
  --accent: #f4a261;
  --agent: #7ee0c8;
}
* { box-sizing: border-box; }
.shell {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  height: 100%;
  background: var(--bg);
  color: var(--text);
  font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.rail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--rail);
  border-right: 1px solid var(--line);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 8px;
}
.mark {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(145deg, #f4a261, #e76f51);
  color: #1a120c;
  font-weight: 700;
  display: grid;
  place-items: center;
  letter-spacing: -0.04em;
}
.title { font-weight: 650; font-size: 14px; }
.sub { color: var(--muted); font-size: 11px; }
.badge {
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 3px 7px;
  border-radius: 999px;
}
.badge.live { background: #143528; color: var(--live); }
.badge.fake { background: #3a1518; color: var(--fake); }
.chips { display: flex; gap: 6px; padding: 0 16px 10px; flex-wrap: wrap; }
.chip {
  font-size: 11px;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 2px 8px;
}
.log {
  flex: 1;
  overflow: auto;
  padding: 8px 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.msg {
  border-radius: 10px;
  padding: 8px 10px;
  background: #1d2330;
}
.msg .who {
  display: block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin-bottom: 4px;
}
.msg p { margin: 0; white-space: pre-wrap; word-break: break-word; }
.pulse { opacity: 0.7; }
.msg.user { background: #243044; }
.msg.agent { background: #17312c; }
.msg.agent .who { color: var(--agent); }
.msg.system { background: transparent; border: 1px dashed var(--line); color: #9db4ff; }
.msg.tool { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.approval {
  margin: 0 12px 8px;
  padding: 10px;
  border-radius: 10px;
  background: #3a2a12;
  border: 1px solid #7a5420;
}
.ap-label { font-size: 11px; color: var(--accent); margin-bottom: 6px; }
.approval code { display: block; font-size: 11px; color: #f3d9b0; word-break: break-all; }
.ap-btns { display: flex; gap: 8px; margin-top: 8px; }
.ok { background: #2f6f4e; color: #fff; }
.no { background: #7a2e2e; color: #fff; }
.dock { padding: 12px; border-top: 1px solid var(--line); }
.actions, form { display: flex; gap: 8px; }
.actions { margin-bottom: 8px; }
button {
  appearance: none;
  border: 1px solid var(--line);
  background: #222836;
  color: var(--text);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
}
button:disabled { opacity: 0.45; cursor: default; }
button.primary { background: #c56a2d; border-color: #d07a3c; color: #fff; }
button.send { background: #2b3344; }
form { flex: 1; }
form input {
  flex: 1;
  border: 1px solid var(--line);
  background: #10141c;
  color: var(--text);
  border-radius: 8px;
  padding: 8px 10px;
  outline: none;
}
form input:focus { border-color: #5b6b88; }
.jobs { padding: 0 16px 8px; display: flex; flex-direction: column; gap: 4px; }
.job { font-size: 11px; color: var(--muted); }
.job.running { color: var(--accent); }
.job.ok { color: var(--live); }
.job.fail { color: var(--fake); }
.stage-wrap { position: relative; min-width: 0; min-height: 0; }
.stage { position: absolute; inset: 0 0 44px 0; background: #0e1116; }
.veil {
  position: absolute; inset: 0 0 44px 0;
  display: grid; place-items: center;
  background: rgba(8,10,14,0.45);
  pointer-events: none;
}
.assets {
  position: absolute; left: 0; right: 0; bottom: 40px;
  display: flex; gap: 6px; overflow: auto;
  padding: 0 12px 8px;
}
.assets button {
  font-size: 10px;
  padding: 4px 8px;
  white-space: nowrap;
}
.assets button.on { border-color: var(--accent); color: var(--accent); }
.hud {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  display: flex;
  gap: 12px;
  align-items: center;
  pointer-events: none;
  font-size: 11px;
  color: #c5cddd;
  background: rgba(12, 14, 18, 0.55);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  padding: 6px 10px;
  backdrop-filter: blur(8px);
}
.hud .path { margin-left: auto; opacity: 0.7; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
