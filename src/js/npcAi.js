import * as THREE from "three";
import { floorHeightAt } from "./layout.js";

/** Waypoints alinhados à planta (lavanda / verde / amarelo / azul / cozinha). */
export const NPC_WAYPOINTS = {
  sidewalk: [
    [-10, 3.5], [-5, 4], [-1, 3.8], [3, 4.2], [7, 3.6],
    [-8, 5.5], [0, 5.8], [5, 5.5],
  ],
  green: [
    [-11.5, -1], [-9, -2], [-6.5, -1.5], [-11, -4], [-8, -4.5], [-6.5, -3.5],
    [-10, 0], [-7.5, 0.3],
  ],
  interior: [
    [-1, 0], [0.5, -2], [-1, -4], [0.8, -5],
    [-11, -8.5], [-8, -9], [-5, -8.5], [-2, -9.5],
    [-10, -11.5], [-6, -12], [-3, -11], [-9, -13.5], [-5, -13.8],
  ],
  blue: [
    [4, -1], [6, -2.5], [8, -1.5], [10, -3], [5, -4.5], [9, -5],
  ],
  kitchen: [
    [5, -8.5], [7, -9], [9, -8.8], [6, -10.5], [8.5, -10], [10, -9.5],
  ],
  street: [
    [-6, 8.5], [-2, 9.0], [2, 8.8], [5, 9.2], [-4, 11], [0, 10.5],
  ],
};

