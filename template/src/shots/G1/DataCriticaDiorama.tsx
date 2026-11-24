import React, {useLayoutEffect, useRef} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {clamp01, easeInOutPow, BEZ_SCALE_IN} from '../../common';
import {
  createDesmontandoCharacter,
  DesmontandoCharacterRig,
} from './DesmontandoRig';
import {DATACRITICA_CUES as C} from './dataCriticaWords';
import {AnchorMap, ScreenAnchor} from './ThreeDiorama';

export const DC_W = 1920;
export const DC_H = 1080;

type CamKeyframe = {
  f: number;
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
};

const CAM_KEYS: CamKeyframe[] = [
  // Ato 1 (f1..365): Seção do Supermercado — problema do produto próximo de vencer e perda no papel
  {f: 1, pos: [-5.85, 2.25, 4.85], look: [-5.75, 1.32, -0.85], fov: 41},
  {f: 185, pos: [-5.75, 2.15, 4.45], look: [-5.7, 1.32, -0.85], fov: 40},
  {f: 355, pos: [-5.85, 2.18, 4.55], look: [-5.75, 1.35, -0.85], fov: 40},

  // Ato 2 (f365..720): Responsável abre o celular, bipa o código de barras e puxa nome + preço atual
  {f: 410, pos: [-5.78, 1.96, 3.55], look: [-5.72, 1.38, -0.85], fov: 39},
  {f: 535, pos: [-5.72, 1.92, 3.35], look: [-5.68, 1.4, -0.85], fov: 38},
  {f: 715, pos: [-5.72, 1.92, 3.35], look: [-5.68, 1.4, -0.85], fov: 38},

  // Ato 3 (f720..955): Preenche Quantidade, Data de Vencimento, tira Foto Real (flash) e Envia -> Câmera acompanha pacote até Compras!
  {f: 745, pos: [-5.68, 1.92, 3.45], look: [-5.65, 1.42, -0.82], fov: 39},
  {f: 875, pos: [-5.65, 1.98, 3.65], look: [-5.6, 1.44, -0.82], fov: 39},
  {f: 945, pos: [-2.85, 2.55, 5.25], look: [-2.85, 1.65, -0.75], fov: 41},

  // Ato 4 (f955..1465): Setor Administrativo de Compras analisa foto/qtd/dias e aprova Rebaixa (R$ 12,90 -> R$ 6,99)
  {f: 1020, pos: [-0.15, 2.02, 3.85], look: [-0.08, 1.28, -0.72], fov: 39},
  {f: 1225, pos: [-0.05, 1.95, 3.52], look: [0.02, 1.28, -0.72], fov: 38},
  {f: 1418, pos: [-0.05, 1.95, 3.52], look: [0.02, 1.28, -0.72], fov: 38},
  {f: 1485, pos: [2.95, 2.52, 5.15], look: [2.95, 1.62, -0.72], fov: 41},

  // Ato 5 (f1465..1925): Setor Administrativo de Cadastro recebe e lança valor + qtd exata de etiquetas no RPInfo
  {f: 1555, pos: [5.95, 2.05, 4.05], look: [6.0, 1.28, -0.72], fov: 39},
  {f: 1740, pos: [6.12, 1.96, 3.68], look: [6.15, 1.28, -0.72], fov: 38},
  {f: 1915, pos: [6.12, 1.96, 3.68], look: [6.15, 1.28, -0.72], fov: 38},

  // Ato 6 (f1925..2175): Cadastro dá baixa no Sistema de Data Crítica -> Retorno voa de volta para a Loja!
  {f: 1965, pos: [5.92, 2.02, 3.88], look: [5.95, 1.3, -0.72], fov: 39},
  {f: 2025, pos: [5.85, 2.15, 4.35], look: [5.85, 1.38, -0.72], fov: 40},
  {f: 2095, pos: [0.0, 3.35, 9.2], look: [0.0, 1.85, -0.75], fov: 42},
  {f: 2175, pos: [-5.35, 2.12, 4.35], look: [-5.25, 1.35, -0.82], fov: 40},

  // Ato 7 (f2175..2475): Loja verifica etiquetas na fila/impressora e cola etiqueta amarela em cada produto
  {f: 2295, pos: [-5.05, 2.02, 4.05], look: [-5.0, 1.28, -0.82], fov: 39},
  {f: 2360, pos: [-5.42, 1.96, 3.68], look: [-5.38, 1.3, -0.88], fov: 39},
  {f: 2465, pos: [-5.42, 1.96, 3.68], look: [-5.38, 1.3, -0.88], fov: 39},

  // Ato 8A (f2475..2600): Produto passa no Caixa PDV com desconto certo e zero desperdício
  {f: 2508, pos: [-6.65, 2.15, 4.65], look: [-6.55, 1.25, -0.75], fov: 41},
  {f: 2595, pos: [-6.65, 2.15, 4.65], look: [-6.55, 1.25, -0.75], fov: 41},

  // Ato 8B (f2600..2784): Grande Panorama 16:9 conectando Loja + Compras + Cadastro/RPInfo!
  {f: 2648, pos: [0.0, 4.05, 14.35], look: [0.0, 1.48, -0.65], fov: 40},
  {f: 2784, pos: [0.0, 3.98, 14.05], look: [0.0, 1.48, -0.65], fov: 40},
];

const easeCam = easeInOutPow(2.4);

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

const sharedCam = new THREE.PerspectiveCamera(40, DC_W / DC_H, 0.1, 100);

