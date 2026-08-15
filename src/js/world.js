import * as THREE from "three";
import { CONFIG } from "./config.js";
import { WAITERS, REGULAR, buildWaiterMesh, buildCustomerMesh, randomCustomerDef } from "./npcs.js";
import { NpcAgent } from "./npcAi.js";
import { LAYOUT, floorHeightAt } from "./layout.js";
import { buildBarFromPlan, placePlanTables } from "./barZones.js";

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.75,
    metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  });
}

function meshBox(w, h, d, color, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function meshCyl(rTop, rBot, h, color, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 12), mat(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Folha estilo Minecraft: pixels verdes com buracos (alphaTest). */
function makeLeafTexture(hex = "#3d8c28", accent = "#6bc03a") {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  const cell = 4;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const n = (x * 17 + y * 31) % 11;
      if (n < 4) continue; // buraco transparente
      ctx.fillStyle = n % 2 === 0 ? hex : accent;
      ctx.fillRect(x, y, cell, cell);
      if (n > 8) {
        ctx.fillStyle = "#1e4a14";
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeBarkTexture() {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#5a3a22";
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 4) {
    ctx.fillStyle = x % 8 === 0 ? "#3a2414" : "#6a4828";
    ctx.fillRect(x, 0, 2, size);
  }
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = "#2a1810";
    ctx.fillRect((i * 7) % size, (i * 11) % size, 2, 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

let _leafMats = null;
function leafMaterials() {
  if (_leafMats) return _leafMats;
  const greens = [
    makeLeafTexture("#2f7a22", "#4aa832"),
    makeLeafTexture("#3d8c28", "#6bc03a"),
    makeLeafTexture("#c44a88", "#e070a8"), // flor/rosa
  ];
  _leafMats = greens.map(
    (map) =>
      new THREE.MeshStandardMaterial({
        map,
        transparent: true,
        alphaTest: 0.45,
        roughness: 0.9,
        metalness: 0,
        side: THREE.DoubleSide,
        depthWrite: true,
      })
  );
  return _leafMats;
}

/**
 * Árvore voxel (tronco + copa em cruz) — dá pra ver através das folhas.
 * @param {"green"|"flower"} variant
 */
function buildMinecraftTree(x, z, variant = "green", scale = 1) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);

  const bark = new THREE.MeshStandardMaterial({
    map: makeBarkTexture(),
    roughness: 0.95,
    metalness: 0,
  });
  const trunkH = 2.4 * scale;
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, trunkH, 0.55 * scale), bark);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  root.add(trunk);

  const mats = leafMaterials();
  const leafMat = variant === "flower" ? mats[2] : mats[scale > 1 ? 1 : 0];
  const s = 0.85 * scale;
  const baseY = trunkH + 0.1 * scale;

  // Camadas em cruz / plus (estilo Minecraft)
  const layers = [
    { y: 0, blocks: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] },
    { y: 1, blocks: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]] },
    { y: 2, blocks: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] },
    { y: 3, blocks: [[0, 0]] },
  ];

  for (const layer of layers) {
    for (const [bx, bz] of layer.blocks) {
      // Pula alguns cantos pra ficar mais “furado”
      if (Math.abs(bx) === 1 && Math.abs(bz) === 1 && layer.y === 0 && (bx + bz) % 2 === 0) continue;
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), leafMat);
      leaf.position.set(bx * s * 0.92, baseY + layer.y * s * 0.9, bz * s * 0.92);
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      root.add(leaf);
    }
  }

  // Variante flor: manchas rosa extras na copa
  if (variant === "flower") {
    for (const [bx, bz, by] of [
      [1.2, 0.3, 1],
      [-0.8, 1.1, 2],
      [0.4, -1.0, 1],
    ]) {
      const blossom = new THREE.Mesh(new THREE.BoxGeometry(s * 0.85, s * 0.85, s * 0.85), mats[2]);
      blossom.position.set(bx * s, baseY + by * s * 0.9, bz * s);
      root.add(blossom);
    }
  }

  return root;
}

function addWallCollider(list, x, z, w, d) {
  list.push({
    minX: x - w / 2,
    maxX: x + w / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
  });
}

