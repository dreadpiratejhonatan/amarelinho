import * as THREE from "three";
import { CONFIG } from "./config.js";
import { WAITERS, buildWaiterMesh, randomCustomerDef, buildCustomerMesh } from "./npcs.js";
import { NpcAgent } from "./npcAi.js";
import { createFootballTv } from "./footballTv.js";

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
    this._buildingShell();
    this._awning();
    this._interiorSalon();
    this._counterKitchen();
    this._bathroom();
    this._furniture();
    this._footballTvs();
    this._streetProps();
    this._spawnWaiters();
    this._spawnCustomers();
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

    // Wide sidewalk in front of the bar
    const sidewalk = meshBox(28, 0.12, 7.5, 0x9a9a9c, { roughness: 0.9 });
    sidewalk.position.set(0, 0.04, 3.6);
    this.group.add(sidewalk);

    const curb = meshBox(28, 0.2, 0.3, 0x6a6a6c);
    curb.position.set(0, 0.1, 7.2);
    this.group.add(curb);

    // Crosswalk paint
    for (let i = 0; i < 6; i++) {
      const stripe = meshBox(0.7, 0.02, 2.8, 0xe8e8e8, { roughness: 0.85 });
      stripe.position.set(-1.8 + i * 0.95, 0.02, 8.8);
      this.group.add(stripe);
    }

    // Árvores voxel (folhas furadas estilo Minecraft)
    const treeL = buildMinecraftTree(-7.2, 4.5, "flower", 1.15);
    this.group.add(treeL);
    addWallCollider(this.colliders, -7.2, 4.5, 0.7, 0.7);

    const treeR = buildMinecraftTree(7.5, 5.0, "green", 1.0);
    this.group.add(treeR);
    addWallCollider(this.colliders, 7.5, 5.0, 0.55, 0.55);

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
    const whiteZ = -17.5;
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
    const glassX = 10;
    const glassZ = -18;
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

  _buildingShell() {
    const C = CONFIG.colors;
    const Y = 0xffd400;
    const W = 18;
    // Salão profundo: fachada ~z=1 → fundo ~z=-14
    const backZ = -14.0;
    const sideZ = -6.4;
    const depth = 15.4;

    // Back wall
    const back = meshBox(W, 3.8, 0.28, Y, { roughness: 0.55 });
    back.position.set(0, 1.9, backZ);
    this.group.add(back);
    addWallCollider(this.colliders, 0, backZ, W, 0.45);

    const brickBack = meshBox(W, 1.1, 0.32, C.brick, { roughness: 0.88 });
    brickBack.position.set(0, 0.55, backZ + 0.05);
    this.group.add(brickBack);

    // Side walls
    const left = meshBox(0.28, 3.8, depth, Y, { roughness: 0.55 });
    left.position.set(-W / 2, 1.9, sideZ);
    this.group.add(left);
    addWallCollider(this.colliders, -W / 2, sideZ, 0.45, depth);
    const leftBrick = meshBox(0.32, 1.1, depth, C.brick, { roughness: 0.88 });
    leftBrick.position.set(-W / 2, 0.55, sideZ);
    this.group.add(leftBrick);

    const whiteWing = meshBox(0.35, 3.8, 4.0, 0xf0f0f0, { roughness: 0.7 });
    whiteWing.position.set(-W / 2 - 0.5, 1.9, 0.6);
    this.group.add(whiteWing);

    const right = meshBox(0.28, 3.8, depth, Y, { roughness: 0.55 });
    right.position.set(W / 2, 1.9, sideZ);
    this.group.add(right);
    addWallCollider(this.colliders, W / 2, sideZ, 0.45, depth);
    const rightBrick = meshBox(0.32, 1.1, depth, C.brick, { roughness: 0.88 });
    rightBrick.position.set(W / 2, 0.55, sideZ);
    this.group.add(rightBrick);

    const blue = meshBox(1.4, 4.0, 5.0, 0x1e5a9a, { roughness: 0.7 });
    blue.position.set(W / 2 + 1.2, 2.0, -0.8);
    this.group.add(blue);

    // Front pillars (open facade)
    const pillarXs = [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5];
    for (const x of pillarXs) {
      const brick = meshBox(0.55, 1.15, 0.55, C.brick, { roughness: 0.88 });
      brick.position.set(x, 0.58, 1.0);
      this.group.add(brick);
      const top = meshBox(0.5, 2.5, 0.5, Y);
      top.position.set(x, 2.35, 1.0);
      this.group.add(top);
      addWallCollider(this.colliders, x, 1.0, 0.6, 0.6);

      if (x === 1.5) {
        const ext = meshBox(0.12, 0.36, 0.1, 0xcc2020);
        ext.position.set(x + 0.32, 1.45, 1.0);
        this.group.add(ext);
      }
    }

    // Floor + ceiling (salão inteiro)
    const floor = meshBox(W - 0.4, 0.08, depth - 0.5, 0xd0c0a0, { roughness: 0.7 });
    floor.position.set(0, 0.04, sideZ);
    this.group.add(floor);

    const ceil = meshBox(W, 0.14, depth + 0.4, 0xfff8e8, {
      emissive: 0xffe08a,
      emissiveIntensity: 0.35,
      roughness: 0.55,
    });
    ceil.position.set(0, 3.65, sideZ);
    this.group.add(ceil);

    for (const z of [-12.5, -10.5, -8.5, -6.5, -4.5, -2.5, -0.6, 0.8]) {
      const beam = meshBox(W - 0.4, 0.08, 0.12, 0x1a1a1a);
      beam.position.set(0, 3.55, z);
      this.group.add(beam);
    }

    // Parapeito + fachada preta
    const parapet = meshBox(W + 0.4, 0.55, 0.55, Y, { roughness: 0.55 });
    parapet.position.set(0, 3.95, 1.15);
    this.group.add(parapet);

    const blackBoard = meshBox(W + 0.6, 1.35, 0.22, 0x0a0a0a, {
      roughness: 0.65,
      metalness: 0.05,
    });
    blackBoard.position.set(0, 4.75, 1.2);
    this.group.add(blackBoard);

    const signTex = makeLabelTexture("AMARELINHO DAS BATIDAS", {
      w: 1400,
      h: 220,
      color: "#ffffff",
      bg: "#0a0a0a",
      font: "bold 92px Bebas Neue, Arial Black, sans-serif",
    });
    const signPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 0.2, 1.15),
      new THREE.MeshBasicMaterial({ map: signTex })
    );
    signPlane.position.set(0, 4.75, 1.34);
    this.group.add(signPlane);

    const roof = meshBox(W + 1.2, 0.18, 1.8, 0x6b2e1f, { roughness: 0.85 });
    roof.position.set(0, 5.55, 0.4);
    roof.rotation.x = -0.18;
    this.group.add(roof);
    for (let i = 0; i < 8; i++) {
      const ridge = meshBox(W + 1.0, 0.04, 0.12, 0x5a2818);
      ridge.position.set(0, 5.48 + i * 0.02, 0.9 - i * 0.18);
      ridge.rotation.x = -0.18;
      this.group.add(ridge);
    }

    const signLight = new THREE.PointLight(0xffffff, 1.8, 12, 1.5);
    signLight.position.set(0, 5.2, 3.2);
    this.scene.add(signLight);
  }

  _awning() {
    const cloth = meshBox(18.5, 0.1, 5.8, 0xe8b000, {
      roughness: 0.9,
      emissive: 0x886600,
      emissiveIntensity: 0.22,
    });
    cloth.position.set(0, 3.25, 2.4);
    cloth.rotation.x = -0.05;
    this.group.add(cloth);

    for (const x of [-8, -4, 0, 4, 8]) {
      const arm = meshBox(0.07, 0.07, 5.2, 0x333333, { metalness: 0.45, roughness: 0.4 });
      arm.position.set(x, 3.12, 2.2);
      this.group.add(arm);
      const pole = meshCyl(0.045, 0.045, 3.1, 0x2a2a2a, { metalness: 0.5, roughness: 0.4 });
      pole.position.set(x, 1.55, 4.8);
      this.group.add(pole);
    }

    const val = meshBox(18.5, 0.4, 0.1, 0xffd400, {
      roughness: 0.8,
      emissive: 0xaa8800,
      emissiveIntensity: 0.2,
    });
    val.position.set(0, 2.95, 5.2);
    this.group.add(val);

    const barrel = meshCyl(0.32, 0.32, 0.85, 0xffd400);
    barrel.position.set(6.2, 0.45, 5.5);
    this.group.add(barrel);
    for (let i = 0; i < 4; i++) {
      const stripe = meshCyl(0.325, 0.325, 0.1, 0xf8f8f8);
      stripe.position.set(6.2, 0.2 + i * 0.22, 5.5);
      this.group.add(stripe);
    }
  }

  _interiorSalon() {
    const Y = 0xffd400;

    // Pilares internos (espaçados no salão longo)
    for (const [x, z] of [
      [-4.5, -2.4],
      [2.2, -2.4],
      [-4.5, -6.5],
      [2.2, -6.5],
      [-4.5, -10.5],
      [1.5, -10.5],
    ]) {
      const p = meshBox(0.5, 3.4, 0.5, Y);
      p.position.set(x, 1.7, z);
      this.group.add(p);
      addWallCollider(this.colliders, x, z, 0.55, 0.55);
    }

    // Meia-parede / divisória salão
    for (const [x, z, w, d] of [
      [-2.2, -3.0, 3.2, 0.2],
      [3.2, -1.2, 0.2, 2.8],
    ]) {
      const wall = meshBox(w, 1.05, d, Y);
      wall.position.set(x, 0.55, z);
      this.group.add(wall);
      const ledge = meshBox(w + 0.08, 0.06, d + 0.08, 0x3a2818);
      ledge.position.set(x, 1.1, z);
      this.group.add(ledge);
      addWallCollider(this.colliders, x, z, Math.max(w, 0.35), Math.max(d, 0.35));
    }

    const flagMat = new THREE.MeshStandardMaterial({
      map: makeFlagTexture(),
      roughness: 0.7,
      metalness: 0.05,
    });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), flagMat);
    flag.position.set(-1.5, 2.55, -13.85);
    this.group.add(flag);

    const fan = meshCyl(0.32, 0.32, 0.08, 0x1a1a1a);
    fan.rotation.x = Math.PI / 2;
    fan.position.set(3.0, 2.85, -13.85);
    this.group.add(fan);

    const clock = meshCyl(0.18, 0.18, 0.05, 0xf0f0f0);
    clock.rotation.x = Math.PI / 2;
    clock.position.set(6.5, 3.0, -13.85);
    this.group.add(clock);

    const saidaTex = makeLabelTexture("SAÍDA", {
      w: 256,
      h: 64,
      color: "#ffffff",
      bg: "#1a7a3a",
      font: "bold 40px DM Sans, Arial, sans-serif",
    });
    const saida = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.2),
      new THREE.MeshBasicMaterial({ map: saidaTex })
    );
    saida.position.set(8.5, 3.0, -3.2);
    saida.rotation.y = -Math.PI / 2;
    this.group.add(saida);

    // Luminárias pelo salão fundo
    for (const [x, z] of [
      [-4, -2.5],
      [0, -2.0],
      [4, -2.2],
      [-2, -5.5],
      [2, -5.8],
      [-3, -9.0],
      [1, -9.2],
      [4, -8.5],
      [-1, -12.0],
    ]) {
      for (let i = 0; i < 3; i++) {
        const shade = meshBox(0.24, 0.1, 0.24, 0xfff4d0, {
          emissive: 0xffe8a0,
          emissiveIntensity: 0.85,
        });
        shade.position.set(x + i * 0.3 - 0.3, 3.45, z);
        this.group.add(shade);
      }
    }
  }

  _counterKitchen() {
    const C = CONFIG.colors;

    // Balcão (frente-direita — pedido do jogador)
    const counter = meshBox(3.4, 1.05, 1.0, C.wood);
    counter.position.set(5.2, 0.55, -2.0);
    this.group.add(counter);
    addWallCollider(this.colliders, 5.2, -2.0, 3.5, 1.1);

    const top = meshBox(3.45, 0.08, 1.05, 0x2a2a2e, { roughness: 0.35, metalness: 0.15 });
    top.position.set(5.2, 1.12, -2.0);
    this.group.add(top);

    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.48, 0),
      mat(0xffd84a, { emissive: 0xaa8800, emissiveIntensity: 0.35, roughness: 0.4 })
    );
    diamond.rotation.z = Math.PI / 4;
    diamond.position.set(5.2, 0.82, -1.48);
    diamond.scale.set(1, 0.14, 1);
    this.group.add(diamond);

    const freezer = meshBox(0.85, 0.95, 0.7, 0xc42020, { roughness: 0.55 });
    freezer.position.set(2.8, 0.5, -3.4);
    this.group.add(freezer);
    addWallCollider(this.colliders, 2.8, -3.4, 0.95, 0.8);
    const freezerLid = meshBox(0.88, 0.06, 0.72, 0xe8e8e8);
    freezerLid.position.set(2.8, 1.0, -3.4);
    this.group.add(freezerLid);

    const warmer = meshBox(0.9, 0.55, 0.55, 0xddeeff, { roughness: 0.25, metalness: 0.2 });
    warmer.position.set(4.2, 1.45, -2.0);
    this.group.add(warmer);

    // ——— Cozinha fundo-direita ———
    // Divisória com vão de entrada (~z=-8.5)
    const kitWallBack = meshBox(0.2, 2.6, 4.2, 0xe8d8a8);
    kitWallBack.position.set(3.6, 1.3, -11.8);
    this.group.add(kitWallBack);
    addWallCollider(this.colliders, 3.6, -11.8, 0.35, 4.3);

    const kitWallFront = meshBox(0.2, 2.6, 1.4, 0xe8d8a8);
    kitWallFront.position.set(3.6, 1.3, -7.6);
    this.group.add(kitWallFront);
    addWallCollider(this.colliders, 3.6, -7.6, 0.35, 1.5);
    const bench = meshBox(4.2, 0.9, 0.85, 0x4a4a50, { metalness: 0.45, roughness: 0.4 });
    bench.position.set(6.4, 0.5, -11.5);
    this.group.add(bench);
    addWallCollider(this.colliders, 6.4, -11.5, 4.3, 0.95);

    const chapa = meshBox(1.6, 0.08, 0.7, 0x2a2a2e, { metalness: 0.7, roughness: 0.35 });
    chapa.position.set(5.2, 0.98, -11.5);
    this.group.add(chapa);
    const chapaGlow = meshBox(1.4, 0.02, 0.55, 0xff6622, {
      emissive: 0xff4400,
      emissiveIntensity: 0.75,
    });
    chapaGlow.position.set(5.2, 1.02, -11.5);
    this.group.add(chapaGlow);
    // Espátula / óleo
    const spatula = meshBox(0.08, 0.02, 0.35, 0xc0c0c0, { metalness: 0.8, roughness: 0.3 });
    spatula.position.set(5.9, 1.05, -11.35);
    this.group.add(spatula);

    // Fogão
    const stove = meshBox(1.1, 0.95, 0.75, 0x1a1a1e, { metalness: 0.4, roughness: 0.45 });
    stove.position.set(7.4, 0.5, -11.5);
    this.group.add(stove);
    for (const [ox, oz] of [
      [-0.22, -0.15],
      [0.22, -0.15],
      [-0.22, 0.15],
      [0.22, 0.15],
    ]) {
      const burner = meshCyl(0.12, 0.12, 0.04, 0x333338, { metalness: 0.5, roughness: 0.4 });
      burner.position.set(7.4 + ox, 1.0, -11.5 + oz);
      this.group.add(burner);
      const flame = meshCyl(0.06, 0.02, 0.08, 0xff6622, {
        emissive: 0xff4400,
        emissiveIntensity: 1.1,
      });
      flame.position.set(7.4 + ox, 1.08, -11.5 + oz);
      this.group.add(flame);
    }
    const knobs = meshBox(0.9, 0.12, 0.08, 0x888890);
    knobs.position.set(7.4, 0.55, -11.1);
    this.group.add(knobs);

    // Coifa
    const hood = meshBox(2.4, 0.12, 1.1, 0xc0c4c8, { metalness: 0.7, roughness: 0.35 });
    hood.position.set(6.4, 2.75, -11.5);
    this.group.add(hood);
    const hoodCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 0.5, 4),
      mat(0xb8bcc0, { metalness: 0.7, roughness: 0.35 })
    );
    hoodCone.position.set(6.4, 3.05, -11.5);
    hoodCone.rotation.y = Math.PI / 4;
    this.group.add(hoodCone);

    // Forno / brasa
    const oven = meshBox(0.9, 0.85, 0.5, 0x1a1a1a);
    oven.position.set(7.5, 0.7, -13.0);
    this.group.add(oven);
    addWallCollider(this.colliders, 7.5, -13.0, 1.0, 0.6);
    const glow = meshBox(0.7, 0.55, 0.05, 0xff6622, {
      emissive: 0xff4400,
      emissiveIntensity: 0.9,
    });
    glow.position.set(7.5, 0.7, -12.72);
    this.group.add(glow);

    // Prateleiras + bebidas no fundo da cozinha
    const shelfBack = meshBox(3.6, 2.3, 0.22, C.woodLight);
    shelfBack.position.set(6.2, 2.25, -13.7);
    this.group.add(shelfBack);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 12; i++) {
        const bottle = meshCyl(
          0.045,
          0.055,
          0.26 + (i % 3) * 0.05,
          [0x224422, 0x553311, 0x222266, 0xccaa66, 0xaaaaee][i % 5]
        );
        bottle.position.set(4.6 + i * 0.24, 1.35 + row * 0.55, -13.55);
        this.group.add(bottle);
      }
    }
    const pineapple = meshCyl(0.12, 0.14, 0.28, 0xd4a017);
    pineapple.position.set(5.0, 3.05, -13.5);
    this.group.add(pineapple);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 8), mat(0x2d6a28));
    crown.position.set(5.0, 3.3, -13.5);
    this.group.add(crown);

    for (let i = 0; i < 10; i++) {
      const g = meshCyl(0.045, 0.035, 0.11, 0xddeeff, { roughness: 0.2, metalness: 0.1 });
      g.position.set(5.5 + i * 0.22, 3.0, -13.5);
      this.group.add(g);
    }

    // Placa COZINHA
    const kitTex = makeLabelTexture("COZINHA", {
      w: 320,
      h: 80,
      color: "#1a1408",
      bg: "#ffd84a",
      font: "bold 42px Bebas Neue, Arial Black, sans-serif",
    });
    const kitSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.28),
      new THREE.MeshBasicMaterial({ map: kitTex })
    );
    kitSign.position.set(3.72, 2.6, -8.2);
    kitSign.rotation.y = Math.PI / 2;
    this.group.add(kitSign);

    this.interactables.push({
      kind: "counter",
      label: "Pedir no balcão",
      position: new THREE.Vector3(4.6, 1.1, -1.1),
      radius: 1.8,
    });
  }

  _bathroom() {
    // Banheiro canto esquerdo fundo
    const wallColor = 0xe8e0d0;
    // Parede frontal do banheiro (com vão de porta em x≈-6.2)
    const frontL = meshBox(2.2, 2.8, 0.18, wallColor);
    frontL.position.set(-7.6, 1.4, -10.2);
    this.group.add(frontL);
    addWallCollider(this.colliders, -7.6, -10.2, 2.3, 0.3);
    const frontR = meshBox(1.4, 2.8, 0.18, wallColor);
    frontR.position.set(-4.7, 1.4, -10.2);
    this.group.add(frontR);
    addWallCollider(this.colliders, -4.7, -10.2, 1.5, 0.3);

    const side = meshBox(0.18, 2.8, 3.6, wallColor);
    side.position.set(-4.0, 1.4, -12.0);
    this.group.add(side);
    addWallCollider(this.colliders, -4.0, -12.0, 0.3, 3.7);

    // Piso tile
    const tile = meshBox(4.6, 0.06, 3.5, 0xc8d0d8, { roughness: 0.45 });
    tile.position.set(-6.5, 0.06, -12.1);
    this.group.add(tile);

    // Porta (aberta / batente)
    const door = meshBox(0.08, 2.1, 0.85, 0x5c3a22);
    door.position.set(-5.9, 1.1, -10.05);
    door.rotation.y = -0.55;
    this.group.add(door);

    // Vasos
    for (const x of [-7.6, -6.2]) {
      const bowl = meshCyl(0.22, 0.18, 0.35, 0xf0f0f0, { roughness: 0.35 });
      bowl.position.set(x, 0.35, -13.2);
      this.group.add(bowl);
      const tank = meshBox(0.35, 0.45, 0.18, 0xf0f0f0);
      tank.position.set(x, 0.85, -13.45);
      this.group.add(tank);
      addWallCollider(this.colliders, x, -13.3, 0.5, 0.55);
    }

    // Pia
    const sink = meshBox(0.9, 0.12, 0.45, 0xe8e8ec, { metalness: 0.3, roughness: 0.4 });
    sink.position.set(-7.5, 0.95, -11.0);
    this.group.add(sink);
    const sinkBase = meshBox(0.7, 0.85, 0.35, 0xd0d0d4);
    sinkBase.position.set(-7.5, 0.45, -11.0);
    this.group.add(sinkBase);
    const mirror = meshBox(0.7, 0.55, 0.04, 0xa0c0e0, { metalness: 0.6, roughness: 0.2 });
    mirror.position.set(-7.5, 1.7, -10.35);
    this.group.add(mirror);
    addWallCollider(this.colliders, -7.5, -11.0, 1.0, 0.55);

    // Placa
    const bathTex = makeLabelTexture("BANHEIRO", {
      w: 360,
      h: 80,
      color: "#ffffff",
      bg: "#1a5a9a",
      font: "bold 40px Bebas Neue, Arial Black, sans-serif",
    });
    const bathSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.28),
      new THREE.MeshBasicMaterial({ map: bathTex })
    );
    bathSign.position.set(-5.9, 2.55, -10.08);
    this.group.add(bathSign);
  }

  _footballTvs() {
    const mounts = [
      { x: -5.5, y: 2.55, z: -13.85, rot: 0 },
      { x: 0.2, y: 2.55, z: -13.85, rot: 0 },
      { x: 4.2, y: 2.55, z: -13.85, rot: 0 },
      { x: -8.55, y: 2.4, z: -6.5, rot: Math.PI / 2 },
      { x: 8.55, y: 2.4, z: -4.5, rot: -Math.PI / 2 },
      { x: -2.5, y: 2.6, z: -7.8, rot: 0.15 },
    ];
    for (const m of mounts) {
      const tv = createFootballTv(1.4, 0.82);
      tv.frame.position.set(m.x, m.y, m.z);
      tv.frame.rotation.y = m.rot;
      this.group.add(tv.frame);
      this.tvs.push(tv);
      // Glow leve
      const glow = new THREE.PointLight(0x88aa66, 0.35, 5, 2);
      glow.position.set(m.x, m.y - 0.2, m.z + (Math.abs(m.rot) < 0.2 ? 0.4 : 0));
      this.scene.add(glow);
    }
  }

  _makeTable(x, z, rot = 0, dark = true) {
    const wood = dark ? 0x1a1410 : CONFIG.colors.woodLight;
    const g = new THREE.Group();
    const top = meshBox(1.1, 0.06, 0.55, wood);
    top.position.y = 0.72;
    g.add(top);
    const leg = meshCyl(0.04, 0.05, 0.72, wood);
    leg.position.y = 0.36;
    g.add(leg);
    g.position.set(x, 0, z);
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
      this._makeChair(cx, cz, cr + rot, dark);
      // Only two seats interactive per table to avoid clutter
    }

    // Two interactive seats
    this.seats.push({
      kind: "seat",
      label: "Sentar",
      position: new THREE.Vector3(x + 0.65, 0.55, z),
      lookAt: new THREE.Vector3(x, 1.3, z),
      radius: 1.05,
    });
    this.seats.push({
      kind: "seat",
      label: "Sentar",
      position: new THREE.Vector3(x - 0.65, 0.55, z),
      lookAt: new THREE.Vector3(x, 1.3, z),
      radius: 1.05,
    });

    // Condiments
    const ketchup = meshCyl(0.035, 0.04, 0.16, 0xcc2020);
    ketchup.position.set(x + 0.15, 0.85, z + 0.08);
    this.group.add(ketchup);
    const mustard = meshCyl(0.035, 0.04, 0.16, 0xe8b400);
    mustard.position.set(x + 0.25, 0.85, z + 0.08);
    this.group.add(mustard);
    const napkin = meshBox(0.12, 0.1, 0.08, 0x222222);
    napkin.position.set(x - 0.15, 0.8, z + 0.1);
    this.group.add(napkin);
  }

  _makeChair(x, z, rot, dark = true) {
    const wood = dark ? 0x1a1410 : CONFIG.colors.wood;
    const g = new THREE.Group();
    const seat = meshBox(0.38, 0.05, 0.38, wood);
    seat.position.y = 0.45;
    g.add(seat);
    const back = meshBox(0.38, 0.42, 0.05, wood);
    back.position.set(0, 0.7, -0.16);
    g.add(back);
    // Horizontal slats
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
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    this.group.add(g);
  }

  _furniture() {
    const spots = [
      // Calçada / frente
      [-5.5, 4.0, 0.1],
      [-3.2, 4.6, -0.05],
      [-0.8, 3.8, 0.12],
      [1.6, 4.4, 0],
      [4.0, 3.9, -0.1],
      [-4.5, 2.4, 0.05],
      [-1.8, 2.6, 0],
      [1.0, 2.5, 0.08],
      [3.5, 2.7, -0.05],
      // Salão médio
      [-3.0, -0.2, 0.05],
      [0.5, -0.5, 0],
      [-5.0, -1.8, 0.1],
      [-2.2, -4.2, 0.08],
      [0.8, -4.0, -0.05],
      [-5.2, -5.5, 0.1],
      [-1.0, -5.8, 0],
      [1.8, -5.2, 0.06],
      // Salão fundo (antes do banheiro/cozinha)
      [-2.5, -7.5, 0.05],
      [0.5, -7.8, -0.08],
      [-5.0, -8.2, 0.1],
      [-1.5, -9.5, 0],
      [1.2, -9.0, 0.07],
      [-2.8, -11.2, 0.05],
      [0.2, -11.5, -0.05],
    ];
    for (const [x, z, rot] of spots) {
      this._makeTable(x, z, rot, true);
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
    const spots = [
      { id: "toninho", x: 4.0, z: -0.2, rot: -0.5 },
      { id: "fabin", x: -1.2, z: 2.0, rot: 0.35 },
      { id: "oliveira", x: -5.5, z: 1.2, rot: 0.2 },
      { id: "val", x: 1.5, z: -2.6, rot: Math.PI * 0.12 },
      { id: "ney", x: -3.2, z: -1.8, rot: -0.2 },
      { id: "carlinhos", x: 6.5, z: 1.4, rot: -1.0 },
    ];

    for (const s of spots) {
      const def = WAITERS.find((w) => w.id === s.id);
      const mesh = buildWaiterMesh(def);
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = s.rot;
      this.group.add(mesh);
      const interactable = {
        kind: "waiter",
        id: def.id,
        label: `Falar com ${def.name}`,
        position: new THREE.Vector3(s.x, 1.4, s.z),
        radius: 1.7,
        def,
      };
      this.waiters.push({ def, mesh, position: mesh.position });
      this.interactables.push(interactable);
      this.npcAgents.push(
        new NpcAgent({
          mesh,
          kind: "waiter",
          zones: ["interior", "sidewalk"],
          speed: 1.4,
          interactable,
        })
      );
    }
  }

  /** Clientes novos a cada carregamento — aparência e quantidade aleatórias. */
  _spawnCustomers() {
    const usedNames = new Set();
    const count = 8 + Math.floor(Math.random() * 5); // 8–12
    const spawnPads = [
      ...[
        [-7, 3], [-4, 4], [-1, 5], [2, 3.5], [5, 4.5], [7, 3],
        [-5, 6], [0, 6.5], [4, 7], [-2, 2.2], [3, 2.5],
        [-3, -1], [1, -2], [4.5, 0.5], [-6, 1.5],
      ],
    ];

    // Embaralha pads
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
      mesh.position.set(x, 0, z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(mesh);
      this.customers.push({ def, mesh });
      const zones =
        Math.random() < 0.35
          ? ["interior", "sidewalk"]
          : Math.random() < 0.5
            ? ["sidewalk", "street"]
            : ["sidewalk", "interior", "street"];
      this.npcAgents.push(
        new NpcAgent({
          mesh,
          kind: "customer",
          zones,
          speed: 0.95 + Math.random() * 0.45,
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
    pos.x = Math.max(-12, Math.min(12, pos.x));
    pos.z = Math.max(-13.4, Math.min(16, pos.z));
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
