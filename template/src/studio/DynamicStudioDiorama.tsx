import React, {useLayoutEffect, useRef} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {clamp01, easeInOutPow, BEZ_SCALE_IN} from '../common';
import {
  createDesmontandoCharacter,
  createBeveledArmchair,
  createRibbedIceBucket,
  DesmontandoCharacterRig,
} from '../shots/G1/DesmontandoRig';
import {
  StudioProjectSpec,
  StudioSceneSpec,
  getCanvasSize,
} from './StudioSchema';
import {
  animateCustomVisual3DScene,
  buildCustomVisual3DScene,
  type Custom3DSceneRuntime,
  resolveSceneCustomVisual,
} from './StudioCustomVisuals';

const easeCam = easeInOutPow(2.3);
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
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function drawDynamicScreenCanvas(
  canvas: HTMLCanvasElement,
  header: string,
  line1: string,
  line2: string,
  accentHex: string,
  isSuccess: boolean
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, w, 58);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 23px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(header.slice(0, 28), w / 2, 30);

  if (line1) {
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(26, 82, w - 52, 74);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 82, w - 52, 74);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '900 26px Arial, sans-serif';
    ctx.fillText(line1.slice(0, 26), w / 2, 120);
  }

  if (line2) {
    ctx.fillStyle = isSuccess ? '#16A34A' : '#D97706';
    ctx.fillRect(26, 174, w - 52, 78);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 27px Arial, sans-serif';
    ctx.fillText(line2.slice(0, 26), w / 2, 214);
  }
}

function drawPresenterBoardCanvas(
  canvas: HTMLCanvasElement,
  header: string,
  stepLabel: string,
  progress01: number,
  line1: string,
  line2: string,
  accentHex: string,
  isAlert: boolean,
  isDone: boolean
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, w, h);

  // Barra superior do Telão 3D
  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, w, 78);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 30px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(header.slice(0, 28), 34, 40);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
  ctx.fillRect(w - 220, 18, 190, 42);
  ctx.fillStyle = '#FACC15';
  ctx.font = '900 21px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(stepLabel.slice(0, 16), w - 125, 40);

  // Barra de progresso da explicação
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(34, 100, w - 68, 16);
  ctx.fillStyle = isDone ? '#22C55E' : '#FACC15';
  ctx.fillRect(34, 100, Math.max(24, (w - 68) * Math.min(1, Math.max(0.08, progress01))), 16);

  // Card principal (Linha 1)
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(34, 140, w - 68, 122);
  ctx.strokeStyle = isAlert ? '#EF4444' : '#38BDF8';
  ctx.lineWidth = 4;
  ctx.strokeRect(34, 140, w - 68, 122);
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '900 38px Arial, sans-serif';
  ctx.fillText((line1 || 'PONTO PRINCIPAL').slice(0, 28), w / 2, 202);

  // Card de destaque inferior (Linha 2)
  ctx.fillStyle = isAlert ? '#DC2626' : isDone ? '#16A34A' : '#D97706';
  ctx.fillRect(34, 286, w - 68, 122);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 38px Arial, sans-serif';
  ctx.fillText((line2 || 'EM DESTAQUE ✓').slice(0, 28), w / 2, 348);
}

interface SectorRuntime {
  xCenter: number;
  rig: DesmontandoCharacterRig;
  screenCanvas: HTMLCanvasElement;
  screenTex: THREE.CanvasTexture;
  lastScreenKey: string;
  // Props específicos opcionais do setor
  paperLossGroup?: THREE.Group;
  mobileHoloGroup?: THREE.Group;
  scannerLaser?: THREE.Mesh;
  cameraFlash?: THREE.Mesh;
  yellowStickers?: THREE.Mesh[];
  batchHaloMat?: THREE.MeshBasicMaterial;
  printerStrip?: THREE.Mesh;
  checkoutProd?: THREE.Group;
  erpSyncSpheres?: THREE.Mesh[];
  erpTags?: THREE.Mesh[];
}

interface ConduitRuntime {
  fromIdx: number;
  toIdx: number;
  tube: THREE.Mesh;
  curve: THREE.CatmullRomCurve3;
  packets: THREE.Mesh[];
}