export function getDataCriticaScreenAnchors(N: number): AnchorMap {
  const cam = sampleCamera(N);
  sharedCam.fov = cam.fov ?? 40;
  sharedCam.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
  sharedCam.lookAt(cam.look[0], cam.look[1], cam.look[2]);
  sharedCam.updateProjectionMatrix();
  sharedCam.updateMatrixWorld();

  const proj = (x: number, y: number, z: number): ScreenAnchor => {
    const v = new THREE.Vector3(x, y, z).project(sharedCam);
    return {
      x: Math.max(230, Math.min(DC_W - 230, (v.x * 0.5 + 0.5) * DC_W)),
      y: Math.max(115, Math.min(DC_H - 235, (-v.y * 0.5 + 0.5) * DC_H)),
      visible: v.z < 1,
    };
  };

  return {
    storeLeadHead: proj(-6.55, 2.05, -0.55),
    mobileHoloTop: proj(-5.92, 2.08, -0.25),
    mobileHoloMid: proj(-5.92, 1.65, -0.25),
    shelfBatchTop: proj(-5.18, 1.82, -1.05),
    shelfBatchMid: proj(-5.18, 1.32, -1.05),
    printerTop: proj(-4.05, 1.68, -0.82),
    checkoutTop: proj(-7.65, 1.72, -0.45),
    comprasHead: proj(-0.78, 1.85, -0.55),
    comprasMonitorTop: proj(0.22, 1.92, -0.72),
    comprasMonitorMid: proj(0.22, 1.38, -0.72),
    cadastroHead: proj(5.05, 1.85, -0.55),
    cadLeftMonitorTop: proj(5.82, 1.88, -0.76),
    cadRightMonitorTop: proj(6.78, 1.88, -0.58),
    cadRightMonitorMid: proj(6.78, 1.32, -0.58),
    panoLojaTop: proj(-6.0, 2.95, -0.8),
    panoComprasTop: proj(0.0, 2.95, -0.8),
    panoCadastroTop: proj(6.0, 2.95, -0.8),
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

function buildOfficeDeskAndChair(
  stdMat: (color: string, rough?: number, metal?: number, flat?: boolean) => THREE.MeshStandardMaterial,
  chairAccentColor: string
) {
  const group = new THREE.Group();

  // Cadeira giratória ergonômica em x = -0.78, z = -0.55
  const chair = new THREE.Group();
  chair.position.set(-0.78, 0, -0.55);
  chair.rotation.y = 0.65;
  const baseStar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.05, 16), stdMat('#1E293B', 0.4, 0.5));
  baseStar.position.y = 0.04;
  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.48, 12), stdMat('#64748B', 0.3, 0.7));
  piston.position.y = 0.28;
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.11, 0.58, 3, 0.04), stdMat(chairAccentColor, 0.6));
  seat.position.y = 0.54;
  const backrest = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.68, 0.11, 3, 0.04), stdMat(chairAccentColor, 0.6));
  backrest.position.set(0, 0.92, -0.25);
  backrest.rotation.x = -0.08;
  chair.add(baseStar, piston, seat, backrest);
  group.add(chair);

  // Mesa administrativa chanfrada
  const desk = new THREE.Group();
  desk.position.set(0.22, 0, -0.68);
  desk.rotation.y = -0.26;
  const top = new THREE.Mesh(new RoundedBoxGeometry(1.78, 0.08, 0.92, 3, 0.025), stdMat('#D9A066', 0.58));
  top.position.y = 0.78;
  desk.add(top);

  [
    [-0.78, -0.36],
    [0.78, -0.36],
    [-0.78, 0.36],
    [0.78, 0.36],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.76, 12), stdMat('#334155', 0.4, 0.5));
    leg.position.set(lx, 0.38, lz);
    desk.add(leg);
  });

  // Teclado e Mouse 3D sobre a mesa
  const kb = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.025, 0.16, 2, 0.008), stdMat('#1E293B', 0.4));
  kb.position.set(-0.22, 0.835, 0.16);
  kb.rotation.y = 0.18;
  const mouse = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.03, 0.12, 3, 0.012), stdMat('#F8FAFC', 0.3));
  mouse.position.set(0.12, 0.835, 0.18);
  desk.add(kb, mouse);

  group.add(desk);
  return {group, chair, desk};
}

