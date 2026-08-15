/** Controles touch: stick esquerdo anda, stick direito olha, botão E interage. */

export function isTouchDevice() {
  try {
    if (new URLSearchParams(location.search).has("touch")) return true;
  } catch {
    /* ignore */
  }
  const touchPoints = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const fineDesktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const narrow = Math.min(window.innerWidth, window.innerHeight) <= 920;
  if (fineDesktop && !coarse && !touchPoints) return false;
  return coarse || noHover || (touchPoints && narrow) || (narrow && !fineDesktop);
}

function overlayBlocksLook() {
  const ids = ["dialogue", "pause", "settings", "achievements", "summary", "menu"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && !el.hidden) return true;
  }
  return false;
}

export class TouchControls {
  constructor(input) {
    this.input = input;
    this.enabled = false;
    /** Velocidade do stick de olhar (px-equivalente / s no fundo do stick).
     *  A sensibilidade dos Ajustes multiplica depois no player. */
    this.lookStickRate = 900;
    this._joyId = null;
    this._lookJoyId = null;
    this._btnPtrId = null;
    this._btnMoved = 0;
    this._btnLast = null;
    this._origin = { x: 0, y: 0 };
    this._lookOrigin = { x: 0, y: 0 };
    this._lookStick = { x: 0, y: 0 };

    this.root = document.getElementById("touch-controls");
    this.stick = document.getElementById("touch-stick");
    this.knob = document.getElementById("touch-knob");
    this.lookStick = document.getElementById("touch-look-stick");
    this.lookKnob = document.getElementById("touch-look-knob");
    this.btnInteract = document.getElementById("touch-interact");
    this.btnCam = document.getElementById("touch-cam");

    if (!this.root) return;

    this.enabled = true;
    this.root.hidden = true;
    document.body.classList.add("is-touch");

    input.analog = { x: 0, y: 0 };
    input.mobile = true;
    input.locked = true;

    this._bindMoveStick();
    this._bindLookStick();
    this._bindInteractButton();
    this._bindCamButton();
  }

  show() {
    if (!this.root) return;
    if (overlayBlocksLook()) return;
    this.root.hidden = false;
    document.body.classList.remove("touch-hidden");
    this.input.mobile = true;
    this.input.locked = true;
  }

  hide() {
    if (!this.root) return;
    this.root.hidden = true;
    document.body.classList.add("touch-hidden");
    this._resetMoveStick();
    this._resetLookStick();
    this._resetBtn();
    this.setPromptActive(false);
  }

  setPromptActive(on) {
    this.btnInteract?.classList.toggle("is-prompt", !!on);
  }

  /** Aplica o stick de câmera a cada frame (segurar = continuar virando). */
  update(dt) {
    if (!this.enabled || this.root?.hidden || overlayBlocksLook()) return;
    const ax = this._lookStick.x;
    const ay = this._lookStick.y;
    if (Math.abs(ax) < 0.04 && Math.abs(ay) < 0.04) return;
    const rate = this.lookStickRate;
    this.input.lookDX += ax * rate * dt;
    this.input.lookDY += ay * rate * dt;
  }

  _resetMoveStick() {
    this._joyId = null;
    if (this.input.analog) {
      this.input.analog.x = 0;
      this.input.analog.y = 0;
    }
    if (this.knob) this.knob.style.transform = "translate(-50%, -50%)";
  }

  _resetLookStick() {
    this._lookJoyId = null;
    this._lookStick.x = 0;
    this._lookStick.y = 0;
    if (this.lookKnob) this.lookKnob.style.transform = "translate(-50%, -50%)";
  }

  _resetBtn() {
    this.btnInteract?.classList.remove("is-down");
    this._btnPtrId = null;
    this._btnMoved = 0;
    this._btnLast = null;
  }

  _inEl(el, clientX, clientY, pad = 12) {
    if (!el || this.root?.hidden) return false;
    const r = el.getBoundingClientRect();
    return (
      clientX >= r.left - pad &&
      clientX <= r.right + pad &&
      clientY >= r.top - pad &&
      clientY <= r.bottom + pad
    );
  }

