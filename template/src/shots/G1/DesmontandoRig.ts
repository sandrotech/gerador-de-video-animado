import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Biblioteca Permanente de Modelos 3D Rigados (@desmontandoomundo Asset Kit)
 * -------------------------------------------------------------------------
 * Contém o boneco oficial low-poly articulado (FK Rig sem peças soltas),
 * a poltrona verde chanfrada (RoundedBoxGeometry), o balde frisado com gelo
 * e props modulares prontos para serem reutilizados e posados em qualquer tema
 * (Ar-Condicionado, Telhado, Arranha-Céu, Geladeira, Motor, etc.).
 */

export type CharacterPose =
  | 'sitting_hot'
  | 'sitting_cool'
  | 'sitting_desk'
  | 'sitting_table'
  | 'standing_wave'
  | 'standing_neutral'
  | 'standing_phone'
  | 'standing_worried';

export interface CharacterStyleOptions {
  shirtColor?: string;
  shortsColor?: string;
  slipperColor?: string;
  skinColor?: string;
  hairColor?: string;
  hairStyle?: 'quiff' | 'bob' | 'bun' | 'short';
  longPants?: boolean;
  apronColor?: string;
}

export interface DesmontandoCharacterRig {
  root: THREE.Group;
  head: THREE.Group;
  shoulderL: THREE.Group;
  elbowL: THREE.Group;
  shoulderR: THREE.Group;
  elbowR: THREE.Group;
  hipL: THREE.Group;
  kneeL: THREE.Group;
  hipR: THREE.Group;
  kneeR: THREE.Group;
  mouthFrown: THREE.Object3D;
  mouthSmile: THREE.Object3D;
  browL: THREE.Object3D;
  browR: THREE.Object3D;
  sweatGroup: THREE.Group;
  hardHat: THREE.Group;
  phoneProp: THREE.Group;
  phoneScreenMat: THREE.MeshBasicMaterial;
  setPose: (pose: CharacterPose, frameN?: number) => void;
}

