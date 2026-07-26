import * as THREE from "three";

/** Waypoints de circulação no bar / calçada / rua. */
export const NPC_WAYPOINTS = {
  interior: [
    [-5.5, -1.5], [-3, -2.2], [-1, -1.8], [1.2, -2.4], [3.2, -1.6],
    [-4, 0.2], [-1.5, 0.4], [0.8, 0.2], [2.8, -0.4], [5.0, -0.8],
    [-2.5, -0.8], [0, -0.5],
    [-4, -4.5], [-1, -5.0], [1.5, -4.8], [-3, -7.0], [0.5, -7.5],
    [-2, -9.5], [1, -9.0], [-1.5, -11.5], [0.5, -11.0],
    [5.5, -8.5], [6.5, -10.5], [-6.5, -9.0], [-6.0, -11.5],
  ],
  sidewalk: [
    [-7, 2.2], [-4, 2.5], [-1.5, 3.0], [1.5, 2.8], [4, 3.0], [6.5, 2.4],
    [-6, 4.2], [-2, 4.5], [2, 4.8], [5.5, 4.2], [-4.5, 5.5], [0.5, 5.2], [4, 5.6],
  ],
  street: [
    [-6, 8.5], [-2, 9.0], [2, 8.8], [5, 9.2], [-4, 11], [0, 10.5], [3.5, 11.2],
  ],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.hypot(dx, dz);
}

/**
 * Agente com vida própria: anda entre pontos, para pra conversar com outro NPC.
 */
export class NpcAgent {
  /**
   * @param {{ mesh: THREE.Object3D, kind: 'waiter'|'customer', zones: string[], speed?: number, interactable?: object|null }} opts
   */
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
    this._phase = Math.random() * Math.PI * 2;
    this._cooldown = 1 + Math.random() * 2;
  }

  get x() {
    return this.mesh.position.x;
  }
  get z() {
    return this.mesh.position.z;
  }

  _setBubble(on) {
    const b = this.mesh.userData.chatBubble;
    if (b) b.visible = !!on;
  }

  _pickWaypoint(agents) {
    const zone = pick(this.zones);
    const list = NPC_WAYPOINTS[zone] || NPC_WAYPOINTS.sidewalk;
    let best = null;
    for (let i = 0; i < 6; i++) {
      const [x, z] = pick(list);
      const jitterX = x + (Math.random() - 0.5) * 0.8;
      const jitterZ = z + (Math.random() - 0.5) * 0.6;
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
    this._setBubble(true);
    other.state = "chat";
    other.partner = this;
    other.timer = duration;
    other.target = null;
    other._setBubble(true);
    other._cooldown = 4 + Math.random() * 4;
    this._cooldown = 4 + Math.random() * 4;
  }

  _endChat() {
    this._setBubble(false);
    this.partner = null;
    this.state = "idle";
    this.timer = 0.3 + Math.random() * 1.2;
  }

  update(dt, agents, world) {
    this._cooldown = Math.max(0, this._cooldown - dt);
    this.timer -= dt;

    if (this.state === "chat") {
      if (this.partner) this._faceToward(this.partner.x, this.partner.z, dt);
      this.mesh.position.y = Math.sin(performance.now() * 0.004 + this._phase) * 0.012;
      if (this.timer <= 0) {
        const p = this.partner;
        this._endChat();
        if (p && p.partner === this) p._endChat();
      }
      this._syncInteractable();
      return;
    }

    if (this.state === "idle") {
      this.mesh.position.y = Math.sin(performance.now() * 0.0025 + this._phase) * 0.015;
      if (this.timer <= 0) {
        // Chance de puxar papo com alguém perto
        if (this._cooldown <= 0 && Math.random() < 0.45) {
          let nearest = null;
          let nearestD = 1.55;
          for (const a of agents) {
            if (a === this || a.state === "chat") continue;
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

    // walk
    if (!this.target) {
      this.state = "idle";
      this.timer = 0.5 + Math.random() * 1.5;
      this._syncInteractable();
      return;
    }

    const dx = this.target.x - this.x;
    const dz = this.target.z - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.18 || this.timer <= 0) {
      this.state = "idle";
      this.timer = 0.8 + Math.random() * 2.2;
      this.target = null;
      this.mesh.position.y = 0;
      this._syncInteractable();
      return;
    }

    const step = Math.min(d, this.speed * dt);
    const nx = this.x + (dx / d) * step;
    const nz = this.z + (dz / d) * step;
    const pos = new THREE.Vector3(nx, 0, nz);
    world.resolveCollision(pos, 0.32);
    // Separação leve entre NPCs
    for (const a of agents) {
      if (a === this) continue;
      const sep = dist2(pos.x, pos.z, a.x, a.z);
      if (sep < 0.55 && sep > 0.001) {
        const push = (0.55 - sep) * 0.5;
        pos.x += ((pos.x - a.x) / sep) * push;
        pos.z += ((pos.z - a.z) / sep) * push;
      }
    }
    this.mesh.position.x = pos.x;
    this.mesh.position.z = pos.z;
    this.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.012 + this._phase)) * 0.04;
    this._faceToward(this.target.x, this.target.z, dt);

    // Encontrou alguém no caminho → papo
    if (this._cooldown <= 0 && Math.random() < 0.012) {
      for (const a of agents) {
        if (a === this || a.state === "chat" || a._cooldown > 0) continue;
        if (dist2(this.x, this.z, a.x, a.z) < 1.25) {
          this._beginChat(a, 2.5 + Math.random() * 2.5);
          break;
        }
      }
    }

    this._syncInteractable();
  }

  _syncInteractable() {
    if (!this.interactable) return;
    this.interactable.position.x = this.mesh.position.x;
    this.interactable.position.z = this.mesh.position.z;
    this.interactable.position.y = 1.4;
  }
}
