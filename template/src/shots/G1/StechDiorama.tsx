import React, { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { clamp01, easeInOutPow, BEZ_SCALE_IN } from '../../common';
import {
  createDesmontandoCharacter,
  DesmontandoCharacterRig,
} from './DesmontandoRig';
import {STECH_CUES as C} from './stechWords';
import {STECH_V3_CUES as CV3} from './stechV3Words';
import {AnchorMap, ScreenAnchor} from './ThreeDiorama';

export type StechVariant = '16:9' | '9:16';
export type StechMode = 'v2' | 'v3-short';

const FLOOR_Y = 0.045;

type CamKeyframe = {
  f: number;
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
};

// Câmera Horizontal 16:9 (1920x1080) — Abertura ampla sem cortes, depois foco íntimo em cada módulo
const CAM_KEYS_169: CamKeyframe[] = [
  // Ato 1 (0s-16s): Problema (Manual esquerda) -> Contraste -> Conexão -> Marca Stech
  { f: 0, pos: [-0.15, 2.75, 10.15], look: [-0.1, 1.35, -0.8], fov: 42 },
  { f: 120, pos: [0.25, 2.65, 9.65], look: [0.2, 1.35, -0.8], fov: 41 },
  { f: 250, pos: [2.1, 2.45, 7.65], look: [2.5, 1.35, -0.8], fov: 41 },
  { f: 360, pos: [4.6, 2.35, 6.8], look: [4.7, 1.45, -1.2], fov: 40 },
  { f: 485, pos: [4.6, 2.35, 6.8], look: [4.7, 1.45, -1.2], fov: 40 },

  // Ato 2 (f501-896): Recebimento (Manual papel esquerda -> Automação entrada centralizada direita)
  { f: 530, pos: [-3.5, 2.08, 4.75], look: [-3.8, 1.32, -0.9], fov: 39 },
  { f: 675, pos: [-3.5, 2.08, 4.75], look: [-3.8, 1.32, -0.9], fov: 39 },
  { f: 725, pos: [2.55, 2.08, 4.6], look: [2.65, 1.32, -0.9], fov: 39 },
  { f: 885, pos: [2.55, 2.08, 4.6], look: [2.65, 1.32, -0.9], fov: 39 },

  // Ato 3 (f896-1258): Cozinha (Comanda perdida esquerda -> KDS Cozinha direita)
  { f: 930, pos: [-4.1, 2.1, 4.8], look: [-4.3, 1.35, -1.3], fov: 40 },
  { f: 1010, pos: [5.05, 2.22, 4.65], look: [5.2, 1.58, -1.4], fov: 39 },
  { f: 1245, pos: [5.05, 2.22, 4.65], look: [5.2, 1.58, -1.4], fov: 39 },

  // Ato 4 (f1258-1582): Atendimento & Comunicação em Tempo Real (Cozinha <-> Salão)
  { f: 1310, pos: [3.4, 2.25, 5.75], look: [3.4, 1.42, -0.9], fov: 40 },
  { f: 1565, pos: [3.2, 2.22, 5.55], look: [3.3, 1.42, -0.9], fov: 40 },

  // Ato 5 (f1582-1961): Gestão & Relatórios (Caderno esquerda -> Painel Stech direita)
  { f: 1625, pos: [-3.6, 2.05, 4.65], look: [-3.8, 1.32, -1.0], fov: 40 },
  { f: 1705, pos: [7.6, 2.02, 4.15], look: [7.7, 1.35, -0.85], fov: 39 },
  { f: 1945, pos: [7.6, 2.02, 4.15], look: [7.7, 1.35, -0.85], fov: 39 },

  // Ato 6 (f1961-2314): Operação Organizada & Panorama Integrado Stech
  { f: 2020, pos: [4.8, 2.95, 8.4], look: [4.9, 1.42, -0.85], fov: 41 },
  { f: 2140, pos: [0.85, 3.45, 11.4], look: [0.85, 1.45, -0.8], fov: 42 },
  { f: 2314, pos: [0.95, 3.35, 11.1], look: [0.95, 1.45, -0.8], fov: 42 },
];

// Câmera Vertical 9:16 (1080x1920) — Frustum calibrado para aspect=0.5625 (ZERO cortes de personagens ou telas!)
const CAM_KEYS_916: CamKeyframe[] = [
  // Ato 1 (0s-16s): Problema Manual completo -> Recebimento Stech completo -> Panorama Integrado Stech
  { f: 0, pos: [-4.0, 2.55, 8.6], look: [-4.0, 1.38, -0.8], fov: 56 },
  { f: 95, pos: [-4.0, 2.55, 8.6], look: [-4.0, 1.38, -0.8], fov: 56 },
  { f: 135, pos: [3.25, 2.32, 6.95], look: [1.85, 1.38, -0.8], fov: 53 },
  { f: 205, pos: [3.25, 2.32, 6.95], look: [1.85, 1.38, -0.8], fov: 53 },
  { f: 255, pos: [4.7, 3.05, 14.6], look: [4.7, 1.48, -0.8], fov: 58 },
  { f: 360, pos: [4.7, 2.95, 14.3], look: [4.7, 1.48, -0.8], fov: 57 },
  { f: 485, pos: [4.7, 2.95, 14.3], look: [4.7, 1.48, -0.8], fov: 57 },

  // Ato 2 (f501-896): Recebimento (Manual completo -> Entrada Centralizada Stech completa sem cortar cliente nem KDS)
  { f: 530, pos: [-4.0, 2.55, 8.6], look: [-4.0, 1.38, -0.8], fov: 56 },
  { f: 675, pos: [-4.0, 2.55, 8.6], look: [-4.0, 1.38, -0.8], fov: 56 },
  { f: 725, pos: [3.25, 2.32, 6.95], look: [1.85, 1.38, -0.8], fov: 53 },
  { f: 885, pos: [3.25, 2.32, 6.95], look: [1.85, 1.38, -0.8], fov: 53 },

  // Ato 3 (f896-1258): Cozinha (Manual completo -> KDS Cozinha + Chef completos sem rebarba do totem)
  { f: 925, pos: [-4.0, 2.55, 8.6], look: [-4.0, 1.38, -0.8], fov: 56 },
  { f: 975, pos: [-4.0, 2.55, 8.6], look: [-4.0, 1.38, -0.8], fov: 56 },
  { f: 1020, pos: [4.65, 2.22, 4.65], look: [5.45, 1.65, -1.7], fov: 47 },
  { f: 1245, pos: [4.65, 2.22, 4.65], look: [5.45, 1.65, -1.7], fov: 47 },

  // Ato 4 (f1258-1582): Atendimento & Comunicação (Cliente + Garçom + Totem + KDS + Chef 100% dentro do quadro!)
  { f: 1305, pos: [3.25, 2.65, 11.2], look: [3.25, 1.45, -0.9], fov: 57 },
  { f: 1565, pos: [3.25, 2.6, 11.0], look: [3.25, 1.45, -0.9], fov: 57 },

  // Ato 5 (f1582-1961): Gestão & Relatórios (Manual completo -> Escritório Gestão completo sem rebarba do KDS)
  { f: 1610, pos: [-4.0, 2.55, 8.6], look: [-4.0, 1.38, -0.8], fov: 56 },
  { f: 1665, pos: [-4.0, 2.55, 8.6], look: [-4.0, 1.38, -0.8], fov: 56 },
  { f: 1715, pos: [7.4, 2.15, 5.35], look: [7.95, 1.35, -0.85], fov: 50 },
  { f: 1945, pos: [7.4, 2.15, 5.35], look: [7.95, 1.35, -0.85], fov: 50 },

  // Ato 6 (f1961-2314): Resultado & CTA Panorama Completo Stech (todos os 4 personagens + 3 módulos + 3 dutos!)
  { f: 2015, pos: [4.7, 3.1, 15.0], look: [4.7, 1.48, -0.8], fov: 58 },
  { f: 2314, pos: [4.7, 2.95, 14.4], look: [4.7, 1.48, -0.8], fov: 58 },
];

// Câmera Vertical 9:16 v3 Comercial Curto (40.4s) — Maquete ~15% maior, zero cortes, alinhada ao LiveProcessCard
const CAM_KEYS_916_V3: CamKeyframe[] = [
  // Gancho imediato (f0-f71) + Dor manual (f71-f195): maquete próxima e sem cortar bordas
  {f: 0, pos: [-4.0, 2.42, 8.1], look: [-4.0, 1.34, -0.8], fov: 54},
  {f: 185, pos: [-3.98, 2.38, 7.9], look: [-3.98, 1.34, -0.8], fov: 54},
  // Virada (f201-f285): corte suave para o panorama integrado completo sem cortar cliente nem mesa
  {f: 215, pos: [4.62, 2.85, 14.5], look: [4.62, 1.38, -0.8], fov: 57},
  {f: 275, pos: [4.62, 2.8, 14.2], look: [4.62, 1.38, -0.8], fov: 57},
  // Passo 1 — Recebimento (f289-f486): close limpo no garçom + cliente + totem + placa Stech
  {f: 315, pos: [3.48, 2.28, 7.15], look: [1.85, 1.36, -0.8], fov: 52},
  {f: 472, pos: [3.48, 2.28, 7.15], look: [1.85, 1.36, -0.8], fov: 52},
  // Passo 2 — Cozinha KDS (f486-f615): enquadra KDS + chef livres ABAIXO do LiveProcessCard (zero sobreposição!)
  {f: 505, pos: [4.65, 2.52, 5.1], look: [5.45, 2.12, -1.7], fov: 49},
  {f: 605, pos: [4.65, 2.52, 5.1], look: [5.45, 2.12, -1.7], fov: 49},
  // Passo 2b — Pronto & Avisando o Salão (f624-f668): cliente + garçom + KDS + chef 100% dentro
  {f: 632, pos: [3.62, 2.6, 10.8], look: [3.18, 1.44, -0.9], fov: 56},
  {f: 662, pos: [3.62, 2.6, 10.8], look: [3.18, 1.44, -0.9], fov: 56},
  // Passo 3 — Gestão & Caixa (f671-f865): close limpo no gerente + Painel de Gestão
  {f: 695, pos: [7.4, 2.14, 5.2], look: [7.95, 1.38, -0.85], fov: 49},
  {f: 850, pos: [7.4, 2.14, 5.2], look: [7.95, 1.38, -0.85], fov: 49},
  // CTA & Encerramento (f865-f1214): panorama integrado Stech com todos os dutos ativos
  {f: 895, pos: [4.62, 2.85, 14.5], look: [4.62, 1.4, -0.8], fov: 57},
  {f: 1214, pos: [4.62, 2.8, 14.2], look: [4.62, 1.4, -0.8], fov: 57},
];

const easeCam = easeInOutPow(2.2);

function sampleCamera(N: number, variant: StechVariant, mode: StechMode = 'v2') {
  const keys =
    mode === 'v3-short' && variant === '9:16'
      ? CAM_KEYS_916_V3
      : variant === '9:16'
        ? CAM_KEYS_916
        : CAM_KEYS_169;
  if (N <= keys[0].f) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (N <= b.f) {
      const t = easeCam(clamp01((N - a.f) / Math.max(1, b.f - a.f)));
      return {
        f: N,
        pos: [
          a.pos[0] + (b.pos[0] - a.pos[0]) * t,
          a.pos[1] + (b.pos[1] - a.pos[1]) * t,
          a.pos[2] + (b.pos[2] - a.pos[2]) * t,
        ] as [number, number, number],
        look: [
          a.look[0] + (b.look[0] - a.look[0]) * t,
          a.look[1] + (b.look[1] - a.look[1]) * t,
          a.look[2] + (b.look[2] - a.look[2]) * t,
        ] as [number, number, number],
        fov: (a.fov ?? 40) + ((b.fov ?? 40) - (a.fov ?? 40)) * t,
      };
    }
  }
  return keys[keys.length - 1];
}

const sharedCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);

export function getStechScreenAnchors(
  N: number,
  variant: StechVariant,
  mode: StechMode = 'v2'
): AnchorMap {
  const W = variant === '9:16' ? 1080 : 1920;
  const H = variant === '9:16' ? 1920 : 1080;
  sharedCam.aspect = W / H;

  const cam = sampleCamera(N, variant, mode);
  sharedCam.fov = cam.fov ?? 40;
  sharedCam.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
  sharedCam.lookAt(cam.look[0], cam.look[1], cam.look[2]);
  sharedCam.updateProjectionMatrix();
  sharedCam.updateMatrixWorld();

  const proj = (x: number, y: number, z: number): ScreenAnchor => {
    const v = new THREE.Vector3(x, y, z).project(sharedCam);
    return {
      x: Math.max(120, Math.min(W - 120, (v.x * 0.5 + 0.5) * W)),
      y: Math.max(100, Math.min(H - 220, (-v.y * 0.5 + 0.5) * H)),
      visible: v.z < 1,
    };
  };

  return {
    manualCounter: proj(-3.8, 1.45, -1.2),
    manualCustomer: proj(-5.67, 1.7, 0.35),
    stechTotem: proj(3.25, 1.75, -1.15),
    stechWaiter: proj(2.05, 1.95, 0.35),
    stechKds: proj(5.05, 2.48, -2.95),
    stechDashboard: proj(8.05, 1.75, -0.85),
    stechBrandWall: proj(2.4, 2.75, -3.05),
  };
}

