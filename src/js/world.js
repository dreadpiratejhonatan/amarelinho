import * as THREE from "three";
import { CONFIG } from "./config.js";
import { WAITERS, buildWaiterMesh, randomCustomerDef, buildCustomerMesh } from "./npcs.js";
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
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this._awningLights = [];
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
    this._spawnCustomers();
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
    const cloth = meshBox(28, 0.1, 5.8, 0xe8b000, {
      roughness: 0.9,
      emissive: 0x886600,
      emissiveIntensity: 0.22,
    });
    cloth.position.set(0, 3.25, 2.4);
    cloth.rotation.x = -0.05;
    this.group.add(cloth);

    for (const x of [-12, -6, 0, 6, 12]) {
      const arm = meshBox(0.07, 0.07, 5.2, 0x333333, { metalness: 0.45, roughness: 0.4 });
      arm.position.set(x, 3.12, 2.2);
      this.group.add(arm);
      const pole = meshCyl(0.045, 0.045, 3.1, 0x2a2a2a, { metalness: 0.5, roughness: 0.4 });
      pole.position.set(x, 1.55, 4.8);
      this.group.add(pole);
    }

    const val = meshBox(28, 0.4, 0.1, 0xffd400, {
      roughness: 0.8,
      emissive: 0xaa8800,
      emissiveIntensity: 0.2,
    });
    val.position.set(0, 2.95, 5.2);
    this.group.add(val);
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
    });
    this.seats.push({
      kind: "seat",
      label: "Sentar",
      position: new THREE.Vector3(x - 0.65, floorY + 0.55, z),
      lookAt: new THREE.Vector3(x, floorY + 1.3, z),
      radius: 1.05,
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
    this._makeCar(-6.5, 9.5, 0x9aa0a8);
    this._makeCar(0.5, 9.8, 0x1a1a1e);
    this._makeCar(8.0, 9.4, 0xb0b4b8);

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

  _makeCar(x, z, color) {
    const body = meshBox(1.7, 0.55, 3.6, color, { roughness: 0.45, metalness: 0.25 });
    body.position.set(x, 0.45, z);
    this.group.add(body);
    const cabin = meshBox(1.5, 0.45, 1.8, 0x1a2230, { roughness: 0.3, metalness: 0.2 });
    cabin.position.set(x, 0.9, z - 0.2);
    this.group.add(cabin);
    addWallCollider(this.colliders, x, z, 1.8, 3.7);
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
    const count = 10 + Math.floor(Math.random() * 6); // 10–15
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

  updateNpcs(dt) {
    for (const agent of this.npcAgents) {
      agent.update(dt, this.npcAgents, this);
    }
  }

  updateTvs(now) {
    // Atualiza ~20 fps pra não pesar
    if (!this._tvAcc) this._tvAcc = 0;
    this._tvAcc += 1;
    if (this._tvAcc % 3 !== 0) return;
    for (const tv of this.tvs) tv.draw(now);
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
      const d = pos.distanceTo(it.position);
      if (d < it.radius && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }
}
