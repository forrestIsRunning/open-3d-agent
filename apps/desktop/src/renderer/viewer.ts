import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let current: THREE.Object3D | null = null;

export function mountViewer(el: HTMLElement): void {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);
  camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.01, 100);
  camera.position.set(2, 2, 2);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(el.clientWidth, el.clientHeight);
  el.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(3, 5, 2);
  scene.add(dir);
  const grid = new THREE.GridHelper(4, 8);
  scene.add(grid);
  const loop = () => {
    controls.update();
    renderer!.render(scene!, camera!);
    requestAnimationFrame(loop);
  };
  loop();
}

export function loadGlb(url: string): void {
  if (!scene) return;
  const loader = new GLTFLoader();
  loader.load(url, (gltf) => {
    if (current) scene!.remove(current);
    current = gltf.scene;
    scene!.add(current);
  });
}