const pop3D = (n: number, dur = 14) =>
  n <= 0 ? 0.0001 : Math.max(0.0001, BEZ_SCALE_IN(clamp01(n / dur)));

function makeCanvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) {
    draw(ctx, w, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildCafeChair(
  stdMat: (c: string, r?: number, m?: number) => THREE.MeshStandardMaterial,
  seatColor: string
) {
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.07, 0.46, 3, 0.03), stdMat(seatColor, 0.6));
  seat.position.y = FLOOR_Y + 0.48;
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.5, 0.07, 3, 0.03), stdMat(seatColor, 0.6));
  back.position.set(0, FLOOR_Y + 0.76, -0.22);
  back.rotation.x = -0.08;
  chair.add(seat, back);

  [
    [-0.18, -0.17],
    [0.18, -0.17],
    [-0.18, 0.17],
    [0.18, 0.17],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.022, 0.48, 10), stdMat('#1E293B', 0.45, 0.4));
    leg.position.set(lx, FLOOR_Y + 0.24, lz);
    chair.add(leg);
  });
  return chair;
}

function buildTable(
  stdMat: (c: string, r?: number, m?: number) => THREE.MeshStandardMaterial,
  woodColor: string,
  hasDish: boolean
) {
  const table = new THREE.Group();
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.04, 18), stdMat('#1E293B', 0.4, 0.5));
  foot.position.y = FLOOR_Y + 0.02;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.68, 12), stdMat('#1E293B', 0.4, 0.5));
  pole.position.y = FLOOR_Y + 0.36;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.055, 24), stdMat(woodColor, 0.55));
  top.position.y = FLOOR_Y + 0.7;
  table.add(foot, pole, top);

  if (hasDish) {
    const sy = FLOOR_Y + 0.728;
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.028, 18), stdMat('#FFFFFF', 0.2));
    plate.position.set(0, sy + 0.014, 0);
    const pasta = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.03, 10, 18), stdMat('#FBBF24', 0.45));
    pasta.rotation.x = Math.PI / 2;
    pasta.position.set(0, sy + 0.04, 0);
    const sauce = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 10), stdMat('#DC2626', 0.35));
    sauce.scale.set(1.1, 0.6, 1.1);
    sauce.position.set(0, sy + 0.058, 0);
    table.add(plate, pasta, sauce);
  }
  return table;
}