export function createDesmontandoCharacter(opts: CharacterStyleOptions = {}): DesmontandoCharacterRig {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: opts.skinColor ?? '#E8B486',
    roughness: 0.68,
    metalness: 0.02,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: opts.shirtColor ?? '#F0CA4D',
    roughness: 0.65,
    metalness: 0.02,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: opts.shortsColor ?? '#51627A',
    roughness: 0.72,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: opts.hairColor ?? '#3B1F0E',
    roughness: 0.78,
    metalness: 0.02,
  });
  const slipperMat = new THREE.MeshStandardMaterial({
    color: opts.slipperColor ?? '#3B82F6',
    roughness: 0.55,
    metalness: 0.05,
  });
  const darkEyeMat = new THREE.MeshStandardMaterial({color: '#121212', roughness: 0.15});
  const whiteMat = new THREE.MeshBasicMaterial({color: '#FFFFFF'});
  const mouthMat = new THREE.MeshStandardMaterial({color: '#6B1D1D', roughness: 0.5});
  const blushMat = new THREE.MeshBasicMaterial({color: '#E57A70', transparent: true, opacity: 0.55});

  // ==================== 1. QUADRIL / BERMUDA BASE ====================
  const pelvis = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.2, 0.34, 3, 0.06), shortsMat);
  pelvis.position.set(0, 0, 0);
  root.add(pelvis);

  // ==================== 2. PERNAS ARTICULADAS (QUADRIL -> JOELHO -> CANELA -> CHINELO) ====================
  function buildLeg(side: -1 | 1) {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * 0.13, 0.0, 0.04);

    // Coxa revestida pela bermuda azul-acinzentada
    const thighShorts = new THREE.Mesh(new THREE.CylinderGeometry(0.104, 0.096, 0.42, 10), shortsMat);
    thighShorts.position.set(0, -0.21, 0);
    const shortsHem = new THREE.Mesh(new THREE.TorusGeometry(0.096, 0.016, 8, 12), shortsMat);
    shortsHem.rotation.x = Math.PI / 2;
    shortsHem.position.set(0, -0.41, 0);
    hipPivot.add(thighShorts, shortsHem);

    // Junta do Joelho (esfera conectada ao final da coxa)
    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.43, 0);
    const legMat = opts.longPants ? shortsMat : skinMat;
    const kneeSphere = new THREE.Mesh(new THREE.SphereGeometry(opts.longPants ? 0.092 : 0.076, 16, 14), legMat);
    kneePivot.add(kneeSphere);

    // Canela cilíndrica conectada ao joelho (calça ou pele)
    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(opts.longPants ? 0.09 : 0.074, opts.longPants ? 0.08 : 0.064, 0.52, 16),
      legMat
    );
    shin.position.set(0, -0.26, 0);
    kneePivot.add(shin);

    // Chinelo ou sapato conectado ao tornozelo
    const slipper = new THREE.Mesh(
      new RoundedBoxGeometry(opts.longPants ? 0.145 : 0.135, opts.longPants ? 0.075 : 0.06, opts.longPants ? 0.25 : 0.23, 3, 0.025),
      slipperMat
    );
    slipper.position.set(0, -0.54, 0.055);
    slipper.rotation.y = -side * 0.08;
    kneePivot.add(slipper);

    hipPivot.add(kneePivot);
    root.add(hipPivot);
    return {hipPivot, kneePivot};
  }

  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  // ==================== 3. TRONCO AMARELO LOW-POLY + PESCOÇO ====================
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.2, 0.5, 12), shirtMat);
  torso.position.set(0, 0.32, -0.02);
  const torsoTopCap = new THREE.Mesh(new THREE.SphereGeometry(0.212, 12, 8), shirtMat);
  torsoTopCap.scale.y = 0.45;
  torsoTopCap.position.set(0, 0.56, -0.02);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.088, 0.15, 10), skinMat);
  neck.position.set(0, 0.66, -0.01);
  root.add(torso, torsoTopCap, neck);

  // Avental opcional curvado acompanhando o tronco (sem parecer placa solta)
  if (opts.apronColor) {
    const apronMat = new THREE.MeshStandardMaterial({color: opts.apronColor, roughness: 0.65});
    const apronShell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.222, 0.21, 0.44, 16, 1, false, -0.85, 1.7),
      apronMat
    );
    apronShell.position.set(0, 0.24, -0.02);
    const apronWaist = new THREE.Mesh(new THREE.CylinderGeometry(0.216, 0.216, 0.055, 16), apronMat);
    apronWaist.position.set(0, 0.12, -0.02);
    root.add(apronShell, apronWaist);
  }

  // ==================== 4. BRAÇOS ARTICULADOS SEM PEÇAS SOLTAS (OMBRO -> COTOVELO -> MÃO) ====================
  function buildArm(side: -1 | 1) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.245, 0.51, -0.01);

    // Manga esférica amarela (ombro bufante suave igual ao original)
    const puffSleeve = new THREE.Mesh(new THREE.SphereGeometry(0.106, 16, 14), shirtMat);
    shoulderPivot.add(puffSleeve);

    // Braço superior (pele) saindo de dentro da manga
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.28, 16), skinMat);
    upperArm.position.set(0, -0.15, 0);
    shoulderPivot.add(upperArm);

    // Junta do Cotovelo na extremidade exata do braço superior
    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.29, 0);
    const elbowSphere = new THREE.Mesh(new THREE.SphereGeometry(0.056, 14, 12), skinMat);
    elbowPivot.add(elbowSphere);

    // Antebraço saindo do cotovelo
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.048, 0.27, 16), skinMat);
    forearm.position.set(0, -0.135, 0);
    elbowPivot.add(forearm);

    // Mão arredondada na extremidade exata do antebraço
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.066, 16, 14), skinMat);
    hand.scale.set(1.0, 0.85, 1.1);
    hand.position.set(0, -0.28, 0);
    elbowPivot.add(hand);

    shoulderPivot.add(elbowPivot);
    root.add(shoulderPivot);
    return {shoulderPivot, elbowPivot};
  }

  const armL = buildArm(-1);
  const armR = buildArm(1);

  // Smartphone 3D acoplado à mão direita (visível apenas quando ativado no fluxo mobile!)
  const phoneProp = new THREE.Group();
  phoneProp.position.set(0, -0.31, 0.09);
  phoneProp.rotation.x = Math.PI / 2 - 0.35;
  const phoneCase = new THREE.Mesh(
    new RoundedBoxGeometry(0.13, 0.24, 0.024, 3, 0.01),
    new THREE.MeshStandardMaterial({color: '#1E293B', roughness: 0.35, metalness: 0.4})
  );
  const phoneScreenMat = new THREE.MeshBasicMaterial({color: '#38BDF8'});
  const phoneScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.108, 0.2), phoneScreenMat);
  phoneScreen.position.z = 0.013;
  phoneProp.add(phoneCase, phoneScreen);
  phoneProp.visible = false;
  armR.elbowPivot.add(phoneProp);

  // ==================== 5. CABEÇA LOW-POLY + CABELO ALTO + ROSTO EXPRESSIVO ====================
  const head = new THREE.Group();
  head.position.set(0, 0.86, 0.01);
  root.add(head);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.225, 24, 20), skinMat);
  cranium.scale.set(1.08, 0.97, 1.0);
  head.add(cranium);

  // Orelhas laterais
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 12), skinMat);
  earL.position.set(-0.238, -0.01, -0.01);
  const earR = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 12), skinMat);
  earR.position.set(0.238, -0.01, -0.01);
  head.add(earL, earR);

  // Cabelo marrom esculpido ALTO na cabeça (deixando testa e sobrancelhas 100% livres!)
  const hairGroup = new THREE.Group();
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.238, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.43),
    hairMat
  );
  hairCap.scale.set(1.09, 0.98, 1.03);
  hairCap.position.set(0, 0.03, -0.015);
  hairCap.rotation.x = 0.14; // Inclinado para trás para liberar toda a testa e olhos!

  // Topete / variação de estilo de cabelo
  const hStyle = opts.hairStyle ?? 'quiff';
  if (hStyle === 'quiff') {
    const hairQuiff1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.088, 1), hairMat);
    hairQuiff1.scale.set(1.45, 0.65, 1.1);
    hairQuiff1.position.set(0.06, 0.195, 0.145);
    hairQuiff1.rotation.z = -0.18;

    const hairQuiff2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 1), hairMat);
    hairQuiff2.scale.set(1.3, 0.6, 1.0);
    hairQuiff2.position.set(-0.07, 0.185, 0.135);
    hairQuiff2.rotation.z = 0.15;
    hairGroup.add(hairQuiff1, hairQuiff2);
  } else if (hStyle === 'bun') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), hairMat);
    bun.position.set(0, 0.21, -0.16);
    const bangs = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), hairMat);
    bangs.scale.set(1.5, 0.45, 0.8);
    bangs.position.set(0, 0.16, 0.12);
    hairGroup.add(bun, bangs);
  } else if (hStyle === 'bob') {
    const backHair = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.26, 0.24, 3, 0.08), hairMat);
    backHair.position.set(0, -0.02, -0.11);
    const bangs = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), hairMat);
    bangs.scale.set(1.55, 0.5, 0.85);
    bangs.position.set(0, 0.16, 0.12);
    hairGroup.add(backHair, bangs);
  } else {
    // 'short'
    const shortFringe = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), hairMat);
    shortFringe.scale.set(1.5, 0.4, 0.7);
    shortFringe.position.set(0, 0.175, 0.11);
    hairGroup.add(shortFringe);
  }

  // Costeletas laterais discretas atrás das orelhas
  const sideburnL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.09), hairMat);
  sideburnL.position.set(-0.22, 0.06, 0.03);
  const sideburnR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.09), hairMat);
  sideburnR.position.set(0.22, 0.06, 0.03);

  hairGroup.add(hairCap, sideburnL, sideburnR);
  head.add(hairGroup);

  // Olhos pretos brilhantes com pontinho de luz branco (catchlight) — sem esclera esbugalhada!
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 12), darkEyeMat);
    eye.position.set(side * 0.078, 0.022, 0.206);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 8), whiteMat);
    shine.position.set(side * 0.078 - 0.007, 0.03, 0.228);
    head.add(eye, shine);
  });

  // Sobrancelhas expressivas na testa (abaixo do cabelo)
  const browGeo = new THREE.CapsuleGeometry(0.009, 0.042, 4, 8);
  const browL = new THREE.Mesh(browGeo, hairMat);
  browL.position.set(-0.078, 0.078, 0.204);
  browL.rotation.z = Math.PI / 2 - 0.18;

  const browR = new THREE.Mesh(browGeo, hairMat);
  browR.position.set(0.078, 0.078, 0.204);
  browR.rotation.z = Math.PI / 2 + 0.18;
  head.add(browL, browR);

  // Nariz ovalado pequeno + Bochechas rosadas
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 10, 8),
    new THREE.MeshStandardMaterial({color: '#D4976A', roughness: 0.75})
  );
  nose.scale.set(1.25, 0.85, 0.9);
  nose.position.set(0, -0.015, 0.224);

  const cheekL = new THREE.Mesh(new THREE.CircleGeometry(0.034, 12), blushMat);
  cheekL.position.set(-0.125, -0.028, 0.194);
  cheekL.rotation.y = -0.35;
  const cheekR = new THREE.Mesh(new THREE.CircleGeometry(0.034, 12), blushMat);
  cheekR.position.set(0.125, -0.028, 0.194);
  cheekR.rotation.y = 0.35;
  head.add(nose, cheekL, cheekR);

  // Boca triste/calor (arco para baixo) vs Boca feliz (arco para cima)
  const mouthFrown = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.0095, 8, 16, Math.PI), mouthMat);
  mouthFrown.position.set(0, -0.09, 0.208);

  const mouthSmile = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0095, 8, 16, Math.PI), mouthMat);
  mouthSmile.rotation.z = Math.PI;
  mouthSmile.position.set(0, -0.058, 0.212);
  head.add(mouthFrown, mouthSmile);

  // Gotinha de suor azul em formato de gota no pescoço/bochecha (igual ao frame original!)
  const sweatGroup = new THREE.Group();
  const dropCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.018, 0.048, 10),
    new THREE.MeshStandardMaterial({color: '#4DD0E1', roughness: 0.2})
  );
  dropCone.position.set(-0.065, -0.14, 0.195);
  sweatGroup.add(dropCone);
  head.add(sweatGroup);

  // Capacete de obra amarelo opcional (para vídeos de construção civil / prédios / telhados!)
  const hardHat = new THREE.Group();
  const hatDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
    new THREE.MeshStandardMaterial({color: '#FACC15', roughness: 0.4, flatShading: true})
  );
  hatDome.position.y = 0.06;
  const hatBrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.025, 16),
    new THREE.MeshStandardMaterial({color: '#EAB308', roughness: 0.4, flatShading: true})
  );
  hatBrim.position.set(0, 0.06, 0.03);
  hardHat.add(hatDome, hatBrim);
  hardHat.visible = false;
  head.add(hardHat);

  // ==================== CONTROLADOR DE POSES REUTILIZÁVEIS ====================
  const setPose = (pose: CharacterPose, frameN = 0) => {
    if (pose === 'sitting_hot' || pose === 'sitting_cool') {
      const isHot = pose === 'sitting_hot';
      // Olha levemente para a direita (em direção ao balde/experimento no banquinho, igual ao original!)
      head.rotation.y = 0.22 + Math.sin(frameN * 0.05) * 0.06;
      head.position.y = 0.86 + Math.sin(frameN * 0.1) * 0.008;
      mouthFrown.visible = isHot;
      mouthSmile.visible = !isHot;
      sweatGroup.visible = isHot;
      browL.rotation.z = Math.PI / 2 + (isHot ? 0.22 : -0.08);
      browR.rotation.z = Math.PI / 2 - (isHot ? 0.22 : -0.08);

      // Coxas horizontais para frente sobre o assento e canelas verticais para baixo na frente da poltrona!
      legL.hipPivot.rotation.set(-Math.PI / 2 + 0.06, -0.05, 0);
      legL.kneePivot.rotation.set(Math.PI / 2 - 0.06, 0, 0);
      legR.hipPivot.rotation.set(-Math.PI / 2 + 0.06, 0.05, 0);
      legR.kneePivot.rotation.set(Math.PI / 2 - 0.06, 0, 0);

      // Braços descendo pelo tronco e antebraços estendidos à frente sobre os braços da poltrona (igual à foto original!)
      armL.shoulderPivot.rotation.set(-0.32, 0, 0.1);
      armL.elbowPivot.rotation.set(-0.95, 0.14, 0);

      if (isHot) {
        armR.shoulderPivot.rotation.set(-0.34 + Math.sin(frameN * 0.18) * 0.06, 0, -0.1);
        armR.elbowPivot.rotation.set(-0.96 + Math.sin(frameN * 0.18) * 0.08, -0.14, 0);
      } else {
        armR.shoulderPivot.rotation.set(-0.32, 0, -0.1);
        armR.elbowPivot.rotation.set(-0.95, -0.14, 0);
      }
    } else if (pose === 'sitting_table') {
      head.rotation.y = Math.sin(frameN * 0.05) * 0.14;
      head.position.y = 0.86 + Math.sin(frameN * 0.09) * 0.006;
      mouthFrown.visible = false;
      mouthSmile.visible = true;
      sweatGroup.visible = false;
      browL.rotation.z = Math.PI / 2 - 0.08;
      browR.rotation.z = Math.PI / 2 + 0.08;
      // Coxas inclinadas levemente para baixo (livram a borda da mesa) e canelas verticais até o piso
      legL.hipPivot.rotation.set(-Math.PI / 2 + 0.16, -0.05, 0);
      legL.kneePivot.rotation.set(Math.PI / 2 - 0.16, 0, 0);
      legR.hipPivot.rotation.set(-Math.PI / 2 + 0.16, 0.05, 0);
      legR.kneePivot.rotation.set(Math.PI / 2 - 0.16, 0, 0);
      // Braços confortáveis próximos ao tronco sem atravessar pratos nem mesa
      armL.shoulderPivot.rotation.set(-0.28, 0, 0.12);
      armL.elbowPivot.rotation.set(-1.1, 0.15, 0);
      armR.shoulderPivot.rotation.set(-0.34 + Math.sin(frameN * 0.1) * 0.05, 0, -0.12);
      armR.elbowPivot.rotation.set(-1.12 + Math.sin(frameN * 0.1) * 0.06, -0.15, 0);
    } else if (pose === 'sitting_desk') {
      head.rotation.y = Math.sin(frameN * 0.04) * 0.08;
      head.position.y = 0.86 + Math.sin(frameN * 0.09) * 0.006;
      mouthFrown.visible = false;
      mouthSmile.visible = true;
      sweatGroup.visible = false;
      browL.rotation.z = Math.PI / 2 - 0.08;
      browR.rotation.z = Math.PI / 2 + 0.08;
      legL.hipPivot.rotation.set(-Math.PI / 2 + 0.05, -0.05, 0);
      legL.kneePivot.rotation.set(Math.PI / 2 - 0.05, 0, 0);
      legR.hipPivot.rotation.set(-Math.PI / 2 + 0.05, 0.05, 0);
      legR.kneePivot.rotation.set(Math.PI / 2 - 0.05, 0, 0);
      armL.shoulderPivot.rotation.set(-0.55, 0, 0.12);
      armL.elbowPivot.rotation.set(-0.92 + Math.sin(frameN * 0.25) * 0.06, 0.18, 0);
      armR.shoulderPivot.rotation.set(-0.55, 0, -0.12);
      armR.elbowPivot.rotation.set(-0.92 + Math.cos(frameN * 0.25) * 0.06, -0.18, 0);
    } else if (pose === 'standing_phone') {
      head.rotation.y = 0.14 + Math.sin(frameN * 0.05) * 0.05;
      head.rotation.x = 0.08;
      head.position.y = 0.86 + Math.sin(frameN * 0.09) * 0.006;
      mouthFrown.visible = false;
      mouthSmile.visible = true;
      sweatGroup.visible = false;
      browL.rotation.z = Math.PI / 2 - 0.08;
      browR.rotation.z = Math.PI / 2 + 0.08;
      legL.hipPivot.rotation.set(0, 0, 0);
      legL.kneePivot.rotation.set(0, 0, 0);
      legR.hipPivot.rotation.set(0, 0, 0);
      legR.kneePivot.rotation.set(0, 0, 0);
      armL.shoulderPivot.rotation.set(-0.18, 0, 0.12);
      armL.elbowPivot.rotation.set(-0.35, 0, 0);
      // Braço direito erguido apontando o celular para a gôndola!
      armR.shoulderPivot.rotation.set(-0.78 + Math.sin(frameN * 0.12) * 0.04, -0.12, -0.08);
      armR.elbowPivot.rotation.set(-0.85, -0.15, 0);
    } else if (pose === 'standing_worried') {
      head.rotation.y = 0.18 + Math.sin(frameN * 0.08) * 0.08;
      head.rotation.x = 0;
      head.position.y = 0.86 + Math.sin(frameN * 0.12) * 0.008;
      mouthFrown.visible = true;
      mouthSmile.visible = false;
      sweatGroup.visible = true;
      browL.rotation.z = Math.PI / 2 + 0.22;
      browR.rotation.z = Math.PI / 2 - 0.22;
      legL.hipPivot.rotation.set(0, 0, 0);
      legL.kneePivot.rotation.set(0, 0, 0);
      legR.hipPivot.rotation.set(0, 0, 0);
      legR.kneePivot.rotation.set(0, 0, 0);
      armL.shoulderPivot.rotation.set(-0.25, 0, 0.16);
      armL.elbowPivot.rotation.set(-0.7, 0, 0);
      armR.shoulderPivot.rotation.set(-0.35 + Math.sin(frameN * 0.2) * 0.08, 0, -0.16);
      armR.elbowPivot.rotation.set(-0.9, 0, 0);
    } else if (pose === 'standing_wave') {
      mouthFrown.visible = false;
      mouthSmile.visible = true;
      sweatGroup.visible = false;
      legL.hipPivot.rotation.set(0, 0, 0);
      legL.kneePivot.rotation.set(0, 0, 0);
      legR.hipPivot.rotation.set(0, 0, 0);
      legR.kneePivot.rotation.set(0, 0, 0);
      armL.shoulderPivot.rotation.set(0, 0, -2.55);
      armL.elbowPivot.rotation.set(0, 0, 0);
      armR.shoulderPivot.rotation.set(0, 0, 2.55);
      armR.elbowPivot.rotation.set(0, 0, 0);
    } else {
      mouthFrown.visible = false;
      mouthSmile.visible = true;
      sweatGroup.visible = false;
      legL.hipPivot.rotation.set(0, 0, 0);
      legL.kneePivot.rotation.set(0, 0, 0);
      legR.hipPivot.rotation.set(0, 0, 0);
      legR.kneePivot.rotation.set(0, 0, 0);
      armL.shoulderPivot.rotation.set(0, 0, 0.12);
      armL.elbowPivot.rotation.set(-0.2, 0, 0);
      armR.shoulderPivot.rotation.set(0, 0, -0.12);
      armR.elbowPivot.rotation.set(-0.2, 0, 0);
    }
  };

  setPose('sitting_hot', 0);

  return {
    root,
    head,
    shoulderL: armL.shoulderPivot,
    elbowL: armL.elbowPivot,
    shoulderR: armR.shoulderPivot,
    elbowR: armR.elbowPivot,
    hipL: legL.hipPivot,
    kneeL: legL.kneePivot,
    hipR: legR.hipPivot,
    kneeR: legR.kneePivot,
    mouthFrown,
    mouthSmile,
    browL,
    browR,
    sweatGroup,
    hardHat,
    phoneProp,
    phoneScreenMat,
    setPose,
  };
}

