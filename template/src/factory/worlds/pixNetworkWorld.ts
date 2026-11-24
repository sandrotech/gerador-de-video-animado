import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  createDesmontandoCharacter,
  type DesmontandoCharacterRig,
} from '../../shots/G1/DesmontandoRig';
import {
  applyFace,
  blendPose,
  buildFaceKit,
  canvasTex,
  clamp01,
  FACTORY_FONT,
  lerp,
  makeGearCluster,
  roundRect,
  smooth,
  STAND_Y,
  walkCycle,
  type FaceKit,
} from '../props3d';
import type {CharacterConfig, CharacterMood, ExplainerProjectConfig, ExplainerTiming} from '../types';

type V3 = [number, number, number];
type CamKey = {f: number; pos: V3; look: V3; fov: number};

export interface WorldController {
  update: (frame: number) => void;
  dispose: () => void;
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

function sampleCam(keys: CamKey[], frame: number) {
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
    pos: [v((x) => x.pos, 0), v((x) => x.pos, 1), v((x) => x.pos, 2)] as V3,
    look: [v((x) => x.look, 0), v((x) => x.look, 1), v((x) => x.look, 2)] as V3,
    fov: lerp(b.fov, c.fov, smooth(raw)),
  };
}

function makeBankBuilding(
  label: string,
  sublabel: string,
  accentHex: string,
  bodyHex: string,
) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({color: bodyHex, roughness: 0.45, metalness: 0.2});
  const trimMat = new THREE.MeshStandardMaterial({color: '#0F172A', roughness: 0.35, metalness: 0.6});
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#38BDF8',
    emissive: '#0EA5E9',
    emissiveIntensity: 0.22,
    roughness: 0.15,
    metalness: 0.5,
  });

  const base = new THREE.Mesh(new RoundedBoxGeometry(3.8, 0.35, 3.0, 3, 0.06), trimMat);
  base.position.y = 0.175;
  base.receiveShadow = true;
  g.add(base);

  const main = new THREE.Mesh(new RoundedBoxGeometry(3.4, 3.6, 2.5, 4, 0.08), bodyMat);
  main.position.y = 2.15;
  main.castShadow = main.receiveShadow = true;
  g.add(main);

  // Colunas estilizadas frontais
  [-1.35, -0.5, 0.5, 1.35].forEach((cx) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 2.8, 12), trimMat);
    col.position.set(cx, 1.85, 1.32);
    col.castShadow = true;
    g.add(col);
  });

  // Janelas iluminadas
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.68, 0.08), glassMat);
      win.position.set(-0.92 + col * 0.92, 1.45 + row * 1.15, 1.24);
      g.add(win);
    }
  }

  // Topo + Placa luminosa
  const roof = new THREE.Mesh(new RoundedBoxGeometry(3.7, 0.32, 2.8, 3, 0.05), trimMat);
  roof.position.y = 4.08;
  g.add(roof);

  const signTex = canvasTex(768, 200, (ctx, w, h) => {
    ctx.fillStyle = '#0B1220';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 72px ${FACTORY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, w / 2, 102);
    ctx.fillStyle = accentHex;
    ctx.font = `800 34px ${FACTORY_FONT}`;
    ctx.fillText(sublabel, w / 2, 162);
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.84),
    new THREE.MeshBasicMaterial({map: signTex, toneMapped: false}),
  );
  sign.position.set(0, 4.75, 1.1);
  g.add(sign);

  const signBack = new THREE.Mesh(new RoundedBoxGeometry(3.32, 0.94, 0.16, 2, 0.03), trimMat);
  signBack.position.set(0, 4.75, 1.0);
  g.add(signBack);

  return g;
}

function makeGiantSmartphone(screenMat: THREE.MeshBasicMaterial) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(1.55, 2.9, 0.16, 4, 0.09),
    new THREE.MeshStandardMaterial({color: '#0F172A', roughness: 0.25, metalness: 0.75}),
  );
  body.castShadow = true;
  g.add(body);

  const bezel = new THREE.Mesh(
    new RoundedBoxGeometry(1.42, 2.74, 0.04, 3, 0.06),
    new THREE.MeshStandardMaterial({color: '#1E293B', roughness: 0.3}),
  );
  bezel.position.z = 0.075;
  g.add(bezel);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 2.52), screenMat);
  screen.position.z = 0.1;
  g.add(screen);

  // Notch
  const notch = new THREE.Mesh(
    new RoundedBoxGeometry(0.42, 0.09, 0.02, 2, 0.03),
    new THREE.MeshBasicMaterial({color: '#020617'}),
  );
  notch.position.set(0, 1.18, 0.11);
  g.add(notch);

  return g;
}

