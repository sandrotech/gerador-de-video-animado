import React, {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  createDesmontandoCharacter,
  type DesmontandoCharacterRig,
} from '../shots/G1/DesmontandoRig';
import {
  applyFace,
  blendPose,
  buildFaceKit,
  canvasTex,
  clamp01,
  drawScreenFrame,
  FACTORY_FONT,
  lerp,
  makeDesk,
  makeGearCluster,
  makeLabStand,
  makeLaptop,
  makeOfficeChair,
  makePendant,
  makePlant,
  makeShelf,
  roundRect,
  SIT_Y,
  smooth,
  STAND_Y,
  walkCycle,
  type FaceKit,
} from './props3d';
import type {
  CameraPreset,
  CharacterConfig,
  CharacterMood,
  ExplainerProjectConfig,
  ExplainerTiming,
} from './types';
import {WORLD_BUILDERS} from './worlds';
import type {WorldController} from './worlds/pixNetworkWorld';

type V3 = [number, number, number];
type CamKey = {f: number; pos: V3; look: V3; fov: number};

function buildCameraKeys(
  config: ExplainerProjectConfig,
  timing: ExplainerTiming,
  isVertical: boolean,
): CamKey[] {
  const zMul = isVertical ? 1.32 : 1.0;
  const fovAdd = isVertical ? 10 : 0;
  const keys: CamKey[] = [];

  const pushPreset = (preset: CameraPreset, f0: number, len: number) => {
    const add = (frac: number, pos: V3, look: V3, fov: number) => {
      keys.push({
        f: f0 + len * frac,
        pos: [pos[0], pos[1], pos[2] * zMul],
        look,
        fov: fov + fovAdd,
      });
    };

    switch (preset) {
      case 'drone_to_left':
        add(0.0, [2.0, 12.2, 18.6], [1.0, 0.8, -1.2], 42);
        add(0.32, [-3.2, 4.8, 8.8], [-5.6, 1.4, -0.8], 38);
        add(0.68, [-5.6, 2.6, 4.9], [-5.7, 1.5, -0.9], 36);
        add(0.96, [-4.6, 2.7, 5.2], [-4.5, 1.6, -1.2], 36);
        break;
      case 'focus_left':
        add(0.15, [-5.8, 2.8, 5.4], [-5.8, 1.6, -1.2], 36);
        add(0.75, [-5.2, 2.6, 4.6], [-5.6, 1.7, -1.6], 34);
        break;
      case 'focus_core':
        add(0.16, [2.6, 3.6, 6.2], [4.0, 1.9, -1.8], 38);
        add(0.48, [4.2, 3.3, 4.3], [4.2, 2.2, -2.5], 36);
        add(0.82, [5.3, 2.8, 4.0], [4.2, 2.1, -2.2], 35);
        break;
      case 'walker_to_step1':
        add(0.16, [-2.6, 2.7, 5.4], [-2.4, 1.4, -0.8], 36);
        add(0.42, [-0.4, 2.9, 4.6], [0.0, 1.9, -2.2], 35);
        add(0.68, [0.0, 2.9, 3.1], [0.0, 2.5, -3.8], 34);
        add(0.9, [0.6, 2.3, 3.4], [0.0, 1.7, -1.5], 32);
        break;
      case 'focus_step1':
        add(0.18, [-0.3, 2.9, 4.4], [0.0, 2.2, -2.8], 35);
        add(0.62, [0.0, 2.9, 3.1], [0.0, 2.5, -3.8], 33);
        add(0.9, [0.6, 2.3, 3.4], [0.0, 1.7, -1.5], 32);
        break;
      case 'focus_right':
        add(0.16, [5.6, 3.5, 5.8], [7.6, 1.7, -1.2], 37);
        add(0.48, [8.1, 2.7, 3.2], [8.4, 2.2, -3.2], 33);
        add(0.78, [5.6, 3.0, 4.0], [4.2, 2.0, -1.7], 36);
        add(0.96, [2.4, 4.4, 8.2], [2.6, 1.7, -1.2], 40);
        break;
      case 'orbit_core':
        add(0.15, [6.4, 3.2, 4.4], [4.2, 2.0, -1.7], 37);
        add(0.5, [4.2, 3.5, 3.4], [4.2, 2.1, -1.7], 36);
        add(0.85, [1.8, 2.9, 4.0], [4.0, 2.0, -1.7], 36);
        break;
      case 'wide_finale':
        add(0.35, [1.4, 6.4, 15.2], [1.4, 1.7, -1.5], 42);
        add(1.0, [1.4, 6.9, 16.4], [1.4, 1.9, -1.5], 42);
        break;
    }
  };

  config.acts.forEach((act, idx) => {
    const f0 = timing.act_starts[act.id] ?? 0;
    const nextAct = config.acts[idx + 1];
    const f1 = nextAct ? (timing.act_starts[nextAct.id] ?? timing.total_frames) : timing.total_frames;
    pushPreset(act.cameraPreset, f0, Math.max(30, f1 - f0));
  });

  if (keys.length === 0) {
    keys.push({f: 0, pos: [1.4, 6.4, 15.2 * zMul], look: [1.4, 1.7, -1.5], fov: 42 + fovAdd});
  }
  return keys;
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function sampleCamera(keys: CamKey[], frame: number) {
  if (frame <= keys[0].f) return keys[0];
  if (frame >= keys[keys.length - 1].f) return keys[keys.length - 1];
  let i = 0;
  while (i < keys.length - 2 && frame > keys[i + 1].f) i++;
  const a = keys[Math.max(0, i - 1)];
  const b = keys[i];
  const c = keys[i + 1];
  const d = keys[Math.min(keys.length - 1, i + 2)];
  const raw = clamp01((frame - b.f) / Math.max(1, c.f - b.f));
  const t = lerp(raw, smooth(raw), 0.55);
  const v = (sel: (x: CamKey) => V3, j: number) =>
    catmull(sel(a)[j], sel(b)[j], sel(c)[j], sel(d)[j], t);
  return {
    f: frame,
    pos: [v((x) => x.pos, 0), v((x) => x.pos, 1), v((x) => x.pos, 2)] as V3,
    look: [v((x) => x.look, 0), v((x) => x.look, 1), v((x) => x.look, 2)] as V3,
    fov: lerp(b.fov, c.fov, smooth(raw)),
  };
}

interface ManagedChar {
  cfg: CharacterConfig;
  rig: DesmontandoCharacterRig;
  face: FaceKit;
  seed: number;
}

interface SceneRefs {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  customWorld?: WorldController;
  chars: ManagedChar[];
  pulses: Array<{mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; offset: number}>;
  tubeMats: THREE.MeshStandardMaterial[];
  hubRings: THREE.Mesh[];
  hubGlow: THREE.PointLight;
  gears?: {gearA: THREE.Group; gearB: THREE.Group};
  papers: THREE.Mesh[];
  step1Mat: THREE.MeshBasicMaterial;
  step1TexA: THREE.Texture;
  step1TexB: THREE.Texture;
  rightMat: THREE.MeshBasicMaterial;
  rightTexA: THREE.Texture;
  rightTexB: THREE.Texture;
  stamp: THREE.Mesh;
  checkBadge: THREE.Mesh;
}

export interface ExplainerDioramaProps {
  config: ExplainerProjectConfig;
  timing: ExplainerTiming;
}

export const ExplainerDiorama: React.FC<ExplainerDioramaProps> = ({config, timing}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const refs = useRef<SceneRefs | null>(null);

  const isVertical = height > width;
  const camKeys = useMemo(
    () => buildCameraKeys(config, timing, isVertical),
    [config, timing, isVertical],
  );

  const actBounds = useMemo(() => {
    return config.acts.map((act, idx) => {
      const start = timing.act_starts[act.id] ?? 0;
      const next = config.acts[idx + 1];
      const end = next ? (timing.act_starts[next.id] ?? timing.total_frames) : timing.total_frames;
      return {id: act.id, start, end, len: Math.max(1, end - start)};
    });
  }, [config, timing]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const {brand, environment} = config;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const bgColor = brand.background || '#E9EFEC';
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.Fog(bgColor, 26, 48);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 120);

    // Se o projeto usa um mundo 3D temático registrado em worlds/index.ts, delega direto!
    const customBuilder = config.world && config.world !== 'office' ? WORLD_BUILDERS[config.world] : undefined;
    if (customBuilder) {
      const customWorld = customBuilder(scene, camera, config, timing, isVertical);
      refs.current = {
        renderer,
        scene,
        camera,
        customWorld,
        chars: [],
        pulses: [],
        tubeMats: [],
        hubRings: [],
        hubGlow: new THREE.PointLight(),
        papers: [],
        step1Mat: new THREE.MeshBasicMaterial(),
        step1TexA: new THREE.Texture(),
        step1TexB: new THREE.Texture(),
        rightMat: new THREE.MeshBasicMaterial(),
        rightTexA: new THREE.Texture(),
        rightTexB: new THREE.Texture(),
        stamp: new THREE.Mesh(),
        checkBadge: new THREE.Mesh(),
      };
      return () => {
        customWorld.dispose();
        pmrem.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      };
    }

    // Iluminação
    scene.add(new THREE.HemisphereLight('#FFFFFF', '#C9B79C', 0.58));
    const sun = new THREE.DirectionalLight('#FFF4E0', 2.05);
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
    const fill = new THREE.DirectionalLight('#DDEBFF', 0.48);
    fill.position.set(8, 6, 12);
    scene.add(fill);

    const M = {
      wallLight: new THREE.MeshStandardMaterial({
        color: environment === 'lab' ? '#F1F5F9' : environment === 'studio' ? '#FAF7F2' : '#F6F7F4',
        roughness: 0.9,
      }),
      wallDark: new THREE.MeshStandardMaterial({color: brand.primaryDark, roughness: 0.85}),
      wood: new THREE.MeshStandardMaterial({color: '#C99A6B', roughness: 0.6}),
      woodLight: new THREE.MeshStandardMaterial({color: '#E3C9A3', roughness: 0.55}),
      white: new THREE.MeshStandardMaterial({color: '#FFFFFF', roughness: 0.45}),
      metal: new THREE.MeshStandardMaterial({color: '#2B3440', roughness: 0.35, metalness: 0.6}),
      greyOld: new THREE.MeshStandardMaterial({color: '#8D8A80', roughness: 0.8}),
      chairPrimary: new THREE.MeshStandardMaterial({color: brand.primary, roughness: 0.6}),
      chairSecondary: new THREE.MeshStandardMaterial({color: brand.secondary, roughness: 0.6}),
      chairGrey: new THREE.MeshStandardMaterial({color: '#6B7280', roughness: 0.7}),
      paper: new THREE.MeshStandardMaterial({color: '#FFFFFF', roughness: 0.9, side: THREE.DoubleSide}),
      leaf: new THREE.MeshStandardMaterial({color: '#2F8F4E', roughness: 0.7}),
      pot: new THREE.MeshStandardMaterial({color: '#F2EEE6', roughness: 0.6}),
      laptop: new THREE.MeshStandardMaterial({color: '#C9CED6', roughness: 0.3, metalness: 0.7}),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#DFF5E8',
        roughness: 0.05,
        transmission: 0.6,
        transparent: true,
        opacity: 0.35,
      }),
      bulb: new THREE.MeshBasicMaterial({color: '#FFF3C4'}),
    };

    /* ---------- Piso conforme tema ---------- */
    const floorTex = canvasTex(1024, 1024, (ctx, w, h) => {
      if (environment === 'lab') {
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 4;
        for (let i = 0; i <= 8; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 128, 0);
          ctx.lineTo(i * 128, h);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i * 128);
          ctx.lineTo(w, i * 128);
          ctx.stroke();
        }
      } else {
        for (let r = 0; r < 16; r++) {
          let x = -((r * 173) % 260);
          while (x < w) {
            const len = 220 + ((x * 13 + r * 7) % 160);
            const tone = (environment === 'studio' ? 202 : 190) + ((x + r * 31) % 22);
            ctx.fillStyle = `rgb(${tone}, ${Math.round(tone * 0.8)}, ${Math.round(tone * 0.6)})`;
            ctx.fillRect(x, r * 64, len - 3, 61);
            ctx.fillStyle = 'rgba(80,50,20,0.05)';
            for (let g = 0; g < 4; g++) ctx.fillRect(x, r * 64 + 10 + g * 13, len - 3, 2);
            x += len;
          }
        }
      }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 2.2);
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.2, 14),
      new THREE.MeshStandardMaterial({map: floorTex, roughness: environment === 'lab' ? 0.38 : 0.55}),
    );
    floor.position.set(1.4, -0.1, 1.5);
    floor.receiveShadow = true;
    scene.add(floor);

    const rug = (x: number, z: number, w: number, d: number, col: string) => {
      const m = new THREE.Mesh(
        new RoundedBoxGeometry(w, 0.02, d, 2, 0.01),
        new THREE.MeshStandardMaterial({color: col, roughness: 0.95}),
      );
      m.position.set(x, 0.01, z);
      m.receiveShadow = true;
      scene.add(m);
    };
    rug(0, -0.9, 3.6, 3.0, '#E3ECE6');
    rug(8.4, -0.9, 3.6, 3.0, '#E3ECE6');
    rug(4.2, -1.3, 4.2, 3.8, '#D7E6DC');
    rug(-5.8, -0.6, 3.8, 3.0, '#D9D4C7');

    /* ---------- Paredes & Faixa da Marca ---------- */
    const back = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 0.3), M.wallLight);
    back.position.set(1.4, 3, -4.1);
    back.receiveShadow = true;
    scene.add(back);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 8), M.wallLight);
    sideL.position.set(-11.4, 3, -0.2);
    sideL.receiveShadow = true;
    scene.add(sideL);
    const base = new THREE.Mesh(new THREE.BoxGeometry(26, 0.9, 0.06), M.wallDark);
    base.position.set(1.4, 0.45, -3.93);
    scene.add(base);

    const stripes = brand.stripeColors.length ? brand.stripeColors : [brand.primary, brand.accent, brand.secondary];
    for (let i = 0; i < 25; i++) {
      const s = new THREE.Mesh(
        new THREE.BoxGeometry(1.04, 0.22, 0.05),
        new THREE.MeshStandardMaterial({color: stripes[i % stripes.length], roughness: 0.6}),
      );
      s.position.set(-11.1 + i * 1.04, 5.25, -3.92);
      scene.add(s);
    }

    // Banner principal da marca no topo central da parede
    const headerTex = canvasTex(1400, 260, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = brand.primary;
      ctx.font = `900 132px ${FACTORY_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(brand.name.toUpperCase(), w / 2, 165);
      ctx.fillStyle = brand.accent;
      ctx.font = `800 44px ${FACTORY_FONT}`;
      ctx.fillText(config.tagline.toUpperCase(), w / 2, 232);
    });
    const wallBanner = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 1.04),
      new THREE.MeshBasicMaterial({map: headerTex, transparent: true}),
    );
    wallBanner.position.set(4.2, 4.45, -3.93);
    scene.add(wallBanner);

    /* ---------- Painel Comparativo Central ---------- */
    const {compareWall} = config;
    const compareTex = canvasTex(1280, 560, (ctx, w, h) => {
      ctx.fillStyle = brand.primaryDark;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = brand.secondary;
      ctx.fillRect(0, 0, w, 78);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 35px ${FACTORY_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(compareWall.header, w / 2, 52);

      // Card Esquerda
      roundRect(ctx, 44, 112, 560, 400, 24);
      ctx.fillStyle = '#1E293B';
      ctx.fill();
      ctx.fillStyle = '#FCA5A5';
      ctx.font = `800 28px ${FACTORY_FONT}`;
      ctx.fillText(compareWall.left.eyebrow, 324, 165);
      ctx.fillStyle = brand.danger;
      ctx.font = `900 50px ${FACTORY_FONT}`;
      ctx.fillText(compareWall.left.line1, 324, 255);
      ctx.fillStyle = '#E2E8F0';
      ctx.font = `800 40px ${FACTORY_FONT}`;
      ctx.fillText(compareWall.left.line2, 324, 340);
      ctx.fillStyle = '#94A3B8';
      ctx.font = `700 26px ${FACTORY_FONT}`;
      ctx.fillText(compareWall.left.footer, 324, 430);

      // Card Direita
      roundRect(ctx, 676, 112, 560, 400, 24);
      ctx.fillStyle = '#14532D';
      ctx.fill();
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.fillStyle = '#86EFAC';
      ctx.font = `800 28px ${FACTORY_FONT}`;
      ctx.fillText(compareWall.right.eyebrow, 956, 165);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 60px ${FACTORY_FONT}`;
      ctx.fillText(compareWall.right.line1, 956, 265);
      ctx.fillStyle = '#FDBA74';
      ctx.font = `900 40px ${FACTORY_FONT}`;
      ctx.fillText(compareWall.right.line2, 956, 355);
      ctx.fillStyle = '#DCFCE7';
      ctx.font = `700 26px ${FACTORY_FONT}`;
      ctx.fillText(compareWall.right.footer, 956, 430);
    });
    const compareFrame = new THREE.Mesh(new RoundedBoxGeometry(3.7, 1.65, 0.1, 2, 0.03), M.metal);
    compareFrame.position.set(4.2, 2.85, -3.88);
    scene.add(compareFrame);
    const compareScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(3.54, 1.54),
      new THREE.MeshBasicMaterial({map: compareTex, toneMapped: false}),
    );
    compareScreen.position.set(4.2, 2.85, -3.82);
    scene.add(compareScreen);

    /* ---------- Janelas ---------- */
    const windowTex = canvasTex(512, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#9FD3F5');
      g.addColorStop(0.7, '#DDF0FB');
      g.addColorStop(1, '#BFE3C8');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      [
        [80, 120, 90],
        [300, 80, 70],
        [400, 200, 60],
      ].forEach(([x, y, r]) => {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = '#7FB58E';
      for (let i = 0; i < 9; i++) ctx.fillRect(i * 60, 380 - (i % 3) * 40, 46, 140 + (i % 3) * 40);
    });
    [-2.8, 11.1, -8.8].forEach((wx) => {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.3), new THREE.MeshBasicMaterial({map: windowTex}));
      glass.position.set(wx, 2.75, -3.93);
      scene.add(glass);
      [
        [0, 1.17, 2.1, 0.08],
        [0, -1.17, 2.1, 0.08],
        [-1.02, 0, 0.08, 2.4],
        [1.02, 0, 0.08, 2.4],
        [0, 0, 0.05, 2.4],
      ].forEach(([dx, dy, ww, hh]) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, 0.08), M.metal);
        b.position.set(wx + dx, 2.75 + dy, -3.9);
        scene.add(b);
      });
      const lightPatch = new THREE.SpotLight('#FFF6DE', 5.2, 12, 0.6, 0.8, 1.6);
      lightPatch.position.set(wx, 4.6, -3.2);
      lightPatch.target.position.set(wx, 0, 0.5);
      scene.add(lightPatch, lightPatch.target);
    });

    /* ---------- ZONA ESQUERDA ("ANTES" / PERGUNTA) ---------- */
    const oldDesk = makeDesk(2.6, 1.2, 0.85, M.greyOld, M.metal);
    oldDesk.position.set(-5.9, 0, -0.9);
    scene.add(oldDesk);
    const oldChair = makeOfficeChair(M.chairGrey, M.metal);
    oldChair.position.set(-6.3, 0, -1.65);
    scene.add(oldChair);
    for (let p = 0; p < 3; p++) {
      for (let i = 0; i < 8 + p * 3; i++) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.018, 0.55), M.paper);
        sh.position.set(-6.9 + p * 0.55, 0.9 + i * 0.02, -0.75 + (i % 2) * 0.02);
        sh.rotation.y = Math.sin(i * 1.7 + p) * 0.18;
        sh.castShadow = true;
        scene.add(sh);
      }
    }
    const oldMonitor = new THREE.Mesh(
      new RoundedBoxGeometry(0.7, 0.55, 0.45, 2, 0.04),
      new THREE.MeshStandardMaterial({color: '#D6D0C0', roughness: 0.7}),
    );
    oldMonitor.position.set(-5.7, 1.18, -1.25);
    oldMonitor.castShadow = true;
    scene.add(oldMonitor);

    const {leftBoard} = config;
    const boardTex = canvasTex(1024, 420, (ctx, w, h) => {
      ctx.fillStyle = '#FFFDF5';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#A3A3A3';
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, w - 14, h - 14);
      ctx.fillStyle = brand.danger;
      ctx.font = `900 50px ${FACTORY_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(leftBoard.title, w / 2, 105);
      ctx.fillStyle = '#0F172A';
      ctx.font = `900 80px ${FACTORY_FONT}`;
      ctx.fillText(leftBoard.headline, w / 2, 215);
      ctx.font = `800 36px ${FACTORY_FONT}`;
      ctx.fillStyle = brand.danger;
      ctx.fillText(leftBoard.subline, w / 2, 315);
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

    /* ---------- ESTAÇÃO 1 (CENTRO-ESQUERDA) ---------- */
    const supDesk = makeDesk(1.9, 0.9, 1.12, M.white, M.metal);
    supDesk.position.set(0, 0, -0.75);
    scene.add(supDesk);

    const {step1Screen} = config;
    const step1TexA = canvasTex(1280, 720, (ctx, w, h) => {
      drawScreenFrame(ctx, w, h, step1Screen.header, brand);
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 32px ${FACTORY_FONT}`;
      ctx.fillText(step1Screen.subtitle, 60, 175);
      roundRect(ctx, 60, 215, 540, 200, 22);
      ctx.fillStyle = '#EEF2F0';
      ctx.fill();
      roundRect(ctx, 660, 215, 560, 200, 22);
      ctx.fillStyle = '#DCFCE7';
      ctx.fill();
      ctx.fillStyle = '#64748B';
      ctx.font = `700 28px ${FACTORY_FONT}`;
      ctx.fillText(step1Screen.leftMetric.label, 90, 270);
      ctx.fillText(step1Screen.rightMetric.label, 690, 270);
      ctx.fillStyle = '#0F172A';
      ctx.font = `900 58px ${FACTORY_FONT}`;
      ctx.fillText(step1Screen.leftMetric.value, 90, 365);
      ctx.fillStyle = brand.primary;
      ctx.fillText(step1Screen.rightMetric.value, 690, 365);
      ctx.fillStyle = '#334155';
      ctx.font = `700 28px ${FACTORY_FONT}`;
      ctx.fillText(step1Screen.footerNote, 60, 485);
      roundRect(ctx, 60, 535, 520, 110, 24);
      ctx.fillStyle = brand.accent;
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 40px ${FACTORY_FONT}`;
      ctx.fillText(step1Screen.buttonText, 90, 605);
    });
    const step1TexB = canvasTex(1280, 720, (ctx, w, h) => {
      drawScreenFrame(ctx, w, h, step1Screen.confirmedHeader, brand);
      ctx.textAlign = 'center';
      ctx.fillStyle = brand.primary;
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
      ctx.font = `900 54px ${FACTORY_FONT}`;
      ctx.fillText(step1Screen.confirmedTitle, w / 2, 540);
      ctx.fillStyle = '#64748B';
      ctx.font = `700 30px ${FACTORY_FONT}`;
      ctx.fillText(step1Screen.confirmedSubtitle, w / 2, 600);
      ctx.textAlign = 'left';
    });
    const step1Mat = new THREE.MeshBasicMaterial({map: step1TexA, toneMapped: false});
    const supWall = new THREE.Mesh(new RoundedBoxGeometry(3.4, 1.98, 0.1, 2, 0.03), M.metal);
    supWall.position.set(0, 2.75, -3.88);
    scene.add(supWall);
    const supScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.26, 1.83), step1Mat);
    supScreen.position.set(0, 2.75, -3.82);
    scene.add(supScreen);
    const supLaptop = makeLaptop(null, M.laptop);
    supLaptop.position.set(0, 1.16, -0.65);
    supLaptop.rotation.y = Math.PI;
    scene.add(supLaptop);

    /* ---------- NÚCLEO CENTRAL + MESA DE APOIO / TI ---------- */
    const hub = new THREE.Group();
    hub.position.set(4.2, 0, -1.9);
    scene.add(hub);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.28, 48), M.wallDark);
    plinth.position.y = 0.14;
    plinth.castShadow = plinth.receiveShadow = true;
    hub.add(plinth);
    const ringBase = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.04, 10, 64),
      new THREE.MeshBasicMaterial({color: '#4ADE80'}),
    );
    ringBase.rotation.x = Math.PI / 2;
    ringBase.position.y = 0.29;
    hub.add(ringBase);

    const {coreHub} = config;
    const pillarTex = canvasTex(512, 1024, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, brand.primaryDark);
      g.addColorStop(1, brand.primary);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = `900 48px ${FACTORY_FONT}`;
      coreHub.titleLines.slice(0, 3).forEach((ln, idx) => {
        ctx.fillText(ln, w / 2, 165 + idx * 62);
      });
      ctx.fillStyle = '#FDBA74';
      ctx.font = `800 32px ${FACTORY_FONT}`;
      ctx.fillText(coreHub.badge, w / 2, 385);
      coreHub.items.slice(0, 4).forEach((it, i) => {
        roundRect(ctx, 44, 455 + i * 120, w - 88, 90, 18);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
        ctx.fillStyle = '#86EFAC';
        ctx.font = `800 32px ${FACTORY_FONT}`;
        ctx.fillText(`✓ ${it}`, w / 2, 513 + i * 120);
      });
    });
    const hubCore = new THREE.Mesh(
      new RoundedBoxGeometry(1.0, 2.35, 0.64, 4, 0.12),
      [
        M.wallDark,
        M.wallDark,
        M.wallDark,
        M.wallDark,
        new THREE.MeshBasicMaterial({map: pillarTex, toneMapped: false}),
        M.wallDark,
      ],
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
        new THREE.MeshBasicMaterial({color: i === 1 ? brand.accent : '#4ADE80'}),
      );
      r.position.y = y;
      r.rotation.x = Math.PI / 2;
      hub.add(r);
      hubRings.push(r);
    });

    let gears: {gearA: THREE.Group; gearB: THREE.Group} | undefined;
    if (coreHub.visualStyle === 'gears') {
      const gc = makeGearCluster(brand.accent, brand.secondary);
      gc.group.position.set(0, 2.95, 0.15);
      hub.add(gc.group);
      gears = {gearA: gc.gearA, gearB: gc.gearB};
    }

    const hubGlow = new THREE.PointLight('#4ADE80', 4, 6, 1.6);
    hubGlow.position.set(0, 2, 1.0);
    hub.add(hubGlow);

    // Mesa central (especialista / TI)
    const coreDesk = makeDesk(1.7, 0.85, 0.85, M.white, M.metal);
    coreDesk.position.set(5.2, 0, -0.2);
    scene.add(coreDesk);
    const coreChair = makeOfficeChair(M.chairSecondary, M.metal);
    coreChair.position.set(5.2, 0, -0.95);
    scene.add(coreChair);
    const coreLaptop = makeLaptop(null, M.laptop);
    coreLaptop.position.set(5.2, 0.89, -0.05);
    coreLaptop.rotation.y = Math.PI;
    scene.add(coreLaptop);
    if (environment === 'lab') {
      const stand = makeLabStand(brand.accent, brand.secondary);
      stand.position.set(5.75, 0.88, -0.35);
      stand.scale.setScalar(0.65);
      scene.add(stand);
    }

    /* ---------- ESTAÇÃO DIREITA ---------- */
    const finDesk = makeDesk(2.3, 1.1, 0.85, M.woodLight, M.metal);
    finDesk.position.set(8.4, 0, -0.75);
    scene.add(finDesk);
    const finChair = makeOfficeChair(M.chairPrimary, M.metal);
    finChair.position.set(8.4, 0, -1.5);
    scene.add(finChair);
    const finLaptop = makeLaptop(null, M.laptop);
    finLaptop.position.set(8.4, 0.89, -0.6);
    finLaptop.rotation.y = Math.PI;
    scene.add(finLaptop);

    const {rightScreen} = config;
    const makeRightTex = (approved: boolean) =>
      canvasTex(1280, 720, (ctx, w, h) => {
        drawScreenFrame(ctx, w, h, rightScreen.header, brand);
        rightScreen.rows.slice(0, 4).forEach((row, i) => {
          ctx.fillStyle = i % 2 ? '#FFFFFF' : '#EEF2F0';
          ctx.fillRect(60, 150 + i * 82, w - 120, 78);
          ctx.fillStyle = '#64748B';
          ctx.font = `700 28px ${FACTORY_FONT}`;
          ctx.fillText(row.label, 90, 200 + i * 82);
          ctx.fillStyle = row.positive ? brand.primary : '#0F172A';
          ctx.font = `800 30px ${FACTORY_FONT}`;
          ctx.fillText(row.value, 540, 200 + i * 82);
        });
        const btnCols = [brand.primary, brand.accent, brand.danger];
        rightScreen.buttons.forEach((label, idx) => {
          const x = 60 + idx * 410;
          const active = idx === 0;
          roundRect(ctx, x, 520, 340, 110, 24);
          ctx.fillStyle = btnCols[idx];
          ctx.globalAlpha = approved && !active ? 0.35 : 1;
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `900 38px ${FACTORY_FONT}`;
          ctx.textAlign = 'center';
          ctx.fillText(approved && active ? rightScreen.approvedButtonLabel : label, x + 170, 590);
          ctx.textAlign = 'left';
          ctx.globalAlpha = 1;
          if (approved && active) {
            ctx.strokeStyle = '#FDE047';
            ctx.lineWidth = 8;
            roundRect(ctx, x - 6, 514, 352, 122, 28);
            ctx.stroke();
          }
        });
      });
    const rightTexA = makeRightTex(false);
    const rightTexB = makeRightTex(true);
    const rightMat = new THREE.MeshBasicMaterial({map: rightTexA, toneMapped: false});
    const finWall = new THREE.Mesh(new RoundedBoxGeometry(3.4, 1.98, 0.1, 2, 0.03), M.metal);
    finWall.position.set(8.4, 2.75, -3.88);
    scene.add(finWall);
    const finScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.26, 1.83), rightMat);
    finScreen.position.set(8.4, 2.75, -3.82);
    scene.add(finScreen);

    const stampTex = canvasTex(512, 200, (ctx, w, h) => {
      roundRect(ctx, 8, 8, w - 16, h - 16, 30);
      ctx.fillStyle = brand.primary;
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 76px ${FACTORY_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(rightScreen.stampText, w / 2, 130);
    });
    const stamp = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.5),
      new THREE.MeshBasicMaterial({map: stampTex, transparent: true, toneMapped: false}),
    );
    stamp.position.set(9.5, 2.7, -0.6);
    scene.add(stamp);

    const checkTex = canvasTex(256, 256, (ctx, w) => {
      ctx.fillStyle = brand.primary;
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
    const checkBadge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.6),
      new THREE.MeshBasicMaterial({map: checkTex, transparent: true, toneMapped: false}),
    );
    checkBadge.position.set(0, 2.55, -0.3);
    scene.add(checkBadge);

    /* ---------- Decoração ---------- */
    [
      [-10.2, -3.2, 1.2],
      [-3.4, -3.3, 1.0],
      [2.1, -3.3, 0.9],
      [6.3, -3.3, 0.9],
      [10.6, -3.1, 1.2],
      [-8.2, 1.8, 1.0],
      [11.0, 1.6, 1.1],
    ].forEach(([x, z, s]) => {
      const pl = makePlant(M.pot, M.leaf, s);
      pl.position.set(x, 0, z);
      scene.add(pl);
    });
    const shelfL = makeShelf(M.wood, brand.stripeColors);
    shelfL.position.set(-9.4, 0, -3.65);
    scene.add(shelfL);
    const shelfR = makeShelf(M.wood, brand.stripeColors);
    shelfR.position.set(12.6, 0, -3.65);
    scene.add(shelfR);
    [
      [0, -0.75],
      [8.4, -0.75],
      [-5.9, -0.9],
    ].forEach(([x, z]) => {
      const p = makePendant(M.metal, M.bulb);
      p.position.set(x, 3.7, z);
      scene.add(p);
    });

    /* ---------- Personagens ---------- */
    const chars: ManagedChar[] = config.characters.map((cfg, idx) => {
      const rig = createDesmontandoCharacter({
        shirtColor: cfg.shirtColor,
        shortsColor: cfg.pantsColor,
        hairColor: cfg.hairColor,
        skinColor: cfg.skinColor,
        slipperColor: '#111827',
        hairStyle: cfg.hairStyle,
        longPants: true,
      });
      rig.root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true;
      });
      scene.add(rig.root);
      return {cfg, rig, face: buildFaceKit(rig), seed: idx + 1};
    });

    /* ---------- Tubos de Dados Luminosos ---------- */
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
      const tm = new THREE.MeshStandardMaterial({
        color: '#4ADE80',
        emissive: '#22C55E',
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0,
      });
      tubeMats.push(tm);
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(c, 40, 0.035, 10, false), tm));
    });
    const pulses: SceneRefs['pulses'] = [];
    const pulseGeo = new THREE.SphereGeometry(0.075, 14, 12);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(
        pulseGeo,
        new THREE.MeshBasicMaterial({color: i % 2 ? brand.accent : '#A7F3D0'}),
      );
      m.visible = false;
      scene.add(m);
      pulses.push({mesh: m, curve: i < 4 ? curve1 : curve2, offset: (i % 4) / 4});
    }

    refs.current = {
      renderer,
      scene,
      camera,
      chars,
      pulses,
      tubeMats,
      hubRings,
      hubGlow,
      gears,
      papers,
      step1Mat,
      step1TexA,
      step1TexB,
      rightMat,
      rightTexA,
      rightTexB,
      stamp,
      checkBadge,
    };

    return () => {
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [config, width, height]);

  useEffect(() => {
    const r = refs.current;
    if (!r) return;
    if (r.customWorld) {
      r.customWorld.update(frame);
      r.renderer.render(r.scene, r.camera);
      return;
    }
    const f = frame;
    const t = f / 30;

    // Descobrir ato atual
    let actIdx = 0;
    for (let i = 0; i < actBounds.length; i++) {
      if (f >= actBounds[i].start) actIdx = i;
    }
    const lastActIdx = Math.max(0, actBounds.length - 1);
    const finaleStart = actBounds[lastActIdx]?.start ?? timing.total_frames;

    // Câmera com micro handheld
    const cam = sampleCamera(camKeys, f);
    const sway = 0.028;
    r.camera.position.set(
      cam.pos[0] + Math.sin(t * 0.7) * sway,
      cam.pos[1] + Math.sin(t * 0.9 + 1) * sway * 0.6,
      cam.pos[2],
    );
    r.camera.fov = cam.fov;
    r.camera.updateProjectionMatrix();
    r.camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);

    // Frames de gatilho para telas
    const step1Act = actBounds[config.step1Screen.switchAtActIndex] ?? actBounds[0];
    const step1SwitchFrame = step1Act.start + step1Act.len * config.step1Screen.switchAtProgress;
    const rightAct = actBounds[config.rightScreen.approveAtActIndex] ?? actBounds[lastActIdx];
    const rightApproveFrame = rightAct.start + rightAct.len * config.rightScreen.approveAtProgress;

    // Animar cada personagem
    r.chars.forEach(({cfg, rig, face, seed}) => {
      const mood: CharacterMood =
        cfg.moodsByAct[Math.min(actIdx, cfg.moodsByAct.length - 1)] ?? 'happy';

      if (cfg.role === 'left_desk') {
        rig.root.position.set(-6.3, SIT_Y, -1.6);
        rig.root.rotation.y = 0.15;
        if (f < finaleStart) {
          rig.setPose('sitting_desk', f * 1.6);
          rig.head.rotation.set(0.12 + Math.sin(t * 2.2) * 0.05, Math.sin(t * 1.3) * 0.35, Math.sin(t * 1.7) * 0.06);
          if (mood === 'worried') {
            const scratch = smooth((Math.sin(t * 0.9) - 0.4) * 2);
            rig.shoulderL.rotation.set(lerp(-0.55, -2.6, scratch), 0, lerp(0.12, 0.4, scratch));
            rig.elbowL.rotation.set(lerp(-0.92, -1.6, scratch), 0, 0);
          }
          applyFace(rig, face, mood, f, seed);
        } else {
          const k = clamp01((f - finaleStart) / 30);
          rig.root.position.y = lerp(SIT_Y, STAND_Y, smooth(k));
          rig.root.position.z = lerp(-1.6, -0.1, smooth(k));
          rig.root.rotation.y = 0;
          blendPose(rig, 'sitting_desk', 'standing_wave', k, f);
          if (k >= 1) {
            rig.shoulderL.rotation.z = -2.45 - Math.sin(t * 6) * 0.2;
            rig.shoulderR.rotation.z = 2.45 + Math.sin(t * 6) * 0.2;
          }
          applyFace(rig, face, 'joy', f, seed);
        }
      } else if (cfg.role === 'core_desk') {
        rig.root.position.set(5.2, SIT_Y, -0.9);
        rig.root.rotation.y = 0;
        if (f < finaleStart) {
          rig.setPose('sitting_desk', f * 1.8);
          rig.head.rotation.set(0.2, Math.sin(t * 0.9) * 0.16, 0);
          applyFace(rig, face, mood, f, seed);
        } else {
          const k = clamp01((f - finaleStart - 6) / 28);
          rig.root.position.y = lerp(SIT_Y, STAND_Y, smooth(k));
          rig.root.position.z = lerp(-0.9, -1.4, smooth(k));
          blendPose(rig, 'sitting_desk', 'standing_wave', k, f);
          if (k >= 1) {
            rig.shoulderL.rotation.z = -2.45 - Math.sin(t * 6 + 1.5) * 0.2;
            rig.shoulderR.rotation.z = 2.45 + Math.sin(t * 6 + 1.5) * 0.2;
          }
          applyFace(rig, face, 'joy', f, seed);
        }
      } else if (cfg.role === 'walker') {
        const wAct = actBounds[cfg.walkActIndex ?? 2] ?? actBounds[0];
        const walkStart = wAct.start + 6;
        const walkEnd = wAct.start + wAct.len * 0.36;
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
          applyFace(rig, face, mood, f, seed);
        } else if (f < walkEnd) {
          const u = smooth((f - walkStart) / Math.max(1, walkEnd - walkStart));
          const d1 = P0.distanceTo(P1);
          const d2 = P1.distanceTo(P2);
          const s = u * (d1 + d2);
          const pos = s < d1 ? P0.clone().lerp(P1, s / d1) : P1.clone().lerp(P2, (s - d1) / d2);
          const dir = s < d1 ? P1.clone().sub(P0) : P2.clone().sub(P1);
          const phase = s * 5.2;
          rig.root.position.set(pos.x, STAND_Y + Math.abs(Math.sin(phase)) * 0.04, pos.y);
          const targetYaw = Math.atan2(dir.x, dir.y);
          rig.root.rotation.y = lerp(targetYaw, 0, smooth((u - 0.88) / 0.12));
          walkCycle(rig, phase);
          rig.phoneProp.visible = false;
          applyFace(rig, face, 'neutral', f, seed);
        } else {
          rig.root.position.set(P2.x, STAND_Y, P2.y);
          rig.root.rotation.y = 0;
          rig.phoneProp.visible = false;
          if (f < finaleStart) {
            rig.setPose('standing_neutral', f);
            rig.shoulderL.rotation.set(-0.75, 0, 0.12);
            rig.shoulderR.rotation.set(-0.75, 0, -0.12);
            rig.elbowL.rotation.set(-0.7 + Math.sin(t * 9) * 0.07, 0.2, 0);
            rig.elbowR.rotation.set(-0.7 + Math.cos(t * 9.5) * 0.07, -0.2, 0);
            rig.head.rotation.set(0.28, Math.sin(t * 0.8) * 0.06, 0);
            const point = f >= step1SwitchFrame && f < step1Act.end ? smooth((f - step1SwitchFrame) / 10) : 0;
            if (point > 0) {
              rig.shoulderR.rotation.set(lerp(-0.75, 0.3, point), 0, lerp(-0.12, 1.5, point));
              rig.elbowR.rotation.set(lerp(-0.7, -0.1, point), 0, 0);
              rig.head.rotation.set(lerp(0.28, -0.1, point), lerp(0, 0.5, point), 0);
            }
            applyFace(rig, face, point > 0.3 ? 'joy' : mood, f, seed);
          } else {
            const k = clamp01((f - finaleStart - 8) / 20);
            blendPose(rig, 'standing_neutral', 'standing_wave', k, f);
            if (k >= 1) {
              rig.shoulderL.rotation.z = -2.45 - Math.sin(t * 6 + 1) * 0.2;
              rig.shoulderR.rotation.z = 2.45 + Math.sin(t * 6 + 1) * 0.2;
              rig.root.position.y = STAND_Y + Math.max(0, Math.sin(t * 6 + 1)) * 0.12;
            }
            applyFace(rig, face, 'joy', f, seed);
          }
        }
      } else if (cfg.role === 'right_desk') {
        rig.root.position.set(8.4, SIT_Y, -1.45);
        rig.root.rotation.y = 0;
        if (f < finaleStart) {
          rig.setPose('sitting_desk', f);
          rig.head.rotation.set(0.2, Math.sin(t * 0.7) * 0.18, 0);
          if (f >= rightApproveFrame) {
            const k = smooth((f - rightApproveFrame) / 10);
            rig.shoulderR.rotation.set(lerp(-0.55, -1.6, k), 0, lerp(-0.12, -0.25, k));
            rig.elbowR.rotation.set(lerp(-0.92, -1.4, k), 0, 0);
            rig.head.rotation.set(0.05 + Math.sin(t * 7) * 0.06 * k, 0, 0);
          }
          applyFace(rig, face, f >= rightApproveFrame ? 'happy' : mood, f, seed);
        } else {
          const k = clamp01((f - finaleStart - 4) / 30);
          rig.root.position.y = lerp(SIT_Y, STAND_Y, smooth(k));
          rig.root.position.z = lerp(-1.45, -2.0, smooth(k));
          blendPose(rig, 'sitting_desk', 'standing_wave', k, f);
          if (k >= 1) {
            rig.shoulderL.rotation.z = -2.45 - Math.sin(t * 6 + 2) * 0.2;
            rig.shoulderR.rotation.z = 2.45 + Math.sin(t * 6 + 2) * 0.2;
          }
          applyFace(rig, face, 'joy', f, seed);
        }
      }
    });

    // Troca dinâmica das telas + carimbos
    r.step1Mat.map = f >= step1SwitchFrame ? r.step1TexB : r.step1TexA;
    r.step1Mat.needsUpdate = true;

    const ck = f >= step1SwitchFrame && f < step1Act.end ? smooth((f - step1SwitchFrame) / 8) : 0;
    r.checkBadge.visible = ck > 0.01;
    r.checkBadge.scale.setScalar(ck);
    r.checkBadge.position.y = 2.55 + Math.sin(t * 3) * 0.05;
    r.checkBadge.quaternion.copy(r.camera.quaternion);

    const approved = f >= rightApproveFrame;
    r.rightMat.map = approved ? r.rightTexB : r.rightTexA;
    r.rightMat.needsUpdate = true;
    const sk = approved && f < finaleStart ? smooth((f - rightApproveFrame) / 8) : 0;
    r.stamp.visible = sk > 0.01;
    r.stamp.scale.setScalar(0.55 * sk * (1 + 0.25 * Math.max(0, 1 - (f - rightApproveFrame) / 8)));
    r.stamp.quaternion.copy(r.camera.quaternion);

    // Papéis voando
    const paperCutoff = actBounds[config.flyingPapersUntilAct]?.start ?? 0;
    r.papers.forEach((p, i) => {
      const vis = f < paperCutoff + 18;
      p.visible = vis;
      if (!vis) return;
      const life = (t * 0.45 + i * 0.137) % 1;
      const a = i * 2.1;
      p.position.set(
        -5.9 + Math.cos(a + t * 0.8) * (0.6 + life * 1.4),
        1.0 + life * 2.4 + Math.sin(t * 3 + i) * 0.1,
        -0.9 + Math.sin(a + t * 0.6) * 0.9,
      );
      p.rotation.set(t * 1.7 + i, t * 1.1 + i * 0.5, Math.sin(t * 2 + i) * 0.8);
    });

    // Fluxo luminoso entre estações
    const flowStart = actBounds[config.dataFlowStartAct]?.start ?? 0;
    const flowOn = smooth((f - flowStart) / 25);
    r.tubeMats.forEach((m) => {
      m.opacity = 0.2 + 0.55 * flowOn;
      m.emissiveIntensity = 0.4 + 0.8 * flowOn;
    });
    r.pulses.forEach((p) => {
      p.mesh.visible = flowOn > 0.05;
      const u = (t * 0.55 + p.offset) % 1;
      p.mesh.position.copy(p.curve.getPointAt(u));
      p.mesh.scale.setScalar(0.8 + 0.3 * Math.sin(t * 8 + p.offset * 6));
    });

    // Núcleo + Engrenagens
    r.hubRings.forEach((ring, i) => {
      ring.rotation.z = t * (0.6 + i * 0.35) * (i % 2 ? -1 : 1);
      ring.position.y = [0.8, 1.5, 2.2][i] + Math.sin(t * 1.5 + i) * 0.06;
    });
    r.hubGlow.intensity = 2.4 + 2.6 * (0.7 + 0.3 * Math.sin(t * 4));
    if (r.gears) {
      r.gears.gearA.rotation.z = t * 1.1;
      r.gears.gearB.rotation.z = -t * 1.375;
    }

    r.renderer.render(r.scene, r.camera);
  }, [frame, camKeys, actBounds, config, timing]);

  return <div ref={mountRef} style={{width, height, position: 'absolute', inset: 0}} />;
};
