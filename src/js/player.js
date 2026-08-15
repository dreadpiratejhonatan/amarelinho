import * as THREE from "three";
import { CONFIG } from "./config.js";
import { getSkin, loadFaceTexture, resolveSkinId } from "./skins.js";

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
    this.cameraMode = "first";
    this.skinId = "miria";
    this.mesh = null;
    this.mats = null;
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this.buildMesh();
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

  applySkin(skinId) {
    const def = getSkin(skinId);
    this.skinId = def.id;
    if (!this.mats) return;
    this.mats.suit.color.setHex(def.suit);
    this.mats.shirt.color.setHex(def.shirt);
    this.mats.skin.color.setHex(def.skin);
    this.mats.tie.color.setHex(def.tie);
    if (this.mats.hair && def.hair != null) this.mats.hair.color.setHex(def.hair);
    const faceMat = this.mats.face;
    if (faceMat && def.face) {
      const token = def.id;
      loadFaceTexture(def.face).then((tex) => {
        if (this.skinId !== token || !tex) return;
        faceMat.map = tex;
        faceMat.color.setHex(0xffffff);
        faceMat.needsUpdate = true;
      });
    }
  }

  setPlayable(playableOrId) {
    const id = typeof playableOrId === "string" ? playableOrId : playableOrId?.id;
    this.applySkin(resolveSkinId(id || this.skinId));
  }

  buildMesh() {
    if (this.mesh) {
      this.world.group.remove(this.mesh);
      this.mesh = null;
    }
    const def = getSkin(this.skinId);
    const female = def.body === "female";

    const suit = new THREE.MeshStandardMaterial({ color: def.suit, roughness: 0.65 });
    const shirt = new THREE.MeshStandardMaterial({ color: def.shirt, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: def.skin, roughness: 0.55 });
    const tie = new THREE.MeshStandardMaterial({ color: def.tie, roughness: 0.7 });
    const hair = new THREE.MeshStandardMaterial({
      color: def.hair ?? 0x2a1810,
      roughness: 0.85,
    });
    const face = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0,
      side: THREE.FrontSide,
    });
    this.mats = { suit, shirt, skin, tie, hair, face };

    this.mesh = new THREE.Group();
    this.mesh.name = "playerAvatar";

    // Proporções femininas: torso mais estreito/baixo, ombros menores
    const torsoTop = female ? 0.14 : 0.17;
    const torsoBot = female ? 0.11 : 0.12;
    const torsoH = female ? 0.68 : 0.72;
    const torsoY = female ? 1.22 : 1.28;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(torsoTop, torsoBot, torsoH, 12), suit);
    torso.position.y = torsoY;

    const shoulderR = female ? 0.06 : 0.075;
    const shoulderX = female ? 0.155 : 0.19;
    const shoulderY = female ? 1.52 : 1.6;
    const shoulderGeo = new THREE.SphereGeometry(shoulderR, 10, 8);
    const leftShoulder = new THREE.Mesh(shoulderGeo, suit);
    leftShoulder.position.set(-shoulderX, shoulderY, 0);
    const rightShoulder = new THREE.Mesh(shoulderGeo, suit);
    rightShoulder.position.set(shoulderX, shoulderY, 0);

    const shirtStrip = new THREE.Mesh(
      new THREE.CylinderGeometry(female ? 0.045 : 0.055, female ? 0.038 : 0.045, female ? 0.52 : 0.6, 8),
      shirt
    );
    shirtStrip.position.set(0, female ? 1.26 : 1.32, 0.12);

    // Accent (laço / detalhe) — sem gravata masculina
    const accent = female
      ? new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), tie)
      : new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.34, 6), tie);
    if (female) {
      accent.position.set(0, 1.48, 0.14);
    } else {
      accent.rotation.x = Math.PI;
      accent.position.set(0, 1.36, 0.16);
    }

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(female ? 0.042 : 0.05, female ? 0.048 : 0.055, 0.12, 8),
      skin
    );
    neck.position.y = female ? 1.58 : 1.68;

    const headScale = female ? 0.26 : 0.28;
    const headY = female ? 1.76 : 1.88;
    const head = new THREE.Mesh(new THREE.BoxGeometry(headScale, headScale * 1.05, headScale), skin);
    head.position.y = headY;

    const facePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(headScale * 0.95, headScale * 1.02),
      face
    );
    facePlane.position.set(0, headY, headScale * 0.54);
    this.facePlane = facePlane;

    // Cabelo longo / médio (só feminino)
    const hairParts = [];
    if (female) {
      const scalp = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), hair);
      scalp.position.set(0, headY + 0.04, -0.02);
      scalp.scale.set(1.05, 0.95, 1.1);
      const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.08), hair);
      bangs.position.set(0, headY + 0.08, 0.12);
      const leftLock = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.55, 8), hair);
      leftLock.position.set(-0.14, headY - 0.22, -0.02);
      const rightLock = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.55, 8), hair);
      rightLock.position.set(0.14, headY - 0.22, -0.02);
      const back = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.5, 10), hair);
      back.position.set(0, headY - 0.18, -0.12);
      hairParts.push(scalp, bangs, leftLock, rightLock, back);
    }

    const legR = female ? 0.055 : 0.07;
    const legH = female ? 0.9 : 0.95;
    const armR = female ? 0.042 : 0.05;
    const armH = female ? 0.92 : 1.0;
    const leftLeg = this._makeLimb(legR, legH, suit, legR * 0.75);
    leftLeg.position.set(female ? -0.075 : -0.09, female ? 0.9 : 0.95, 0);
    const rightLeg = this._makeLimb(legR, legH, suit, legR * 0.75);
    rightLeg.position.set(female ? 0.075 : 0.09, female ? 0.9 : 0.95, 0);
    const leftArm = this._makeLimb(armR, armH, suit, armR * 0.8, skin);
    leftArm.position.set(female ? -0.19 : -0.23, female ? 1.5 : 1.58, 0);
    const rightArm = this._makeLimb(armR, armH, suit, armR * 0.8, skin);
    rightArm.position.set(female ? 0.19 : 0.23, female ? 1.5 : 1.58, 0);

    this.mesh.add(
      torso,
      leftShoulder,
      rightShoulder,
      shirtStrip,
      accent,
      neck,
      head,
      facePlane,
      ...hairParts,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm
    );
    this.mesh.traverse((m) => {
      if (m.isMesh) m.castShadow = true;
    });
    // Mesh feminino um pouco mais baixo no mundo
    if (female) this.mesh.scale.setScalar(0.96);
    this.world.group.add(this.mesh);
    this.applySkin(resolveSkinId(this.skinId));
    this._syncMesh();
  }

  _makeLimb(rTop, h, material, rBottom, tipMat) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 8), material);
    mesh.position.y = -h / 2;
    group.add(mesh);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(rBottom * 1.3, 8, 6), tipMat || material);
    tip.position.y = -h;
    group.add(tip);
    return group;
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
    const sitY = this.sitting ? -0.55 : 0;
    this.mesh.position.set(this.position.x, fy + sitY, this.position.z);
    this.mesh.rotation.y = this.yaw + Math.PI;
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

    const dist = 3.2;
    const height = 1.35;
    const back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const ideal = new THREE.Vector3(
      this.position.x + back.x * dist,
      this._floorY() + height + CONFIG.eyeHeight * 0.15,
      this.position.z + back.z * dist
    );

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
