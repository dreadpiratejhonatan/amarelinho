export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.lookDX = 0;
    this.lookDY = 0;
    this.locked = false;
    this.mobile = false;
    this.analog = { x: 0, y: 0 };
    this.interactPressed = false;
    this.escapePressed = false;

    window.addEventListener("keydown", (e) => {
      const k = e.code;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "Space", "KeyE"].includes(k)) {
        e.preventDefault();
      }
      this.keys.add(k);
      if (k === "KeyE") this.interactPressed = true;
      if (k === "Escape") this.escapePressed = true;
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    document.addEventListener("pointerlockchange", () => {
      if (this.mobile) {
        this.locked = true;
        return;
      }
      this.locked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.lookDX += e.movementX;
      this.lookDY += e.movementY;
    });
  }

  requestLock() {
    if (this.mobile) {
      this.locked = true;
      return;
    }
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock?.();
    }
  }

  exitLock() {
    if (this.mobile) {
      // Keep "locked" on mobile so look/move keep working
      return;
    }
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock?.();
    }
  }

  consumeLook() {
    const dx = this.lookDX;
    const dy = this.lookDY;
    this.lookDX = 0;
    this.lookDY = 0;
    return { dx, dy };
  }

  consumeInteract() {
    const v = this.interactPressed;
    this.interactPressed = false;
    return v;
  }

  consumeEscape() {
    const v = this.escapePressed;
    this.escapePressed = false;
    return v;
  }

  axis() {
    let x = 0;
    let z = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) z -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) z += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.analog) {
      x += this.analog.x;
      z += this.analog.y;
    }
    const len = Math.hypot(x, z);
    if (len < 0.02) return { x: 0, z: 0 };
    return { x: x / len, z: z / len };
  }

  sprinting() {
    if (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) return true;
    // No celular: stick longe do centro = correr
    if (this.mobile && this.analog) {
      return Math.hypot(this.analog.x, this.analog.y) > 0.72;
    }
    return false;
  }
}
