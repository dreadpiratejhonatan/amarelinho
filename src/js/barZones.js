import * as THREE from "three";
import { CONFIG } from "./config.js";
import { LAYOUT, rectCenter, rectSize } from "./layout.js";
import { createFootballTv } from "./footballTv.js";

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.75,
    metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    depthWrite: opts.transparent ? false : true,
  });
}

function box(w, h, d, color, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, color, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 12), mat(color, opts));
  m.castShadow = true;
  return m;
}

function addCol(world, x, z, w, d) {
  const hw = w / 2;
  const hd = d / 2;
  world.colliders.push({
    minX: x - hw,
    maxX: x + hw,
    minZ: z - hd,
    maxZ: z + hd,
  });
}

function label(text, bg, fg = "#ffffff", opts = {}) {
  const tw = opts.w || 512;
  const th = opts.h || 128;
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, tw, th);
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Encaixa a fonte na largura (letreiro longo não pode nascer em 512px)
  let size = opts.fontSize || Math.floor(th * 0.55);
  const family = 'Bebas Neue, "Arial Black", sans-serif';
  ctx.font = `bold ${size}px ${family}`;
  while (size > 24 && ctx.measureText(text).width > tw * 0.92) {
    size -= 2;
    ctx.font = `bold ${size}px ${family}`;
  }
  ctx.fillText(text, tw / 2, th / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = opts.anisotropy ?? 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Letreiro da fachada: canvas largo pra não esticar e ficar embassado. */
function facadeSignTexture(text, planeW) {
  const tw = 4096;
  const th = 192;
  const tex = label(text, "#0a0a0a", "#ffffff", { w: tw, h: th, fontSize: 150, anisotropy: 16 });
  // Redesanha quando Bebas Neue chegar (senão cai em Arial e fica feio)
  if (typeof document !== "undefined" && document.fonts?.ready) {
    document.fonts.ready.then(() => {
      const canvas = tex.image;
      if (!canvas?.getContext) return;
      const ctx = canvas.getContext("2d");
      const family = 'Bebas Neue, "Arial Black", sans-serif';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, tw, th);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let size = 150;
      ctx.font = `bold ${size}px ${family}`;
      while (size > 24 && ctx.measureText(text).width > tw * 0.92) {
        size -= 2;
        ctx.font = `bold ${size}px ${family}`;
      }
      ctx.fillText(text, tw / 2, th / 2 + size * 0.04);
      tex.needsUpdate = true;
    }).catch(() => {});
  }
  tex.userData = { planeH: planeW * (th / tw) };
  return tex;
}

/**
 * Reconstrói o interior do bar conforme a planta colorida.
 * @param {import('./world.js').World} world
 */
