import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {CharacterPose, DesmontandoCharacterRig} from '../shots/G1/DesmontandoRig';
import type {BrandPalette, CharacterMood} from './types';

export const FACTORY_FONT = 'Inter, "Segoe UI", Arial, sans-serif';
export const STAND_Y = 1.02;
export const SIT_Y = 0.63;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function canvasTex(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
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

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Mede e ajusta automaticamente o tamanho da fonte para nunca vazar ou cortar em placas 3D */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxFontPx = 42,
  minFontPx = 18,
  weight = '900',
  fontFamily = FACTORY_FONT,
) {
  let size = maxFontPx;
  while (size > minFontPx) {
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = `${weight} ${size}px ${fontFamily}`;
  ctx.fillText(text, x, y, maxWidth);
}

export function drawScreenFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
  brand: BrandPalette,
) {
  ctx.fillStyle = '#F8FAF9';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = brand.primaryDark;
  ctx.fillRect(0, 0, w, 96);
  const cols = brand.stripeColors.length ? brand.stripeColors : [brand.primary, brand.accent];
  cols.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect((w / cols.length) * i, 96, w / cols.length + 1, 10);
  });
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 38px ${FACTORY_FONT}`;
  ctx.fillText(title, 40, 62);
  ctx.fillStyle = '#BBF7D0';
  ctx.font = `700 23px ${FACTORY_FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(brand.name, w - 40, 60);
  ctx.textAlign = 'left';
}

export function makeDesk(w: number, d: number, h: number, top: THREE.Material, leg: THREE.Material) {
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

export function makeOfficeChair(seat: THREE.Material, frame: THREE.Material) {
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

export function makeLaptop(screenTex: THREE.Texture | null, body: THREE.Material) {
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

export function makePlant(potMat: THREE.Material, leafMat: THREE.Material, scale = 1) {
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

export function makeShelf(wood: THREE.Material, palette: string[]) {
  const g = new THREE.Group();
  const cols = palette.length ? [...palette, '#F1F5F9'] : ['#1F3C88', '#E8730C', '#0E8A3E', '#F1F5F9'];
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

export function makePendant(shade: THREE.Material, bulb: THREE.Material) {
  const g = new THREE.Group();
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.6, 6), shade);
  cord.position.y = 0.8;
  const s = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.3, 24, 1, true), shade);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), bulb);
  b.position.y = -0.08;
  g.add(cord, s, b);
  return g;
}

/** Engrenagens 3D giratórias — ótimo para vídeos de curiosidades ("como funciona por dentro") */
export function makeGearCluster(primaryHex: string, accentHex: string) {
  const g = new THREE.Group();
  const buildGear = (radius: number, teeth: number, color: string) => {
    const gg = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({color, roughness: 0.35, metalness: 0.45});
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.22, 10, 28), mat);
    gg.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.36, radius * 0.36, radius * 0.36, 16), mat);
    hub.rotation.x = Math.PI / 2;
    gg.add(hub);
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.24, radius * 0.32, radius * 0.34), mat);
      tooth.position.set(Math.cos(a) * (radius * 1.18), Math.sin(a) * (radius * 1.18), 0);
      tooth.rotation.z = a + Math.PI / 2;
      gg.add(tooth);
    }
    return gg;
  };
  const gearA = buildGear(0.46, 10, primaryHex);
  gearA.position.set(-0.34, 0.22, 0);
  const gearB = buildGear(0.32, 8, accentHex);
  gearB.position.set(0.36, -0.18, 0.04);
  g.add(gearA, gearB);
  return {group: g, gearA, gearB};
}

/** Frascos / tubos de laboratório para o tema `lab` */
export function makeLabStand(accentHex: string, secondaryHex: string) {
  const g = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({color: '#334155', roughness: 0.5, metalness: 0.3});
  const rack = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.08, 0.32, 2, 0.02), baseMat);
  rack.position.y = 0.04;
  g.add(rack);
  const colors = [accentHex, secondaryHex, '#38BDF8'];
  colors.forEach((col, i) => {
    const flask = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.13, 0.34, 16),
      new THREE.MeshStandardMaterial({color: col, emissive: col, emissiveIntensity: 0.25, roughness: 0.2}),
    );
    flask.position.set(-0.28 + i * 0.28, 0.25, 0);
    flask.castShadow = true;
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.14, 12),
      new THREE.MeshStandardMaterial({color: '#E2E8F0', roughness: 0.15, transparent: true, opacity: 0.7}),
    );
    neck.position.set(-0.28 + i * 0.28, 0.46, 0);
    g.add(flask, neck);
  });
  return g;
}

/* ============================================================
 * Rosto expressivo + Blending de Poses + Caminhada
 * ============================================================ */
export type FaceKit = {eyes: THREE.Object3D[]; shines: THREE.Object3D[]; mouthO: THREE.Mesh};

export function buildFaceKit(rig: DesmontandoCharacterRig): FaceKit {
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

export function applyFace(
  rig: DesmontandoCharacterRig,
  kit: FaceKit,
  mood: CharacterMood,
  frame: number,
  seed: number,
) {
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

export function blendPose(
  r: DesmontandoCharacterRig,
  pA: CharacterPose,
  pB: CharacterPose,
  t: number,
  f: number,
) {
  r.setPose(pA, f);
  const a = joints(r).flatMap((j) => [j.rotation.x, j.rotation.y, j.rotation.z]);
  r.setPose(pB, f);
  const b = joints(r).flatMap((j) => [j.rotation.x, j.rotation.y, j.rotation.z]);
  const s = smooth(t);
  joints(r).forEach((j, i) => {
    j.rotation.set(
      lerp(a[i * 3], b[i * 3], s),
      lerp(a[i * 3 + 1], b[i * 3 + 1], s),
      lerp(a[i * 3 + 2], b[i * 3 + 2], s),
    );
  });
}

export function walkCycle(r: DesmontandoCharacterRig, phase: number) {
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
