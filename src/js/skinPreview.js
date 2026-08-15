import * as THREE from "three";
import { getSkin, loadFaceTexture } from "./skins.js";

/** Preview 3D do personagem no picker — arraste para girar. */
export class SkinPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    this.camera.position.set(0, 1.35, 3.2);

    const hemi = new THREE.HemisphereLight(0xffe8a0, 0x3a2810, 1.05);
    const key = new THREE.DirectionalLight(0xfff0c8, 1.1);
    key.position.set(2.2, 4, 3);
    this.scene.add(hemi, key);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.yaw = 0.35;
    this.pitch = 0.08;
    this._drag = false;
    this._lastX = 0;
    this._lastY = 0;
    this._raf = 0;
    this._alive = true;
    this.mats = null;

    this._onDown = (e) => {
      this._drag = true;
      const p = e.touches ? e.touches[0] : e;
      this._lastX = p.clientX;
      this._lastY = p.clientY;
      e.preventDefault();
    };
    this._onMove = (e) => {
      if (!this._drag) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - this._lastX;
      const dy = p.clientY - this._lastY;
      this._lastX = p.clientX;
      this._lastY = p.clientY;
      this.yaw += dx * 0.01;
      this.pitch = Math.max(-0.4, Math.min(0.55, this.pitch + dy * 0.008));
      e.preventDefault();
    };
    this._onUp = () => {
      this._drag = false;
    };

    canvas.addEventListener("pointerdown", this._onDown);
    window.addEventListener("pointermove", this._onMove);
    window.addEventListener("pointerup", this._onUp);
    canvas.addEventListener("touchstart", this._onDown, { passive: false });
    window.addEventListener("touchmove", this._onMove, { passive: false });
    window.addEventListener("touchend", this._onUp);

    this.buildDummy();
    this.resize();
    this.loop();
  }

  buildDummy() {
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    const suit = new THREE.MeshStandardMaterial({ color: 0x6b3a5a, roughness: 0.65 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xc9a0b8, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe8c4a0, roughness: 0.55 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.85 });
    const face = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      side: THREE.FrontSide,
    });
    this.mats = { suit, shirt, skin, hair, face };

    const body = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.68, 12), suit);
    torso.position.y = 1.22;
    const shirtStrip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.5, 8), shirt);
    shirtStrip.position.set(0, 1.26, 0.12);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.12, 8), skin);
    neck.position.y = 1.58;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), skin);
    head.position.y = 1.76;
    const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.27), face);
    facePlane.position.set(0, 1.76, 0.14);
    const scalp = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), hair);
    scalp.position.set(0, 1.8, -0.02);
    const leftLock = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.5, 8), hair);
    leftLock.position.set(-0.14, 1.55, -0.02);
    const rightLock = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.5, 8), hair);
    rightLock.position.set(0.14, 1.55, -0.02);
    body.add(torso, shirtStrip, neck, head, facePlane, scalp, leftLock, rightLock);
    body.scale.setScalar(0.96);
    this.root.add(body);
  }

  async setSkin(skinId) {
    const def = getSkin(skinId);
    if (!def || !this.mats) return;
    this.mats.suit.color.setHex(def.suit);
    this.mats.shirt.color.setHex(def.shirt);
    this.mats.skin.color.setHex(def.skin);
    if (this.mats.hair && def.hair != null) this.mats.hair.color.setHex(def.hair);
    const tex = await loadFaceTexture(def.face);
    if (!tex) return;
    this.mats.face.map = tex;
    this.mats.face.color.setHex(0xffffff);
    this.mats.face.needsUpdate = true;
  }

  resize() {
    const w = this.canvas.clientWidth || 280;
    const h = this.canvas.clientHeight || 280;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  loop = () => {
    if (!this._alive) return;
    this._raf = requestAnimationFrame(this.loop);
    if (!this._drag) this.yaw += 0.004;
    const r = 3.15;
    const cy = 1.35 + Math.sin(this.pitch) * 0.35;
    this.camera.position.set(
      Math.sin(this.yaw) * r * Math.cos(this.pitch),
      cy,
      Math.cos(this.yaw) * r * Math.cos(this.pitch)
    );
    this.camera.lookAt(0, 1.45, 0);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this._alive = false;
    cancelAnimationFrame(this._raf);
    this.canvas.removeEventListener("pointerdown", this._onDown);
    window.removeEventListener("pointermove", this._onMove);
    window.removeEventListener("pointerup", this._onUp);
    this.canvas.removeEventListener("touchstart", this._onDown);
    window.removeEventListener("touchmove", this._onMove);
    window.removeEventListener("touchend", this._onUp);
    this.renderer.dispose();
  }
}
