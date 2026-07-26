const KEY = "amarelinho_progress_v1";

const DEFAULT = () => ({
  talked: {},
  sat: false,
  satElevated: false,
  ordered: false,
  metCarlinhos: false,
  nightComplete: false,
});

export class Progress {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return DEFAULT();
      return { ...DEFAULT(), ...JSON.parse(raw) };
    } catch {
      return DEFAULT();
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* private mode */
    }
  }

  markTalked(id) {
    this.data.talked[id] = true;
    if (id === "carlinhos") this.data.metCarlinhos = true;
    this._checkComplete();
    this.save();
  }

  markSat(elevated) {
    this.data.sat = true;
    if (elevated) this.data.satElevated = true;
    this._checkComplete();
    this.save();
  }

  markOrdered() {
    this.data.ordered = true;
    this._checkComplete();
    this.save();
  }

  talkedCount() {
    return Object.keys(this.data.talked).length;
  }

  _checkComplete() {
    if (
      this.data.ordered &&
      this.data.sat &&
      this.talkedCount() >= 1 &&
      this.data.metCarlinhos
    ) {
      this.data.nightComplete = true;
    }
  }

  /** Objetivo atual pra HUD. */
  currentObjective() {
    if (this.data.nightComplete) {
      return "Noite completa — explora à vontade ou volta ao menu";
    }
    if (!this.talkedCount()) {
      return "Missão: cumprimente alguém da casa (E)";
    }
    if (!this.data.metCarlinhos) {
      return "Missão: vá à cozinha e fale com o Carlinhos";
    }
    if (!this.data.ordered) {
      return "Missão: peça no caixa (geladeira / balcão)";
    }
    if (!this.data.sat) {
      return "Missão: sente numa mesa (tente o salão elevado)";
    }
    if (!this.data.satElevated) {
      return "Bônus: suba a escada e sente no piso verde";
    }
    return "Missão: boa noite — você mandou bem";
  }
}
