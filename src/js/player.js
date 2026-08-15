import * as THREE from "three";
import { CONFIG } from "./config.js";
import { buildPlayableMesh, getPlayable } from "./playableChars.js";

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.position = new THREE.Vector3(0.4, CONFIG.eyeHeight, 5.8);
    this.yaw = 0;
    this.pitch = -0.06;
    this.velY = 0;
    this.onGround = true;
    this.sitting = false;
    this.seat = null;
    this.cameraMode = "first"; // first | third
    this.playable = null;
    this.mesh = null;
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();
    this._camOffset = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this._ray = new THREE.Raycaster();
  }

  get eyePosition() {
    return this.position;
  }

  get feetY() {
    return this._floorY();
  }

  _floorY() {
    return this.world.getFloorHeight?.(this.position.x, this.position.z) ?? 0;
  }

  setPlayable(playableOrId) {
    const playable = typeof playableOrId === "string" ? getPlayable(playableOrId) : playableOrId;
    this.playable = playable;
    if (this.mesh) {
      this.world.group.remove(this.mesh);
      this.mesh = null;
    }
    this.mesh = buildPlayableMesh(playable);
    this.mesh.name = "playerAvatar";
    // Esconde bolha de chat do mesh de NPC
    if (this.mesh.userData.chatBubble) this.mesh.userData.chatBubble.visible = false;
    this.world.group.add(this.mesh);
    this._syncMesh();
  }

  toggleCameraMode() {
    this.cameraMode = this.cameraMode === "first" ? "third" : "first";
    this._applyCamera();
    return this.cameraMode;
  }

  standUp() {
    if (!this.sitting) return;
    this.sitting = false;
    if (this.seat) {
      if (this.seat.claimedBy === "player") this.seat.claimedBy = null;
      const away = new THREE.Vector3().subVectors(this.position, this.seat.lookAt);
      away.y = 0;
      if (away.lengthSq() < 0.01) away.set(0, 0, 1);
      away.normalize().multiplyScalar(0.7);
      this.position.copy(this.seat.position).add(away);
      this.position.y = this._floorY() + CONFIG.eyeHeight;
    }
    this.seat = null;
    this._syncMesh();
  }

  sit(seat) {
    this.sitting = true;
    this.seat = seat;
    const fy = this.world.getFloorHeight?.(seat.position.x, seat.position.z) ?? 0;
    this.position.set(seat.position.x, fy + 1.15, seat.position.z);
    const dx = seat.lookAt.x - this.position.x;
    const dz = seat.lookAt.z - this.position.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = -0.12;
    this.velY = 0;
    this._syncMesh();
  }

  update(dt, input, canMove, canLook = canMove, lookOpts = null) {
    const look = input.consumeLook();
    if (canLook || this.sitting) {
      const sens = (lookOpts?.sens ?? 1) * CONFIG.mouseSens;
      const inv = lookOpts?.invert ? -1 : 1;
      this.yaw -= look.dx * sens;
      this.pitch -= look.dy * sens * inv;
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch));
    }

    if (this.sitting || !canMove) {
      this._syncMesh();
      this._applyCamera();
      return;
    }

    this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const axis = input.axis();
    this._wish.set(0, 0, 0);
    this._wish.addScaledVector(this._forward, -axis.z);
    this._wish.addScaledVector(this._right, axis.x);
    if (this._wish.lengthSq() > 0) this._wish.normalize();

    const speed = CONFIG.moveSpeed * (input.sprinting() ? CONFIG.sprintMult : 1);
    this.position.x += this._wish.x * speed * dt;
    this.position.z += this._wish.z * speed * dt;

    const eyeOnFloor = this._floorY() + CONFIG.eyeHeight;

    if (this.onGround && input.keys.has("Space")) {
      this.velY = CONFIG.jumpSpeed;
      this.onGround = false;
    }

    this.velY -= CONFIG.gravity * dt;
    this.position.y += this.velY * dt;
    if (this.position.y <= eyeOnFloor) {
      this.position.y = eyeOnFloor;
      this.velY = 0;
      this.onGround = true;
    }

    this.world.resolveCollision(this.position, CONFIG.playerRadius);
    const fy = this._floorY() + CONFIG.eyeHeight;
    if (this.onGround) this.position.y = fy;
    this._syncMesh();
    this._applyCamera();
  }

  _syncMesh() {
    if (!this.mesh) return;
    const fy = this._floorY();
    const sitY = this.sitting ? 0.35 : 0;
    this.mesh.position.set(this.position.x, fy + sitY, this.position.z);
    this.mesh.rotation.y = this.yaw;
    // 1ª pessoa: esconde corpo (evita ver a própria cabeça)
    this.mesh.visible = this.cameraMode === "third";
  }

  _applyCamera() {
    if (this.cameraMode === "first") {
      this.camera.position.copy(this.position);
      this.camera.rotation.order = "YXZ";
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      return;
    }

    // 3ª pessoa: atrás e acima
    const dist = 3.2;
    const height = 1.35;
    const back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const ideal = new THREE.Vector3(
      this.position.x + back.x * dist,
      this._floorY() + height + CONFIG.eyeHeight * 0.15,
      this.position.z + back.z * dist
    );

    // Ray curto pra não atravessar paredes (usa colliders como AABB simples)
    let camPos = ideal.clone();
    const from = new THREE.Vector3(this.position.x, this._floorY() + 1.4, this.position.z);
    const dir = new THREE.Vector3().subVectors(ideal, from);
    const len = dir.length();
    if (len > 0.01) {
      dir.normalize();
      const hit = this._rayAgainstColliders(from, dir, len);
      if (hit != null) {
        camPos.copy(from).addScaledVector(dir, Math.max(0.45, hit - 0.2));
      }
    }

    this.camera.position.copy(camPos);
    this._lookTarget.set(this.position.x, this._floorY() + 1.35, this.position.z);
    // Pitch ajusta o olhar um pouco
    this._lookTarget.y += -this.pitch * 0.6;
    this.camera.lookAt(this._lookTarget);
  }

  _rayAgainstColliders(origin, dir, maxDist) {
    const cols = this.world.colliders || [];
    let best = null;
    const step = 0.15;
    const probe = new THREE.Vector3();
    for (let d = 0.3; d < maxDist; d += step) {
      probe.copy(origin).addScaledVector(dir, d);
      for (const c of cols) {
        if (
          probe.x >= c.minX &&
          probe.x <= c.maxX &&
          probe.z >= c.minZ &&
          probe.z <= c.maxZ
        ) {
          best = d;
          break;
        }
      }
      if (best != null) break;
    }
    return best;
  }
}