export function buildBarFromPlan(world) {
  const Y = 0xffd400;
  const C = CONFIG.colors;
  const B = LAYOUT.building;
  const cx = (B.x0 + B.x1) / 2;
  const cz = (B.z0 + B.z1) / 2;
  const W = B.x1 - B.x0;
  const depth = B.z1 - B.z0;

  // —— Envelope ——
  const back = box(W, 3.8, 0.3, Y, { roughness: 0.55 });
  back.position.set(cx, 1.9, B.z0);
  world.group.add(back);
  addCol(world, cx, B.z0, W, 0.45);

  const brickBack = box(W, 1.1, 0.34, C.brick, { roughness: 0.88 });
  brickBack.position.set(cx, 0.55, B.z0 + 0.05);
  world.group.add(brickBack);

  for (const x of [B.x0, B.x1]) {
    const wall = box(0.3, 3.8, depth, Y, { roughness: 0.55 });
    wall.position.set(x, 1.9, cz);
    world.group.add(wall);
    addCol(world, x, cz, 0.45, depth);
    const brick = box(0.34, 1.1, depth, C.brick, { roughness: 0.88 });
    brick.position.set(x, 0.55, cz);
    world.group.add(brick);
  }

  // Piso base (amarelo/azul/cozinha) — não cobre o verde (plataforma própria)
  const floor = box(W - 0.5, 0.08, depth - 0.4, 0xd0c0a0, { roughness: 0.7 });
  floor.position.set(cx, 0.04, cz);
  world.group.add(floor);

  const ceil = box(W, 0.14, depth + 0.2, 0xfff8e8, {
    emissive: 0xffe08a,
    emissiveIntensity: 0.32,
    roughness: 0.55,
  });
  ceil.position.set(cx, 3.7, cz);
  world.group.add(ceil);

  for (let z = B.z0 + 1.5; z < B.z1; z += 2.2) {
    const beam = box(W - 0.5, 0.08, 0.12, 0x1a1a1a);
    beam.position.set(cx, 3.58, z);
    world.group.add(beam);
  }

  // Fachada aberta (pilares)
  const pillarXs = [-11, -7, -3, 1, 5, 9];
  for (const x of pillarXs) {
    const brick = box(0.55, 1.15, 0.55, C.brick, { roughness: 0.88 });
    brick.position.set(x, 0.58, B.z1 - 0.4);
    world.group.add(brick);
    const top = box(0.5, 2.5, 0.5, Y);
    top.position.set(x, 2.35, B.z1 - 0.4);
    world.group.add(top);
    addCol(world, x, B.z1 - 0.4, 0.6, 0.6);
  }

  // Extintor no pilar (ref do boteco)
  const extinguisher = box(0.18, 0.45, 0.14, 0xc42020, { roughness: 0.45, metalness: 0.2 });
  extinguisher.position.set(-3.35, 1.35, B.z1 - 0.15);
  world.group.add(extinguisher);
  const extTop = cyl(0.04, 0.04, 0.08, 0x222222);
  extTop.position.set(-3.35, 1.62, B.z1 - 0.15);
  world.group.add(extTop);

  // Ventilador de parede
  const fanMount = box(0.12, 0.12, 0.08, 0x1a1a1a);
  fanMount.position.set(B.x0 + 0.4, 2.85, -2);
  world.group.add(fanMount);
  const fan = cyl(0.28, 0.28, 0.06, 0x3a3a42, { metalness: 0.4, roughness: 0.45 });
  fan.rotation.x = Math.PI / 2;
  fan.position.set(B.x0 + 0.55, 2.85, -2);
  world.group.add(fan);
  world._fan = fan;

  // Placa na calçada
  const sidewalkSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.55),
    new THREE.MeshBasicMaterial({
      map: label("MESA NA CALÇADA", "#1a1408", "#ffd84a"),
      side: THREE.DoubleSide,
    })
  );
  sidewalkSign.position.set(-5.5, 1.35, B.z1 + 1.2);
  sidewalkSign.rotation.y = 0.15;
  world.group.add(sidewalkSign);
  const signPole = cyl(0.04, 0.04, 1.2, 0x333333);
  signPole.position.set(-5.5, 0.6, B.z1 + 1.2);
  world.group.add(signPole);

  const parapet = box(W + 0.4, 0.55, 0.55, Y);
  parapet.position.set(cx, 3.95, B.z1 - 0.3);
  world.group.add(parapet);
  const blackBoard = box(W + 0.5, 1.35, 0.22, 0x0a0a0a);
  blackBoard.position.set(cx, 4.75, B.z1 - 0.25);
  world.group.add(blackBoard);
  const signW = W * 0.92;
  const signMap = facadeSignTexture("AMARELINHO DAS BATIDAS", signW);
  const signH = signMap.userData.planeH || 1.1;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(signW, signH),
    new THREE.MeshBasicMaterial({
      map: signMap,
      toneMapped: false,
    })
  );
  sign.position.set(cx, 4.75, B.z1 - 0.1);
  sign.renderOrder = 1;
  world.group.add(sign);

  // —— Verde: plataforma elevada + escada ——
  const g = LAYOUT.green;
  const gSz = rectSize(g);
  const gC = rectCenter(g);
  const platform = box(gSz.w, g.height, gSz.d, 0x3a6b3a, { roughness: 0.8 });
  platform.position.set(gC.x, g.height / 2, gC.z);
  world.group.add(platform);
  // Borda / guarda-corpo leve
  const rail = box(0.12, 0.55, gSz.d - 0.4, 0x2a4a2a);
  rail.position.set(g.x1 - 0.08, g.height + 0.28, gC.z);
  world.group.add(rail);

  const st = LAYOUT.stairs;
  const steps = st.steps;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const x0 = st.x1 - t1 * (st.x1 - st.x0);
    const x1 = st.x1 - t0 * (st.x1 - st.x0);
    const h = ((t0 + t1) / 2) * g.height;
    const step = box(Math.max(0.12, x1 - x0), Math.max(0.06, h), st.z1 - st.z0 - 0.2, 0xc8b090);
    step.position.set((x0 + x1) / 2, h / 2, (st.z0 + st.z1) / 2);
    world.group.add(step);
  }
  const stairSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.25),
    new THREE.MeshBasicMaterial({ map: label("MESAS ▲", "#2a5a2a", "#ffd84a") })
  );
  stairSign.position.set(st.x1 + 0.05, 1.2, (st.z0 + st.z1) / 2);
  stairSign.rotation.y = -Math.PI / 2;
  world.group.add(stairSign);

  // —— Azul: caixa + geladeiras ——
  const bl = LAYOUT.blue;
  const blC = rectCenter(bl);
  // Balcão / caixa
  const desk = box(3.2, 1.05, 0.85, C.wood);
  desk.position.set(bl.x0 + 2.2, 0.55, bl.z1 - 1.5);
  world.group.add(desk);
  addCol(world, bl.x0 + 2.2, bl.z1 - 1.5, 3.3, 0.95);
  // Base de tijolo sob o balcão (refs da fachada)
  const deskBrick = box(3.25, 0.55, 0.9, C.brick, { roughness: 0.9 });
  deskBrick.position.set(bl.x0 + 2.2, 0.28, bl.z1 - 1.5);
  world.group.add(deskBrick);
  const deskTop = box(3.25, 0.08, 0.9, 0x3a2a1a, { metalness: 0.12, roughness: 0.4 });
  deskTop.position.set(bl.x0 + 2.2, 1.12, bl.z1 - 1.5);
  world.group.add(deskTop);
  const register = box(0.45, 0.35, 0.4, 0x1a1a1a);
  register.position.set(bl.x0 + 1.4, 1.4, bl.z1 - 1.5);
  world.group.add(register);

  // Diamante amarelo genérico no balcão (sem marca)
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.38, 0),
    mat(0xffd84a, { roughness: 0.45, emissive: 0xaa7700, emissiveIntensity: 0.35 })
  );
  diamond.position.set(bl.x0 + 2.9, 1.55, bl.z1 - 1.5);
  diamond.rotation.y = Math.PI / 4;
  diamond.scale.set(1, 1.15, 0.35);
  diamond.castShadow = true;
  world.group.add(diamond);
  const diaLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.18),
    new THREE.MeshBasicMaterial({ map: label("ORIGINAL", "#ffd84a", "#1a1408"), transparent: true })
  );
  diaLabel.position.set(bl.x0 + 2.9, 1.55, bl.z1 - 1.28);
  world.group.add(diaLabel);

  // Prateleira de garrafas atrás do caixa
  const backShelf = box(3.4, 0.08, 0.35, C.woodLight);
  backShelf.position.set(bl.x0 + 2.2, 2.35, bl.z1 - 2.15);
  world.group.add(backShelf);
  const backShelf2 = box(3.4, 0.08, 0.35, C.woodLight);
  backShelf2.position.set(bl.x0 + 2.2, 1.85, bl.z1 - 2.15);
  world.group.add(backShelf2);
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 10; i++) {
      const bottle = cyl(0.045, 0.05, 0.26 + (i % 3) * 0.04, [0x224422, 0x553311, 0x1a1a66, 0x884422][i % 4]);
      bottle.position.set(bl.x0 + 0.7 + i * 0.3, 1.55 + row * 0.5, bl.z1 - 2.15);
      world.group.add(bottle);
    }
  }
  // Copos pendurados
  for (let i = 0; i < 8; i++) {
    const glass = cyl(0.04, 0.035, 0.12, 0xcceeff, { metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.55 });
    glass.position.set(bl.x0 + 0.9 + i * 0.28, 2.55, bl.z1 - 2.05);
    world.group.add(glass);
  }

  const caixaTex = label("CAIXA", "#1a1a1a", "#ffd84a");
  const caixaSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.35),
    new THREE.MeshBasicMaterial({ map: caixaTex })
  );
  caixaSign.position.set(bl.x0 + 2.2, 2.85, bl.z1 - 1.05);
  world.group.add(caixaSign);

  // Geladeiras de cerveja (fileira)
  for (let i = 0; i < 5; i++) {
    const fx = bl.x0 + 4.2 + i * 1.35;
    const fz = blC.z;
    const fridge = box(1.1, 2.1, 0.85, i % 2 === 0 ? 0xc42020 : 0xe8e8ec, { roughness: 0.45 });
    fridge.position.set(fx, 1.05, fz);
    world.group.add(fridge);
    addCol(world, fx, fz, 1.2, 0.95);
    const glass = box(0.85, 1.5, 0.05, 0x88aabb, {
      metalness: 0.3,
      roughness: 0.2,
      emissive: 0x224466,
      emissiveIntensity: 0.25,
    });
    glass.position.set(fx, 1.15, fz + 0.42);
    world.group.add(glass);
    // Latas densas nas geladeiras
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const can = cyl(0.055, 0.055, 0.13, [0xffd84a, 0xcc2020, 0xffffff, 0x2a6ad4][(c + r) % 4]);
        can.position.set(fx - 0.32 + c * 0.22, 0.48 + r * 0.38, fz + 0.12);
        world.group.add(can);
      }
    }
  }

  world.interactables.push({
    kind: "counter",
    label: "Pagar / pedir no caixa",
    position: new THREE.Vector3(bl.x0 + 2.2, 1.1, bl.z1 - 0.9),
    radius: 1.9,
  });

  // Jukebox no canto azul
  const jx = bl.x1 - 1.2;
  const jz = bl.z0 + 1.4;
  const juke = box(0.7, 1.35, 0.55, 0x1a1a22, { metalness: 0.35, roughness: 0.45 });
  juke.position.set(jx, 0.7, jz);
  world.group.add(juke);
  const jukeGlow = box(0.55, 0.35, 0.08, 0xffd84a, { emissive: 0xffaa00, emissiveIntensity: 0.9 });
  jukeGlow.position.set(jx, 1.15, jz + 0.28);
  world.group.add(jukeGlow);
  addCol(world, jx, jz, 0.85, 0.7);
  world.interactables.push({
    kind: "jukebox",
    label: "Jukebox — trocar estação",
    position: new THREE.Vector3(jx, 1.1, jz),
    radius: 1.6,
  });
  world._jukeboxLight = jukeGlow;

  // —— Vermelho: cozinha ——
  const k = LAYOUT.kitchen;
  const kC = rectCenter(k);
  // Divisórias com vão
  const kWall = box(0.2, 2.7, rectSize(k).d * 0.55, 0xe8d8a8);
  kWall.position.set(k.x0, 1.35, k.z0 + rectSize(k).d * 0.35);
  world.group.add(kWall);
  addCol(world, k.x0, k.z0 + rectSize(k).d * 0.35, 0.35, rectSize(k).d * 0.55);

  const kitFloor = box(rectSize(k).w - 0.2, 0.04, rectSize(k).d - 0.2, 0x6a6a70, { roughness: 0.55 });
  kitFloor.position.set(kC.x, 0.06, kC.z);
  world.group.add(kitFloor);

  // Tijolo baixo na cozinha (contraste amarelo × tijolo das refs)
  const kitBrick = box(rectSize(k).w - 0.4, 0.95, 0.2, C.brick, { roughness: 0.9 });
  kitBrick.position.set(kC.x, 0.48, k.z0 + 0.25);
  world.group.add(kitBrick);
  const kitYellow = box(rectSize(k).w - 0.4, 1.8, 0.18, Y, { roughness: 0.55 });
  kitYellow.position.set(kC.x, 1.9, k.z0 + 0.22);
  world.group.add(kitYellow);

  // Chapa
  const bench = box(3.8, 0.9, 0.9, 0x4a4a50, { metalness: 0.4, roughness: 0.4 });
  bench.position.set(k.x0 + 3.2, 0.5, kC.z);
  world.group.add(bench);
  addCol(world, k.x0 + 3.2, kC.z, 3.9, 1.0);
  const chapa = box(1.7, 0.08, 0.75, 0x2a2a2e, { metalness: 0.7, roughness: 0.35 });
  chapa.position.set(k.x0 + 2.4, 0.98, kC.z);
  world.group.add(chapa);
  const chapaGlow = box(1.5, 0.02, 0.6, 0xff6622, { emissive: 0xff4400, emissiveIntensity: 0.8 });
  chapaGlow.position.set(k.x0 + 2.4, 1.02, kC.z);
  world.group.add(chapaGlow);
  // Fumaça da chapa (partículas leves)
  world._smoke = world._smoke || [];
  for (let i = 0; i < 10; i++) {
    const p = box(0.08 + Math.random() * 0.06, 0.08, 0.08, 0xaaaaaa, {
      transparent: true,
      opacity: 0.22,
      roughness: 1,
    });
    p.position.set(
      k.x0 + 2.4 + (Math.random() - 0.5) * 0.9,
      1.15 + Math.random() * 0.4,
      kC.z + (Math.random() - 0.5) * 0.4
    );
    p.userData.smoke = {
      ox: p.position.x,
      oz: p.position.z,
      phase: Math.random() * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.35,
    };
    world.group.add(p);
    world._smoke.push(p);
  }
  // Hambúrguer na chapa
  const patty = box(0.28, 0.05, 0.28, 0x4a2a12);
  patty.position.set(k.x0 + 2.2, 1.08, kC.z);
  world.group.add(patty);
  const bun = box(0.3, 0.06, 0.3, 0xe8b060);
  bun.position.set(k.x0 + 2.55, 1.1, kC.z + 0.1);
  world.group.add(bun);

  // Fogão
  const stove = box(1.2, 0.95, 0.8, 0x1a1a1e, { metalness: 0.4, roughness: 0.45 });
  stove.position.set(k.x0 + 5.0, 0.5, kC.z);
  world.group.add(stove);
  for (const [ox, oz] of [
    [-0.25, -0.18],
    [0.25, -0.18],
    [-0.25, 0.18],
    [0.25, 0.18],
  ]) {
    const burner = cyl(0.12, 0.12, 0.04, 0x333338);
    burner.position.set(k.x0 + 5.0 + ox, 1.0, kC.z + oz);
    world.group.add(burner);
    const flame = cyl(0.05, 0.02, 0.08, 0xff6622, { emissive: 0xff4400, emissiveIntensity: 1.1 });
    flame.position.set(k.x0 + 5.0 + ox, 1.08, kC.z + oz);
    world.group.add(flame);
  }

  const hood = box(3.2, 0.12, 1.1, 0xc0c4c8, { metalness: 0.7, roughness: 0.35 });
  hood.position.set(k.x0 + 3.6, 2.8, kC.z);
  world.group.add(hood);

  const kitSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.35),
    new THREE.MeshBasicMaterial({ map: label("COZINHA", "#ffd84a", "#1a1408") })
  );
  kitSign.position.set(k.x0 + 0.15, 2.5, kC.z);
  kitSign.rotation.y = Math.PI / 2;
  world.group.add(kitSign);

  // Prateleiras fundo cozinha (várias fileiras)
  for (const hy of [1.35, 1.85, 2.35]) {
    const shelf = box(4.8, 0.07, 0.32, C.woodLight);
    shelf.position.set(kC.x, hy, k.z0 + 0.42);
    world.group.add(shelf);
  }
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 12; i++) {
      const bottle = cyl(0.045, 0.05, 0.24 + (i % 4) * 0.03, [0x224422, 0x553311, 0x222266, 0xaa4422][i % 4]);
      bottle.position.set(k.x0 + 1.4 + i * 0.32, 1.15 + row * 0.5, k.z0 + 0.55);
      world.group.add(bottle);
    }
  }
  // Utensílios na bancada
  for (let i = 0; i < 4; i++) {
    const pan = cyl(0.14, 0.12, 0.06, 0x2a2a2e, { metalness: 0.6, roughness: 0.35 });
    pan.position.set(k.x0 + 3.6 + i * 0.35, 1.02, kC.z - 0.25);
    world.group.add(pan);
  }

  // —— Banheiros ——
  buildBath(world, LAYOUT.bathLime, "BANHEIRO", "#2a8a3a", true);
  buildBath(world, LAYOUT.bathIndigo, "BANHEIRO", "#1a3a8a", false);

  // —— TVs ——
  const mounts = [
    { x: -10, y: 2.55, z: B.z0 + 0.2, rot: 0 },
    { x: -4, y: 2.55, z: B.z0 + 0.2, rot: 0 },
    { x: -8, y: 2.55 + LAYOUT.green.height, z: g.z0 + 0.15, rot: 0 },
    { x: B.x1 - 0.25, y: 2.4, z: -2, rot: -Math.PI / 2 },
    { x: B.x1 - 0.25, y: 2.4, z: -9, rot: -Math.PI / 2 },
  ];
  for (const m of mounts) {
    const tv = createFootballTv(1.35, 0.8);
    tv.frame.position.set(m.x, m.y, m.z);
    tv.frame.rotation.y = m.rot;
    world.group.add(tv.frame);
    world.tvs.push(tv);
  }

  // Luzes extras nas zonas
  for (const [x, z, i] of [
    [-8, -2, 2.2],
    [-8, -10, 2.0],
    [-1, -1, 1.8],
    [-1, -10, 2.0],
    [6, -2, 2.2],
    [7, -9, 2.4],
    [5, -13.5, 1.4],
    [10, -13.5, 1.4],
  ]) {
    const l = new THREE.PointLight(0xfff2d8, i, 14, 1.4);
    l.position.set(x, 2.8, z);
    world.scene.add(l);
  }
}

