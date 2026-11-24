import React, {useEffect, useRef} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  createDesmontandoCharacter,
  type CharacterPose,
  type DesmontandoCharacterRig,
} from './DesmontandoRig';
import {CENTERBOX_CUES} from './centerboxWords';

export const CB = {
  green: '#0E8A3E',
  greenDark: '#143D2B',
  orange: '#E8730C',
  gold: '#D98A0B',
  blue: '#1F3C88',
  red: '#D7261E',
  purple: '#6B2C91',
  mint: '#F4F7F5',
};

const C = CENTERBOX_CUES;
const L1 = C.f_ato2 - C.f_ato1;
const L2 = C.f_ato3 - C.f_ato2;
const L3 = C.f_ato4 - C.f_ato3;
const L4 = C.f_ato5 - C.f_ato4;
const L5 = C.total_frames - C.f_ato5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type V3 = [number, number, number];
type CamKey = {f: number; pos: V3; look: V3; fov: number};

const CAM_KEYS: CamKey[] = [
  // ATO 1 — drone descendo sobre o escritório até a zona anterior (intermediária 0,75%)
  {f: 0, pos: [2.0, 12.5, 19.0], look: [1.0, 0.8, -1.2], fov: 42},
  {f: C.f_ato1 + L1 * 0.3, pos: [-3.2, 4.8, 8.8], look: [-5.6, 1.4, -0.8], fov: 38},
  {f: C.f_ato1 + L1 * 0.65, pos: [-5.6, 2.6, 4.9], look: [-5.7, 1.5, -0.9], fov: 36},
  {f: C.f_ato2 - 6, pos: [-4.6, 2.7, 5.2], look: [-4.5, 1.6, -1.2], fov: 36},
  // ATO 2 — setor de TI + núcleo próprio do Portal + comparativo 0,75% vs 3,50%
  {f: C.f_ato2 + L2 * 0.16, pos: [2.6, 3.6, 6.2], look: [4.0, 1.9, -1.8], fov: 38},
  {f: C.f_ato2 + L2 * 0.45, pos: [4.2, 3.3, 4.2], look: [4.2, 2.2, -2.5], fov: 36},
  {f: C.f_ato2 + L2 * 0.78, pos: [5.4, 2.8, 3.8], look: [4.2, 2.1, -2.2], fov: 35},
  // ATO 3 — fornecedor caminha até o portal, simula R$ 100 mil (3,50% -> R$ 96.500) e assina
  {f: C.f_ato3 + L3 * 0.16, pos: [-2.6, 2.7, 5.4], look: [-2.4, 1.4, -0.8], fov: 36},
  {f: C.f_ato3 + L3 * 0.42, pos: [-0.4, 2.9, 4.6], look: [0.0, 1.9, -2.2], fov: 35},
  {f: C.f_ato3 + L3 * 0.68, pos: [0.0, 2.9, 3.1], look: [0.0, 2.5, -3.8], fov: 34},
  {f: C.f_ato3 + L3 * 0.9, pos: [0.6, 2.3, 3.4], look: [0.0, 1.7, -1.5], fov: 32},
  // ATO 4 — financeiro analisa, aprova e núcleo reconfere saldo + auditoria
  {f: C.f_ato4 + L4 * 0.16, pos: [5.6, 3.5, 5.8], look: [7.6, 1.7, -1.2], fov: 37},
  {f: C.f_ato4 + L4 * 0.48, pos: [8.1, 2.7, 3.1], look: [8.4, 2.2, -3.2], fov: 33},
  {f: C.f_ato4 + L4 * 0.78, pos: [5.6, 3.0, 3.8], look: [4.2, 2.0, -1.7], fov: 36},
  {f: C.f_ato4 + L4 * 0.96, pos: [2.4, 4.4, 8.2], look: [2.6, 1.7, -1.2], fov: 40},
  // ATO 5 — plano geral com todos comemorando (4 personagens)
  {f: C.f_ato5 + L5 * 0.35, pos: [1.4, 6.4, 15.2], look: [1.4, 1.7, -1.5], fov: 42},
  {f: C.total_frames, pos: [1.4, 6.9, 16.4], look: [1.4, 1.9, -1.5], fov: 42},
];

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function sampleCamera(frame: number) {
  const k = CAM_KEYS;
  if (frame <= k[0].f) return k[0];
  if (frame >= k[k.length - 1].f) return k[k.length - 1];
  let i = 0;
  while (i < k.length - 2 && frame > k[i + 1].f) i++;
  const a = k[Math.max(0, i - 1)];
  const b = k[i];
  const c = k[i + 1];
  const d = k[Math.min(k.length - 1, i + 2)];
  const raw = clamp01((frame - b.f) / Math.max(1, c.f - b.f));
  const t = lerp(raw, smooth(raw), 0.55);
  const v = (sel: (x: CamKey) => V3, j: number) => catmull(sel(a)[j], sel(b)[j], sel(c)[j], sel(d)[j], t);
  return {
    f: frame,
    pos: [v((x) => x.pos, 0), v((x) => x.pos, 1), v((x) => x.pos, 2)] as V3,
    look: [v((x) => x.look, 0), v((x) => x.look, 1), v((x) => x.look, 2)] as V3,
    fov: lerp(b.fov, c.fov, smooth(raw)),
  };
}

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FONT = 'Inter, "Segoe UI", Arial, sans-serif';

