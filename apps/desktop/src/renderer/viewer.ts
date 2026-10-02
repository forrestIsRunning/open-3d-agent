import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
let current: THREE.Object3D | null = null;
let previous: THREE.Object3D | null = null;
let selected: THREE.Object3D | null = null;
let selectedBox: THREE.BoxHelper | null = null;
let ambient: THREE.AmbientLight | null = null;
let keyLight: THREE.DirectionalLight | null = null;
let fillLight: THREE.DirectionalLight | null = null;
let grid: THREE.GridHelper | null = null;
let ground: THREE.Mesh | null = null;
let hostEl: HTMLElement | null = null;
let compareOn = false;
const viewBg = new THREE.Color(0x0e1116);
const shotBg = new THREE.Color(0xd8dbe3);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selectCb: ((name: string) => void) | null = null;

export function setSelectHandler(fn: (name: string) => void): void {
  selectCb = fn;
}

export function mountViewer(el: HTMLElement): void {
  hostEl = el;
  if (renderer) {
    if (renderer.domElement.parentElement !== el) el.appendChild(renderer.domElement);
    resize(el);
    return;
  }
  scene = new THREE.Scene();
  scene.background = viewBg;
  camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
  camera.position.set(2.4, 1.8, 2.4);
  camera.lookAt(0, 0.4, 0);
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  el.appendChild(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  ambient = new THREE.AmbientLight(0xffffff, 0.28);
  keyLight = new THREE.DirectionalLight(0xfff4e8, 0.85);
  keyLight.position.set(3, 5, 2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.2;
  keyLight.shadow.camera.far = 40;
  keyLight.shadow.camera.left = -8;
  keyLight.shadow.camera.right = 8;
  keyLight.shadow.camera.top = 8;
  keyLight.shadow.camera.bottom = -8;
  fillLight = new THREE.DirectionalLight(0x88a0c0, 0.35);
  fillLight.position.set(-4, 1.5, -2);
  scene.add(ambient, keyLight, fillLight);
  grid = new THREE.GridHelper(8, 16, 0x3d4654, 0x252b36);
  scene.add(grid);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(6, 48),
    new THREE.ShadowMaterial({ opacity: 0.35 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.position.y = 0;
  ground = floor;
  scene.add(ground);

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  const loop = () => {
    controls!.update();
    renderer!.render(scene!, camera!);
    requestAnimationFrame(loop);
  };
  loop();
  resize(el);
  new ResizeObserver(() => resize(el)).observe(el);
}

function resize(el: HTMLElement): void {
  if (!renderer || !camera) return;
  const w = Math.max(el.clientWidth, 1);
  const h = Math.max(el.clientHeight, 1);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

export function isViewerMounted(): boolean {
  return Boolean(scene && camera);
}

export async function whenViewerMounted(timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (!isViewerMounted()) {
    if (Date.now() - start > timeoutMs) throw new Error("viewer not mounted");
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

function frameObject(obj: THREE.Object3D): void {
  if (!camera || !controls) return;
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3()).length() || 1;
  const center = box.getCenter(new THREE.Vector3());
  camera.near = Math.max(size / 200, 0.01);
  camera.far = Math.max(size * 20, 50);
  camera.position.copy(center).add(new THREE.Vector3(size * 0.7, size * 0.5, size * 0.7));
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

function clearSelected(): void {
  if (selectedBox && scene) scene.remove(selectedBox);
  selectedBox = null;
  selected = null;
}

function markSelected(obj: THREE.Object3D): void {
  clearSelected();
  selected = obj;
  selectedBox = new THREE.BoxHelper(obj, 0xf4a261);
  scene?.add(selectedBox);
}

function onPointerDown(ev: PointerEvent): void {
  if (!renderer || !camera || !current) return;
  if (ev.button !== 0) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(current, true);
  if (hits[0]) {
    markSelected(hits[0].object);
    selectCb?.(selectedName());
  }
}

export function selectedName(): string {
  return selected?.name || (selected as THREE.Mesh | null)?.type || "";
}

export function focusSelected(): void {
  if (selected) frameObject(selected);
  else if (current) frameObject(current);
}

export function setLightPreset(kind: "studio" | "soft" | "rim"): void {
  if (!ambient || !keyLight || !fillLight) return;
  if (kind === "studio") {
    ambient.intensity = 0.28;
    keyLight.intensity = 0.85;
    keyLight.position.set(3, 5, 2);
    fillLight.intensity = 0.28;
  } else if (kind === "soft") {
    ambient.intensity = 0.95;
    keyLight.intensity = 0.45;
    fillLight.intensity = 0.4;
  } else {
    ambient.intensity = 0.2;
    keyLight.intensity = 0.35;
    keyLight.position.set(-2, 4, -3);
    fillLight.intensity = 1.2;
    fillLight.position.set(4, 2, 3);
  }
}

export function setCompare(on: boolean): void {
  compareOn = on;
  if (previous) previous.visible = on;
}

export function isCompareOn(): boolean {
  return compareOn;
}

export function capturePng(): string {
  return captureFrame({ product: false });
}

export function captureProductPng(): string {
  return captureFrame({ product: true });
}

function captureFrame(opts: { product: boolean }): string {
  if (!renderer || !scene || !camera) return "";
  const gridWas = grid?.visible ?? false;
  const boxWas = selectedBox?.visible ?? false;
  const prevWas = previous?.visible ?? false;
  const bg = scene.background;
  const floor = ground?.material as THREE.Material | undefined;
  if (grid) grid.visible = false;
  if (selectedBox) selectedBox.visible = false;
  if (previous) previous.visible = false;
  if (opts.product) {
    scene.background = shotBg;
    if (ground) {
      ground.material = new THREE.MeshStandardMaterial({
        color: 0xd0d4dc,
        roughness: 0.9,
        metalness: 0,
      });
      ground.receiveShadow = true;
    }
  } else {
    scene.background = viewBg;
  }
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");
  if (grid) grid.visible = gridWas;
  if (selectedBox) selectedBox.visible = boxWas;
  if (previous) previous.visible = prevWas;
  scene.background = bg;
  if (ground && floor) ground.material = floor;
  renderer.render(scene, camera);
  return url;
}

function prepareMesh(mesh: THREE.Mesh): void {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const hasVertexColor = Boolean(mesh.geometry?.getAttribute("color"));
  for (const raw of list) {
    const mat = raw as THREE.MeshStandardMaterial;
    if (!mat) continue;
    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    if (hasVertexColor) mat.vertexColors = true;
    // glTF default metallicFactor is 1; Tripo often omits it, so textured characters
    // render as white metal under an environment map.
    const looksDefaultMetal =
      mat.metalness >= 0.99 && mat.roughness >= 0.85 && Boolean(mat.map);
    if (looksDefaultMetal) {
      mat.metalness = 0.04;
      mat.roughness = Math.min(0.72, Math.max(0.45, mat.roughness));
    }
    if ("envMapIntensity" in mat) mat.envMapIntensity = looksDefaultMetal ? 0.35 : 0.55;
    mat.needsUpdate = true;
  }
}

export async function loadGlbBuffer(data: ArrayBuffer | Uint8Array): Promise<void> {
  await whenViewerMounted();
  if (!scene || !camera) return Promise.reject(new Error("viewer not mounted"));
  const copy = data instanceof Uint8Array ? data.slice() : new Uint8Array(data);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(
      copy.buffer as ArrayBuffer,
      "",
      (gltf) => {
        clearSelected();
        if (previous && scene) scene.remove(previous);
        if (current) {
          previous = current;
          previous.traverse((n) => {
            const mesh = n as THREE.Mesh;
            if (mesh.isMesh && mesh.material) {
              const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
              mat.transparent = true;
              mat.opacity = 0.28;
              mat.color = new THREE.Color(0x88a0c8);
              mesh.material = mat;
            }
          });
          previous.visible = compareOn;
          scene!.add(previous);
        }
        current = gltf.scene;
        current.traverse((n) => {
          const mesh = n as THREE.Mesh;
          if (mesh.isMesh) prepareMesh(mesh);
        });
        scene!.add(current);
        frameObject(current);
        resolve();
      },
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
}

export function captureAfterPaint(): Promise<string> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve(capturePng()));
    });
  });
}

void hostEl;
