import React, {useLayoutEffect, useRef} from 'react';
import * as THREE from 'three';
import {clamp01, easeInOutPow, BEZ_SCALE_IN} from '../../common';
import {
  createDesmontandoCharacter,
  createBeveledArmchair,
  createRibbedIceBucket,
  DesmontandoCharacterRig,
} from './DesmontandoRig';

export type ScreenAnchor = {x: number; y: number; visible: boolean};
export type AnchorMap = Record<string, ScreenAnchor>;

type CamKeyframe = {
  f: number;
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
};

const CAM_KEYS: CamKeyframe[] = [
  // Cena 1: Sala ampla (calor + balde entra na visão aberta) -> aproxima no balde de gelo -> 2 horas depois
  {f: 1, pos: [-2.35, 2.45, 6.85], look: [-2.35, 1.32, -0.45], fov: 50},
  {f: 215, pos: [-2.3, 2.4, 6.55], look: [-2.3, 1.32, -0.45], fov: 50},
  {f: 255, pos: [-1.95, 2.15, 3.45], look: [-2.05, 1.35, -0.3], fov: 46},
  {f: 290, pos: [-1.9, 2.25, 3.05], look: [-2.05, 1.38, -0.3], fov: 45},
  {f: 360, pos: [-1.9, 2.25, 3.05], look: [-2.05, 1.38, -0.3], fov: 45},

  // Cena 2: Tanque rosa (-50°C) -> afasta para mostrar a espiral de cobre (Evaporador) + vapor + seta tracejada do ciclo
  {f: 385, pos: [-1.95, 2.05, 3.25], look: [-2.05, 1.42, -0.3], fov: 46},
  {f: 545, pos: [-1.95, 2.05, 3.25], look: [-2.05, 1.42, -0.3], fov: 46},
  {f: 580, pos: [-2.2, 2.2, 4.45], look: [-2.0, 1.5, -0.3], fov: 48},
  {f: 755, pos: [-2.1, 2.25, 4.35], look: [-1.95, 1.5, -0.3], fov: 48},

  // Cena 3: Primeiro mostra o arco do ciclo na sala (f758..825), depois abre para o corte da Casa Inteira (f830..915)
  {f: 775, pos: [-2.05, 2.2, 4.65], look: [-1.85, 1.45, -0.3], fov: 48},
  {f: 822, pos: [-2.05, 2.2, 4.65], look: [-1.85, 1.45, -0.3], fov: 48},
  {f: 855, pos: [-0.8, 3.1, 11.2], look: [-0.8, 1.75, -0.4], fov: 50},
  {f: 912, pos: [-0.6, 3.1, 10.8], look: [-0.6, 1.75, -0.4], fov: 50},

  // Cena 4: Move suavemente para o Quintal focando no Compressor Preto + Bomba de Pneu Vermelha
  {f: 945, pos: [2.75, 2.35, 4.85], look: [1.25, 1.1, -0.3], fov: 48},
  {f: 1240, pos: [2.85, 2.3, 4.65], look: [1.35, 1.15, -0.3], fov: 48},

  // Cena 5: Desliza para o lado mostrando a grade de cobre do Condensador + Ventilador Externo
  {f: 1280, pos: [3.35, 2.4, 5.45], look: [1.85, 1.15, -0.3], fov: 48},
  {f: 1505, pos: [3.25, 2.35, 5.25], look: [1.85, 1.15, -0.3], fov: 48},

  // Cena 6: Volta para dentro da sala em close-up na Válvula de Expansão dourada ("furinho")
  {f: 1545, pos: [-1.42, 1.72, 2.45], look: [-1.68, 1.28, -0.3], fov: 44},
  {f: 1650, pos: [-1.55, 1.85, 2.95], look: [-1.85, 1.38, -0.3], fov: 46},
  {f: 1792, pos: [-1.75, 1.95, 3.45], look: [-1.95, 1.4, -0.3], fov: 46},

  // Cena 7A (f1803..1854): Pingos na bandeja + Copo gelado suando na sala
  {f: 1815, pos: [-1.85, 1.95, 3.85], look: [-1.85, 0.95, 0.1], fov: 46},
  {f: 1850, pos: [-1.85, 1.95, 3.85], look: [-1.85, 0.95, 0.1], fov: 46},

  // Cena 7B (f1855..1900): Mangueirinha branca do DRENO lá fora pingando na poça d'água
  {f: 1868, pos: [1.55, 2.05, 3.45], look: [0.52, 0.42, 0.15], fov: 45},
  {f: 1898, pos: [1.55, 2.05, 3.45], look: [0.52, 0.42, 0.15], fov: 45},

  // Cena 7C (f1901..1980): Motor INVERTER + Velocímetro de VELOCIDADE no compressor externo
  {f: 1916, pos: [2.85, 2.35, 4.85], look: [1.35, 1.18, -0.3], fov: 47},
  {f: 1978, pos: [2.85, 2.35, 4.85], look: [1.35, 1.18, -0.3], fov: 47},

  // Cena 8: Zoom out final para a Casa Inteira com o Split Branco na parede e a Condensadora Externa montada!
  {f: 2010, pos: [-0.7, 3.1, 11.0], look: [-0.7, 1.8, -0.4], fov: 50},
  {f: 2222, pos: [-0.7, 3.1, 10.6], look: [-0.7, 1.8, -0.4], fov: 50},
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

const sharedCam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.1, 100);

export function getScreenAnchors(N: number): AnchorMap {
  const cam = sampleCamera(N);
  sharedCam.fov = cam.fov ?? 40;
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
    chair: proj(-3.55, 2.15, -0.65),
    stoolTop: proj(-2.05, 2.02, -0.3),
    stoolHigh: proj(-2.05, 2.38, -0.3),
    fanTop: proj(-0.82, 1.98, 0.35),
    compressorTop: proj(0.95, 1.38, -0.3),
    compressorMid: proj(0.95, 1.05, -0.3),
    pumpTop: proj(1.58, 1.25, 0.12),
    condenserTop: proj(2.05, 1.42, -0.3),
    condenserBot: proj(2.05, 0.22, 0.2),
    valve: proj(-1.58, 1.12, -0.3),
    valveLow: proj(-1.58, 0.72, -0.3),
    valveHigh: proj(-1.68, 1.52, -0.3),
    drainTip: proj(0.52, 0.35, 0.25),
    splitWall: proj(-2.15, 3.65, -2.8),
    yardSky: proj(2.2, 2.25, -1.5),
  };
}