function screenFrame(ctx: CanvasRenderingContext2D, w: number, h: number, title: string) {
  ctx.fillStyle = '#F8FAF9';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = CB.greenDark;
  ctx.fillRect(0, 0, w, 96);
  const cols = [CB.blue, CB.orange, CB.red, CB.purple, CB.green];
  cols.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect((w / 5) * i, 96, w / 5, 10);
  });
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(title, 40, 62);
  ctx.fillStyle = '#86EFAC';
  ctx.font = `700 24px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('Portal de Antecipação de Títulos', w - 40, 60);
  ctx.textAlign = 'left';
}

function makeDesk(w: number, d: number, h: number, top: THREE.Material, leg: THREE.Material) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new RoundedBoxGeometry(w, 0.07, d, 3, 0.025), top);
  t.position.y = h;
  t.castShadow = t.receiveShadow = true;
  g.add(t);
  [-1, 1].forEach((s) => {
    const side = new THREE.Mesh(new RoundedBoxGeometry(0.06, h, d * 0.86, 2, 0.02), leg);
    side.position.set(s * (w / 2 - 0.12), h / 2, 0);
    side.castShadow = true;
    g.add(side);
  });
  const modesty = new THREE.Mesh(new RoundedBoxGeometry(w - 0.3, h * 0.45, 0.03, 2, 0.01), leg);
  modesty.position.set(0, h * 0.62, -d * 0.32);
  g.add(modesty);
  return g;
}

function makeOfficeChair(seat: THREE.Material, frame: THREE.Material) {
  const g = new THREE.Group();
  const s = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.1, 0.62, 3, 0.04), seat);
  s.position.y = 0.48;
  s.castShadow = true;
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.64, 0.78, 0.1, 3, 0.05), seat);
  back.position.set(0, 0.98, -0.34);
  back.rotation.x = -0.08;
  back.castShadow = true;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 12), frame);
  post.position.y = 0.24;
  const star = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.34), frame);
    arm.position.set(Math.sin((i / 5) * Math.PI * 2) * 0.17, 0.05, Math.cos((i / 5) * Math.PI * 2) * 0.17);
    arm.rotation.y = (i / 5) * Math.PI * 2;
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), frame);
    wheel.position.set(Math.sin((i / 5) * Math.PI * 2) * 0.33, 0.035, Math.cos((i / 5) * Math.PI * 2) * 0.33);
    star.add(arm, wheel);
  }
  g.add(s, back, post, star);
  return g;
}

function makeLaptop(screenTex: THREE.Texture | null, body: THREE.Material) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.025, 0.42, 2, 0.01), body);
  base.position.y = 0.012;
  const lid = new THREE.Group();
  lid.position.set(0, 0.025, -0.2);
  lid.rotation.x = -0.28;
  const lidMesh = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.4, 0.02, 2, 0.01), body);
  lidMesh.position.y = 0.2;
  lid.add(lidMesh);
  if (screenTex) {
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.34), new THREE.MeshBasicMaterial({map: screenTex}));
    scr.position.set(0, 0.2, 0.012);
    lid.add(scr);
  }
  g.add(base, lid);
  return g;
}

function makePlant(potMat: THREE.Material, leafMat: THREE.Material, scale = 1) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.5, 18), potMat);
  pot.position.y = 0.25;
  pot.castShadow = true;
  g.add(pot);
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), leafMat);
    const a = (i / 9) * Math.PI * 2;
    leaf.scale.set(0.55, 1.5, 0.3);
    leaf.position.set(Math.cos(a) * 0.16, 0.85 + (i % 3) * 0.16, Math.sin(a) * 0.16);
    leaf.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
    leaf.castShadow = true;
    g.add(leaf);
  }
  g.scale.setScalar(scale);
  return g;
}

function makeShelf(wood: THREE.Material) {
  const g = new THREE.Group();
  const cols = [CB.blue, CB.orange, CB.red, CB.purple, CB.green, '#F1F5F9'];
  for (let r = 0; r < 4; r++) {
    const board = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.05, 0.4, 2, 0.01), wood);
    board.position.set(0, 0.35 + r * 0.55, 0);
    board.castShadow = true;
    g.add(board);
    for (let b = 0; b < 7; b++) {
      if ((b + r) % 4 === 3) continue;
      const bk = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.34 + ((b * 7 + r) % 3) * 0.04, 0.28),
        new THREE.MeshStandardMaterial({color: cols[(b + r * 2) % cols.length], roughness: 0.7}),
      );
      bk.position.set(-0.6 + b * 0.19, 0.55 + r * 0.55, 0);
      g.add(bk);
    }
  }
  [-0.8, 0.8].forEach((x) => {
    const side = new THREE.Mesh(new RoundedBoxGeometry(0.05, 2.3, 0.42, 2, 0.01), wood);
    side.position.set(x, 1.15, 0);
    g.add(side);
  });
  return g;
}

function makePendant(shade: THREE.Material, bulb: THREE.Material) {
  const g = new THREE.Group();
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.6, 6), shade);
  cord.position.y = 0.8;
  const s = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.3, 24, 1, true), shade);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), bulb);
  b.position.y = -0.08;
  g.add(cord, s, b);
  return g;
}

type FaceKit = {eyes: THREE.Object3D[]; shines: THREE.Object3D[]; mouthO: THREE.Mesh};

function buildFaceKit(rig: DesmontandoCharacterRig): FaceKit {
  const eyes: THREE.Object3D[] = [];
  const shines: THREE.Object3D[] = [];
  rig.head.children.forEach((ch) => {
    const m = ch as THREE.Mesh;
    const geo = m.geometry as THREE.SphereGeometry | undefined;
    const r = geo?.parameters?.radius;
    if (geo?.type === 'SphereGeometry' && r !== undefined) {
      if (Math.abs(r - 0.025) < 1e-4) eyes.push(m);
      if (Math.abs(r - 0.0075) < 1e-4) shines.push(m);
    }
  });
  eyes.forEach((e) => e.scale.setScalar(1.25));
  const mouthO = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 14, 12),
    new THREE.MeshStandardMaterial({color: '#5B1414', roughness: 0.5}),
  );
  mouthO.scale.set(1.2, 0.9, 0.35);
  mouthO.position.set(0, -0.08, 0.214);
  mouthO.visible = false;
  rig.head.add(mouthO);
  return {eyes, shines, mouthO};
}

type Mood = 'worried' | 'neutral' | 'happy' | 'joy';

function applyFace(rig: DesmontandoCharacterRig, kit: FaceKit, mood: Mood, frame: number, seed: number) {
  const period = 92 + (seed % 5) * 9;
  const ph = (frame + seed * 37) % period;
  const blink = ph < 4 ? [0.55, 0.12, 0.12, 0.55][ph] : 1;
  kit.eyes.forEach((e) => (e.scale.y = 1.25 * blink));
  kit.shines.forEach((s) => (s.visible = blink > 0.5));

  rig.mouthFrown.visible = mood === 'worried';
  rig.mouthSmile.visible = mood === 'happy' || mood === 'neutral';
  kit.mouthO.visible = mood === 'joy';
  rig.mouthSmile.scale.set(mood === 'neutral' ? 0.7 : 1.15, mood === 'neutral' ? 0.6 : 1.1, 1);
  rig.sweatGroup.visible = mood === 'worried';
  if (mood === 'worried') {
    rig.sweatGroup.position.y = -((frame * 0.004 + seed) % 0.06);
  }
  const browTilt = mood === 'worried' ? 0.32 : mood === 'joy' ? -0.18 : -0.06;
  const browLift = mood === 'joy' ? 0.016 : mood === 'worried' ? 0.006 : 0;
  rig.browL.rotation.z = Math.PI / 2 + browTilt;
  rig.browR.rotation.z = Math.PI / 2 - browTilt;
  rig.browL.position.y = 0.078 + browLift;
  rig.browR.position.y = 0.078 + browLift;
}

function joints(r: DesmontandoCharacterRig) {
  return [r.head, r.shoulderL, r.elbowL, r.shoulderR, r.elbowR, r.hipL, r.kneeL, r.hipR, r.kneeR];
}
function snapPose(r: DesmontandoCharacterRig, pose: CharacterPose, f: number) {
  r.setPose(pose, f);
  return joints(r).flatMap((j) => [j.rotation.x, j.rotation.y, j.rotation.z]);
}
function applySnap(r: DesmontandoCharacterRig, a: number[], b: number[], t: number) {
  joints(r).forEach((j, i) => {
    j.rotation.set(lerp(a[i * 3], b[i * 3], t), lerp(a[i * 3 + 1], b[i * 3 + 1], t), lerp(a[i * 3 + 2], b[i * 3 + 2], t));
  });
}
function blendPose(r: DesmontandoCharacterRig, pA: CharacterPose, pB: CharacterPose, t: number, f: number) {
  const a = snapPose(r, pA, f);
  const b = snapPose(r, pB, f);
  applySnap(r, a, b, smooth(t));
}

function walkCycle(r: DesmontandoCharacterRig, phase: number) {
  const s = Math.sin(phase);
  r.hipL.rotation.set(s * 0.55, 0, 0);
  r.hipR.rotation.set(-s * 0.55, 0, 0);
  r.kneeL.rotation.set(Math.max(0, -Math.cos(phase)) * 0.75, 0, 0);
  r.kneeR.rotation.set(Math.max(0, Math.cos(phase)) * 0.75, 0, 0);
  r.shoulderL.rotation.set(-s * 0.5, 0, 0.1);
  r.shoulderR.rotation.set(s * 0.5, 0, -0.1);
  r.elbowL.rotation.set(-0.35, 0, 0);
  r.elbowR.rotation.set(-0.35, 0, 0);
  r.head.rotation.set(0, 0, Math.sin(phase) * 0.03);
}

const STAND_Y = 1.02;
const SIT_Y = 0.63;

type Refs = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  supplier: DesmontandoCharacterRig;
  oldAnalyst: DesmontandoCharacterRig;
  itAnalyst: DesmontandoCharacterRig;
  finance: DesmontandoCharacterRig;
  faces: Map<DesmontandoCharacterRig, FaceKit>;
  pulses: Array<{mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; offset: number}>;
  tubeMats: THREE.MeshStandardMaterial[];
  hubRings: THREE.Mesh[];
  hubCore: THREE.Mesh;
  hubGlow: THREE.PointLight;
  papers: THREE.Mesh[];
  supplierScreen: THREE.MeshBasicMaterial;
  financeScreen: THREE.MeshBasicMaterial;
  supplierTexA: THREE.Texture;
  supplierTexB: THREE.Texture;
  financeTexA: THREE.Texture;
  financeTexB: THREE.Texture;
  stamp: THREE.Mesh;
  checkBadge: THREE.Mesh;
};

export const CenterboxDioramaStage: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const refs = useRef<Refs | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true});
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#E9EFEC');
    scene.fog = new THREE.Fog('#E9EFEC', 26, 48);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 120);

    scene.add(new THREE.HemisphereLight('#FFFFFF', '#C9B79C', 0.55));
    const sun = new THREE.DirectionalLight('#FFF4E0', 2.1);
    sun.position.set(-6, 14, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -8;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#DDEBFF', 0.45);
    fill.position.set(8, 6, 12);
    scene.add(fill);

    const M = {
      wallWhite: new THREE.MeshStandardMaterial({color: '#F6F7F4', roughness: 0.9}),
      wallGreen: new THREE.MeshStandardMaterial({color: CB.greenDark, roughness: 0.85}),
      wood: new THREE.MeshStandardMaterial({color: '#C99A6B', roughness: 0.6}),
      woodLight: new THREE.MeshStandardMaterial({color: '#E3C9A3', roughness: 0.55}),
      white: new THREE.MeshStandardMaterial({color: '#FFFFFF', roughness: 0.45}),
      metal: new THREE.MeshStandardMaterial({color: '#2B3440', roughness: 0.35, metalness: 0.6}),
      greyOld: new THREE.MeshStandardMaterial({color: '#8D8A80', roughness: 0.8}),
      chairGreen: new THREE.MeshStandardMaterial({color: CB.green, roughness: 0.6}),
      chairBlue: new THREE.MeshStandardMaterial({color: CB.blue, roughness: 0.6}),
      chairGrey: new THREE.MeshStandardMaterial({color: '#6B7280', roughness: 0.7}),
      paper: new THREE.MeshStandardMaterial({color: '#FFFFFF', roughness: 0.9, side: THREE.DoubleSide}),
      leaf: new THREE.MeshStandardMaterial({color: '#2F8F4E', roughness: 0.7}),
      pot: new THREE.MeshStandardMaterial({color: '#F2EEE6', roughness: 0.6}),
      laptop: new THREE.MeshStandardMaterial({color: '#C9CED6', roughness: 0.3, metalness: 0.7}),
      glass: new THREE.MeshPhysicalMaterial({color: '#DFF5E8', roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.35}),
      bulb: new THREE.MeshBasicMaterial({color: '#FFF3C4'}),
    };

    /* ---------- Piso de madeira em tábuas ---------- */
    const floorTex = canvasTex(1024, 1024, (ctx, w, h) => {
      for (let r = 0; r < 16; r++) {
        let x = -((r * 173) % 260);
        while (x < w) {
          const len = 220 + ((x * 13 + r * 7) % 160);
          const tone = 190 + ((x + r * 31) % 24);
          ctx.fillStyle = `rgb(${tone}, ${Math.round(tone * 0.78)}, ${Math.round(tone * 0.56)})`;
          ctx.fillRect(x, r * 64, len - 3, 61);
          ctx.fillStyle = 'rgba(80,50,20,0.06)';
          for (let g = 0; g < 4; g++) ctx.fillRect(x, r * 64 + 10 + g * 13, len - 3, 2);
          x += len;
        }
      }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 2.2);
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.2, 14),
      new THREE.MeshStandardMaterial({map: floorTex, roughness: 0.55}),
    );
    floor.position.set(1.4, -0.1, 1.5);
    floor.receiveShadow = true;
    scene.add(floor);

    const rug = (x: number, z: number, w: number, d: number, col: string) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, 0.02, d, 2, 0.01), new THREE.MeshStandardMaterial({color: col, roughness: 0.95}));
      m.position.set(x, 0.01, z);
      m.receiveShadow = true;
      scene.add(m);
    };
    rug(0, -0.9, 3.6, 3.0, '#E3ECE6');
    rug(8.4, -0.9, 3.6, 3.0, '#E3ECE6');
    rug(4.2, -1.3, 4.2, 3.8, '#D7E6DC');
    rug(-5.8, -0.6, 3.8, 3.0, '#D9D4C7');

    /* ---------- Paredes ---------- */
    const back = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 0.3), M.wallWhite);
    back.position.set(1.4, 3, -4.1);
    back.receiveShadow = true;
    scene.add(back);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 8), M.wallWhite);
    sideL.position.set(-11.4, 3, -0.2);
    sideL.receiveShadow = true;
    scene.add(sideL);
    const base = new THREE.Mesh(new THREE.BoxGeometry(26, 0.9, 0.06), M.wallGreen);
    base.position.set(1.4, 0.45, -3.93);
    scene.add(base);
    const stripeCols = [CB.blue, CB.orange, CB.red, CB.purple, CB.green];
    for (let i = 0; i < 25; i++) {
      const s = new THREE.Mesh(
        new THREE.BoxGeometry(1.04, 0.22, 0.05),
        new THREE.MeshStandardMaterial({color: stripeCols[i % 5], roughness: 0.6}),
      );
      s.position.set(-11.1 + i * 1.04, 5.25, -3.92);
      scene.add(s);
    }

    const logoTex = canvasTex(1400, 380, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = CB.gold;
      ctx.font = `900 120px ${FONT}`;
      ctx.fillText('GRUPO', 20, 125);
      const icons = [CB.blue, CB.orange, CB.red, CB.purple, CB.green];
      icons.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(470 + i * 182, 22, 176, 112);
      });
      ctx.fillStyle = CB.green;
      ctx.font = `900 210px ${FONT}`;
      ctx.fillText('CENTERBOX', 10, 345);
    });
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.08), new THREE.MeshBasicMaterial({map: logoTex, transparent: true}));
    logo.position.set(4.2, 4.45, -3.93);
    scene.add(logo);

    // Painel comparativo 3D do Setor de TI (0,75% vs 3,50% integral) na parede central
    const tiCompareTex = canvasTex(1280, 560, (ctx, w, h) => {
      ctx.fillStyle = '#0B2F20';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = CB.blue;
      ctx.fillRect(0, 0, w, 78);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 36px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('SETOR DE TI • PORTAL PRÓPRIO DE ANTECIPAÇÃO', w / 2, 52);

      // Card Antes
      roundRect(ctx, 44, 112, 560, 400, 24);
      ctx.fillStyle = '#1E293B';
      ctx.fill();
      ctx.fillStyle = '#FCA5A5';
      ctx.font = `800 30px ${FONT}`;
      ctx.fillText('ANTES (COM INTERMEDIÁRIA)', 324, 165);
      ctx.fillStyle = '#EF4444';
      ctx.font = `900 54px ${FONT}`;
      ctx.fillText('0,75% Intermediária', 324, 255);
      ctx.fillStyle = '#E2E8F0';
      ctx.font = `800 44px ${FONT}`;
      ctx.fillText('2,75% Centerbox', 324, 340);
      ctx.fillStyle = '#94A3B8';
      ctx.font = `700 28px ${FONT}`;
      ctx.fillText('sobre R$ 32,6 MI movimentados', 324, 430);

      // Card Agora
      roundRect(ctx, 676, 112, 560, 400, 24);
      ctx.fillStyle = '#14532D';
      ctx.fill();
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.fillStyle = '#86EFAC';
      ctx.font = `800 30px ${FONT}`;
      ctx.fillText('AGORA (PORTAL DA TI)', 956, 165);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 70px ${FONT}`;
      ctx.fillText('3% LIVRE', 956, 265);
      ctx.fillStyle = '#FDBA74';
      ctx.font = `900 42px ${FONT}`;
      ctx.fillText('SEM INTERMEDIADOR', 956, 355);
      ctx.fillStyle = '#DCFCE7';
      ctx.font = `700 28px ${FONT}`;
      ctx.fillText('Economia direta para o grupo', 956, 430);
      ctx.textAlign = 'left';
    });
    const tiWallFrame = new THREE.Mesh(new RoundedBoxGeometry(3.7, 1.65, 0.1, 2, 0.03), M.metal);
    tiWallFrame.position.set(4.2, 2.85, -3.88);
    scene.add(tiWallFrame);
    const tiWallScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.54, 1.54), new THREE.MeshBasicMaterial({map: tiCompareTex, toneMapped: false}));
    tiWallScreen.position.set(4.2, 2.85, -3.82);
    scene.add(tiWallScreen);

    const windowTex = canvasTex(512, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#9FD3F5');
      g.addColorStop(0.7, '#DDF0FB');
      g.addColorStop(1, '#BFE3C8');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      [[80, 120, 90], [300, 80, 70], [400, 200, 60]].forEach(([x, y, r]) => {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = '#7FB58E';
      for (let i = 0; i < 9; i++) ctx.fillRect(i * 60, 380 - (i % 3) * 40, 46, 140 + (i % 3) * 40);
    });
    const addWindow = (x: number) => {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.3), new THREE.MeshBasicMaterial({map: windowTex}));
      glass.position.set(x, 2.75, -3.93);
      scene.add(glass);
      [[0, 1.17, 2.1, 0.08], [0, -1.17, 2.1, 0.08], [-1.02, 0, 0.08, 2.4], [1.02, 0, 0.08, 2.4], [0, 0, 0.05, 2.4]].forEach(
        ([dx, dy, w, h]) => {
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), M.metal);
          b.position.set(x + dx, 2.75 + dy, -3.9);
          scene.add(b);
        },
      );
      const lightPatch = new THREE.SpotLight('#FFF6DE', 5.5, 12, 0.6, 0.8, 1.6);
      lightPatch.position.set(x, 4.6, -3.2);
      lightPatch.target.position.set(x, 0, 0.5);
      scene.add(lightPatch, lightPatch.target);
    };
    addWindow(-2.8);
    addWindow(11.1);
    addWindow(-8.8);

    /* ---------- ZONA "ANTES": intermediária (0,75% vs 2,75%) ---------- */
    const oldDesk = makeDesk(2.6, 1.2, 0.85, M.greyOld, M.metal);
    oldDesk.position.set(-5.9, 0, -0.9);
    scene.add(oldDesk);
    const oldChair = makeOfficeChair(M.chairGrey, M.metal);
    oldChair.position.set(-6.3, 0, -1.65);
    scene.add(oldChair);
    for (let p = 0; p < 3; p++) {
      for (let i = 0; i < 9 + p * 3; i++) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.018, 0.55), M.paper);
        sh.position.set(-6.9 + p * 0.55, 0.9 + i * 0.02, -0.75 + (i % 2) * 0.02);
        sh.rotation.y = Math.sin(i * 1.7 + p) * 0.18;
        sh.castShadow = true;
        scene.add(sh);
      }
    }
    [CB.red, CB.orange, CB.blue].forEach((c, i) => {
      const folder = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.05, 0.36, 2, 0.01), new THREE.MeshStandardMaterial({color: c, roughness: 0.6}));
      folder.position.set(-5.0, 0.9 + i * 0.05, -0.8);
      folder.rotation.y = 0.2 * i;
      scene.add(folder);
    });
    const oldMonitor = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.55, 0.45, 2, 0.04), new THREE.MeshStandardMaterial({color: '#D6D0C0', roughness: 0.7}));
    oldMonitor.position.set(-5.7, 1.18, -1.25);
    oldMonitor.castShadow = true;
    scene.add(oldMonitor);

    const boardTex = canvasTex(1024, 420, (ctx, w, h) => {
      ctx.fillStyle = '#FFFDF5';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#A3A3A3';
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, w - 14, h - 14);
      ctx.fillStyle = CB.red;
      ctx.font = `900 54px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('COM EMPRESA INTERMEDIÁRIA', w / 2, 105);
      ctx.fillStyle = '#0F172A';
      ctx.font = `900 84px ${FONT}`;
      ctx.fillText('R$ 32,6 MI', w / 2, 215);
      ctx.font = `800 40px ${FONT}`;
      ctx.fillStyle = CB.red;
      ctx.fillText('0,75% Intermediária   •   2,75% Centerbox', w / 2, 315);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.4), new THREE.MeshBasicMaterial({map: boardTex}));
    board.position.set(-5.9, 2.75, -3.92);
    scene.add(board);

    const papers: THREE.Mesh[] = [];
    for (let i = 0; i < 14; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), M.paper);
      p.castShadow = true;
      scene.add(p);
      papers.push(p);
    }

    /* ---------- ESTAÇÃO 1: FORNECEDOR (Simulação PPTX/PDF R$ 23.581,28 -> R$ 21.844,87) ---------- */
    const supDesk = makeDesk(1.9, 0.9, 1.12, M.white, M.metal);
    supDesk.position.set(0, 0, -0.75);
    scene.add(supDesk);
    const supplierTexA = canvasTex(1280, 720, (ctx, w, h) => {
      screenFrame(ctx, w, h, 'Simulação do Fornecedor');
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 32px ${FONT}`;
      ctx.fillText('Títulos selecionados: 3   •   Recebimento antecipado', 60, 175);
      roundRect(ctx, 60, 215, 540, 200, 22);
      ctx.fillStyle = '#EEF2F0';
      ctx.fill();
      roundRect(ctx, 660, 215, 560, 200, 22);
      ctx.fillStyle = '#DCFCE7';
      ctx.fill();
      ctx.fillStyle = '#64748B';
      ctx.font = `700 30px ${FONT}`;
      ctx.fillText('Valor bruto', 90, 270);
      ctx.fillText('Valor líquido na hora', 690, 270);
      ctx.fillStyle = '#0F172A';
      ctx.font = `900 62px ${FONT}`;
      ctx.fillText('R$ 23.581,28', 90, 365);
      ctx.fillStyle = CB.green;
      ctx.fillText('R$ 21.844,87', 690, 365);
      ctx.fillStyle = '#334155';
      ctx.font = `700 30px ${FONT}`;
      ctx.fillText('Taxa calculada na hora • 3% livre para o Grupo Centerbox', 60, 485);
      roundRect(ctx, 60, 535, 520, 110, 24);
      ctx.fillStyle = CB.orange;
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 42px ${FONT}`;
      ctx.fillText('Assinar eletronicamente', 90, 605);
    });
    const supplierTexB = canvasTex(1280, 720, (ctx, w, h) => {
      screenFrame(ctx, w, h, 'Assinatura Eletrônica');
      ctx.textAlign = 'center';
      ctx.fillStyle = CB.green;
      ctx.beginPath();
      ctx.arc(w / 2, 330, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 26;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w / 2 - 55, 335);
      ctx.lineTo(w / 2 - 10, 380);
      ctx.lineTo(w / 2 + 62, 285);
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.font = `900 56px ${FONT}`;
      ctx.fillText('Termo assinado!', w / 2, 540);
      ctx.fillStyle = '#64748B';
      ctx.font = `700 32px ${FONT}`;
      ctx.fillText('R$ 21.844,87 liberados • Senha + código por e-mail', w / 2, 600);
      ctx.textAlign = 'left';
    });
    const supplierScreen = new THREE.MeshBasicMaterial({map: supplierTexA, toneMapped: false});
    const supWall = new THREE.Mesh(new RoundedBoxGeometry(3.4, 1.98, 0.1, 2, 0.03), M.metal);
    supWall.position.set(0, 2.75, -3.88);
    scene.add(supWall);
    const supScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.26, 1.83), supplierScreen);
    supScreen.position.set(0, 2.75, -3.82);
    scene.add(supScreen);
    const supLaptop = makeLaptop(null, M.laptop);
    supLaptop.position.set(0, 1.16, -0.65);
    supLaptop.rotation.y = Math.PI;
    scene.add(supLaptop);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.14, 14), new THREE.MeshStandardMaterial({color: CB.orange}));
    cup.position.set(0.7, 1.23, -0.75);
    scene.add(cup);

    /* ---------- NÚCLEO: PORTAL DE ANTECIPAÇÃO + ESTAÇÃO DO SETOR DE TI ---------- */
    const hub = new THREE.Group();
    hub.position.set(4.2, 0, -1.9);
    scene.add(hub);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.28, 48), M.wallGreen);
    plinth.position.y = 0.14;
    plinth.castShadow = plinth.receiveShadow = true;
    hub.add(plinth);
    const ringBase = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.04, 10, 64), new THREE.MeshBasicMaterial({color: '#4ADE80'}));
    ringBase.rotation.x = Math.PI / 2;
    ringBase.position.y = 0.29;
    hub.add(ringBase);
    const pillarTex = canvasTex(512, 1024, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0B3B24');
      g.addColorStop(1, '#0E8A3E');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = `900 50px ${FONT}`;
      ctx.fillText('PORTAL DE', w / 2, 165);
      ctx.fillText('ANTECIPAÇÃO', w / 2, 230);
      ctx.fillText('DE TÍTULOS', w / 2, 295);
      ctx.fillStyle = '#FDBA74';
      ctx.font = `800 34px ${FONT}`;
      ctx.fillText('CRIADO PELA TI', w / 2, 385);
      const items = ['3% livre', 'Zero intermediária', 'Reconfere saldo', 'Trilha de auditoria'];
      items.forEach((t, i) => {
        roundRect(ctx, 50, 455 + i * 120, w - 100, 90, 18);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
        ctx.fillStyle = '#86EFAC';
        ctx.font = `800 34px ${FONT}`;
        ctx.fillText(`✓ ${t}`, w / 2, 513 + i * 120);
      });
    });
    const hubCore = new THREE.Mesh(
      new RoundedBoxGeometry(1.0, 2.35, 0.64, 4, 0.12),
      [M.wallGreen, M.wallGreen, M.wallGreen, M.wallGreen, new THREE.MeshBasicMaterial({map: pillarTex, toneMapped: false}), M.wallGreen],
    );
    hubCore.position.y = 1.48;
    hubCore.castShadow = true;
    hub.add(hubCore);
    const glassShell = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.6, 48, 1, true), M.glass);
    glassShell.position.y = 1.6;
    hub.add(glassShell);
    const hubRings: THREE.Mesh[] = [];
    [0.8, 1.5, 2.2].forEach((y, i) => {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(1.02, 0.025, 8, 80),
        new THREE.MeshBasicMaterial({color: i === 1 ? CB.orange : '#4ADE80'}),
      );
      r.position.y = y;
      r.rotation.x = Math.PI / 2;
      hub.add(r);
      hubRings.push(r);
    });
    const hubGlow = new THREE.PointLight('#4ADE80', 4, 6, 1.6);
    hubGlow.position.set(0, 2, 1.0);
    hub.add(hubGlow);

    // Mesa do Setor de TI logo à frente/direita do núcleo
    const itDesk = makeDesk(1.7, 0.85, 0.85, M.white, M.metal);
    itDesk.position.set(5.2, 0, -0.2);
    scene.add(itDesk);
    const itChair = makeOfficeChair(M.chairBlue, M.metal);
    itChair.position.set(5.2, 0, -0.95);
    scene.add(itChair);
    const itLaptop = makeLaptop(null, M.laptop);
    itLaptop.position.set(5.2, 0.89, -0.05);
    itLaptop.rotation.y = Math.PI;
    scene.add(itLaptop);

    /* ---------- ESTAÇÃO 3: FINANCEIRO ---------- */
    const finDesk = makeDesk(2.3, 1.1, 0.85, M.woodLight, M.metal);
    finDesk.position.set(8.4, 0, -0.75);
    scene.add(finDesk);
    const finChair = makeOfficeChair(M.chairGreen, M.metal);
    finChair.position.set(8.4, 0, -1.5);
    scene.add(finChair);
    const finLaptop = makeLaptop(null, M.laptop);
    finLaptop.position.set(8.4, 0.89, -0.6);
    finLaptop.rotation.y = Math.PI;
    scene.add(finLaptop);
    const finTex = (approved: boolean) =>
      canvasTex(1280, 720, (ctx, w, h) => {
        screenFrame(ctx, w, h, 'Mesa do Financeiro • Proposta #1');
        const rows: Array<[string, string, string]> = [
          ['Títulos', '3 títulos • R$ 23.581,28', '#0F172A'],
          ['Débito do fornecedor', 'R$ 0,00', CB.green],
          ['Limite disponível', 'OK • dentro da política', CB.green],
          ['Ganho Centerbox', '3% livre (sem intermediária)', CB.green],
        ];
        rows.forEach(([k, v, c], i) => {
          ctx.fillStyle = i % 2 ? '#FFFFFF' : '#EEF2F0';
          ctx.fillRect(60, 150 + i * 82, w - 120, 78);
          ctx.fillStyle = '#64748B';
          ctx.font = `700 30px ${FONT}`;
          ctx.fillText(k, 90, 200 + i * 82);
          ctx.fillStyle = c;
          ctx.font = `800 32px ${FONT}`;
          ctx.fillText(v, 540, 200 + i * 82);
        });
        const btn = (x: number, label: string, col: string, active: boolean) => {
          roundRect(ctx, x, 520, 340, 110, 24);
          ctx.fillStyle = col;
          ctx.globalAlpha = approved && !active ? 0.35 : 1;
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `900 42px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.fillText(label, x + 170, 590);
          ctx.textAlign = 'left';
          ctx.globalAlpha = 1;
          if (approved && active) {
            ctx.strokeStyle = '#FDE047';
            ctx.lineWidth = 8;
            roundRect(ctx, x - 6, 514, 352, 122, 28);
            ctx.stroke();
          }
        };
        btn(60, approved ? '✓ APROVADO' : 'APROVAR', CB.green, true);
        btn(470, 'NEGOCIAR', CB.orange, false);
        btn(880, 'REPROVAR', CB.red, false);
      });
    const financeTexA = finTex(false);
    const financeTexB = finTex(true);
    const financeScreen = new THREE.MeshBasicMaterial({map: financeTexA, toneMapped: false});
    const finWall = new THREE.Mesh(new RoundedBoxGeometry(3.4, 1.98, 0.1, 2, 0.03), M.metal);
    finWall.position.set(8.4, 2.75, -3.88);
    scene.add(finWall);
    const finScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.26, 1.83), financeScreen);
    finScreen.position.set(8.4, 2.75, -3.82);
    scene.add(finScreen);

    const stampTex = canvasTex(512, 200, (ctx, w, h) => {
      roundRect(ctx, 8, 8, w - 16, h - 16, 30);
      ctx.fillStyle = CB.green;
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 84px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('APROVADO', w / 2, 132);
    });
    const stamp = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.5), new THREE.MeshBasicMaterial({map: stampTex, transparent: true, toneMapped: false}));
    stamp.position.set(9.5, 2.7, -0.6);
    scene.add(stamp);

    const checkTex = canvasTex(256, 256, (ctx, w) => {
      ctx.fillStyle = CB.green;
      ctx.beginPath();
      ctx.arc(w / 2, w / 2, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 26;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(72, 132);
      ctx.lineTo(112, 172);
      ctx.lineTo(186, 90);
      ctx.stroke();
    });
    const checkBadge = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({map: checkTex, transparent: true, toneMapped: false}));
    checkBadge.position.set(0, 2.55, -0.3);
    scene.add(checkBadge);

    /* ---------- Decoração ---------- */
    [[-10.2, -3.2, 1.2], [-3.4, -3.3, 1], [2.1, -3.3, 0.9], [6.3, -3.3, 0.9], [10.6, -3.1, 1.2], [-8.2, 1.8, 1.0], [11.0, 1.6, 1.1]].forEach(
      ([x, z, s]) => {
        const pl = makePlant(M.pot, M.leaf, s);
        pl.position.set(x, 0, z);
        scene.add(pl);
      },
    );
    const shelf = makeShelf(M.wood);
    shelf.position.set(-9.4, 0, -3.65);
    scene.add(shelf);
    const shelf2 = makeShelf(M.wood);
    shelf2.position.set(12.6, 0, -3.65);
    scene.add(shelf2);
    [[0, -0.75], [8.4, -0.75], [-5.9, -0.9]].forEach(([x, z]) => {
      const p = makePendant(M.metal, M.bulb);
      p.position.set(x, 3.7, z);
      scene.add(p);
    });

    /* ---------- Personagens (4 bonecos) ---------- */
    const supplier = createDesmontandoCharacter({
      shirtColor: CB.orange,
      shortsColor: '#1E293B',
      hairColor: '#2A1B12',
      skinColor: '#E8B486',
      slipperColor: '#111827',
      hairStyle: 'quiff',
      longPants: true,
    });
    scene.add(supplier.root);

    const oldAnalyst = createDesmontandoCharacter({
      shirtColor: '#94A3B8',
      shortsColor: '#334155',
      hairColor: '#1C1917',
      skinColor: '#C68A5C',
      slipperColor: '#111827',
      hairStyle: 'short',
      longPants: true,
    });
    oldAnalyst.root.position.set(-6.3, SIT_Y, -1.6);
    scene.add(oldAnalyst.root);

    const itAnalyst = createDesmontandoCharacter({
      shirtColor: CB.blue,
      shortsColor: '#0F172A',
      hairColor: '#1E1B18',
      skinColor: '#E8B486',
      slipperColor: '#111827',
      hairStyle: 'quiff',
      longPants: true,
    });
    itAnalyst.root.position.set(5.2, SIT_Y, -0.9);
    scene.add(itAnalyst.root);

    const finance = createDesmontandoCharacter({
      shirtColor: CB.green,
      shortsColor: '#0F172A',
      hairColor: '#3B1F0E',
      skinColor: '#F1C9A5',
      slipperColor: '#111827',
      hairStyle: 'bob',
      longPants: true,
    });
    finance.root.position.set(8.4, SIT_Y, -1.45);
    scene.add(finance.root);

    [supplier, oldAnalyst, itAnalyst, finance].forEach((r) =>
      r.root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true;
      }),
    );
    const faces = new Map<DesmontandoCharacterRig, FaceKit>();
    [supplier, oldAnalyst, itAnalyst, finance].forEach((r) => faces.set(r, buildFaceKit(r)));

    /* ---------- Tubos de dados ---------- */
    const curve1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.8, 1.2, -0.9),
      new THREE.Vector3(1.9, 2.2, -1.3),
      new THREE.Vector3(3.1, 1.9, -1.9),
    ]);
    const curve2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(5.3, 1.9, -1.9),
      new THREE.Vector3(6.5, 2.2, -1.3),
      new THREE.Vector3(7.5, 0.95, -0.8),
    ]);
    const tubeMats: THREE.MeshStandardMaterial[] = [];
    [curve1, curve2].forEach((c) => {
      const tm = new THREE.MeshStandardMaterial({color: '#4ADE80', emissive: '#22C55E', emissiveIntensity: 0.6, transparent: true, opacity: 0});
      tubeMats.push(tm);
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(c, 40, 0.035, 10, false), tm));
    });
    const pulses: Refs['pulses'] = [];
    const pulseGeo = new THREE.SphereGeometry(0.075, 14, 12);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial({color: i % 2 ? CB.orange : '#A7F3D0'}));
      m.visible = false;
      scene.add(m);
      pulses.push({mesh: m, curve: i < 4 ? curve1 : curve2, offset: (i % 4) / 4});
    }

    refs.current = {
      renderer,
      scene,
      camera,
      supplier,
      oldAnalyst,
      itAnalyst,
      finance,
      faces,
      pulses,
      tubeMats,
      hubRings,
      hubCore,
      hubGlow,
      papers,
      supplierScreen,
      financeScreen,
      supplierTexA,
      supplierTexB,
      financeTexA,
      financeTexB,
      stamp,
      checkBadge,
    };

    return () => {
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [width, height]);

  useEffect(() => {
    const r = refs.current;
    if (!r) return;
    const f = frame;
    const t = f / 30;

    const cam = sampleCamera(f);
    const sway = 0.03;
    r.camera.position.set(cam.pos[0] + Math.sin(t * 0.7) * sway, cam.pos[1] + Math.sin(t * 0.9 + 1) * sway * 0.6, cam.pos[2]);
    r.camera.fov = cam.fov;
    r.camera.updateProjectionMatrix();
    r.camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);

    const faceOf = (rig: DesmontandoCharacterRig) => r.faces.get(rig)!;

    /* ---------- Analista "antes" ---------- */
    {
      const rig = r.oldAnalyst;
      rig.root.position.set(-6.3, SIT_Y, -1.6);
      rig.root.rotation.y = 0.15;
      if (f < C.f_ato5) {
        rig.setPose('sitting_desk', f * 1.6);
        rig.head.rotation.set(0.12 + Math.sin(t * 2.2) * 0.05, Math.sin(t * 1.3) * 0.35, Math.sin(t * 1.7) * 0.06);
        const scratch = smooth((Math.sin(t * 0.9) - 0.4) * 2);
        rig.shoulderL.rotation.set(lerp(-0.55, -2.6, scratch), 0, lerp(0.12, 0.4, scratch));
        rig.elbowL.rotation.set(lerp(-0.92, -1.6, scratch), 0, 0);
        applyFace(rig, faceOf(rig), 'worried', f, 1);
      } else {
        const k = clamp01((f - C.f_ato5) / 30);
        rig.root.position.y = lerp(SIT_Y, STAND_Y, smooth(k));
        blendPose(rig, 'sitting_desk', 'standing_wave', k, f);
        if (k >= 1) {
          rig.shoulderL.rotation.z = -2.45 - Math.sin(t * 6) * 0.2;
          rig.shoulderR.rotation.z = 2.45 + Math.sin(t * 6) * 0.2;
        }
        rig.root.position.z = lerp(-1.6, -0.1, smooth(k));
        rig.root.rotation.y = 0;
        applyFace(rig, faceOf(rig), 'joy', f, 1);
      }
    }

    /* ---------- Analista de TI: constrói e ativa o Portal Próprio ---------- */
    {
      const rig = r.itAnalyst;
      rig.root.position.set(5.2, SIT_Y, -0.9);
      rig.root.rotation.y = 0;
      if (f < C.f_ato5) {
        rig.setPose('sitting_desk', f * 1.8);
        const proud = f >= C.f_ato2 + L2 * 0.5 && f < C.f_ato3;
        if (proud) {
          const k = smooth((f - (C.f_ato2 + L2 * 0.5)) / 12);
          rig.shoulderL.rotation.set(lerp(-0.55, -1.4, k), 0, lerp(0.12, 0.45, k));
          rig.head.rotation.set(0.05, lerp(0, -0.35, k), 0);
          applyFace(rig, faceOf(rig), 'joy', f, 4);
        } else {
          rig.head.rotation.set(0.22, Math.sin(t * 0.9) * 0.14, 0);
          applyFace(rig, faceOf(rig), 'happy', f, 4);
        }
      } else {
        const k = clamp01((f - C.f_ato5 - 6) / 28);
        rig.root.position.y = lerp(SIT_Y, STAND_Y, smooth(k));
        rig.root.position.z = lerp(-0.9, -1.4, smooth(k));
        blendPose(rig, 'sitting_desk', 'standing_wave', k, f);
        if (k >= 1) {
          rig.shoulderL.rotation.z = -2.45 - Math.sin(t * 6 + 1.5) * 0.2;
          rig.shoulderR.rotation.z = 2.45 + Math.sin(t * 6 + 1.5) * 0.2;
        }
        applyFace(rig, faceOf(rig), 'joy', f, 4);
      }
    }

    /* ---------- Fornecedor: preocupado -> caminha (Ato 3) -> simula R$ 100 mil -> assina -> comemora ---------- */
    {
      const rig = r.supplier;
      const walkStart = C.f_ato3 + 6;
      const walkEnd = C.f_ato3 + L3 * 0.36;
      const P0 = new THREE.Vector2(-4.6, 0.2);
      const P1 = new THREE.Vector2(-1.6, -1.55);
      const P2 = new THREE.Vector2(0, -1.55);
      if (f < walkStart) {
        rig.root.position.set(P0.x, STAND_Y, P0.y);
        rig.root.rotation.y = -0.55;
        rig.setPose('standing_phone', f);
        rig.phoneProp.visible = true;
        rig.phoneScreenMat.color.set(Math.floor(t * 2) % 2 ? '#F87171' : '#FCA5A5');
        rig.head.rotation.set(0.1, -0.2 + Math.sin(t * 1.5) * 0.15, 0);
        applyFace(rig, faceOf(rig), 'worried', f, 2);
      } else if (f < walkEnd) {
        const u = smooth((f - walkStart) / (walkEnd - walkStart));
        const d1 = P0.distanceTo(P1);
        const d2 = P1.distanceTo(P2);
        const s = u * (d1 + d2);
        const pos = s < d1 ? P0.clone().lerp(P1, s / d1) : P1.clone().lerp(P2, (s - d1) / d2);
        const dir = s < d1 ? P1.clone().sub(P0) : P2.clone().sub(P1);
        const phase = s * 5.2;
        rig.root.position.set(pos.x, STAND_Y + Math.abs(Math.sin(phase)) * 0.04, pos.y);
        const targetYaw = Math.atan2(dir.x, dir.y);
        const endTurn = smooth((u - 0.88) / 0.12);
        rig.root.rotation.y = lerp(targetYaw, 0, endTurn);
        walkCycle(rig, phase);
        rig.phoneProp.visible = false;
        applyFace(rig, faceOf(rig), 'neutral', f, 2);
      } else {
        rig.root.position.set(P2.x, STAND_Y, P2.y);
        rig.root.rotation.y = 0;
        rig.phoneProp.visible = false;
        const signAt = C.f_ato3 + L3 * 0.74;
        if (f < C.f_ato5) {
          rig.setPose('standing_neutral', f);
          rig.shoulderL.rotation.set(-0.75, 0, 0.12);
          rig.shoulderR.rotation.set(-0.75, 0, -0.12);
          rig.elbowL.rotation.set(-0.7 + Math.sin(t * 9) * 0.07, 0.2, 0);
          rig.elbowR.rotation.set(-0.7 + Math.cos(t * 9.5) * 0.07, -0.2, 0);
          rig.head.rotation.set(0.28, Math.sin(t * 0.8) * 0.06, 0);
          const point = f >= signAt && f < C.f_ato4 ? smooth((f - signAt) / 10) : 0;
          if (point > 0) {
            rig.shoulderR.rotation.set(lerp(-0.75, 0.3, point), 0, lerp(-0.12, 1.5, point));
            rig.elbowR.rotation.set(lerp(-0.7, -0.1, point), 0, 0);
            rig.head.rotation.set(lerp(0.28, -0.1, point), lerp(0, 0.5, point), 0);
          }
          applyFace(rig, faceOf(rig), f >= signAt && f < C.f_ato4 ? 'joy' : 'happy', f, 2);
        } else {
          const k = clamp01((f - C.f_ato5 - 8) / 20);
          blendPose(rig, 'standing_neutral', 'standing_wave', k, f);
          if (k >= 1) {
            rig.shoulderL.rotation.z = -2.45 - Math.sin(t * 6 + 1) * 0.2;
            rig.shoulderR.rotation.z = 2.45 + Math.sin(t * 6 + 1) * 0.2;
            rig.root.position.y = STAND_Y + Math.max(0, Math.sin(t * 6 + 1)) * 0.12;
          }
          applyFace(rig, faceOf(rig), 'joy', f, 2);
        }
      }
      r.supplierScreen.map = f >= C.f_ato3 + L3 * 0.74 ? r.supplierTexB : r.supplierTexA;
      r.supplierScreen.needsUpdate = true;
    }

    /* ---------- Financeiro: analisa -> aprova (Ato 4) -> comemora ---------- */
    {
      const rig = r.finance;
      const approveAt = C.f_ato4 + L4 * 0.48;
      rig.root.position.set(8.4, SIT_Y, -1.45);
      rig.root.rotation.y = 0;
      if (f < C.f_ato5) {
        rig.setPose('sitting_desk', f);
        rig.head.rotation.set(0.22, Math.sin(t * 0.6) * 0.18, 0);
        let mood: Mood = 'neutral';
        if (f >= C.f_ato4 && f < approveAt) {
          rig.shoulderL.rotation.set(-1.1, 0, 0.35);
          rig.elbowL.rotation.set(-2.0, 0.4, 0);
          rig.head.rotation.set(0.15, Math.sin(t * 0.9) * 0.22, 0.05);
        }
        if (f >= approveAt) {
          const k = smooth((f - approveAt) / 10);
          rig.shoulderR.rotation.set(lerp(-0.55, -1.6, k), 0, lerp(-0.12, -0.25, k));
          rig.elbowR.rotation.set(lerp(-0.92, -1.4, k), 0, 0);
          rig.head.rotation.set(0.05 + Math.sin(t * 7) * 0.06 * k, 0, 0);
          mood = 'happy';
        }
        applyFace(rig, faceOf(rig), mood, f, 3);
      } else {
        const k = clamp01((f - C.f_ato5 - 4) / 30);
        rig.root.position.y = lerp(SIT_Y, STAND_Y, smooth(k));
        rig.root.position.z = lerp(-1.45, -2.0, smooth(k));
        blendPose(rig, 'sitting_desk', 'standing_wave', k, f);
        if (k >= 1) {
          rig.shoulderL.rotation.z = -2.45 - Math.sin(t * 6 + 2) * 0.2;
          rig.shoulderR.rotation.z = 2.45 + Math.sin(t * 6 + 2) * 0.2;
        }
        applyFace(rig, faceOf(rig), 'joy', f, 3);
      }
      const approved = f >= approveAt;
      r.financeScreen.map = approved ? r.financeTexB : r.financeTexA;
      r.financeScreen.needsUpdate = true;
      const sk = approved && f < C.f_ato5 ? smooth((f - approveAt) / 8) : 0;
      r.stamp.visible = sk > 0.01;
      r.stamp.scale.setScalar(0.55 * sk * (1 + 0.25 * Math.max(0, 1 - (f - approveAt) / 8)));
      r.stamp.quaternion.copy(r.camera.quaternion);
    }

    /* ---------- Check flutuante no fornecedor ---------- */
    {
      const signAt = C.f_ato3 + L3 * 0.74;
      const k = f >= signAt && f < C.f_ato4 ? smooth((f - signAt) / 8) : 0;
      r.checkBadge.visible = k > 0.01;
      r.checkBadge.scale.setScalar(k);
      r.checkBadge.position.y = 2.55 + Math.sin(t * 3) * 0.05;
      r.checkBadge.quaternion.copy(r.camera.quaternion);
    }

    /* ---------- Papéis voando (somente no Ato 1) ---------- */
    r.papers.forEach((p, i) => {
      const vis = f < C.f_ato2 + 20;
      p.visible = vis;
      if (!vis) return;
      const life = (t * 0.45 + i * 0.137) % 1;
      const a = i * 2.1;
      p.position.set(-5.9 + Math.cos(a + t * 0.8) * (0.6 + life * 1.4), 1.0 + life * 2.4 + Math.sin(t * 3 + i) * 0.1, -0.9 + Math.sin(a + t * 0.6) * 0.9);
      p.rotation.set(t * 1.7 + i, t * 1.1 + i * 0.5, Math.sin(t * 2 + i) * 0.8);
    });

    /* ---------- Fluxo de dados entre estações ---------- */
    const flowOn = smooth((f - C.f_ato2) / 25);
    r.tubeMats.forEach((m, i) => {
      const local = i === 0 ? smooth((f - (C.f_ato3 + L3 * 0.74)) / 25) : smooth((f - C.f_ato4) / 25);
      m.opacity = 0.2 + 0.55 * Math.max(flowOn * 0.4, local);
      m.emissiveIntensity = 0.4 + 0.8 * Math.max(flowOn * 0.4, local);
    });
    r.pulses.forEach((p) => {
      p.mesh.visible = flowOn > 0.05;
      const u = (t * (f >= C.f_ato4 ? 0.7 : 0.45) + p.offset) % 1;
      p.mesh.position.copy(p.curve.getPointAt(u));
      p.mesh.scale.setScalar(0.8 + 0.3 * Math.sin(t * 8 + p.offset * 6));
    });

    /* ---------- Núcleo pulsante ---------- */
    const coreBoost = f >= C.f_ato2 && f < C.f_ato3 ? 1 : 0.5;
    r.hubRings.forEach((ring, i) => {
      ring.rotation.z = t * (0.6 + i * 0.35) * (i % 2 ? -1 : 1);
      ring.position.y = [0.8, 1.5, 2.2][i] + Math.sin(t * 1.5 + i) * 0.08 * coreBoost;
    });
    r.hubGlow.intensity = 2 + 4 * coreBoost * (0.7 + 0.3 * Math.sin(t * 4));

    r.renderer.render(r.scene, r.camera);
  }, [frame]);

  return <div ref={mountRef} style={{width, height, position: 'absolute', inset: 0}} />;
};
