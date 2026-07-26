/** Controles touch: stick à esquerda, olhar à direita, botão E (tap). */

export function isTouchDevice() {
  const touchPoints = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const fineDesktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (fineDesktop && !coarse) return false;
  return coarse || noHover || (touchPoints && Math.min(window.innerWidth, window.innerHeight) <= 920);
}

export class TouchControls {
  constructor(input) {
    this.input = input;
    this.enabled = false;
    this.lookSens = 1.45;
    this._joyId = null;
    this._lookId = null;
    this._lookLast = null;
    this._lookStart = null;
    this._lookMoved = 0;
    this._lookFromBtn = false;
    this._origin = { x: 0, y: 0 };

    this.root = document.getElementById("touch-controls");
    this.stick = document.getElementById("touch-stick");
    this.knob = document.getElementById("touch-knob");
    this.zoneLook = document.getElementById("touch-look");
    this.btnInteract = document.getElementById("touch-interact");

    if (!this.root) return;

    this.enabled = true;
    this.root.hidden = true;
    document.body.classList.add("is-touch");

    input.analog = { x: 0, y: 0 };
    input.mobile = true;
    input.locked = true;

    this._bindJoystick();
    this._bindLook();
  }

  show() {
    if (!this.root) return;
    this.root.hidden = false;
    this.input.mobile = true;
    this.input.locked = true;
  }

  hide() {
    if (!this.root) return;
    this.root.hidden = true;
  }

  _inStick(clientX, clientY) {
    if (!this.stick) return false;
    const r = this.stick.getBoundingClientRect();
    const pad = 12;
    return (
      clientX >= r.left - pad &&
      clientX <= r.right + pad &&
      clientY >= r.top - pad &&
      clientY <= r.bottom + pad
    );
  }

  _inInteractBtn(clientX, clientY) {
    if (!this.btnInteract) return false;
    const r = this.btnInteract.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  _bindJoystick() {
    const zone = this.stick;
    if (!zone) return;

    const onStart = (e) => {
      const t = e.changedTouches[0];
      this._joyId = t.identifier;
      if (this._lookId === this._joyId) {
        this._lookId = null;
        this._lookLast = null;
      }
      const r = zone.getBoundingClientRect();
      this._origin.x = r.left + r.width / 2;
      this._origin.y = r.top + r.height / 2;
      this._updateStick(t.clientX, t.clientY);
      e.preventDefault();
      e.stopPropagation();
    };
    const onMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._joyId) {
          this._updateStick(t.clientX, t.clientY);
          e.preventDefault();
          break;
        }
      }
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._joyId) {
          this._joyId = null;
          this.input.analog.x = 0;
          this.input.analog.y = 0;
          if (this.knob) this.knob.style.transform = "translate(-50%, -50%)";
          e.preventDefault();
          break;
        }
      }
    };
    zone.addEventListener("touchstart", onStart, { passive: false });
    zone.addEventListener("touchmove", onMove, { passive: false });
    zone.addEventListener("touchend", onEnd, { passive: false });
    zone.addEventListener("touchcancel", onEnd, { passive: false });
  }

  _updateStick(x, y) {
    const dx = x - this._origin.x;
    const dy = y - this._origin.y;
    const max = 62;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, max);
    const nx = (dx / len) * clamped;
    const ny = (dy / len) * clamped;
    this.input.analog.x = nx / max;
    this.input.analog.y = ny / max;
    if (this.knob) {
      this.knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
    }
  }

  /**
   * Olhar na metade direita. Move/end no document (capture) pra não perder
   * o dedo ao arrastar pra direita (borda / botão E).
   * Tap curto no E = interagir; arrastar = olhar.
   */
  _bindLook() {
    const onStart = (e) => {
      if (this.root?.hidden) return;
      for (const t of e.changedTouches) {
        if (t.identifier === this._joyId) continue;
        if (this._inStick(t.clientX, t.clientY)) continue;
        // Metade esquerda livre pro stick / mão esquerda
        if (t.clientX < window.innerWidth * 0.36) continue;

        this._lookId = t.identifier;
        this._lookLast = { x: t.clientX, y: t.clientY };
        this._lookStart = { x: t.clientX, y: t.clientY };
        this._lookMoved = 0;
        this._lookFromBtn = this._inInteractBtn(t.clientX, t.clientY);
        if (this._lookFromBtn) this.btnInteract?.classList.add("is-down");
        e.preventDefault();
        break;
      }
    };

    const onMove = (e) => {
      if (this._lookId == null) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== this._lookId || !this._lookLast) continue;
        const dx = t.clientX - this._lookLast.x;
        const dy = t.clientY - this._lookLast.y;
        this._lookMoved += Math.hypot(dx, dy);
        this.input.lookDX += dx * this.lookSens;
        this.input.lookDY += dy * this.lookSens;
        this._lookLast = { x: t.clientX, y: t.clientY };
        e.preventDefault();
        break;
      }
    };

    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this._lookId) continue;
        // Tap no botão E (sem arrastar de verdade) → interagir
        if (this._lookFromBtn && this._lookMoved < 16) {
          this.input.interactPressed = true;
        }
        this.btnInteract?.classList.remove("is-down");
        this._lookId = null;
        this._lookLast = null;
        this._lookStart = null;
        this._lookFromBtn = false;
        this._lookMoved = 0;
        e.preventDefault();
        break;
      }
    };

    // Capture no document: dedo continua válido até a borda direita
    document.addEventListener("touchstart", onStart, { passive: false, capture: true });
    document.addEventListener("touchmove", onMove, { passive: false, capture: true });
    document.addEventListener("touchend", onEnd, { passive: false, capture: true });
    document.addEventListener("touchcancel", onEnd, { passive: false, capture: true });
  }
}