const pop3D = (n: number, dur = 14) => (n <= 0 ? 0.0001 : Math.max(0.0001, BEZ_SCALE_IN(clamp01(n / dur))));

export const ThreeDioramaStage: React.FC<{
  N: number;
}> = ({N}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    clockMinHand: THREE.Object3D;
    clockHourHand: THREE.Object3D;
    indoorFanBlades: THREE.Object3D;
    outdoorFanBlades: THREE.Object3D;
    bucketGroup: THREE.Group;
    iceCubesGroup: THREE.Group;
    waterMesh: THREE.Mesh;
    pinkTankGroup: THREE.Group;
    tankBubbles: THREE.Mesh[];
    evapGroup: THREE.Group;
    evapCurve: THREE.CatmullRomCurve3;
    evapBalls: Array<{mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial}>;
    steamPuffs: THREE.Mesh[];
    valveBrassGroup: THREE.Group;
    closedLoopGroup: THREE.Group;
    loopCurve: THREE.CatmullRomCurve3;
    loopBalls: Array<{mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial}>;
    compressorGroup: THREE.Group;
    pumpGroup: THREE.Group;
    pumpPlunger: THREE.Group;
    condenserGroup: THREE.Group;
    condenserCurve: THREE.CatmullRomCurve3;
    condenserBalls: Array<{mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial}>;
    waterDropsGroup: THREE.Group;
    waterDrops: THREE.Mesh[];
    sodaGlassGroup: THREE.Group;
    drainPipeGroup: THREE.Group;
    extDrainDrops: THREE.Mesh[];
    drainPuddle: THREE.Mesh;
    finishedACGroup: THREE.Group;
    stoolGroup: THREE.Group;
    indoorFanGroup: THREE.Group;
    windStreaksGroup: THREE.Group;
    windStreaks: Array<{mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial}>;
    heatGemsGroup: THREE.Group;
    heatGems: Array<{mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial}>;
    heatStreaksGroup: THREE.Group;
    heatStreaks: THREE.Mesh[];
    charRig: DesmontandoCharacterRig;
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
    renderer.toneMappingExposure = 1.26;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#69B3F5');

    const camera = new THREE.PerspectiveCamera(48, 1080 / 1920, 0.1, 100);

    // ---- ILUMINAÇÃO 3D REALISTA E ACONCHEGANTE ----
    const hemiLight = new THREE.HemisphereLight('#FFFDF9', '#C89B68', 1.15);
    hemiLight.position.set(0, 12, 0);
    scene.add(hemiLight);

    const roomLight = new THREE.PointLight('#FFF7E8', 1.38, 14, 1.2);
    roomLight.position.set(-2.6, 3.6, 2.2);
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

    // ==================== 1. ESTRUTURA DA CASA E SALA (x: -6.2 .. 0) ====================
    const houseGroup = new THREE.Group();
    scene.add(houseGroup);

    // Piso da sala em tábuas 3D com juntas escuras
    const floorBase = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.25, 6.6), stdMat('#8D582C', 0.8));
    floorBase.position.set(-3.1, -0.125, 0);
    houseGroup.add(floorBase);

    const plankColors = ['#C68952', '#BA7D47', '#CE945C', '#B47640'];
    for (let i = 0; i < 14; i++) {
      const zPos = -3.0 + i * 0.46;
      const splitX = -3.1 + ((i * 1.7) % 2.4) - 1.2;
      const leftLen = splitX - -6.25;
      const rightLen = 0.05 - splitX;
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

    // Feixe de sol projetado pela janela no chão e parede
    const sunPatchFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.9),
      new THREE.MeshBasicMaterial({color: '#FFFBEB', transparent: true, opacity: 0.26})
    );
    sunPatchFloor.rotation.x = -Math.PI / 2;
    sunPatchFloor.rotation.z = -0.18;
    sunPatchFloor.position.set(-3.2, 0.032, -0.85);
    houseGroup.add(sunPatchFloor);

    // Tapete terracota na sala com centro amarelo-mostarda e borda terracota (acima das tábuas e sob a poltrona, terminando antes do banquinho!)
    const rugBorder = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.028, 2.25), stdMat('#DE7A47', 0.85));
    rugBorder.position.set(-3.42, 0.026, -0.42);
    rugBorder.rotation.y = 0.14;
    houseGroup.add(rugBorder);

    const rugInner = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.032, 1.85), stdMat('#F3BC68', 0.85));
    rugInner.position.set(-3.42, 0.03, -0.42);
    rugInner.rotation.y = 0.14;
    houseGroup.add(rugInner);

    // Parede de fundo da sala (z = -3.1) COM JANELA VAZADA atrás da poltrona (x = -4.35 .. -2.75, y = 1.45 .. 3.35)
    // permitindo ver a grama verde, árvore e cerquinha branca lá fora igual ao vídeo original!
    const wallBackMat = stdMat('#EFE6D5', 0.85);
    const bwBottom = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.45, 0.22), wallBackMat);
    bwBottom.position.set(-3.1, 0.725, -3.1);
    const bwTop = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.95, 0.22), wallBackMat);
    bwTop.position.set(-3.1, 3.825, -3.1);
    const bwLeft = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.9, 0.22), wallBackMat);
    bwLeft.position.set(-5.35, 2.4, -3.1);
    const bwRight = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.9, 0.22), wallBackMat);
    bwRight.position.set(-1.4, 2.4, -3.1);
    houseGroup.add(bwBottom, bwTop, bwLeft, bwRight);

    // Moldura Branca 3D da Janela de Fundo (atrás da poltrona)
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

    // Feixe volumétrico translúcido de luz solar descendo da janela sobre o boneco e o tapete
    const sunBeamVolume = new THREE.Mesh(
      new THREE.PlaneGeometry(1.58, 3.65),
      new THREE.MeshBasicMaterial({
        color: '#FFF9D2',
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    sunBeamVolume.position.set(-3.38, 1.62, -0.75);
    sunBeamVolume.rotation.z = 0.08;
    sunBeamVolume.rotation.y = 0.18;
    houseGroup.add(sunBeamVolume);

    // Gramado externo elevado + Cerquinha branca visíveis através da janela da sala (idêntico à foto original!)
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
    houseGroup.add(wRail1, wRail2);

    // Tronco de árvore visível lá fora através da janela (igual à imagem original!)
    const winTreeTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.4, 10), stdMat('#8B5A2B', 0.85));
    winTreeTrunk.position.set(-3.75, 2.35, -3.72);
    houseGroup.add(winTreeTrunk);

    // Rodapé creme
    const baseboard = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 0.26), stdMat('#DCD0BC', 0.75));
    baseboard.position.set(-3.1, 0.08, -3.08);
    houseGroup.add(baseboard);

    // Parede Esquerda com Janela Vazada (x = -6.2)
    const leftWallBot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.25, 6.6), stdMat('#E8DEC9', 0.85));
    leftWallBot.position.set(-6.2, 0.625, 0);
    const leftWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.05, 6.6), stdMat('#E8DEC9', 0.85));
    leftWallTop.position.set(-6.2, 3.775, 0);
    const leftWallBack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.0, 1.2), stdMat('#E8DEC9', 0.85));
    leftWallBack.position.set(-6.2, 2.25, -2.7);
    const leftWallFront = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.0, 3.4), stdMat('#E8DEC9', 0.85));
    leftWallFront.position.set(-6.2, 2.25, 1.6);
    houseGroup.add(leftWallBot, leftWallTop, leftWallBack, leftWallFront);

    // Moldura Branca 3D da Janela
    const winFrameMat = stdMat('#F7F5F0', 0.5);
    const wfTop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 2.1), winFrameMat);
    wfTop.position.set(-6.18, 3.22, -1.1);
    const wfBot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 2.2), winFrameMat);
    wfBot.position.set(-6.15, 1.25, -1.1);
    const wfMidV = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.0, 0.09), winFrameMat);
    wfMidV.position.set(-6.18, 2.25, -1.1);
    const wfMidH = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 2.0), winFrameMat);
    wfMidH.position.set(-6.18, 2.25, -1.1);
    houseGroup.add(wfTop, wfBot, wfMidV, wfMidH);

    // Parede Divisória Direita (entre a Sala e o Quintal, x = 0)
    const divWall = new THREE.Mesh(new THREE.BoxGeometry(0.28, 4.3, 6.6), stdMat('#EADFCB', 0.82));
    divWall.position.set(0, 2.15, 0);
    houseGroup.add(divWall);

    // Revestimento externo de tábuas na parede divisória (x = +0.16)
    for (let i = 0; i < 14; i++) {
      const siding = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.3, 6.6),
        stdMat(i % 2 === 0 ? '#D4B48C' : '#C7A57B', 0.75)
      );
      siding.position.set(0.16, 0.2 + i * 0.3, 0);
      houseGroup.add(siding);
    }

    // Telhado 3D Terracota/Marrom acima da sala
    const roofGroup = new THREE.Group();
    const ceilingBeam = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.24, 6.6), stdMat('#C59B6D', 0.7));
    ceilingBeam.position.set(-3.1, 4.35, 0);
    roofGroup.add(ceilingBeam);

    const roofLeft = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.22, 6.8), stdMat('#B84A27', 0.75));
    roofLeft.position.set(-4.75, 5.25, 0);
    roofLeft.rotation.z = Math.PI * 0.16;
    const roofRight = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.22, 6.8), stdMat('#9E3B1C', 0.75));
    roofRight.position.set(-1.45, 5.25, 0);
    roofRight.rotation.z = -Math.PI * 0.16;
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.2, 0.55), stdMat('#8F3218', 0.8));
    chimney.position.set(-2.1, 5.65, -1.2);
    roofGroup.add(roofLeft, roofRight, chimney);
    houseGroup.add(roofGroup);

    // Relógio 3D na parede de fundo com marcações de horas
    const clockGroup = new THREE.Group();
    clockGroup.position.set(-4.85, 3.25, -2.96);
    const clockRim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 32), stdMat('#2B1D12', 0.5));
    clockRim.rotation.x = Math.PI / 2;
    const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.09, 32), stdMat('#FFFFFF', 0.4));
    clockFace.rotation.x = Math.PI / 2;
    clockGroup.add(clockRim, clockFace);

    for (let h = 0; h < 12; h++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.015), stdMat('#1E1E1E', 0.5));
      const a = (h / 12) * Math.PI * 2;
      tick.position.set(Math.sin(a) * 0.26, Math.cos(a) * 0.26, 0.052);
      tick.rotation.z = -a;
      clockGroup.add(tick);
    }

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

    // Quadro da Montanha 3D com Sol amarelo na parede (à direita da janela, acima do balde, igual ao original!)
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

    // ==================== 2. QUINTAL EXTERNO (x: 0 .. +8, Gramado + Cerquinha + Árvores Low-Poly) ====================
    const yardGroup = new THREE.Group();
    scene.add(yardGroup);

    const lawn = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.25, 8.5), stdMat('#68B030', 0.85));
    lawn.position.set(4.8, -0.125, -0.5);
    yardGroup.add(lawn);

    const soil = new THREE.Mesh(new THREE.BoxGeometry(18.0, 4.5, 6.6), stdMat('#8B5A2B', 0.9));
    soil.position.set(1.2, -2.45, 0);
    yardGroup.add(soil);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.12, 1.65), stdMat('#9CA3AF', 0.75));
    pad.position.set(1.5, 0.06, -0.3);
    yardGroup.add(pad);

    // Cerquinha branca 3D ao fundo do quintal
    const fenceGroup = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const picket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.35, 0.06), stdMat('#F8FAFC', 0.5));
      picket.position.set(-8.0 + i * 0.85, 0.675, -3.6);
      fenceGroup.add(picket);
    }
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(16.0, 0.1, 0.08), stdMat('#E2E8F0', 0.5));
    rail1.position.set(-0.5, 0.95, -3.58);
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(16.0, 0.1, 0.08), stdMat('#E2E8F0', 0.5));
    rail2.position.set(-0.5, 0.45, -3.58);
    fenceGroup.add(rail1, rail2);
    yardGroup.add(fenceGroup);

    // Árvores Low-Poly 3D Facetadas
    const treePositions = [
      [-7.2, -4.4],
      [-5.1, -4.6],
      [1.2, -4.3],
      [2.8, -4.5],
      [4.5, -4.2],
    ];
    treePositions.forEach(([tx, tz], idx) => {
      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.5, 7), stdMat('#6E4726', 0.85, 0.05, true));
      trunk.position.y = 0.75;
      const crown = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.95 + (idx % 2) * 0.2, 0),
        stdMat(idx % 2 === 0 ? '#2E8B22' : '#399E2D', 0.75, 0.05, true)
      );
      crown.position.y = 2.05;
      tree.add(trunk, crown);
      yardGroup.add(tree);
    });

    // Nuvens 3D Low-Poly no céu
    [
      [-3.5, 6.6, -2.5],
      [1.8, 6.8, -2.8],
    ].forEach(([cx, cy, cz]) => {
      const cloud = new THREE.Group();
      cloud.position.set(cx, cy, cz);
      [-0.6, 0, 0.6].forEach((dx, i) => {
        const puff = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.55 + (i === 1 ? 0.15 : 0), 1),
          stdMat('#FFFFFF', 0.9, 0.02, true)
        );
        puff.position.set(dx, i === 1 ? 0.12 : 0, 0);
        puff.scale.y = 0.65;
        cloud.add(puff);
      });
      scene.add(cloud);
    });

    // ==================== 3. POLTRONA VERDE CHANFRADA + BONECO RIGADO OFICIAL (@desmontandoomundo) ====================
    const armchairGroup = createBeveledArmchair();
    armchairGroup.position.set(-3.55, 0, -0.62);
    armchairGroup.rotation.y = Math.PI * 0.28;
    scene.add(armchairGroup);

    const charRig = createDesmontandoCharacter();
    // Posiciona o quadril sobre a almofada (y=0.67) e z=0.09 para que os joelhos fiquem em z=+0.52 (totalmente fora da poltrona!)
    charRig.root.position.set(0, 0.67, 0.09);
    armchairGroup.add(charRig.root);

    // ==================== 4. BANQUINHO DE MADEIRA 3D (x = -2.05, z = -0.3) ====================
    const stoolGroup = new THREE.Group();
    stoolGroup.position.set(-2.05, 0, -0.3);
    scene.add(stoolGroup);

    const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.1, 32), stdMat('#B87842', 0.65));
    stoolSeat.position.y = 0.96;
    stoolGroup.add(stoolSeat);
    [
      [-0.32, -0.32],
      [0.32, -0.32],
      [-0.32, 0.32],
      [0.32, 0.32],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.035, 0.96, 12), stdMat('#8C5425', 0.7));
      leg.position.set(lx, 0.48, lz);
      leg.rotation.z = lx * 0.18;
      leg.rotation.x = -lz * 0.18;
      stoolGroup.add(leg);
    });

    // ==================== 5. VENTILADOR DE PEDESTAL COM GRADE RADIAL DETALHADA (x = -0.82, z = +0.35) ====================
    const indoorFanGroup = new THREE.Group();
    indoorFanGroup.position.set(-0.82, 0, 0.35);
    indoorFanGroup.rotation.y = -Math.PI * 0.38;
    scene.add(indoorFanGroup);

    const fanBase = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 28), stdMat('#F8FAFC', 0.4));
    fanBase.position.y = 0.04;
    const fanPole = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 1.45, 16), stdMat('#E2E8F0', 0.35));
    fanPole.position.y = 0.76;

    // Botões coloridos no pedestal do ventilador
    ['#3B82F6', '#FACC15', '#EF4444'].forEach((bc, bi) => {
      const btn = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 0.025), stdMat(bc, 0.4));
      btn.position.set(0, 0.95 - bi * 0.045, 0.05);
      indoorFanGroup.add(btn);
    });

    // Motor traseiro do ventilador
    const fanMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.28, 18), stdMat('#E2E8F0', 0.4));
    fanMotor.rotation.x = Math.PI / 2;
    fanMotor.position.set(0, 1.52, -0.04);

    // Grade radial de arame 3D (aros + 12 raios metálicos)
    const fanCageGroup = new THREE.Group();
    fanCageGroup.position.set(0, 1.52, 0.12);
    const cageRingFront = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.018, 10, 32), stdMat('#CBD5E1', 0.35, 0.3));
    const cageRingMid = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.01, 8, 28), stdMat('#CBD5E1', 0.35, 0.3));
    cageRingMid.position.z = 0.03;
    for (let s = 0; s < 12; s++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.86, 6), stdMat('#CBD5E1', 0.4, 0.3));
      spoke.rotation.z = (s * Math.PI) / 12;
      spoke.position.z = 0.02;
      fanCageGroup.add(spoke);
    }
    const centerBadge = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 18), stdMat('#F8FAFC', 0.3));
    centerBadge.rotation.x = Math.PI / 2;
    centerBadge.position.z = 0.035;
    fanCageGroup.add(cageRingFront, cageRingMid, centerBadge);

    const indoorFanBlades = new THREE.Group();
    indoorFanBlades.position.set(0, 1.52, 0.1);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.36, 0.018), stdMat('#60A5FA', 0.32));
      blade.position.y = 0.18;
      blade.rotation.y = 0.28;
      const piv = new THREE.Group();
      piv.rotation.z = (i * Math.PI) / 2;
      piv.add(blade);
      indoorFanBlades.add(piv);
    }
    indoorFanGroup.add(fanBase, fanPole, fanMotor, fanCageGroup, indoorFanBlades);

    // Listras 3D de vento soprando na sala (inclinadas suavemente como no vídeo original!)
    const windStreaksGroup = new THREE.Group();
    scene.add(windStreaksGroup);
    const windStreaks: Array<{mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial}> = [];
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: '#F5D061',
        roughness: 0.3,
        transparent: true,
        opacity: 0.78,
      });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.48 + (i % 3) * 0.14, 8), mat);
      mesh.rotation.z = Math.PI / 2 - 0.15;
      windStreaksGroup.add(mesh);
      windStreaks.push({mesh, mat});
    }

    // Octaedros/Icosaedros Low-Poly de Calor flutuando no ar da sala (exatamente como no original!)
    const heatGemsGroup = new THREE.Group();
    scene.add(heatGemsGroup);
    const heatGems: Array<{mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial}> = [];
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: '#FF7828',
        roughness: 0.35,
        flatShading: true,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.058, 0), mat);
      heatGemsGroup.add(mesh);
      heatGems.push({mesh, mat});
    }

    // ==================== 6. BALDE DE GELO FRISADO 3D COM ALÇA CURVA (Cena 1) ====================
    const {bucketGroup, iceCubesGroup, waterMesh} = createRibbedIceBucket();
    bucketGroup.position.set(-2.05, 1.01, -0.3);
    scene.add(bucketGroup);

    // ==================== 7. CILINDRO TRANSPARENTE COM TAMPA ROSA (-50°C, Cena 2) ====================
    const pinkTankGroup = new THREE.Group();
    pinkTankGroup.position.set(-2.05, 1.01, -0.3);
    scene.add(pinkTankGroup);

    const tankBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 28), stdMat('#D6336C', 0.4));
    tankBase.position.y = 0.04;
    const tankGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.78, 28),
      new THREE.MeshPhysicalMaterial({color: '#BAE6FD', transparent: true, opacity: 0.48, roughness: 0.15})
    );
    tankGlass.position.y = 0.43;
    const tankCap = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.09, 28), stdMat('#E64980', 0.4));
    tankCap.position.y = 0.84;
    const tankTopHandle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 12, 24), stdMat('#F06595', 0.4));
    tankTopHandle.rotation.x = Math.PI / 2;
    tankTopHandle.position.y = 0.91;
    pinkTankGroup.add(tankBase, tankGlass, tankCap, tankTopHandle);

    const tankBubbles: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.048 + (i % 3) * 0.015, 0), stdMat('#FFFFFF', 0.2, 0.02, true));
      pinkTankGroup.add(b);
      tankBubbles.push(b);
    }

    // ==================== 8. SERPENTINA HELICOIDAL DE COBRE 3D (EVAPORADOR + VÁLVULA DE EXPANSÃO) ====================
    const evapGroup = new THREE.Group();
    evapGroup.position.set(-2.05, 1.01, -0.3);
    scene.add(evapGroup);

    const tray = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.05, 0.75), stdMat('#94A3B8', 0.4, 0.4));
    tray.position.y = 0.025;
    evapGroup.add(tray);

    const helixPts: THREE.Vector3[] = [];
    helixPts.push(new THREE.Vector3(0.45, -0.35, 0));
    helixPts.push(new THREE.Vector3(0.45, 0.15, 0));
    const turns = 6;
    const segs = 120;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const angle = u * turns * Math.PI * 2;
      const hx = 0.38 - u * 0.76;
      const hy = 0.44 + Math.sin(angle) * 0.32;
      const hz = Math.cos(angle) * 0.26;
      helixPts.push(new THREE.Vector3(hx, hy, hz));
    }
    helixPts.push(new THREE.Vector3(-0.38, 0.92, 0));
    const evapCurve = new THREE.CatmullRomCurve3(helixPts);

    const copperGlassMat = new THREE.MeshPhysicalMaterial({
      color: '#E08A4E',
      transparent: true,
      opacity: 0.5,
      roughness: 0.2,
      metalness: 0.25,
    });
    const evapTube = new THREE.Mesh(new THREE.TubeGeometry(evapCurve, 180, 0.052, 14, false), copperGlassMat);
    evapGroup.add(evapTube);

    // 44 Esferas 3D sombreadas viajando dentro da hélice 3D
    const evapBalls: Array<{mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial}> = [];
    for (let i = 0; i < 44; i++) {
      const mat = stdMat('#3B82F6', 0.25, 0.1);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 12), mat);
      evapGroup.add(mesh);
      evapBalls.push({mesh, mat});
    }

    // Nuvens 3D Low-Poly de vapor branco saindo da chaminé (Cena 2)
    const steamPuffs: THREE.Mesh[] = [];
    for (let i = 0; i < 9; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.095, 0), stdMat('#F8FAFC', 0.85, 0.02, true));
      evapGroup.add(puff);
      steamPuffs.push(puff);
    }

    // Válvula de Expansão Dourada 3D com porcas sextavadas ("furinho")
    const valveBrassGroup = new THREE.Group();
    valveBrassGroup.position.set(0.45, -0.05, 0);
    const brassMat = stdMat('#B45309', 0.3, 0.65);
    const vTop = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.09, 6), brassMat);
    vTop.position.y = 0.12;
    const vNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.12, 12), stdMat('#78350F', 0.35, 0.7));
    const vBot = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.09, 6), brassMat);
    vBot.position.y = -0.12;
    valveBrassGroup.add(vTop, vNeck, vBot);
    evapGroup.add(valveBrassGroup);

    // ==================== 9. TUBULAÇÃO FECHADA ATRAVESSANDO A PAREDE ATÉ O QUINTAL ====================
    const closedLoopGroup = new THREE.Group();
    scene.add(closedLoopGroup);
    const loopPts = [
      new THREE.Vector3(-2.43, 1.9, -0.3),
      new THREE.Vector3(-2.43, 1.05, -0.3),
      new THREE.Vector3(0.95, 1.05, -0.3),
      new THREE.Vector3(0.95, 0.45, -0.3),
      new THREE.Vector3(-1.6, 0.45, -0.3),
      new THREE.Vector3(-1.6, 1.0, -0.3),
    ];
    const loopCurve = new THREE.CatmullRomCurve3(loopPts);
    const loopTube = new THREE.Mesh(new THREE.TubeGeometry(loopCurve, 100, 0.045, 12, false), copperGlassMat);
    closedLoopGroup.add(loopTube);

    const loopBalls: Array<{mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial}> = [];
    for (let i = 0; i < 28; i++) {
      const mat = stdMat('#38BDF8', 0.25);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), mat);
      closedLoopGroup.add(mesh);
      loopBalls.push({mesh, mat});
    }

    // ==================== 10. COMPRESSOR PRETO 3D + BOMBA DE PNEU VERMELHA 3D (No Quintal) ====================
    const compressorGroup = new THREE.Group();
    compressorGroup.position.set(0.95, 0.12, -0.3);
    scene.add(compressorGroup);

    const compBase = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.72), stdMat('#111827', 0.5, 0.4));
    compBase.position.y = 0.04;
    const compBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.58, 12, 24), stdMat('#181B22', 0.35, 0.4));
    compBody.position.y = 0.52;
    const compSticker = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.04), stdMat('#FACC15', 0.5));
    compSticker.position.set(-0.08, 0.42, 0.27);
    compressorGroup.add(compBase, compBody, compSticker);

    // Bomba de Pneu Vermelha 3D ao lado do Compressor
    const pumpGroup = new THREE.Group();
    pumpGroup.position.set(1.58, 0.12, 0.12);
    scene.add(pumpGroup);

    const pumpBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.68, 20), stdMat('#EF4444', 0.35, 0.2));
    pumpBarrel.position.y = 0.34;
    const pumpFoot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.16), stdMat('#1E293B', 0.5));
    pumpFoot.position.y = 0.025;
    const pumpPlunger = new THREE.Group();
    const pumpRod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.55, 12), stdMat('#CBD5E1', 0.3, 0.6));
    pumpRod.position.y = 0.72;
    const pumpHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.38, 12), stdMat('#1E293B', 0.5));
    pumpHandle.rotation.z = Math.PI / 2;
    pumpHandle.position.y = 0.98;
    pumpPlunger.add(pumpRod, pumpHandle);
    pumpGroup.add(pumpBarrel, pumpFoot, pumpPlunger);

    // ==================== 11. GRADE CONDENSADORA 3D + VENTILADOR EXTERNO 3D (No Quintal) ====================
    const condenserGroup = new THREE.Group();
    condenserGroup.position.set(2.05, 0.12, -0.3);
    scene.add(condenserGroup);

    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 0.06), stdMat('#64748B', 0.5, 0.4));
    postL.position.set(-0.58, 0.52, 0);
    const postR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 0.06), stdMat('#64748B', 0.5, 0.4));
    postR.position.set(0.58, 0.52, 0);
    condenserGroup.add(postL, postR);

    const condPts: THREE.Vector3[] = [];
    for (let r = 0; r < 5; r++) {
      const ry = 0.92 - r * 0.17;
      if (r % 2 === 0) {
        condPts.push(new THREE.Vector3(-0.55, ry, 0.05), new THREE.Vector3(0.55, ry, 0.05));
      } else {
        condPts.push(new THREE.Vector3(0.55, ry, 0.05), new THREE.Vector3(-0.55, ry, 0.05));
      }
    }
    const condenserCurve = new THREE.CatmullRomCurve3(condPts);
    const condTube = new THREE.Mesh(new THREE.TubeGeometry(condenserCurve, 120, 0.042, 12, false), copperGlassMat);
    condenserGroup.add(condTube);

    const condenserBalls: Array<{mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial}> = [];
    for (let i = 0; i < 32; i++) {
      const mat = stdMat('#EF4444', 0.25);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), mat);
      condenserGroup.add(mesh);
      condenserBalls.push({mesh, mat});
    }

    const outdoorFanBlades = new THREE.Group();
    outdoorFanBlades.position.set(0, 0.56, -0.14);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.38, 0.02), stdMat('#334155', 0.5));
      b.position.y = 0.19;
      const piv = new THREE.Group();
      piv.rotation.z = (i * Math.PI) / 2;
      piv.add(b);
      outdoorFanBlades.add(piv);
    }
    condenserGroup.add(outdoorFanBlades);

    // Listras vermelhas 3D de calor sendo sopradas no gramado
    const heatStreaksGroup = new THREE.Group();
    condenserGroup.add(heatStreaksGroup);
    const heatStreaks: THREE.Mesh[] = [];
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 8), stdMat('#EF4444', 0.3));
      m.rotation.x = Math.PI / 2;
      heatStreaksGroup.add(m);
      heatStreaks.push(m);
    }

    // ==================== 12. GOTAS DE CONDENSAÇÃO + COPO GELADO + MANGUEIRINHA DE DRENO EXTERNA ====================
    const waterDropsGroup = new THREE.Group();
    waterDropsGroup.position.set(-2.05, 1.0, -0.3);
    scene.add(waterDropsGroup);
    const waterDrops: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), stdMat('#38BDF8', 0.2));
      waterDropsGroup.add(drop);
      waterDrops.push(drop);
    }

    const sodaGlassGroup = new THREE.Group();
    sodaGlassGroup.position.set(-1.35, 0.02, 0.85);
    const glassCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.15, 0.48, 20),
      new THREE.MeshPhysicalMaterial({color: '#93C5FD', transparent: true, opacity: 0.65, roughness: 0.15})
    );
    glassCup.position.y = 0.24;
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 12), stdMat('#FACC15', 0.4));
    straw.position.set(0.04, 0.34, 0);
    straw.rotation.z = -0.22;
    const glassPuddle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.01, 24), stdMat('#7DD3FC', 0.2));
    glassPuddle.position.y = 0.005;
    sodaGlassGroup.add(glassCup, straw, glassPuddle);
    scene.add(sodaGlassGroup);

    // Cano branco de PVC do DRENO saindo pela parede externa e pingando na poça d'água no gramado (igual 3_dreno_copo_suando.png!)
    const drainPipeGroup = new THREE.Group();
    const drainCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.05, 0.98, -0.1),
      new THREE.Vector3(-0.2, 0.45, 0.2),
      new THREE.Vector3(0.52, 0.42, 0.25),
      new THREE.Vector3(0.52, 0.28, 0.45),
    ]);
    const drainMesh = new THREE.Mesh(new THREE.TubeGeometry(drainCurve, 48, 0.034, 12, false), stdMat('#F8FAFC', 0.35));
    drainPipeGroup.add(drainMesh);

    const drainPuddle = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.012, 28), stdMat('#7DD3FC', 0.2));
    drainPuddle.position.set(0.52, 0.01, 0.45);
    drainPipeGroup.add(drainPuddle);

    const extDrainDrops: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const dd = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 10), stdMat('#38BDF8', 0.15));
      drainPipeGroup.add(dd);
      extDrainDrops.push(dd);
    }
    scene.add(drainPipeGroup);

    // ==================== 13. CARENAGEM FINAL BRANCA (SPLIT NA PAREDE + CONDENSADORA EXTERNA) ====================
    const finishedACGroup = new THREE.Group();
    scene.add(finishedACGroup);

    const splitBox = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.52, 0.42), stdMat('#FFFFFF', 0.3));
    splitBox.position.set(-2.15, 3.15, -2.82);
    const splitVane = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.06, 0.44), stdMat('#94A3B8', 0.4));
    splitVane.position.set(-2.15, 2.94, -2.81);
    const splitLed = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.43), stdMat('#0F172A', 0.2));
    splitLed.position.set(-1.55, 3.16, -2.815);
    // Tubulação branca discreta ligando o Split até a parede direita
    const wallPipe = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.09, 0.09), stdMat('#F1F5F9', 0.4));
    wallPipe.position.set(-0.6, 3.05, -2.92);
    finishedACGroup.add(splitBox, splitVane, splitLed, wallPipe);

    const outdoorUnitBox = new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.05, 0.65), stdMat('#F8FAFC', 0.35));
    outdoorUnitBox.position.set(1.55, 0.64, -0.3);
    const grilleCircle = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.67, 24), stdMat('#334155', 0.5));
    grilleCircle.rotation.x = Math.PI / 2;
    grilleCircle.position.set(1.35, 0.64, -0.3);
    finishedACGroup.add(outdoorUnitBox, grilleCircle);

    addShadow(houseGroup, false, true);
    leftWallBot.castShadow = true;
    leftWallTop.castShadow = true;
    leftWallBack.castShadow = true;
    leftWallFront.castShadow = true;
    divWall.castShadow = true;
    addShadow(yardGroup, true, true);
    addShadow(armchairGroup, true, true);
    addShadow(stoolGroup, true, true);
    addShadow(indoorFanGroup, true, true);
    addShadow(bucketGroup, true, true);
    addShadow(pinkTankGroup, true, true);
    addShadow(evapGroup, true, true);
    addShadow(compressorGroup, true, true);
    addShadow(pumpGroup, true, true);
    addShadow(condenserGroup, true, true);
    addShadow(finishedACGroup, true, true);

    ctxRef.current = {
      renderer,
      scene,
      camera,
      clockMinHand,
      clockHourHand,
      indoorFanBlades,
      outdoorFanBlades,
      bucketGroup,
      iceCubesGroup,
      waterMesh,
      pinkTankGroup,
      tankBubbles,
      evapGroup,
      evapCurve,
      evapBalls,
      steamPuffs,
      valveBrassGroup,
      closedLoopGroup,
      loopCurve,
      loopBalls,
      compressorGroup,
      pumpGroup,
      pumpPlunger,
      condenserGroup,
      condenserCurve,
      condenserBalls,
      waterDropsGroup,
      waterDrops,
      sodaGlassGroup,
      drainPipeGroup,
      extDrainDrops,
      drainPuddle,
      finishedACGroup,
      stoolGroup,
      indoorFanGroup,
      windStreaksGroup,
      windStreaks,
      heatGemsGroup,
      heatGems,
      heatStreaksGroup,
      heatStreaks,
      charRig,
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

    // Relógio (gira rápido em "2 HORAS DEPOIS" f290..367)
    const fastClock = N >= 290 && N <= 367 ? (N - 290) * 0.45 : 0;
    ctx.clockMinHand.rotation.z = -(N * 0.03 + fastClock);
    ctx.clockHourHand.rotation.z = -(1.1 + N * 0.003 + fastClock * 0.12);

    // Hélices dos ventiladores (no Inverter f1930..1985 o ventilador externo gira mais suave)
    const extSpeed = N >= 1930 && N <= 1985 ? 0.16 : 0.34;
    ctx.indoorFanBlades.rotation.z = N * 0.35;
    ctx.outdoorFanBlades.rotation.z = N * extSpeed;

    // Expressão e pose do personagem via Rig Oficial (@desmontandoomundo)
    // Mantém o estado de calor (suor + vento amarelo + esferas laranja) até f225 (incluindo "e um balde de gelo" em f175..224!)
    const isHotOpening = N < 225 || (N >= 290 && N < 570);
    ctx.charRig.setPose(isHotOpening ? 'sitting_hot' : 'sitting_cool', N);

    // Octaedros de calor flutuando no ar da sala
    const isColdRoom = (N >= 225 && N < 290) || N >= 570;
    ctx.heatGems.forEach((hg, i) => {
      const a = i * 1.37 + N * 0.015;
      const gx = -4.5 + (i % 5) * 0.85 + Math.sin(a) * 0.18;
      const gy = 0.75 + ((i * 0.31 + N * 0.008) % 2.4);
      const gz = -1.6 + (i % 3) * 0.95 + Math.cos(a) * 0.18;
      hg.mesh.position.set(gx, gy, gz);
      hg.mesh.rotation.set(N * 0.02 + i, N * 0.03 + i, 0);
      hg.mat.color.set(isColdRoom ? '#38BDF8' : '#FF7828');
      hg.mat.opacity = isColdRoom ? 0.45 : 0.82;
    });

    // Cena 1: Balde de Gelo (entra f175, derrete f290..355, sai f368)
    const showBucket = N >= 175 && N < 372;
    ctx.bucketGroup.visible = showBucket;
    if (showBucket) {
      const s = pop3D(N - 175, 14) * (N > 358 ? Math.max(0.001, 1 - (N - 358) / 14) : 1);
      ctx.bucketGroup.scale.setScalar(s);
      const melt = clamp01((N - 290) / 55);
      ctx.iceCubesGroup.scale.setScalar(Math.max(0.001, 1 - melt * 0.88));
      ctx.iceCubesGroup.position.y = 0.68 - melt * 0.08;
      (ctx.waterMesh.material as THREE.MeshStandardMaterial).color.set(melt > 0.5 ? '#5B9BD5' : '#7DD3FC');
    }

    // Cena 2: Tanque Rosa (-50°C, entra f372..750)
    const showPinkTank = N >= 372 && N <= 755;
    ctx.pinkTankGroup.visible = showPinkTank;
    if (showPinkTank) {
      const s = pop3D(N - 372, 14);
      const shiftRight = clamp01((N - 555) / 18);
      ctx.pinkTankGroup.position.set(-2.05 + shiftRight * 0.68, 1.01 - shiftRight * 0.12, -0.3 + shiftRight * 0.15);
      ctx.pinkTankGroup.scale.setScalar(s * (1 - shiftRight * 0.25));
      ctx.tankBubbles.forEach((b, i) => {
        const p = (N * 0.035 + i * 0.11) % 1;
        const a = i * 1.4;
        b.position.set(Math.cos(a) * 0.14, 0.12 + p * 0.62, Math.sin(a) * 0.14);
      });
    }

    // Serpentina de Cobre (Evaporador): visível de f558 até f1985
    const showEvap = N >= 558 && N < 1988;
    ctx.evapGroup.visible = showEvap;
    if (showEvap) {
      ctx.evapGroup.scale.setScalar(pop3D(N - 558, 16));
      ctx.evapBalls.forEach((b, i) => {
        const u = (N * 0.0055 + i / ctx.evapBalls.length) % 1;
        const pt = ctx.evapCurve.getPointAt(u);
        b.mesh.position.copy(pt);
        const isWarm = N >= 1516 && u < 0.14;
        b.mat.color.set(isWarm ? '#F97316' : u > 0.72 ? '#60A5FA' : '#2563EB');
      });

      // Vapor saindo na Cena 2 (f565..755)
      const openSteam = N >= 565 && N < 758;
      ctx.steamPuffs.forEach((puff, i) => {
        puff.visible = openSteam;
        if (openSteam) {
          const p = (N * 0.025 + i / ctx.steamPuffs.length) % 1;
          puff.position.set(-0.38 + Math.sin(N * 0.08 + i) * 0.08, 0.95 + p * 0.95, Math.cos(N * 0.08 + i) * 0.06);
          puff.scale.setScalar((0.6 + p * 1.3) * (1 - p * 0.75));
        }
      });

      ctx.valveBrassGroup.visible = N >= 760;
    }

    // Tubulação Fechada para o Quintal (f760..1985)
    const showLoop = N >= 760 && N < 1988;
    ctx.closedLoopGroup.visible = showLoop;
    if (showLoop) {
      ctx.loopBalls.forEach((b, i) => {
        const u = (N * 0.006 + i / ctx.loopBalls.length) % 1;
        b.mesh.position.copy(ctx.loopCurve.getPointAt(u));
        b.mat.color.set(u < 0.48 ? '#38BDF8' : '#F97316');
      });
    }

    // Compressor Preto no Quintal (f770..1985)
    const showComp = N >= 770 && N < 1988;
    ctx.compressorGroup.visible = showComp;
    if (showComp) {
      ctx.compressorGroup.scale.setScalar(pop3D(N - 770, 14));
    }

    // Bomba de Pneu Vermelha (f1100..1260)
    const showPump = N >= 1100 && N <= 1265;
    ctx.pumpGroup.visible = showPump;
    if (showPump) {
      ctx.pumpGroup.scale.setScalar(pop3D(N - 1100, 12));
      ctx.pumpPlunger.position.y = (0.5 + 0.5 * Math.sin(N * 0.38)) * -0.26;
    }

    // Grade do Condensador + Ventilador Externo (f1260..1985)
    const showCond = N >= 1260 && N < 1988;
    ctx.condenserGroup.visible = showCond;
    if (showCond) {
      ctx.condenserGroup.scale.setScalar(pop3D(N - 1260, 16));
      ctx.condenserBalls.forEach((b, i) => {
        const u = (N * 0.0065 + i / ctx.condenserBalls.length) % 1;
        b.mesh.position.copy(ctx.condenserCurve.getPointAt(u));
        b.mat.color.set(u < 0.35 ? '#EF4444' : u < 0.7 ? '#F97316' : '#F59E0B');
      });
      ctx.heatStreaks.forEach((hs, i) => {
        const p = (N * 0.04 + i * 0.1) % 1;
        hs.position.set(-0.45 + (i % 5) * 0.22, 0.35 + Math.floor(i / 5) * 0.35, 0.2 + p * 1.1);
      });
    }

    // Cena 7: Gotas de água + Copo Gelado + Mangueirinha de Dreno Externa (f1803..1985)
    const showDrain = N >= 1803 && N < 1988;
    ctx.waterDropsGroup.visible = showDrain;
    ctx.sodaGlassGroup.visible = showDrain;
    ctx.drainPipeGroup.visible = showDrain;
    if (showDrain) {
      ctx.waterDrops.forEach((d, i) => {
        const p = (N * 0.045 + i * 0.14) % 1;
        d.position.set(-0.32 + i * 0.09, 0.1 - p * 0.55, 0);
      });
      ctx.extDrainDrops.forEach((dd, i) => {
        const p = (N * 0.055 + i * 0.25) % 1;
        dd.position.set(0.52, 0.28 - p * 0.26, 0.45);
      });
      const puddleScale = clamp01((N - 1850) / 35);
      ctx.drainPuddle.scale.set(0.3 + puddleScale * 0.7, 1, 0.3 + puddleScale * 0.7);
    }

    // Cena 8: Carenagem Final Montada (Split na Parede + Caixa Externa, f1986..2222)
    const showFinished = N >= 1986;
    ctx.finishedACGroup.visible = showFinished;
    ctx.stoolGroup.visible = !showFinished;
    ctx.indoorFanGroup.visible = !showFinished;
    if (showFinished) {
      ctx.finishedACGroup.scale.setScalar(pop3D(N - 1986, 16));
    }

    // Listras de vento na sala (amarelas quentes no calor, azuis claras no frio)
    ctx.windStreaks.forEach((ws, i) => {
      const p = (N * 0.032 + i * 0.1) % 1;
      if (showFinished) {
        ws.mesh.position.set(-2.15 - p * 1.8, 2.85 - p * 1.1 + (i % 3) * 0.12, -2.5 + p * 1.4);
      } else {
        ws.mesh.position.set(-1.35 - p * 2.1, 1.25 + p * 0.38 + (i % 4) * 0.14, -0.05 - (i % 3) * 0.18);
      }
      ws.mat.color.set(isColdRoom ? '#7DD3FC' : '#F6D365');
    });

    ctx.renderer.render(ctx.scene, ctx.camera);
  }, [N]);

  return <canvas ref={canvasRef} width={1080} height={1920} style={{width: 1080, height: 1920, display: 'block'}} />;
};
