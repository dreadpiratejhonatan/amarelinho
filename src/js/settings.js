const KEY = "amarelinho_settings_v1";

const DEFAULTS = {
  lookSens: 1.55,
  invertLook: false,
  volume: 0.7,
  music: true,
  seenTutorial: false,
  lang: "pt",
};

export class Settings {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULTS };
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* noop */
    }
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }
}
