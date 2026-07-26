import { evaluateAchievements } from "./achievements.js";

const KEY = "amarelinho_progress_v2";
const LEGACY = "amarelinho_progress_v1";

const START_WALLET = 150;

const DEFAULT = () => ({
  talked: {},
  sat: false,
  satElevated: false,
  ordered: false,
  paid: false,
  metCarlinhos: false,
  nightComplete: false,
  drinksOrdered: 0,
  totalSpent: 0,
  nightsFinished: 0,
  wallet: START_WALLET,
  tipsGiven: 0,
  waiterMood: {},
  tasted: {},
  metRegular: false,
  usedJukebox: false,
  tookPhoto: false,
  bigRound: false,
  allStaffEver: false,
  achievements: {},
  bestNightSpent: 0,
  totalRounds: 0,
  nightStoryIndex: 0,
});

export class Progress {
  constructor() {
    this.data = this._load();
    this._syncAchievements();
  }

  _load() {
    try {
      let raw = localStorage.getItem(KEY);
      if (!raw) {
        const old = localStorage.getItem(LEGACY);
        if (old) {
          const parsed = JSON.parse(old);
          return { ...DEFAULT(), ...parsed, wallet: START_WALLET };
        }
        return DEFAULT();
      }
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

  _syncAchievements() {
    this.data.achievements = evaluateAchievements(this.data);
    this.save();
  }

  canAfford(price) {
    return this.data.wallet >= price;
  }

  spend(amount) {
    if (amount <= 0) return true;
    if (this.data.wallet < amount) return false;
    this.data.wallet -= amount;
    this.data.totalSpent += amount;
    this.save();
    return true;
  }

  tip(waiterId, amount = 5) {
    if (!this.spend(amount)) return false;
    this.data.tipsGiven += 1;
    const m = this.data.waiterMood[waiterId] || 0;
    this.data.waiterMood[waiterId] = Math.min(3, m + 1);
    this._syncAchievements();
    return true;
  }

  mood(waiterId) {
    return this.data.waiterMood[waiterId] || 0;
  }

  serveDelayFactor() {
    const moods = Object.values(this.data.waiterMood);
    if (!moods.length) return 1;
    const avg = moods.reduce((a, b) => a + b, 0) / moods.length;
    return Math.max(0.55, 1 - avg * 0.12);
  }

  markTalked(id) {
    this.data.talked[id] = true;
    if (id === "carlinhos") this.data.metCarlinhos = true;
    if (id === "ze") this.data.metRegular = true;
    if (this.allWaitersTalked()) this.data.allStaffEver = true;
    this._checkComplete();
    this._syncAchievements();
  }

  markSat(elevated) {
    this.data.sat = true;
    if (elevated) this.data.satElevated = true;
    this._checkComplete();
    this._syncAchievements();
  }

  markOrdered(itemId, price = 0) {
    this.data.ordered = true;
    this.data.drinksOrdered += 1;
    if (itemId) this.data.tasted[itemId] = true;
    this._checkComplete();
    this._syncAchievements();
  }

  markPaid(total) {
    if (!this.spend(total)) return false;
    this.data.paid = true;
    this.data.totalRounds += 1;
    if (total >= 80) this.data.bigRound = true;
    this.data.bestNightSpent = Math.max(this.data.bestNightSpent, total);
    this._checkComplete();
    this._syncAchievements();
    return true;
  }

  markJukebox() {
    this.data.usedJukebox = true;
    this._syncAchievements();
  }

  markPhoto() {
    this.data.tookPhoto = true;
    this._syncAchievements();
  }

  resetNightSession() {
    // Nova sessão de jogo: carteira recarrega um pouco se estiver baixa
    if (this.data.wallet < 40) this.data.wallet = Math.max(this.data.wallet, 80);
    this.data.talked = {};
    this.data.sat = false;
    this.data.ordered = false;
    this.data.paid = false;
    this.data.metCarlinhos = false;
    this.data.nightComplete = false;
    this.data.nightStoryIndex = (this.data.nightStoryIndex || 0) + 1;
    this.save();
  }

  talkedCount() {
    return Object.keys(this.data.talked).filter((id) => id !== "ze").length;
  }

  allWaitersTalked() {
    const ids = ["toninho", "fabin", "oliveira", "val", "ney", "carlinhos"];
    return ids.every((id) => this.data.talked[id]);
  }

  batidasCount() {
    const ids = ["batida", "batida_limao", "batida_maracuja", "batida_especial"];
    return ids.filter((id) => this.data.tasted[id]).length;
  }

  _checkComplete() {
    if (
      this.data.ordered &&
      this.data.sat &&
      this.talkedCount() >= 1 &&
      this.data.metCarlinhos &&
      this.data.paid
    ) {
      if (!this.data.nightComplete) {
        this.data.nightComplete = true;
        this.data.nightsFinished += 1;
      }
    }
  }

  currentObjective() {
    if (this.data.nightComplete) {
      if (this.batidasCount() < 4) return "Bônus: prove as 4 batidas do cardápio";
      if (!this.allWaitersTalked()) return "Bônus: converse com todos os garçons";
      if (!this.data.metRegular) return "Bônus: ouça o causo do Seu Zé";
      return "Noite completa — explora ou volta ao menu";
    }
    if (!this.talkedCount()) return "Missão: cumprimente alguém da casa (E)";
    if (!this.data.metCarlinhos) return "Missão: vá à cozinha e fale com o Carlinhos";
    if (!this.data.ordered) return "Missão: peça no caixa (veja o bolso!)";
    if (!this.data.sat) return "Missão: sente numa mesa e espere o pedido";
    if (!this.data.paid) return "Missão: pague a comanda no caixa";
    if (!this.data.satElevated) return "Bônus: sente no salão elevado (piso verde)";
    return "Missão: boa noite — você mandou bem";
  }

  nightSummary({ billTotal, billLines, wallet }) {
    return {
      talked: this.talkedCount(),
      allStaff: this.allWaitersTalked(),
      ordered: this.data.drinksOrdered,
      spent: billTotal ?? this.data.totalSpent,
      lines: billLines || [],
      elevated: this.data.satElevated,
      nights: this.data.nightsFinished,
      wallet: wallet ?? this.data.wallet,
      tips: this.data.tipsGiven,
      batidas: this.batidasCount(),
      achievements: Object.keys(this.data.achievements || {}).length,
    };
  }

  shareText() {
    return (
      `Noite no Amarelinho 🍺\n` +
      `${this.data.nightsFinished} noite(s) · R$ ${this.data.totalSpent} gastos\n` +
      `${Object.keys(this.data.achievements || {}).length} conquistas\n` +
      `https://jhonatanribeiro.com/amarelinho/`
    );
  }
}