/** Poltrona Verde 3D Chanfrada com RoundedBoxGeometry (idêntica à do @desmontandoomundo) */
export function createBeveledArmchair(): THREE.Group {
  const armchairGroup = new THREE.Group();
  const darkGreenMat = new THREE.MeshStandardMaterial({color: '#007E60', roughness: 0.68});
  const midGreenMat = new THREE.MeshStandardMaterial({color: '#059674', roughness: 0.65});
  const woodLegMat = new THREE.MeshStandardMaterial({color: '#5C3A1E', roughness: 0.75});

  // 4 Pés cilíndricos de madeira escura
  [
    [-0.5, -0.42],
    [0.5, -0.42],
    [-0.5, 0.38],
    [0.5, 0.38],
  ].forEach(([lx, lz]) => {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.036, 0.24, 12), woodLegMat);
    foot.position.set(lx, 0.12, lz);
    armchairGroup.add(foot);
  });

  // Base inferior chanfrada (z vai de -0.52 até +0.44 para deixar espaço livre para as canelas em z = +0.49!)
  const baseBox = new THREE.Mesh(new RoundedBoxGeometry(1.28, 0.22, 0.96, 4, 0.055), darkGreenMat);
  baseBox.position.set(0, 0.32, -0.04);

  // Almofada do assento chanfrada (topo em y = 0.61)
  const seatCushion = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.2, 0.88, 4, 0.06), midGreenMat);
  seatCushion.position.set(0, 0.51, -0.02);

  // Encosto chanfrado levemente reclinado
  const chairBack = new THREE.Mesh(new RoundedBoxGeometry(1.22, 0.96, 0.28, 4, 0.075), darkGreenMat);
  chairBack.position.set(0, 0.96, -0.42);
  chairBack.rotation.x = -0.1;

  // Braços laterais arredondados
  const armL = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.52, 0.98, 4, 0.07), midGreenMat);
  armL.position.set(-0.54, 0.62, -0.03);
  const armR = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.52, 0.98, 4, 0.07), midGreenMat);
  armR.position.set(0.54, 0.62, -0.03);

  armchairGroup.add(baseBox, seatCushion, chairBack, armL, armR);
  return armchairGroup;
}

