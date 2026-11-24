import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {createDesmontandoCharacter} from '../../shots/G1/DesmontandoRig';
import {
  applyFace,
  blendPose,
  buildFaceKit,
  canvasTex,
  clamp01,
  FACTORY_FONT,
  lerp,
  makeGearCluster,
  makeLabStand,
  roundRect,
  smooth,
  STAND_Y,
  type FaceKit,
} from '../props3d';
import type {CharacterConfig, CharacterMood, ExplainerProjectConfig, ExplainerTiming} from '../types';
import type {WorldController} from './pixNetworkWorld';

/**
 * Mundo 3D exclusivo de Laboratório Científico (`world: "science_lab"`):
 * Ideal para curiosidades de física, química e biologia ("Por que o gelo flutua?", "Como o micro-ondas aquece?").
 */
export function buildScienceLabWorld(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  config: ExplainerProjectConfig,
  timing: ExplainerTiming,
  isVertical: boolean,
): WorldController {
  const {brand} = config;
  const zMul = isVertical ? 1.32 : 1.0;
  const fovAdd = isVertical ? 10 : 0;

  scene.background = new THREE.Color('#0F172A');
  scene.fog = new THREE.Fog('#0F172A', 24, 48);

  scene.add(new THREE.HemisphereLight('#E0F2FE', '#334155', 0.9));
  const key = new THREE.DirectionalLight('#FFFFFF', 1.7);
  key.position.set(-5, 14, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key);

  // Piso de laboratório escuro com linhas sutis
  const floorTex = canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(56,189,248,0.18)';
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
  floorTex.repeat.set(4, 3);
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(28, 0.3, 16),
    new THREE.MeshStandardMaterial({map: floorTex, roughness: 0.35}),
  );
  floor.position.y = -0.15;
  floor.receiveShadow = true;
  scene.add(floor);

  // Quadro-negro científico gigante no fundo
  const chalkTex = canvasTex(1400, 620, (ctx, w, h) => {
    ctx.fillStyle = '#0F2922';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 22;
    ctx.strokeRect(11, 11, w - 22, h - 22);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = `900 58px ${FACTORY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(config.title.toUpperCase(), w / 2, 130);
    ctx.fillStyle = '#38BDF8';
    ctx.font = `800 40px ${FACTORY_FONT}`;
    ctx.fillText(config.compareWall.header, w / 2, 225);
    roundRect(ctx, 90, 290, 560, 230, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    roundRect(ctx, 750, 290, 560, 230, 24);
    ctx.fill();
    ctx.fillStyle = '#FCA5A5';
    ctx.font = `800 36px ${FACTORY_FONT}`;
    ctx.fillText(config.compareWall.left.line1, 370, 395);
    ctx.fillStyle = '#4ADE80';
    ctx.fillText(config.compareWall.right.line1, 1030, 395);
  });
  const chalk = new THREE.Mesh(
    new THREE.PlaneGeometry(11.5, 5.1),
    new THREE.MeshBasicMaterial({map: chalkTex, toneMapped: false}),
  );
  chalk.position.set(0, 3.3, -4.4);
  scene.add(chalk);

  // Câmara de experimento central com átomo/engrenagens giratórias
  const chamberBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 1.9, 0.5, 40),
    new THREE.MeshStandardMaterial({color: '#334155', roughness: 0.4, metalness: 0.5}),
  );
  chamberBase.position.set(0, 0.25, -0.5);
  scene.add(chamberBase);

  const atomGroup = new THREE.Group();
  atomGroup.position.set(0, 2.25, -0.5);
  const nucleus = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 24, 24),
    new THREE.MeshStandardMaterial({color: brand.accent, emissive: brand.accent, emissiveIntensity: 0.6}),
  );
  atomGroup.add(nucleus);
  const orbits: THREE.Mesh[] = [];
  [0, Math.PI / 3, -Math.PI / 3].forEach((rot, idx) => {
    const o = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.035, 10, 64),
      new THREE.MeshBasicMaterial({color: idx === 0 ? '#38BDF8' : idx === 1 ? '#4ADE80' : '#F97316'}),
    );
    o.rotation.set(Math.PI / 2.6, rot, 0);
    atomGroup.add(o);
    orbits.push(o);
  });
  scene.add(atomGroup);

  const gears = makeGearCluster(brand.primary, brand.accent);
  gears.group.position.set(-4.6, 2.2, -1.6);
  scene.add(gears.group);

  // Bancadas laterais com frascos brilhantes
  const benchMat = new THREE.MeshStandardMaterial({color: '#CBD5E1', roughness: 0.35, metalness: 0.3});
  [-4.6, 4.6].forEach((bx) => {
    const bench = new THREE.Mesh(new RoundedBoxGeometry(2.8, 0.95, 1.3, 3, 0.04), benchMat);
    bench.position.set(bx, 0.475, -0.8);
    bench.castShadow = bench.receiveShadow = true;
    scene.add(bench);
    const flasks = makeLabStand(brand.accent, brand.secondary);
    flasks.position.set(bx, 0.95, -0.8);
    scene.add(flasks);
  });

  const chars = config.characters.slice(0, 3).map((cfg: CharacterConfig, idx: number) => {
    const rig = createDesmontandoCharacter({
      shirtColor: '#F8FAFC', // Jaleco científico!
      shortsColor: cfg.pantsColor,
      hairColor: cfg.hairColor,
      skinColor: cfg.skinColor,
      slipperColor: '#0F172A',
      hairStyle: cfg.hairStyle,
      longPants: true,
    });
    const xPos = idx === 0 ? -3.0 : idx === 1 ? 3.0 : 0.0;
    rig.root.position.set(xPos, STAND_Y, idx === 2 ? 1.5 : 0.8);
    scene.add(rig.root);
    return {cfg, rig, face: buildFaceKit(rig) as FaceKit, seed: idx + 1};
  });

  const actBounds = config.acts.map((act, idx) => {
    const start = timing.act_starts[act.id] ?? 0;
    const next = config.acts[idx + 1];
    const end = next ? (timing.act_starts[next.id] ?? timing.total_frames) : timing.total_frames;
    return {start, end, len: Math.max(1, end - start)};
  });
  const finaleStart = actBounds[actBounds.length - 1]?.start ?? timing.total_frames;

  const update = (frame: number) => {
    const t = frame / 30;
    let actIdx = 0;
    actBounds.forEach((b, i) => {
      if (frame >= b.start) actIdx = i;
    });

    // Movimento de câmera por ato (close no átomo -> bancadas -> plano geral)
    const angle = lerp(-0.45, 0.45, clamp01(frame / Math.max(1, timing.total_frames)));
    const dist = (frame < 90 ? 6.2 : frame >= finaleStart ? 12.0 : 8.5) * zMul;
    camera.position.set(Math.sin(angle) * dist, 2.8 + Math.sin(t * 0.6) * 0.25, Math.cos(angle) * dist);
    camera.fov = (frame < 90 ? 35 : 40) + fovAdd;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 2.0, -0.6);

    atomGroup.rotation.y = t * 0.9;
    orbits.forEach((o, i) => {
      o.rotation.z = t * (1.2 + i * 0.5);
    });
    gears.gearA.rotation.z = t * 1.2;
    gears.gearB.rotation.z = -t * 1.5;

    chars.forEach(({cfg, rig, face, seed}) => {
      const mood: CharacterMood = cfg.moodsByAct[Math.min(actIdx, cfg.moodsByAct.length - 1)] ?? 'happy';
      if (frame < finaleStart) {
        rig.setPose('standing_neutral', frame);
        rig.shoulderR.rotation.set(-0.6 + Math.sin(t * 3 + seed) * 0.25, 0, -0.15);
        applyFace(rig, face, mood, frame, seed);
      } else {
        blendPose(rig, 'standing_neutral', 'standing_wave', clamp01((frame - finaleStart) / 20), frame);
        applyFace(rig, face, 'joy', frame, seed);
      }
    });
  };

  return {
    update,
    dispose: () => {
      floorTex.dispose();
      chalkTex.dispose();
    },
  };
}
