const STR = {
  pt: {
    play: "Entrar no bar",
    paused: "Pausado",
    resume: "Continuar",
    settings: "Ajustes",
    menu: "Voltar ao menu",
    achievements: "Conquistas",
    share: "Compartilhar noite",
    photo: "Foto da noite",
    suggest: "Mandar um pitaco",
    suggestMenu: "Mandar um pitaco",
    lang: "Idioma",
    wallet: "Bolso",
    bill: "Comanda",
    nightDone: "Noite completa",
    tip: "Dar gorjeta R$ 5",
    tipOk: "Gorjeta anotada. Valeu!",
    noMoney: "Sem grana no bolso pra isso.",
    payOk: (n) => `Comanda paga — R$ ${n}. Saúde!`,
    jukebox: "Jukebox",
    jukeboxToggle: "Trocar estação",
    regular: "Seu Zé",
  },
  en: {
    play: "Enter the bar",
    paused: "Paused",
    resume: "Continue",
    settings: "Settings",
    menu: "Back to menu",
    achievements: "Achievements",
    share: "Share night",
    photo: "Night photo",
    suggest: "Send a tip",
    suggestMenu: "Send a tip",
    lang: "Language",
    wallet: "Cash",
    bill: "Tab",
    nightDone: "Night complete",
    tip: "Tip R$ 5",
    tipOk: "Tip noted. Thanks!",
    noMoney: "Not enough cash for that.",
    payOk: (n) => `Tab paid — R$ ${n}. Cheers!`,
    jukebox: "Jukebox",
    jukeboxToggle: "Change station",
    regular: "Old Zé",
  },
};

export class I18n {
  constructor(lang = "pt") {
    this.lang = lang === "en" ? "en" : "pt";
  }

  set(lang) {
    this.lang = lang === "en" ? "en" : "pt";
  }

  t(key, ...args) {
    const v = STR[this.lang][key] ?? STR.pt[key] ?? key;
    return typeof v === "function" ? v(...args) : v;
  }
}