/** Balde Metálico Frisado com Alça Curva e Monte de Gelo Low-Poly (idêntico ao do @desmontandoomundo) */
export function createRibbedIceBucket(): {
  bucketGroup: THREE.Group;
  iceCubesGroup: THREE.Group;
  waterMesh: THREE.Mesh;
} {
  const bucketGroup = new THREE.Group();
  const bucketMat = new THREE.MeshStandardMaterial({
    color: '#635A52',
    roughness: 0.48,
    metalness: 0.26,
  });
  const handleMat = new THREE.MeshStandardMaterial({
    color: '#2B2927',
    roughness: 0.4,
    metalness: 0.45,
  });

  // Corpo cônico do balde
  const bucketWall = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.32, 0.72, 32), bucketMat);
  bucketWall.position.y = 0.36;
  bucketGroup.add(bucketWall);

  // Borda superior + 3 frisos horizontais em relevo no corpo do balde (exatamente como na imagem original!)
  const ribs = [
    {y: 0.71, r: 0.432, tube: 0.018},
    {y: 0.54, r: 0.402, tube: 0.011},
    {y: 0.37, r: 0.375, tube: 0.011},
    {y: 0.2, r: 0.348, tube: 0.011},
  ];
  ribs.forEach(({y, r, tube}) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 32), bucketMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    bucketGroup.add(ring);
  });

  // Alça curva preta articulada nas laterais
  const bucketHandle = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.016, 10, 32, Math.PI), handleMat);
  bucketHandle.position.y = 0.71;
  bucketHandle.rotation.x = -0.14;
  bucketGroup.add(bucketHandle);

  // Água interna
  const waterMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.405, 0.38, 0.1, 28),
    new THREE.MeshStandardMaterial({color: '#88BDF2', roughness: 0.2, metalness: 0.08})
  );
  waterMesh.position.y = 0.64;
  bucketGroup.add(waterMesh);

  // Monte piramidal de cubos/blocos de gelo branco low-poly no topo
  const iceCubesGroup = new THREE.Group();
  iceCubesGroup.position.y = 0.68;
  const iceMat = new THREE.MeshStandardMaterial({
    color: '#F1F5F9',
    roughness: 0.22,
    metalness: 0.04,
    flatShading: true,
  });
  for (let i = 0; i < 18; i++) {
    const isTop = i >= 12;
    const size = isTop ? 0.145 : 0.16;
    const cube = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.85, size), iceMat);
    const a = (i / (isTop ? 6 : 12)) * Math.PI * 2;
    const r = isTop ? (i % 2) * 0.09 : 0.12 + (i % 2) * 0.11;
    const py = isTop ? 0.075 + (i % 2) * 0.04 : (i % 2) * 0.025;
    cube.position.set(Math.cos(a) * r, py, Math.sin(a) * r);
    cube.rotation.set(0.35 + i * 0.5, i * 0.8, 0.25 + i * 0.4);
    iceCubesGroup.add(cube);
  }
  bucketGroup.add(iceCubesGroup);

  return {bucketGroup, iceCubesGroup, waterMesh};
}