function buildBath(world, r, title, color, sideEntrance) {
  const sz = rectSize(r);
  const c = rectCenter(r);
  // Paredes — vão de porta
  const tile = box(sz.w - 0.15, 0.05, sz.d - 0.15, 0xc8d0d8, { roughness: 0.4 });
  tile.position.set(c.x, 0.06, c.z);
  world.group.add(tile);

  // Parede oeste
  if (sideEntrance) {
    // Entrada lateral: vão no meio da parede oeste
    const w1 = box(0.18, 2.6, sz.d * 0.28, 0xe8e0d0);
    w1.position.set(r.x0, 1.3, r.z0 + sz.d * 0.2);
    world.group.add(w1);
    addCol(world, r.x0, r.z0 + sz.d * 0.2, 0.3, sz.d * 0.3);
    const w2 = box(0.18, 2.6, sz.d * 0.28, 0xe8e0d0);
    w2.position.set(r.x0, 1.3, r.z1 - sz.d * 0.2);
    world.group.add(w2);
    addCol(world, r.x0, r.z1 - sz.d * 0.2, 0.3, sz.d * 0.3);
    const door = box(0.08, 2.05, 0.7, 0x5c3a22);
    door.position.set(r.x0 + 0.05, 1.05, c.z);
    door.rotation.y = 0.7;
    world.group.add(door);
  } else {
    const w = box(0.18, 2.6, sz.d - 0.2, 0xe8e0d0);
    w.position.set(r.x0, 1.3, c.z);
    world.group.add(w);
    addCol(world, r.x0, c.z, 0.3, sz.d - 0.2);
    // Porta nos fundos (sul / -Z) — vão na parede sul
  }

  // Parede leste
  const east = box(0.18, 2.6, sz.d - 0.15, 0xe8e0d0);
  east.position.set(r.x1, 1.3, c.z);
  world.group.add(east);
  addCol(world, r.x1, c.z, 0.3, sz.d - 0.15);

  // Parede norte (+Z front of bath room toward kitchen)
  if (sideEntrance) {
    const north = box(sz.w - 0.2, 2.6, 0.18, 0xe8e0d0);
    north.position.set(c.x, 1.3, r.z1);
    world.group.add(north);
    addCol(world, c.x, r.z1, sz.w - 0.2, 0.3);
  } else {
    // Índigo: entrada pelos fundos — vão na parede norte (vindo da cozinha)
    const n1 = box(sz.w * 0.28, 2.6, 0.18, 0xe8e0d0);
    n1.position.set(r.x0 + sz.w * 0.2, 1.3, r.z1);
    world.group.add(n1);
    addCol(world, r.x0 + sz.w * 0.2, r.z1, sz.w * 0.3, 0.3);
    const n2 = box(sz.w * 0.28, 2.6, 0.18, 0xe8e0d0);
    n2.position.set(r.x1 - sz.w * 0.2, 1.3, r.z1);
    world.group.add(n2);
    addCol(world, r.x1 - sz.w * 0.2, r.z1, sz.w * 0.3, 0.3);
    const door = box(0.7, 2.05, 0.08, 0x5c3a22);
    door.position.set(c.x, 1.05, r.z1 - 0.05);
    door.rotation.y = 0.55;
    world.group.add(door);
  }

  // Fundo (-Z)
  const south = box(sz.w - 0.15, 2.6, 0.18, 0xe8e0d0);
  south.position.set(c.x, 1.3, r.z0);
  world.group.add(south);
  addCol(world, c.x, r.z0, sz.w - 0.15, 0.3);

  // Vaso + pia
  const bowl = cyl(0.22, 0.18, 0.35, 0xf0f0f0);
  bowl.position.set(c.x + 0.6, 0.35, c.z - 0.6);
  world.group.add(bowl);
  const tank = box(0.35, 0.45, 0.18, 0xf0f0f0);
  tank.position.set(c.x + 0.6, 0.85, c.z - 0.9);
  world.group.add(tank);
  addCol(world, c.x + 0.6, c.z - 0.7, 0.5, 0.55);

  const sink = box(0.7, 0.12, 0.4, 0xe8e8ec);
  sink.position.set(c.x - 0.7, 0.95, c.z + 0.5);
  world.group.add(sink);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.28),
    new THREE.MeshBasicMaterial({ map: label(title, color, "#ffffff") })
  );
  if (sideEntrance) {
    sign.position.set(r.x0 - 0.05, 2.4, c.z);
    sign.rotation.y = -Math.PI / 2;
  } else {
    sign.position.set(c.x, 2.4, r.z1 + 0.05);
  }
  world.group.add(sign);
}

