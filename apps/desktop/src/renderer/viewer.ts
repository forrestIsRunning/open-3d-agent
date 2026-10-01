import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let current: THREE.Object3D | null = null;
let placeholder: THREE.Object3D | null = null;

export function mountViewer(el: HTMLElement): void {
  if (renderer) {
    resize(el);
    return;
  }
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1d23);
  camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
  camera.position.set(2.4, 1.8, 2.4);
  camera.lookAt(0, 0, 0);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  el.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(3, 5, 2);
  scene.add(dir);
  scene.add(new THREE.GridHelper(6, 12, 0x6a7380, 0x3a414c));
  scene.add(new THREE.AxesHelper(1.2));

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x5b8def, roughness: 0.4, metalness: 0.1 }),
  );
  cube.position.y = 0.5;
  placeholder = cube;
  scene.add(cube);

  const loop = () => {
    controls.update();
    renderer!.render(scene!, camera!);
    requestAnimationFrame(loop);
  };
  loop();
  resize(el);
  const ro = new ResizeObserver(() => resize(el));
  ro.observe(el);
}

function resize(el: HTMLElement): void {
  if (!renderer || !camera) return;
  const w = Math.max(el.clientWidth, 1);
  const h = Math.max(el.clientHeight, 1);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

export function loadGlb(url: string): void {
  if (!scene) return;
  const loader = new GLTFLoader();
  loader.load(url, (gltf) => {
    if (placeholder) {
      scene!.remove(placeholder);
      placeholder = null;
    }
    if (current) scene!.remove(current);
    current = gltf.scene;
    scene!.add(current);
  });
}
