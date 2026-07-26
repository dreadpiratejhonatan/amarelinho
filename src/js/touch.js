/** Controles touch: stick à esquerda, olhar à direita, botão E (tap). */

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
  // Desktop clássico (mouse fino, sem toque): WASD/mouse
  if (fineDesktop && !coarse && !touchPoints) return false;
  return coarse || noHover || (touchPoints && narrow) || (narrow && !fineDesktop);
}

/** Elementos de UI onde o look NÃO deve capturar o dedo. */
function isUiTouchTarget(el) {
  if (!el || !(el instanceof Element)) return false;
  // Botão E tem handler próprio — look não deve roubar
  if (el.closest("#touch-interact")) return true;
  return !!el.closest(
    [
      "button",
      "a",
      "input",
      "select",
      "textarea",
      "label",
      "#dialogue",
      "#pause",
      "#settings",
      "#achievements",
      "#summary",
      "#menu",
      ".menu",
      ".pause",
      ".dialogue",
      "#btn-pause",
    ].join(",")
  );
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
    this.lookSens = 1.55;
    this._joyId = null;
    this._lookId = null;
    this._lookLast = null;
    this._lookMoved = 0;
    this._btnPtrId = null;
    this._btnMoved = 0;
    this._btnLast = null;
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
    this._bindInteractButton();
    this._bindLook();
  }

  show() {
    if (!this.root) return;
    // Não reaparece em cima do diálogo / pausa
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
    this._resetLook();
    this._resetStick();
    this._resetBtn();
  }

  _resetStick() {
    this._joyId = null;
    if (this.input.analog) {
      this.input.analog.x = 0;
      this.input.analog.y = 0;
    }
    if (this.knob) this.knob.style.transform = "translate(-50%, -50%)";
  }

  _resetLook() {
    this._lookId = null;
    this._lookLast = null;
    this._lookMoved = 0;
  }

  _resetBtn() {
    this.btnInteract?.classList.remove("is-down");
    this._btnPtrId = null;
    this._btnMoved = 0;
    this._btnLast = null;
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
    if (!this.btnInteract || this.root?.hidden) return false;
    const r = this.btnInteract.getBoundingClientRect();
    // Hit area um pouco maior que o círculo visual
    const pad = 10;
    return (
      clientX >= r.left - pad &&
      clientX <= r.right + pad &&
      clientY >= r.top - pad &&
      clientY <= r.bottom + pad
    );
  }

  _bindJoystick() {
    const zone = this.stick;
    if (!zone) return;

    const pointFromEvent = (e) => {
      if (e.changedTouches?.[0]) {
        const t = e.changedTouches[0];
        return { id: t.identifier, x: t.clientX, y: t.clientY };
      }
      return { id: e.pointerId ?? "mouse", x: e.clientX, y: e.clientY };
    };

    const onStart = (e) => {
      if (this.root?.hidden || overlayBlocksLook()) return;
      const p = pointFromEvent(e);
      this._joyId = p.id;
      if (this._lookId === this._joyId) this._resetLook();
      const r = zone.getBoundingClientRect();
      this._origin.x = r.left + r.width / 2;
      this._origin.y = r.top + r.height / 2;
      this._updateStick(p.x, p.y);
      e.preventDefault();
      e.stopPropagation();
    };
    const onMove = (e) => {
      if (this._joyId == null) return;
      if (e.changedTouches) {
        for (const t of e.changedTouches) {
          if (t.identifier === this._joyId) {
            this._updateStick(t.clientX, t.clientY);
            e.preventDefault();
            break;
          }
        }
        return;
      }
      if ((e.pointerId ?? "mouse") === this._joyId) {
        this._updateStick(e.clientX, e.clientY);
        e.preventDefault();
      }
    };
    const onEnd = (e) => {
      if (this._joyId == null) return;
      let match = false;
      if (e.changedTouches) {
        for (const t of e.changedTouches) {
          if (t.identifier === this._joyId) {
            match = true;
            break;
          }
        }
      } else {
        match = (e.pointerId ?? "mouse") === this._joyId;
      }
      if (!match) return;
      this._resetStick();
      e.preventDefault();
    };

    zone.addEventListener("touchstart", onStart, { passive: false });
    zone.addEventListener("touchmove", onMove, { passive: false });
    zone.addEventListener("touchend", onEnd, { passive: false });
    zone.addEventListener("touchcancel", onEnd, { passive: false });
    // Mouse / pen / DevTools sem touch events reais
    zone.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return; // já coberto por touch*
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
   * Botão E: captura em document por geometria (touch + ponteiro).
   * Touch* cobre celular real / Playwright touchscreen; pointer* cobre mouse/DevTools.
   */
  _bindInteractButton() {
    const btn = this.btnInteract;
    if (!btn) return;

    const TAP_SLOP = 40;

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
      if (this._btnMoved >= TAP_SLOP) {
        this.input.lookDX += dx * this.lookSens;
        this.input.lookDY += dy * this.lookSens;
      }
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
      // Se o diálogo abriu no meio do gesto, só limpa — não engole o toque da UI
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
      if (e.pointerType === "touch") return; // já coberto por touch*
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

  /**
   * Olhar na metade direita. Move/end no document (capture) pra não perder
   * o dedo ao arrastar pra borda. Toques em botões/diálogos/menus são ignorados.
   */
  _bindLook() {
    const onStart = (e) => {
      if (this.root?.hidden) return;
      if (overlayBlocksLook()) return;

      const touches = e.changedTouches
        ? [...e.changedTouches].map((t) => ({
            id: t.identifier,
            x: t.clientX,
            y: t.clientY,
            target: document.elementFromPoint(t.clientX, t.clientY) || e.target,
          }))
        : [
            {
              id: e.pointerId ?? "mouse",
              x: e.clientX,
              y: e.clientY,
              target: e.target,
            },
          ];

      for (const t of touches) {
        if (t.id === this._joyId || t.id === this._btnPtrId) continue;
        if (this._inStick(t.x, t.y)) continue;
        if (this._inInteractBtn(t.x, t.y)) continue;
        if (isUiTouchTarget(t.target)) continue;

        // Metade esquerda livre pro stick / mão esquerda
        if (t.x < window.innerWidth * 0.36) continue;
        // Faixa do topo (pausa / HUD)
        if (t.y < 72) continue;

        this._lookId = t.id;
        this._lookLast = { x: t.x, y: t.y };
        this._lookMoved = 0;
        e.preventDefault();
        break;
      }
    };

    const onMove = (e) => {
      if (this._lookId == null) return;
      if (this.root?.hidden || overlayBlocksLook()) {
        this._resetLook();
        return;
      }
      const points = e.changedTouches
        ? [...e.changedTouches].map((t) => ({ id: t.identifier, x: t.clientX, y: t.clientY }))
        : [{ id: e.pointerId ?? "mouse", x: e.clientX, y: e.clientY }];

      for (const t of points) {
        if (t.id !== this._lookId || !this._lookLast) continue;
        const dx = t.x - this._lookLast.x;
        const dy = t.y - this._lookLast.y;
        this._lookMoved += Math.hypot(dx, dy);
        this.input.lookDX += dx * this.lookSens;
        this.input.lookDY += dy * this.lookSens;
        this._lookLast = { x: t.x, y: t.y };
        e.preventDefault();
        break;
      }
    };

    const onEnd = (e) => {
      if (this._lookId == null) return;
      if (this.root?.hidden || overlayBlocksLook()) {
        this._resetLook();
        return;
      }
      const ids = e.changedTouches
        ? [...e.changedTouches].map((t) => t.identifier)
        : [e.pointerId ?? "mouse"];
      if (!ids.includes(this._lookId)) return;
      this._resetLook();
      e.preventDefault();
    };

    document.addEventListener("touchstart", onStart, { passive: false, capture: true });
    document.addEventListener("touchmove", onMove, { passive: false, capture: true });
    document.addEventListener("touchend", onEnd, { passive: false, capture: true });
    document.addEventListener("touchcancel", onEnd, { passive: false, capture: true });

    // Ponteiro (mouse/pen) só quando controles touch estão ativos — DevTools / hybrid
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType === "touch") return;
        if (this.root?.hidden) return;
        onStart(e);
      },
      { capture: true }
    );
    document.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType === "touch") return;
        onMove(e);
      },
      { capture: true }
    );
    document.addEventListener(
      "pointerup",
      (e) => {
        if (e.pointerType === "touch") return;
        onEnd(e);
      },
      { capture: true }
    );
    document.addEventListener(
      "pointercancel",
      (e) => {
        if (e.pointerType === "touch") return;
        onEnd(e);
      },
      { capture: true }
    );
  }
}
