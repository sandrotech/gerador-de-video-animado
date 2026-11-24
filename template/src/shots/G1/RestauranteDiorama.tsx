import React, { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { clamp01, easeInOutPow, BEZ_SCALE_IN } from '../../common';
import {
  createDesmontandoCharacter,
  DesmontandoCharacterRig,
} from './DesmontandoRig';
import { RESTAURANTE_CUES as C } from './restauranteWords';
import { AnchorMap, ScreenAnchor } from './ThreeDiorama';

export const REST_W = 1920;
export const REST_H = 1080;

const FLOOR_Y = 0.045; // Topo exato dos ladrilhos/pisos (zero z-fighting ou afundamento)

type CamKeyframe = {
  f: number;
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
};

// Câmera 16:9 dinâmica estilo Data Crítica: abertura com push-in + pan sutil sem cortar nenhum personagem nas bordas
const CAM_KEYS: CamKeyframe[] = [
  // Ato 1 (f0..150 - Primeiros 5s): Abertura magnética sem cortar nenhum cliente nas bordas
  { f: 0, pos: [-0.45, 2.38, 7.15], look: [-0.2, 1.32, -0.7], fov: 41 },
  { f: 70, pos: [0.35, 2.26, 6.75], look: [0.15, 1.32, -0.7], fov: 40 },
  { f: 150, pos: [0.0, 2.22, 6.65], look: [0.0, 1.32, -0.7], fov: 40 },
  { f: 310, pos: [-2.3, 2.05, 4.75], look: [-3.1, 1.32, -0.7], fov: 40 },
  { f: 450, pos: [2.3, 2.05, 4.75], look: [3.1, 1.32, -0.7], fov: 40 },

  // Ato 2 (f450..1020): O Mapa / Google Search -> Y sem foto vs X com Rota
  { f: 540, pos: [0.0, 2.25, 6.2], look: [0.0, 1.35, -0.7], fov: 41 },
  { f: 780, pos: [3.0, 2.0, 4.2], look: [3.3, 1.3, -0.7], fov: 39 },
  { f: 940, pos: [-2.8, 2.0, 4.2], look: [-3.2, 1.32, -0.7], fov: 39 },
  { f: 1020, pos: [-2.8, 2.0, 4.2], look: [-3.2, 1.32, -0.7], fov: 39 },

  // Ato 3 (f1020..1440): Cardápio
  { f: 1120, pos: [3.0, 2.02, 4.3], look: [3.3, 1.3, -0.7], fov: 39 },
  { f: 1360, pos: [-2.9, 2.02, 4.3], look: [-3.3, 1.32, -0.7], fov: 39 },
  { f: 1440, pos: [-2.9, 2.02, 4.3], look: [-3.3, 1.32, -0.7], fov: 39 },

  // Ato 4 (f1440..1920): Avaliações
  { f: 1560, pos: [2.8, 2.05, 4.4], look: [3.2, 1.3, -0.7], fov: 40 },
  { f: 1800, pos: [-2.8, 2.05, 4.4], look: [-3.2, 1.32, -0.7], fov: 40 },
  { f: 1920, pos: [0.0, 2.25, 6.2], look: [0.0, 1.35, -0.7], fov: 41 },

  // Ato 5 (f1920..2535): Delivery & WhatsApp
  { f: 2120, pos: [3.0, 2.05, 4.35], look: [3.3, 1.3, -0.7], fov: 40 },
  { f: 2360, pos: [-3.0, 2.05, 4.35], look: [-3.3, 1.32, -0.7], fov: 40 },
  { f: 2535, pos: [0.0, 2.35, 6.4], look: [0.0, 1.35, -0.7], fov: 41 },

  // Ato 6 (f2535..2910): 1 Ano Depois + Panorama Final
  { f: 2680, pos: [-3.3, 2.1, 4.75], look: [-3.7, 1.32, -0.7], fov: 40 },
  { f: 2780, pos: [3.3, 2.1, 4.75], look: [3.7, 1.32, -0.7], fov: 40 },
  { f: 2850, pos: [0.0, 3.25, 9.8], look: [0.0, 1.4, -0.6], fov: 41 },
  { f: 2910, pos: [0.0, 3.15, 9.5], look: [0.0, 1.4, -0.6], fov: 41 },
];

const easeCam = easeInOutPow(2.2);

function sampleCamera(N: number) {
  if (N <= CAM_KEYS[0].f) return CAM_KEYS[0];
  for (let i = 1; i < CAM_KEYS.length; i++) {
    const a = CAM_KEYS[i - 1];
    const b = CAM_KEYS[i];
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
  return CAM_KEYS[CAM_KEYS.length - 1];
}

const sharedCam = new THREE.PerspectiveCamera(40, REST_W / REST_H, 0.1, 100);

export function getRestauranteScreenAnchors(N: number): AnchorMap {
  const cam = sampleCamera(N);
  sharedCam.fov = cam.fov ?? 40;
  sharedCam.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
  sharedCam.lookAt(cam.look[0], cam.look[1], cam.look[2]);
  sharedCam.updateProjectionMatrix();
  sharedCam.updateMatrixWorld();

  const proj = (x: number, y: number, z: number): ScreenAnchor => {
    const v = new THREE.Vector3(x, y, z).project(sharedCam);
    return {
      x: Math.max(180, Math.min(REST_W - 180, (v.x * 0.5 + 0.5) * REST_W)),
      y: Math.max(100, Math.min(REST_H - 180, (-v.y * 0.5 + 0.5) * REST_H)),
      visible: v.z < 1,
    };
  };

  return {
    restXPlate: proj(-3.3, 0.42, 0.35),
    restYPlate: proj(3.5, 0.42, 0.35),
    restXManager: proj(-1.4, 2.05, 0.1),
    restYOwner: proj(1.45, 2.05, 0.1),
    restXHeader: proj(-4.2, 2.8, -2.5),
    restYHeader: proj(4.2, 2.8, -2.5),
    restXScreen: proj(-1.95, 1.75, -0.8),
    restYScreen: proj(2.65, 1.75, -0.8),
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

/** Cadeira com dimensões exatas apoiada em FLOOR_Y (sem atravessar piso nem encostar no cliente) */
function buildCafeChair(
  stdMat: (c: string, r?: number, m?: number) => THREE.MeshStandardMaterial,
  seatColor: string
) {
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.075, 0.48, 3, 0.03), stdMat(seatColor, 0.6));
  seat.position.y = FLOOR_Y + 0.48; // 0.525 (topo em 0.56)
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.54, 0.075, 3, 0.03), stdMat(seatColor, 0.6));
  back.position.set(0, FLOOR_Y + 0.78, -0.23);
  back.rotation.x = -0.08;
  chair.add(seat, back);

  [
    [-0.19, -0.18],
    [0.19, -0.18],
    [-0.19, 0.18],
    [0.19, 0.18],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, 0.48, 10), stdMat('#1E293B', 0.45, 0.4));
    leg.position.set(lx, FLOOR_Y + 0.24, lz);
    chair.add(leg);
  });

  return chair;
}

