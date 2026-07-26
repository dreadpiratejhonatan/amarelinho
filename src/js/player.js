import * as THREE from "three";
import { CONFIG } from "./config.js";

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
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();
  }

  get eyePosition() {
    return this.position;
  }

  _floorY() {
    return this.world.getFloorHeight?.(this.position.x, this.position.z) ?? 0;
  }

  standUp() {
    if (!this.sitting) return;
    this.sitting = false;
    if (this.seat) {
      const away = new THREE.Vector3().subVectors(this.position, this.seat.lookAt);
      away.y = 0;
      if (away.lengthSq() < 0.01) away.set(0, 0, 1);
      away.normalize().multiplyScalar(0.7);
      this.position.copy(this.seat.position).add(away);
      this.position.y = this._floorY() + CONFIG.eyeHeight;
    }
    this.seat = null;
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
  }

  update(dt, input, canMove, canLook = canMove) {
    const look = input.consumeLook();
    if (canLook || this.sitting) {
      this.yaw -= look.dx * CONFIG.mouseSens;
      this.pitch -= look.dy * CONFIG.mouseSens;
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch));
    }

    if (this.sitting || !canMove) {
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
    // Reaplica altura após colisão (pode ter mudado de zona)
    const fy = this._floorY() + CONFIG.eyeHeight;
    if (this.onGround) this.position.y = fy;
    this._applyCamera();
  }

  _applyCamera() {
    this.camera.position.copy(this.position);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }
}
