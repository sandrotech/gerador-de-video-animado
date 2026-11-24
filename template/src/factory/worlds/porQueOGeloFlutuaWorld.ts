import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {createDesmontandoCharacter} from '../../shots/G1/DesmontandoRig';
import {
  applyFace,
  blendPose,
  buildFaceKit,
  canvasTex,
  clamp01,
  fitText,
  lerp,
  makeGearCluster,
  roundRect,
  smooth,
  STAND_Y,
  type FaceKit,
} from '../props3d';
import type {CharacterConfig, CharacterMood, ExplainerProjectConfig, ExplainerTiming} from '../types';
import type {WorldController} from './pixNetworkWorld';

export function buildPorQueOGeloFlutuaWorld(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  config: ExplainerProjectConfig,
  timing: ExplainerTiming,
  isVertical: boolean,
): WorldController {
  const {brand} = config;
  const zMul = isVertical ? 1.34 : 1.0;
  const fovAdd = isVertical ? 10 : 0;

  scene.background = new THREE.Color('#0B192C');
  scene.fog = new THREE.Fog('#0B192C', 16, 40);

  scene.add(new THREE.HemisphereLight('#38BDF8', '#0B192C', 0.85));
  const key = new THREE.DirectionalLight('#E0F2FE', 2.0);
  key.position.set(4, 12, 8);
  key.castShadow = true;
  scene.add(key);

  const orangeSpot = new THREE.PointLight('#F97316', 3.5, 7);
  orangeSpot.position.set(-2.6, 0.4, 0.8);
  scene.add(orangeSpot);

  // Piso do Laboratório Molecular com grid ciano luminescente
  const floorTex = canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#06101E';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(14, 116, 144, 0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 64, 0);
      ctx.lineTo(i * 64, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * 64);
      ctx.lineTo(w, i * 64);
      ctx.stroke();
    }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(5, 4);
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(30, 0.3, 20),
    new THREE.MeshStandardMaterial({map: floorTex, roughness: 0.25, metalness: 0.4}),
  );
  floor.position.y = -0.15;
  scene.add(floor);

  // Aquário Cilíndrico de Teste Hidrostático (Gancho Visual)
  const aquaGroup = new THREE.Group();
  aquaGroup.position.set(-2.6, 0, 0.8);
  scene.add(aquaGroup);

  const ledRing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.15, 0.22, 36),
    new THREE.MeshStandardMaterial({color: '#F97316', emissive: '#EA580C', emissiveIntensity: 0.9}),
  );
  ledRing.position.y = 0.11;
  aquaGroup.add(ledRing);

  const cylinderGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.95, 2.5, 36, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: '#A5F3FC',
      transmission: 0.88,
      opacity: 0.45,
      transparent: true,
      roughness: 0.08,
      ior: 1.33,
    }),
  );
  cylinderGlass.position.y = 1.36;
  aquaGroup.add(cylinderGlass);

  const waterInside = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 2.0, 32),
    new THREE.MeshStandardMaterial({color: '#0E7490', transparent: true, opacity: 0.65, roughness: 0.1}),
  );
  waterInside.position.y = 1.12;
  aquaGroup.add(waterInside);

  // Pedra de Gelo Estilizada
  const iceCube = new THREE.Mesh(
    new RoundedBoxGeometry(0.68, 0.68, 0.68, 4, 0.12),
    new THREE.MeshPhysicalMaterial({
      color: '#E0F2FE',
      transmission: 0.8,
      roughness: 0.15,
      transparent: true,
      opacity: 0.85,
    }),
  );
  aquaGroup.add(iceCube);

  // Bolhas fluorescentes do impacto
  const bubbles: THREE.Mesh[] = [];
  const bubbleGeo = new THREE.SphereGeometry(0.045, 12, 12);
  const bubbleMat = new THREE.MeshBasicMaterial({color: '#67E8F9'});
  for (let b = 0; b < 14; b++) {
    const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
    aquaGroup.add(bubble);
    bubbles.push(bubble);
  }

  // Holograma 3D Gigante: Anel Molecular Hexagonal (Água vs Gelo)
  const holoGroup = new THREE.Group();
  holoGroup.position.set(0.2, 2.4, -0.6);
  scene.add(holoGroup);

  const holoBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.0, 2.2, 0.35, 32),
    new THREE.MeshStandardMaterial({color: '#1E293B', metalness: 0.8, roughness: 0.3}),
  );
  holoBase.position.set(0.2, 0.175, -0.6);
  scene.add(holoBase);

  const voidCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 24, 24),
    new THREE.MeshBasicMaterial({color: '#38BDF8', wireframe: true}),
  );
  holoGroup.add(voidCore);

  const hexNodes: THREE.Mesh[] = [];
  const hexBonds: THREE.Mesh[] = [];
  const oxyGeo = new THREE.SphereGeometry(0.25, 20, 20);
  const oxyMat = new THREE.MeshStandardMaterial({color: '#EF4444', emissive: '#B91C1C', emissiveIntensity: 0.5});
  const bondMat = new THREE.MeshBasicMaterial({color: '#38BDF8'});

  for (let i = 0; i < 6; i++) {
    const oxy = new THREE.Mesh(oxyGeo, oxyMat);
    holoGroup.add(oxy);
    hexNodes.push(oxy);

    const bond = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.35, 8), bondMat);
    holoGroup.add(bond);
    hexBonds.push(bond);
  }

  // Telão Holográfico Explicativo no Fundo (Canvas 1024px com margens seguras e sem colisão)
  const hudTex = canvasTex(1024, 540, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(11, 25, 44, 0.94)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#0E7490';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#38BDF8';
    fitText(ctx, 'LABORATÓRIO DE DINÂMICA MOLECULAR', w / 2, 60, 780, 32, 20);
    ctx.fillStyle = '#FFFFFF';
    fitText(ctx, config.title.toUpperCase(), w / 2, 126, 860, 44, 26);

    // Coluna Esquerda: x=60..460 (largura 400, centro 260)
    roundRect(ctx, 60, 195, 400, 310, 20);
    ctx.fillStyle = 'rgba(14, 116, 144, 0.2)';
    ctx.fill();
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Coluna Direita: x=540..940 (largura 400, centro 740)
    roundRect(ctx, 540, 195, 400, 310, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    fitText(ctx, 'ÁGUA LÍQUIDA (0°C a 4°C)', 260, 250, 360, 26, 18);
    ctx.fillStyle = '#E2E8F0';
    fitText(ctx, 'Densidade: ~1,00 g/cm³', 260, 305, 350, 22, 16);
    fitText(ctx, 'Moléculas deslizam livres', 260, 355, 350, 20, 15);
    fitText(ctx, 'Estrutura compacta e móvel', 260, 405, 350, 20, 15);
    fitText(ctx, 'Pontes rompem e refazem', 260, 455, 350, 19, 14);

    ctx.fillStyle = '#F472B6';
    fitText(ctx, 'GELO CRISTALINO (< 0°C)', 740, 250, 360, 26, 18);
    ctx.fillStyle = '#E2E8F0';
    fitText(ctx, 'Densidade: ~0,92 g/cm³ (-9%)', 740, 305, 350, 22, 16);
    fitText(ctx, 'Pontes de H em hexágonos', 740, 355, 350, 20, 15);
    fitText(ctx, 'Vazios internos geram empuxo!', 740, 405, 350, 20, 15);
    fitText(ctx, 'Menos denso, o gelo flutua', 740, 455, 350, 19, 14);
  });

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(9.2, 4.85),
    new THREE.MeshBasicMaterial({map: hudTex, transparent: true, opacity: 0.92}),
  );
  // Abaixado para y=2.2 para evitar colisão com HUD superior
  screen.position.set(0, 2.2, -4.6);
  scene.add(screen);

  // Engrenagens movidas para x=4.6 para liberar o texto da tela
  const gears = makeGearCluster(brand.primary, brand.accent);
  gears.group.position.set(4.6, 2.0, -2.6);
  scene.add(gears.group);

  // Cientistas Investigadores
  const chars = config.characters.slice(0, 2).map((cfg: CharacterConfig, idx: number) => {
    const rig = createDesmontandoCharacter({
      shirtColor: '#F8FAFC',
      shortsColor: cfg.pantsColor,
      hairColor: cfg.hairColor,
      skinColor: cfg.skinColor,
      slipperColor: '#0E7490',
      hairStyle: cfg.hairStyle,
      longPants: true,
    });
    rig.root.position.set(idx === 0 ? 2.3 : 3.8, STAND_Y, idx === 0 ? 0.6 : -0.2);
    scene.add(rig.root);
    return {cfg, rig, face: buildFaceKit(rig) as FaceKit, seed: idx * 11 + 3};
  });

  const actBounds = config.acts.map((act, idx) => {
    const start = timing.act_starts[act.id] ?? 0;
    const next = config.acts[idx + 1];
    const end = next ? (timing.act_starts[next.id] ?? timing.total_frames) : timing.total_frames;
    return {start, end, len: Math.max(1, end - start)};
  });

  // Waypoints de câmera para variedade dinâmica entre os atos
  const actShots = [
    // Ato 0: Copo com gelo / Aquário
    {pos: new THREE.Vector3(-2.2, 1.8, 3.8 * zMul), target: new THREE.Vector3(-2.6, 1.4, 0.8), fov: 32 + fovAdd},
    // Ato 1: Copo com gelo + Cientista investigando
    {pos: new THREE.Vector3(-1.4, 2.1, 4.6 * zMul), target: new THREE.Vector3(-1.5, 1.4, 0.5), fov: 36 + fovAdd},
    // Ato 2: Close nas moléculas hexagonais holográficas
    {pos: new THREE.Vector3(0.3, 2.5, 3.3 * zMul), target: new THREE.Vector3(0.2, 2.3, -0.6), fov: 34 + fovAdd},
    // Ato 3: Cientistas analisando e apontando para o painel
    {pos: new THREE.Vector3(2.5, 2.2, 4.5 * zMul), target: new THREE.Vector3(2.6, 1.6, 0.2), fov: 36 + fovAdd},
    // Ato 4+: Visão geral panorâmica equilibrada
    {pos: new THREE.Vector3(0.1, 2.4, 7.3 * zMul), target: new THREE.Vector3(0.0, 1.8, -0.5), fov: 38 + fovAdd},
  ];

  const update = (frame: number) => {
    const t = frame / 30;
    let actIdx = 0;
    actBounds.forEach((b, i) => {
      if (frame >= b.start) actIdx = i;
    });

    // 1. Gancho Visual dos 3 Primeiros Segundos (frame 0..90): Super Slow Motion & Rebound
    let iceY = 2.0;
    let iceRot = t * 0.4;
    if (frame < 90) {
      if (frame < 45) {
        const p = smooth(frame / 45);
        iceY = lerp(3.2, 0.45, p);
      } else if (frame < 62) {
        const p = (frame - 45) / 17;
        iceY = lerp(0.45, 0.25, Math.sin(p * Math.PI));
      } else {
        const p = smooth((frame - 62) / 28);
        iceY = lerp(0.25, 1.88, p);
      }
    } else {
      iceY = 1.88 + Math.sin(t * 3.2) * 0.045;
      iceRot = Math.sin(t * 1.5) * 0.15;
    }
    iceCube.position.set(0, iceY, 0);
    iceCube.rotation.set(iceRot, iceRot * 0.8, iceRot * 0.5);

    // Bolhas fluorescentes sobem após o impacto
    bubbles.forEach((b, i) => {
      const bCycle = ((frame + i * 9) % 55) / 55;
      b.position.set(
        Math.sin(i * 1.7) * 0.4,
        0.35 + bCycle * 1.6,
        Math.cos(i * 1.7) * 0.4,
      );
      b.scale.setScalar(frame > 40 && frame < 120 ? Math.sin(bCycle * Math.PI) * 1.2 : 0.001);
    });

    // 2. Animação da Rede Hexagonal Holográfica (Água expande ao virar Gelo)
    const isIceGeometry = actIdx >= 2;
    const expandProgress = clamp01((frame - (actBounds[2]?.start ?? 120)) / 45);
    const hexRadius = lerp(0.85, 1.45, isIceGeometry ? expandProgress : 0.15);
    holoGroup.rotation.y = t * 0.45;
    voidCore.scale.setScalar(hexRadius * 0.95);

    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const nx = Math.cos(angle) * hexRadius;
      const nz = Math.sin(angle) * hexRadius;
      const ny = Math.sin(t * 2 + i) * 0.12;
      hexNodes[i].position.set(nx, ny, nz);

      const nextAngle = ((i + 1) * Math.PI) / 3;
      const bx = (nx + Math.cos(nextAngle) * hexRadius) / 2;
      const bz = (nz + Math.sin(nextAngle) * hexRadius) / 2;
      hexBonds[i].position.set(bx, ny, bz);
      hexBonds[i].scale.set(1, hexRadius, 1);
      hexBonds[i].rotation.z = Math.PI / 2;
      hexBonds[i].rotation.y = -angle - Math.PI / 6;
    }

    gears.gearA.rotation.z = t * 1.2;
    gears.gearB.rotation.z = -t * 1.5;

    // 3. Câmera Cinematográfica com transições variadas entre aquário, moléculas e cientistas
    if (frame < 90) {
      const hookP = smooth(frame / 90);
      camera.position.set(
        lerp(-2.6, -1.8, hookP),
        lerp(1.7, 2.1, hookP),
        lerp(3.2, 4.6, hookP) * zMul,
      );
      camera.fov = (32 + fovAdd);
      camera.lookAt(-2.6, 1.4, 0.8);
    } else {
      const currBound = actBounds[actIdx] ?? {start: 90, end: timing.total_frames, len: 100};
      const prevIdx = Math.max(0, actIdx - 1);
      const currShot = actShots[Math.min(actIdx, actShots.length - 1)];
      const prevShot = actShots[Math.min(prevIdx, actShots.length - 1)];

      const transP = smooth(clamp01((frame - currBound.start) / Math.min(30, currBound.len * 0.45)));
      const driftX = Math.sin(t * 0.4) * 0.12;
      const driftY = Math.cos(t * 0.3) * 0.08;

      camera.position.set(
        lerp(prevShot.pos.x, currShot.pos.x, transP) + driftX,
        lerp(prevShot.pos.y, currShot.pos.y, transP) + driftY,
        lerp(prevShot.pos.z, currShot.pos.z, transP),
      );
      camera.fov = lerp(prevShot.fov, currShot.fov, transP);

      const lookTarget = new THREE.Vector3(
        lerp(prevShot.target.x, currShot.target.x, transP),
        lerp(prevShot.target.y, currShot.target.y, transP),
        lerp(prevShot.target.z, currShot.target.z, transP),
      );
      camera.lookAt(lookTarget);
    }
    camera.updateProjectionMatrix();

    // 4. Personagens e Expressões
    chars.forEach(({cfg, rig, face, seed}, cIdx) => {
      const mood: CharacterMood = cfg.moodsByAct[Math.min(actIdx, cfg.moodsByAct.length - 1)] ?? 'explaining';
      if (frame < timing.total_frames - 60) {
        rig.setPose('standing_neutral', frame);
        // Gesticulação direcionada para a molécula/painel
        const pointFactor = actIdx >= 2 ? 0.3 : 0.0;
        rig.shoulderR.rotation.set(-0.7 - pointFactor + Math.sin(t * 3.5 + seed) * 0.25, 0, -0.35);
        rig.shoulderL.rotation.set(0.2 + (cIdx === 0 ? 0.1 : 0), 0, 0.15);
        applyFace(rig, face, mood, frame, seed);
      } else {
        blendPose(rig, 'standing_neutral', 'standing_wave', clamp01((frame - (timing.total_frames - 60)) / 20), frame);
        applyFace(rig, face, 'joy', frame, seed);
      }
    });
  };

  return {
    update,
    dispose: () => {
      floorTex.dispose();
      hudTex.dispose();
    },
  };
}