/** Mesas nas zonas amarela e verde. */
export function placePlanTables(world, makeTable) {
  const gH = LAYOUT.green.height;
  // Verde (elevado)
  const greenSpots = [
    [-11.5, -1.5],
    [-9.0, -1.2],
    [-6.5, -1.8],
    [-11.2, -4.0],
    [-8.5, -4.2],
    [-6.0, -3.8],
    [-10.0, 0.2],
    [-7.2, 0.0],
  ];
  for (const [x, z] of greenSpots) {
    makeTable(x, z, (Math.random() - 0.5) * 0.15, true, gH);
  }

  // Amarelo corredor + salão
  const yellowSpots = [
    [-1.0, 0.2],
    [0.5, -1.5],
    [-1.2, -3.5],
    [0.8, -4.5],
    [-11.0, -8.5],
    [-8.0, -8.2],
    [-5.0, -8.8],
    [-2.0, -8.0],
    [-10.5, -11.0],
    [-7.5, -11.5],
    [-4.5, -10.8],
    [-1.5, -11.2],
    [-9.0, -13.5],
    [-5.5, -13.8],
    [-2.5, -13.2],
  ];
  for (const [x, z] of yellowSpots) {
    makeTable(x, z, (Math.random() - 0.5) * 0.12, true, 0);
  }

  // Calçada sob o toldo
  const sidewalkSpots = [
    [-8.5, 2.8],
    [-5.5, 3.0],
    [-2.5, 2.7],
    [0.5, 3.1],
    [3.5, 2.9],
    [-7.0, 4.4],
    [-3.5, 4.6],
    [1.5, 4.5],
  ];
  for (const [x, z] of sidewalkSpots) {
    makeTable(x, z, (Math.random() - 0.5) * 0.2, false, 0);
  }
}