  _inInteractBtn(clientX, clientY) {
    return this._inEl(this.btnInteract, clientX, clientY, 10);
  }

  _pointFromEvent(e) {
    if (e.changedTouches?.[0]) {
      const t = e.changedTouches[0];
      return { id: t.identifier, x: t.clientX, y: t.clientY };
    }
    return { id: e.pointerId ?? "mouse", x: e.clientX, y: e.clientY };
  }

  _bindAnalogStick({ zone, getOrigin, onUpdate, onReset, getId, setId }) {
    if (!zone) return;

    const onStart = (e) => {
      if (this.root?.hidden || overlayBlocksLook()) return;
      const p = this._pointFromEvent(e);
      setId(p.id);
      const r = zone.getBoundingClientRect();
      getOrigin().x = r.left + r.width / 2;
      getOrigin().y = r.top + r.height / 2;
      onUpdate(p.x, p.y);
      e.preventDefault();
      e.stopPropagation();
    };
    const onMove = (e) => {
      if (getId() == null) return;
      if (e.changedTouches) {
        for (const t of e.changedTouches) {
          if (t.identifier === getId()) {
            onUpdate(t.clientX, t.clientY);
            e.preventDefault();
            break;
          }
        }
        return;
      }
      if ((e.pointerId ?? "mouse") === getId()) {
        onUpdate(e.clientX, e.clientY);
        e.preventDefault();
      }
    };
    const onEnd = (e) => {
      if (getId() == null) return;
      let match = false;
      if (e.changedTouches) {
        for (const t of e.changedTouches) {
          if (t.identifier === getId()) {
            match = true;
            break;
          }
        }
      } else {
        match = (e.pointerId ?? "mouse") === getId();
      }
      if (!match) return;
      onReset();
      e.preventDefault();
    };

    zone.addEventListener("touchstart", onStart, { passive: false });
    zone.addEventListener("touchmove", onMove, { passive: false });
    zone.addEventListener("touchend", onEnd, { passive: false });
    zone.addEventListener("touchcancel", onEnd, { passive: false });
    zone.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return;
      if (e.button !== 0) return;
      onStart(e);
      zone.setPointerCapture?.(e.pointerId);
    });
    zone.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      onMove(e);
    });
    zone.addEventListener("pointerup", (e) => {
      if (e.pointerType === "touch") return;
      onEnd(e);
    });
    zone.addEventListener("pointercancel", (e) => {
      if (e.pointerType === "touch") return;
      onEnd(e);
    });
  }

  _bindMoveStick() {
    this._bindAnalogStick({
      zone: this.stick,
      getOrigin: () => this._origin,
      getId: () => this._joyId,
      setId: (id) => {
        this._joyId = id;
        if (this._lookJoyId === id) this._resetLookStick();
      },
      onUpdate: (x, y) => this._updateMoveStick(x, y),
      onReset: () => this._resetMoveStick(),
    });
  }

  _bindLookStick() {
    this._bindAnalogStick({
      zone: this.lookStick,
      getOrigin: () => this._lookOrigin,
      getId: () => this._lookJoyId,
      setId: (id) => {
        this._lookJoyId = id;
        if (this._joyId === id) this._resetMoveStick();
      },
      onUpdate: (x, y) => this._updateLookStick(x, y),
      onReset: () => this._resetLookStick(),
    });
  }

  _updateMoveStick(x, y) {
    const dx = x - this._origin.x;
    const dy = y - this._origin.y;
    const max = 72;
    const dead = 10;
    const len = Math.hypot(dx, dy) || 1;
    if (len < dead) {
      this.input.analog.x = 0;
      this.input.analog.y = 0;
      if (this.knob) this.knob.style.transform = "translate(-50%, -50%)";
      return;
    }
    const clamped = Math.min(len, max);
    const nx = (dx / len) * clamped;
    const ny = (dy / len) * clamped;
    this.input.analog.x = nx / max;
    this.input.analog.y = ny / max;
    if (this.knob) {
      this.knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
    }
  }

  _updateLookStick(x, y) {
    const dx = x - this._lookOrigin.x;
    const dy = y - this._lookOrigin.y;
    const max = 62;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, max);
    const nx = (dx / len) * clamped;
    const ny = (dy / len) * clamped;
    this._lookStick.x = nx / max;
    this._lookStick.y = ny / max;
    if (this.lookKnob) {
      this.lookKnob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
    }
  }

  /** Botão E: só tap pra interagir (câmera tem stick próprio). */
  _bindInteractButton() {
    const btn = this.btnInteract;
    if (!btn) return;

    const TAP_SLOP = 28;

    const begin = (id, x, y) => {
      this._btnPtrId = id;
      this._btnMoved = 0;
      this._btnLast = { x, y };
      btn.classList.add("is-down");
    };

    const move = (id, x, y) => {
      if (this._btnPtrId == null || id !== this._btnPtrId || !this._btnLast) return false;
      const dx = x - this._btnLast.x;
      const dy = y - this._btnLast.y;
      this._btnMoved += Math.hypot(dx, dy);
      this._btnLast = { x, y };
      return true;
    };

    const end = (id) => {
      if (this._btnPtrId == null || id !== this._btnPtrId) return false;
      if (this._btnMoved < TAP_SLOP) {
        this.input.interactPressed = true;
      }
      this._resetBtn();
      return true;
    };

    const onTouchStart = (e) => {
      if (this.root?.hidden || overlayBlocksLook()) return;
      for (const t of e.changedTouches) {
        if (!this._inInteractBtn(t.clientX, t.clientY)) continue;
        begin(t.identifier, t.clientX, t.clientY);
        e.preventDefault();
        e.stopPropagation();
        break;
      }
    };
    const onTouchMove = (e) => {
      if (this.root?.hidden || overlayBlocksLook()) return;
      for (const t of e.changedTouches) {
        if (move(t.identifier, t.clientX, t.clientY)) {
          e.preventDefault();
          break;
        }
      }
    };
    const onTouchEnd = (e) => {
      if (this.root?.hidden || overlayBlocksLook()) {
        if (this._btnPtrId != null) this._resetBtn();
        return;
      }
      for (const t of e.changedTouches) {
        if (end(t.identifier)) {
          e.preventDefault();
          e.stopPropagation();
          break;
        }
      }
    };

    const onPointerDown = (e) => {
      if (e.pointerType === "touch") return;
      if (this.root?.hidden || overlayBlocksLook()) return;
      if (e.button != null && e.button !== 0) return;
      if (!this._inInteractBtn(e.clientX, e.clientY)) return;
      begin(e.pointerId ?? "mouse", e.clientX, e.clientY);
      e.preventDefault();
      e.stopPropagation();
    };
    const onPointerMove = (e) => {
      if (e.pointerType === "touch") return;
      if (move(e.pointerId ?? "mouse", e.clientX, e.clientY)) e.preventDefault();
    };
    const onPointerUp = (e) => {
      if (e.pointerType === "touch") return;
      if (end(e.pointerId ?? "mouse")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: false, capture: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    document.addEventListener("touchend", onTouchEnd, { passive: false, capture: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: false, capture: true });
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    document.addEventListener("pointermove", onPointerMove, { capture: true });
    document.addEventListener("pointerup", onPointerUp, { capture: true });
    document.addEventListener("pointercancel", onPointerUp, { capture: true });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  _bindCamButton() {
    const btn = this.btnCam;
    if (!btn) return;
    const fire = (e) => {
      if (this.root?.hidden || overlayBlocksLook()) return;
      e.preventDefault();
      e.stopPropagation();
      this.input.cameraTogglePressed = true;
      btn.classList.add("is-down");
      setTimeout(() => btn.classList.remove("is-down"), 120);
    };
    btn.addEventListener("pointerup", fire);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }
}