export const DynamicStudioDiorama: React.FC<{
  project: StudioProjectSpec;
  N: number;
}> = ({project, N}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const {width, height} = getCanvasSize(project.aspectRatio);
  const isWide = project.aspectRatio === '16:9';

  // Chave estrutural que determina quando reconstruir a cena Three.js
  const structureKey = JSON.stringify({
    projectId: project.id,
    projectName: project.name,
    modelId: project.modelId,
    aspectRatio: project.aspectRatio,
    sectors: project.sectors.map((s) => ({
      id: s.id,
      title: s.title,
      stationType: s.stationType,
      shirtColor: s.shirtColor,
      shortsColor: s.shortsColor,
      wallAccentColor: s.wallAccentColor,
      monitorHeader: s.monitorHeader,
    })),
    scenesVisualSig: project.scenes.map((sc) => ({
      id: sc.id,
      h: sc.headline,
      lb: sc.leftBadge,
      rb: sc.rightBadge,
      n: sc.narration.slice(0, 48),
      cv: sc.customVisual,
    })),
  });

  const runtimeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    clockMinHand?: THREE.Object3D;
    wallSignsGroup?: THREE.Group;
    sectors: SectorRuntime[];
    conduits: ConduitRuntime[];
    customScenes?: Custom3DSceneRuntime[];
    isLegacyAcPreset?: boolean;
    // Props exclusivos do modelo Bancada & Maquete 3D / Preset Legado
    roomCharRig?: DesmontandoCharacterRig;
    armchairGroup?: THREE.Group;
    iceBucketGroup?: THREE.Group;
    iceCubesGroup?: THREE.Group;
    fanGroup?: THREE.Group;
    fanBlades?: THREE.Group;
    windParticles?: Array<{mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial}>;
    copperCoilGroup?: THREE.Group;
    coilBalls?: THREE.Mesh[];
    moleculesGroup?: THREE.Group;
    magnetronGroup?: THREE.Group;
    waveBalls?: THREE.Mesh[];
    metalBoxGroup?: THREE.Group;
    applianceGroup?: THREE.Group;
    chimeRings?: THREE.Mesh[];
    // Props exclusivos do modelo Estúdio Apresentador & Telão 3D
    presCharRig?: DesmontandoCharacterRig;
    presCanvas?: HTMLCanvasElement;
    presTex?: THREE.CanvasTexture;
    presLastKey?: string;
    presBars?: THREE.Mesh[];
    presAlertOrb?: THREE.Mesh;
    presRings?: THREE.Mesh[];
  } | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#66B2F2');
    const camera = new THREE.PerspectiveCamera(isWide ? 40 : 47, width / height, 0.1, 120);

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

    const hemiLight = new THREE.HemisphereLight('#FFFDF9', '#C79B6B', 1.18);
    hemiLight.position.set(0, 14, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#FFF5E0', 1.65);
    sunLight.position.set(-5.5, 12.5, 8.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 42;
    sunLight.shadow.camera.left = -16;
    sunLight.shadow.camera.right = 16;
    sunLight.shadow.camera.top = 10;
    sunLight.shadow.camera.bottom = -10;
    sunLight.shadow.bias = -0.0007;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight('#D8EEFF', 0.45);
    fillLight.position.set(7, 6, 8);
    scene.add(fillLight);

    const sectorsRuntime: SectorRuntime[] = [];
    const conduitsRuntime: ConduitRuntime[] = [];

    if (project.modelId === 'fluxo_corporativo') {
      const secs = project.sectors.length > 0 ? project.sectors : [
        {
          id: 'default-sec',
          title: '1. OPERAÇÃO',
          stationType: 'office_single' as const,
          shirtColor: '#F0CA4D',
          shortsColor: '#334155',
          wallAccentColor: '#2563EB',
          monitorHeader: 'SISTEMA',
        },
      ];
      const K = secs.length;
      const spacing = 6.2;
      const totalWidth = Math.max(7.2, K * spacing + 0.6);

      const worldGroup = new THREE.Group();
      scene.add(worldGroup);

      const slabBase = new THREE.Mesh(
        new RoundedBoxGeometry(totalWidth + 0.6, 0.34, 6.8, 3, 0.05),
        stdMat('#475569', 0.75)
      );
      slabBase.position.set(0, -0.17, -0.2);
      worldGroup.add(slabBase);

      const wallSignsGroup = new THREE.Group();
      worldGroup.add(wallSignsGroup);

      let storeClockMinRef: THREE.Object3D | undefined;

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
        ctx.font = '900 26px Arial';
        ctx.fillText('OK ✓', w / 2, 56);
      });
      const stickerMat = new THREE.MeshBasicMaterial({map: stickerTex});

      secs.forEach((sec, idx) => {
        const cx = (idx - (K - 1) / 2) * spacing;
        const pLight = new THREE.PointLight('#FFF8EC', 0.9, 13, 1.2);
        pLight.position.set(cx, 3.8, 2.2);
        scene.add(pLight);

        // Piso por tipo de estação
        const floorHex =
          sec.stationType === 'supermarket_aisle'
            ? '#F3EFE6'
            : sec.stationType === 'office_single'
            ? '#C98D55'
            : sec.stationType === 'office_dual_erp'
            ? '#E2E8F0'
            : '#CBD5E1';
        const floor = new THREE.Mesh(new THREE.BoxGeometry(spacing, 0.045, 6.5), stdMat(floorHex, 0.6));
        floor.position.set(cx, 0.022, -0.2);
        worldGroup.add(floor);

        // Parede de fundo + faixa superior
        const wallHex = sec.stationType === 'office_single' ? '#EFE6D5' : '#F8FAFC';
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(spacing, 3.85, 0.24), stdMat(wallHex, 0.82));
        backWall.position.set(cx, 1.92, -3.25);
        const topStripe = new THREE.Mesh(
          new THREE.BoxGeometry(spacing, 0.42, 0.28),
          stdMat(sec.wallAccentColor || '#2563EB', 0.5)
        );
        topStripe.position.set(cx, 3.58, -3.23);
        worldGroup.add(backWall, topStripe);

        // Placa 3D de parede (visível no panorama geral)
        const signTex = makeCanvasTexture(640, 128, (ctx, w, h) => {
          ctx.fillStyle = sec.wallAccentColor || '#1E40AF';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 10;
          ctx.strokeRect(5, 5, w - 10, h - 10);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 35px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sec.title.slice(0, 26), w / 2, h / 2 + 2);
        });
        const signGrp = new THREE.Group();
        signGrp.position.set(cx, 2.72, -3.08);
        const signBack = new THREE.Mesh(new RoundedBoxGeometry(2.68, 0.52, 0.07, 2, 0.02), stdMat('#1E293B', 0.5));
        const signFace = new THREE.Mesh(new THREE.PlaneGeometry(2.58, 0.46), new THREE.MeshBasicMaterial({map: signTex}));
        signFace.position.z = 0.038;
        signGrp.add(signBack, signFace);
        wallSignsGroup.add(signGrp);

        // Divisória lateral direita com vidro
        if (idx < K - 1) {
          const divX = cx + spacing * 0.5;
          const lowWall = new THREE.Mesh(new RoundedBoxGeometry(0.22, 1.35, 5.8, 2, 0.03), stdMat('#CBD5E1', 0.65));
          lowWall.position.set(divX, 0.68, -0.35);
          const glass = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 1.35, 5.2),
            new THREE.MeshPhysicalMaterial({color: '#BAE6FD', transparent: true, opacity: 0.24, roughness: 0.1})
          );
          glass.position.set(divX, 2.02, -0.35);
          worldGroup.add(lowWall, glass);
        }

        // Canvas dinâmico da tela principal desse setor
        const screenCanvas = document.createElement('canvas');
        screenCanvas.width = 440;
        screenCanvas.height = 290;
        drawDynamicScreenCanvas(
          screenCanvas,
          sec.monitorHeader || sec.title,
          'PRONTO',
          'ATIVO ✓',
          sec.wallAccentColor || '#0284C7',
          true
        );
        const screenTex = new THREE.CanvasTexture(screenCanvas);
        screenTex.colorSpace = THREE.SRGBColorSpace;

        const rig = createDesmontandoCharacter({
          shirtColor: sec.shirtColor || '#F0CA4D',
          shortsColor: sec.shortsColor || '#334155',
        });

        const secRt: SectorRuntime = {
          xCenter: cx,
          rig,
          screenCanvas,
          screenTex,
          lastScreenKey: '',
        };

        if (sec.stationType === 'supermarket_aisle' || sec.stationType === 'warehouse_dock') {
          const isWarehouse = sec.stationType === 'warehouse_dock';
          rig.hardHat.visible = isWarehouse;
          rig.root.position.set(cx - 0.52, 1.0, -0.55);
          rig.root.rotation.y = 0.58;
          scene.add(rig.root);

          // Relógio na parede do 1º setor
          if (idx === 0) {
            const clk = new THREE.Group();
            clk.position.set(cx - 2.0, 2.72, -3.08);
            const cRim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.07, 24), stdMat('#1E293B', 0.45));
            cRim.rotation.x = Math.PI / 2;
            const cFace = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 24), stdMat('#FFFFFF', 0.35));
            cFace.rotation.x = Math.PI / 2;
            const minGrp = new THREE.Group();
            const minBar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.2, 0.02), stdMat('#EF4444', 0.4));
            minBar.position.y = 0.08;
            minGrp.position.z = 0.055;
            minGrp.add(minBar);
            clk.add(cRim, cFace, minGrp);
            worldGroup.add(clk);
            storeClockMinRef = minGrp;
          }

          // Gôndola / Estante de Produtos
          const gondola = new THREE.Group();
          gondola.position.set(cx + 0.82, 0, -1.12);
          gondola.rotation.y = -0.18;
          const gBack = new THREE.Mesh(new RoundedBoxGeometry(1.86, 2.22, 0.12, 3, 0.03), stdMat('#F8FAFC', 0.5));
          gBack.position.set(0, 1.12, -0.32);
          const gTop = new THREE.Mesh(
            new RoundedBoxGeometry(1.9, 0.24, 0.48, 3, 0.03),
            stdMat(sec.wallAccentColor || '#DC2626', 0.45)
          );
          gTop.position.set(0, 2.2, -0.14);
          gondola.add(gBack, gTop);

          [0.24, 0.88, 1.52].forEach((sy) => {
            const sh = new THREE.Mesh(new RoundedBoxGeometry(1.82, 0.06, 0.62, 2, 0.015), stdMat('#E2E8F0', 0.45));
            sh.position.set(0, sy, -0.04);
            gondola.add(sh);
          });

          const boxColors = ['#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4'];
          for (let i = 0; i < 5; i++) {
            const b1 = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.34, 0.22, 2, 0.025), stdMat(boxColors[i], 0.5));
            b1.position.set(-0.64 + i * 0.32, 0.44, 0.02);
            const b2 = new THREE.Mesh(
              new RoundedBoxGeometry(0.22, 0.32, 0.2, 2, 0.025),
              stdMat(boxColors[(i + 2) % 5], 0.5)
            );
            b2.position.set(-0.64 + i * 0.32, 1.71, 0.02);
            gondola.add(b1, b2);
          }

          const batchHaloMat = new THREE.MeshBasicMaterial({color: '#F97316', transparent: true, opacity: 0.32});
          const batchHalo = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.46, 0.4, 3, 0.05), batchHaloMat);
          batchHalo.position.set(0, 1.14, 0.04);
          gondola.add(batchHalo);
          secRt.batchHaloMat = batchHaloMat;

          const stickers: THREE.Mesh[] = [];
          for (let i = 0; i < 6; i++) {
            const prod = new THREE.Group();
            prod.position.set(-0.68 + i * 0.27, 1.11, 0.06);
            const carton = new THREE.Mesh(
              new RoundedBoxGeometry(0.21, 0.38, 0.2, 3, 0.025),
              stdMat(isWarehouse ? '#D97706' : '#FB923C', 0.48)
            );
            const st = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.11), stickerMat);
            st.position.set(0, 0.02, 0.106);
            st.visible = false;
            stickers.push(st);
            prod.add(carton, st);
            gondola.add(prod);
          }
          secRt.yellowStickers = stickers;
          addShadow(gondola, true, true);
          scene.add(gondola);

          // Card Holográfico Mobile ao lado do personagem
          const holoGrp = new THREE.Group();
          holoGrp.position.set(cx + 0.06, 1.66, -0.2);
          holoGrp.rotation.y = 0.1;
          const holoBack = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.52, 0.04, 2, 0.015), stdMat('#0F172A', 0.4));
          const holoFace = new THREE.Mesh(
            new THREE.PlaneGeometry(0.61, 0.47),
            new THREE.MeshBasicMaterial({map: screenTex})
          );
          holoFace.position.z = 0.024;
          holoGrp.add(holoBack, holoFace);
          scene.add(holoGrp);
          secRt.mobileHoloGroup = holoGrp;

          // Bloco de papel com X vermelho
          const paperGrp = new THREE.Group();
          paperGrp.position.set(cx + 0.05, 1.65, -0.24);
          const clipB = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.46, 0.04, 2, 0.01), stdMat('#F8FAFC', 0.6));
          const xb1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.05), new THREE.MeshBasicMaterial({color: '#EF4444'}));
          xb1.rotation.z = Math.PI / 4;
          xb1.position.z = 0.025;
          const xb2 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.05), new THREE.MeshBasicMaterial({color: '#EF4444'}));
          xb2.rotation.z = -Math.PI / 4;
          xb2.position.z = 0.025;
          paperGrp.add(clipB, xb1, xb2);
          scene.add(paperGrp);
          secRt.paperLossGroup = paperGrp;

          // Laser Scanner & Camera Flash
          const laser = new THREE.Mesh(
            new THREE.ConeGeometry(0.24, 1.0, 14, 1, true),
            new THREE.MeshBasicMaterial({color: '#EF4444', transparent: true, opacity: 0.55, side: THREE.DoubleSide})
          );
          laser.rotation.z = Math.PI / 2 - 0.12;
          laser.position.set(cx + 0.25, 1.32, -0.65);
          scene.add(laser);
          secRt.scannerLaser = laser;

          const flash = new THREE.Mesh(
            new THREE.ConeGeometry(0.44, 1.1, 16, 1, true),
            new THREE.MeshBasicMaterial({color: '#FFFFFF', transparent: true, opacity: 0.78, side: THREE.DoubleSide})
          );
          flash.rotation.z = Math.PI / 2 - 0.1;
          flash.position.set(cx + 0.28, 1.32, -0.65);
          scene.add(flash);
          secRt.cameraFlash = flash;

          // Impressora Térmica de Etiquetas à direita da gôndola
          const printerStand = new THREE.Group();
          printerStand.position.set(cx + 2.02, 0, -0.88);
          printerStand.rotation.y = -0.26;
          const pPed = new THREE.Mesh(new RoundedBoxGeometry(0.64, 0.9, 0.54, 3, 0.03), stdMat('#CBD5E1', 0.55));
          pPed.position.y = 0.45;
          const pBody = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.32, 0.42, 3, 0.04), stdMat('#1E293B', 0.4));
          pBody.position.y = 1.06;
          const pStrip = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.015, 0.4), stickerMat);
          pStrip.position.set(0, 0.96, 0.26);
          pStrip.rotation.x = 0.42;
          printerStand.add(pPed, pBody, pStrip);
          addShadow(printerStand, true, true);
          scene.add(printerStand);
          secRt.printerStrip = pStrip;

          addShadow(rig.root, true, true);
        } else {
          // Estação Administrativa (Mesa + Cadeira + 1 Monitor ou 2 Monitores ERP)
          const officeGrp = new THREE.Group();
          officeGrp.position.set(cx, 0, 0);
          scene.add(officeGrp);

          const chair = new THREE.Group();
          chair.position.set(-0.78, 0, -0.55);
          chair.rotation.y = 0.65;
          const baseStar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.05, 16), stdMat('#1E293B', 0.4, 0.5));
          baseStar.position.y = 0.04;
          const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.48, 12), stdMat('#64748B', 0.3, 0.7));
          piston.position.y = 0.28;
          const seat = new THREE.Mesh(
            new RoundedBoxGeometry(0.62, 0.11, 0.58, 3, 0.04),
            stdMat(sec.wallAccentColor || '#2563EB', 0.6)
          );
          seat.position.y = 0.54;
          const backrest = new THREE.Mesh(
            new RoundedBoxGeometry(0.56, 0.68, 0.11, 3, 0.04),
            stdMat(sec.wallAccentColor || '#2563EB', 0.6)
          );
          backrest.position.set(0, 0.92, -0.25);
          backrest.rotation.x = -0.08;
          chair.add(baseStar, piston, seat, backrest);
          officeGrp.add(chair);

          rig.root.position.set(0, 0.64, 0.06);
          chair.add(rig.root);

          const isDual = sec.stationType === 'office_dual_erp';
          const desk = new THREE.Group();
          desk.position.set(0.22, 0, -0.68);
          desk.rotation.y = -0.26;
          const deskW = isDual ? 2.08 : 1.78;
          const top = new THREE.Mesh(new RoundedBoxGeometry(deskW, 0.08, 0.92, 3, 0.025), stdMat('#D9A066', 0.58));
          top.position.y = 0.78;
          desk.add(top);

          [
            [-deskW * 0.44, -0.36],
            [deskW * 0.44, -0.36],
            [-deskW * 0.44, 0.36],
            [deskW * 0.44, 0.36],
          ].forEach(([lx, lz]) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.76, 12), stdMat('#334155', 0.4, 0.5));
            leg.position.set(lx, 0.38, lz);
            desk.add(leg);
          });

          const kb = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.025, 0.16, 2, 0.008), stdMat('#1E293B', 0.4));
          kb.position.set(-0.22, 0.835, 0.16);
          kb.rotation.y = 0.18;
          desk.add(kb);
          officeGrp.add(desk);

          if (!isDual) {
            const mon = new THREE.Group();
            mon.position.set(0.14, 1.24, -0.12);
            const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.38, 12), stdMat('#334155', 0.4, 0.5));
            stand.position.set(0, -0.34, -0.045);
            const sBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.025, 18), stdMat('#1E293B', 0.4, 0.5));
            sBase.position.set(0, -0.41, -0.02);
            const bezel = new THREE.Mesh(new RoundedBoxGeometry(1.16, 0.74, 0.06, 3, 0.02), stdMat('#1E293B', 0.35));
            const face = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.66), new THREE.MeshBasicMaterial({map: screenTex}));
            face.position.z = 0.033;
            mon.add(stand, sBase, bezel, face);
            desk.add(mon);
          } else {
            // Monitor Esquerdo (Sistema Origem) + Monitor Direito (ERP / RPInfo)
            const leftMon = new THREE.Group();
            leftMon.position.set(-0.38, 1.22, -0.12);
            leftMon.rotation.y = 0.12;
            const lStand = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.055, 0.34, 12), stdMat('#334155', 0.4, 0.5));
            lStand.position.set(0, -0.32, -0.04);
            const lBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.022, 16), stdMat('#1E293B', 0.4, 0.5));
            lBase.position.set(0, -0.39, -0.02);
            const lBezel = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.56, 0.05, 2, 0.015), stdMat('#1E293B', 0.35));
            const lFace = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.5), new THREE.MeshBasicMaterial({map: screenTex}));
            lFace.position.z = 0.028;
            leftMon.add(lStand, lBase, lBezel, lFace);
            desk.add(leftMon);

            const erpTex = makeCanvasTexture(420, 280, (ctx, w, h) => {
              ctx.fillStyle = '#0B132B';
              ctx.fillRect(0, 0, w, h);
              ctx.fillStyle = '#F59E0B';
              ctx.fillRect(0, 0, w, 54);
              ctx.fillStyle = '#0F172A';
              ctx.font = '900 23px Arial';
              ctx.textAlign = 'center';
              ctx.fillText((sec.monitorHeader || 'SISTEMA ERP').slice(0, 26), w / 2, 35);
              ctx.fillStyle = '#2563EB';
              ctx.fillRect(28, 76, w - 56, 56);
              ctx.fillStyle = '#FFFFFF';
              ctx.font = 'bold 22px Arial';
              ctx.fillText('INTEGRADO EM TEMPO REAL', w / 2, 112);
            });
            const rightMon = new THREE.Group();
            rightMon.position.set(0.48, 1.22, -0.06);
            rightMon.rotation.y = -0.12;
            const rStand = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.055, 0.34, 12), stdMat('#334155', 0.4, 0.5));
            rStand.position.set(0, -0.32, -0.04);
            const rBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.022, 16), stdMat('#0F172A', 0.4, 0.5));
            rBase.position.set(0, -0.39, -0.02);
            const rBezel = new THREE.Mesh(new RoundedBoxGeometry(0.84, 0.6, 0.05, 2, 0.015), stdMat('#0F172A', 0.35));
            const rFace = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.54), new THREE.MeshBasicMaterial({map: erpTex}));
            rFace.position.z = 0.028;
            rightMon.add(rStand, rBase, rBezel, rFace);

            const erpTags: THREE.Mesh[] = [];
            for (let t = 0; t < 3; t++) {
              const tg = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.12), stickerMat);
              tg.position.set(-0.22 + t * 0.22, -0.15, 0.033);
              rightMon.add(tg);
              erpTags.push(tg);
            }
            secRt.erpTags = erpTags;
            desk.add(rightMon);

            const syncSpheres: THREE.Mesh[] = [];
            for (let s = 0; s < 5; s++) {
              const sp = new THREE.Mesh(
                new THREE.SphereGeometry(0.032, 10, 10),
                new THREE.MeshBasicMaterial({color: '#FACC15'})
              );
              desk.add(sp);
              syncSpheres.push(sp);
            }
            secRt.erpSyncSpheres = syncSpheres;

            // Rack Servidor ERP no canto direito
            const rack = new THREE.Mesh(new RoundedBoxGeometry(0.76, 2.02, 0.6, 3, 0.03), stdMat('#1E293B', 0.4, 0.4));
            rack.position.set(cx + 2.15, 1.01, -2.45);
            worldGroup.add(rack);
          }

          addShadow(officeGrp, true, true);
        }

        sectorsRuntime.push(secRt);
      });

      // Cria dutos luminosos CatmullRomCurve3 para todos os pares de setores conectados
      for (let a = 0; a < K; a++) {
        for (let b = 0; b < K; b++) {
          if (a === b) continue;
          const x1 = sectorsRuntime[a].xCenter + (a < b ? 0.25 : -0.25);
          const x2 = sectorsRuntime[b].xCenter + (a < b ? -0.25 : 0.25);
          const dist = Math.abs(x2 - x1);
          const peakY = dist > 7 ? 3.68 : 2.82;
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(x1, 1.65, -0.78),
            new THREE.Vector3(x1 + (x2 - x1) * 0.3, peakY, -0.72),
            new THREE.Vector3(x1 + (x2 - x1) * 0.7, peakY, -0.72),
            new THREE.Vector3(x2, 1.65, -0.78),
          ]);
          const col = a < b ? '#38BDF8' : '#FACC15';
          const tubeMat = new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0.48});
          const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 56, 0.034, 10, false), tubeMat);
          scene.add(tube);
          const packets: THREE.Mesh[] = [];
          for (let p = 0; p < 6; p++) {
            const sp = new THREE.Mesh(
              new THREE.SphereGeometry(0.072, 12, 12),
              new THREE.MeshBasicMaterial({color: '#FFE135'})
            );
            scene.add(sp);
            packets.push(sp);
          }
          conduitsRuntime.push({fromIdx: a, toIdx: b, tube, curve, packets});
        }
      }

      addShadow(worldGroup, false, true);

      runtimeRef.current = {
        renderer,
        scene,
        camera,
        clockMinHand: storeClockMinRef,
        wallSignsGroup,
        sectors: sectorsRuntime,
        conduits: conduitsRuntime,
      };
    } else if (project.modelId === 'estudio_apresentador') {
      // ==================== MODELO 3: ESTÚDIO APRESENTADOR & TELÃO 3D ====================
      const studioLight = new THREE.PointLight('#FFF8EB', 1.4, 16, 1.15);
      studioLight.position.set(0, 3.9, 2.6);
      scene.add(studioLight);

      const stageGroup = new THREE.Group();
      scene.add(stageGroup);

      const firstSec = project.sectors[0];
      const accentColor = firstSec?.wallAccentColor || '#2563EB';

      const floorBase = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.25, 6.8), stdMat('#7C4D25', 0.8));
      floorBase.position.set(0, -0.125, 0);
      stageGroup.add(floorBase);

      const plankColors = ['#C68952', '#BA7D47', '#CE945C', '#B47640'];
      for (let i = 0; i < 14; i++) {
        const zPos = -3.0 + i * 0.46;
        const plank = new THREE.Mesh(
          new THREE.BoxGeometry(8.6, 0.025, 0.435),
          stdMat(plankColors[i % plankColors.length], 0.66)
        );
        plank.position.set(0, 0.012, zPos);
        stageGroup.add(plank);
      }

      const wallBack = new THREE.Mesh(new THREE.BoxGeometry(8.8, 4.3, 0.24), stdMat('#F1ECE1', 0.84));
      wallBack.position.set(0, 2.15, -2.65);
      const topTrim = new THREE.Mesh(new THREE.BoxGeometry(8.82, 0.22, 0.28), stdMat(accentColor, 0.5));
      topTrim.position.set(0, 4.18, -2.63);
      stageGroup.add(wallBack, topTrim);

      // Tapete circular do apresentador
      const rug = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.028, 36), stdMat('#F3BC68', 0.85));
      rug.position.set(-0.92, 0.02, -0.35);
      const rugRim = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.02, 36), stdMat('#DE7A47', 0.85));
      rugRim.position.set(-0.92, 0.014, -0.35);
      stageGroup.add(rugRim, rug);

      // Vaso decorativo low-poly à esquerda
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.38, 18), stdMat('#C26D3A', 0.7));
      pot.position.set(-2.25, 0.19, -1.55);
      const bush1 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), stdMat('#22C55E', 0.65));
      bush1.position.set(-2.25, 0.56, -1.55);
      const bush2 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), stdMat('#16A34A', 0.65));
      bush2.position.set(-2.12, 0.76, -1.48);
      stageGroup.add(pot, bush1, bush2);

      // Boneco Oficial Apresentador (pivô do quadril em y = 1.0 para ficar em pé sobre o tapete)
      const presCharRig = createDesmontandoCharacter({
        shirtColor: firstSec?.shirtColor || '#F0CA4D',
        shortsColor: firstSec?.shortsColor || '#334155',
      });
      presCharRig.root.position.set(-0.92, 1.0, -0.35);
      presCharRig.root.rotation.y = 0.28;
      scene.add(presCharRig.root);

      // Grande Telão 3D Interativo com pedestal duplo
      const boardGroup = new THREE.Group();
      boardGroup.position.set(0.66, 1.66, -1.05);
      const boardBezel = new THREE.Mesh(
        new RoundedBoxGeometry(2.72, 1.66, 0.11, 4, 0.04),
        stdMat('#1E293B', 0.35, 0.25)
      );
      const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.65, 14), stdMat('#334155', 0.4));
      legL.position.set(-0.85, -0.82, -0.04);
      const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.65, 14), stdMat('#334155', 0.4));
      legR.position.set(0.85, -0.82, -0.04);

      const presCanvas = document.createElement('canvas');
      presCanvas.width = 768;
      presCanvas.height = 448;
      drawPresenterBoardCanvas(
        presCanvas,
        firstSec?.monitorHeader || 'APRESENTAÇÃO 3D',
        'ETAPA 1',
        0.2,
        'BEM-VINDO!',
        'VAMOS COMEÇAR',
        accentColor,
        false,
        false
      );
      const presTex = new THREE.CanvasTexture(presCanvas);
      presTex.colorSpace = THREE.SRGBColorSpace;
      const screenFace = new THREE.Mesh(
        new THREE.PlaneGeometry(2.52, 1.46),
        new THREE.MeshBasicMaterial({map: presTex})
      );
      screenFace.position.z = 0.062;
      boardGroup.add(legL, legR, boardBezel, screenFace);
      scene.add(boardGroup);

      // Pedestal + Maquete 3D Sob Medida à frente do Telão
      const pedestalBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 0.76, 0.52, 28),
        stdMat('#1E293B', 0.45, 0.25)
      );
      pedestalBase.position.set(0.66, 0.26, -0.02);
      const pedestalRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.69, 0.022, 12, 36),
        new THREE.MeshBasicMaterial({color: '#38BDF8'})
      );
      pedestalRim.position.set(0.66, 0.52, -0.02);
      pedestalRim.rotation.x = Math.PI / 2;
      stageGroup.add(pedestalBase, pedestalRim);

      const presCustomScenes = project.scenes.map((sc, sIdx) => {
        const spec = resolveSceneCustomVisual(project, sc, sIdx);
        const built = buildCustomVisual3DScene(spec, 0.58);
        built.root.position.set(0.66, 0.53, -0.02);
        built.root.visible = sIdx === 0;
        scene.add(built.root);
        return built;
      });

      // Anéis de Conclusão
      const presRings: THREE.Mesh[] = [];
      for (let r = 0; r < 3; r++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.22 + r * 0.13, 0.018, 10, 28),
          new THREE.MeshBasicMaterial({color: '#22C55E'})
        );
        ring.position.set(-0.92, 2.15, -0.25);
        ring.rotation.x = Math.PI / 3;
        scene.add(ring);
        presRings.push(ring);
      }

      addShadow(stageGroup, false, true);
      addShadow(presCharRig.root, true, true);
      addShadow(boardGroup, true, true);

      runtimeRef.current = {
        renderer,
        scene,
        camera,
        sectors: [],
        conduits: [],
        customScenes: presCustomScenes,
        presCharRig,
        presCanvas,
        presTex,
        presLastKey: '',
        presRings,
      };
    } else if (project.id === 'exemplo-sala-experimento') {
      // ==================== PRESET LEGADO: AR-CONDICIONADO / MICRO-ONDAS ====================
      const roomLight = new THREE.PointLight('#FFF7E8', 1.35, 14, 1.2);
      roomLight.position.set(-2.4, 3.6, 2.2);
      scene.add(roomLight);

      const houseGroup = new THREE.Group();
      scene.add(houseGroup);

      const floorBase = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.25, 6.6), stdMat('#8D582C', 0.8));
      floorBase.position.set(-2.6, -0.125, 0);
      houseGroup.add(floorBase);

      const plankColors = ['#C68952', '#BA7D47', '#CE945C', '#B47640'];
      for (let i = 0; i < 14; i++) {
        const zPos = -3.0 + i * 0.46;
        const plank = new THREE.Mesh(
          new THREE.BoxGeometry(7.1, 0.025, 0.435),
          stdMat(plankColors[i % plankColors.length], 0.68)
        );
        plank.position.set(-2.6, 0.012, zPos);
        houseGroup.add(plank);
      }

      const wallBack = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.1, 0.22), stdMat('#EFE6D5', 0.85));
      wallBack.position.set(-2.6, 2.05, -3.1);
      houseGroup.add(wallBack);

      const armchairGroup = createBeveledArmchair();
      armchairGroup.position.set(-3.55, 0, -0.62);
      armchairGroup.rotation.y = Math.PI * 0.28;
      scene.add(armchairGroup);

      const firstSec = project.sectors[0];
      const roomCharRig = createDesmontandoCharacter({
        shirtColor: firstSec?.shirtColor || '#F0CA4D',
        shortsColor: firstSec?.shortsColor || '#51627A',
      });
      roomCharRig.root.position.set(0, 0.67, 0.09);
      armchairGroup.add(roomCharRig.root);

      const {bucketGroup, iceCubesGroup} = createRibbedIceBucket();
      bucketGroup.position.set(-2.05, 1.01, -0.3);
      scene.add(bucketGroup);

      runtimeRef.current = {
        renderer,
        scene,
        camera,
        sectors: [],
        conduits: [],
        isLegacyAcPreset: true,
        roomCharRig,
        armchairGroup,
        iceBucketGroup: bucketGroup,
        iceCubesGroup,
      };
    } else {
      // ==================== MODELO BANCADA & MAQUETE 3D SOB MEDIDA (@DesmontandoOMundo) ====================
      const roomLight = new THREE.PointLight('#FFF7E8', 1.4, 15, 1.15);
      roomLight.position.set(-1.8, 3.8, 2.4);
      scene.add(roomLight);

      const studioGroup = new THREE.Group();
      scene.add(studioGroup);

      const firstSec = project.sectors[0];
      const accentColor = firstSec?.wallAccentColor || '#2563EB';

      const floorBase = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.25, 6.8), stdMat('#8D582C', 0.8));
      floorBase.position.set(-1.8, -0.125, 0);
      studioGroup.add(floorBase);

      const plankColors = ['#C68952', '#BA7D47', '#CE945C', '#B47640'];
      for (let i = 0; i < 14; i++) {
        const zPos = -3.0 + i * 0.46;
        const plank = new THREE.Mesh(
          new THREE.BoxGeometry(8.1, 0.025, 0.435),
          stdMat(plankColors[i % plankColors.length], 0.68)
        );
        plank.position.set(-1.8, 0.012, zPos);
        studioGroup.add(plank);
      }

      const wallBack = new THREE.Mesh(new THREE.BoxGeometry(8.2, 4.3, 0.22), stdMat('#EFE6D5', 0.85));
      wallBack.position.set(-1.8, 2.15, -3.1);
      const topTrim = new THREE.Mesh(new THREE.BoxGeometry(8.22, 0.22, 0.26), stdMat(accentColor, 0.5));
      topTrim.position.set(-1.8, 4.18, -3.08);
      studioGroup.add(wallBack, topTrim);

      // Janela Branca Lateral Esquerda
      const winFrame = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.72, 0.26, 2, 0.02), stdMat('#F8FAFC', 0.45));
      winFrame.position.set(-3.85, 2.38, -3.04);
      const winSky = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 1.48), new THREE.MeshBasicMaterial({color: '#93C5FD'}));
      winSky.position.set(-3.85, 2.38, -2.9);
      const winGrass = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.5), new THREE.MeshBasicMaterial({color: '#68B42E'}));
      winGrass.position.set(-3.85, 1.89, -2.895);
      studioGroup.add(winFrame, winSky, winGrass);

      // Quadro Blueprint Técnico na Parede
      const bpFrame = new THREE.Mesh(new RoundedBoxGeometry(1.85, 1.05, 0.08, 2, 0.02), stdMat('#1E293B', 0.5));
      bpFrame.position.set(-1.35, 2.65, -2.98);
      const bpBoardTex = makeCanvasTexture(512, 288, (ctx, w, h) => {
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.lineWidth = 2;
        for (let gx = 0; gx < w; gx += 32) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, h);
          ctx.stroke();
        }
        for (let gy = 0; gy < h; gy += 32) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(w, gy);
          ctx.stroke();
        }
        ctx.fillStyle = '#38BDF8';
        ctx.font = '900 22px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('MAQUETE 3D • ENGENHARIA', w / 2, 46);
        ctx.fillStyle = '#F8FAFC';
        ctx.font = '900 26px Arial, sans-serif';
        ctx.fillText(project.name.slice(0, 26).toUpperCase(), w / 2, 152);
      });
      const bpFace = new THREE.Mesh(
        new THREE.PlaneGeometry(1.72, 0.92),
        new THREE.MeshBasicMaterial({map: bpBoardTex})
      );
      bpFace.position.set(-1.35, 2.65, -2.93);
      studioGroup.add(bpFrame, bpFace);

      // Relógio 3D na Parede
      const clockGroup = new THREE.Group();
      clockGroup.position.set(0.15, 2.95, -2.96);
      const clockRim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 28), stdMat('#2B1D12', 0.5));
      clockRim.rotation.x = Math.PI / 2;
      const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.09, 28), stdMat('#FFFFFF', 0.4));
      clockFace.rotation.x = Math.PI / 2;
      const clockMinHand = new THREE.Group();
      const mMesh = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.19, 0.02), stdMat('#D9381E', 0.4));
      mMesh.position.y = 0.08;
      clockMinHand.position.z = 0.06;
      clockMinHand.add(mMesh);
      clockGroup.add(clockRim, clockFace, clockMinHand);
      studioGroup.add(clockGroup);

      // Tapete circular + Boneco Oficial em pé apresentando ao lado da Bancada
      const rug = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.026, 32), stdMat('#F3BC68', 0.85));
      rug.position.set(-2.95, 0.018, -0.2);
      studioGroup.add(rug);

      const roomCharRig = createDesmontandoCharacter({
        shirtColor: firstSec?.shirtColor || '#F0CA4D',
        shortsColor: firstSec?.shortsColor || '#334155',
      });
      roomCharRig.root.position.set(-2.95, 1.0, -0.2);
      roomCharRig.root.rotation.y = 0.34;
      scene.add(roomCharRig.root);

      // Bancada Larga de Engenharia (Madeira Nobre + Estrutura Metálica + Base Blueprint)
      const benchGroup = new THREE.Group();
      benchGroup.position.set(-1.35, 0, -0.25);
      const benchTop = new THREE.Mesh(
        new RoundedBoxGeometry(2.58, 0.1, 1.28, 3, 0.025),
        stdMat('#B87842', 0.58)
      );
      benchTop.position.y = 0.74;
      benchGroup.add(benchTop);

      const matGridTex = makeCanvasTexture(512, 256, (ctx, w, h) => {
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 2;
        for (let x = 0; x <= w; x += 32) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y <= h; y += 32) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 6;
        ctx.strokeRect(4, 4, w - 8, h - 8);
      });
      const benchMatPad = new THREE.Mesh(
        new THREE.PlaneGeometry(2.38, 1.08),
        new THREE.MeshBasicMaterial({map: matGridTex})
      );
      benchMatPad.rotation.x = -Math.PI / 2;
      benchMatPad.position.y = 0.793;
      benchGroup.add(benchMatPad);

      [
        [-1.12, -0.5],
        [1.12, -0.5],
        [-1.12, 0.5],
        [1.12, 0.5],
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.72, 0.09), stdMat('#1E293B', 0.45, 0.35));
        leg.position.set(lx, 0.36, lz);
        benchGroup.add(leg);
      });
      scene.add(benchGroup);

      // Constrói uma Maquete 3D Sob Medida para cada cena do roteiro!
      const benchCustomScenes = project.scenes.map((sc, sIdx) => {
        const spec = resolveSceneCustomVisual(project, sc, sIdx);
        const built = buildCustomVisual3DScene(spec, 0.96);
        built.root.position.set(-1.35, 0.8, -0.25);
        built.root.visible = sIdx === 0;
        scene.add(built.root);
        return built;
      });

      addShadow(studioGroup, false, true);
      addShadow(roomCharRig.root, true, true);
      addShadow(benchGroup, true, true);

      runtimeRef.current = {
        renderer,
        scene,
        camera,
        clockMinHand,
        sectors: [],
        conduits: [],
        customScenes: benchCustomScenes,
        isLegacyAcPreset: false,
        roomCharRig,
      };
    }

    return () => {
      if (runtimeRef.current?.customScenes) {
        runtimeRef.current.customScenes.forEach((cs) => {
          cs.disposables.forEach((d) => d.dispose());
        });
      }
      renderer.dispose();
      runtimeRef.current = null;
    };
  }, [structureKey, width, height, isWide]);

  useLayoutEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;

    const scenes = project.scenes;
    if (scenes.length === 0) {
      rt.renderer.render(rt.scene, rt.camera);
      return;
    }

    // Identifica cena atual e cena anterior para interpolação suave de câmera (28 frames)
    let curIdx = scenes.findIndex((s) => N >= s.fromFrame && N <= s.toFrame);
    if (curIdx === -1) {
      curIdx = N < scenes[0].fromFrame ? 0 : scenes.length - 1;
    }
    const curScene: StudioSceneSpec = scenes[curIdx];
    const prevScene: StudioSceneSpec = curIdx > 0 ? scenes[curIdx - 1] : curScene;
    const transT = easeCam(clamp01((N - curScene.fromFrame) / 28));

    if (project.modelId === 'fluxo_corporativo') {
      const K = Math.max(1, rt.sectors.length);
      const getCamTargetForScene = (sc: StudioSceneSpec) => {
        if (sc.sectorIndex < 0 || sc.visualEffect === 'panorama_all') {
          const panoZ = isWide ? 6.2 + K * 2.75 : 11.5 + K * 4.9;
          return {
            pos: [0, isWide ? 3.95 : 4.4, panoZ] as [number, number, number],
            look: [0, 1.48, -0.65] as [number, number, number],
            fov: isWide ? 40 : 48,
          };
        }
        const safeIdx = Math.min(K - 1, Math.max(0, sc.sectorIndex));
        const sx = rt.sectors[safeIdx].xCenter;
        return {
          pos: [sx, isWide ? 2.02 : 2.38, isWide ? 3.88 : 6.45] as [number, number, number],
          look: [sx + 0.08, isWide ? 1.32 : 1.38, -0.75] as [number, number, number],
          fov: isWide ? 39 : 46,
        };
      };

      const camA = getCamTargetForScene(prevScene);
      const camB = getCamTargetForScene(curScene);
      rt.camera.fov = camA.fov + (camB.fov - camA.fov) * transT;
      rt.camera.position.set(
        camA.pos[0] + (camB.pos[0] - camA.pos[0]) * transT,
        camA.pos[1] + (camB.pos[1] - camA.pos[1]) * transT,
        camA.pos[2] + (camB.pos[2] - camA.pos[2]) * transT
      );
      rt.camera.lookAt(
        camA.look[0] + (camB.look[0] - camA.look[0]) * transT,
        camA.look[1] + (camB.look[1] - camA.look[1]) * transT,
        camA.look[2] + (camB.look[2] - camA.look[2]) * transT
      );
      rt.camera.updateProjectionMatrix();
      rt.camera.updateMatrixWorld();

      const isPano = curScene.sectorIndex < 0 || curScene.visualEffect === 'panorama_all';
      if (rt.wallSignsGroup) rt.wallSignsGroup.visible = isPano;

      if (rt.clockMinHand) {
        const fast = curScene.visualEffect === 'paper_loss' ? (N - curScene.fromFrame) * 0.25 : 0;
        rt.clockMinHand.rotation.z = -(N * 0.025 + fast);
      }

      // Atualiza cada setor
      rt.sectors.forEach((secRt, idx) => {
        const isFocused = curScene.sectorIndex === idx;
        const specSec = project.sectors[idx];
        const isStandingStation =
          specSec?.stationType === 'supermarket_aisle' || specSec?.stationType === 'warehouse_dock';

        const pose = isFocused
          ? curScene.pose
          : isPano && idx === 0
          ? 'standing_wave'
          : isStandingStation
          ? 'standing_neutral'
          : 'sitting_desk';

        secRt.rig.setPose(pose, N + idx * 13);
        secRt.rig.phoneProp.visible = isStandingStation && pose === 'standing_phone';
        secRt.rig.phoneScreenMat.color.set(
          curScene.visualEffect === 'printer_labels' || curScene.visualEffect === 'status_done'
            ? '#22C55E'
            : '#38BDF8'
        );

        // Atualiza texto dinâmico do monitor/celular quando a cena foca nesse setor
        if (isFocused) {
          const sKey = `${curScene.id}|${curScene.screenLine1}|${curScene.screenLine2}|${curScene.visualEffect}`;
          if (secRt.lastScreenKey !== sKey) {
            secRt.lastScreenKey = sKey;
            const isSuccess =
              curScene.visualEffect === 'price_markdown' ||
              curScene.visualEffect === 'status_done' ||
              curScene.visualEffect === 'printer_labels' ||
              curScene.visualEffect === 'erp_sync';
            drawDynamicScreenCanvas(
              secRt.screenCanvas,
              specSec?.monitorHeader || specSec?.title || 'SISTEMA',
              curScene.screenLine1,
              curScene.screenLine2,
              specSec?.wallAccentColor || '#0284C7',
              isSuccess
            );
            secRt.screenTex.needsUpdate = true;
          }
        }

        const localN = N - curScene.fromFrame;
        if (secRt.paperLossGroup) {
          const showP = isFocused && curScene.visualEffect === 'paper_loss';
          secRt.paperLossGroup.visible = showP;
          if (showP) secRt.paperLossGroup.scale.setScalar(pop3D(localN - 15, 14));
        }
        if (secRt.mobileHoloGroup) {
          const showH =
            isFocused &&
            (curScene.visualEffect === 'barcode_scan' ||
              curScene.visualEffect === 'photo_flash' ||
              curScene.visualEffect === 'printer_labels');
          secRt.mobileHoloGroup.visible = showH;
          if (showH) secRt.mobileHoloGroup.scale.setScalar(pop3D(localN - 8, 12));
        }
        if (secRt.scannerLaser) {
          secRt.scannerLaser.visible = isFocused && curScene.visualEffect === 'barcode_scan' && localN > 20;
        }
        if (secRt.cameraFlash) {
          secRt.cameraFlash.visible =
            isFocused && curScene.visualEffect === 'photo_flash' && localN >= 35 && localN <= 55;
        }
        if (secRt.yellowStickers) {
          const showTags =
            project.id === 'sistema-data-critica' &&
            ((isFocused && curScene.visualEffect === 'printer_labels') || isPano || curIdx === scenes.length - 1);
          secRt.yellowStickers.forEach((st, sIdx) => {
            st.visible = showTags;
            if (showTags) st.scale.setScalar(isPano ? 1 : pop3D(localN - 25 - sIdx * 6, 10));
          });
          if (secRt.batchHaloMat) {
            secRt.batchHaloMat.color.set(showTags ? '#22C55E' : '#F97316');
          }
        }
        if (secRt.printerStrip) {
          secRt.printerStrip.visible =
            project.id === 'sistema-data-critica' &&
            ((isFocused && curScene.visualEffect === 'printer_labels') || isPano);
        }
        if (secRt.erpSyncSpheres) {
          const showSync = isFocused && (curScene.visualEffect === 'erp_sync' || curScene.visualEffect === 'status_done');
          secRt.erpSyncSpheres.forEach((sp, spIdx) => {
            sp.visible = showSync;
            if (showSync) {
              const p = ((N * 0.045 + spIdx / 5) % 1);
              sp.position.set(-0.3 + p * 0.72, 1.54 + Math.sin(p * Math.PI) * 0.14, -0.06);
            }
          });
        }
        if (secRt.erpTags) {
          const showErpTags =
            (isFocused && (curScene.visualEffect === 'erp_sync' || curScene.visualEffect === 'status_done')) || isPano;
          secRt.erpTags.forEach((tg) => {
            tg.visible = showErpTags;
          });
        }
      });

      // Atualiza dutos de dados entre setores
      const sceneDur = Math.max(30, curScene.toFrame - curScene.fromFrame);
      const sendStart = curScene.fromFrame + Math.floor(sceneDur * 0.55);
      rt.conduits.forEach((cd) => {
        const isSendingThis =
          !isPano &&
          curScene.sectorIndex === cd.fromIdx &&
          curScene.sendDataToSector === cd.toIdx &&
          N >= sendStart;
        const isPanoFlow = isPano && (cd.toIdx === cd.fromIdx + 1 || (cd.fromIdx === K - 1 && cd.toIdx === 0));
        const active = isSendingThis || isPanoFlow;
        cd.tube.visible = active;
        cd.packets.forEach((pk, pIdx) => {
          pk.visible = active;
          if (active) {
            const t = isPanoFlow
              ? ((N * 0.016 + pIdx / cd.packets.length) % 1)
              : clamp01((N - sendStart - pIdx * 6) / Math.max(24, curScene.toFrame - sendStart));
            pk.position.copy(cd.curve.getPointAt(t));
          }
        });
      });
    } else if (project.modelId === 'estudio_apresentador') {
      // ==================== ANIMAÇÃO MODELO 3: ESTÚDIO APRESENTADOR & TELÃO 3D ====================
      const eff = curScene.visualEffect;
      const isZoomBoard = eff === 'presenter_chart' || eff === 'price_markdown' || eff === 'erp_sync';
      const camPos: [number, number, number] = isZoomBoard
        ? [-0.02, isWide ? 1.88 : 2.18, isWide ? 4.25 : 8.05]
        : [-0.1, isWide ? 1.98 : 2.26, isWide ? 4.65 : 8.45];
      const camLook: [number, number, number] = isZoomBoard
        ? [0.06, 1.38, -0.65]
        : [-0.04, 1.36, -0.65];

      rt.camera.fov = isWide ? 40 : 48;
      rt.camera.position.set(camPos[0], camPos[1], camPos[2]);
      rt.camera.lookAt(camLook[0], camLook[1], camLook[2]);
      rt.camera.updateProjectionMatrix();
      rt.camera.updateMatrixWorld();

      const isFinal = curIdx === scenes.length - 1 || eff === 'presenter_conclusion' || eff === 'panorama_all';
      const isAlert = eff === 'presenter_alert' || eff === 'paper_loss';
      const firstSec = project.sectors[0];

      if (rt.presCharRig) {
        const pose = isFinal
          ? 'standing_wave'
          : isAlert
          ? 'standing_worried'
          : curScene.pose === 'standing_phone'
          ? 'standing_phone'
          : 'standing_neutral';
        rt.presCharRig.setPose(pose, N);
        rt.presCharRig.phoneProp.visible = pose === 'standing_phone';
      }

      if (rt.presCanvas && rt.presTex) {
        const key = `${curIdx}|${curScene.screenLine1}|${curScene.screenLine2}|${eff}`;
        if (rt.presLastKey !== key) {
          rt.presLastKey = key;
          drawPresenterBoardCanvas(
            rt.presCanvas,
            firstSec?.monitorHeader || project.name.slice(0, 24).toUpperCase(),
            `ETAPA ${curIdx + 1}/${scenes.length}`,
            (curIdx + 1) / Math.max(1, scenes.length),
            curScene.screenLine1 || curScene.headline,
            curScene.screenLine2 || curScene.rightBadge,
            firstSec?.wallAccentColor || '#2563EB',
            isAlert,
            isFinal
          );
          rt.presTex.needsUpdate = true;
        }
      }

      const localN = Math.max(0, N - curScene.fromFrame);
      if (rt.customScenes) {
        rt.customScenes.forEach((cs, sIdx) => {
          const active = sIdx === curIdx;
          cs.root.visible = active;
          if (active) {
            animateCustomVisual3DScene(cs, N, localN);
          }
        });
      }

      if (rt.presRings) {
        rt.presRings.forEach((ring, rIdx) => {
          ring.visible = isFinal;
          if (isFinal) {
            const s = 0.72 + (((N * 0.04 + rIdx * 0.33) % 1)) * 0.6;
            ring.scale.setScalar(s);
          }
        });
      }
    } else if (rt.isLegacyAcPreset) {
      // ==================== ANIMAÇÃO PRESET LEGADO ====================
      rt.camera.fov = isWide ? 40 : 48;
      rt.camera.position.set(-2.35, 2.38, isWide ? 4.85 : 6.35);
      rt.camera.lookAt(-2.3, 1.36, -0.4);
      rt.camera.updateProjectionMatrix();
      rt.camera.updateMatrixWorld();
      if (rt.roomCharRig) {
        rt.roomCharRig.setPose(curScene.pose, N);
      }
    } else {
      // ==================== ANIMAÇÃO BANCADA & MAQUETE 3D SOB MEDIDA ====================
      const getBenchCam = (idx: number) => {
        const cs = rt.customScenes?.[idx];
        const angle = cs?.cameraAngle || (idx % 2 === 0 ? 'iso_left' : 'iso_right');
        if (angle === 'closeup') {
          return {
            pos: [-1.38, isWide ? 1.98 : 2.15, isWide ? 3.55 : 5.35] as [number, number, number],
            look: [-1.36, 1.48, -0.25] as [number, number, number],
            fov: isWide ? 39 : 46,
          };
        }
        if (angle === 'iso_right') {
          return {
            pos: [-1.32, isWide ? 2.18 : 2.35, isWide ? 4.45 : 6.65] as [number, number, number],
            look: [-1.72, 1.46, -0.25] as [number, number, number],
            fov: isWide ? 40 : 47,
          };
        }
        return {
          pos: [-1.95, isWide ? 2.16 : 2.34, isWide ? 4.55 : 6.75] as [number, number, number],
          look: [-1.75, 1.46, -0.25] as [number, number, number],
          fov: isWide ? 40 : 47,
        };
      };

      const prevIdx = curIdx > 0 ? curIdx - 1 : curIdx;
      const camA = getBenchCam(prevIdx);
      const camB = getBenchCam(curIdx);
      rt.camera.fov = camA.fov + (camB.fov - camA.fov) * transT;
      rt.camera.position.set(
        camA.pos[0] + (camB.pos[0] - camA.pos[0]) * transT,
        camA.pos[1] + (camB.pos[1] - camA.pos[1]) * transT,
        camA.pos[2] + (camB.pos[2] - camA.pos[2]) * transT
      );
      rt.camera.lookAt(
        camA.look[0] + (camB.look[0] - camA.look[0]) * transT,
        camA.look[1] + (camB.look[1] - camA.look[1]) * transT,
        camA.look[2] + (camB.look[2] - camA.look[2]) * transT
      );
      rt.camera.updateProjectionMatrix();
      rt.camera.updateMatrixWorld();

      if (rt.clockMinHand) {
        rt.clockMinHand.rotation.z = -(N * 0.025);
      }

      if (rt.roomCharRig) {
        const isLastScene = curIdx === scenes.length - 1;
        const safePose = isLastScene
          ? 'standing_wave'
          : curScene.pose === 'sitting_cool' || curScene.pose === 'sitting_hot' || curScene.pose === 'sitting_desk'
          ? curIdx === 0
            ? 'standing_worried'
            : 'standing_neutral'
          : curScene.pose;
        rt.roomCharRig.setPose(safePose, N);
      }

      const localN = Math.max(0, N - curScene.fromFrame);
      if (rt.customScenes) {
        rt.customScenes.forEach((cs, sIdx) => {
          const active = sIdx === curIdx;
          cs.root.visible = active;
          if (active) {
            animateCustomVisual3DScene(cs, N, localN);
          }
        });
      }
    }

    rt.renderer.render(rt.scene, rt.camera);
  }, [project, N, isWide]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{width, height, display: 'block'}}
    />
  );
};