/** Canvas texture for simple signs / nametags. */
function makeLabelTexture(text, opts = {}) {
  const w = opts.w || 512;
  const h = opts.h || 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = opts.color || "#ffd84a";
  ctx.font = opts.font || "bold 64px Bebas Neue, Arial Black, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (opts.shadow) {
    ctx.fillStyle = opts.shadow;
    ctx.fillText(text, w / 2 + 2, h / 2 + 2);
    ctx.fillStyle = opts.color || "#ffd84a";
  }
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFlagTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 180;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#009c3b";
  ctx.fillRect(0, 0, 256, 180);
  ctx.fillStyle = "#ffdf00";
  ctx.beginPath();
  ctx.moveTo(128, 18);
  ctx.lineTo(236, 90);
  ctx.lineTo(128, 162);
  ctx.lineTo(20, 90);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#002776";
  ctx.beginPath();
  ctx.arc(128, 90, 36, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.interactables = [];
    this.seats = [];
    this.waiters = [];
    this.customers = [];
    this.npcAgents = [];
    this.tvs = [];
    this.cars = [];
    this._blinkLights = [];
    this._smoke = [];
    this.onGoal = null;
    this.onTvEvent = null;
    this.nightPhase = 0; // 0 early → 1 late
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this._awningLights = [];
    this._rain = null;
    this._sessionT = 0;
    this._rainPulseUntil = 0;
    this._quality = "high";
    this._goalBoost = 1;
    this._rainSeed = Math.random();
    this._build();
  }

  _build() {
    this._lights();
    this._street();
    this._awning();
    buildBarFromPlan(this);
    this._furniture();
    this._streetProps();
    this._spawnWaiters();
    this._spawnRegular();
    this._spawnCustomers();
    this._buildRain();
  }

  getFloorHeight(x, z) {
    return floorHeightAt(x, z);
  }

  _lights() {
    // Night, but bright enough to read the yellow bar
    const amb = new THREE.AmbientLight(0xfff0d8, 0.72);
    this.scene.add(amb);

    const hemi = new THREE.HemisphereLight(0xd0daf0, 0x5a4020, 1.0);
    this.scene.add(hemi);

    const moon = new THREE.DirectionalLight(0xd0dcff, 0.55);
    moon.position.set(-8, 18, 10);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -24;
    moon.shadow.camera.right = 24;
    moon.shadow.camera.top = 24;
    moon.shadow.camera.bottom = -24;
    this.scene.add(moon);

    // Warm glow under awning + sidewalk
    for (const [x, z] of [
      [-5, 2.2],
      [-2, 2.2],
      [1, 2.2],
      [4, 2.2],
      [-5, 3.8],
      [0, 3.8],
      [4, 3.8],
    ]) {
      const l = new THREE.PointLight(0xffc85a, 2.2, 14, 1.4);
      l.position.set(x, 2.9, z);
      this.scene.add(l);
      this._awningLights.push(l);
    }

    // Bright interior fills (salão fundo + cozinha + banheiro)
    for (const [x, z, i] of [
      [-3, -2.2, 2.4],
      [0.5, -1.5, 2.8],
      [3.5, -1.8, 2.2],
      [-2, 0.2, 2.0],
      [2, 0.4, 2.0],
      [-4, -6.5, 2.2],
      [0, -7.5, 2.6],
      [3, -6.0, 2.0],
      [-5, -11, 1.8],
      [1, -11.5, 2.2],
      [6, -9.5, 2.4],
      [6.5, -12.5, 2.0],
      [-7, -12, 1.5],
    ]) {
      const interior = new THREE.PointLight(0xfff2d8, i, 16, 1.35);
      interior.position.set(x, 2.7, z);
      this.scene.add(interior);
    }

    // Street lamps along the curb
    for (const x of [-8, -2, 4, 10]) {
      const lamp = new THREE.PointLight(0xffe8b0, 2.4, 16, 1.5);
      lamp.position.set(x, 4.2, 6.5);
      this.scene.add(lamp);
      this._blinkLights.push({ light: lamp, base: 2.4, phase: Math.random() * Math.PI * 2 });
      const pole = meshCyl(0.06, 0.08, 4.2, 0x333338, { metalness: 0.4, roughness: 0.45 });
      pole.position.set(x, 2.1, 6.5);
      this.group.add(pole);
      const head = meshBox(0.35, 0.12, 0.35, 0xffe8a0, {
        emissive: 0xffcc66,
        emissiveIntensity: 0.9,
      });
      head.position.set(x, 4.25, 6.5);
      this.group.add(head);
    }

    // Street fill — evita “buraco preto” olhando pra longe
    const streetFill = new THREE.PointLight(0xffe2b0, 1.6, 28, 1.6);
    streetFill.position.set(0, 5.5, 11);
    this.scene.add(streetFill);

    this.scene.background = new THREE.Color(0x12182a);
    this.scene.fog = new THREE.Fog(0x12182a, 28, 70);
  }

  _street() {
    const street = meshBox(60, 0.08, 28, CONFIG.colors.asphalt, { roughness: 0.95 });
    street.position.set(0, -0.04, 12);
    this.group.add(street);

    // Wide sidewalk in front of the bar (lavanda)
    const sidewalk = meshBox(32, 0.12, 7.5, 0x9a9a9c, { roughness: 0.9 });
    sidewalk.position.set(0, 0.04, 3.6);
    this.group.add(sidewalk);

    const curb = meshBox(32, 0.2, 0.3, 0x6a6a6c);
    curb.position.set(0, 0.1, 7.2);
    this.group.add(curb);

    // Crosswalk paint
    for (let i = 0; i < 6; i++) {
      const stripe = meshBox(0.7, 0.02, 2.8, 0xe8e8e8, { roughness: 0.85 });
      stripe.position.set(-1.8 + i * 0.95, 0.02, 8.8);
      this.group.add(stripe);
    }

    // Árvores na calçada (lavanda) — posições da planta
    for (const [tx, tz] of LAYOUT.trees) {
      const tree = buildMinecraftTree(tx, tz, tz > 4.7 ? "green" : "flower", 1.1);
      this.group.add(tree);
      addWallCollider(this.colliders, tx, tz, 0.65, 0.65);
    }

    // Far sidewalk
    const farWalk = meshBox(50, 0.1, 3.5, 0x7a7a7c, { roughness: 0.92 });
    farWalk.position.set(0, 0.02, 18);
    this.group.add(farWalk);

    this._buildCityBackdrop();
  }

  /** Prédios altos atrás do bar (foto real: branco com arcs + torre de vidro). */
  _buildCityBackdrop() {
    // Bloco branco com sacadas/arcos (esquerda-centro, atrás do bar)
    const whiteX = -4;
    const whiteZ = -19.5;
    const whiteW = 14;
    const whiteH = 22;
    const white = meshBox(whiteW, whiteH, 3.2, 0xece8e0, { roughness: 0.7 });
    white.position.set(whiteX, whiteH / 2, whiteZ);
    this.group.add(white);

    for (let floor = 0; floor < 9; floor++) {
      for (let col = 0; col < 5; col++) {
        const wx = whiteX - whiteW * 0.35 + col * (whiteW * 0.175);
        const wy = 1.8 + floor * 2.3;
        // Arched balcony recess
        const arch = meshBox(1.35, 1.7, 0.35, 0xd8d2c8, { roughness: 0.65 });
        arch.position.set(wx, wy, whiteZ + 1.55);
        this.group.add(arch);
        const opening = meshBox(1.0, 1.25, 0.2, 0x1a2230, {
          emissive: 0x445566,
          emissiveIntensity: floor % 2 === 0 ? 0.35 : 0.12,
          roughness: 0.5,
        });
        opening.position.set(wx, wy - 0.05, whiteZ + 1.72);
        this.group.add(opening);
        // Plant hint
        if ((floor + col) % 3 === 0) {
          const plant = meshBox(0.55, 0.35, 0.25, 0x2d6a28);
          plant.position.set(wx, wy - 0.7, whiteZ + 1.85);
          this.group.add(plant);
        }
      }
    }

    // Torre de vidro à direita
    const glassX = 12;
    const glassZ = -20;
    const glassW = 6.5;
    const glassH = 28;
    const glass = meshBox(glassW, glassH, 4.0, 0x6a7a8a, {
      roughness: 0.25,
      metalness: 0.45,
      emissive: 0x223344,
      emissiveIntensity: 0.15,
    });
    glass.position.set(glassX, glassH / 2, glassZ);
    this.group.add(glass);
    for (let floor = 0; floor < 14; floor++) {
      const band = meshBox(glassW + 0.05, 0.08, 4.05, 0xdde8f0, {
        roughness: 0.3,
        metalness: 0.5,
      });
      band.position.set(glassX, 1.2 + floor * 1.9, glassZ);
      this.group.add(band);
      const win = meshBox(glassW - 0.4, 1.4, 0.08, 0x88aacc, {
        emissive: 0x6688aa,
        emissiveIntensity: 0.25,
        roughness: 0.2,
        metalness: 0.4,
      });
      win.position.set(glassX, 1.9 + floor * 1.9, glassZ + 2.05);
      this.group.add(win);
    }

    // Prédio auxiliar à esquerda
    const left = meshBox(8, 16, 2.8, 0xd4cfc6, { roughness: 0.75 });
    left.position.set(-16, 8, -17);
    this.group.add(left);
    for (let floor = 0; floor < 6; floor++) {
      for (let col = 0; col < 3; col++) {
        const w = meshBox(1.2, 1.1, 0.1, 0x223040, {
          emissive: 0x556677,
          emissiveIntensity: 0.2,
        });
        w.position.set(-18.2 + col * 2.2, 2 + floor * 2.4, -15.55);
        this.group.add(w);
      }
    }

    // Prédios do outro lado da rua (fundo)
    for (const [x, w, h, col] of [
      [-18, 7, 14, 0x3a4250],
      [-8, 6, 18, 0x4a5060],
      [4, 8, 12, 0x353c48],
      [16, 7, 20, 0x2e3644],
    ]) {
      const b = meshBox(w, h, 2.4, col, { roughness: 0.8 });
      b.position.set(x, h / 2, 21);
      this.group.add(b);
      for (let row = 0; row < 4; row++) {
        for (let c = 0; c < 2; c++) {
          const win = meshBox(0.55, 0.7, 0.06, 0xffe8a0, {
            emissive: 0xffcc66,
            emissiveIntensity: 0.5,
          });
          win.position.set(x - w * 0.22 + c * w * 0.4, 2.2 + row * 2.5, 19.75);
          this.group.add(win);
        }
      }
    }
  }

  _awning() {
    // Toldo amarelo com volume (pano + estrutura + babado)
    const cloth = meshBox(28, 0.14, 5.8, 0xe8b000, {
      roughness: 0.88,
      emissive: 0x886600,
      emissiveIntensity: 0.28,
    });
    cloth.position.set(0, 3.28, 2.4);
    cloth.rotation.x = -0.06;
    this.group.add(cloth);

    const clothUnder = meshBox(27.6, 0.06, 5.5, 0xc99600, {
      roughness: 0.92,
      emissive: 0x664400,
      emissiveIntensity: 0.12,
    });
    clothUnder.position.set(0, 3.16, 2.35);
    clothUnder.rotation.x = -0.06;
    this.group.add(clothUnder);

    for (const x of [-12, -8, -4, 0, 4, 8, 12]) {
      const arm = meshBox(0.08, 0.08, 5.3, 0x2e2e2e, { metalness: 0.5, roughness: 0.38 });
      arm.position.set(x, 3.14, 2.25);
      this.group.add(arm);
      const pole = meshCyl(0.05, 0.055, 3.15, 0x242424, { metalness: 0.55, roughness: 0.38 });
      pole.position.set(x, 1.55, 4.85);
      this.group.add(pole);
      const foot = meshCyl(0.1, 0.12, 0.08, 0x1a1a1a, { metalness: 0.4, roughness: 0.5 });
      foot.position.set(x, 0.04, 4.85);
      this.group.add(foot);
    }

    // Babado / valance frontal
    const val = meshBox(28.2, 0.48, 0.12, 0xffd400, {
      roughness: 0.78,
      emissive: 0xaa8800,
      emissiveIntensity: 0.28,
    });
    val.position.set(0, 2.92, 5.25);
    this.group.add(val);
    for (let i = 0; i < 14; i++) {
      const scallop = meshBox(1.6, 0.22, 0.08, i % 2 === 0 ? 0xffd84a : 0xe8b000, {
        roughness: 0.85,
        emissive: 0x886600,
        emissiveIntensity: 0.15,
      });
      scallop.position.set(-13 + i * 2, 2.68, 5.28);
      this.group.add(scallop);
    }
  }

  _makeTable(x, z, rot = 0, dark = true, floorY = 0) {
    const wood = dark ? 0x1a1410 : CONFIG.colors.woodLight;
    const g = new THREE.Group();
    const top = meshBox(1.1, 0.06, 0.55, wood);
    top.position.y = 0.72;
    g.add(top);
    const leg = meshCyl(0.04, 0.05, 0.72, wood);
    leg.position.y = 0.36;
    g.add(leg);
    g.position.set(x, floorY, z);
    g.rotation.y = rot;
    this.group.add(g);
    addWallCollider(this.colliders, x, z, 0.9, 0.55);

    for (const [ox, oz, cr] of [
      [0.55, 0.45, Math.PI * 0.85],
      [0.55, -0.45, Math.PI * 1.15],
      [-0.55, 0.45, Math.PI * 0.15],
      [-0.55, -0.45, -Math.PI * 0.15],
    ]) {
      const cx = x + Math.cos(rot) * ox - Math.sin(rot) * oz;
      const cz = z + Math.sin(rot) * ox + Math.cos(rot) * oz;
      this._makeChair(cx, cz, cr + rot, dark, floorY);
    }

    this.seats.push({
      kind: "seat",
      label: "Sentar",
      position: new THREE.Vector3(x + 0.65, floorY + 0.55, z),
      lookAt: new THREE.Vector3(x, floorY + 1.3, z),
      radius: 1.05,
      claimedBy: null,
    });
    this.seats.push({
      kind: "seat",
      label: "Sentar",
      position: new THREE.Vector3(x - 0.65, floorY + 0.55, z),
      lookAt: new THREE.Vector3(x, floorY + 1.3, z),
      radius: 1.05,
      claimedBy: null,
    });

    const ketchup = meshCyl(0.035, 0.04, 0.16, 0xcc2020);
    ketchup.position.set(x + 0.15, floorY + 0.85, z + 0.08);
    this.group.add(ketchup);
    const mustard = meshCyl(0.035, 0.04, 0.16, 0xe8b400);
    mustard.position.set(x + 0.25, floorY + 0.85, z + 0.08);
    this.group.add(mustard);
    const napkin = meshBox(0.12, 0.1, 0.08, 0x222222);
    napkin.position.set(x - 0.15, floorY + 0.8, z + 0.1);
    this.group.add(napkin);
  }

  _makeChair(x, z, rot, dark = true, floorY = 0) {
    const wood = dark ? 0x1a1410 : CONFIG.colors.wood;
    const g = new THREE.Group();
    const seat = meshBox(0.38, 0.05, 0.38, wood);
    seat.position.y = 0.45;
    g.add(seat);
    const back = meshBox(0.38, 0.42, 0.05, wood);
    back.position.set(0, 0.7, -0.16);
    g.add(back);
    for (const sy of [0.55, 0.68, 0.82]) {
      const slat = meshBox(0.36, 0.04, 0.04, wood);
      slat.position.set(0, sy, -0.16);
      g.add(slat);
    }
    for (const [lx, lz] of [
      [-0.13, -0.13],
      [0.13, -0.13],
      [-0.13, 0.13],
      [0.13, 0.13],
    ]) {
      const leg = meshBox(0.04, 0.45, 0.04, wood);
      leg.position.set(lx, 0.225, lz);
      g.add(leg);
    }
    g.position.set(x, floorY, z);
    g.rotation.y = rot;
    this.group.add(g);
  }

  _furniture() {
    placePlanTables(this, (x, z, rot, dark, floorY) => this._makeTable(x, z, rot, dark, floorY));
    // Algumas mesas na calçada (lavanda)
    for (const [x, z] of [
      [-5, 3.2],
      [-1, 3.5],
      [3, 3.3],
    ]) {
      this._makeTable(x, z, 0.05, true, 0);
    }
  }

  _streetProps() {
    this.cars.push(this._makeCar(-10, 9.6, 0x9aa0a8, 3.2));
    this.cars.push(this._makeCar(4, 10.2, 0x1a1a1e, -2.6));
    this.cars.push(this._makeCar(14, 9.4, 0xb0b4b8, 2.1));

    const pole = meshCyl(0.1, 0.12, 7, 0x6a6a6c);
    pole.position.set(-11, 3.5, 6.2);
    this.group.add(pole);
    const xfmr = meshBox(0.5, 0.7, 0.4, 0x555555);
    xfmr.position.set(-11, 5.8, 6.2);
    this.group.add(xfmr);

    for (const y of [6.2, 6.5, 6.8]) {
      const wire = meshBox(28, 0.02, 0.02, 0x111111);
      wire.position.set(0, y, 5.8);
      wire.rotation.z = 0.015;
      this.group.add(wire);
    }

    const bike = meshBox(0.4, 0.55, 1.3, 0x222222);
    bike.position.set(-9.2, 0.35, 6.0);
    this.group.add(bike);
    const wheel1 = meshCyl(0.22, 0.22, 0.08, 0x111111);
    wheel1.rotation.z = Math.PI / 2;
    wheel1.position.set(-9.2, 0.22, 5.5);
    this.group.add(wheel1);
    const wheel2 = wheel1.clone();
    wheel2.position.z = 6.5;
    this.group.add(wheel2);
  }

  _makeCar(x, z, color, speed = 2.5) {
    const g = new THREE.Group();
    const body = meshBox(1.7, 0.55, 3.6, color, { roughness: 0.45, metalness: 0.25 });
    body.position.y = 0.45;
    g.add(body);
    const cabin = meshBox(1.5, 0.45, 1.8, 0x1a2230, { roughness: 0.3, metalness: 0.2 });
    cabin.position.set(0, 0.9, -0.2);
    g.add(cabin);
    const headL = meshBox(0.2, 0.12, 0.08, 0xffe8a0, { emissive: 0xffcc66, emissiveIntensity: 0.8 });
    headL.position.set(-0.5, 0.45, -1.85);
    g.add(headL);
    const headR = headL.clone();
    headR.position.x = 0.5;
    g.add(headR);
    g.position.set(x, 0, z);
    if (speed < 0) g.rotation.y = Math.PI;
    this.group.add(g);
    return { mesh: g, speed, zLane: z, minX: -18, maxX: 18 };
  }

  _spawnWaiters() {
    const k = LAYOUT.kitchen;
    const spots = [
      { id: "toninho", x: 4.5, z: -1.5, rot: -0.4, zones: ["blue", "interior"] },
      { id: "fabin", x: -1.0, z: 0.5, rot: 0.2, zones: ["interior", "sidewalk"] },
      { id: "oliveira", x: -8.5, z: -9.0, rot: 0.3, zones: ["interior", "green"] },
      { id: "val", x: -6.0, z: -2.0, rot: 0.1, zones: ["green", "interior"] },
      { id: "ney", x: -0.5, z: -10.5, rot: -0.2, zones: ["interior"] },
      {
        id: "carlinhos",
        x: (k.x0 + k.x1) / 2,
        z: (k.z0 + k.z1) / 2,
        rot: Math.PI,
        zones: ["kitchen"],
      },
    ];

    for (const s of spots) {
      const def = WAITERS.find((w) => w.id === s.id);
      const mesh = buildWaiterMesh(def);
      const fy = floorHeightAt(s.x, s.z);
      mesh.position.set(s.x, fy, s.z);
      mesh.rotation.y = s.rot;
      this.group.add(mesh);
      const interactable = {
        kind: "waiter",
        id: def.id,
        label: `Falar com ${def.name}`,
        position: new THREE.Vector3(s.x, fy + 1.4, s.z),
        radius: 1.7,
        def,
      };
      this.waiters.push({ def, mesh, position: mesh.position });
      this.interactables.push(interactable);
      this.npcAgents.push(
        new NpcAgent({
          mesh,
          kind: "waiter",
          zones: s.zones,
          speed: s.id === "carlinhos" ? 1.05 : 1.35,
          interactable,
        })
      );
    }
  }

  /** Clientes novos a cada carregamento — aparência e quantidade aleatórias. */
  _spawnCustomers() {
    const usedNames = new Set();
    const mobile = typeof window !== "undefined" && (
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(hover: none)").matches
    );
    const count = mobile ? 7 + Math.floor(Math.random() * 3) : 10 + Math.floor(Math.random() * 6);
    const spawnPads = [
      [-10, 3.5], [-4, 4], [0, 3.8], [5, 4],
      [-10, -2], [-7, -3], [-1, -2], [0.5, -4],
      [-10, -9], [-6, -10], [-2, -11], [-8, -13],
      [6, -2], [8, -3],
    ];

    for (let i = spawnPads.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spawnPads[i], spawnPads[j]] = [spawnPads[j], spawnPads[i]];
    }

    for (let i = 0; i < count; i++) {
      const def = randomCustomerDef(usedNames);
      const mesh = buildCustomerMesh(def);
      const [sx, sz] = spawnPads[i % spawnPads.length];
      const x = sx + (Math.random() - 0.5) * 0.6;
      const z = sz + (Math.random() - 0.5) * 0.6;
      const fy = floorHeightAt(x, z);
      mesh.position.set(x, fy, z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(mesh);
      this.customers.push({ def, mesh });
      const roll = Math.random();
      const zones =
        roll < 0.25
          ? ["green", "interior"]
          : roll < 0.5
            ? ["interior", "sidewalk"]
            : roll < 0.7
              ? ["interior"]
              : ["sidewalk", "interior", "blue"];
      this.npcAgents.push(
        new NpcAgent({
          mesh,
          kind: "customer",
          zones,
          speed: 0.95 + Math.random() * 0.4,
        })
      );
    }
  }

  claimSeat(agent) {
    const free = this.seats.filter((s) => !s.claimedBy);
    if (!free.length) return null;
    const seat = free[Math.floor(Math.random() * free.length)];
    seat.claimedBy = agent;
    return seat;
  }

  releaseSeat(seat, agent) {
    if (seat && seat.claimedBy === agent) seat.claimedBy = null;
  }

  /** Envia um garçom até a mesa do jogador (comanda). */
  dispatchServe(job) {
    let waiters = this.npcAgents.filter(
      (a) => a.kind === "waiter" && a.state !== "serve" && a.interactable?.id !== "carlinhos"
    );
    if (!waiters.length) return false;
    const preferId = job.preferId;
    const moodFn = job.moodFn;
    if (preferId) {
      const preferred = waiters.filter((a) => a.interactable?.id === preferId);
      if (preferred.length) waiters = preferred;
    } else if (typeof moodFn === "function") {
      waiters.sort((a, b) => moodFn(b.interactable?.id) - moodFn(a.interactable?.id));
      const top = moodFn(waiters[0]?.interactable?.id) || 0;
      if (top >= 2) waiters = waiters.slice(0, Math.max(1, Math.ceil(waiters.length / 2)));
    }
    const w = waiters[Math.floor(Math.random() * waiters.length)];
    if (!w._trayBuilder && this._trayBuilder) w._trayBuilder = this._trayBuilder;
    return w.assignServe(job);
  }

  cheerCrowd(intensity = 0.55) {
    const chance = Math.max(0.15, Math.min(1, intensity));
    for (const a of this.npcAgents) {
      if (Math.random() < chance) a.cheer();
    }
  }

  bindTvGoals(cb) {
    this.onGoal = cb;
    for (const tv of this.tvs) tv.setOnGoal?.(cb);
  }

  bindTvEvents(cb) {
    this.onTvEvent = cb;
    for (const tv of this.tvs) {
      tv.setOnEvent?.(cb);
      if (!tv.setOnEvent) tv.setOnGoal?.((team) => cb?.({ type: "goal", team }));
    }
  }

  _spawnRegular() {
    const def = REGULAR;
    const mesh = buildCustomerMesh(def);
    const x = -9.2;
    const z = 3.2;
    const fy = floorHeightAt(x, z);
    mesh.position.set(x, fy, z);
    mesh.rotation.y = 0.6;
    this.group.add(mesh);
    const interactable = {
      kind: "regular",
      id: def.id,
      label: `Falar com ${def.name}`,
      position: new THREE.Vector3(x, fy + 1.4, z),
      radius: 1.7,
      def,
    };
    this.interactables.push(interactable);
    this.npcAgents.push(
      new NpcAgent({
        mesh,
        kind: "customer",
        zones: ["sidewalk", "green"],
        speed: 0.7,
        interactable,
      })
    );
  }

  _buildRain(count = 400) {
    const geo = new THREE.BoxGeometry(0.02, 0.18, 0.02);
    const matRain = new THREE.MeshBasicMaterial({
      color: 0xaaccff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geo, matRain, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.visible = false;
    const dummy = new THREE.Object3D();
    const drops = [];
    for (let i = 0; i < count; i++) {
      const drop = {
        x: -14 + Math.random() * 28,
        y: 2 + Math.random() * 8,
        z: 2 + Math.random() * 12,
        vy: 6 + Math.random() * 5,
      };
      drops.push(drop);
      dummy.position.set(drop.x, drop.y, drop.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
    this._rain = { mesh, drops, dummy, on: false, wanted: false };
  }

  setQuality(level) {
    this._quality = level === "low" ? "low" : "high";
    if (this._rain) {
      this._rain.mesh.material.opacity = this._quality === "low" ? 0.22 : 0.35;
    }
    // Esconde clientes extras no modo low
    let i = 0;
    for (const a of this.npcAgents) {
      if (a.kind !== "customer") continue;
      i += 1;
      if (this._quality === "low" && i > 8) {
        a.mesh.visible = false;
        a._culledByQuality = true;
      } else if (a._culledByQuality) {
        a.mesh.visible = true;
        a._culledByQuality = false;
      }
    }
  }

  setGoalBoost(mult) {
    this._goalBoost = Math.max(0.5, Math.min(3, mult));
    for (const tv of this.tvs) tv.setGoalBoost?.(this._goalBoost);
  }

  pulseAwning(duration = 1.8) {
    this._rainPulseUntil = performance.now() + duration * 1000;
  }

  /** Chuva: liga/desliga conforme fase da noite + semente da sessão. */
  _updateRainState() {
    if (!this._rain) return;
    // Sessões chuvosas ~55%; começa perto do meio da noite
    const rainyNight = this._rainSeed > 0.45;
    const startAt = 0.22 + this._rainSeed * 0.25;
    const endAt = 0.92;
    const want = rainyNight && this.nightPhase >= startAt && this.nightPhase < endAt;
    if (want !== this._rain.wanted) {
      this._rain.wanted = want;
      this._rain.on = want;
      this._rain.mesh.visible = want;
      this.onRainChange?.(want);
    }
  }

  updateNpcs(dt, playerPos = null) {
    for (const agent of this.npcAgents) {
      if (agent._hiddenAsPlayer) continue;
      agent.update(dt, this.npcAgents, this);
      // LOD simples: esconde clientes longe (respeita cull de qualidade)
      if (playerPos && agent.kind === "customer" && agent.mesh && !agent._culledByQuality) {
        const d = playerPos.distanceTo(agent.mesh.position);
        agent.mesh.visible = d < 22;
      }
    }
  }

  updateTvs(now) {
    if (!this._tvAcc) this._tvAcc = 0;
    this._tvAcc += 1;
    const every = this._quality === "low" ? 6 : 3;
    if (this._tvAcc % every !== 0) return;
    for (const tv of this.tvs) tv.draw(now);
  }

  updateNight(dt, now, exposureBase = 1.35) {
    this._sessionT += dt;
    this.nightPhase = Math.min(1, this._sessionT / 420);
    this._updateRainState();

    for (const car of this.cars) {
      car.mesh.position.x += car.speed * dt;
      if (car.speed > 0 && car.mesh.position.x > car.maxX) car.mesh.position.x = car.minX;
      if (car.speed < 0 && car.mesh.position.x < car.minX) car.mesh.position.x = car.maxX;
      car.mesh.position.z = car.zLane + Math.sin(now * 0.001 + car.mesh.position.x) * 0.02;
    }
    const lastCall = this.nightPhase > 0.85 ? 0.55 : 1;
    for (const b of this._blinkLights) {
      const flick = 0.85 + Math.sin(now * 0.004 + b.phase) * 0.08 + Math.sin(now * 0.013 + b.phase) * 0.05;
      b.light.intensity = b.base * flick * (1 - this.nightPhase * 0.15) * lastCall;
    }
    const pulsing = now < this._rainPulseUntil;
    for (const l of this._awningLights) {
      if (!l.userData._base) l.userData._base = l.intensity;
      const base = l.userData._base * (0.92 + Math.sin(now * 0.003 + l.position.x) * 0.06);
      l.intensity = pulsing ? base * (1.35 + Math.sin(now * 0.02) * 0.25) : base * lastCall;
    }
    const cycle = this.nightPhase;
    if (this.scene.fog) {
      this.scene.fog.near = 22 + cycle * 10;
      this.scene.fog.far = 58 + cycle * 18;
      this.scene.fog.color?.setRGB?.(0.07 + cycle * 0.02, 0.09, 0.14 - cycle * 0.03);
    }
    if (this.scene.background?.isColor) {
      this.scene.background.setRGB(0.07 - cycle * 0.02, 0.09 - cycle * 0.02, 0.16 - cycle * 0.04);
    }
    for (const p of this._smoke) {
      const s = p.userData.smoke;
      if (!s) continue;
      p.position.y += s.speed * dt;
      p.position.x = s.ox + Math.sin(now * 0.002 + s.phase) * 0.12;
      p.position.z = s.oz + Math.cos(now * 0.0015 + s.phase) * 0.08;
      const mat = p.material;
      if (mat) mat.opacity = 0.08 + Math.max(0, 1.8 - p.position.y) * 0.12;
      if (p.position.y > 2.4) {
        p.position.y = 1.12;
        mat.opacity = 0.25;
      }
    }
    // Fim de noite: clientes vão embora aos poucos
    if (this.nightPhase > 0.72) {
      for (const a of this.npcAgents) {
        if (a.kind !== "customer" || a.state === "leave") continue;
        if (Math.random() < 0.002) {
          a.state = "walk";
          a.target = { x: -2 + Math.random() * 4, z: 12 };
          a.timer = 20;
          a.say?.("Já vou…", 1.5);
        }
      }
    }
    if (this._rain?.on) {
      const { mesh, drops, dummy } = this._rain;
      const step = this._quality === "low" ? 2 : 1;
      for (let i = 0; i < drops.length; i += step) {
        const d = drops[i];
        d.y -= d.vy * dt;
        if (d.y < 0.05) {
          d.y = 4 + Math.random() * 6;
          d.x = -14 + Math.random() * 28;
          d.z = 2 + Math.random() * 12;
        }
        dummy.position.set(d.x, d.y, d.z);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.material.opacity = (this._quality === "low" ? 0.18 : 0.22) + Math.sin(now * 0.001) * 0.08;
    }
    if (this._jukeboxLight) {
      this._jukeboxLight.material.emissiveIntensity = 0.6 + Math.sin(now * 0.008) * 0.4;
    }
    if (this._fan) {
      this._fan.rotation.z = now * 0.004;
    }
    return exposureBase * (1 - this.nightPhase * 0.18) * (this.nightPhase > 0.85 ? 0.88 : 1);
  }

  resolveCollision(pos, radius) {
    for (const c of this.colliders) {
      const nearestX = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const nearestZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - nearestX;
      const dz = pos.z - nearestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq) || 0.0001;
        const push = radius - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      }
    }
    pos.x = Math.max(-13.2, Math.min(12.2, pos.x));
    pos.z = Math.max(-15.1, Math.min(16, pos.z));
  }

  nearestInteractable(pos) {
    let best = null;
    let bestD = Infinity;
    const all = [...this.interactables, ...this.seats];
    for (const it of all) {
      if (it.kind === "seat" && it.claimedBy && it.claimedBy !== "player") continue;
      const d = pos.distanceTo(it.position);
      if (d < it.radius && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }
}
