import React, {useLayoutEffect, useRef} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {clamp01, easeInOutPow, BEZ_SCALE_IN} from '../../common';
import {
  createDesmontandoCharacter,
  createBeveledArmchair,
  DesmontandoCharacterRig,
} from './DesmontandoRig';
import {MICROWAVE_CUES as C} from './microwaveWords';
import {AnchorMap, ScreenAnchor} from './ThreeDiorama';

type CamKeyframe = {
  f: number;
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
};

const CAM_KEYS: CamKeyframe[] = [
  // Ato 1: Sala ampla mostrando o boneco oficial na poltrona + banquinho com a comida + maçarico (f1..345)
  {f: 1, pos: [-2.35, 2.42, 6.55], look: [-2.35, 1.32, -0.45], fov: 49},
  {f: 185, pos: [-2.25, 2.35, 6.15], look: [-2.25, 1.32, -0.42], fov: 48},
  {f: 245, pos: [-1.92, 2.08, 3.25], look: [-2.02, 1.32, -0.3], fov: 45},
  {f: 345, pos: [-1.92, 2.08, 3.25], look: [-2.02, 1.32, -0.3], fov: 45},

  // Ato 2: Moléculas de água dentro da comida + Magnetron entrando ao lado (f345..640)
  {f: 380, pos: [-1.85, 2.05, 3.55], look: [-1.82, 1.36, -0.3], fov: 46},
  {f: 505, pos: [-1.68, 2.12, 4.15], look: [-1.65, 1.4, -0.3], fov: 47},
  {f: 640, pos: [-1.68, 2.12, 4.15], look: [-1.65, 1.4, -0.3], fov: 47},

  // Ato 3: Close-up nas ondas mudando de lado 2 bilhões de vezes/s e moléculas gerando calor por atrito (f640..1040)
  {f: 675, pos: [-1.78, 1.96, 2.95], look: [-1.85, 1.35, -0.3], fov: 44},
  {f: 1035, pos: [-1.78, 1.96, 2.95], look: [-1.85, 1.35, -0.3], fov: 44},

  // Ato 4: Abre para mostrar ondas escapando pela sala -> Caixa metálica espelhada rebatendo as ondas (f1040..1330)
  {f: 1068, pos: [-2.25, 2.38, 6.25], look: [-2.2, 1.38, -0.38], fov: 49},
  {f: 1150, pos: [-2.25, 2.38, 6.25], look: [-2.2, 1.38, -0.38], fov: 49},
  {f: 1190, pos: [-1.82, 2.15, 4.05], look: [-1.82, 1.42, -0.3], fov: 46},
  {f: 1330, pos: [-1.82, 2.15, 4.05], look: [-1.82, 1.42, -0.3], fov: 46},

  // Ato 5: Pontos quentes/frios -> Motorzinho dourado + Prato giratório de vidro (f1330..1655)
  {f: 1365, pos: [-1.88, 2.18, 3.65], look: [-1.92, 1.35, -0.3], fov: 45},
  {f: 1650, pos: [-1.88, 2.18, 3.65], look: [-1.92, 1.35, -0.3], fov: 45},

  // Ato 6: Porta com chapa metálica furadinha (Onda de 12 cm bloqueada vs Luz visível passando) (f1655..1935)
  {f: 1690, pos: [-2.55, 2.02, 3.35], look: [-1.95, 1.42, -0.15], fov: 45},
  {f: 1930, pos: [-2.55, 2.02, 3.35], look: [-1.95, 1.42, -0.15], fov: 45},

  // Ato 7: Vidro sem água fica frio + Seletor de Potência pulsando o Magnetron (f1935..2265)
  {f: 1965, pos: [-1.72, 2.08, 3.95], look: [-1.78, 1.38, -0.3], fov: 46},
  {f: 2260, pos: [-1.72, 2.08, 3.95], look: [-1.78, 1.38, -0.3], fov: 46},

  // Ato 8: Zoom out final para a sala com a Carcaça Branca montada, Luz interna, Sininho e Boneco Feliz! (f2265..2579)
  {f: 2300, pos: [-2.3, 2.4, 6.35], look: [-2.25, 1.36, -0.4], fov: 49},
  {f: 2579, pos: [-2.25, 2.38, 6.1], look: [-2.25, 1.36, -0.4], fov: 49},
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
        fov: (a.fov ?? 46) + ((b.fov ?? 46) - (a.fov ?? 46)) * t,
      };
    }
  }
  return CAM_KEYS[CAM_KEYS.length - 1];
}

const sharedCam = new THREE.PerspectiveCamera(46, 1080 / 1920, 0.1, 100);

export function getMicrowaveScreenAnchors(N: number): AnchorMap {
  const cam = sampleCamera(N);
  sharedCam.fov = cam.fov ?? 46;
  sharedCam.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
  sharedCam.lookAt(cam.look[0], cam.look[1], cam.look[2]);
  sharedCam.updateProjectionMatrix();
  sharedCam.updateMatrixWorld();
  const proj = (x: number, y: number, z: number): ScreenAnchor => {
    const v = new THREE.Vector3(x, y, z).project(sharedCam);
    return {
      x: Math.max(140, Math.min(940, (v.x * 0.5 + 0.5) * 1080)),
      y: Math.max(120, Math.min(1320, (-v.y * 0.5 + 0.5) * 1920)),
      visible: v.z < 1,
    };
  };
  return {
    chair: proj(-3.55, 2.15, -0.62),
    foodTop: proj(-2.05, 1.65, -0.3),
    foodMid: proj(-2.05, 1.28, -0.3),
    foodLow: proj(-2.05, 0.98, -0.1),
    torchTip: proj(-1.35, 1.55, -0.2),
    magnetronTop: proj(-1.18, 1.82, -0.3),
    magnetronMid: proj(-1.18, 1.42, -0.3),
    boxTop: proj(-1.92, 2.08, -0.3),
    doorFront: proj(-2.05, 1.48, 0.25),
    motorLow: proj(-2.05, 0.88, -0.1),
  };
}

