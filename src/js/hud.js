import { ACHIEVEMENTS } from "./achievements.js";

export class HUD {
  constructor() {
    this.root = document.getElementById("hud");
    this.prompt = document.getElementById("prompt");
    this.toast = document.getElementById("toast");
    this.objective = document.getElementById("objective");
    this.billEl = document.getElementById("hud-bill");
    this.walletEl = document.getElementById("hud-wallet");
    this.pauseOverlay = document.getElementById("pause");
    this.settingsOverlay = document.getElementById("settings");
    this.summaryOverlay = document.getElementById("summary");
    this.achievementsOverlay = document.getElementById("achievements");
    this.guideEl = document.getElementById("hud-guide");
    this._toastTimer = 0;
  }

  show() {
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
    this.setBill(null);
    this.setGuide(false);
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

  setObjective(text) {
    if (!this.objective) return;
    if (!text) {
      this.objective.hidden = true;
      this.objective.textContent = "";
      return;
    }
    this.objective.hidden = false;
    this.objective.textContent = text;
  }

  setBill(total) {
    if (!this.billEl) return;
    if (total == null || total <= 0) {
      this.billEl.hidden = true;
      this.billEl.textContent = "";
      return;
    }
    this.billEl.hidden = false;
    this.billEl.textContent = `Comanda R$ ${total.toFixed(0)}`;
  }

  setWallet(amount) {
    if (!this.walletEl) return;
    this.walletEl.hidden = false;
    this.walletEl.textContent = `Bolso R$ ${Math.max(0, amount).toFixed(0)}`;
  }

  setGuide(on, text = "→ caixa / mesa") {
    if (!this.guideEl) return;
    this.guideEl.hidden = !on;
    if (on) this.guideEl.textContent = text;
  }

  showToast(text, ms = 2600) {
    this.toast.hidden = false;
    this.toast.textContent = text;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toast.hidden = true;
    }, ms);
  }

  showPause(on) {
    if (!this.pauseOverlay) return;
    this.pauseOverlay.hidden = !on;
  }

  showSettings(on) {
    if (!this.settingsOverlay) return;
    this.settingsOverlay.hidden = !on;
  }

  showAchievements(on, unlocked = {}) {
    if (!this.achievementsOverlay) return;
    this.achievementsOverlay.hidden = !on;
    if (!on) return;
    const body = document.getElementById("achievements-body");
    if (!body) return;
    body.innerHTML = ACHIEVEMENTS.map((a) => {
      const ok = !!unlocked[a.id];
      return `<div class="ach ${ok ? "ach--on" : ""}"><span class="ach__icon">${a.icon}</span><div><strong>${a.name}</strong><p>${a.desc}</p></div></div>`;
    }).join("");
  }

  showSummary(on, summary = null) {
    if (!this.summaryOverlay) return;
    this.summaryOverlay.hidden = !on;
    if (!on || !summary) return;
    const body = document.getElementById("summary-body");
    if (!body) return;
    const lines = [
      `Conversas: ${summary.talked}`,
      `Pedidos: ${summary.ordered}`,
      `Gastou: R$ ${Number(summary.spent || 0).toFixed(0)}`,
      `Bolso: R$ ${Number(summary.wallet || 0).toFixed(0)}`,
      `Gorjetas: ${summary.tips || 0}`,
      `Batidas: ${summary.batidas || 0}/4`,
      summary.elevated ? "Salão elevado: ✓" : "Salão elevado: —",
      summary.allStaff ? "Falou com a casa toda: ✓" : "Ainda falta conhecer alguém",
      `Conquistas: ${summary.achievements || 0}`,
      `Noites no Amarelinho: ${summary.nights}`,
    ];
    if (summary.lines?.length) {
      lines.push("", ...summary.lines);
    }
    body.innerHTML = lines.map((l) => `<p>${l}</p>`).join("");
  }
}