function makeStreetLamp() {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({color: '#334155', roughness: 0.4, metalness: 0.7});
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.6, 10), poleMat);
  pole.position.y = 1.8;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.06), poleMat);
  arm.position.set(0.32, 3.55, 0);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 10),
    new THREE.MeshBasicMaterial({color: '#FEF08A'}),
  );
  lamp.position.set(0.62, 3.46, 0);
  g.add(pole, arm, lamp);
  return g;
}

function makeEncryptedPacket(accentHex: string) {
  const g = new THREE.Group();
  const cube = new THREE.Mesh(
    new RoundedBoxGeometry(0.38, 0.38, 0.38, 3, 0.06),
    new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.03, 8, 24),
    new THREE.MeshBasicMaterial({color: '#38BDF8'}),
  );
  g.add(cube, ring);
  return g;
}

/**
 * Mundo 3D exclusivo para curiosidades de Rede/PIX/Tecnologia:
 * Cidade noturna estilizada -> Banco A -> Autoestrada de Fibra Óptica -> Banco Central (SPI+DICT) -> Banco B + Smartphones Gigantes!
 */
export function buildPixNetworkWorld(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  config: ExplainerProjectConfig,
  timing: ExplainerTiming,
  isVertical: boolean,
): WorldController {
  const {brand} = config;
  const zMul = isVertical ? 1.34 : 1.0;
  const fovAdd = isVertical ? 10 : 0;

  // Atmosfera noturna vibrante (madrugada 03:17 AM com neon turquesa e laranja!)
  scene.background = new THREE.Color('#0B1528');
  scene.fog = new THREE.Fog('#0B1528', 24, 52);

  // Iluminação noturna cinematográfica
  scene.add(new THREE.HemisphereLight('#60A5FA', '#1E293B', 0.85));
  const moonLight = new THREE.DirectionalLight('#E0F2FE', 1.65);
  moonLight.position.set(-8, 16, 10);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.camera.left = -16;
  moonLight.shadow.camera.right = 16;
  moonLight.shadow.camera.top = 12;
  moonLight.shadow.camera.bottom = -10;
  moonLight.shadow.bias = -0.0004;
  scene.add(moonLight);

  const neonFill = new THREE.DirectionalLight('#2DD4BF', 0.9);
  neonFill.position.set(10, 6, 10);
  scene.add(neonFill);

  // Estrelas e lua no fundo
  const starsGroup = new THREE.Group();
  const starGeo = new THREE.SphereGeometry(0.07, 6, 6);
  const starMat = new THREE.MeshBasicMaterial({color: '#F8FAFC'});
  for (let i = 0; i < 65; i++) {
    const s = new THREE.Mesh(starGeo, starMat);
    const sx = -24 + ((i * 73) % 48);
    const sy = 5.5 + ((i * 37) % 11);
    const sz = -10 - ((i * 19) % 10);
    s.position.set(sx, sy, sz);
    starsGroup.add(s);
  }
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 24, 24),
    new THREE.MeshBasicMaterial({color: '#FEF3C7'}),
  );
  moon.position.set(-12, 10.5, -14);
  starsGroup.add(moon);
  scene.add(starsGroup);

  // Plataforma / Cidade base com grid luminoso
  const groundTex = canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#0F1B33';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.16)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 16; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 64, 0);
      ctx.lineTo(i * 64, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * 64);
      ctx.lineTo(w, i * 64);
      ctx.stroke();
    }
    // Faixa da avenida / autoestrada digital
    ctx.fillStyle = '#162544';
    ctx.fillRect(0, 440, w, 144);
    ctx.strokeStyle = '#2DD4BF';
    ctx.lineWidth = 6;
    ctx.setLineDash([36, 28]);
    ctx.beginPath();
    ctx.moveTo(0, 512);
    ctx.lineTo(w, 512);
    ctx.stroke();
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(3, 2);
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(34, 0.4, 18),
    new THREE.MeshStandardMaterial({map: groundTex, roughness: 0.42, metalness: 0.2}),
  );
  ground.position.set(0, -0.2, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // Silhueta de prédios distantes no horizonte
  const skylineMat = new THREE.MeshStandardMaterial({color: '#13213D', roughness: 0.8});
  for (let i = 0; i < 14; i++) {
    const bh = 3.2 + ((i * 17) % 6);
    const bw = 1.6 + ((i * 7) % 3) * 0.45;
    const bld = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 1.8), skylineMat);
    bld.position.set(-16 + i * 2.5, bh / 2, -7.8 - (i % 3) * 0.8);
    scene.add(bld);
  }

  /* ---------- ZONA ESQUERDA: BANCO PAGADOR (x = -7.6) + SMARTPHONE GIGANTE (x = -4.2) ---------- */
  const bankA = makeBankBuilding('BANCO A', 'PAGADOR', '#F97316', '#1E293B');
  bankA.position.set(-7.8, 0, -2.2);
  scene.add(bankA);

  // Placa TED/DOC FECHADO (Ato 1)
  const tedTex = canvasTex(640, 260, (ctx, w, h) => {
    roundRect(ctx, 10, 10, w - 20, h - 20, 24);
    ctx.fillStyle = '#450A0A';
    ctx.fill();
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.fillStyle = '#FCA5A5';
    ctx.font = `900 42px ${FACTORY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('TED / DOC • 03:17 AM', w / 2, 82);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 66px ${FACTORY_FONT}`;
    ctx.fillText('FECHADO (ATÉ 24H)', w / 2, 168);
    ctx.fillStyle = '#F87171';
    ctx.font = `700 28px ${FACTORY_FONT}`;
    ctx.fillText('Só compensa em dias úteis', w / 2, 224);
  });
  const tedSign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.3),
    new THREE.MeshBasicMaterial({map: tedTex, transparent: true, toneMapped: false}),
  );
  tedSign.position.set(-7.6, 2.5, 0.3);
  scene.add(tedSign);

  // Smartphone Gigante do Pagador (HERO DO GANCHO NOS PRIMEIROS 3 SEGUNDOS!)
  const makePayerPhoneTex = (sent: boolean) =>
    canvasTex(512, 980, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0B2F30');
      grad.addColorStop(1, '#0F172A');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Barra de status 03:17 AM
      ctx.fillStyle = '#94A3B8';
      ctx.font = `800 32px ${FACTORY_FONT}`;
      ctx.fillText('03:17', 34, 62);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#4ADE80';
      ctx.fillText('5G • 100%', w - 34, 62);
      ctx.textAlign = 'left';

      // Logo PIX estilizado
      ctx.textAlign = 'center';
      ctx.fillStyle = '#2DD4BF';
      ctx.font = `900 68px ${FACTORY_FONT}`;
      ctx.fillText('PIX', w / 2, 185);
      ctx.fillStyle = '#CBD5E1';
      ctx.font = `700 28px ${FACTORY_FONT}`;
      ctx.fillText('Transferência Instantânea', w / 2, 232);

      // Card valor
      roundRect(ctx, 36, 285, w - 72, 240, 28);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.fillStyle = '#94A3B8';
      ctx.font = `700 30px ${FACTORY_FONT}`;
      ctx.fillText('Valor a enviar', w / 2, 350);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 74px ${FACTORY_FONT}`;
      ctx.fillText('R$ 250,00', w / 2, 445);
      ctx.fillStyle = '#2DD4BF';
      ctx.font = `700 26px ${FACTORY_FONT}`;
      ctx.fillText('Chave validada no DICT', w / 2, 498);

      if (!sent) {
        roundRect(ctx, 46, 610, w - 92, 118, 28);
        ctx.fillStyle = '#F97316';
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `900 44px ${FACTORY_FONT}`;
        ctx.fillText('ENVIAR AGORA', w / 2, 684);
        ctx.fillStyle = '#FDBA74';
        ctx.font = `700 28px ${FACTORY_FONT}`;
        ctx.fillText('Cai em ~1,8 segundos', w / 2, 790);
      } else {
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.arc(w / 2, 675, 76, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 18;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(w / 2 - 34, 678);
        ctx.lineTo(w / 2 - 6, 706);
        ctx.lineTo(w / 2 + 40, 646);
        ctx.stroke();
        ctx.fillStyle = '#4ADE80';
        ctx.font = `900 44px ${FACTORY_FONT}`;
        ctx.fillText('PIX ENVIADO!', w / 2, 815);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = `700 26px ${FACTORY_FONT}`;
        ctx.fillText('Criptografado → Banco Central', w / 2, 868);
      }
      ctx.textAlign = 'left';
    });

  const payerTexA = makePayerPhoneTex(false);
  const payerTexB = makePayerPhoneTex(true);
  const payerScreenMat = new THREE.MeshBasicMaterial({map: payerTexA, toneMapped: false});
  const payerPhone = makeGiantSmartphone(payerScreenMat);
  payerPhone.position.set(-4.3, 1.85, 0.4);
  payerPhone.rotation.y = 0.22;
  scene.add(payerPhone);

  // Barra de saldo 3D do Banco A (desce na liquidação)
  const barA = new THREE.Mesh(
    new RoundedBoxGeometry(0.55, 2.2, 0.55, 3, 0.06),
    new THREE.MeshStandardMaterial({color: '#F97316', emissive: '#EA580C', emissiveIntensity: 0.45}),
  );
  barA.position.set(-5.7, 1.1, -1.2);
  scene.add(barA);

  /* ---------- CENTRO: MOTOR DO BANCO CENTRAL (SPI + DICT, x = 0) ---------- */
  const hub = new THREE.Group();
  hub.position.set(0, 0, -1.4);
  scene.add(hub);

  const dais1 = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 2.6, 0.35, 48),
    new THREE.MeshStandardMaterial({color: '#0F2937', roughness: 0.4, metalness: 0.4}),
  );
  dais1.position.y = 0.175;
  dais1.receiveShadow = true;
  hub.add(dais1);

  const daisRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.35, 0.055, 10, 64),
    new THREE.MeshBasicMaterial({color: '#2DD4BF'}),
  );
  daisRing.rotation.x = Math.PI / 2;
  daisRing.position.y = 0.37;
  hub.add(daisRing);

  const coreTex = canvasTex(512, 1024, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#042F2E');
    g.addColorStop(1, '#0F766E');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2DD4BF';
    ctx.lineWidth = 12;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = `900 54px ${FACTORY_FONT}`;
    ctx.fillText('BANCO', w / 2, 150);
    ctx.fillText('CENTRAL', w / 2, 218);
    ctx.fillStyle = '#FDBA74';
    ctx.font = `900 42px ${FACTORY_FONT}`;
    ctx.fillText('SPI + DICT', w / 2, 310);
    ['Traduz chave', 'Debita Banco A', 'Credita Banco B', '24h • 7 dias'].forEach((it, idx) => {
      roundRect(ctx, 42, 390 + idx * 130, w - 84, 96, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fill();
      ctx.fillStyle = '#5EEAD4';
      ctx.font = `800 36px ${FACTORY_FONT}`;
      ctx.fillText(`⚡ ${it}`, w / 2, 452 + idx * 130);
    });
  });

  const centralTower = new THREE.Mesh(
    new RoundedBoxGeometry(1.5, 3.0, 1.0, 4, 0.14),
    [
      new THREE.MeshStandardMaterial({color: '#0B2F30', roughness: 0.4}),
      new THREE.MeshStandardMaterial({color: '#0B2F30', roughness: 0.4}),
      new THREE.MeshStandardMaterial({color: '#0B2F30', roughness: 0.4}),
      new THREE.MeshStandardMaterial({color: '#0B2F30', roughness: 0.4}),
      new THREE.MeshBasicMaterial({map: coreTex, toneMapped: false}),
      new THREE.MeshStandardMaterial({color: '#0B2F30', roughness: 0.4}),
    ],
  );
  centralTower.position.y = 1.9;
  centralTower.castShadow = true;
  hub.add(centralTower);

  const hubRings: THREE.Mesh[] = [];
  [0.95, 1.9, 2.85].forEach((y, i) => {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(1.65 + i * 0.12, 0.04, 10, 72),
      new THREE.MeshBasicMaterial({color: i === 1 ? '#F97316' : '#2DD4BF'}),
    );
    r.position.y = y;
    r.rotation.x = Math.PI / 2;
    hub.add(r);
    hubRings.push(r);
  });

  const gears = makeGearCluster('#F97316', '#2DD4BF');
  gears.group.position.set(0, 4.05, 0.15);
  hub.add(gears.group);

  const hubLight = new THREE.PointLight('#2DD4BF', 6, 12, 1.4);
  hubLight.position.set(0, 2.6, 1.6);
  hub.add(hubLight);

  /* ---------- ZONA DIREITA: BANCO RECEBEDOR (x = 7.8) + SMARTPHONE RECEBEDOR (x = 4.5) ---------- */
  const bankB = makeBankBuilding('BANCO B', 'RECEBEDOR', '#22C55E', '#1E293B');
  bankB.position.set(7.8, 0, -2.2);
  scene.add(bankB);

  const makeReceiverPhoneTex = (received: boolean) =>
    canvasTex(512, 980, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, received ? '#064E3B' : '#1E293B');
      grad.addColorStop(1, '#0F172A');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#94A3B8';
      ctx.font = `800 32px ${FACTORY_FONT}`;
      ctx.fillText('03:17', 34, 62);
      ctx.textAlign = 'center';

      if (!received) {
        ctx.fillStyle = '#CBD5E1';
        ctx.font = `800 44px ${FACTORY_FONT}`;
        ctx.fillText('Aguardando', w / 2, 420);
        ctx.fillStyle = '#64748B';
        ctx.font = `700 30px ${FACTORY_FONT}`;
        ctx.fillText('Conectado ao SPI...', w / 2, 485);
      } else {
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.arc(w / 2, 260, 92, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 22;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(w / 2 - 42, 264);
        ctx.lineTo(w / 2 - 8, 298);
        ctx.lineTo(w / 2 + 48, 224);
        ctx.stroke();

        ctx.fillStyle = '#86EFAC';
        ctx.font = `900 42px ${FACTORY_FONT}`;
        ctx.fillText('PIX RECEBIDO!', w / 2, 440);
        roundRect(ctx, 36, 490, w - 72, 220, 28);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `900 72px ${FACTORY_FONT}`;
        ctx.fillText('+R$ 250,00', w / 2, 610);
        ctx.fillStyle = '#4ADE80';
        ctx.font = `800 30px ${FACTORY_FONT}`;
        ctx.fillText('Disponível na hora • 1,8s', w / 2, 675);
      }
      ctx.textAlign = 'left';
    });

  const recTexA = makeReceiverPhoneTex(false);
  const recTexB = makeReceiverPhoneTex(true);
  const recScreenMat = new THREE.MeshBasicMaterial({map: recTexA, toneMapped: false});
  const recPhone = makeGiantSmartphone(recScreenMat);
  recPhone.position.set(4.5, 1.85, 0.4);
  recPhone.rotation.y = -0.22;
  scene.add(recPhone);

  // Barra de saldo 3D do Banco B (sobe na liquidação!)
  const barB = new THREE.Mesh(
    new RoundedBoxGeometry(0.55, 2.2, 0.55, 3, 0.06),
    new THREE.MeshStandardMaterial({color: '#22C55E', emissive: '#16A34A', emissiveIntensity: 0.55}),
  );
  barB.position.set(5.8, 0.65, -1.2);
  scene.add(barB);

  // Postes de rua noturnos
  [-10.2, -2.5, 2.5, 10.2].forEach((lx) => {
    const lamp = makeStreetLamp();
    lamp.position.set(lx, 0, -4.4);
    scene.add(lamp);
  });

  /* ---------- AUTOESTRADA DE FIBRA ÓPTICA + PACOTES CRIPTOGRAFADOS ---------- */
  const curveLeft = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.1, 1.9, 0.3),
    new THREE.Vector3(-2.3, 3.1, -0.5),
    new THREE.Vector3(-0.7, 2.1, -1.3),
  ]);
  const curveRight = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.7, 2.1, -1.3),
    new THREE.Vector3(2.4, 3.1, -0.5),
    new THREE.Vector3(4.3, 1.9, 0.3),
  ]);

  const tubeMatL = new THREE.MeshStandardMaterial({
    color: '#2DD4BF',
    emissive: '#14B8A6',
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.25,
  });
  const tubeMatR = new THREE.MeshStandardMaterial({
    color: '#4ADE80',
    emissive: '#22C55E',
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.25,
  });
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(curveLeft, 48, 0.08, 12, false), tubeMatL));
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(curveRight, 48, 0.08, 12, false), tubeMatR));

  const heroPacket = makeEncryptedPacket('#F97316');
  heroPacket.visible = false;
  scene.add(heroPacket);

  const pulses: Array<{mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; offset: number}> = [];
  const pGeo = new THREE.SphereGeometry(0.11, 14, 12);
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({color: i % 2 ? '#F97316' : '#5EEAD4'}));
    m.visible = false;
    scene.add(m);
    pulses.push({mesh: m, curve: i < 5 ? curveLeft : curveRight, offset: (i % 5) / 5});
  }

  /* ---------- PERSONAGENS 3D ---------- */
  const chars = config.characters.map((cfg: CharacterConfig, idx: number) => {
    const rig = createDesmontandoCharacter({
      shirtColor: cfg.shirtColor,
      shortsColor: cfg.pantsColor,
      hairColor: cfg.hairColor,
      skinColor: cfg.skinColor,
      slipperColor: '#0F172A',
      hairStyle: cfg.hairStyle,
      longPants: true,
    });
    rig.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    scene.add(rig.root);
    return {cfg, rig, face: buildFaceKit(rig) as FaceKit, seed: idx + 1};
  });

  // Limites dos atos
  const actBounds = config.acts.map((act, idx) => {
    const start = timing.act_starts[act.id] ?? 0;
    const next = config.acts[idx + 1];
    const end = next ? (timing.act_starts[next.id] ?? timing.total_frames) : timing.total_frames;
    return {id: act.id, start, end, len: Math.max(1, end - start)};
  });
  const a0 = actBounds[0] ?? {start: 0, end: 300, len: 300};
  const a1 = actBounds[1] ?? a0;
  const a2 = actBounds[2] ?? a1;
  const a3 = actBounds[3] ?? a2;
  const a4 = actBounds[4] ?? a3;

  // Coreografia de câmera cinematográfica começando com GANCHO IMEDIATO no smartphone (0–3s)!
  const camKeys: CamKey[] = [
    // GANCHO (0–3s): Close dramático no smartphone 03:17 AM + zoom dinâmico!
    {f: 0, pos: [-3.8, 2.3, 3.2 * zMul], look: [-4.3, 1.9, 0.4], fov: 34 + fovAdd},
    {f: Math.min(85, a0.len * 0.3), pos: [-4.8, 2.2, 4.4 * zMul], look: [-4.6, 1.8, 0.2], fov: 36 + fovAdd},
    // Contraste com TED/DOC fechado no Banco A
    {f: a0.start + a0.len * 0.65, pos: [-7.2, 3.2, 6.4 * zMul], look: [-7.6, 2.5, -0.5], fov: 38 + fovAdd},
    {f: a0.end - 6, pos: [-5.5, 3.4, 7.6 * zMul], look: [-4.0, 2.2, -1.0], fov: 40 + fovAdd},
    // ATO 2: Voo rasante até o Banco Central (SPI + DICT) com engrenagens girando
    {f: a1.start + a1.len * 0.2, pos: [-1.8, 4.1, 7.2 * zMul], look: [0.0, 2.4, -1.4], fov: 38 + fovAdd},
    {f: a1.start + a1.len * 0.55, pos: [0.0, 3.2, 5.2 * zMul], look: [0.0, 2.4, -1.4], fov: 36 + fovAdd},
    {f: a1.start + a1.len * 0.88, pos: [2.4, 3.4, 5.6 * zMul], look: [0.0, 2.4, -1.4], fov: 36 + fovAdd},
    // ATO 3: Pagador envia PIX e câmera acompanha o pacote criptografado na fibra óptica!
    {f: a2.start + a2.len * 0.15, pos: [-4.6, 2.4, 5.4 * zMul], look: [-4.2, 1.8, 0.4], fov: 35 + fovAdd},
    {f: a2.start + a2.len * 0.52, pos: [-2.6, 3.1, 4.8 * zMul], look: [-2.2, 2.3, -0.4], fov: 35 + fovAdd},
    {f: a2.start + a2.len * 0.88, pos: [-0.4, 3.2, 4.8 * zMul], look: [0.0, 2.3, -1.2], fov: 36 + fovAdd},
    // ATO 4: Liquidação real no Banco B + Smartphone acende "+R$ 250,00 RECEBIDO!"
    {f: a3.start + a3.len * 0.2, pos: [2.8, 3.2, 5.4 * zMul], look: [4.2, 2.0, 0.2], fov: 36 + fovAdd},
    {f: a3.start + a3.len * 0.58, pos: [5.4, 2.6, 4.8 * zMul], look: [4.9, 1.9, 0.2], fov: 34 + fovAdd},
    {f: a3.start + a3.len * 0.9, pos: [6.4, 3.4, 6.6 * zMul], look: [5.8, 2.1, -0.8], fov: 38 + fovAdd},
    // ATO 5: Plano épico mostrando toda a rede iluminada
    {f: a4.start + a4.len * 0.35, pos: [0.0, 6.2, 14.8 * zMul], look: [0.0, 2.0, -1.2], fov: 44 + fovAdd},
    {f: timing.total_frames, pos: [0.0, 6.8, 16.0 * zMul], look: [0.0, 2.2, -1.2], fov: 44 + fovAdd},
  ];

  const update = (frame: number) => {
    const t = frame / 30;
    let actIdx = 0;
    actBounds.forEach((b, i) => {
      if (frame >= b.start) actIdx = i;
    });

    const cam = sampleCam(camKeys, frame);
    const sway = 0.03;
    camera.position.set(
      cam.pos[0] + Math.sin(t * 0.8) * sway,
      cam.pos[1] + Math.sin(t * 1.1 + 1) * sway * 0.6,
      cam.pos[2],
    );
    camera.fov = cam.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);

    // Smartphones flutuando suavemente
    payerPhone.position.y = 1.85 + Math.sin(t * 2.2) * 0.07;
    recPhone.position.y = 1.85 + Math.sin(t * 2.2 + 1.4) * 0.07;

    // Gatilhos de envio e recebimento
    const sendFrame = a2.start + a2.len * 0.35;
    const receiveFrame = a3.start + a3.len * 0.35;

    // No gancho inicial (frames 30-75), o celular dá uma piscada energética convidando o clique
    const sent = frame >= sendFrame;
    payerScreenMat.map = sent ? payerTexB : payerTexA;
    payerScreenMat.needsUpdate = true;

    const received = frame >= receiveFrame;
    recScreenMat.map = received ? recTexB : recTexA;
    recScreenMat.needsUpdate = true;

    // Placa TED/DOC fecha/desaparece depois do Ato 1
    tedSign.visible = frame < a1.start + 15;
    if (tedSign.visible) {
      tedSign.position.y = 2.5 + Math.sin(t * 3.0) * 0.06;
    }

    // Barras de saldo animadas na liquidação (Banco A desce, Banco B sobe!)
    const liqK = smooth((frame - receiveFrame) / 22);
    const sA = lerp(1.0, 0.62, liqK);
    const sB = lerp(0.55, 1.12, liqK);
    barA.scale.y = sA;
    barA.position.y = 1.1 * sA;
    barB.scale.y = sB;
    barB.position.y = 1.1 * sB;

    // Fibra óptica e pacotes
    const highwayOn = smooth((frame - a1.start) / 24);
    tubeMatL.opacity = 0.25 + 0.65 * highwayOn;
    tubeMatR.opacity = 0.25 + 0.65 * smooth((frame - a2.start) / 24);
    pulses.forEach((p, idx) => {
      p.mesh.visible = idx < 5 ? highwayOn > 0.05 : frame >= a2.start;
      const u = (t * 0.75 + p.offset) % 1;
      p.mesh.position.copy(p.curve.getPointAt(u));
      p.mesh.scale.setScalar(0.85 + 0.3 * Math.sin(t * 10 + idx));
    });

    // Pacote criptografado herói viajando do Pagador -> Banco Central -> Recebedor
    if (frame >= sendFrame && frame < a4.start) {
      heroPacket.visible = true;
      const totalSpan = Math.max(1, receiveFrame + 20 - sendFrame);
      const prog = clamp01((frame - sendFrame) / totalSpan);
      const pos = prog < 0.5 ? curveLeft.getPointAt(prog * 2) : curveRight.getPointAt((prog - 0.5) * 2);
      heroPacket.position.copy(pos);
      heroPacket.rotation.set(t * 3.2, t * 4.0, t * 2.1);
    } else {
      heroPacket.visible = false;
    }

    // Banco Central girando
    hubRings.forEach((r, i) => {
      r.rotation.z = t * (0.8 + i * 0.4) * (i % 2 ? -1 : 1);
      r.position.y = [0.95, 1.9, 2.85][i] + Math.sin(t * 2 + i) * 0.07;
    });
    gears.gearA.rotation.z = t * 1.4;
    gears.gearB.rotation.z = -t * 1.75;
    hubLight.intensity = 4.5 + 3.0 * (0.6 + 0.4 * Math.sin(t * 5));

    // Personagens posicionados no mundo PIX
    chars.forEach(({cfg, rig, face, seed}) => {
      const mood: CharacterMood =
        cfg.moodsByAct[Math.min(actIdx, cfg.moodsByAct.length - 1)] ?? 'happy';

      if (cfg.role === 'walker') {
        // Pagador ao lado do smartphone gigante (caminha e aperta o botão no Ato 3!)
        const walkStart = a2.start;
        const walkEnd = a2.start + a2.len * 0.32;
        if (frame < walkStart) {
          rig.root.position.set(-5.6, STAND_Y, 1.5);
          rig.root.rotation.y = 0.5;
          rig.setPose('standing_phone', frame);
          rig.phoneProp.visible = true;
          rig.phoneScreenMat.color.set('#2DD4BF');
          applyFace(rig, face, mood, frame, seed);
        } else if (frame < walkEnd) {
          const u = smooth((frame - walkStart) / Math.max(1, walkEnd - walkStart));
          const px = lerp(-5.6, -3.2, u);
          const pz = lerp(1.5, 1.4, u);
          const phase = u * 8.0;
          rig.root.position.set(px, STAND_Y + Math.abs(Math.sin(phase)) * 0.04, pz);
          rig.root.rotation.y = lerp(1.2, -0.45, u);
          walkCycle(rig, phase);
          rig.phoneProp.visible = false;
          applyFace(rig, face, 'happy', frame, seed);
        } else if (frame < a4.start) {
          rig.root.position.set(-3.2, STAND_Y, 1.4);
          rig.root.rotation.y = -0.35;
          rig.setPose('standing_neutral', frame);
          rig.phoneProp.visible = false;
          const pt = smooth((frame - sendFrame) / 10);
          rig.shoulderR.rotation.set(lerp(-0.4, -1.4, pt), 0, lerp(-0.1, 0.3, pt));
          applyFace(rig, face, sent ? 'joy' : 'happy', frame, seed);
        } else {
          rig.root.position.set(-3.2, STAND_Y + Math.max(0, Math.sin(t * 6)) * 0.14, 1.4);
          rig.root.rotation.y = 0;
          blendPose(rig, 'standing_neutral', 'standing_wave', clamp01((frame - a4.start) / 20), frame);
          applyFace(rig, face, 'joy', frame, seed);
        }
      } else if (cfg.role === 'left_desk') {
        // Pessoa frustrada esperando TED na porta do Banco A
        rig.root.position.set(-8.2, STAND_Y, 1.2);
        rig.root.rotation.y = 0.2;
        if (frame < a4.start) {
          rig.setPose('standing_worried', frame);
          applyFace(rig, face, frame < a1.start ? 'worried' : 'happy', frame, seed);
        } else {
          rig.root.position.y = STAND_Y + Math.max(0, Math.sin(t * 6 + 1)) * 0.12;
          blendPose(rig, 'standing_worried', 'standing_wave', clamp01((frame - a4.start) / 20), frame);
          applyFace(rig, face, 'joy', frame, seed);
        }
      } else if (cfg.role === 'core_desk') {
        // Engenheiro do Banco Central operando o motor SPI + DICT
        rig.root.position.set(1.85, STAND_Y, 0.45);
        rig.root.rotation.y = -0.35;
        if (frame < a4.start) {
          rig.setPose('standing_neutral', frame);
          rig.shoulderL.rotation.set(-0.7 + Math.sin(t * 4) * 0.12, 0, 0.18);
          rig.shoulderR.rotation.set(-0.7 + Math.cos(t * 4) * 0.12, 0, -0.18);
          applyFace(rig, face, mood, frame, seed);
        } else {
          rig.root.position.y = STAND_Y + Math.max(0, Math.sin(t * 6 + 2)) * 0.12;
          blendPose(rig, 'standing_neutral', 'standing_wave', clamp01((frame - a4.start) / 20), frame);
          applyFace(rig, face, 'joy', frame, seed);
        }
      } else {
        // Recebedor ao lado do Smartphone B comemorando o +R$ 250,00
        rig.root.position.set(5.9, STAND_Y, 1.45);
        rig.root.rotation.y = -0.35;
        if (!received) {
          rig.setPose('standing_phone', frame);
          rig.phoneProp.visible = true;
          rig.phoneScreenMat.color.set('#38BDF8');
          applyFace(rig, face, 'neutral', frame, seed);
        } else {
          rig.phoneProp.visible = false;
          rig.root.position.y = STAND_Y + Math.max(0, Math.sin(t * 6.5)) * 0.14;
          blendPose(rig, 'standing_neutral', 'standing_wave', clamp01((frame - receiveFrame) / 16), frame);
          applyFace(rig, face, 'joy', frame, seed);
        }
      }
    });
  };

  return {
    update,
    dispose: () => {
      payerTexA.dispose();
      payerTexB.dispose();
      recTexA.dispose();
      recTexB.dispose();
      groundTex.dispose();
    },
  };
}
