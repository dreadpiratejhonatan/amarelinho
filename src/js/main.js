import * as THREE from "three";
import { CONFIG } from "./config.js";
import { Input } from "./input.js";
import { HUD } from "./hud.js";
import { World } from "./world.js";
import { Player } from "./player.js";
import { Dialogue } from "./dialogue.js";
import { pickLine } from "./npcs.js";
import { Sfx } from "./sfx.js";
import { TouchControls, isTouchDevice } from "./touch.js";
import { Progress } from "./progress.js";
import { Settings } from "./settings.js";
import { Bill, MENU, MENU_ORDER, menuChoice, isBrazilLunch } from "./menu.js";
import { I18n } from "./i18n.js";
import { LAYOUT, floorHeightAt } from "./layout.js";

class Game {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.menu = document.getElementById("menu");
    this.btnPlay = document.getElementById("btn-play");

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouchDevice() ? 1.5 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = !isTouchDevice();
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._exposureBase = isTouchDevice() ? 1.95 : 1.35;
    this.renderer.toneMappingExposure = this._exposureBase;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      isTouchDevice() ? 78 : 70,
      window.innerWidth / window.innerHeight,
      0.05,
      120
    );

    this.input = new Input(this.canvas);
    this.hud = new HUD();
    this.dialogue = new Dialogue();
    this.sfx = new Sfx();
    this.settings = new Settings();
    this.i18n = new I18n(this.settings.data.lang);
    this.progress = new Progress();
    this.bill = new Bill();
    this.world = new World(this.scene);
    this.player = new Player(this.camera, this.world);
    this.touch = isTouchDevice() ? new TouchControls(this.input) : null;

    this.sfx.setVolume(this.settings.data.volume);
    this.sfx.setMusic(this.settings.data.music);

    this.state = "menu";
    this._last = performance.now();
    this._ordered = false;
    this._wasComplete = false;
    this._deliveryTimer = 0;
    this._guideTimer = 0;
    this._lastCallToast = false;

    this.world.bindTvEvents((ev) => {
      if (this.state !== "playing" && this.state !== "dialogue") return;
      if (ev.type === "goal") {
        this.sfx.cheer();
        this.world.cheerCrowd();
        this.hud.showToast(ev.team === "AMA" ? "GOOL do Amarelinho!" : "Gol dos visitantes…", 2200);
      } else if (ev.type === "almost") {
        this.sfx.almost();
        this.world.cheerCrowd();
        this.hud.showToast("Quase!", 1400);
      } else if (ev.type === "boo") {
        this.sfx.boo();
        this.hud.showToast("Uhhh…", 1400);
      }
    });

    this.btnPlay.addEventListener("click", () => {
      this.sfx.resume();
      this.sfx.click();
      this.start();
    });
    document.getElementById("btn-pause")?.addEventListener("pointerup", (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      this.sfx.click();
      this.pause();
    });
    document.getElementById("btn-resume")?.addEventListener("click", () => {
      this.sfx.click();
      this.resume();
    });
    document.getElementById("btn-menu")?.addEventListener("click", () => {
      this.sfx.click();
      this.returnToMenu();
    });
    document.getElementById("btn-settings")?.addEventListener("click", () => {
      this.sfx.click();
      this._openSettings();
    });
    document.getElementById("btn-settings-close")?.addEventListener("click", () => {
      this.sfx.click();
      this._closeSettings();
    });
    document.getElementById("btn-achievements")?.addEventListener("click", () => {
      this.sfx.click();
      this.hud.showAchievements(true, this.progress.data.achievements);
    });
    document.getElementById("btn-achievements-close")?.addEventListener("click", () => {
      this.sfx.click();
      this.hud.showAchievements(false);
    });
    document.getElementById("btn-photo")?.addEventListener("click", () => {
      this.sfx.click();
      this._takePhoto();
    });
    document.getElementById("btn-share")?.addEventListener("click", () => {
      this.sfx.click();
      this._shareNight();
    });
    document.getElementById("btn-summary-close")?.addEventListener("click", () => {
      this.sfx.click();
      this.hud.showSummary(false);
      if (this.state === "summary") {
        this.state = "playing";
        this.input.requestLock();
        this.touch?.show();
        this.sfx.startAmbience();
      }
    });
    document.getElementById("btn-summary-share")?.addEventListener("click", () => {
      this.sfx.click();
      this._shareNight();
    });

    this._wireSettingsControls();
    this._applyI18n();

    const tryRelock = (e) => {
      if (e.button != null && e.button !== 0) return;
      if (this.state !== "playing" || this.dialogue.open || this.input.mobile) return;
      this.sfx.resume();
      this.input.requestLock();
    };
    window.addEventListener("pointerdown", tryRelock, true);
    this.input.onLockLost = () => {
      this.input.clearHeld();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.input.clearHeld();
        this.sfx.stopAmbience();
        if (this.state === "playing") this.pause(true);
        return;
      }
      this._last = performance.now();
      this.input.clearHeld();
      this.sfx.resume();
    });
    window.addEventListener("resize", () => this._onResize());

    document.getElementById("dlg-choices")?.addEventListener("pointerup", () => this.sfx.click());
    document.getElementById("dlg-next")?.addEventListener("pointerup", () => this.sfx.click());

    const hint = document.getElementById("hud-hint");
    if (hint && isTouchDevice()) {
      hint.textContent = "Stick esq. anda · stick dir. olha · E fala";
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _applyI18n() {
    const t = (k) => this.i18n.t(k);
    const set = (id, key) => {
      const el = document.getElementById(id);
      if (el) el.textContent = t(key);
    };
    set("btn-play", "play");
    set("btn-resume", "resume");
    set("btn-settings", "settings");
    set("btn-menu", "menu");
    set("btn-achievements", "achievements");
    set("btn-share", "share");
    set("btn-photo", "photo");
    set("btn-suggest", "suggest");
    set("btn-suggest-menu", "suggestMenu");
  }

  _wireSettingsControls() {
    const sens = document.getElementById("set-sens");
    const vol = document.getElementById("set-vol");
    const inv = document.getElementById("set-invert");
    const music = document.getElementById("set-music");
    const lang = document.getElementById("set-lang");
    if (sens) {
      sens.value = String(this.settings.data.lookSens);
      sens.addEventListener("input", () => this.settings.set("lookSens", Number(sens.value)));
    }
    if (vol) {
      vol.value = String(this.settings.data.volume);
      vol.addEventListener("input", () => {
        const v = Number(vol.value);
        this.settings.set("volume", v);
        this.sfx.setVolume(v);
      });
    }
    if (inv) {
      inv.checked = !!this.settings.data.invertLook;
      inv.addEventListener("change", () => this.settings.set("invertLook", inv.checked));
    }
    if (music) {
      music.checked = !!this.settings.data.music;
      music.addEventListener("change", () => {
        this.settings.set("music", music.checked);
        this.sfx.setMusic(music.checked);
      });
    }
    if (lang) {
      lang.value = this.settings.data.lang || "pt";
      lang.addEventListener("change", () => {
        this.settings.set("lang", lang.value);
        this.i18n.set(lang.value);
        this._applyI18n();
      });
    }
  }

  _openSettings() {
    this.hud.showSettings(true);
    if (this.state === "playing") this.pause(true);
  }

  _closeSettings() {
    this.hud.showSettings(false);
  }

  async _shareNight() {
    const text = this.progress.shareText();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Amarelinho", text });
        this.hud.showToast("Compartilhado!", 1800);
      } else {
        await navigator.clipboard?.writeText(text);
        this.hud.showToast("Texto copiado!", 1800);
      }
    } catch {
      /* cancel */
    }
  }

  _takePhoto() {
    try {
      const url = this.canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `amarelinho-noite-${Date.now()}.png`;
      a.click();
      this.progress.markPhoto();
      this.hud.showToast("Foto salva — lembrança da noite!", 2600);
    } catch {
      this.hud.showToast("Não deu pra tirar foto neste browser.", 2200);
    }
  }

  start() {
    this.progress.resetNightSession();
    this.bill = new Bill();
    this._ordered = false;
    this._wasComplete = false;
    this._lastCallToast = false;
    this.world._sessionT = 0;
    this.world.nightPhase = 0;

    this.menu.hidden = true;
    this.menu.setAttribute("aria-hidden", "true");
    this.hud.showPause(false);
    this.hud.showSummary(false);
    this.hud.showSettings(false);
    this.hud.showAchievements(false);
    this.hud.show();
    this.state = "playing";
    this.player.position.set(-0.5, CONFIG.eyeHeight, 4.5);
    this.player.yaw = 0;
    this.player.pitch = -0.06;
    this.player.standUp();
    this.input.requestLock();
    this.touch?.show();
    this.sfx.resume();
    this.sfx.startAmbience();
    this.sfx.open();
    this._refreshObjective();
    this._refreshMoney();

    if (!this.settings.data.seenTutorial) {
      this._guideTimer = 14;
      this.hud.setGuide(true, "→ Fale · peça · sente · pague (veja o bolso)");
      this.settings.set("seenTutorial", true);
    } else {
      this._guideTimer = 6;
      this.hud.setGuide(true, this.progress.currentObjective());
    }

    this.hud.showToast(
      this.input.mobile
        ? "Stick esquerdo anda · stick direito olha · E pra falar"
        : `Bolso R$ ${this.progress.data.wallet}. Siga a missão.`,
      3600
    );
  }

  pause(silent = false) {
    if (this.state !== "playing" && this.state !== "dialogue") return;
    if (this.dialogue.open) this.dialogue.close();
    this.state = "paused";
    this.input.exitLock();
    this.input.clearHeld();
    this.sfx.stopAmbience();
    this.hud.showPause(true);
    this.touch?.hide();
    if (!silent) this.hud.showToast("Pausado", 1200);
  }

  resume() {
    if (this.state !== "paused") return;
    this.hud.showPause(false);
    this.hud.showSettings(false);
    this.hud.showAchievements(false);
    this.state = "playing";
    this.touch?.show();
    this.sfx.resume();
    this.sfx.startAmbience();
    this.input.requestLock();
    this._last = performance.now();
    this._refreshObjective();
  }

  returnToMenu() {
    this.hud.showPause(false);
    this.hud.showSettings(false);
    this.hud.showSummary(false);
    this.hud.showAchievements(false);
    this.hud.hide();
    this.hud.setPrompt("");
    this.hud.setObjective("");
    this.touch?.hide();
    this.sfx.stopAmbience();
    this.input.exitLock();
    this.input.clearHeld();
    this.player.standUp();
    this.state = "menu";
    this.menu.hidden = false;
    this.menu.setAttribute("aria-hidden", "false");
  }

  _refreshObjective() {
    this.hud.setObjective(this.progress.currentObjective());
    if (this.progress.data.nightComplete && !this._wasComplete) {
      this._wasComplete = true;
      this._showNightSummary();
    }
  }

  _refreshMoney() {
    this.hud.setWallet(this.progress.data.wallet);
    this.hud.setBill(this.bill.count() && !this.bill.paid ? this.bill.total() : null);
  }

  _showNightSummary() {
    this.sfx.order();
    this.input.exitLock();
    this.touch?.hide();
    this.sfx.stopAmbience();
    this.state = "summary";
    this.hud.showSummary(
      true,
      this.progress.nightSummary({
        billTotal: this.progress.data.bestNightSpent,
        billLines: this.bill.summaryLines(),
        wallet: this.progress.data.wallet,
      })
    );
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _loop(now) {
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this._update(dt, now);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }

  _update(dt, now) {
    const inDialogue = this.dialogue.open;
    const playing = this.state === "playing" && !inDialogue;

    if (document.hidden) {
      this.input.clearHeld();
      return;
    }

    if (this.input.consumeEscape()) {
      if (this.hud.achievementsOverlay && !this.hud.achievementsOverlay.hidden) {
        this.hud.showAchievements(false);
      } else if (this.hud.settingsOverlay && !this.hud.settingsOverlay.hidden) {
        this._closeSettings();
      } else if (inDialogue) {
        this.dialogue.close();
        this.input.requestLock();
      } else if (this.state === "paused") {
        this.resume();
      } else if (this.player.sitting) {
        this.player.standUp();
        this.sfx.sit();
        this.hud.showToast("Levantou da mesa.", 1600);
      } else if (this.state === "playing") {
        this.pause();
      }
    }

    if (this.input.mobile) this.input.locked = true;

    const lookOpts = {
      sens: this.settings.data.lookSens,
      invert: this.settings.data.invertLook,
    };
    const canMove = playing;
    const canLook = playing && (this.input.locked || this.input.mobile);
    if (canLook || this.player.sitting) this.touch?.update?.(dt);
    this.player.update(dt, this.input, canMove && !this.player.sitting, canLook, lookOpts);

    if (this._guideTimer > 0) {
      this._guideTimer -= dt;
      if (this._guideTimer <= 0) this.hud.setGuide(false);
    }

    if (this._deliveryTimer > 0 && playing) {
      this._deliveryTimer -= dt;
      if (this._deliveryTimer <= 0 && this.bill.pendingDelivery) {
        const seat = this.player.sitting ? this.player.seat : this.bill.pendingDelivery.seat;
        const target = seat || this.player.position;
        const ok = this.world.dispatchServe({
          x: target.x ?? target.position?.x ?? this.player.position.x,
          z: target.z ?? target.position?.z ?? this.player.position.z,
          onArrive: () => {
            this.sfx.glass();
            this.hud.showToast("Pedido na mesa. Saúde!", 2800);
            this.bill.pendingDelivery = null;
          },
        });
        if (!ok) {
          this.sfx.glass();
          this.hud.showToast("Pedido chegou. Saúde!", 2400);
          this.bill.pendingDelivery = null;
        }
      }
    }

    let target = null;
    if (playing) {
      target = this.world.nearestInteractable(this.player.position);
      if (this.player.sitting) {
        this.hud.setPrompt(this.input.mobile ? "Toque no E pra levantar" : "Esc ou E — levantar");
      } else if (target) {
        this.hud.setPrompt(this.input.mobile ? `Toque no E — ${target.label}` : `E — ${target.label}`);
      } else {
        this.hud.setPrompt("");
      }
    } else {
      this.hud.setPrompt("");
    }

    if (playing && this.input.consumeInteract()) {
      if (this.player.sitting) {
        this.player.standUp();
        this.sfx.sit();
        this.hud.showToast("Levantou da mesa.", 1600);
      } else if (target) {
        this._interact(target);
      }
    } else {
      this.input.consumeInteract();
    }

    if (this.state !== "menu" && this.state !== "summary") {
      this.world.updateNpcs(dt, this.player.position);
      this.world.updateTvs(now);
      const exp = this.world.updateNight(dt, now, this._exposureBase);
      if (typeof exp === "number") this.renderer.toneMappingExposure = exp;
      if (this.world.nightPhase > 0.85 && !this._lastCallToast && playing) {
        this._lastCallToast = true;
        this.hud.showToast("Última chamada… a noite tá acabando.", 3600);
      }
    }
  }

  _interact(target) {
    if (target.kind === "waiter") {
      this.sfx.open();
      this._talkTo(target.def);
    } else if (target.kind === "regular") {
      this.sfx.open();
      this._talkToRegular(target.def);
    } else if (target.kind === "jukebox") {
      this.sfx.click();
      const name = this.sfx.nextStation();
      this.progress.markJukebox();
      this.hud.showToast(`Jukebox: ${name}`, 2400);
    } else if (target.kind === "seat") {
      if (target.claimedBy) {
        this.hud.showToast("Essa cadeira tá ocupada.", 1600);
        return;
      }
      target.claimedBy = "player";
      this.player.sit(target);
      this.sfx.sit();
      const elevated = floorHeightAt(target.position.x, target.position.z) >= LAYOUT.green.height * 0.5;
      this.progress.markSat(elevated);
      this._refreshObjective();
      this.hud.showToast(
        elevated ? "Sentou no salão elevado. Boa vista." : "Sentou. Esc ou E para levantar.",
        2200
      );
    } else if (target.kind === "counter") {
      this.sfx.open();
      this._orderAtCounter();
    }
  }

  _canOrder(itemId) {
    const def = MENU[itemId];
    if (!def) return false;
    const need = this.bill.total() + def.price;
    return this.progress.data.wallet >= need;
  }

  _addOrder(itemId) {
    if (!this._canOrder(itemId)) {
      this.hud.showToast(this.i18n.t("noMoney"), 2400);
      return;
    }
    const def = this.bill.add(itemId);
    if (!def) return;
    this._ordered = true;
    this.progress.markOrdered(itemId, def.price);
    this.sfx.order();
    this.bill.pendingDelivery = { itemId, seat: this.player.seat, eta: 4 };
    const delay = (3.2 + Math.random() * 2) * this.progress.serveDelayFactor();
    this._deliveryTimer = delay;
    this._refreshMoney();
    this._refreshObjective();
    this.hud.showToast(`${def.emoji} ${def.name} — R$ ${def.price}`, 2600);
  }

  _menuChoices(includeFood = true) {
    const ids = MENU_ORDER.filter((id) => includeFood || MENU[id].cat !== "food");
    return ids.slice(0, 8).map((id) => {
      const c = menuChoice(id, {
        next: { text: `${MENU[id].emoji} Anotado — R$ ${MENU[id].price}.` },
      });
      return c;
    });
  }

  /** Pedido com o Val: pode escolher o que quiser — sempre vem gelo e limão. */
  _valOrderChoices() {
    const glass = MENU.gelo_limao;
    const lunch = isBrazilLunch();
    const asGeloLimao = (label, nextText, angry = false) => ({
      label,
      action: angry ? "val_gelo_puto" : "gelo_limao",
      next: { text: nextText },
    });
    return [
      asGeloLimao(
        `${MENU.beer.emoji} ${MENU.beer.name}`,
        `Cerveja? Olha… ${glass.emoji} copo com gelo e limão. R$ ${glass.price}. É o que tem.`
      ),
      asGeloLimao(
        `${MENU.batida.emoji} ${MENU.batida.name}`,
        `Batida? Sonha. ${glass.emoji} Gelo e limão saindo. R$ ${glass.price}.`
      ),
      asGeloLimao(
        `${MENU.water.emoji} ${MENU.water.name}`,
        `Água? Quase. ${glass.emoji} Copo com gelo e limão. R$ ${glass.price}.`
      ),
      asGeloLimao(
        "🧊 Copo só com gelo",
        lunch
          ? "Na HORA DO ALMOÇO tu pede copo SÓ com gelo?! Tá de sacanagem? Vai gelo E limão e acaba essa conversa."
          : "Só gelo? Aqui é gelo E limão, irmão. Sem discussão.",
        lunch
      ),
      asGeloLimao(
        `${glass.emoji} ${glass.name} — R$ ${glass.price}`,
        `${glass.emoji} Fechado. Gelo e limão, como tem que ser. R$ ${glass.price}.`
      ),
      { label: "Deixa pra lá", next: { text: "Quando quiser o copo, é só chamar." } },
    ];
  }

  _talkTo(def) {
    this.input.exitLock();
    this.state = "dialogue";
    this.hud.setPrompt("");
    this.touch?.hide();
    const mood = this.progress.mood(def.id);
    const greet =
      mood >= 2
        ? pickLine(def.lines.tipThanks || def.lines.greet) + " (você é gente boa)"
        : pickLine(def.lines.greet);
    const story = pickLine(def.lines.story || def.lines.chat);
    const orderNext =
      def.id === "val"
        ? {
            text: pickLine(def.lines.order),
            choices: this._valOrderChoices(),
          }
        : {
            text: pickLine(def.lines.order),
            choices: [
              ...this._menuChoices(def.id === "carlinhos"),
              { label: "Deixa pra lá", next: { text: "Quando quiser, é só chamar." } },
            ],
          };
    this.dialogue.start(
      {
        name: def.name,
        steps: [
          {
            text: greet,
            choices: [
              {
                label: "E aí, tudo bem?",
                next: { text: pickLine(def.lines.chat) },
              },
              {
                label: "Me conta uma história",
                next: { text: story },
              },
              {
                label: "Quero pedir uma coisa.",
                next: orderNext,
              },
              {
                label: this.i18n.t("tip"),
                next: {
                  text: pickLine(def.lines.tipThanks || ["Valeu."]),
                },
                action: `tip:${def.id}`,
              },
              {
                label: "Só passando pra cumprimentar.",
                next: { text: this._byeLine(def.id) },
              },
            ],
          },
        ],
      },
      (action) => {
        this.state = "playing";
        this.touch?.show();
        this.progress.markTalked(def.id);
        if (action?.startsWith("tip:")) {
          const ok = this.progress.tip(def.id, 5);
          this.hud.showToast(ok ? this.i18n.t("tipOk") : this.i18n.t("noMoney"), 2200);
          if (ok) this.sfx.coin();
          this._refreshMoney();
        } else if (action === "val_gelo_puto") {
          this.progress.annoy("val");
          this.hud.showToast("Val ficou puto no almoço… mas o copo vem igual.", 2800);
          this._addOrder("gelo_limao");
        } else if (action && MENU[action]) {
          this._addOrder(action);
        }
        this._refreshObjective();
        this.input.requestLock();
      }
    );
  }

  _talkToRegular(def) {
    this.input.exitLock();
    this.state = "dialogue";
    this.hud.setPrompt("");
    this.touch?.hide();
    const idx = (this.progress.data.nightStoryIndex || 0) % def.stories.length;
    const story = def.stories[idx];
    this.dialogue.start(
      {
        name: def.name,
        steps: [
          {
            text: pickLine(def.lines.greet),
            choices: [
              {
                label: "Conta o causo de hoje",
                next: { text: story },
              },
              {
                label: "Como tá a noite?",
                next: { text: pickLine(def.lines.chat) },
              },
              {
                label: "Valeu, Zé",
                next: { text: "Volta sempre. A cadeira é tua." },
              },
            ],
          },
        ],
      },
      () => {
        this.state = "playing";
        this.touch?.show();
        this.progress.markTalked("ze");
        this._refreshObjective();
        this.input.requestLock();
      }
    );
  }

  _byeLine(id) {
    const map = {
      toninho: "Hm. Ok.",
      fabin: "Qualquer coisa é só chamar, campeão!",
      oliveira: "Vai com Deus, meu filho.",
      val: "Beleza. Qualquer coisa: gelo e limão.",
      ney: "Volta sempre, hein!",
      carlinhos: "Fechou. Volta na chapa quando quiser.",
    };
    return map[id] || "Até mais.";
  }

  _orderAtCounter() {
    this.input.exitLock();
    this.state = "dialogue";
    this.hud.setPrompt("");
    this.touch?.hide();
    const total = this.bill.total();
    const unpaid = this.bill.count() > 0 && !this.bill.paid;
    const choices = this._menuChoices(true).map((c) => ({
      ...c,
      next: { text: `${MENU[c.action].emoji} Saindo — R$ ${MENU[c.action].price}.` },
    }));
    if (unpaid) {
      const canPay = this.progress.canAfford(total);
      choices.push({
        label: canPay ? `Pagar comanda — R$ ${total}` : `Pagar R$ ${total} (falta grana)`,
        next: {
          text: canPay
            ? `Fechado: R$ ${total}. Valeu, volta sempre!`
            : "Sem grana no bolso pra fechar essa conta…",
        },
        action: canPay ? "pay" : null,
      });
    }
    choices.push({ label: "Deixa pra lá", next: { text: "Quando quiser, é só chamar." } });

    this.dialogue.start(
      {
        name: "Caixa",
        steps: [
          {
            text: unpaid
              ? `Bolso R$ ${this.progress.data.wallet}. Comanda R$ ${total}. O que vai ser?`
              : `Bolso R$ ${this.progress.data.wallet}. O que vai ser?`,
            choices,
          },
        ],
      },
      (action) => {
        this.state = "playing";
        this.touch?.show();
        if (action === "pay") {
          const ok = this.progress.markPaid(total);
          if (ok) {
            this.bill.clear();
            this.sfx.coin();
            this.hud.showToast(this.i18n.t("payOk", total), 3200);
          } else {
            this.hud.showToast(this.i18n.t("noMoney"), 2400);
          }
          this._refreshMoney();
        } else if (action && MENU[action]) {
          this._addOrder(action);
        }
        this._refreshObjective();
        this.input.requestLock();
      }
    );
  }
}

new Game();
