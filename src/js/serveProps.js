import * as THREE from "three";
import { MENU } from "./menu.js";

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.1,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
}

function box(w, h, d, color, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.castShadow = true;
  return m;
}

function cyl(rt, rb, h, color, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 10), mat(color, opts));
  m.castShadow = true;
  return m;
}

/** Bandeja que o garçom carrega durante o serve. */
export function buildTray(itemId) {
  const root = new THREE.Group();
  root.name = "serveTray";
  const tray = box(0.42, 0.03, 0.28, 0x2a2a2e, { metalness: 0.45, roughness: 0.35 });
  tray.position.y = 0;
  root.add(tray);
  const item = buildItemProp(itemId, 0.85);
  if (item) {
    item.position.y = 0.06;
    root.add(item);
  }
  root.position.set(0.28, 1.15, 0.22);
  return root;
}

/** Prop do item (copo / garrafa / porção) para mesa ou bandeja. */
export function buildItemProp(itemId, scale = 1) {
  const def = MENU[itemId];
  if (!def) return null;
  const g = new THREE.Group();
  g.name = `prop_${itemId}`;
  g.userData.itemId = itemId;

  if (def.cat === "food") {
    const plate = cyl(0.16, 0.16, 0.03, 0xf0f0f0, { roughness: 0.4 });
    plate.position.y = 0.02;
    g.add(plate);
    const colors = {
      food: 0xc4782a,
      torresmo: 0xb8860b,
      bolinho: 0xd4a017,
      calabresa: 0xa83232,
    };
    const pile = box(0.18, 0.06, 0.14, colors[itemId] || 0xc4782a);
    pile.position.y = 0.07;
    g.add(pile);
    if (itemId === "calabresa") {
      const onion = box(0.1, 0.03, 0.1, 0xf5f0e0);
      onion.position.y = 0.11;
      g.add(onion);
    }
  } else if (def.cat === "batida") {
    const glass = cyl(0.055, 0.04, 0.16, 0xcceeff, {
      metalness: 0.15,
      roughness: 0.2,
      transparent: true,
      opacity: 0.45,
    });
    glass.position.y = 0.1;
    g.add(glass);
    const colors = {
      batida: 0xffd84a,
      batida_limao: 0xc8e060,
      batida_maracuja: 0xffaa22,
      batida_especial: 0xffee88,
    };
    const liquid = cyl(0.045, 0.035, 0.1, colors[itemId] || 0xffd84a, {
      emissive: colors[itemId] || 0xffd84a,
      emissiveIntensity: 0.15,
    });
    liquid.position.y = 0.08;
    g.add(liquid);
    const straw = box(0.015, 0.18, 0.015, 0xff4466);
    straw.position.set(0.03, 0.18, 0);
    straw.rotation.z = 0.2;
    g.add(straw);
  } else if (itemId === "beer") {
    const bottle = cyl(0.04, 0.045, 0.22, 0xc9a000, { metalness: 0.2, roughness: 0.4 });
    bottle.position.y = 0.12;
    g.add(bottle);
    const neck = cyl(0.02, 0.025, 0.06, 0xc9a000);
    neck.position.y = 0.26;
    g.add(neck);
    const label = box(0.06, 0.08, 0.01, 0xffd84a);
    label.position.set(0, 0.12, 0.042);
    g.add(label);
  } else if (itemId === "soda") {
    const can = cyl(0.045, 0.045, 0.16, 0xcc2020, { metalness: 0.35, roughness: 0.35 });
    can.position.y = 0.1;
    g.add(can);
    const top = cyl(0.042, 0.042, 0.02, 0xc0c0c0, { metalness: 0.6, roughness: 0.3 });
    top.position.y = 0.19;
    g.add(top);
  } else if (itemId === "pastel") {
    const plate = cyl(0.14, 0.14, 0.025, 0xf0f0f0, { roughness: 0.4 });
    plate.position.y = 0.02;
    g.add(plate);
    const p = box(0.2, 0.04, 0.12, 0xe8c060);
    p.position.y = 0.06;
    p.rotation.y = 0.3;
    g.add(p);
  } else if (itemId === "gelo_limao") {
    const glass = cyl(0.05, 0.04, 0.14, 0xaaccff, {
      metalness: 0.1,
      roughness: 0.2,
      transparent: true,
      opacity: 0.4,
    });
    glass.position.y = 0.09;
    g.add(glass);
    const ice = box(0.04, 0.04, 0.04, 0xe8f4ff);
    ice.position.set(0, 0.1, 0);
    g.add(ice);
    const lemon = box(0.03, 0.02, 0.05, 0xc8e060);
    lemon.position.set(0.02, 0.14, 0);
    g.add(lemon);
  } else {
    // água
    const glass = cyl(0.05, 0.04, 0.14, 0xaaccff, {
      metalness: 0.1,
      roughness: 0.2,
      transparent: true,
      opacity: 0.4,
    });
    glass.position.y = 0.09;
    g.add(glass);
    const water = cyl(0.04, 0.032, 0.09, 0x88bbdd, { transparent: true, opacity: 0.5 });
    water.position.y = 0.07;
    g.add(water);
  }

  g.scale.setScalar(scale);
  return g;
}

