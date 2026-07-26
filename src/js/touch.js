/** Controles touch: stick à esquerda, olhar à direita, botão E. */

export function isTouchDevice() {
  const touchPoints = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const fineDesktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  // Desktop com mouse fino e sem coarse → teclado/mouse
  if (fineDesktop && !coarse) return false;
  // Celular/tablet: coarse, sem hover, ou tela estreita com touch
  return coarse || noHover || (touchPoints && Math.min(window.innerWidth, window.innerHeight) <= 920);
}

export class TouchControls {
  constructor(input) {
    this.input = input;
    this.enabled = false;
    this.lookSens = 0.28;
    this._joyId = null;
    this._lookId = null;
    this._lookLast = null;
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
    this._bindInteract();
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

  _bindLook() {
    const zone = this.zoneLook;
    if (!zone) return;

    const isUi = (el) =>
      el?.closest?.("#touch-stick, #touch-interact, .touch__stick, .touch__btn");

    zone.addEventListener(
      "touchstart",
      (e) => {
        if (isUi(e.target)) return;
        for (const t of e.changedTouches) {
          if (t.identifier === this._joyId) continue;
          // Só metade direita da tela pra olhar (evita conflito com stick)
          if (t.clientX < window.innerWidth * 0.42) continue;
          this._lookId = t.identifier;
          this._lookLast = { x: t.clientX, y: t.clientY };
          break;
        }
      },
      { passive: true }
    );
    zone.addEventListener(
      "touchmove",
      (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === this._lookId && this._lookLast) {
            const dx = t.clientX - this._lookLast.x;
            const dy = t.clientY - this._lookLast.y;
            this.input.lookDX += dx * this.lookSens;
            this.input.lookDY += dy * this.lookSens;
            this._lookLast = { x: t.clientX, y: t.clientY };
            e.preventDefault();
            break;
          }
        }
      },
      { passive: false }
    );
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._lookId) {
          this._lookId = null;
          this._lookLast = null;
          break;
        }
      }
    };
    zone.addEventListener("touchend", end, { passive: true });
    zone.addEventListener("touchcancel", end, { passive: true });
  }

  _bindInteract() {
    if (!this.btnInteract) return;
    const press = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.interactPressed = true;
      this.btnInteract.classList.add("is-down");
    };
    const up = (e) => {
      e.preventDefault();
      this.btnInteract.classList.remove("is-down");
    };
    this.btnInteract.addEventListener("touchstart", press, { passive: false });
    this.btnInteract.addEventListener("touchend", up, { passive: false });
    this.btnInteract.addEventListener("touchcancel", up, { passive: false });
  }
}
