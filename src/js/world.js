import * as THREE from "three";
import { CONFIG } from "./config.js";
import { WAITERS, buildWaiterMesh } from "./npcs.js";

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
    this._furniture();
    this._streetProps();
    this._spawnWaiters();
  }

  _lights() {
    const hemi = new THREE.HemisphereLight(0x8899bb, 0x2a1808, 0.45);
    this.scene.add(hemi);

    const moon = new THREE.DirectionalLight(0xa8b8e0, 0.28);
    moon.position.set(-10, 16, -4);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -20;
    moon.shadow.camera.right = 20;
    moon.shadow.camera.top = 20;
    moon.shadow.camera.bottom = -20;
    this.scene.add(moon);

    // Warm glow under awning
    for (const [x, z] of [
      [-3.5, 1.4],
      [-1.2, 1.4],
      [1.2, 1.4],
      [3.5, 1.4],
    ]) {
      const l = new THREE.PointLight(0xffc14a, 1.35, 9, 1.8);
      l.position.set(x, 2.85, z);
      this.scene.add(l);
      this._awningLights.push(l);
    }

    // Cool-bright interior spill (night photo)
    const interior = new THREE.PointLight(0xfff2d0, 1.6, 14, 1.6);
    interior.position.set(0.5, 2.6, -1.2);
    this.scene.add(interior);

    const kitchen = new THREE.PointLight(0xffe8b0, 1.2, 8, 2);
    kitchen.position.set(3.4, 2.4, -2.0);
    this.scene.add(kitchen);

    // Facade spotlights spilling onto sidewalk
    for (const x of [-2.5, 2.5]) {
      const spot = new THREE.SpotLight(0xffffff, 1.1, 12, 0.55, 0.4, 1);
      spot.position.set(x, 3.4, 0.8);
      spot.target.position.set(x, 0, 2.5);
      this.scene.add(spot);
      this.scene.add(spot.target);
    }

    this.scene.background = new THREE.Color(CONFIG.colors.nightSky);
    this.scene.fog = new THREE.FogExp2(0x0a0e18, 0.028);
  }

  _street() {
    const street = meshBox(48, 0.08, 22, CONFIG.colors.asphalt, { roughness: 0.95 });
    street.position.set(0, -0.04, 9);
    this.group.add(street);

    const sidewalk = meshBox(18, 0.12, 8.2, 0x8e8e90, { roughness: 0.92 });
    sidewalk.position.set(0, 0.03, 1.4);
    this.group.add(sidewalk);

    const curb = meshBox(18, 0.2, 0.28, 0x6a6a6c);
    curb.position.set(0, 0.08, 5.4);
    this.group.add(curb);

    // Pink flowering tree (day photo)
    const trunk = meshCyl(0.2, 0.26, 3.4, 0x4a3020);
    trunk.position.set(-6.4, 1.7, 3.6);
    this.group.add(trunk);
    const green = new THREE.Mesh(new THREE.SphereGeometry(1.35, 12, 10), mat(0x2d5a28, { roughness: 0.85 }));
    green.position.set(-6.4, 3.4, 3.6);
    green.castShadow = true;
    this.group.add(green);
    const pink = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 12, 10),
      mat(0xe05090, { roughness: 0.8, emissive: 0x401020, emissiveIntensity: 0.15 })
    );
    pink.position.set(-5.5, 3.6, 4.2);
    pink.castShadow = true;
    this.group.add(pink);
    addWallCollider(this.colliders, -6.4, 3.6, 0.7, 0.7);

    // Second thinner tree
    const t2 = meshCyl(0.12, 0.16, 2.8, 0x3a2818);
    t2.position.set(5.8, 1.4, 3.8);
    this.group.add(t2);
    const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), mat(0x356030));
    c2.position.set(5.8, 3.0, 3.8);
    this.group.add(c2);
  }

  _buildingShell() {
    const C = CONFIG.colors;
    const Y = 0xffd400; // brighter canary yellow from photos

    // Back wall
    const back = meshBox(13, 3.6, 0.28, Y, { roughness: 0.62 });
    back.position.set(0, 1.8, -3.6);
    this.group.add(back);
    addWallCollider(this.colliders, 0, -3.6, 13, 0.45);

    // Continuous brick wainscot on back
    const brickBack = meshBox(13, 1.05, 0.32, C.brick, { roughness: 0.88 });
    brickBack.position.set(0, 0.52, -3.55);
    this.group.add(brickBack);

    // Left wall (white neighbor side fades to yellow)
    const left = meshBox(0.28, 3.6, 5.6, Y, { roughness: 0.62 });
    left.position.set(-6.4, 1.8, -0.85);
    this.group.add(left);
    addWallCollider(this.colliders, -6.4, -0.85, 0.45, 5.6);
    const leftBrick = meshBox(0.32, 1.05, 5.6, C.brick, { roughness: 0.88 });
    leftBrick.position.set(-6.4, 0.52, -0.85);
    this.group.add(leftBrick);

    // White side building strip
    const whiteWing = meshBox(0.3, 3.6, 3.2, 0xf0f0f0, { roughness: 0.7 });
    whiteWing.position.set(-7.0, 1.8, 0.4);
    this.group.add(whiteWing);

    // Right wall + blue neighbor
    const right = meshBox(0.28, 3.6, 5.6, Y, { roughness: 0.62 });
    right.position.set(6.4, 1.8, -0.85);
    this.group.add(right);
    addWallCollider(this.colliders, 6.4, -0.85, 0.45, 5.6);
    const rightBrick = meshBox(0.32, 1.05, 5.6, C.brick, { roughness: 0.88 });
    rightBrick.position.set(6.4, 0.52, -0.85);
    this.group.add(rightBrick);

    const blue = meshBox(1.2, 3.8, 4.0, 0x1e5a9a, { roughness: 0.7 });
    blue.position.set(7.6, 1.9, -0.5);
    this.group.add(blue);

    // Front pillars (open facade)
    const pillarXs = [-5.0, -2.5, 0, 2.5, 5.0];
    for (const x of pillarXs) {
      const brick = meshBox(0.5, 1.1, 0.5, C.brick, { roughness: 0.88 });
      brick.position.set(x, 0.55, 0.65);
      this.group.add(brick);
      const top = meshBox(0.46, 2.35, 0.46, Y);
      top.position.set(x, 2.2, 0.65);
      this.group.add(top);
      addWallCollider(this.colliders, x, 0.65, 0.55, 0.55);

      if (x === 2.5) {
        const ext = meshBox(0.12, 0.36, 0.1, 0xcc2020);
        ext.position.set(x + 0.3, 1.4, 0.65);
        this.group.add(ext);
      }
    }

    // Floor + ceiling
    const floor = meshBox(12.5, 0.08, 5.0, 0xc8b89a, { roughness: 0.75 });
    floor.position.set(0, 0.04, -1.15);
    this.group.add(floor);

    const ceil = meshBox(13, 0.14, 5.8, 0xf5f5f0, {
      emissive: 0x886622,
      emissiveIntensity: 0.12,
      roughness: 0.65,
    });
    ceil.position.set(0, 3.45, -0.9);
    this.group.add(ceil);

    // Black ceiling beams
    for (const z of [-2.8, -1.4, -0.2]) {
      const beam = meshBox(12.6, 0.08, 0.12, 0x1a1a1a);
      beam.position.set(0, 3.35, z);
      this.group.add(beam);
    }

    // AMARELINHO facade sign (backlit)
    const signBoard = meshBox(2.8, 0.55, 0.1, 0x222018, {
      emissive: 0xffcc33,
      emissiveIntensity: 0.65,
    });
    signBoard.position.set(0, 3.15, 0.95);
    this.group.add(signBoard);
    const signTex = makeLabelTexture("AMARELINHO", {
      w: 640,
      h: 128,
      color: "#1a1000",
      bg: "#ffd84a",
      font: "bold 72px Bebas Neue, Arial Black, sans-serif",
    });
    const signPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.42),
      new THREE.MeshBasicMaterial({ map: signTex })
    );
    signPlane.position.set(0, 3.15, 1.02);
    this.group.add(signPlane);
  }

  _awning() {
    const cloth = meshBox(13.2, 0.1, 4.6, 0xe8b000, {
      roughness: 0.92,
      emissive: 0x664400,
      emissiveIntensity: 0.1,
    });
    cloth.position.set(0, 3.1, 1.7);
    cloth.rotation.x = -0.06;
    this.group.add(cloth);

    for (const x of [-5.5, -2.8, 0, 2.8, 5.5]) {
      const arm = meshBox(0.07, 0.07, 4.2, 0x333333, { metalness: 0.45, roughness: 0.4 });
      arm.position.set(x, 2.98, 1.55);
      this.group.add(arm);
      const pole = meshCyl(0.04, 0.04, 2.9, 0x2a2a2a, { metalness: 0.5, roughness: 0.4 });
      pole.position.set(x, 1.45, 3.7);
      this.group.add(pole);
    }

    const val = meshBox(13.2, 0.38, 0.1, 0xffd400, { roughness: 0.85 });
    val.position.set(0, 2.85, 3.9);
    this.group.add(val);

    // Striped barrel on sidewalk
    const barrel = meshCyl(0.32, 0.32, 0.85, 0xffd400);
    barrel.position.set(4.6, 0.45, 4.2);
    this.group.add(barrel);
    for (let i = 0; i < 4; i++) {
      const stripe = meshCyl(0.325, 0.325, 0.1, 0xf8f8f8);
      stripe.position.set(4.6, 0.2 + i * 0.22, 4.2);
      this.group.add(stripe);
    }
  }

  _interiorSalon() {
    const Y = 0xffd400;

    // Interior yellow pillars
    for (const [x, z] of [
      [-3.2, -1.6],
      [0.2, -1.6],
      [-3.2, -0.2],
    ]) {
      const p = meshBox(0.55, 3.2, 0.55, Y);
      p.position.set(x, 1.6, z);
      this.group.add(p);
      addWallCollider(this.colliders, x, z, 0.6, 0.6);
    }

    // Half-walls with wood ledge
    for (const [x, z, w, d] of [
      [-1.5, -2.2, 2.8, 0.2],
      [1.6, -0.8, 0.2, 2.2],
    ]) {
      const wall = meshBox(w, 1.05, d, Y);
      wall.position.set(x, 0.55, z);
      this.group.add(wall);
      const ledge = meshBox(w + 0.08, 0.06, d + 0.08, 0x3a2818);
      ledge.position.set(x, 1.1, z);
      this.group.add(ledge);
      addWallCollider(this.colliders, x, z, Math.max(w, 0.35), Math.max(d, 0.35));
    }

    // Brazilian flag
    const flagMat = new THREE.MeshStandardMaterial({
      map: makeFlagTexture(),
      roughness: 0.7,
      metalness: 0.05,
    });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.95), flagMat);
    flag.position.set(-0.8, 2.45, -3.42);
    this.group.add(flag);

    // Wall fan
    const fan = meshCyl(0.32, 0.32, 0.08, 0x1a1a1a);
    fan.rotation.x = Math.PI / 2;
    fan.position.set(2.2, 2.75, -3.4);
    this.group.add(fan);

    // TVs
    for (const x of [-3.8, 1.0]) {
      const tv = meshBox(0.95, 0.58, 0.07, 0x111111);
      tv.position.set(x, 2.45, -3.4);
      this.group.add(tv);
      const screen = meshBox(0.82, 0.45, 0.02, 0x1a4060, {
        emissive: 0x2a6088,
        emissiveIntensity: 0.7,
      });
      screen.position.set(x, 2.45, -3.35);
      this.group.add(screen);
    }

    // Clock
    const clock = meshCyl(0.18, 0.18, 0.05, 0xf0f0f0);
    clock.rotation.x = Math.PI / 2;
    clock.position.set(4.2, 2.9, -3.4);
    this.group.add(clock);

    // SAIDA sign
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
    saida.position.set(5.2, 2.9, -2.8);
    saida.rotation.y = -Math.PI / 2;
    this.group.add(saida);

    // Ceiling light fixtures
    for (const [x, z] of [
      [-2, -1.5],
      [1.5, -1.2],
      [-0.5, 0.2],
    ]) {
      for (let i = 0; i < 3; i++) {
        const shade = meshBox(0.22, 0.1, 0.22, 0xe8e0c8, {
          emissive: 0xffe8a0,
          emissiveIntensity: 0.45,
        });
        shade.position.set(x + i * 0.28 - 0.28, 3.25, z);
        this.group.add(shade);
      }
    }
  }

  _counterKitchen() {
    const C = CONFIG.colors;

    // Counter body
    const counter = meshBox(3.0, 1.05, 0.95, C.wood);
    counter.position.set(3.5, 0.55, -1.55);
    this.group.add(counter);
    addWallCollider(this.colliders, 3.5, -1.55, 3.1, 1.05);

    // Dark granite top
    const top = meshBox(3.05, 0.08, 1.0, 0x2a2a2e, { roughness: 0.35, metalness: 0.15 });
    top.position.set(3.5, 1.12, -1.55);
    this.group.add(top);

    // Generic yellow diamond (no brand)
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.48, 0),
      mat(0xffd84a, { emissive: 0xaa8800, emissiveIntensity: 0.25, roughness: 0.4 })
    );
    diamond.rotation.z = Math.PI / 4;
    diamond.position.set(3.5, 0.82, -1.05);
    diamond.scale.set(1, 0.14, 1);
    this.group.add(diamond);

    // Red freezer (generic)
    const freezer = meshBox(0.85, 0.95, 0.7, 0xc42020, { roughness: 0.55 });
    freezer.position.set(1.55, 0.5, -2.5);
    this.group.add(freezer);
    addWallCollider(this.colliders, 1.55, -2.5, 0.95, 0.8);
    const freezerLid = meshBox(0.88, 0.06, 0.72, 0xe8e8e8);
    freezerLid.position.set(1.55, 1.0, -2.5);
    this.group.add(freezerLid);

    // Glass food warmer
    const warmer = meshBox(0.9, 0.55, 0.55, 0xddeeff, { roughness: 0.25, metalness: 0.2 });
    warmer.position.set(2.6, 1.45, -1.55);
    this.group.add(warmer);

    // Shelves + bottles
    const shelfBack = meshBox(2.8, 2.3, 0.22, C.woodLight);
    shelfBack.position.set(4.0, 2.15, -3.2);
    this.group.add(shelfBack);

    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 9; i++) {
        const bottle = meshCyl(
          0.045,
          0.055,
          0.26 + (i % 3) * 0.05,
          [0x224422, 0x553311, 0x222266, 0xccaa66, 0xaaaaee][i % 5]
        );
        bottle.position.set(2.9 + i * 0.24, 1.3 + row * 0.55, -3.05);
        this.group.add(bottle);
      }
    }

    // Fruit on top shelf (pineapple / banana blobs)
    const pineapple = meshCyl(0.12, 0.14, 0.28, 0xd4a017);
    pineapple.position.set(3.2, 2.95, -3.0);
    this.group.add(pineapple);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 8), mat(0x2d6a28));
    crown.position.set(3.2, 3.2, -3.0);
    this.group.add(crown);
    const bananas = meshBox(0.35, 0.12, 0.18, 0xf0d030);
    bananas.position.set(3.8, 2.9, -3.0);
    this.group.add(bananas);

    // Exhaust hood
    const hood = meshBox(1.6, 0.12, 1.0, 0xc0c4c8, { metalness: 0.7, roughness: 0.35 });
    hood.position.set(5.0, 2.55, -2.2);
    this.group.add(hood);
    const hoodCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 0.55, 4),
      mat(0xb8bcc0, { metalness: 0.7, roughness: 0.35 })
    );
    hoodCone.position.set(5.0, 2.85, -2.2);
    hoodCone.rotation.y = Math.PI / 4;
    this.group.add(hoodCone);

    // Oven opening
    const oven = meshBox(0.9, 0.85, 0.5, 0x1a1a1a);
    oven.position.set(5.2, 0.7, -2.6);
    this.group.add(oven);
    const glow = meshBox(0.7, 0.55, 0.05, 0xff6622, {
      emissive: 0xff4400,
      emissiveIntensity: 0.8,
    });
    glow.position.set(5.2, 0.7, -2.32);
    this.group.add(glow);

    // Hanging glasses
    for (let i = 0; i < 10; i++) {
      const g = meshCyl(0.045, 0.035, 0.11, 0xddeeff, { roughness: 0.2, metalness: 0.1 });
      g.position.set(2.95 + i * 0.2, 2.9, -3.0);
      this.group.add(g);
    }

    this.interactables.push({
      kind: "counter",
      label: "Pedir no balcão",
      position: new THREE.Vector3(3.0, 1.1, -0.65),
      radius: 1.7,
    });
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
      [-3.4, 2.8, 0.1],
      [-1.5, 3.5, -0.05],
      [0.5, 2.6, 0.15],
      [-2.6, 1.5, 0],
      [0.3, 1.55, -0.1],
      [-4.2, 3.6, 0.2],
      [1.8, 3.3, 0],
      [-1.0, -0.4, 0.05],
    ];
    for (const [x, z, rot] of spots) {
      this._makeTable(x, z, rot, true);
    }
  }

  _streetProps() {
    // Simple parked cars
    this._makeCar(-2.5, 6.2, 0x9aa0a8);
    this._makeCar(1.8, 6.4, 0x1a1a1e);
    this._makeCar(5.5, 6.1, 0xb0b4b8);

    // Power pole + wires
    const pole = meshCyl(0.1, 0.12, 7, 0x6a6a6c);
    pole.position.set(-8.5, 3.5, 4.5);
    this.group.add(pole);
    const xfmr = meshBox(0.5, 0.7, 0.4, 0x555555);
    xfmr.position.set(-8.5, 5.8, 4.5);
    this.group.add(xfmr);

    // Wire lines as thin boxes
    for (const y of [6.2, 6.5, 6.8]) {
      const wire = meshBox(18, 0.02, 0.02, 0x111111);
      wire.position.set(0, y, 4.2);
      wire.rotation.z = 0.02;
      this.group.add(wire);
    }

    // Motorcycle silhouettes
    const bike = meshBox(0.4, 0.55, 1.3, 0x222222);
    bike.position.set(-4.8, 0.35, 5.0);
    this.group.add(bike);
    const wheel1 = meshCyl(0.22, 0.22, 0.08, 0x111111);
    wheel1.rotation.z = Math.PI / 2;
    wheel1.position.set(-4.8, 0.22, 4.5);
    this.group.add(wheel1);
    const wheel2 = wheel1.clone();
    wheel2.position.z = 5.5;
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
      { id: "toninho", x: 2.5, z: -0.5, rot: -0.5 },
      { id: "fabin", x: -0.8, z: 1.0, rot: 0.4 },
      { id: "oliveira", x: -3.8, z: 0.4, rot: 0.25 },
      { id: "val", x: 0.8, z: -2.1, rot: Math.PI * 0.15 },
      { id: "ney", x: -2.2, z: -1.5, rot: -0.25 },
      { id: "carlinhos", x: 4.4, z: 0.5, rot: -1.1 },
    ];

    for (const s of spots) {
      const def = WAITERS.find((w) => w.id === s.id);
      const mesh = buildWaiterMesh(def);
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = s.rot;
      this.group.add(mesh);
      this.waiters.push({ def, mesh, position: new THREE.Vector3(s.x, 0, s.z) });
      this.interactables.push({
        kind: "waiter",
        id: def.id,
        label: `Falar com ${def.name}`,
        position: new THREE.Vector3(s.x, 1.4, s.z),
        radius: 1.7,
        def,
      });
      addWallCollider(this.colliders, s.x, s.z, 0.45, 0.45);
    }
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
    pos.x = Math.max(-7.8, Math.min(7.8, pos.x));
    pos.z = Math.max(-3.2, Math.min(5.6, pos.z));
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