const CHAT_LINES = [
  "E aí!",
  "Gelada?",
  "Gol!",
  "Ô loco…",
  "Tá lotado",
  "Mais uma?",
  "Saúde!",
  "Boa noite",
  "Chama o Ney",
  "Que batida!",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dist2(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

export class NpcAgent {
  constructor(opts) {
    this.mesh = opts.mesh;
    this.kind = opts.kind;
    this.zones = opts.zones;
    this.speed = opts.speed ?? (opts.kind === "waiter" ? 1.35 : 1.15);
    this.interactable = opts.interactable || null;
    this.state = "idle";
    this.timer = 0.4 + Math.random() * 1.5;
    this.target = null;
    this.partner = null;
    this.seat = null;
    this._phase = Math.random() * Math.PI * 2;
    this._cooldown = 1 + Math.random() * 2;
    this._speechT = 0;
    this._serveJob = null;
  }

  get x() {
    return this.mesh.position.x;
  }
  get z() {
    return this.mesh.position.z;
  }

  _setBubble(on, text) {
    const b = this.mesh.userData.chatBubble;
    if (!b) return;
    b.visible = !!on;
    if (on && text && b.userData.setText) b.userData.setText(text);
  }

  say(text, duration = 2.2) {
    this._speechT = duration;
    this._setBubble(true, text);
  }

  _floorBob(extra = 0) {
    const fy = floorHeightAt(this.x, this.z);
    const sitY = this.state === "sit" ? 0.35 : 0;
    this.mesh.position.y = fy + sitY + extra;
  }

  _pickWaypoint(agents) {
    const zone = pick(this.zones);
    const list = NPC_WAYPOINTS[zone] || NPC_WAYPOINTS.interior;
    let best = null;
    for (let i = 0; i < 6; i++) {
      const [x, z] = pick(list);
      const jitterX = x + (Math.random() - 0.5) * 0.7;
      const jitterZ = z + (Math.random() - 0.5) * 0.5;
      let crowded = false;
      for (const a of agents) {
        if (a === this) continue;
        if (dist2(jitterX, jitterZ, a.x, a.z) < 0.85) {
          crowded = true;
          break;
        }
      }
      if (!crowded) {
        best = { x: jitterX, z: jitterZ };
        break;
      }
      best = { x: jitterX, z: jitterZ };
    }
    return best;
  }

  _faceToward(x, z, dt) {
    const dx = x - this.x;
    const dz = z - this.z;
    if (dx * dx + dz * dz < 1e-6) return;
    const want = Math.atan2(dx, dz);
    let diff = want - this.mesh.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.mesh.rotation.y += diff * Math.min(1, dt * 6);
  }

  _beginChat(other, duration) {
    this.state = "chat";
    this.partner = other;
    this.timer = duration;
    this.target = null;
    const line = pick(CHAT_LINES);
    this._setBubble(true, line);
    other.state = "chat";
    other.partner = this;
    other.timer = duration;
    other.target = null;
    other._setBubble(true, pick(CHAT_LINES));
    other._cooldown = 4 + Math.random() * 4;
    this._cooldown = 4 + Math.random() * 4;
  }

  _endChat() {
    this._setBubble(false);
    this.partner = null;
    this.state = "idle";
    this.timer = 0.3 + Math.random() * 1.2;
  }

  assignServe(job) {
    if (this.kind !== "waiter" || this.state === "serve") return false;
    this._serveJob = job;
    this.state = "serve";
    this.target = { x: job.x, z: job.z };
    this.timer = 12;
    this.say("Já levo!", 1.6);
    this._attachTray(job.itemId);
    return true;
  }

  _attachTray(itemId) {
    this._detachTray();
    // lazy import avoided — tray built by world/main and passed, or built here
    if (typeof this._trayBuilder === "function") {
      const tray = this._trayBuilder(itemId);
      if (tray) {
        const body = this.mesh.userData.bodyRoot || this.mesh;
        body.add(tray);
        this._tray = tray;
      }
    }
  }

  _detachTray() {
    if (this._tray) {
      this._tray.parent?.remove(this._tray);
      this._tray = null;
    }
  }

  trySit(world) {
    if (this.kind !== "customer" || !world.claimSeat) return false;
    const seat = world.claimSeat(this);
    if (!seat) return false;
    this.seat = seat;
    this.state = "gotoSit";
    this.target = { x: seat.position.x, z: seat.position.z };
    this.timer = 10;
    return true;
  }

  leaveSeat(world) {
    if (this.seat && world.releaseSeat) world.releaseSeat(this.seat, this);
    this.seat = null;
  }

  cheer() {
    if (this.state === "sit" || this.state === "idle" || this.state === "chat") {
      this.say(Math.random() < 0.5 ? "GOOL!" : "Ééé!", 2.4);
    }
  }

  update(dt, agents, world) {
    this._cooldown = Math.max(0, this._cooldown - dt);
    this.timer -= dt;

    if (this._speechT > 0) {
      this._speechT -= dt;
      if (this._speechT <= 0 && this.state !== "chat") this._setBubble(false);
    }

    if (this.state === "sit") {
      this._floorBob(Math.sin(performance.now() * 0.002 + this._phase) * 0.008);
      if (this.timer <= 0) {
        this.leaveSeat(world);
        this.state = "idle";
        this.timer = 1 + Math.random() * 2;
      } else if (Math.random() < 0.003) {
        this.say(pick(CHAT_LINES), 2);
      }
      this._syncInteractable();
      return;
    }

    if (this.state === "gotoSit") {
      if (!this.target || this.timer <= 0) {
        this.leaveSeat(world);
        this.state = "idle";
        this.timer = 1;
        this._syncInteractable();
        return;
      }
      this._walkToward(dt, agents, world);
      if (dist2(this.x, this.z, this.target.x, this.target.z) < 0.28) {
        this.state = "sit";
        this.timer = 18 + Math.random() * 35;
        this.target = null;
        this.mesh.position.x = this.seat.position.x;
        this.mesh.position.z = this.seat.position.z;
        this._floorBob(0);
        this.say(pick(["Ahh…", "Gelada!", "Boa mesa"]), 2);
      }
      this._syncInteractable();
      return;
    }

    if (this.state === "serve") {
      if (!this.target || this.timer <= 0) {
        this._detachTray();
        this.state = "idle";
        this._serveJob = null;
        this.timer = 1;
        this._syncInteractable();
        return;
      }
      this._walkToward(dt, agents, world);
      if (dist2(this.x, this.z, this.target.x, this.target.z) < 0.45) {
        this.say("Pronto!", 2);
        this._detachTray();
        this._serveJob?.onArrive?.();
        this._serveJob = null;
        this.state = "idle";
        this.timer = 1.2;
        this.target = null;
      }
      this._syncInteractable();
      return;
    }

    if (this.state === "chat") {
      if (this.partner) this._faceToward(this.partner.x, this.partner.z, dt);
      this._floorBob(Math.sin(performance.now() * 0.004 + this._phase) * 0.012);
      if (this.timer <= 0) {
        const p = this.partner;
        this._endChat();
        if (p && p.partner === this) p._endChat();
      }
      this._syncInteractable();
      return;
    }

    if (this.state === "idle") {
      this._floorBob(Math.sin(performance.now() * 0.0025 + this._phase) * 0.015);
      if (this.timer <= 0) {
        if (
          this.kind === "customer" &&
          this._cooldown <= 0 &&
          Math.random() < 0.35 &&
          this.trySit(world)
        ) {
          this._syncInteractable();
          return;
        }
        if (this._cooldown <= 0 && Math.random() < 0.45) {
          let nearest = null;
          let nearestD = 1.55;
          for (const a of agents) {
            if (a === this || a.state === "chat" || a.state === "sit") continue;
            if (a._cooldown > 0) continue;
            const d = dist2(this.x, this.z, a.x, a.z);
            if (d < nearestD) {
              nearestD = d;
              nearest = a;
            }
          }
          if (nearest) {
            this._beginChat(nearest, 2.8 + Math.random() * 3.2);
            this._syncInteractable();
            return;
          }
        }
        this.target = this._pickWaypoint(agents);
        this.state = "walk";
        this.timer = 8 + Math.random() * 6;
      }
      this._syncInteractable();
      return;
    }

    if (!this.target) {
      this.state = "idle";
      this.timer = 0.5 + Math.random() * 1.5;
      this._syncInteractable();
      return;
    }

    this._walkToward(dt, agents, world);

    if (dist2(this.x, this.z, this.target.x, this.target.z) < 0.18 || this.timer <= 0) {
      this.state = "idle";
      this.timer = 0.8 + Math.random() * 2.2;
      this.target = null;
      this._floorBob(0);
    }

    if (this._cooldown <= 0 && Math.random() < 0.012) {
      for (const a of agents) {
        if (a === this || a.state === "chat" || a.state === "sit" || a._cooldown > 0) continue;
        if (dist2(this.x, this.z, a.x, a.z) < 1.25) {
          this._beginChat(a, 2.5 + Math.random() * 2.5);
          break;
        }
      }
    }

    this._syncInteractable();
  }

  _walkToward(dt, agents, world) {
    if (!this.target) return;
    const dx = this.target.x - this.x;
    const dz = this.target.z - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.001) return;
    const step = Math.min(d, this.speed * dt);
    const pos = new THREE.Vector3(this.x + (dx / d) * step, 0, this.z + (dz / d) * step);
    world.resolveCollision(pos, 0.32);
    for (const a of agents) {
      if (a === this || a.state === "sit") continue;
      const sep = dist2(pos.x, pos.z, a.x, a.z);
      if (sep < 0.55 && sep > 0.001) {
        const push = (0.55 - sep) * 0.5;
        pos.x += ((pos.x - a.x) / sep) * push;
        pos.z += ((pos.z - a.z) / sep) * push;
      }
    }
    this.mesh.position.x = pos.x;
    this.mesh.position.z = pos.z;
    this._floorBob(Math.abs(Math.sin(performance.now() * 0.012 + this._phase)) * 0.04);
    this._faceToward(this.target.x, this.target.z, dt);
  }

  _syncInteractable() {
    if (!this.interactable) return;
    this.interactable.position.x = this.mesh.position.x;
    this.interactable.position.z = this.mesh.position.z;
    this.interactable.position.y = this.mesh.position.y + 1.4;
  }
}
