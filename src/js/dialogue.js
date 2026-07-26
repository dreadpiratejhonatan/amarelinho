export class Dialogue {
  constructor() {
    this.root = document.getElementById("dialogue");
    this.nameEl = document.getElementById("dlg-name");
    this.textEl = document.getElementById("dlg-text");
    this.choicesEl = document.getElementById("dlg-choices");
    this.nextBtn = document.getElementById("dlg-next");
    this.open = false;
    this._onDone = null;

    this._bindActivate(this.nextBtn, () => this._advance());
  }

  /**
   * @param {{ name: string, steps: Array<{ text: string, choices?: Array<{ label: string, next?: object|null, action?: string }> }> }} session
   * @param {(action: string|null) => void} onDone
   */
  start(session, onDone) {
    this.open = true;
    this.root.hidden = false;
    document.body.classList.add("is-dialogue");
    this._session = session;
    this._stepIndex = 0;
    this._onDone = onDone || null;
    this._pendingAction = null;
    this._renderStep();
  }

  close(action = null) {
    this.open = false;
    this.root.hidden = true;
    document.body.classList.remove("is-dialogue");
    this.choicesEl.innerHTML = "";
    this.nextBtn.hidden = true;
    const cb = this._onDone;
    this._onDone = null;
    cb?.(action ?? this._pendingAction);
  }

  /**
   * pointerup sozinho falha em alguns Androids quando um handler capture
   * chamou preventDefault no touchstart. Usa pointerdown + touchend + click.
   */
  _bindActivate(el, fn) {
    if (!el) return;
    let lockUntil = 0;
    const run = (e) => {
      if (e) {
        if (e.button != null && e.button !== 0) return;
        e.preventDefault?.();
        e.stopPropagation?.();
      }
      const now = performance.now();
      if (now < lockUntil) return;
      lockUntil = now + 400;
      fn();
    };
    el.addEventListener("pointerup", run);
    el.addEventListener("click", run);
    el.addEventListener(
      "touchend",
      (e) => {
        // Só o primeiro dedo; evita ghost-click duplicar
        if (e.changedTouches?.length) run(e);
      },
      { passive: false }
    );
  }

  _renderStep() {
    const step = this._session.steps[this._stepIndex];
    if (!step) {
      this.close();
      return;
    }
    this.nameEl.textContent = this._session.name;
    this.textEl.textContent = step.text;
    this.choicesEl.innerHTML = "";
    this.nextBtn.hidden = true;

    if (step.choices?.length) {
      for (const c of step.choices) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dialogue__choice";
        btn.textContent = c.label;
        this._bindActivate(btn, () => {
          if (c.action) this._pendingAction = c.action;
          if (c.next) {
            this._session = {
              name: this._session.name,
              steps: Array.isArray(c.next) ? c.next : [c.next],
            };
            this._stepIndex = 0;
            this._renderStep();
          } else {
            this.close(c.action || null);
          }
        });
        this.choicesEl.appendChild(btn);
      }
    } else {
      this.nextBtn.hidden = false;
    }
  }

  _advance() {
    this._stepIndex += 1;
    if (this._stepIndex >= this._session.steps.length) {
      this.close();
      return;
    }
    this._renderStep();
  }
}