/** Mesa redonda de bistrô apoiada em FLOOR_Y com raio compacto (0.50m) para zero colisão com joelhos/braços */
function buildRestaurantTable(
  stdMat: (c: string, r?: number, m?: number) => THREE.MeshStandardMaterial,
  woodColor: string,
  withFood: boolean
) {
  const table = new THREE.Group();
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.04, 18), stdMat('#1E293B', 0.4, 0.5));
  foot.position.y = FLOOR_Y + 0.02; // Fundo exato em FLOOR_Y (zero z-fighting!)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.68, 12), stdMat('#1E293B', 0.4, 0.5));
  pole.position.y = FLOOR_Y + 0.36;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 24), stdMat(woodColor, 0.55));
  top.position.y = FLOOR_Y + 0.7; // Topo em 0.775
  table.add(foot, pole, top);

  const surfaceY = FLOOR_Y + 0.73;

  if (withFood) {
    [-0.2, 0.2].forEach((px) => {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.028, 18), stdMat('#FFFFFF', 0.2));
      plate.position.set(px, surfaceY + 0.015, 0.02);
      const pasta = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.032, 10, 18), stdMat('#FBBF24', 0.45));
      pasta.rotation.x = Math.PI / 2;
      pasta.position.set(px, surfaceY + 0.042, 0.02);
      const sauce = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), stdMat('#DC2626', 0.35));
      sauce.scale.set(1.1, 0.6, 1.1);
      sauce.position.set(px, surfaceY + 0.06, 0.02);
      const herb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.024), stdMat('#16A34A', 0.5));
      herb.position.set(px + 0.025, surfaceY + 0.088, 0.01);

      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.13, 12), stdMat('#FB923C', 0.2));
      glass.position.set(px * 0.55, surfaceY + 0.065, -0.2);

      table.add(plate, pasta, sauce, herb, glass);
    });
  } else {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.028, 18), stdMat('#FFFFFF', 0.2));
    plate.position.set(0, surfaceY + 0.015, 0);
    const pasta = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.032, 10, 18), stdMat('#FBBF24', 0.45));
    pasta.rotation.x = Math.PI / 2;
    pasta.position.set(0, surfaceY + 0.042, 0);
    const sauce = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), stdMat('#DC2626', 0.35));
    sauce.scale.set(1.1, 0.6, 1.1);
    sauce.position.set(0, surfaceY + 0.06, 0);
    table.add(plate, pasta, sauce);
  }

  return table;
}

