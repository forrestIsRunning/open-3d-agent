<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { classifyIntent, parseAssetName } from "@lab3d/protocol";
import {
  captureAfterPaint,
  capturePng,
  captureProductPng,
  focusSelected,
  loadGlbBuffer,
  mountViewer,
  selectedName,
  setCompare,
  setLightPreset,
  setSelectHandler,
} from "./viewer.ts";

type Msg = { role: "user" | "agent" | "tool" | "system"; text: string };

const messages = ref<Msg[]>([]);
const input = ref("");
const thumbs = ref<Record<string, string>>({});
const lights = ref<"studio" | "soft" | "rim">("studio");
const compare = ref(false);
const pickHint = ref("");
const pendingImage = ref("");
const pendingLabel = ref("");
const pendingPreview = ref("");
const fileRef = ref<HTMLInputElement | null>(null);
const look = ref<{ before: string; concept: string; after: string; open: boolean }>({
  before: "",
  concept: "",
  after: "",
  open: false,
});
const veilLabel = ref("生成中…");
const stageTitle = computed(() => (assetName.value ? parseAssetName(assetName.value).label : "空舞台"));
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
  setSelectHandler((n) => {
    pickHint.value = n;
  });
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
    if (ev.method === "edit.concept") {
      const rel = String((ev.params as { path: string }).path);
      void showConcept(rel);
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

function stageContext(): string {
  const title = assetName.value ? parseAssetName(assetName.value).label : "空舞台";
  const sel = selectedName();
  const pick = sel ? `；选中 ${sel}` : "";
  return `当前舞台：${title}${assetName.value ? `（${assetName.value}）` : ""}${pick}`;
}

async function send(): Promise<void> {
  const text = input.value.trim();
  if (!text && !pendingImage.value) return;
  messages.value.push({ role: "user", text: text || `上传 ${pendingLabel.value || "附件"}` });
  input.value = "";
  let intent = classifyIntent(text);
  if (pendingImage.value && (intent.kind === "chat" || !text)) {
    if (!text || /生成|做成|3d|模型|图生/i.test(text)) {
      intent = { kind: "generate", prompt: text || "a 3d model matching this image", name: "ref" };
    }
  }
  const wrapped = `${stageContext()}\n用户：${text}${pendingImage.value ? `\n附件：${pendingImage.value}` : ""}`;
  try {
    if (intent.kind === "blender-cube") await cube();
    else if (intent.kind === "blender-lamb") await lamb();
    else if (intent.kind === "generate") {
      await generate(intent.prompt, intent.name, pendingImage.value || undefined);
    }
    else if (intent.kind === "edit") await editCurrent(intent.prompt);
    else if (intent.kind === "blender-transform") await transformCurrent(intent);
    else {
      waiting.value = true;
      await window.lab.send(wrapped);
    }
    if (intent.kind !== "chat") {
      waiting.value = true;
      await window.lab.send(
        `${stageContext()}\n[host] 已处理「${text}」。不要执行 Blender.app 或 tripo。用一两句话对着当前舞台回复。`,
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

async function loadThumb(name: string): Promise<void> {
  if (thumbs.value[name]) return;
  const img = await window.lab.readImage(name);
  if (img.b64) thumbs.value[name] = `data:image/png;base64,${img.b64}`;
}

async function refreshAssets(): Promise<void> {
  try {
    const r = await window.lab.listAssets();
    assets.value = r.names ?? [];
    await Promise.all(assets.value.map((n) => loadThumb(n)));
  } catch {
    assets.value = [];
  }
}

async function snapshotThumb(name: string): Promise<void> {
  const url = captureProductPng() || (await captureAfterPaint());
  if (!url) return;
  thumbs.value[name] = url;
  const b64 = url.replace(/^data:image\/png;base64,/, "");
  await window.lab.saveImage(name.replace(/\.glb$/i, ".png"), b64);
}

async function showConcept(rel: string): Promise<void> {
  const img = await window.lab.readLabImage(rel);
  if (!img.b64) return;
  const url = `data:image/png;base64,${img.b64}`;
  look.value = { ...look.value, concept: url, open: true };
  veilLabel.value = "概念图已出 · 正在生成 3D";
}

async function showModel(name: string, notify = true): Promise<void> {
  if (!name) return;
  if (name === lastModel) {
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
    pickHint.value = "";
    await refreshAssets();
    await snapshotThumb(name);
    if (notify) messages.value.push({ role: "system", text: `舞台：${parseAssetName(name).label}` });
  } catch (err) {
    lastModel = "";
    messages.value.push({ role: "system", text: `加载失败 ${name}: ${String(err)}` });
  }
}

function applyLights(): void {
  setLightPreset(lights.value);
}

function toggleCompare(): void {
  compare.value = !compare.value;
  setCompare(compare.value);
}

function onFocus(): void {
  focusSelected();
  pickHint.value = selectedName() || "整体";
}

async function sendShot(): Promise<void> {
  const url = captureProductPng() || capturePng();
  if (!url) return;
  const b64 = url.replace(/^data:image\/png;base64,/, "");
  const shot = await window.lab.saveShot(b64);
  pendingImage.value = shot.path;
  look.value = { ...look.value, before: url, open: true };
  messages.value.push({ role: "user", text: `干净截图已作为下一枪编辑条件 ${shot.name}` });
}

async function removeAsset(name: string, ev: Event): Promise<void> {
  ev.stopPropagation();
  await window.lab.deleteAsset(name);
  if (assetName.value === name) {
    lastModel = "";
    assetName.value = "";
  }
  delete thumbs.value[name];
  await refreshAssets();
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

async function editCurrent(prompt: string): Promise<void> {
  if (!assetName.value) throw new Error("空舞台：先生成或点开一件模型再改");
  const family = parseAssetName(assetName.value).family;
  const before = captureProductPng() || capturePng();
  look.value = { before, concept: "", after: "", open: true };
  veilLabel.value = "正在出概念图…";
  let imagePath = pendingImage.value;
  if (!imagePath) {
    if (before) {
      const b64 = before.replace(/^data:image\/png;base64,/, "");
      const shot = await window.lab.saveShot(b64);
      imagePath = shot.path;
    }
  }
  const job = { id: jobSeq++, label: `Edit · ${family}`, status: "running" };
  jobs.value.push(job);
  busy.value = true;
  try {
    const r = await window.lab.edit(prompt, family, imagePath || undefined);
    const file = r?.path?.split("/").pop();
    job.status = "ok";
    clearAttach();
    if (file) {
      if (look.value.concept) thumbs.value[file] = look.value.concept;
      await showModel(file);
      look.value = { ...look.value, after: thumbs.value[file] || captureProductPng(), open: true };
    }
  } catch (err) {
    job.status = "fail";
    throw err;
  } finally {
    busy.value = false;
    veilLabel.value = "生成中…";
  }
}

async function transformCurrent(intent: {
  op: "ground" | "height" | "yaw";
  height?: number;
  yaw?: number;
}): Promise<void> {
  if (!assetName.value) throw new Error("空舞台：先有一件模型再变换");
  const job = { id: jobSeq++, label: `Blender · ${intent.op}`, status: "running" };
  jobs.value.push(job);
  busy.value = true;
  try {
    const r = await window.lab.transform(assetName.value, intent.op, {
      height: intent.height,
      yaw: intent.yaw,
    });
    const file = r?.path?.split("/").pop();
    job.status = "ok";
    if (file) await showModel(file);
  } catch (err) {
    job.status = "fail";
    throw err;
  } finally {
    busy.value = false;
  }
}

function fileToB64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? "");
      resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function attachFile(file: File): Promise<void> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext === "glb" || ext === "gltf" || file.type === "model/gltf-binary") {
    const b64 = await fileToB64(file);
    const r = await window.lab.importGlb(b64, file.name.replace(/\.[^.]+$/, "") || "import");
    const name = r?.path?.split("/").pop();
    messages.value.push({ role: "system", text: `已导入 ${file.name}` });
    if (name) await showModel(name);
    return;
  }
  if (!file.type.startsWith("image/") && !/\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
    messages.value.push({ role: "system", text: "请上传图片或 GLB" });
    return;
  }
  const b64 = await fileToB64(file);
  const ref = await window.lab.saveRef(b64, ext || "png");
  pendingImage.value = ref.path;
  pendingLabel.value = file.name;
  pendingPreview.value = `data:${file.type || "image/png"};base64,${b64}`;
  messages.value.push({ role: "system", text: `已附加 ${file.name}，发送即可图生 3D，或说「改成…」编辑当前模型` });
}

async function onDrop(ev: DragEvent): Promise<void> {
  ev.preventDefault();
  const f = ev.dataTransfer?.files?.[0];
  if (f) await attachFile(f);
}

async function onPaste(ev: ClipboardEvent): Promise<void> {
  const item = [...(ev.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
  const f = item?.getAsFile();
  if (!f) return;
  ev.preventDefault();
  await attachFile(f);
}

async function onPick(ev: Event): Promise<void> {
  const inputEl = ev.target as HTMLInputElement;
  const f = inputEl.files?.[0];
  inputEl.value = "";
  if (f) await attachFile(f);
}

function clearAttach(): void {
  pendingImage.value = "";
  pendingLabel.value = "";
  pendingPreview.value = "";
}

async function generate(prompt: string, name: string, imagePath?: string): Promise<void> {
  const job = { id: jobSeq++, label: imagePath ? `图生3D · ${name}` : `Tripo · ${name}`, status: "running" };
  jobs.value.push(job);
  busy.value = true;
  try {
    const r = await window.lab.generate(prompt, name, imagePath);
    const file = r?.path?.split("/").pop();
    job.status = "ok";
    clearAttach();
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
        <span class="chip on">{{ stageTitle }}</span>
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
        <div v-if="pendingPreview" class="attach">
          <img :src="pendingPreview" alt="" />
          <span>{{ pendingLabel }}</span>
          <button type="button" class="x" @click="clearAttach">×</button>
        </div>
        <form @submit.prevent="send" @drop="onDrop" @dragover.prevent>
          <input
            ref="fileRef"
            class="file"
            type="file"
            accept="image/png,image/jpeg,image/webp,.glb,.gltf"
            @change="onPick"
          />
          <button type="button" class="plus" :disabled="!ready || busy" aria-label="上传" @click="fileRef?.click()">
            +
          </button>
          <input
            v-model="input"
            :disabled="!ready || busy"
            :placeholder="pendingImage ? `附图已就绪，发送或说「改成…」` : `你想做什么 3D？`"
            @paste="onPaste"
          />
          <button class="send" type="submit" :disabled="!ready || busy" aria-label="发送">↑</button>
        </form>
      </div>
    </aside>

    <main class="stage-wrap" @drop="onDrop" @dragover.prevent>
      <div class="tools">
        <button type="button" @click="onFocus">聚焦</button>
        <button type="button" @click="sendShot">截图回灌</button>
        <select v-model="lights" @change="applyLights">
          <option value="studio">灯光 · 摄影棚</option>
          <option value="soft">灯光 · 柔和</option>
          <option value="rim">灯光 · 轮廓</option>
        </select>
        <button type="button" :class="{ on: compare }" @click="toggleCompare">对比上一版</button>
        <button type="button" :class="{ on: look.open }" @click="look.open = !look.open">看片</button>
      </div>
      <div class="stage" ref="viewRef"></div>
      <div v-if="busy" class="veil">
        <img v-if="look.concept" :src="look.concept" alt="" />
        <span>{{ veilLabel }}</span>
      </div>
      <div v-if="look.open && (look.before || look.concept || look.after)" class="lookbook">
        <figure v-if="look.before">
          <img :src="look.before" alt="" />
          <figcaption>原版</figcaption>
        </figure>
        <figure v-if="look.concept">
          <img :src="look.concept" alt="" />
          <figcaption>概念图</figcaption>
        </figure>
        <figure v-if="look.after">
          <img :src="look.after" alt="" />
          <figcaption>成片</figcaption>
        </figure>
      </div>
      <div class="film">
        <button
          v-for="n in assets"
          :key="n"
          class="card"
          :class="{ on: n === assetName }"
          @click="showModel(n, false)"
        >
          <img v-if="thumbs[n]" :src="thumbs[n]" alt="" />
          <span class="ph" v-else />
          <em>{{ parseAssetName(n).label }}</em>
          <i @click="removeAsset(n, $event)">×</i>
        </button>
      </div>
      <div class="hud">
        <span>{{ stageTitle }}</span>
        <span v-if="pickHint">选中 {{ pickHint }}</span>
        <span v-if="busy">导出中…</span>
        <span v-else-if="waiting">模型思考中…</span>
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
.chip.on { color: var(--accent); border-color: #7a4e28; }
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
.dock { padding: 12px 14px 16px; border-top: 1px solid var(--line); }
.attach {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #10141c;
  font-size: 12px;
  color: var(--muted);
}
.attach img { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; }
.attach .x { padding: 2px 8px; background: transparent; }
.file { display: none; }
button.plus {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 999px;
  flex: 0 0 36px;
  font-size: 20px;
  line-height: 1;
  background: #1a2030;
}
form { display: flex; gap: 8px; align-items: center; }
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
button.send {
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: #2f6f4e;
  color: #fff;
  font-size: 16px;
  flex: 0 0 36px;
}
form { flex: 1; }
form input {
  flex: 1;
  border: 1px solid var(--line);
  background: #10141c;
  color: var(--text);
  border-radius: 999px;
  padding: 10px 16px;
  outline: none;
}
form input:focus { border-color: #5b6b88; }
.jobs { padding: 0 16px 8px; display: flex; flex-direction: column; gap: 4px; }
.job { font-size: 11px; color: var(--muted); }
.job.running { color: var(--accent); }
.job.ok { color: var(--live); }
.job.fail { color: var(--fake); }
.stage-wrap { position: relative; min-width: 0; min-height: 0; }
.tools {
  position: absolute; top: 10px; left: 12px; z-index: 2;
  display: flex; gap: 6px; pointer-events: auto;
}
.tools select, .tools button {
  font-size: 11px;
  padding: 5px 8px;
  background: rgba(16,20,28,0.82);
}
.tools button.on { border-color: var(--accent); color: var(--accent); }
.stage { position: absolute; inset: 36px 0 108px 0; background: #0e1116; }
.veil {
  position: absolute; inset: 36px 0 108px 0;
  display: grid; place-items: center;
  align-content: center;
  gap: 10px;
  background: rgba(8,10,14,0.55);
  pointer-events: none;
}
.veil img {
  max-width: 46%;
  max-height: 58%;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.45);
}
.lookbook {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 116px;
  display: flex;
  gap: 8px;
  pointer-events: none;
  z-index: 3;
}
.lookbook figure {
  margin: 0;
  flex: 1;
  background: rgba(16,20,28,0.88);
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}
.lookbook img {
  display: block;
  width: 100%;
  height: 110px;
  object-fit: contain;
  background: #d8dbe3;
}
.lookbook figcaption {
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--muted);
  padding: 4px 8px 6px;
}
.film {
  position: absolute; left: 0; right: 0; bottom: 40px;
  display: flex; gap: 8px; overflow-x: auto;
  padding: 0 12px 8px;
}
.card {
  position: relative;
  width: 92px;
  padding: 0;
  overflow: hidden;
  flex: 0 0 auto;
  background: #12161e;
}
.card img, .card .ph {
  display: block;
  width: 92px;
  height: 64px;
  object-fit: cover;
  background: #1a2030;
}
.card em {
  display: block;
  font-style: normal;
  font-size: 10px;
  padding: 4px 6px 6px;
}
.card i {
  position: absolute;
  top: 2px;
  right: 4px;
  font-style: normal;
  color: #ccc;
  cursor: pointer;
}
.card.on { border-color: var(--accent); }
.hud {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 8px;
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