/**
 * Gerencia props de pedido no mundo (mesa / balcão).
 */
export class ServeProps {
  constructor(world) {
    this.world = world;
    this.tableProps = [];
    this.counterProp = null;
  }

  placeAtSeat(itemId, seat) {
    if (!seat) return null;
    const prop = buildItemProp(itemId, 1);
    if (!prop) return null;
    const look = seat.lookAt || seat.position;
    const px = (seat.position.x + (look.x ?? seat.position.x)) / 2;
    const pz = (seat.position.z + (look.z ?? seat.position.z)) / 2;
    const fy = (seat.position.y || 0) + 0.2;
    // Empilha levemente se já houver props
    const n = this.tableProps.filter((p) => p.userData.seat === seat).length;
    prop.position.set(px + (n % 2) * 0.12 - 0.06, fy + 0.52 + Math.floor(n / 2) * 0.08, pz);
    prop.userData.seat = seat;
    this.world.group.add(prop);
    this.tableProps.push(prop);
    return prop;
  }

  placeAtCounter(itemId) {
    this.clearCounter();
    const prop = buildItemProp(itemId, 1);
    if (!prop) return null;
    // Posição aproximada do caixa (LAYOUT.blue)
    prop.position.set(1.5, 1.2, -0.6);
    this.world.group.add(prop);
    this.counterProp = prop;
    return prop;
  }

  clearCounter() {
    if (this.counterProp) {
      this.world.group.remove(this.counterProp);
      this.counterProp = null;
    }
  }

  /** Limpa props da mesa ao pagar (ou deixa restos vazios). */
  clearTable(leaveRemnants = true) {
    const seats = [...new Set(this.tableProps.map((p) => p.userData.seat).filter(Boolean))];
    for (const p of this.tableProps) {
      this.world.group.remove(p);
    }
    this.tableProps = [];
    if (leaveRemnants) {
      for (const seat of seats) {
        const look = seat.lookAt || seat.position;
        const napkin = box(0.1, 0.012, 0.08, 0xf5f0e0);
        napkin.position.set(
          seat.position.x * 0.35 + look.x * 0.65,
          (seat.position.y || 0) + 0.74,
          seat.position.z * 0.35 + look.z * 0.65
        );
        napkin.userData.remnant = true;
        this.world.group.add(napkin);
        this.tableProps.push(napkin);
      }
    }
    this.clearCounter();
  }

  clearAll() {
    for (const p of this.tableProps) this.world.group.remove(p);
    this.tableProps = [];
    this.clearCounter();
  }
}