export const RestauranteDioramaStage: React.FC<{ N: number }> = ({ N }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    customersX: DesmontandoCharacterRig[];
    chefX: DesmontandoCharacterRig;
    managerX: DesmontandoCharacterRig;
    ownerY: DesmontandoCharacterRig;
    lineQueueX: DesmontandoCharacterRig[];
    yClockMin: THREE.Object3D;
    holoXGroup: THREE.Group;
    holoYGroup: THREE.Group;
    googlePinMesh: THREE.Group;
    passaPontoSign: THREE.Group;
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
    renderer.setSize(REST_W, REST_H, false);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#66B2F2');

    const camera = new THREE.PerspectiveCamera(40, REST_W / REST_H, 0.1, 100);

    // Iluminação oficial Data Crítica
    const hemiLight = new THREE.HemisphereLight('#FFFDF9', '#C79B6B', 1.18);
    hemiLight.position.set(0, 14, 0);
    scene.add(hemiLight);

    [-4.5, 4.5].forEach((rx) => {
      const pLight = new THREE.PointLight(rx < 0 ? '#FFF7DF' : '#E2E8F0', rx < 0 ? 1.15 : 0.72, 13, 1.2);
      pLight.position.set(rx, 3.8, 2.2);
      scene.add(pLight);
    });

    const sunLight = new THREE.DirectionalLight('#FFF5E0', 1.65);
    sunLight.position.set(-4.5, 12.5, 8.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 36;
    sunLight.shadow.camera.left = -12.5;
    sunLight.shadow.camera.right = 12.5;
    sunLight.shadow.camera.top = 8.5;
    sunLight.shadow.camera.bottom = -8.5;
    sunLight.shadow.bias = -0.0007;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight('#D8EEFF', 0.45);
    fillLight.position.set(7, 6, 8);
    scene.add(fillLight);

    const stdMat = (color: string, rough = 0.65, metal = 0.05, flat = false) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: flat });

    const addShadow = (obj: THREE.Object3D, cast = true, receive = true) => {
      obj.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = cast;
          c.receiveShadow = receive;
        }
      });
    };

    // ==================== MAQUETE BASE + RUA FRONTAL ====================
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const slabBase = new THREE.Mesh(new RoundedBoxGeometry(19.2, 0.34, 7.6, 3, 0.05), stdMat('#475569', 0.75));
    slabBase.position.set(0, -0.17, 0.1);
    worldGroup.add(slabBase);

    const streetStrip = new THREE.Mesh(new THREE.BoxGeometry(19.0, 0.03, 1.75), stdMat('#334155', 0.78));
    streetStrip.position.set(0, 0.015, 2.95);
    worldGroup.add(streetStrip);
    for (let sx = -7.8; sx <= 7.8; sx += 2.6) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.035, 0.12), stdMat('#F8FAFC', 0.4));
      dash.position.set(sx, 0.02, 3.05);
      worldGroup.add(dash);
    }
    const curb = new THREE.Mesh(new RoundedBoxGeometry(19.0, 0.14, 0.22, 2, 0.02), stdMat('#CBD5E1', 0.65));
    curb.position.set(0, 0.07, 2.02);
    worldGroup.add(curb);

    // ==================== LADO ESQUERDO: RESTAURANTE X (LIMPO E ACONCHEGANTE) ====================
    const floorX = new THREE.Mesh(new THREE.BoxGeometry(9.3, 0.04, 5.4), stdMat('#FBF7EE', 0.55));
    floorX.position.set(-4.7, 0.02, -0.8);
    worldGroup.add(floorX);
    for (let tx = 0; tx < 10; tx++) {
      for (let tz = 0; tz < 6; tz++) {
        if ((tx + tz) % 2 === 0) {
          const tile = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.045, 0.84), stdMat('#F3E5AB', 0.58));
          tile.position.set(-8.7 + tx * 0.88, 0.0225, -3.0 + tz * 0.86);
          worldGroup.add(tile);
        }
      }
    }

    const wallX = new THREE.Mesh(new THREE.BoxGeometry(9.3, 3.85, 0.24), stdMat('#FFFBEB', 0.82));
    wallX.position.set(-4.7, 1.92, -3.25);
    const headerStripeX = new THREE.Mesh(new THREE.BoxGeometry(9.3, 0.44, 0.28), stdMat('#6D28D9', 0.45));
    headerStripeX.position.set(-4.7, 3.6, -3.23);
    const subStripeX = new THREE.Mesh(new THREE.BoxGeometry(9.3, 0.12, 0.29), stdMat('#22D3EE', 0.35));
    subStripeX.position.set(-4.7, 3.33, -3.22);
    worldGroup.add(wallX, headerStripeX, subStripeX);

    // Letreiro 3D posicionado limpo na parede esquerda: RESTAURANTE DA DONA MARIA
    const signTexX = makeCanvasTexture(640, 144, (ctx, w, h) => {
      ctx.fillStyle = '#4C1D95';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.fillStyle = '#22D3EE';
      ctx.font = 'bold 26px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RESTAURANTE DA', w / 2, 42);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 48px Arial, sans-serif';
      ctx.fillText('DONA MARIA', w / 2, 98);
    });
    const signX = new THREE.Group();
    signX.position.set(-3.6, 2.25, -3.08);
    signX.add(
      new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.72, 0.08, 2, 0.02), stdMat('#1E1B4B', 0.4)),
      (() => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(3.08, 0.64), new THREE.MeshBasicMaterial({map: signTexX}));
        m.position.z = 0.045;
        return m;
      })()
    );
    worldGroup.add(signX);

    // Pendente luminoso discreto sobre a mesa do fundo (longe do letreiro!)
    const cordX = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 8), stdMat('#1E293B', 0.5));
    cordX.position.set(-6.0, 3.35, -1.6);
    const shadeX = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 16), stdMat('#6D28D9', 0.4));
    shadeX.position.set(-6.0, 3.04, -1.6);
    const bulbX = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), new THREE.MeshBasicMaterial({ color: '#FEF08A' }));
    bulbX.position.set(-6.0, 2.96, -1.6);
    worldGroup.add(cordX, shadeX, bulbX);

    // Balcão e Chef no fundo esquerdo do X
    const barCounterX = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.96, 0.72, 3, 0.03), stdMat('#C98D55', 0.58));
    barCounterX.position.set(-6.6, FLOOR_Y + 0.48, -1.95);
    worldGroup.add(barCounterX);

    const chefX = createDesmontandoCharacter({
      shirtColor: '#FFFFFF',
      shortsColor: '#1E293B',
      slipperColor: '#0F172A',
      apronColor: '#06B6D4',
      hairStyle: 'short',
      longPants: true,
    });
    chefX.root.position.set(-6.6, FLOOR_Y + 1.0, -2.6);
    chefX.root.rotation.y = 0.25;
    scene.add(chefX.root);

    // Mesas bem espaçadas no Restaurante X (1 central na frente totalmente enquadrada + 1 ao fundo para dar sensação de casa cheia)
    const customersX: DesmontandoCharacterRig[] = [];
    const tableConfigsX: Array<{
      x: number;
      z: number;
      leftStyle: Parameters<typeof createDesmontandoCharacter>[0];
      rightStyle: Parameters<typeof createDesmontandoCharacter>[0];
    }> = [
        {
          x: -3.3,
          z: -0.25,
          leftStyle: {
            shirtColor: '#10B981',
            shortsColor: '#334155',
            slipperColor: '#1E293B',
            hairColor: '#5C3317',
            hairStyle: 'bob',
            skinColor: '#F1C29B',
          },
          rightStyle: {
            shirtColor: '#F59E0B',
            shortsColor: '#1E293B',
            slipperColor: '#0284C7',
            hairColor: '#1F1B18',
            hairStyle: 'quiff',
            skinColor: '#C68642',
          },
        },
        {
          x: -5.95,
          z: -1.15,
          leftStyle: {
            shirtColor: '#EC4899',
            shortsColor: '#334155',
            slipperColor: '#EC4899',
            hairColor: '#7C2D12',
            hairStyle: 'bun',
            skinColor: '#E8B486',
          },
          rightStyle: {
            shirtColor: '#3B82F6',
            shortsColor: '#1E293B',
            slipperColor: '#2563EB',
            hairColor: '#271C19',
            hairStyle: 'short',
            skinColor: '#E8B486',
          },
        },
      ];

    tableConfigsX.forEach(({ x, z, leftStyle, rightStyle }) => {
      const tbl = buildRestaurantTable(stdMat, '#D9A066', true);
      tbl.position.set(x, 0, z);
      scene.add(tbl);

      // Cadeiras afastadas 0.90m do centro da mesa (0.40m de folga até a borda do tampo de raio 0.50!)
      const chL = buildCafeChair(stdMat, '#7C3AED');
      chL.position.set(x - 0.9, 0, z);
      chL.rotation.y = Math.PI / 2;
      scene.add(chL);

      const rigL = createDesmontandoCharacter(leftStyle);
      rigL.root.position.set(x - 0.84, FLOOR_Y + 0.58, z);
      rigL.root.rotation.y = Math.PI / 2 - 0.1;
      scene.add(rigL.root);
      customersX.push(rigL);

      const chR = buildCafeChair(stdMat, '#7C3AED');
      chR.position.set(x + 0.9, 0, z);
      chR.rotation.y = -Math.PI / 2;
      scene.add(chR);

      const rigR = createDesmontandoCharacter(rightStyle);
      rigR.root.position.set(x + 0.84, FLOOR_Y + 0.58, z);
      rigR.root.rotation.y = -Math.PI / 2 + 0.1;
      scene.add(rigR.root);
      customersX.push(rigR);
    });

    // A própria Dona Maria com coque, avental e smartphone na mão!
    const managerX = createDesmontandoCharacter({
      shirtColor: '#F0CA4D',
      shortsColor: '#1E293B',
      slipperColor: '#0F172A',
      apronColor: '#4C1D95',
      hairColor: '#6B3A1E',
      hairStyle: 'bun',
      longPants: true,
    });
    managerX.root.position.set(-1.35, FLOOR_Y + 1.0, 0.05);
    managerX.root.rotation.y = 0.35;
    scene.add(managerX.root);

    // Divisória arquitetônica central baixa (não corta os letreiros nem o texto de gancho!)
    const lowWallDiv = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.95, 5.1, 2, 0.03), stdMat('#CBD5E1', 0.65));
    lowWallDiv.position.set(0.0, 0.475, -0.75);
    const glassDiv = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.05, 4.8),
      new THREE.MeshPhysicalMaterial({ color: '#BAE6FD', transparent: true, opacity: 0.22, roughness: 0.1 })
    );
    glassDiv.position.set(0.0, 1.48, -0.75);
    worldGroup.add(lowWallDiv, glassDiv);

    // ==================== LADO DIREITO: RESTAURANTE Y (CINZA, VAZIO, PARADO) ====================
    const floorY = new THREE.Mesh(new THREE.BoxGeometry(9.3, 0.04, 5.4), stdMat('#CBD5E1', 0.68));
    floorY.position.set(4.7, 0.02, -0.8);
    worldGroup.add(floorY);

    const wallY = new THREE.Mesh(new THREE.BoxGeometry(9.3, 3.85, 0.24), stdMat('#E2E8F0', 0.85));
    wallY.position.set(4.7, 1.92, -3.25);
    const headerStripeY = new THREE.Mesh(new THREE.BoxGeometry(9.3, 0.44, 0.28), stdMat('#57534E', 0.75));
    headerStripeY.position.set(4.7, 3.6, -3.23);
    worldGroup.add(wallY, headerStripeY);

    const signTexY = makeCanvasTexture(640, 144, (ctx, w, h) => {
      ctx.fillStyle = '#44403C';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#78716C';
      ctx.lineWidth = 8;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.fillStyle = '#A8A29E';
      ctx.font = 'bold 26px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RESTAURANTE DO', w / 2, 42);
      ctx.fillStyle = '#E7E5E4';
      ctx.font = '900 48px Arial, sans-serif';
      ctx.fillText('SEU ZÉ', w / 2, 98);
    });
    const signY = new THREE.Group();
    signY.position.set(3.6, 2.25, -3.08);
    signY.add(
      new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.72, 0.08, 2, 0.02), stdMat('#292524', 0.7)),
      (() => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(3.08, 0.64), new THREE.MeshBasicMaterial({map: signTexY}));
        m.position.z = 0.045;
        return m;
      })()
    );
    worldGroup.add(signY);

    // Relógio de parede no Restaurante Y
    const yClock = new THREE.Group();
    yClock.position.set(6.5, 2.48, -3.08);
    const ycRim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.07, 28), stdMat('#44403C', 0.55));
    ycRim.rotation.x = Math.PI / 2;
    const ycFace = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 28), stdMat('#F8FAFC', 0.45));
    ycFace.rotation.x = Math.PI / 2;
    const yClockMin = new THREE.Group();
    const yBar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.2, 0.02), stdMat('#EF4444', 0.4));
    yBar.position.y = 0.08;
    yClockMin.position.z = 0.055;
    yClockMin.add(yBar);
    yClock.add(ycRim, ycFace, yClockMin);
    worldGroup.add(yClock);

    // 2 Mesas vazias no Restaurante Y (cadeiras afastadas 0.90m, pés no FLOOR_Y sem z-fighting!)
    [
      { x: 3.55, z: -0.25, food: true },
      { x: 5.95, z: -1.15, food: false },
    ].forEach(({ x, z, food }) => {
      const tblY = buildRestaurantTable(stdMat, '#94A3B8', food);
      tblY.position.set(x, 0, z);
      scene.add(tblY);

      const cL = buildCafeChair(stdMat, '#64748B');
      cL.position.set(x - 0.9, 0, z);
      cL.rotation.y = Math.PI / 2;
      const cR = buildCafeChair(stdMat, '#64748B');
      cR.position.set(x + 0.9, 0, z);
      cR.rotation.y = -Math.PI / 2;
      scene.add(cL, cR);
    });

    // Seu Zé com cabelo grisalho e calça social preocupado ao lado das mesas vazias
    const ownerY = createDesmontandoCharacter({
      shirtColor: '#94A3B8',
      shortsColor: '#334155',
      slipperColor: '#1E293B',
      hairColor: '#9CA3AF',
      hairStyle: 'short',
      longPants: true,
    });
    ownerY.root.position.set(1.45, FLOOR_Y + 1.0, 0.05);
    ownerY.root.rotation.y = -0.35;
    scene.add(ownerY.root);

    // ==================== HOLOGRAMAS 3D INTERATIVOS (ATOS 2 A 5) ====================
    const holoXGroup = new THREE.Group();
    holoXGroup.position.set(-1.95, 1.75, -0.8);
    const holoXTex = makeCanvasTexture(360, 460, (ctx, w, h) => {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#10B981';
      ctx.fillRect(0, 0, w, 64);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 26px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('DONA MARIA ★ 4.9', w / 2, 42);
      ctx.fillStyle = '#22D3EE';
      ctx.font = 'bold 22px Arial';
      ctx.fillText('ABERTO • 18h - 23h', w / 2, 120);
      ctx.fillStyle = '#2563EB';
      ctx.fillRect(36, 165, w - 72, 68);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 26px Arial';
      ctx.fillText('▲ ROTA (1 TOQUE)', w / 2, 208);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(36, 260, w - 72, 150);
      ctx.fillStyle = '#FFE135';
      ctx.font = 'bold 22px Arial';
      ctx.fillText('LINK MOBILE + WHATS', w / 2, 320);
      ctx.fillStyle = '#34D399';
      ctx.fillText('✓ RESPONDE TUDO', w / 2, 365);
    });
    const holoXMesh = new THREE.Mesh(
      new RoundedBoxGeometry(0.75, 0.96, 0.05, 3, 0.02),
      new THREE.MeshBasicMaterial({ map: holoXTex })
    );
    holoXGroup.add(holoXMesh);
    holoXGroup.visible = false;
    scene.add(holoXGroup);

    const holoYGroup = new THREE.Group();
    holoYGroup.position.set(2.65, 1.75, -0.8);
    const holoYTex = makeCanvasTexture(360, 460, (ctx, w, h) => {
      ctx.fillStyle = '#1C1917';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(0, 0, w, 64);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 26px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SEU ZÉ ⚠', w / 2, 42);
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 22px Arial';
      ctx.fillText('❌ HORÁRIO ERRADO', w / 2, 130);
      ctx.fillText('❌ SEM FOTO / TEL', w / 2, 185);
      ctx.fillText('⏳ PDF 18MB (ZOOM)', w / 2, 240);
      ctx.fillText('★ 2.8 ABANDONADO', w / 2, 295);
      ctx.fillText('💸 -27% TAXAS APP', w / 2, 350);
    });
    const holoYMesh = new THREE.Mesh(
      new RoundedBoxGeometry(0.75, 0.96, 0.05, 3, 0.02),
      new THREE.MeshBasicMaterial({ map: holoYTex })
    );
    holoYGroup.add(holoYMesh);
    holoYGroup.visible = false;
    scene.add(holoYGroup);

    const googlePinMesh = new THREE.Group();
    googlePinMesh.position.set(-4.5, 3.6, -1.2);
    const pinHead = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), stdMat('#EA4335', 0.3));
    const pinCone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.85, 16), stdMat('#EA4335', 0.3));
    pinCone.rotation.x = Math.PI;
    pinCone.position.y = -0.38;
    const pinDot = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), new THREE.MeshBasicMaterial({ color: '#FFFFFF' }));
    googlePinMesh.add(pinHead, pinCone, pinDot);
    googlePinMesh.visible = false;
    scene.add(googlePinMesh);

    const lineQueueX: DesmontandoCharacterRig[] = [];
    for (let li = 0; li < 4; li++) {
      const qRig = createDesmontandoCharacter({
        shirtColor: ['#F97316', '#8B5CF6', '#10B981', '#06B6D4'][li % 4],
        shortsColor: '#1E293B',
        longPants: li % 2 === 0,
        hairStyle: (['quiff', 'bob', 'short', 'bun'] as const)[li % 4],
      });
      qRig.root.position.set(-7.8 + li * 0.72, FLOOR_Y + 1.0, 1.15);
      qRig.root.rotation.y = Math.PI * 0.35;
      qRig.root.visible = false;
      scene.add(qRig.root);
      lineQueueX.push(qRig);
    }

    const passaPontoSign = new THREE.Group();
    passaPontoSign.position.set(4.5, 2.15, -0.6);
    const board = new THREE.Mesh(new RoundedBoxGeometry(2.8, 1.05, 0.1, 2, 0.02), stdMat('#EF4444', 0.5));
    const boardTex = makeCanvasTexture(512, 192, (ctx, w, h) => {
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 42px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PASSA-SE O PONTO', w / 2, 74);
      ctx.font = 'bold 26px Arial';
      ctx.fillText('TRATAR AQUI', w / 2, 130);
    });
    const boardFace = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.96), new THREE.MeshBasicMaterial({ map: boardTex }));
    boardFace.position.z = 0.055;
    passaPontoSign.add(board, boardFace);
    passaPontoSign.rotation.z = -0.1;
    passaPontoSign.visible = false;
    scene.add(passaPontoSign);

    addShadow(worldGroup, false, true);
    addShadow(chefX.root, true, true);
    addShadow(managerX.root, true, true);
    addShadow(ownerY.root, true, true);
    customersX.forEach((c) => addShadow(c.root, true, true));

    ctxRef.current = {
      renderer,
      scene,
      camera,
      customersX,
      chefX,
      managerX,
      ownerY,
      lineQueueX,
      yClockMin,
      holoXGroup,
      holoYGroup,
      googlePinMesh,
      passaPontoSign,
    };

    return () => {
      renderer.dispose();
      ctxRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const cam = sampleCamera(N);
    ctx.camera.fov = cam.fov ?? 40;
    ctx.camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    ctx.camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);
    ctx.camera.updateProjectionMatrix();
    ctx.camera.updateMatrixWorld();

    ctx.yClockMin.rotation.z = -N * 0.05;

    // Pose específica sitting_table: zero colisão com tampos e pratos!
    ctx.customersX.forEach((c, idx) => {
      c.setPose('sitting_table', N + idx * 19);
    });

    ctx.chefX.setPose('standing_wave', N);
    ctx.managerX.setPose('standing_phone', N);
    ctx.managerX.phoneProp.visible = true;
    ctx.managerX.phoneScreenMat.color.set('#22D3EE');

    ctx.ownerY.setPose('standing_worried', N);

    const showHolos = N >= 480 && N <= 2535;
    ctx.holoXGroup.visible = showHolos;
    ctx.holoYGroup.visible = showHolos;
    if (showHolos) {
      const hS = pop3D(N - 480, 12);
      ctx.holoXGroup.scale.setScalar(hS);
      ctx.holoYGroup.scale.setScalar(hS);
    }

    if (N >= C.f_maria_rota - 30 && N <= 1400) {
      ctx.googlePinMesh.visible = true;
      ctx.googlePinMesh.scale.setScalar(pop3D(N - (C.f_maria_rota - 30), 12));
      ctx.googlePinMesh.position.y = 3.55 + Math.sin(N * 0.12) * 0.1;
      ctx.googlePinMesh.rotation.y = N * 0.04;
    } else {
      ctx.googlePinMesh.visible = false;
    }

    const showQueue = N >= C.f_fila_maria - 80;
    ctx.lineQueueX.forEach((q, idx) => {
      if (showQueue) {
        q.root.visible = true;
        q.root.scale.setScalar(pop3D(N - (C.f_fila_maria - 80 + idx * 8), 12));
        q.setPose('standing_neutral', N + idx * 10);
      } else {
        q.root.visible = false;
      }
    });

    if (N >= C.f_passa_ponto - 40) {
      ctx.passaPontoSign.visible = true;
      ctx.passaPontoSign.scale.setScalar(pop3D(N - (C.f_passa_ponto - 40), 14));
    } else {
      ctx.passaPontoSign.visible = false;
    }

    ctx.renderer.render(ctx.scene, ctx.camera);
  }, [N]);

  return (
    <canvas
      ref={canvasRef}
      width={REST_W}
      height={REST_H}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};