export const StechDioramaStage: React.FC<{
  N: number;
  variant?: StechVariant;
  mode?: StechMode;
}> = ({N, variant = '16:9', mode = 'v2'}) => {
  const W = variant === '9:16' ? 1080 : 1920;
  const H = variant === '9:16' ? 1920 : 1080;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    attendantManual: DesmontandoCharacterRig;
    customerManual: DesmontandoCharacterRig;
    chefManual: DesmontandoCharacterRig;
    waiterStech: DesmontandoCharacterRig;
    customerStech: DesmontandoCharacterRig;
    chefStech: DesmontandoCharacterRig;
    managerStech: DesmontandoCharacterRig;
    paperErrorBadge: THREE.Group;
    kdsReadyBanner: THREE.Mesh;
    wallSignsGroup: THREE.Group;
    tube1: THREE.Mesh;
    curve1: THREE.CatmullRomCurve3;
    packets1: THREE.Mesh[];
    tube2: THREE.Mesh;
    curve2: THREE.CatmullRomCurve3;
    packets2: THREE.Mesh[];
    tubeReturn: THREE.Mesh;
    curveReturn: THREE.CatmullRomCurve3;
    packetsReturn: THREE.Mesh[];
  } | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || ctxRef.current) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#66B2F2');

    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);

    // Iluminação oficial Data Crítica
    const hemiLight = new THREE.HemisphereLight('#FFFDF9', '#C79B6B', 1.18);
    hemiLight.position.set(0, 14, 0);
    scene.add(hemiLight);

    [-4.2, 2.5, 6.8].forEach((rx) => {
      const pLight = new THREE.PointLight(rx < 0 ? '#E2E8F0' : '#FFF8EC', rx < 0 ? 0.8 : 1.05, 13, 1.2);
      pLight.position.set(rx, 3.8, 2.2);
      scene.add(pLight);
    });

    const sunLight = new THREE.DirectionalLight('#FFF5E0', 1.65);
    sunLight.position.set(-4.5, 12.5, 8.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 36;
    sunLight.shadow.camera.left = -13.5;
    sunLight.shadow.camera.right = 13.5;
    sunLight.shadow.camera.top = 9.0;
    sunLight.shadow.camera.bottom = -9.0;
    sunLight.shadow.bias = -0.0007;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight('#D8EEFF', 0.45);
    fillLight.position.set(7, 6, 8);
    scene.add(fillLight);

    const stdMat = (color: string, rough = 0.65, metal = 0.05) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

    const addShadow = (obj: THREE.Object3D, cast = true, receive = true) => {
      obj.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = cast;
          c.receiveShadow = receive;
        }
      });
    };

    // ==================== MAQUETE BASE ÚNICA ====================
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const slabBase = new THREE.Mesh(new RoundedBoxGeometry(20.0, 0.34, 7.2, 3, 0.05), stdMat('#475569', 0.75));
    slabBase.position.set(0.4, -0.17, -0.2);
    worldGroup.add(slabBase);

    // ==================== LADO ESQUERDO: OPERAÇÃO MANUAL (PAPEL & IMPROVISO) ====================
    const floorManual = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.04, 6.6), stdMat('#CBD5E1', 0.68));
    floorManual.position.set(-4.6, 0.02, -0.2);
    worldGroup.add(floorManual);

    const wallManual = new THREE.Mesh(new THREE.BoxGeometry(9.2, 3.85, 0.24), stdMat('#E2E8F0', 0.85));
    wallManual.position.set(-4.6, 1.92, -3.25);
    const stripeManual = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.44, 0.28), stdMat('#64748B', 0.7));
    stripeManual.position.set(-4.6, 3.6, -3.23);
    worldGroup.add(wallManual, stripeManual);

    const wallSignsGroup = new THREE.Group();
    worldGroup.add(wallSignsGroup);

    const signTexManual = makeCanvasTexture(640, 128, (ctx, w, h) => {
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 8;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '900 34px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NO IMPROVISO • PAPEL', w / 2, h / 2 + 2);
    });
    const signManual = new THREE.Group();
    signManual.position.set(-4.0, 2.65, -3.08);
    signManual.add(
      new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.6, 0.08, 2, 0.02), stdMat('#1E293B', 0.6)),
      (() => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(3.28, 0.52), new THREE.MeshBasicMaterial({ map: signTexManual }));
        m.position.z = 0.045;
        return m;
      })()
    );
    wallSignsGroup.add(signManual);

    // Balcão Manual com PILHAS DE COMANDAS DE PAPEL ACUMULADAS!
    const manualCounter = new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.92, 0.85, 3, 0.03), stdMat('#94A3B8', 0.65));
    manualCounter.position.set(-3.8, FLOOR_Y + 0.46, -1.25);
    worldGroup.add(manualCounter);

    // Pilhas desordenadas de comandas de papel + caderno no balcão
    for (let pi = 0; pi < 14; pi++) {
      const slip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.3), stdMat('#FFFFFF', 0.8));
      slip.position.set(-4.25 + (pi % 3) * 0.34, FLOOR_Y + 0.93 + Math.floor(pi / 3) * 0.026, -1.22 + ((pi % 2) - 0.5) * 0.14);
      slip.rotation.y = (pi * 0.47) % 1.2 - 0.6;
      worldGroup.add(slip);
    }

    // Badge 3D de erro sobre a pilha de papel ("X")
    const paperErrorBadge = new THREE.Group();
    paperErrorBadge.position.set(-3.85, 1.52, -1.15);
    const x1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.06), new THREE.MeshBasicMaterial({ color: '#EF4444' }));
    x1.rotation.z = Math.PI / 4;
    const x2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.06), new THREE.MeshBasicMaterial({ color: '#EF4444' }));
    x2.rotation.z = -Math.PI / 4;
    paperErrorBadge.add(x1, x2);
    scene.add(paperErrorBadge);

    // Atendente preocupado no balcão manual (calça comprida, gota de suor)
    const attendantManual = createDesmontandoCharacter({
      shirtColor: '#94A3B8',
      shortsColor: '#334155',
      slipperColor: '#1E293B',
      hairColor: '#4B5563',
      hairStyle: 'short',
      longPants: true,
    });
    attendantManual.root.position.set(-2.3, FLOOR_Y + 1.0, -0.35);
    attendantManual.root.rotation.y = -0.3;
    scene.add(attendantManual.root);

    // Chef confuso atrás do balcão manual
    const chefManual = createDesmontandoCharacter({
      shirtColor: '#E2E8F0',
      shortsColor: '#475569',
      slipperColor: '#1E293B',
      apronColor: '#64748B',
      hairStyle: 'short',
      longPants: true,
    });
    chefManual.root.position.set(-4.2, FLOOR_Y + 1.0, -2.05);
    chefManual.root.rotation.y = 0.15;
    scene.add(chefManual.root);

    // Cliente esperando impaciente numa mesa manual (movido para x = -4.95 para aparecer 100% no quadro inicial!)
    const tblManual = buildTable(stdMat, '#94A3B8', false);
    tblManual.position.set(-4.85, 0, 0.35);
    const chManual = buildCafeChair(stdMat, '#64748B');
    chManual.position.set(-5.73, 0, 0.35);
    chManual.rotation.y = Math.PI / 2;
    scene.add(tblManual, chManual);

    const customerManual = createDesmontandoCharacter({
      shirtColor: '#F59E0B',
      shortsColor: '#334155',
      slipperColor: '#1E293B',
      hairStyle: 'quiff',
    });
    customerManual.root.position.set(-5.67, FLOOR_Y + 0.58, 0.35);
    customerManual.root.rotation.y = Math.PI / 2 - 0.1;
    scene.add(customerManual.root);

    // ==================== DIVISÓRIA CENTRAL ARQUITETÔNICA ====================
    const lowWallDiv = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.95, 5.8, 2, 0.03), stdMat('#CBD5E1', 0.65));
    lowWallDiv.position.set(0.0, 0.475, -0.4);
    const glassDiv = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.05, 5.4),
      new THREE.MeshPhysicalMaterial({ color: '#BAE6FD', transparent: true, opacity: 0.25, roughness: 0.1 })
    );
    glassDiv.position.set(0.0, 1.48, -0.4);
    worldGroup.add(lowWallDiv, glassDiv);

    // ==================== LADO DIREITO: AUTOMAÇÃO STECH SOLUÇÕES (3 MÓDULOS INTEGRADOS) ====================
    const floorStech = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.04, 6.6), stdMat('#FBF7EE', 0.55));
    floorStech.position.set(5.1, 0.02, -0.2);
    worldGroup.add(floorStech);
    for (let tx = 0; tx < 10; tx++) {
      for (let tz = 0; tz < 7; tz++) {
        if ((tx + tz) % 2 === 0) {
          const tile = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.045, 0.88), stdMat('#EDE9FE', 0.58));
          tile.position.set(0.65 + tx * 0.94, 0.0225, -2.9 + tz * 0.9);
          worldGroup.add(tile);
        }
      }
    }

    const wallStech = new THREE.Mesh(new THREE.BoxGeometry(10.2, 3.85, 0.24), stdMat('#FFFBEB', 0.82));
    wallStech.position.set(5.1, 1.92, -3.25);
    const stripeStech = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.44, 0.28), stdMat('#0F172A', 0.45));
    stripeStech.position.set(5.1, 3.6, -3.23);
    const subStripeStech = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.12, 0.29), stdMat('#06B6D4', 0.35));
    subStripeStech.position.set(5.1, 3.33, -3.22);
    worldGroup.add(wallStech, stripeStech, subStripeStech);

    // Placa Corporativa Central alinhada às cores oficiais da Logo Stech (#FFFFFF + #004A99 + #2DD4BF)
    const stechBrandTex = makeCanvasTexture(720, 140, (ctx, w, h) => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#004A99';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.fillStyle = '#004A99';
      ctx.font = '900 48px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('STECH', w / 2, 52);
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 20px Arial';
      ctx.fillText('SOLUÇÕES EM AUTOMAÇÕES E SOFTWARES', w / 2, 102);
    });
    const stechBrandSign = new THREE.Group();
    stechBrandSign.position.set(2.4, 2.75, -3.08);
    stechBrandSign.add(
      new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.72, 0.08, 2, 0.02), stdMat('#020617', 0.4)),
      (() => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(3.28, 0.64), new THREE.MeshBasicMaterial({ map: stechBrandTex }));
        m.position.z = 0.045;
        return m;
      })()
    );
    wallSignsGroup.add(stechBrandSign);

    // ---- MÓDULO 1: RECEBIMENTO (Garçom Tablet + Cliente + Terminal Central) ----
    const tblStech = buildTable(stdMat, '#D9A066', true);
    tblStech.position.set(1.45, 0, 0.55);
    const chStech = buildCafeChair(stdMat, '#0284C7');
    chStech.position.set(0.65, 0, 0.55);
    chStech.rotation.y = Math.PI / 2;
    scene.add(tblStech, chStech);

    const customerStech = createDesmontandoCharacter({
      shirtColor: '#10B981',
      shortsColor: '#1E293B',
      slipperColor: '#0284C7',
      hairStyle: 'bob',
      skinColor: '#F1C29B',
    });
    customerStech.root.position.set(0.71, FLOOR_Y + 0.58, 0.55);
    customerStech.root.rotation.y = Math.PI / 2 - 0.1;
    scene.add(customerStech.root);

    const waiterStech = createDesmontandoCharacter({
      shirtColor: '#F0CA4D',
      shortsColor: '#0F172A',
      slipperColor: '#0F172A',
      apronColor: '#0284C7',
      hairStyle: 'short',
      longPants: true,
    });
    waiterStech.root.position.set(2.05, FLOOR_Y + 1.0, 0.35);
    waiterStech.root.rotation.y = -0.35;
    scene.add(waiterStech.root);

    // Terminal / Totem de Pedidos Stech (deslocado para x = 3.25 para nunca ficar atrás do garçom!)
    const orderTotem = new THREE.Group();
    orderTotem.position.set(3.25, FLOOR_Y, -1.15);
    const totemBase = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.92, 0.65, 3, 0.03), stdMat('#E2E8F0', 0.5));
    totemBase.position.y = 0.46;
    const totemBezel = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.68, 0.08, 3, 0.02), stdMat('#0F172A', 0.35));
    totemBezel.position.set(0, 1.32, -0.05);
    totemBezel.rotation.x = -0.15;
    const totemTex = makeCanvasTexture(380, 290, (ctx, w, h) => {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(0, 0, w, 52);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('RECEBIMENTO • STECH', w / 2, 34);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(24, 72, w - 48, 56);
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 20px Arial';
      ctx.fillText('PEDIDO #104 • MESA 03', w / 2, 106);
      ctx.fillStyle = '#10B981';
      ctx.fillRect(24, 146, w - 48, 52);
      ctx.fillStyle = '#0F172A';
      ctx.font = '900 21px Arial';
      ctx.fillText('✓ ENVIADO P/ COZINHA', w / 2, 179);
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 17px Arial';
      ctx.fillText('FILA CENTRAL ORGANIZADA', w / 2, 240);
    });
    const totemScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.6), new THREE.MeshBasicMaterial({ map: totemTex }));
    totemScreen.position.set(0, 1.32, -0.005);
    totemScreen.rotation.x = -0.15;
    orderTotem.add(totemBase, totemBezel, totemScreen);
    scene.add(orderTotem);

    // ---- MÓDULO 2: COZINHA KDS EM TEMPO REAL (x = 5.1) ----
    const kitchenCounter = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.94, 0.78, 3, 0.03), stdMat('#E2E8F0', 0.45));
    kitchenCounter.position.set(5.1, FLOOR_Y + 0.47, -1.35);
    worldGroup.add(kitchenCounter);

    const chefStech = createDesmontandoCharacter({
      shirtColor: '#FFFFFF',
      shortsColor: '#1E293B',
      slipperColor: '#0F172A',
      apronColor: '#06B6D4',
      hairStyle: 'bun',
      longPants: true,
    });
    chefStech.root.position.set(5.9, FLOOR_Y + 1.0, -1.95);
    chefStech.root.rotation.y = -0.22;
    scene.add(chefStech.root);

    // Monitor KDS na parede da Cozinha (elevado e deslocado para x = 5.05 para 100% de leitura livre!)
    const kdsGroup = new THREE.Group();
    kdsGroup.position.set(5.05, 2.48, -3.05);
    const kdsBezel = new THREE.Mesh(new RoundedBoxGeometry(1.75, 1.08, 0.08, 3, 0.02), stdMat('#0F172A', 0.35));
    const kdsTex = makeCanvasTexture(512, 320, (ctx, w, h) => {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#059669';
      ctx.fillRect(0, 0, w, 54);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('KDS COZINHA • STECH', w / 2, 35);
      // 2 cards de pedidos organizados
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(22, 74, 222, 195);
      ctx.fillRect(268, 74, 222, 195);
      ctx.fillStyle = '#FACC15';
      ctx.font = '900 22px Arial';
      ctx.fillText('#104 • MESA 03', 133, 110);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px Arial';
      ctx.fillText('• 2x Prato Executivo', 133, 152);
      ctx.fillText('• Obs: Sem cebola', 133, 184);
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('PREPARO: 04:10', 133, 232);

      ctx.fillStyle = '#34D399';
      ctx.font = '900 22px Arial';
      ctx.fillText('#103 • DELIVERY', 379, 110);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px Arial';
      ctx.fillText('• 1x Massa Especial', 379, 152);
      ctx.fillStyle = '#10B981';
      ctx.fillText('PRONTO ✓', 379, 232);
    });
    const kdsScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.64, 0.98), new THREE.MeshBasicMaterial({ map: kdsTex }));
    kdsScreen.position.z = 0.045;

    const kdsReadyTex = makeCanvasTexture(280, 56, (ctx, w, h) => {
      ctx.fillStyle = '#16A34A';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 22px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓ STATUS: PRONTO!', w / 2, h / 2);
    });
    const kdsReadyBanner = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.18),
      new THREE.MeshBasicMaterial({ map: kdsReadyTex })
    );
    kdsReadyBanner.position.set(0, -0.64, 0.05);
    kdsGroup.add(kdsBezel, kdsScreen, kdsReadyBanner);
    worldGroup.add(kdsGroup);

    // ---- MÓDULO 3: GESTÃO, VENDAS & CAIXA (Gerente à esquerda + Monitor à direita, padrão Data Crítica!) ----
    const officeDesk = new THREE.Group();
    officeDesk.position.set(7.85, 0, -0.85);
    officeDesk.rotation.y = -0.24;
    const deskTop = new THREE.Mesh(new RoundedBoxGeometry(1.75, 0.08, 0.9, 3, 0.025), stdMat('#D9A066', 0.58));
    deskTop.position.y = FLOOR_Y + 0.74;
    officeDesk.add(deskTop);
    [
      [-0.75, -0.35],
      [0.75, -0.35],
      [-0.75, 0.35],
      [0.75, 0.35],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.74, 12), stdMat('#334155', 0.4, 0.5));
      leg.position.set(lx, FLOOR_Y + 0.37, lz);
      officeDesk.add(leg);
    });

    // Monitor Widescreen Gestão Stech (posicionado à direita da mesa para o gerente nunca tampar a tela!)
    const dashGroup = new THREE.Group();
    dashGroup.position.set(0.28, FLOOR_Y + 1.24, -0.12);
    dashGroup.rotation.y = -0.14;
    const dStand = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.4, 12), stdMat('#334155', 0.4));
    dStand.position.set(0, -0.32, -0.04);
    const dBezel = new THREE.Mesh(new RoundedBoxGeometry(1.36, 0.84, 0.06, 3, 0.02), stdMat('#0F172A', 0.35));
    const dashTex = makeCanvasTexture(512, 320, (ctx, w, h) => {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(0, 0, w, 52);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('STECH • PAINEL DE GESTÃO', w / 2, 34);
      // Barras ilustrativas de vendas e estoque
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(24, 72, 220, 210);
      ctx.fillRect(268, 72, 220, 210);
      const bars = [80, 125, 105, 145];
      bars.forEach((bh, i) => {
        ctx.fillStyle = i === 3 ? '#10B981' : '#38BDF8';
        ctx.fillRect(48 + i * 44, 245 - bh, 28, bh);
      });
      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 17px Arial';
      ctx.fillText('VENDAS & PEDIDOS', 134, 268);

      ctx.fillStyle = '#34D399';
      ctx.font = '900 20px Arial';
      ctx.fillText('CAIXA & ESTOQUE', 378, 114);
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 18px Arial';
      ctx.fillText('✓ Pedidos Conciliados', 378, 164);
      ctx.fillText('✓ Estoque Atualizado', 378, 202);
      ctx.fillStyle = '#FACC15';
      ctx.fillText('✓ Relatório do Dia', 378, 242);
    });
    const dScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 0.75), new THREE.MeshBasicMaterial({ map: dashTex }));
    dScreen.position.z = 0.034;
    dashGroup.add(dStand, dBezel, dScreen);
    officeDesk.add(dashGroup);
    scene.add(officeDesk);

    const execChair = buildCafeChair(stdMat, '#0284C7');
    execChair.position.set(7.02, 0, -0.32);
    execChair.rotation.y = 0.68;
    scene.add(execChair);

    const managerStech = createDesmontandoCharacter({
      shirtColor: '#2563EB',
      shortsColor: '#1E293B',
      slipperColor: '#0F172A',
      hairStyle: 'short',
      longPants: true,
    });
    managerStech.root.position.set(7.08, FLOOR_Y + 0.58, -0.26);
    managerStech.root.rotation.y = 0.68;
    scene.add(managerStech.root);

    // ==================== DUTOS LUMINOSOS 3D (CONECTANDO PEDIDOS -> COZINHA -> GESTÃO) ====================
    const curve1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(3.25, 1.85, -1.15),
      new THREE.Vector3(3.85, 2.75, -1.8),
      new THREE.Vector3(4.45, 2.85, -2.5),
      new THREE.Vector3(5.05, 2.48, -2.95),
    ]);
    const tube1 = new THREE.Mesh(
      new THREE.TubeGeometry(curve1, 48, 0.035, 10, false),
      new THREE.MeshBasicMaterial({ color: '#38BDF8', transparent: true, opacity: 0.55 })
    );
    scene.add(tube1);
    const packets1: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 12), new THREE.MeshBasicMaterial({ color: '#FACC15' }));
      scene.add(p);
      packets1.push(p);
    }

    const curve2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(5.25, 2.48, -2.95),
      new THREE.Vector3(6.4, 2.95, -2.1),
      new THREE.Vector3(7.3, 2.65, -1.4),
      new THREE.Vector3(8.1, 1.75, -0.95),
    ]);
    const tube2 = new THREE.Mesh(
      new THREE.TubeGeometry(curve2, 48, 0.035, 10, false),
      new THREE.MeshBasicMaterial({ color: '#10B981', transparent: true, opacity: 0.55 })
    );
    scene.add(tube2);
    const packets2: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 12), new THREE.MeshBasicMaterial({ color: '#4ADE80' }));
      scene.add(p);
      packets2.push(p);
    }

    // Duto de retorno Cozinha -> Garçom/Salão (Atendimento em tempo real)
    const curveReturn = new THREE.CatmullRomCurve3([
      new THREE.Vector3(5.2, 2.05, -2.95),
      new THREE.Vector3(3.8, 2.45, -1.2),
      new THREE.Vector3(2.2, 1.95, 0.1),
    ]);
    const tubeReturn = new THREE.Mesh(
      new THREE.TubeGeometry(curveReturn, 48, 0.032, 10, false),
      new THREE.MeshBasicMaterial({ color: '#FACC15', transparent: true, opacity: 0.5 })
    );
    scene.add(tubeReturn);
    const packetsReturn: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 12), new THREE.MeshBasicMaterial({ color: '#FFE135' }));
      scene.add(p);
      packetsReturn.push(p);
    }

    addShadow(worldGroup, false, true);
    addShadow(attendantManual.root, true, true);
    addShadow(customerManual.root, true, true);
    addShadow(chefManual.root, true, true);
    addShadow(waiterStech.root, true, true);
    addShadow(customerStech.root, true, true);
    addShadow(chefStech.root, true, true);
    addShadow(managerStech.root, true, true);

    ctxRef.current = {
      renderer,
      scene,
      camera,
      attendantManual,
      customerManual,
      chefManual,
      waiterStech,
      customerStech,
      chefStech,
      managerStech,
      paperErrorBadge,
      kdsReadyBanner,
      wallSignsGroup,
      tube1,
      curve1,
      packets1,
      tube2,
      curve2,
      packets2,
      tubeReturn,
      curveReturn,
      packetsReturn,
    };

    return () => {
      renderer.dispose();
      ctxRef.current = null;
    };
  }, [W, H]);

  useLayoutEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const isV3 = mode === 'v3-short';
    const cam = sampleCamera(N, variant, mode);
    ctx.camera.fov = cam.fov ?? 40;
    ctx.camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    ctx.camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);
    ctx.camera.updateProjectionMatrix();
    ctx.camera.updateMatrixWorld();

    // Placas de parede visíveis na abertura e no panorama final
    ctx.wallSignsGroup.visible = isV3
      ? N < CV3.f_cozinha - 15 || N >= CV3.f_cta - 10
      : N < 490 || N >= C.f_resultado - 55;

    // Poses lado manual
    ctx.attendantManual.setPose('standing_worried', N);
    ctx.chefManual.setPose('standing_worried', N + 15);
    ctx.customerManual.setPose('sitting_table', N);
    ctx.customerManual.mouthSmile.visible = false;
    ctx.customerManual.mouthFrown.visible = true;

    // Poses lado Stech
    ctx.waiterStech.setPose('standing_phone', N);
    ctx.waiterStech.phoneProp.visible = true;
    ctx.waiterStech.phoneScreenMat.color.set('#22D3EE');
    ctx.customerStech.setPose('sitting_table', N + 12);
    const celebrateStart = isV3 ? CV3.f_cta - 10 : C.f_resultado - 55;
    ctx.chefStech.setPose(N >= celebrateStart ? 'standing_wave' : 'standing_neutral', N);
    ctx.managerStech.setPose('sitting_desk', N);

    // Badge de erro sobre papéis
    ctx.paperErrorBadge.scale.setScalar(1.0 + Math.sin(N * 0.14) * 0.08);
    ctx.paperErrorBadge.position.y = 1.52 + Math.sin(N * 0.1) * 0.03;

    // KDS Pronto banner surge exatamente quando o status muda para PRONTO
    const kdsReadyFrame = isV3 ? CV3.f_pronto : C.f_tela_kds;
    const showKdsReady = N >= kdsReadyFrame;
    ctx.kdsReadyBanner.visible = showKdsReady;
    if (showKdsReady) {
      ctx.kdsReadyBanner.scale.setScalar(pop3D(N - kdsReadyFrame, 12));
    }

    // Animação progressiva dos pacotes viajando nos dutos 3D
    const activeTube1 = isV3 ? N >= CV3.f_virada : N >= 180;
    const activeTube2 = isV3 ? N >= CV3.f_virada : N >= 180;
    ctx.tube1.visible = activeTube1;
    ctx.tube2.visible = activeTube2;
    ctx.packets1.forEach((p, idx) => {
      p.visible = activeTube1;
      if (activeTube1) {
        const t = ((N * 0.015 + idx / ctx.packets1.length) % 1 + 1) % 1;
        p.position.copy(ctx.curve1.getPoint(t));
      }
    });
    ctx.packets2.forEach((p, idx) => {
      p.visible = activeTube2;
      if (activeTube2) {
        const t = ((N * 0.015 + idx / ctx.packets2.length) % 1 + 1) % 1;
        p.position.copy(ctx.curve2.getPoint(t));
      }
    });

    const activeReturn = isV3 ? N >= CV3.f_pronto - 6 : N >= C.f_atendimento - 20;
    ctx.tubeReturn.visible = activeReturn;
    ctx.packetsReturn.forEach((p, idx) => {
      p.visible = activeReturn;
      if (activeReturn) {
        const t = ((N * 0.016 + idx / ctx.packetsReturn.length) % 1 + 1) % 1;
        p.position.copy(ctx.curveReturn.getPoint(t));
      }
    });

    ctx.renderer.render(ctx.scene, ctx.camera);
  }, [N, variant]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};
