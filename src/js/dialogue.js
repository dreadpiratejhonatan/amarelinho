export class Dialogue {
  constructor() {
    this.root = document.getElementById("dialogue");
    this.nameEl = document.getElementById("dlg-name");
    this.textEl = document.getElementById("dlg-text");
    this.choicesEl = document.getElementById("dlg-choices");
    this.nextBtn = document.getElementById("dlg-next");
    this.open = false;
    this._onDone = null;

    // pointerup cobre mouse + touch (click sozinho falha se algum handler chamou preventDefault)
    this.nextBtn.addEventListener("pointerup", (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      this._advance();
    });
  }

  /**
   * @param {{ name: string, steps: Array<{ text: string, choices?: Array<{ label: string, next?: object|null, action?: string }> }> }} session
   * @param {(action: string|null) => void} onDone
   */
  start(session, onDone) {
    this.open = true;
    this.root.hidden = false;
    this._session = session;
    this._stepIndex = 0;
    this._onDone = onDone || null;
    this._pendingAction = null;
    this._renderStep();
  }

  close(action = null) {
    this.open = false;
    this.root.hidden = true;
    this.choicesEl.innerHTML = "";
    this.nextBtn.hidden = true;
    const cb = this._onDone;
    this._onDone = null;
    cb?.(action ?? this._pendingAction);
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
        btn.textContent = c.label;
        btn.addEventListener("pointerup", (e) => {
          if (e.button != null && e.button !== 0) return;
          e.preventDefault();
          if (c.action) this._pendingAction = c.action;
          if (c.next) {
            this._session = { name: this._session.name, steps: Array.isArray(c.next) ? c.next : [c.next] };
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