const pop3D = (n: number, dur = 14) => (n <= 0 ? 0.0001 : Math.max(0.0001, BEZ_SCALE_IN(clamp01(n / dur))));

export const MicrowaveDioramaStage: React.FC<{N: number}> = ({N}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    clockMinHand: THREE.Object3D;
    clockHourHand: THREE.Object3D;
    charRig: DesmontandoCharacterRig;
    foodGroup: THREE.Group;
    outerCrustMat: THREE.MeshStandardMaterial;
    frontCrustHalf: THREE.Mesh;
    iceCoreMesh: THREE.Mesh;
    torchGroup: THREE.Group;
    flameCone: THREE.Mesh;
    waterMolsGroup: THREE.Group;
    waterMols: Array<{group: THREE.Group; oMat: THREE.MeshStandardMaterial}>;
    magnetronGroup: THREE.Group;
    antennaGlowMat: THREE.MeshStandardMaterial;
    sineWaveGroup: THREE.Group;
    sineWaveBalls: Array<{mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial}>;
    strayWavesGroup: THREE.Group;
    strayRings: THREE.Mesh[];
    metalBoxGroup: THREE.Group;
    stirrerBlades: THREE.Group;
    bounceLinesGroup: THREE.Group;
    standingNodesGroup: THREE.Group;
    hotNodes: THREE.Mesh[];
    coldNodes: THREE.Mesh[];
    turntableGroup: THREE.Group;
    glassPlateMesh: THREE.Mesh;
    meshDoorGroup: THREE.Group;
    lightRaysGroup: THREE.Group;
    blockedWaveRing: THREE.Mesh;
    steamPuffs: THREE.Mesh[];
    outerShellGroup: THREE.Group;
    chimeRingsGroup: THREE.Group;
    chimeRings: THREE.Mesh[];
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
    renderer.setSize(1080, 1920, false);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#69B3F5');

    const camera = new THREE.PerspectiveCamera(48, 1080 / 1920, 0.1, 100);

    // ---- ILUMINAÇÃO 3D REALISTA E ACONCHEGANTE ----
    const hemiLight = new THREE.HemisphereLight('#FFFDF9', '#C89B68', 1.15);
    hemiLight.position.set(0, 12, 0);
    scene.add(hemiLight);

    const roomLight = new THREE.PointLight('#FFF7E8', 1.38, 14, 1.2);
    roomLight.position.set(-2.4, 3.6, 2.2);
    scene.add(roomLight);

    const sunLight = new THREE.DirectionalLight('#FFF5E0', 1.75);
    sunLight.position.set(-7.5, 9.5, 5.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 28;
    const d = 9.5;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0008;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight('#D6ECFF', 0.45);
    fillLight.position.set(6, 5, 6);
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

    // ==================== 1. SALA OFICIAL @DESMONTANDOOMUNDO (Piso de Tábuas + Tapete + Janela com Jardim) ====================
    const houseGroup = new THREE.Group();
    scene.add(houseGroup);

    const floorBase = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.25, 6.6), stdMat('#8D582C', 0.8));
    floorBase.position.set(-3.1, -0.125, 0);
    houseGroup.add(floorBase);

    const plankColors = ['#C68952', '#BA7D47', '#CE945C', '#B47640'];
    for (let i = 0; i < 14; i++) {
      const zPos = -3.0 + i * 0.46;
      const splitX = -3.1 + ((i * 1.7) % 2.4) - 1.2;
      const leftLen = splitX - -6.25;
      const rightLen = 0.15 - splitX;
      const p1 = new THREE.Mesh(
        new THREE.BoxGeometry(leftLen - 0.03, 0.025, 0.435),
        stdMat(plankColors[i % plankColors.length], 0.68)
      );
      p1.position.set(-6.25 + leftLen * 0.5, 0.012, zPos);
      const p2 = new THREE.Mesh(
        new THREE.BoxGeometry(rightLen - 0.03, 0.025, 0.435),
        stdMat(plankColors[(i + 2) % plankColors.length], 0.68)
      );
      p2.position.set(splitX + rightLen * 0.5, 0.012, zPos);
      houseGroup.add(p1, p2);
    }

    // Tapete sob a poltrona
    const rugBorder = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.028, 2.25), stdMat('#DE7A47', 0.85));
    rugBorder.position.set(-3.42, 0.026, -0.42);
    rugBorder.rotation.y = 0.14;
    const rugInner = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.032, 1.85), stdMat('#F3BC68', 0.85));
    rugInner.position.set(-3.42, 0.03, -0.42);
    rugInner.rotation.y = 0.14;
    houseGroup.add(rugBorder, rugInner);

    // Parede de fundo com janela branca atrás da poltrona
    const wallBackMat = stdMat('#EFE6D5', 0.85);
    const bwBottom = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.45, 0.22), wallBackMat);
    bwBottom.position.set(-3.1, 0.725, -3.1);
    const bwTop = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.95, 0.22), wallBackMat);
    bwTop.position.set(-3.1, 3.825, -3.1);
    const bwLeft = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.9, 0.22), wallBackMat);
    bwLeft.position.set(-5.35, 2.4, -3.1);
    const bwRight = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.9, 0.22), wallBackMat);
    bwRight.position.set(-1.3, 2.4, -3.1);
    houseGroup.add(bwBottom, bwTop, bwLeft, bwRight);

    const backWinMat = stdMat('#F8F6F0', 0.45);
    const bwfTop = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.11, 0.28), backWinMat);
    bwfTop.position.set(-3.6, 3.35, -3.08);
    const bwfBot = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.13, 0.32), backWinMat);
    bwfBot.position.set(-3.6, 1.45, -3.06);
    const bwfLeft = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.95, 0.28), backWinMat);
    bwfLeft.position.set(-4.4, 2.4, -3.08);
    const bwfRight = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.95, 0.28), backWinMat);
    bwfRight.position.set(-2.8, 2.4, -3.08);
    const bwfMidV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.26), backWinMat);
    bwfMidV.position.set(-3.6, 2.4, -3.08);
    const bwfMidH = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.26), backWinMat);
    bwfMidH.position.set(-3.6, 2.4, -3.08);
    houseGroup.add(bwfTop, bwfBot, bwfLeft, bwfRight, bwfMidV, bwfMidH);

    // Feixe solar translúcido
    const sunBeamVolume = new THREE.Mesh(
      new THREE.PlaneGeometry(1.58, 3.65),
      new THREE.MeshBasicMaterial({
        color: '#FFF9D2',
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    sunBeamVolume.position.set(-3.38, 1.62, -0.75);
    sunBeamVolume.rotation.z = 0.08;
    sunBeamVolume.rotation.y = 0.18;
    houseGroup.add(sunBeamVolume);

    // Jardim externo visível pela janela
    const backLawn = new THREE.Mesh(new THREE.BoxGeometry(8.0, 2.8, 0.2), stdMat('#86C948', 0.85));
    backLawn.position.set(-3.5, 1.85, -4.25);
    houseGroup.add(backLawn);
    for (let p = 0; p < 7; p++) {
      const wPicket = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.82, 0.05), stdMat('#F8FAFC', 0.45));
      wPicket.position.set(-4.3 + p * 0.25, 1.92, -3.55);
      houseGroup.add(wPicket);
    }
    const wRail1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.06), stdMat('#F1F5F9', 0.45));
    wRail1.position.set(-3.55, 2.12, -3.54);
    const wRail2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.06), stdMat('#F1F5F9', 0.45));
    wRail2.position.set(-3.55, 1.78, -3.54);
    const winTreeTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.4, 10), stdMat('#8B5A2B', 0.85));
    winTreeTrunk.position.set(-3.75, 2.35, -3.72);
    houseGroup.add(wRail1, wRail2, winTreeTrunk);

    const baseboard = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.16, 0.26), stdMat('#DCD0BC', 0.75));
    baseboard.position.set(-3.1, 0.08, -3.08);
    const divWall = new THREE.Mesh(new THREE.BoxGeometry(0.28, 4.3, 6.6), stdMat('#EADFCB', 0.82));
    divWall.position.set(0.1, 2.15, 0);
    houseGroup.add(baseboard, divWall);

    // Relógio 3D na parede
    const clockGroup = new THREE.Group();
    clockGroup.position.set(-4.85, 3.25, -2.96);
    const clockRim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 32), stdMat('#2B1D12', 0.5));
    clockRim.rotation.x = Math.PI / 2;
    const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.09, 32), stdMat('#FFFFFF', 0.4));
    clockFace.rotation.x = Math.PI / 2;
    clockGroup.add(clockRim, clockFace);
    const clockHourHand = new THREE.Group();
    const hMesh = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.17, 0.02), stdMat('#1E1E1E', 0.4));
    hMesh.position.y = 0.065;
    clockHourHand.position.z = 0.06;
    clockHourHand.add(hMesh);
    const clockMinHand = new THREE.Group();
    const mMesh = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.24, 0.02), stdMat('#D9381E', 0.4));
    mMesh.position.y = 0.095;
    clockMinHand.position.z = 0.065;
    clockMinHand.add(mMesh);
    clockGroup.add(clockHourHand, clockMinHand);
    houseGroup.add(clockGroup);

    // Quadro da Montanha 3D
    const frameGroup = new THREE.Group();
    frameGroup.position.set(-1.95, 2.78, -2.96);
    const frameOuter = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.68, 0.06), stdMat('#6B4423', 0.6));
    const frameCanvas = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.55, 0.07), stdMat('#BAE6FD', 0.5));
    const mtn1 = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.38, 4), stdMat('#2E8B22', 0.7, 0.05, true));
    mtn1.position.set(-0.14, -0.06, 0.04);
    mtn1.rotation.y = Math.PI / 4;
    const mtn2 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.32, 4), stdMat('#3FA632', 0.7, 0.05, true));
    mtn2.position.set(0.16, -0.09, 0.04);
    mtn2.rotation.y = Math.PI / 4;
    const picSun = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), stdMat('#FACC15', 0.4));
    picSun.position.set(-0.22, 0.14, 0.042);
    frameGroup.add(frameOuter, frameCanvas, mtn1, mtn2, picSun);
    houseGroup.add(frameGroup);

    // ==================== 2. REUSO DIRETO DO BONECO OFICIAL + POLTRONA CHANFRADA (DesmontandoRig.ts) ====================
    const armchairGroup = createBeveledArmchair();
    armchairGroup.position.set(-3.55, 0, -0.62);
    armchairGroup.rotation.y = Math.PI * 0.28;
    scene.add(armchairGroup);

    const charRig = createDesmontandoCharacter();
    charRig.root.position.set(0, 0.67, 0.09);
    armchairGroup.add(charRig.root);

    // Banquinho redondo de madeira oficial (x = -2.05, z = -0.3)
    const stoolGroup = new THREE.Group();
    stoolGroup.position.set(-2.05, 0, -0.3);
    scene.add(stoolGroup);
    const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 32), stdMat('#B87842', 0.65));
    stoolSeat.position.y = 0.96;
    stoolGroup.add(stoolSeat);
    [
      [-0.35, -0.35],
      [0.35, -0.35],
      [-0.35, 0.35],
      [0.35, 0.35],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.035, 0.96, 12), stdMat('#8C5425', 0.7));
      leg.position.set(lx, 0.48, lz);
      leg.rotation.z = lx * 0.18;
      leg.rotation.x = -lz * 0.18;
      stoolGroup.add(leg);
    });

    // ==================== 3. ATO 1: PRATO DE CERÂMICA + COMIDA EM CAMADAS + BLOCO DE GELO INTERNO + MAÇARICO ====================
    const foodGroup = new THREE.Group();
    foodGroup.position.set(-2.05, 1.04, -0.3);
    scene.add(foodGroup);

    // Prato branco de cerâmica
    const ceramicPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.28, 0.045, 32), stdMat('#F8FAFC', 0.25, 0.05));
    ceramicPlate.position.y = 0.022;
    foodGroup.add(ceramicPlate);

    // Lasanha / Torta 3D dividida em metade traseira e metade frontal (para abrir em corte mostrando o gelo no meio!)
    const outerCrustMat = new THREE.MeshStandardMaterial({
      color: '#E07A2E',
      roughness: 0.55,
      transparent: true,
      opacity: 0.96,
    });
    const backCrustHalf = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.22, 0.2, 3, 0.035), outerCrustMat);
    backCrustHalf.position.set(0, 0.14, -0.09);
    const frontCrustHalf = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.22, 0.2, 3, 0.035), outerCrustMat);
    frontCrustHalf.position.set(0, 0.14, 0.09);
    foodGroup.add(backCrustHalf, frontCrustHalf);

    // Núcleo congelado azul translúcido no meio da comida (Ato 1: "o meio continua congelado!")
    const iceCoreMesh = new THREE.Mesh(
      new RoundedBoxGeometry(0.24, 0.14, 0.14, 3, 0.025),
      new THREE.MeshPhysicalMaterial({
        color: '#38BDF8',
        roughness: 0.15,
        transmission: 0.35,
        transparent: true,
        opacity: 0.92,
      })
    );
    iceCoreMesh.position.set(0, 0.14, 0);
    foodGroup.add(iceCoreMesh);

    // Maçarico 3D Azul/Latão soprando chama laranja/azul por fora (Ato 1)
    const torchGroup = new THREE.Group();
    torchGroup.position.set(-1.18, 1.32, -0.2);
    scene.add(torchGroup);
    const torchTank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.38, 20), stdMat('#0284C7', 0.35, 0.3));
    torchTank.rotation.z = 0.25;
    const torchNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.04, 0.24, 16), stdMat('#D97706', 0.3, 0.65));
    torchNozzle.rotation.z = Math.PI / 2 + 0.15;
    torchNozzle.position.set(-0.18, 0.18, 0);
    const flameCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.095, 0.44, 16),
      new THREE.MeshBasicMaterial({color: '#FF6B00', transparent: true, opacity: 0.88})
    );
    flameCone.rotation.z = Math.PI / 2 + 0.15;
    flameCone.position.set(-0.46, 0.23, 0);
    torchGroup.add(torchTank, torchNozzle, flameCone);

    // ==================== 4. ATO 2 & 3: MOLÉCULAS DE ÁGUA (H2O) + MAGNETRON + ONDAS DE RÁDIO SENOIDAIS ====================
    const waterMolsGroup = new THREE.Group();
    waterMolsGroup.position.set(0, 0.15, 0);
    foodGroup.add(waterMolsGroup);

    const waterMols: Array<{group: THREE.Group; oMat: THREE.MeshStandardMaterial}> = [];
    const hMat = new THREE.MeshStandardMaterial({color: '#E0F2FE', roughness: 0.25});
    for (let i = 0; i < 18; i++) {
      const g = new THREE.Group();
      const row = Math.floor(i / 6);
      const col = i % 6;
      g.position.set(-0.15 + (col % 3) * 0.15, -0.04 + row * 0.055, -0.06 + Math.floor(col / 3) * 0.12);
      const oMat = new THREE.MeshStandardMaterial({color: '#0EA5E9', roughness: 0.25});
      const oSphere = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 12), oMat);
      const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 10), hMat);
      h1.position.set(0.022, 0.016, 0);
      const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 10), hMat);
      h2.position.set(-0.022, 0.016, 0);
      g.add(oSphere, h1, h2);
      waterMolsGroup.add(g);
      waterMols.push({group: g, oMat});
    }

    // Magnetron 3D (Corpo de cobre + aletas de alumínio + imãs + antena emissora dourada)
    const magnetronGroup = new THREE.Group();
    magnetronGroup.position.set(-1.12, 1.48, -0.3);
    scene.add(magnetronGroup);

    const magCore = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 24), stdMat('#C86D3B', 0.35, 0.65));
    magCore.rotation.z = Math.PI / 2;
    magnetronGroup.add(magCore);

    // 5 Aletas metálicas de resfriamento do Magnetron
    for (let f = 0; f < 5; f++) {
      const fin = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.42, 0.42, 2, 0.005), stdMat('#CBD5E1', 0.3, 0.7));
      fin.position.set(-0.12 + f * 0.06, 0, 0);
      magnetronGroup.add(fin);
    }

    // Antena emissora de micro-ondas apontada para a comida à esquerda
    const antennaGlowMat = new THREE.MeshStandardMaterial({
      color: '#FACC15',
      emissive: '#F59E0B',
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.5,
    });
    const antennaNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.14, 16), stdMat('#B45309', 0.3, 0.7));
    antennaNeck.rotation.z = Math.PI / 2;
    antennaNeck.position.set(-0.22, 0, 0);
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), antennaGlowMat);
    antennaTip.position.set(-0.3, 0, 0);
    magnetronGroup.add(antennaNeck, antennaTip);

    // Feixe de Ondas Senoidais 3D viajando do Magnetron (-1.42) até a comida (-2.35)
    const sineWaveGroup = new THREE.Group();
    scene.add(sineWaveGroup);
    const sineWaveBalls: Array<{mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial}> = [];
    for (let i = 0; i < 42; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: '#FACC15',
        emissive: '#F59E0B',
        emissiveIntensity: 0.65,
        roughness: 0.2,
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 10), mat);
      sineWaveGroup.add(mesh);
      sineWaveBalls.push({mesh, mat});
    }

    // Ondas escapando pela sala inteira antes de colocar a caixa metálica (Ato 4A)
    const strayWavesGroup = new THREE.Group();
    strayWavesGroup.position.set(-1.42, 1.48, -0.3);
    scene.add(strayWavesGroup);
    const strayRings: THREE.Mesh[] = [];
    for (let r = 0; r < 6; r++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.016, 10, 36),
        new THREE.MeshBasicMaterial({color: '#FB923C', transparent: true, opacity: 0.75})
      );
      strayWavesGroup.add(ring);
      strayRings.push(ring);
    }

    // ==================== 5. ATO 4B: CAIXA METÁLICA ESPELHADA (GAIOLA REFLETORA) ====================
    const metalBoxGroup = new THREE.Group();
    metalBoxGroup.position.set(-1.95, 1.44, -0.3);
    scene.add(metalBoxGroup);

    const mirrorSteelMat = new THREE.MeshStandardMaterial({
      color: '#CBD5E1',
      roughness: 0.18,
      metalness: 0.78,
    });
    const boxTopW = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.045, 0.86), mirrorSteelMat);
    boxTopW.position.y = 0.42;
    const boxBotW = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.045, 0.86), mirrorSteelMat);
    boxBotW.position.y = -0.42;
    const boxLeftW = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.88, 0.86), mirrorSteelMat);
    boxLeftW.position.x = -0.57;
    const boxRightW = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.88, 0.86), mirrorSteelMat);
    boxRightW.position.x = 0.57;
    const boxBackW = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.88, 0.045), mirrorSteelMat);
    boxBackW.position.z = -0.41;
    metalBoxGroup.add(boxTopW, boxBotW, boxLeftW, boxRightW, boxBackW);

    // Hélice espalhadora de ondas no teto da caixa metálica
    const stirrerBlades = new THREE.Group();
    stirrerBlades.position.set(0, 0.38, 0);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.012, 0.08), stdMat('#94A3B8', 0.25, 0.8));
      blade.rotation.y = (b * Math.PI) / 2;
      stirrerBlades.add(blade);
    }
    metalBoxGroup.add(stirrerBlades);

    // Raios amarelos refletindo como espelho nas paredes metálicas internas
    const bounceLinesGroup = new THREE.Group();
    const bouncePts = [
      new THREE.Vector3(0.52, 0.04, 0),
      new THREE.Vector3(-0.08, 0.39, 0.08),
      new THREE.Vector3(-0.54, 0.02, -0.06),
      new THREE.Vector3(-0.12, -0.25, 0.04),
      new THREE.Vector3(0.22, 0.38, -0.05),
      new THREE.Vector3(-0.08, -0.18, 0),
    ];
    const bounceCurve = new THREE.CatmullRomCurve3(bouncePts, false, 'catmullrom', 0.05);
    const bounceTube = new THREE.Mesh(
      new THREE.TubeGeometry(bounceCurve, 64, 0.014, 8, false),
      new THREE.MeshBasicMaterial({color: '#FDE047', transparent: true, opacity: 0.85})
    );
    bounceLinesGroup.add(bounceTube);
    metalBoxGroup.add(bounceLinesGroup);

    // ==================== 6. ATO 5: PONTOS QUENTES E FRIOS + MOTORZINHO E PRATO GIRATÓRIO DE VIDRO ====================
    const standingNodesGroup = new THREE.Group();
    standingNodesGroup.position.set(-2.05, 1.32, -0.3);
    scene.add(standingNodesGroup);
    const hotNodes: THREE.Mesh[] = [];
    const coldNodes: THREE.Mesh[] = [];
    [-0.26, 0, 0.26].forEach((nx, idx) => {
      const hNode = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 14, 14),
        new THREE.MeshBasicMaterial({color: '#EF4444', transparent: true, opacity: 0.82})
      );
      hNode.position.set(nx, 0.08, (idx % 2 === 0 ? 1 : -1) * 0.1);
      standingNodesGroup.add(hNode);
      hotNodes.push(hNode);

      const cNode = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.058, 0),
        new THREE.MeshStandardMaterial({color: '#38BDF8', roughness: 0.2, flatShading: true})
      );
      cNode.position.set(nx + 0.13, 0.04, (idx % 2 === 0 ? -1 : 1) * 0.1);
      standingNodesGroup.add(cNode);
      coldNodes.push(cNode);
    });

    // Motorzinho dourado sob a caixa + anel de rodinhas + Prato de Vidro Giratório
    const turntableGroup = new THREE.Group();
    turntableGroup.position.set(-2.05, 1.03, -0.3);
    scene.add(turntableGroup);

    const motorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 20), stdMat('#D97706', 0.35, 0.65));
    motorBody.position.y = -0.11;
    const motorShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.12, 12), stdMat('#FBBF24', 0.3, 0.7));
    motorShaft.position.y = -0.02;
    const glassPlateMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.43, 0.025, 36),
      new THREE.MeshPhysicalMaterial({
        color: '#BAE6FD',
        transparent: true,
        opacity: 0.55,
        roughness: 0.12,
      })
    );
    glassPlateMesh.position.y = 0.005;
    turntableGroup.add(motorBody, motorShaft, glassPlateMesh);

    // ==================== 7. ATO 6: PORTA COM CHAPA METÁLICA FURADINHA (GAIOLA DE FARADAY VS LUZ VISÍVEL) ====================
    const meshDoorGroup = new THREE.Group();
    // Pivô na dobradiça esquerda da caixa metálica (x = -2.52, y = 1.44, z = +0.13)
    meshDoorGroup.position.set(-2.52, 1.44, 0.13);
    scene.add(meshDoorGroup);

    const doorFrameOuter = new THREE.Group();
    doorFrameOuter.position.set(0.57, 0, 0);
    const dfTop = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.08, 0.04), stdMat('#334155', 0.4, 0.5));
    dfTop.position.y = 0.4;
    const dfBot = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.08, 0.04), stdMat('#334155', 0.4, 0.5));
    dfBot.position.y = -0.4;
    const dfL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.88, 0.04), stdMat('#334155', 0.4, 0.5));
    dfL.position.x = -0.54;
    const dfR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.88, 0.04), stdMat('#334155', 0.4, 0.5));
    dfR.position.x = 0.54;
    doorFrameOuter.add(dfTop, dfBot, dfL, dfR);

    // Grade metálica furadinha visível na porta (barras finas cruzadas deixando furinhos para a luz passar!)
    const gridMat = stdMat('#1E293B', 0.4, 0.6);
    for (let gx = -0.45; gx <= 0.45; gx += 0.09) {
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.74, 0.015), gridMat);
      vBar.position.x = gx;
      doorFrameOuter.add(vBar);
    }
    for (let gy = -0.32; gy <= 0.32; gy += 0.08) {
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.016, 0.015), gridMat);
      hBar.position.y = gy;
      doorFrameOuter.add(hBar);
    }
    meshDoorGroup.add(doorFrameOuter);

    // Onda grande laranja (12 cm) batendo na grade e sendo bloqueada vs Raios finos de Luz Visível atravessando os furinhos
    const blockedWaveRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.022, 12, 32),
      new THREE.MeshBasicMaterial({color: '#FF5733', transparent: true, opacity: 0.9})
    );
    blockedWaveRing.position.set(-1.98, 1.44, 0.02);
    scene.add(blockedWaveRing);

    const lightRaysGroup = new THREE.Group();
    lightRaysGroup.position.set(-1.95, 1.44, 0.15);
    for (let lr = 0; lr < 6; lr++) {
      const ray = new THREE.Mesh(
        new THREE.CylinderGeometry(0.007, 0.007, 0.75, 8),
        new THREE.MeshBasicMaterial({color: '#FEF08A', transparent: true, opacity: 0.85})
      );
      ray.rotation.x = Math.PI / 2;
      ray.position.set(-0.25 + (lr % 3) * 0.25, -0.1 + Math.floor(lr / 3) * 0.2, 0.32);
      lightRaysGroup.add(ray);
    }
    scene.add(lightRaysGroup);

    // Vapor branco low-poly subindo da comida quente
    const steamPuffs: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.065, 0), stdMat('#F8FAFC', 0.85, 0.02, true));
      foodGroup.add(puff);
      steamPuffs.push(puff);
    }

    // ==================== 8. ATO 8: CARCAÇA BRANCA FINAL COM PAINEL DIGITAL, LUZ INTERNA E SININHO DING! ====================
    const outerShellGroup = new THREE.Group();
    outerShellGroup.position.set(-1.82, 1.46, -0.3);
    scene.add(outerShellGroup);

    const shellBody = new THREE.Mesh(
      new RoundedBoxGeometry(1.62, 0.98, 0.96, 4, 0.05),
      stdMat('#F8FAFC', 0.28, 0.08)
    );
    const frontWindow = new THREE.Mesh(
      new RoundedBoxGeometry(1.02, 0.68, 0.04, 3, 0.03),
      new THREE.MeshStandardMaterial({
        color: '#FEF08A',
        emissive: '#F59E0B',
        emissiveIntensity: 0.45,
        roughness: 0.2,
      })
    );
    frontWindow.position.set(-0.18, 0.02, 0.47);
    const handleBar = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.58, 0.06, 3, 0.015), stdMat('#94A3B8', 0.25, 0.7));
    handleBar.position.set(0.26, 0.02, 0.5);

    // Painel digital lateral com visor verde LED e botão giratório de potência
    const panelBg = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.78, 0.04, 3, 0.02), stdMat('#1E293B', 0.35));
    panelBg.position.set(0.56, 0, 0.47);
    const ledScreen = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.12, 0.045),
      new THREE.MeshBasicMaterial({color: '#4ADE80'})
    );
    ledScreen.position.set(0.56, 0.24, 0.475);
    const powerDial = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 20), stdMat('#E2E8F0', 0.3, 0.4));
    powerDial.rotation.x = Math.PI / 2;
    powerDial.position.set(0.56, -0.12, 0.485);
    outerShellGroup.add(shellBody, frontWindow, handleBar, panelBg, ledScreen, powerDial);

    // Anéis dourados sonoros do Sininho ("DING!") no topo do micro-ondas
    const chimeRingsGroup = new THREE.Group();
    chimeRingsGroup.position.set(-1.82, 2.08, -0.1);
    scene.add(chimeRingsGroup);
    const chimeRings: THREE.Mesh[] = [];
    for (let c = 0; c < 3; c++) {
      const cr = new THREE.Mesh(
        new THREE.TorusGeometry(0.18 + c * 0.12, 0.016, 10, 32),
        new THREE.MeshBasicMaterial({color: '#FACC15', transparent: true, opacity: 0.9})
      );
      cr.rotation.x = Math.PI / 3;
      chimeRingsGroup.add(cr);
      chimeRings.push(cr);
    }

    addShadow(houseGroup, false, true);
    addShadow(armchairGroup, true, true);
    addShadow(stoolGroup, true, true);
    addShadow(foodGroup, true, true);
    addShadow(magnetronGroup, true, true);
    addShadow(metalBoxGroup, true, true);
    addShadow(outerShellGroup, true, true);

    ctxRef.current = {
      renderer,
      scene,
      camera,
      clockMinHand,
      clockHourHand,
      charRig,
      foodGroup,
      outerCrustMat,
      frontCrustHalf,
      iceCoreMesh,
      torchGroup,
      flameCone,
      waterMolsGroup,
      waterMols,
      magnetronGroup,
      antennaGlowMat,
      sineWaveGroup,
      sineWaveBalls,
      strayWavesGroup,
      strayRings,
      metalBoxGroup,
      stirrerBlades,
      bounceLinesGroup,
      standingNodesGroup,
      hotNodes,
      coldNodes,
      turntableGroup,
      glassPlateMesh,
      meshDoorGroup,
      lightRaysGroup,
      blockedWaveRing,
      steamPuffs,
      outerShellGroup,
      chimeRingsGroup,
      chimeRings,
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
    ctx.camera.fov = cam.fov ?? 46;
    ctx.camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    ctx.camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);
    ctx.camera.updateProjectionMatrix();
    ctx.camera.updateMatrixWorld();

    // Relógio gira rápido durante "Em dois minutos, ela queima toda por fora" (f175..285)
    const fastClock = N >= 175 && N <= 285 ? (N - 175) * 0.42 : 0;
    ctx.clockMinHand.rotation.z = -(N * 0.025 + fastClock);
    ctx.clockHourHand.rotation.z = -(1.1 + N * 0.0025 + fastClock * 0.1);

    // Expressão do boneco oficial: preocupado quando queima/congela (f190..350) ou quando as ondas escapam (f1045..1160)
    const isWorried = (N >= 190 && N < 355) || (N >= 1045 && N < 1165);
    ctx.charRig.setPose(isWorried ? 'sitting_hot' : 'sitting_cool', N);

    // ==================== ATO 1: MAÇARICO + CORTE COM GELO NO MEIO ====================
    const showTorch = N >= 70 && N < 345;
    ctx.torchGroup.visible = showTorch;
    if (showTorch) {
      ctx.torchGroup.scale.setScalar(pop3D(N - 70, 14));
      ctx.flameCone.scale.set(1, 0.85 + Math.sin(N * 0.8) * 0.22, 1);
    }

    // Casca queimada por fora e corte aberto mostrando o gelo no meio (f195..345)
    const isBurnt = N >= 195 && N < 350;
    const isTranslucentFood = N >= 350 && N < 2265;
    ctx.outerCrustMat.color.set(isBurnt ? '#292524' : '#E07A2E');
    ctx.outerCrustMat.opacity = isTranslucentFood ? 0.34 : 0.96;

    const cutOpen = N >= 250 && N < 350 ? clamp01((N - 250) / 16) : 0;
    ctx.frontCrustHalf.position.z = 0.09 + cutOpen * 0.18;
    ctx.frontCrustHalf.position.x = cutOpen * -0.12;
    ctx.iceCoreMesh.visible = N < 355;

    // ==================== ATO 2 & 3: MOLÉCULAS DE ÁGUA + MAGNETRON + ONDAS SENOIDAIS ====================
    const showMols = N >= 350 && N < 2265;
    ctx.waterMolsGroup.visible = showMols;
    const isAgitated = N >= C.f_magnetron;
    const isHotMols = N >= C.f_atrito - 30;
    if (showMols) {
      ctx.waterMols.forEach((m, idx) => {
        if (isAgitated) {
          const speed = N >= C.f_bilhoes ? 0.55 : 0.25;
          m.group.rotation.z = Math.sin(N * speed + idx) * 2.2;
          m.group.rotation.y = Math.cos(N * speed * 0.8 + idx) * 1.8;
          m.group.position.y = -0.04 + Math.floor(idx / 6) * 0.055 + Math.sin(N * 0.6 + idx) * 0.012;
        } else {
          m.group.rotation.set(0, idx * 0.5, 0);
        }
        m.oMat.color.set(isHotMols ? '#FF5733' : '#0EA5E9');
      });
    }

    const showMagnetron = N >= C.f_magnetron - 18 && N < 2268;
    ctx.magnetronGroup.visible = showMagnetron;
    // No Ato 7 ("liga e desliga o magnetron em pausas"), pulsa a emissão!
    const isPulsingPower = N >= C.f_potencia - 10 && N < 2265;
    const magnetronActive = showMagnetron && (!isPulsingPower || Math.floor(N / 22) % 2 === 0);

    if (showMagnetron) {
      ctx.magnetronGroup.scale.setScalar(pop3D(N - (C.f_magnetron - 18), 14));
      ctx.antennaGlowMat.emissiveIntensity = magnetronActive ? 0.9 + Math.sin(N * 0.4) * 0.3 : 0.08;
    }

    ctx.sineWaveGroup.visible = magnetronActive;
    if (magnetronActive) {
      ctx.sineWaveBalls.forEach((b, i) => {
        const u = i / ctx.sineWaveBalls.length;
        const wx = -1.42 - u * 0.92;
        const phase = u * Math.PI * 5 - N * 0.38;
        const wy = 1.32 + Math.sin(phase) * 0.13;
        const wz = -0.3 + Math.cos(phase) * 0.06;
        b.mesh.position.set(wx, wy, wz);
        b.mat.color.set(Math.sin(phase) >= 0 ? '#FACC15' : '#FB923C');
      });
    }

    // ==================== ATO 4: ONDAS ESCAPANDO PELA SALA -> CAIXA METÁLICA ESPELHADA ====================
    const showStray = N >= C.f_escapam - 15 && N < C.f_caixa;
    ctx.strayWavesGroup.visible = showStray;
    if (showStray) {
      ctx.strayRings.forEach((ring, i) => {
        const p = ((N * 0.035 + i / ctx.strayRings.length) % 1);
        ring.scale.setScalar(0.3 + p * 3.8);
        ring.rotation.set(i * 0.5 + N * 0.02, i * 0.8 + N * 0.03, 0);
        (ring.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.85;
      });
    }

    const showMetalBox = N >= C.f_caixa - 8 && N < 2268;
    ctx.metalBoxGroup.visible = showMetalBox;
    if (showMetalBox) {
      ctx.metalBoxGroup.scale.setScalar(pop3D(N - (C.f_caixa - 8), 15));
      ctx.stirrerBlades.rotation.y = N * 0.22;
      ctx.bounceLinesGroup.visible = magnetronActive && N < C.f_porta;
    }

    // ==================== ATO 5: PONTOS QUENTES/FRIOS -> PRATO GIRATÓRIO ====================
    const showNodes = N >= C.f_pontos - 10 && N < C.f_prato + 35;
    ctx.standingNodesGroup.visible = showNodes;
    if (showNodes) {
      const fadeOut = N >= C.f_prato ? 1 - clamp01((N - C.f_prato) / 30) : 1;
      ctx.standingNodesGroup.scale.setScalar(pop3D(N - (C.f_pontos - 10), 12) * Math.max(0.001, fadeOut));
    }

    const showTurntable = N >= C.f_prato - 8 && N < 2268;
    ctx.turntableGroup.visible = showTurntable;
    if (showTurntable) {
      ctx.turntableGroup.scale.setScalar(pop3D(N - (C.f_prato - 8), 14));
      ctx.glassPlateMesh.rotation.y = N * 0.06;
      ctx.foodGroup.rotation.y = N * 0.06;
    } else {
      ctx.foodGroup.rotation.y = 0;
    }

    // No Ato 7 ("Como o vidro e a louça quase não têm água, as ondas passam direto sem esquentar o prato!"), destaca o vidro azul frio
    const highlightGlass = N >= C.f_vidro - 12 && N < C.f_potencia;
    (ctx.glassPlateMesh.material as THREE.MeshPhysicalMaterial).color.set(highlightGlass ? '#38BDF8' : '#BAE6FD');
    (ctx.glassPlateMesh.material as THREE.MeshPhysicalMaterial).opacity = highlightGlass ? 0.82 : 0.55;

    // ==================== ATO 6: PORTA COM TELA FURADINHA (ONDA 12CM BLOQUEADA VS LUZ VISÍVEL) ====================
    const showDoor = N >= C.f_porta - 10 && N < 2268;
    ctx.meshDoorGroup.visible = showDoor;
    const showDoorDemo = N >= C.f_doze - 12 && N < C.f_vidro - 10;
    ctx.blockedWaveRing.visible = showDoorDemo;
    ctx.lightRaysGroup.visible = showDoorDemo;
    if (showDoor) {
      const closeProg = easeInOutPow(2)(clamp01((N - (C.f_porta - 10)) / 22));
      // Porta fecha girando da abertura (-1.8 rad) até fechar (0 rad) na frente da caixa
      ctx.meshDoorGroup.rotation.y = (1 - closeProg) * -1.75;
      if (showDoorDemo) {
        const bounceP = (N * 0.06) % 1;
        const zWave = -0.15 + Math.sin(bounceP * Math.PI) * 0.25;
        ctx.blockedWaveRing.position.z = zWave;
        ctx.blockedWaveRing.scale.setScalar(0.85 + Math.sin(bounceP * Math.PI) * 0.25);
      }
    }

    // Vapor subindo da comida quente (a partir de f_atrito até fechar na carcaça)
    const showSteam = N >= C.f_atrito && N < 2268;
    ctx.steamPuffs.forEach((puff, i) => {
      puff.visible = showSteam;
      if (showSteam) {
        const p = (N * 0.028 + i / ctx.steamPuffs.length) % 1;
        puff.position.set(Math.sin(N * 0.07 + i) * 0.1, 0.26 + p * 0.55, Math.cos(N * 0.07 + i) * 0.08);
        puff.scale.setScalar((0.5 + p * 0.9) * (1 - p * 0.7));
      }
    });

    // ==================== ATO 8: CARCAÇA BRANCA FINAL + SININHO CLÁSSICO DING! ====================
    const showOuterShell = N >= 2265;
    ctx.outerShellGroup.visible = showOuterShell;
    ctx.foodGroup.visible = !showOuterShell;
    if (showOuterShell) {
      ctx.outerShellGroup.scale.setScalar(pop3D(N - 2265, 16));
    }

    const showChime = N >= C.f_sininho - 5;
    ctx.chimeRingsGroup.visible = showChime;
    if (showChime) {
      ctx.chimeRings.forEach((cr, i) => {
        const p = ((N * 0.04 + i * 0.33) % 1);
        cr.position.y = p * 0.45;
        cr.scale.setScalar(0.6 + p * 1.1);
        (cr.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.9;
      });
    }

    ctx.renderer.render(ctx.scene, ctx.camera);
  }, [N]);

  return <canvas ref={canvasRef} width={1080} height={1920} style={{width: 1080, height: 1920, display: 'block'}} />;
};