export const DataCriticaDioramaStage: React.FC<{N: number}> = ({N}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    wallSignsGroup: THREE.Group;
    storeClockMin: THREE.Object3D;
    storeLeadRig: DesmontandoCharacterRig;
    buyerRig: DesmontandoCharacterRig;
    cadastroRig: DesmontandoCharacterRig;
    paperLossGroup: THREE.Group;
    mobileHoloGroup: THREE.Group;
    holoRowQty: THREE.Mesh;
    holoRowDate: THREE.Mesh;
    holoPhotoThumb: THREE.Mesh;
    holoReturnBanner: THREE.Mesh;
    scannerLaserMesh: THREE.Mesh;
    cameraFlashCone: THREE.Mesh;
    batchHaloMat: THREE.MeshBasicMaterial;
    yellowStickers: THREE.Mesh[];
    comprasPriceOldBar: THREE.Mesh;
    comprasPriceNewBar: THREE.Mesh;
    comprasApprovedBadge: THREE.Mesh;
    cadDcDoneBanner: THREE.Mesh;
    rpinfoPriceRow: THREE.Mesh;
    rpinfoLabelTags: THREE.Mesh[];
    syncBridgeSpheres: THREE.Mesh[];
    printerStripMesh: THREE.Mesh;
    printerLedMat: THREE.MeshBasicMaterial;
    checkoutProductGroup: THREE.Group;
    checkoutPaidBadge: THREE.Mesh;
    checkoutScanFlash: THREE.Mesh;
    tube1: THREE.Mesh;
    curve1: THREE.CatmullRomCurve3;
    packets1: THREE.Mesh[];
    tube1Mat: THREE.MeshBasicMaterial;
    tube2: THREE.Mesh;
    curve2: THREE.CatmullRomCurve3;
    packets2: THREE.Mesh[];
    tube2Mat: THREE.MeshBasicMaterial;
    tube3: THREE.Mesh;
    curve3: THREE.CatmullRomCurve3;
    packets3: THREE.Mesh[];
    tube3Mat: THREE.MeshBasicMaterial;
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
    renderer.setSize(DC_W, DC_H, false);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#66B2F2');

    const camera = new THREE.PerspectiveCamera(40, DC_W / DC_H, 0.1, 100);

    // ---- ILUMINAÇÃO GLOBAL ACONCHEGANTE E NÍTIDA EM TODOS OS 3 SETORES ----
    const hemiLight = new THREE.HemisphereLight('#FFFDF9', '#C79B6B', 1.18);
    hemiLight.position.set(0, 14, 0);
    scene.add(hemiLight);

    [-6.0, 0.0, 6.0].forEach((rx) => {
      const pLight = new THREE.PointLight('#FFF8EC', 0.95, 13, 1.2);
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
      new THREE.MeshStandardMaterial({color, roughness: rough, metalness: metal, flatShading: flat});

    const addShadow = (obj: THREE.Object3D, cast = true, receive = true) => {
      obj.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = cast;
          c.receiveShadow = receive;
        }
      });
    };

    // ==================== ARQUITETURA DOS 3 SETORES CONECTADOS (x = -9.4 .. +9.4) ====================
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // Base estrutural única tipo maquete arquitetônica (@desmontandoomundo)
    const slabBase = new THREE.Mesh(new RoundedBoxGeometry(19.2, 0.34, 6.8, 3, 0.05), stdMat('#475569', 0.75));
    slabBase.position.set(0, -0.17, -0.2);
    worldGroup.add(slabBase);

    // Piso Setor 1 (Supermercado: ladrilhos claros x = -9.4 .. -3.0)
    const floorStore = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.04, 6.5), stdMat('#F3EFE6', 0.55));
    floorStore.position.set(-6.2, 0.02, -0.2);
    worldGroup.add(floorStore);
    for (let tx = 0; tx < 8; tx++) {
      for (let tz = 0; tz < 8; tz++) {
        if ((tx + tz) % 2 === 0) {
          const tile = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.045, 0.78), stdMat('#E5DEC9', 0.58));
          tile.position.set(-8.95 + tx * 0.78, 0.022, -2.95 + tz * 0.78);
          worldGroup.add(tile);
        }
      }
    }

    // Piso Setor 2 (Compras: madeira aconchegante x = -3.0 .. +3.0)
    const floorCompras = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.045, 6.5), stdMat('#C98D55', 0.65));
    floorCompras.position.set(0, 0.022, -0.2);
    worldGroup.add(floorCompras);

    // Piso Setor 3 (Cadastro / RPInfo: piso executivo cinza-claro azulado x = +3.0 .. +9.4)
    const floorCadastro = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.045, 6.5), stdMat('#E2E8F0', 0.55));
    floorCadastro.position.set(6.2, 0.022, -0.2);
    worldGroup.add(floorCadastro);

    // Paredes de fundo dos 3 setores (z = -3.25)
    const wallStore = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.85, 0.24), stdMat('#FBF7EE', 0.82));
    wallStore.position.set(-6.2, 1.92, -3.25);
    const storeHeaderStripe = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.44, 0.28), stdMat('#DC2626', 0.5));
    storeHeaderStripe.position.set(-6.2, 3.58, -3.23);
    const storeSubStripe = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.12, 0.29), stdMat('#FACC15', 0.45));
    storeSubStripe.position.set(-6.2, 3.32, -3.22);

    const wallCompras = new THREE.Mesh(new THREE.BoxGeometry(6.0, 3.85, 0.24), stdMat('#EFE6D5', 0.82));
    wallCompras.position.set(0, 1.92, -3.25);
    const comprasHeaderStripe = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.42, 0.28), stdMat('#1D4ED8', 0.5));
    comprasHeaderStripe.position.set(0, 3.58, -3.23);

    const wallCadastro = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.85, 0.24), stdMat('#E8EEF5', 0.82));
    wallCadastro.position.set(6.2, 1.92, -3.25);
    const cadHeaderStripe = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.42, 0.28), stdMat('#047857', 0.5));
    cadHeaderStripe.position.set(6.2, 3.58, -3.23);

    worldGroup.add(
      wallStore,
      storeHeaderStripe,
      storeSubStripe,
      wallCompras,
      comprasHeaderStripe,
      wallCadastro,
      cadHeaderStripe
    );

    // Placas identificadoras 3D nas paredes de fundo (exibidas no Panorama Final 16:9 para zero poluição atrás dos letreiros nos closes!)
    const wallSignsGroup = new THREE.Group();
    worldGroup.add(wallSignsGroup);
    const makeWallSign = (x: number, title: string, bgHex: string, accentHex: string) => {
      const tex = makeCanvasTexture(640, 128, (ctx, w, h) => {
        ctx.fillStyle = bgHex;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, w - 10, h - 10);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 36px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, w / 2, h / 2 + 2);
      });
      const signGroup = new THREE.Group();
      signGroup.position.set(x, 2.72, -3.08);
      const backing = new THREE.Mesh(
        new RoundedBoxGeometry(2.68, 0.52, 0.07, 2, 0.02),
        stdMat('#1E293B', 0.5)
      );
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(2.58, 0.46),
        new THREE.MeshBasicMaterial({map: tex})
      );
      face.position.z = 0.038;
      signGroup.add(backing, face);
      wallSignsGroup.add(signGroup);
    };
    makeWallSign(-5.95, '1. LOJA • SUPERMERCADO', '#B91C1C', '#FACC15');
    makeWallSign(0.0, '2. SETOR DE COMPRAS', '#1E40AF', '#60A5FA');
    makeWallSign(6.05, '3. CADASTRO & RPINFO', '#065F46', '#34D399');

    // Divisórias arquitetônicas baixas com vidro entre os setores (x = -3.0 e x = +3.0)
    [-3.0, 3.0].forEach((dx) => {
      const lowWall = new THREE.Mesh(new RoundedBoxGeometry(0.22, 1.35, 5.8, 2, 0.03), stdMat('#CBD5E1', 0.65));
      lowWall.position.set(dx, 0.68, -0.35);
      const glassPane = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 1.35, 5.2),
        new THREE.MeshPhysicalMaterial({
          color: '#BAE6FD',
          transparent: true,
          opacity: 0.25,
          roughness: 0.1,
        })
      );
      glassPane.position.set(dx, 2.02, -0.35);
      worldGroup.add(lowWall, glassPane);
    });

    // ==================== SETOR 1: SUPERMERCADO (GÔNDOLA + RESPONSÁVEL + IMPRESSORA + CAIXA PDV) ====================
    // Relógio de parede na loja (gira rápido no Ato 1: "demora demais e gera perda")
    const storeClock = new THREE.Group();
    storeClock.position.set(-8.15, 2.75, -3.08);
    const cRim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.07, 28), stdMat('#1E293B', 0.45));
    cRim.rotation.x = Math.PI / 2;
    const cFace = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 28), stdMat('#FFFFFF', 0.35));
    cFace.rotation.x = Math.PI / 2;
    const storeClockMin = new THREE.Group();
    const minBar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.2, 0.02), stdMat('#EF4444', 0.4));
    minBar.position.y = 0.08;
    storeClockMin.position.z = 0.055;
    storeClockMin.add(minBar);
    storeClock.add(cRim, cFace, storeClockMin);
    worldGroup.add(storeClock);

    // Gôndola 3D de Supermercado em x = -5.18, z = -1.15
    const gondola = new THREE.Group();
    gondola.position.set(-5.18, 0, -1.15);
    gondola.rotation.y = -0.18;
    scene.add(gondola);

    const gBack = new THREE.Mesh(new RoundedBoxGeometry(1.88, 2.25, 0.12, 3, 0.03), stdMat('#F8FAFC', 0.5));
    gBack.position.set(0, 1.14, -0.32);
    const gTopSign = new THREE.Mesh(new RoundedBoxGeometry(1.92, 0.24, 0.48, 3, 0.03), stdMat('#DC2626', 0.45));
    gTopSign.position.set(0, 2.22, -0.14);
    gondola.add(gBack, gTopSign);

    [0.24, 0.88, 1.52].forEach((sy) => {
      const shelf = new THREE.Mesh(new RoundedBoxGeometry(1.84, 0.06, 0.62, 2, 0.015), stdMat('#E2E8F0', 0.45, 0.2));
      shelf.position.set(0, sy, -0.04);
      const priceRail = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.055, 0.02), stdMat('#EF4444', 0.4));
      priceRail.position.set(0, sy - 0.01, 0.275);
      gondola.add(shelf, priceRail);
    });

    // Produtos normais nas prateleiras inferior (y=0.24) e superior (y=1.52)
    const normalColors = ['#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4'];
    for (let i = 0; i < 5; i++) {
      const boxBot = new THREE.Mesh(
        new RoundedBoxGeometry(0.24, 0.34, 0.22, 2, 0.025),
        stdMat(normalColors[i % normalColors.length], 0.5)
      );
      boxBot.position.set(-0.64 + i * 0.32, 0.44, 0.02);
      const boxTop = new THREE.Mesh(
        new RoundedBoxGeometry(0.22, 0.32, 0.2, 2, 0.025),
        stdMat(normalColors[(i + 2) % normalColors.length], 0.5)
      );
      boxTop.position.set(-0.64 + i * 0.32, 1.71, 0.02);
      gondola.add(boxBot, boxTop);
    }

    // LOTE EM DATA CRÍTICA na prateleira central (y = 0.88 -> centro em y = 1.12): 6 unidades destacadas!
    const batchHaloMat = new THREE.MeshBasicMaterial({
      color: '#F97316',
      transparent: true,
      opacity: 0.38,
    });
    const batchHalo = new THREE.Mesh(new RoundedBoxGeometry(1.72, 0.48, 0.42, 3, 0.05), batchHaloMat);
    batchHalo.position.set(0, 1.15, 0.04);
    gondola.add(batchHalo);

    const yellowStickers: THREE.Mesh[] = [];
    const stickerTex = makeCanvasTexture(128, 84, (ctx, w, h) => {
      ctx.fillStyle = '#FFE135';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#141414';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = '#DC2626';
      ctx.font = '900 22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('OFERTA', w / 2, 24);
      ctx.fillStyle = '#141414';
      ctx.font = '900 28px Arial';
      ctx.fillText('R$ 6,99', w / 2, 54);
      // Código de barras inferior
      for (let bx = 16; bx < w - 16; bx += 6) {
        ctx.fillRect(bx, 62, bx % 12 === 0 ? 4 : 2, 14);
      }
    });
    const stickerMat = new THREE.MeshBasicMaterial({map: stickerTex});

    for (let i = 0; i < 6; i++) {
      const prod = new THREE.Group();
      prod.position.set(-0.68 + i * 0.27, 1.11, 0.06);
      const carton = new THREE.Mesh(new RoundedBoxGeometry(0.21, 0.38, 0.2, 3, 0.025), stdMat('#FB923C', 0.45));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 12), stdMat('#DC2626', 0.4));
      cap.position.y = 0.21;
      // Código de barras original branco na frente
      const origBarcode = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.075), new THREE.MeshBasicMaterial({color: '#FFFFFF'}));
      origBarcode.position.set(0, -0.05, 0.102);
      // Nova Etiqueta Amarela Rebaixada (aparece no Ato 7 f_cola = 2357!)
      const newSticker = new THREE.Mesh(new THREE.PlaneGeometry(0.165, 0.11), stickerMat);
      newSticker.position.set(0, 0.02, 0.106);
      newSticker.scale.setScalar(0.0001);
      yellowStickers.push(newSticker);

      prod.add(carton, cap, origBarcode, newSticker);
      gondola.add(prod);
    }

    // Bloco de papel riscado com X vermelho (Ato 1: "anotar no papel demora demais e gera perda")
    const paperLossGroup = new THREE.Group();
    paperLossGroup.position.set(-5.95, 1.65, -0.25);
    const clipBoard = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.48, 0.04, 2, 0.01), stdMat('#F8FAFC', 0.6));
    const xBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.065, 0.05), new THREE.MeshBasicMaterial({color: '#EF4444'}));
    xBar1.rotation.z = Math.PI / 4;
    xBar1.position.z = 0.025;
    const xBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.065, 0.05), new THREE.MeshBasicMaterial({color: '#EF4444'}));
    xBar2.rotation.z = -Math.PI / 4;
    xBar2.position.z = 0.025;
    paperLossGroup.add(clipBoard, xBar1, xBar2);
    scene.add(paperLossGroup);

    // Responsável da Loja (nosso boneco oficial DesmontandoRig.ts!)
    const storeLeadRig = createDesmontandoCharacter({
      shirtColor: '#F0CA4D',
      shortsColor: '#334155',
      slipperColor: '#2563EB',
    });
    storeLeadRig.root.position.set(-6.55, 1.0, -0.55);
    storeLeadRig.root.rotation.y = 0.62;
    scene.add(storeLeadRig.root);

    // Card Holográfico 3D do Aplicativo Mobile ao lado do celular (para leitura cristalina em 16:9!)
    const mobileHoloGroup = new THREE.Group();
    mobileHoloGroup.position.set(-5.92, 1.68, -0.22);
    mobileHoloGroup.rotation.y = 0.12;
    scene.add(mobileHoloGroup);

    const holoBaseTex = makeCanvasTexture(320, 460, (ctx, w, h) => {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(0, 0, w, 68);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('DATA CRÍTICA APP', w / 2, 43);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(20, 86, w - 40, 74);
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 20px Arial';
      ctx.fillText('SUCO INTEGRAL 1L', w / 2, 116);
      ctx.fillStyle = '#FACC15';
      ctx.font = '900 22px Arial';
      ctx.fillText('ATUAL: R$ 12,90', w / 2, 146);
    });
    const holoBody = new THREE.Mesh(
      new RoundedBoxGeometry(0.58, 0.84, 0.04, 3, 0.02),
      new THREE.MeshBasicMaterial({map: holoBaseTex})
    );
    mobileHoloGroup.add(holoBody);

    const makePillTex = (label: string, bg: string) =>
      makeCanvasTexture(280, 56, (ctx, w, h) => {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 23px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, w / 2, h / 2 + 1);
      });

    const holoRowQty = new THREE.Mesh(
      new THREE.PlaneGeometry(0.48, 0.095),
      new THREE.MeshBasicMaterial({map: makePillTex('QTD: 24 UNIDADES', '#2563EB')})
    );
    holoRowQty.position.set(0, -0.02, 0.025);
    const holoRowDate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.48, 0.095),
      new THREE.MeshBasicMaterial({map: makePillTex('VENCE: 5 DIAS', '#D97706')})
    );
    holoRowDate.position.set(0, -0.14, 0.025);
    const holoPhotoThumb = new THREE.Mesh(
      new THREE.PlaneGeometry(0.48, 0.14),
      new THREE.MeshBasicMaterial({map: makePillTex('📷 FOTO ANEXADA ✓', '#059669')})
    );
    holoPhotoThumb.position.set(0, -0.28, 0.025);
    const holoReturnBanner = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.24),
      new THREE.MeshBasicMaterial({map: makePillTex('✓ REBAIXA R$ 6,99!', '#16A34A')})
    );
    holoReturnBanner.position.set(0, -0.14, 0.03);

    mobileHoloGroup.add(holoRowQty, holoRowDate, holoPhotoThumb, holoReturnBanner);

    // Feixe Laser Vermelho do Scanner de Código de Barras (f_bipa = 535)
    const scannerLaserMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 1.05, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#EF4444',
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      })
    );
    scannerLaserMesh.rotation.z = Math.PI / 2 - 0.12;
    scannerLaserMesh.position.set(-5.72, 1.32, -0.68);
    scene.add(scannerLaserMesh);

    // Cone Branco de Flash da Foto Real do Produto (f_foto = 842)
    const cameraFlashCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.15, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#FFFFFF',
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      })
    );
    cameraFlashCone.rotation.z = Math.PI / 2 - 0.1;
    cameraFlashCone.position.set(-5.68, 1.32, -0.68);
    scene.add(cameraFlashCone);

    // Impressora Térmica de Etiquetas da Loja (x = -3.95, z = -0.88)
    const printerStand = new THREE.Group();
    printerStand.position.set(-3.95, 0, -0.88);
    printerStand.rotation.y = -0.28;
    const pPedestal = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.92, 0.56, 3, 0.03), stdMat('#CBD5E1', 0.55));
    pPedestal.position.y = 0.46;
    const pBody = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.34, 0.44, 3, 0.04), stdMat('#1E293B', 0.4));
    pBody.position.y = 1.08;
    const printerLedMat = new THREE.MeshBasicMaterial({color: '#64748B'});
    const pLed = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), printerLedMat);
    pLed.position.set(0.18, 1.18, 0.22);
    const printerStripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.015, 0.42), stickerMat);
    printerStripMesh.position.set(0, 0.98, 0.28);
    printerStripMesh.rotation.x = 0.42;
    printerStand.add(pPedestal, pBody, pLed, printerStripMesh);
    scene.add(printerStand);

    // Balcão de Caixa PDV do Supermercado na esquerda (x = -7.75, z = -0.45) para Ato 8A (f_caixa = 2512)
    const checkoutBase = new THREE.Group();
    checkoutBase.position.set(-7.75, 0, -0.45);
    checkoutBase.rotation.y = 0.22;
    const beltCounter = new THREE.Mesh(new RoundedBoxGeometry(1.32, 0.88, 0.68, 3, 0.03), stdMat('#E2E8F0', 0.5));
    beltCounter.position.y = 0.44;
    const beltBlack = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.03, 0.46), stdMat('#1E293B', 0.7));
    beltBlack.position.set(0, 0.89, 0.04);
    const posScreenTex = makeCanvasTexture(256, 140, (ctx, w, h) => {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#38BDF8';
      ctx.font = '900 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('CAIXA PDV', w / 2, 46);
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 22px Arial';
      ctx.fillText('CAIXA LIVRE', w / 2, 98);
    });
    const posMonitor = new THREE.Group();
    posMonitor.position.set(-0.32, 1.16, -0.16);
    const posBezel = new THREE.Mesh(
      new RoundedBoxGeometry(0.48, 0.34, 0.05, 2, 0.015),
      stdMat('#1E293B', 0.4)
    );
    const posStand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.22, 10), stdMat('#334155', 0.4));
    posStand.position.y = -0.2;
    const posFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.43, 0.28),
      new THREE.MeshBasicMaterial({map: posScreenTex})
    );
    posFace.position.z = 0.028;
    const checkoutPaidBadge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.41, 0.14),
      new THREE.MeshBasicMaterial({map: makePillTex('R$ 6,99 ✓', '#16A34A')})
    );
    checkoutPaidBadge.position.set(0, -0.05, 0.032);
    posMonitor.add(posBezel, posStand, posFace, checkoutPaidBadge);
    const checkoutScanFlash = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 0.32, 16),
      new THREE.MeshBasicMaterial({color: '#4ADE80', transparent: true, opacity: 0.0})
    );
    checkoutScanFlash.position.set(0.05, 1.06, 0.04);

    const checkoutProductGroup = new THREE.Group();
    checkoutProductGroup.position.set(0.35, 1.08, 0.04);
    const cpBox = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.34, 0.18, 2, 0.02), stdMat('#FB923C', 0.45));
    const cpTag = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1), stickerMat);
    cpTag.position.set(0, 0.02, 0.095);
    checkoutProductGroup.add(cpBox, cpTag);

    checkoutBase.add(beltCounter, beltBlack, posMonitor, checkoutScanFlash, checkoutProductGroup);
    scene.add(checkoutBase);

    // ==================== SETOR 2: ADMINISTRATIVO DE COMPRAS (x = 0.0) ====================
    const comprasOffice = buildOfficeDeskAndChair(stdMat, '#2563EB');
    comprasOffice.group.position.set(0.0, 0, 0);
    scene.add(comprasOffice.group);

    const buyerRig = createDesmontandoCharacter({
      shirtColor: '#2563EB',
      shortsColor: '#1E293B',
      slipperColor: '#334155',
    });
    buyerRig.root.position.set(0, 0.64, 0.06);
    comprasOffice.chair.add(buyerRig.root);

    // Monitor Widescreen 3D do Setor de Compras
    const comprasMonGroup = new THREE.Group();
    comprasMonGroup.position.set(0.14, 1.24, -0.12);
    const cStand = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.38, 12), stdMat('#334155', 0.4, 0.5));
    cStand.position.set(0, -0.34, -0.045);
    const cStandBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.025, 18), stdMat('#1E293B', 0.4, 0.5));
    cStandBase.position.set(0, -0.41, -0.02);
    const comprasScreenTex = makeCanvasTexture(512, 320, (ctx, w, h) => {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1D4ED8';
      ctx.fillRect(0, 0, w, 54);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('PAINEL DE COMPRAS • DATA CRÍTICA', w / 2, 36);
      // Thumbnail da Foto Real à esquerda
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(22, 74, 165, 215);
      ctx.fillStyle = '#FB923C';
      ctx.fillRect(62, 102, 85, 130);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px Arial';
      ctx.fillText('📷 24 UN • 5d', 104, 266);
    });
    const cBezel = new THREE.Mesh(new RoundedBoxGeometry(1.18, 0.74, 0.06, 3, 0.02), stdMat('#1E293B', 0.35));
    const cDisplay = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.66),
      new THREE.MeshBasicMaterial({map: comprasScreenTex})
    );
    cDisplay.position.z = 0.032;

    const comprasPriceOldBar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.58, 0.14),
      new THREE.MeshBasicMaterial({map: makePillTex('DE: R$ 12,90', '#DC2626')})
    );
    comprasPriceOldBar.position.set(0.2, 0.08, 0.036);

    const comprasPriceNewBar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.58, 0.16),
      new THREE.MeshBasicMaterial({map: makePillTex('POR: R$ 6,99', '#16A34A')})
    );
    comprasPriceNewBar.position.set(0.2, -0.1, 0.038);

    const comprasApprovedBadge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.58, 0.12),
      new THREE.MeshBasicMaterial({map: makePillTex('✓ VALOR APROVADO', '#059669')})
    );
    comprasApprovedBadge.position.set(0.2, -0.25, 0.04);

    comprasMonGroup.add(cStand, cStandBase, cBezel, cDisplay, comprasPriceOldBar, comprasPriceNewBar, comprasApprovedBadge);
    comprasOffice.desk.add(comprasMonGroup);

    // ==================== SETOR 3: ADMINISTRATIVO DE CADASTRO & RPINFO (x = +6.0) ====================
    const cadastroOffice = buildOfficeDeskAndChair(stdMat, '#059669');
    cadastroOffice.group.position.set(5.95, 0, 0);
    // Mesa mais larga para acomodar os 2 monitores lado a lado (Data Crítica + RPInfo)!
    cadastroOffice.desk.scale.x = 1.18;
    scene.add(cadastroOffice.group);

    const cadastroRig = createDesmontandoCharacter({
      shirtColor: '#10B981',
      shortsColor: '#1E293B',
      slipperColor: '#0F766E',
    });
    cadastroRig.root.position.set(0, 0.64, 0.06);
    cadastroOffice.chair.add(cadastroRig.root);

    // Monitor Esquerdo do Cadastro: SISTEMA DE DATA CRÍTICA
    const cadLeftMon = new THREE.Group();
    cadLeftMon.position.set(-0.34, 1.22, -0.12);
    cadLeftMon.rotation.y = 0.12;
    const clTex = makeCanvasTexture(380, 260, (ctx, w, h) => {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(0, 0, w, 48);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 21px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SISTEMA DATA CRÍTICA', w / 2, 32);
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 20px Arial';
      ctx.fillText('QTD: 24 UN  |  R$ 6,99', w / 2, 102);
    });
    const clBezel = new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.56, 0.05, 2, 0.015), stdMat('#1E293B', 0.35));
    const clScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshBasicMaterial({map: clTex}));
    clScreen.position.z = 0.027;
    const cadDcDoneBanner = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.16),
      new THREE.MeshBasicMaterial({map: makePillTex('✓ BAIXA CONCLUÍDA!', '#16A34A')})
    );
    cadDcDoneBanner.position.set(0, -0.09, 0.032);
    const clStand = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.055, 0.34, 12), stdMat('#334155', 0.4, 0.5));
    clStand.position.set(0, -0.32, -0.04);
    const clBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.022, 16), stdMat('#1E293B', 0.4, 0.5));
    clBase.position.set(0, -0.39, -0.02);
    cadLeftMon.add(clStand, clBase, clBezel, clScreen, cadDcDoneBanner);
    cadastroOffice.desk.add(cadLeftMon);

    // Monitor Direito do Cadastro: SISTEMA OFICIAL RPINFO ERP
    const cadRightMon = new THREE.Group();
    cadRightMon.position.set(0.46, 1.22, -0.06);
    cadRightMon.rotation.y = -0.12;
    const crTex = makeCanvasTexture(420, 280, (ctx, w, h) => {
      ctx.fillStyle = '#0B132B';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(0, 0, w, 52);
      ctx.fillStyle = '#0F172A';
      ctx.font = '900 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SISTEMA OFICIAL RPINFO', w / 2, 35);
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 18px Arial';
      ctx.fillText('ERP CADASTRO DE OFERTAS', w / 2, 84);
    });
    const crBezel = new THREE.Mesh(new RoundedBoxGeometry(0.84, 0.6, 0.05, 2, 0.015), stdMat('#0F172A', 0.35));
    const crScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.54), new THREE.MeshBasicMaterial({map: crTex}));
    crScreen.position.z = 0.027;

    const rpinfoPriceRow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.68, 0.12),
      new THREE.MeshBasicMaterial({map: makePillTex('REBAIXA: R$ 6,99', '#2563EB')})
    );
    rpinfoPriceRow.position.set(0, -0.02, 0.032);

    const rpinfoLabelTags: THREE.Mesh[] = [];
    for (let t = 0; t < 3; t++) {
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.12), stickerMat);
      tag.position.set(-0.22 + t * 0.22, -0.17, 0.034);
      rpinfoLabelTags.push(tag);
      cadRightMon.add(tag);
    }

    const crStand = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.055, 0.34, 12), stdMat('#334155', 0.4, 0.5));
    crStand.position.set(0, -0.32, -0.04);
    const crBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.022, 16), stdMat('#0F172A', 0.4, 0.5));
    crBase.position.set(0, -0.39, -0.02);
    cadRightMon.add(crStand, crBase, crBezel, crScreen, rpinfoPriceRow);
    cadastroOffice.desk.add(cadRightMon);

    // Ponte luminosa de sincronização entre o topo dos 2 monitores do Cadastro
    const syncBridgeSpheres: THREE.Mesh[] = [];
    for (let s = 0; s < 5; s++) {
      const sp = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 10, 10),
        new THREE.MeshBasicMaterial({color: '#FACC15'})
      );
      cadastroOffice.desk.add(sp);
      syncBridgeSpheres.push(sp);
    }

    // Rack Servidor RPInfo decorativo no fundo do Cadastro (x = +8.15, z = -2.45)
    const serverRack = new THREE.Mesh(new RoundedBoxGeometry(0.78, 2.05, 0.62, 3, 0.03), stdMat('#1E293B', 0.4, 0.4));
    serverRack.position.set(8.15, 1.02, -2.45);
    for (let l = 0; l < 5; l++) {
      const ledBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.05, 0.02),
        new THREE.MeshBasicMaterial({color: l % 2 === 0 ? '#38BDF8' : '#34D399'})
      );
      ledBar.position.set(8.15, 0.55 + l * 0.28, -2.13);
      worldGroup.add(ledBar);
    }
    worldGroup.add(serverRack);

    // ==================== DUTOS DE DADOS 3D LUMINOSOS CONECTANDO O TOPO DOS MONITORES ====================
    // Duto 1: Topo do Card Mobile da Loja (-5.9, 2.08, -0.25) -> Topo do Monitor de Compras (0.28, 1.66, -0.82)
    const curve1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5.9, 2.08, -0.25),
      new THREE.Vector3(-4.2, 2.82, -0.5),
      new THREE.Vector3(-1.8, 2.86, -0.68),
      new THREE.Vector3(0.28, 1.66, -0.82),
    ]);
    const tube1Mat = new THREE.MeshBasicMaterial({color: '#38BDF8', transparent: true, opacity: 0.48});
    const tube1 = new THREE.Mesh(new THREE.TubeGeometry(curve1, 56, 0.032, 10, false), tube1Mat);
    scene.add(tube1);
    const packets1: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 14), new THREE.MeshBasicMaterial({color: '#FACC15'}));
      scene.add(p);
      packets1.push(p);
    }

    // Duto 2: Topo do Monitor de Compras (0.48, 1.66, -0.82) -> Topo do Monitor Data Crítica no Cadastro (5.75, 1.56, -0.84)
    const curve2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.48, 1.66, -0.82),
      new THREE.Vector3(2.1, 2.82, -0.78),
      new THREE.Vector3(4.1, 2.82, -0.8),
      new THREE.Vector3(5.75, 1.56, -0.84),
    ]);
    const tube2Mat = new THREE.MeshBasicMaterial({color: '#34D399', transparent: true, opacity: 0.48});
    const tube2 = new THREE.Mesh(new THREE.TubeGeometry(curve2, 56, 0.032, 10, false), tube2Mat);
    scene.add(tube2);
    const packets2: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 14), new THREE.MeshBasicMaterial({color: '#4ADE80'}));
      scene.add(p);
      packets2.push(p);
    }

    // Duto 3 (Grande Arco de Retorno!): Topo do Cadastro (6.2, 1.62, -0.78) -> Topo da Impressora da Loja (-3.95, 1.48, -0.88)
    const curve3 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(6.2, 1.62, -0.78),
      new THREE.Vector3(2.8, 3.68, -0.75),
      new THREE.Vector3(-1.4, 3.74, -0.75),
      new THREE.Vector3(-3.95, 1.48, -0.88),
    ]);
    const tube3Mat = new THREE.MeshBasicMaterial({color: '#FACC15', transparent: true, opacity: 0.54});
    const tube3 = new THREE.Mesh(new THREE.TubeGeometry(curve3, 72, 0.038, 10, false), tube3Mat);
    scene.add(tube3);
    const packets3: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 14), new THREE.MeshBasicMaterial({color: '#FFE135'}));
      scene.add(p);
      packets3.push(p);
    }

    addShadow(worldGroup, false, true);
    addShadow(gondola, true, true);
    addShadow(storeLeadRig.root, true, true);
    addShadow(comprasOffice.group, true, true);
    addShadow(cadastroOffice.group, true, true);
    addShadow(printerStand, true, true);
    addShadow(checkoutBase, true, true);

    ctxRef.current = {
      renderer,
      scene,
      camera,
      wallSignsGroup,
      storeClockMin,
      storeLeadRig,
      buyerRig,
      cadastroRig,
      paperLossGroup,
      mobileHoloGroup,
      holoRowQty,
      holoRowDate,
      holoPhotoThumb,
      holoReturnBanner,
      scannerLaserMesh,
      cameraFlashCone,
      batchHaloMat,
      yellowStickers,
      comprasPriceOldBar,
      comprasPriceNewBar,
      comprasApprovedBadge,
      cadDcDoneBanner,
      rpinfoPriceRow,
      rpinfoLabelTags,
      syncBridgeSpheres,
      printerStripMesh,
      printerLedMat,
      checkoutProductGroup,
      checkoutPaidBadge,
      checkoutScanFlash,
      tube1,
      curve1,
      packets1,
      tube1Mat,
      tube2,
      curve2,
      packets2,
      tube2Mat,
      tube3,
      curve3,
      packets3,
      tube3Mat,
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

    // Placas 3D de parede aparecem exclusivamente no Panorama Geral 16:9 (Ato 8B)
    ctx.wallSignsGroup.visible = N >= 2600;

    // Relógio gira acelerado no Ato 1 ("demora demais e gera perda!")
    const fastClock = N >= 120 && N <= 235 ? (N - 120) * 0.35 : 0;
    ctx.storeClockMin.rotation.z = -(N * 0.02 + fastClock);

    // Poses dos 3 personagens (usando sempre o nosso DesmontandoRig.ts oficial!)
    if (N < 380) {
      ctx.storeLeadRig.setPose('standing_worried', N);
      ctx.storeLeadRig.phoneProp.visible = false;
    } else if (N >= 2510) {
      ctx.storeLeadRig.setPose('standing_wave', N);
      ctx.storeLeadRig.phoneProp.visible = false;
    } else {
      ctx.storeLeadRig.setPose('standing_phone', N);
      ctx.storeLeadRig.phoneProp.visible = N >= 495 && N < 2450;
      ctx.storeLeadRig.phoneScreenMat.color.set(N >= C.f_volta ? '#22C55E' : '#38BDF8');
    }

    ctx.buyerRig.setPose('sitting_desk', N);
    ctx.cadastroRig.setPose('sitting_desk', N + 18);

    // Ato 1: Bloco de papel com X vermelho ("anotar no papel demora demais e gera perda")
    const showPaperLoss = N >= 115 && N <= 255;
    ctx.paperLossGroup.visible = showPaperLoss;
    if (showPaperLoss) {
      ctx.paperLossGroup.scale.setScalar(pop3D(N - 115, 14));
      ctx.paperLossGroup.position.y = 1.68 + Math.sin(N * 0.2) * 0.04;
    }

    // Ato 2 & 3 & 6/7: Card Holográfico Mobile da Loja
    const showHoloLaunch = N >= 505 && N <= 935;
    const showHoloReturn = N >= C.f_volta && N <= 2355;
    ctx.mobileHoloGroup.visible = showHoloLaunch || showHoloReturn;
    if (showHoloLaunch) {
      ctx.mobileHoloGroup.scale.setScalar(pop3D(N - 505, 14));
    } else if (showHoloReturn) {
      ctx.mobileHoloGroup.scale.setScalar(pop3D(N - C.f_volta, 14));
    }
    ctx.holoRowQty.visible = N >= C.f_quantidade && N <= 935;
    ctx.holoRowQty.scale.setScalar(pop3D(N - C.f_quantidade, 10));
    ctx.holoRowDate.visible = N >= C.f_vencimento && N <= 935;
    ctx.holoRowDate.scale.setScalar(pop3D(N - C.f_vencimento, 10));
    ctx.holoPhotoThumb.visible = N >= C.f_foto + 4 && N <= 935;
    ctx.holoPhotoThumb.scale.setScalar(pop3D(N - (C.f_foto + 4), 10));
    ctx.holoReturnBanner.visible = showHoloReturn;
    if (showHoloReturn) {
      ctx.holoReturnBanner.scale.setScalar(pop3D(N - C.f_volta - 8, 12));
    }

    // Feixe Laser de Bipar Código de Barras (f_bipa = 535..605)
    ctx.scannerLaserMesh.visible = N >= C.f_bipa - 4 && N <= 610;
    if (ctx.scannerLaserMesh.visible) {
      (ctx.scannerLaserMesh.material as THREE.MeshBasicMaterial).opacity =
        0.38 + Math.abs(Math.sin(N * 0.45)) * 0.35;
    }

    // Flash Branco da Foto Real (f_foto = 842..858)
    ctx.cameraFlashCone.visible = N >= C.f_foto && N <= C.f_foto + 16;
    if (ctx.cameraFlashCone.visible) {
      const fProg = 1 - (N - C.f_foto) / 16;
      (ctx.cameraFlashCone.material as THREE.MeshBasicMaterial).opacity = fProg * 0.85;
    }

    // Halo do Lote na Gôndola + Etiquetas Amarelas Coladas em cada Produto (f_cola = 2357)
    const isTagged = N >= C.f_cola;
    ctx.batchHaloMat.color.set(isTagged ? '#22C55E' : '#F97316');
    ctx.batchHaloMat.opacity = isTagged ? 0.28 : 0.28 + Math.sin(N * 0.18) * 0.12;
    ctx.yellowStickers.forEach((st, idx) => {
      const appearAt = C.f_cola + idx * 8;
      st.visible = N >= appearAt;
      if (st.visible) {
        st.scale.setScalar(pop3D(N - appearAt, 11));
      }
    });

    // Ato 4: Monitor do Setor de Compras (Rebaixa R$ 12,90 -> R$ 6,99 + Valor Aprovado)
    ctx.comprasPriceOldBar.visible = N >= C.f_compras;
    ctx.comprasPriceNewBar.visible = N >= C.f_rebaixa;
    if (ctx.comprasPriceNewBar.visible) {
      ctx.comprasPriceNewBar.scale.setScalar(pop3D(N - C.f_rebaixa, 14));
    }
    ctx.comprasApprovedBadge.visible = N >= C.f_aprovado;
    if (ctx.comprasApprovedBadge.visible) {
      ctx.comprasApprovedBadge.scale.setScalar(pop3D(N - C.f_aprovado, 12));
    }

    // Ato 5 & 6: Monitores Duplos do Cadastro (Data Crítica + RPInfo ERP)
    ctx.rpinfoPriceRow.visible = N >= C.f_rpinfo;
    if (ctx.rpinfoPriceRow.visible) {
      ctx.rpinfoPriceRow.scale.setScalar(pop3D(N - C.f_rpinfo, 12));
    }
    ctx.rpinfoLabelTags.forEach((tag, idx) => {
      const tAt = C.f_etiquetas_cad + idx * 7;
      tag.visible = N >= tAt;
      if (tag.visible) {
        tag.scale.setScalar(pop3D(N - tAt, 10));
      }
    });
    ctx.cadDcDoneBanner.visible = N >= C.f_baixa;
    if (ctx.cadDcDoneBanner.visible) {
      ctx.cadDcDoneBanner.scale.setScalar(pop3D(N - C.f_baixa, 12));
    }

    // Partículas da ponte entre o topo do Data Crítica e o topo do RPInfo durante Ato 5
    const showSyncBridge = N >= C.f_rpinfo - 18 && N <= C.f_baixa + 10;
    ctx.syncBridgeSpheres.forEach((sp, idx) => {
      sp.visible = showSyncBridge;
      if (showSyncBridge) {
        const p = ((N * 0.045 + idx / ctx.syncBridgeSpheres.length) % 1);
        sp.position.set(-0.28 + p * 0.68, 1.54 + Math.sin(p * Math.PI) * 0.14, -0.06);
      }
    });

    // Ato 7: Impressora Térmica da Loja liberando fila de etiquetas (f_disponiveis = 2314)
    const labelsReady = N >= C.f_disponiveis - 40;
    ctx.printerLedMat.color.set(labelsReady ? '#22C55E' : '#F59E0B');
    ctx.printerStripMesh.visible = labelsReady;
    if (labelsReady) {
      const slide = clamp01((N - (C.f_disponiveis - 40)) / 35);
      ctx.printerStripMesh.scale.set(1, 1, 0.2 + slide * 0.8);
      ctx.printerStripMesh.position.z = 0.16 + slide * 0.18;
    }

    // Ato 8A: Produto com Etiqueta Amarela passando no Caixa PDV (f_caixa = 2512)
    ctx.checkoutProductGroup.visible = N >= 2470;
    ctx.checkoutPaidBadge.visible = N >= C.f_caixa - 6;
    if (ctx.checkoutPaidBadge.visible) {
      ctx.checkoutPaidBadge.scale.setScalar(pop3D(N - (C.f_caixa - 6), 10));
    }
    if (ctx.checkoutProductGroup.visible) {
      const beltT = clamp01((N - 2475) / 65);
      ctx.checkoutProductGroup.position.x = 0.42 - beltT * 0.78;
    }
    const scanGlow = N >= C.f_caixa - 6 && N <= C.f_caixa + 28;
    (ctx.checkoutScanFlash.material as THREE.MeshBasicMaterial).opacity = scanGlow
      ? 0.45 * Math.sin(clamp01((N - (C.f_caixa - 6)) / 34) * Math.PI)
      : 0;

    // Animação dos 3 Dutos de Dados 3D (visíveis apenas durante o tráfego ativo e no Panorama Final!)
    const isFinale = N >= 2605;

    const active1 = (N >= C.f_envia && N <= 1020) || isFinale;
    ctx.tube1.visible = active1;
    ctx.packets1.forEach((pk, i) => {
      pk.visible = active1;
      if (active1) {
        const t = isFinale
          ? ((N * 0.018 + i / ctx.packets1.length) % 1)
          : clamp01((N - C.f_envia - i * 8) / 110);
        pk.position.copy(ctx.curve1.getPointAt(t));
      }
    });

    const active2 = (N >= C.f_aprovado + 12 && N <= 1560) || isFinale;
    ctx.tube2.visible = active2;
    ctx.packets2.forEach((pk, i) => {
      pk.visible = active2;
      if (active2) {
        const t = isFinale
          ? ((N * 0.018 + i / ctx.packets2.length) % 1)
          : clamp01((N - (C.f_aprovado + 12) - i * 8) / 110);
        pk.position.copy(ctx.curve2.getPointAt(t));
      }
    });

    const active3 = (N >= C.f_baixa + 35 && N <= 2255) || isFinale;
    ctx.tube3.visible = active3;
    ctx.packets3.forEach((pk, i) => {
      pk.visible = active3;
      if (active3) {
        const t = isFinale
          ? ((N * 0.015 + i / ctx.packets3.length) % 1)
          : clamp01((N - (C.f_baixa + 35) - i * 9) / 145);
        pk.position.copy(ctx.curve3.getPointAt(t));
      }
    });

    ctx.renderer.render(ctx.scene, ctx.camera);
  }, [N]);

  return (
    <canvas
      ref={canvasRef}
      width={DC_W}
      height={DC_H}
      style={{width: DC_W, height: DC_H, display: 'block'}}
    />
  );
};

