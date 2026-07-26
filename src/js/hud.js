export class HUD {
  constructor() {
    this.root = document.getElementById("hud");
    this.prompt = document.getElementById("prompt");
    this.toast = document.getElementById("toast");
    this._toastTimer = 0;
  }

  show() {
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  setPrompt(text) {
    if (!text) {
      this.prompt.hidden = true;
      this.prompt.textContent = "";
      return;
    }
    this.prompt.hidden = false;
    this.prompt.textContent = text;
  }

  showToast(text, ms = 2600) {
    this.toast.hidden = false;
    this.toast.textContent = text;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toast.hidden = true;
    }, ms);
  }
}
