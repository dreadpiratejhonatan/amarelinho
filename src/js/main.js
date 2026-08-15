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
import { ServeProps, buildTray } from "./serveProps.js";
import { CLIENT_CHARS, getWaiterPlayables, getPlayable } from "./playableChars.js";

const STAFF_ITEMS = ["beer", "batida", "torresmo", "soda", "pastel"];

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
    this.serveProps = new ServeProps(this.world);
    this.world._trayBuilder = (itemId) => buildTray(itemId);
    this.player = new Player(this.camera, this.world);
    this.player.setPlayable(this.settings.data.playableId || "cli_juca");
    this.touch = isTouchDevice() ? new TouchControls(this.input) : null;
    this._staffJob = null;
    this._applyQuality();
    this._initCharPicker();

    this.sfx.setVolume(this.settings.data.volume);
    this.sfx.setMusic(this.settings.data.music);

    this.state = "menu";
    this._last = performance.now();
    this._ordered = false;
    this._wasComplete = false;
    this._deliveryTimer = 0;
    this._deliveryPreferId = null;
    this._guideTimer = 0;
    this._lastCallToast = false;
    this._nightEvent = null;
    this._tutorialStep = 0;

    this.world.bindTvEvents((ev) => {
      if (this.state !== "playing" && this.state !== "dialogue") return;
      if (ev.type === "goal") {
        this.sfx.cheer();
        const ama = ev.team === "AMA";
        this.world.cheerCrowd(ama ? 0.92 : 0.45);
        if (ama) this.world.pulseAwning(2.2);
        this.sfx.setMurmurBoost(ama ? 1.6 : 1.15);
        this.hud.showToast(ama ? "GOOL do Amarelinho!" : "Gol dos visitantes…", 2200);
      } else if (ev.type === "almost") {
        this.sfx.almost();
        this.world.cheerCrowd(0.4);
        this.hud.showToast("Quase!", 1400);
      } else if (ev.type === "boo") {
        this.sfx.boo();
        this.hud.showToast("Uhhh…", 1400);
      }
    });
    this.world.onRainChange = (on) => {
      this.sfx.setRain(on);
      if (on && (this.state === "playing" || this.state === "dialogue")) {
        this.hud.showToast("Começou a chover na calçada…", 2400);
      }
    };

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
    const quality = document.getElementById("set-quality");
    if (quality) {
      quality.value = this.settings.data.quality || "auto";
      quality.addEventListener("change", () => {
        this.settings.set("quality", quality.value);
        this._applyQuality();
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
    this._deliveryPreferId = null;
    this._clearStaffJob();
    this.serveProps.clearAll();
    this.world._sessionT = 0;
    this.world.nightPhase = 0;
    this.world._rainSeed = Math.random();
    this._applyQuality();
    this._pickNightEvent();

    const playable = getPlayable(this.settings.data.playableId || "cli_juca");
    this.player.setPlayable(playable);
    this.progress.beginNightAs(playable);
    if (playable.role === "waiter") {
      this.world.setPlayerWaiterId(playable.id);
    } else {
      this.world.setPlayerWaiterId(null);
    }

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
    this.sfx.setRain(false);
    this.sfx.open();
    this._refreshObjective();
    this._refreshMoney();
    this._startTutorial();

    const staff = this.progress.isStaffNight();
    this.hud.showToast(
      this.input.mobile
        ? staff
          ? "Turno: atenda mesas · E anota · V troca câmera"
          : "Stick esquerdo anda · stick direito olha · E pra falar"
        : staff
          ? `Turno de ${playable.name}. Sirva 3 mesas. V — 1ª/3ª.`
          : `Bolso R$ ${this.progress.data.wallet}. V — 1ª/3ª. Siga a missão.`,
      3200
    );
    if (this._nightEventLabel && !staff) {
      setTimeout(() => {
        if (this.state === "playing") this.hud.showToast(this._nightEventLabel, 3800);
      }, 3400);
    }
  }

  _pickNightEvent() {
    const idx = (this.progress.data.nightStoryIndex || 0) % 3;
    const events = [
      {
        id: "derby",
        label: "Noite de derby na TV — mais gols no placar!",
        apply: () => this.world.setGoalBoost(2.2),
      },
      {
        id: "fabin_promo",
        label: "Promoção Fabin: batida especial com desconto de amigo.",
        apply: () => this.world.setGoalBoost(1),
      },
      {
        id: "jukebox_free",
        label: "Jukebox livre — Val já deixou a batida no ar.",
        apply: () => {
          this.world.setGoalBoost(1);
          const name = this.sfx.nextStation();
          this.progress.markJukebox();
          this._nightEventJukebox = name;
        },
      },
    ];
    const ev = events[idx];
    this._nightEvent = ev.id;
    this._nightEventLabel = ev.label;
    ev.apply();
  }

  _resolveQuality() {
    const q = this.settings.data.quality || "auto";
    if (q === "high") return "high";
    if (q === "low") return "low";
    return isTouchDevice() ? "low" : "high";
  }

  _applyQuality() {
    const level = this._resolveQuality();
    this.world.setQuality(level);
    this.renderer.shadowMap.enabled = level === "high" && !isTouchDevice();
    const rainCount = level === "low" ? 180 : 400;
    if (this.world._rain && this.world._rain.drops.length !== rainCount) {
      // density already handled by step in updateNight
    }
    this._qualityLevel = level;
  }

  _startTutorial() {
    if (this.progress.isStaffNight()) {
      this._tutorialStep = 3;
      this._guideTimer = 14;
      this.hud.setGuide(true, "① Clientes sentados pedem — E anota · caixa/cozinha busca · entrega");
      return;
    }
    if (this.settings.data.seenTutorial && this.settings.data.tutorialDone) {
      this._tutorialStep = 3;
      this._guideTimer = 6;
      this.hud.setGuide(true, this.progress.currentObjective());
      return;
    }
    this._tutorialStep = 0;
    this._guideTimer = 16;
    this.hud.setGuide(true, "① Fale com alguém da casa (E)");
    this.settings.set("seenTutorial", true);
  }

  _advanceTutorial() {
    if (this._tutorialStep >= 3) return;
    if (this._tutorialStep === 0 && this.progress.talkedCount() >= 1) {
      this._tutorialStep = 1;
      this._guideTimer = 14;
      this.hud.setGuide(true, "② Vá à cozinha — fale com o Carlinhos");
    }
    if (this._tutorialStep === 1 && this.progress.data.metCarlinhos) {
      this._tutorialStep = 2;
      this._guideTimer = 14;
      this.hud.setGuide(true, "③ Peça no caixa e sente numa mesa");
    }
    if (this._tutorialStep === 2 && this.progress.data.ordered && this.progress.data.sat) {
      this._tutorialStep = 3;
      this.settings.set("tutorialDone", true);
      this._guideTimer = 8;
      this.hud.setGuide(true, "Boa — agora pague a comanda no caixa");
    }
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
    this._clearStaffJob();
    this.world.setPlayerWaiterId(null);
    this.state = "menu";
    this.menu.hidden = false;
    this.menu.setAttribute("aria-hidden", "false");
  }

  _refreshObjective() {
    this._advanceTutorial();
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

    if (playing && this.input.consumeCameraToggle()) {
      const mode = this.player.toggleCameraMode();
      this.hud.showToast(mode === "third" ? "Câmera: 3ª pessoa" : "Câmera: 1ª pessoa", 1400);
    } else {
      this.input.consumeCameraToggle();
    }

    if (this._guideTimer > 0) {
      this._guideTimer -= dt;
      if (this._guideTimer <= 0) this.hud.setGuide(false);
    }

    if (this._deliveryTimer > 0 && playing) {
      this._deliveryTimer -= dt;
      if (this._deliveryTimer <= 0 && this.bill.pendingDelivery) {
        const pending = this.bill.pendingDelivery;
        const seat = this.player.sitting ? this.player.seat : pending.seat;
        const target = seat || this.player.position;
        const deliver = () => {
          this.sfx.glass();
          if (seat) {
            this.serveProps.placeAtSeat(pending.itemId, seat);
            this.hud.showToast("Pedido na mesa. Saúde!", 2800);
          } else {
            this.serveProps.placeAtCounter(pending.itemId);
            this.hud.showToast("Pedido no balcão — senta que eu levo a próxima!", 3000);
          }
          this.bill.pendingDelivery = null;
        };
        const ok = this.world.dispatchServe({
          x: target.x ?? target.position?.x ?? this.player.position.x,
          z: target.z ?? target.position?.z ?? this.player.position.z,
          itemId: pending.itemId,
          preferId: this._deliveryPreferId,
          moodFn: (id) => this.progress.mood(id),
          onArrive: deliver,
        });
        this._deliveryPreferId = null;
        if (!ok) deliver();
      }
    }

    let target = null;
    if (playing) {
      if (this.progress.isStaffNight()) {
        this.world.updateStaffOrders(dt);
        this._updateStaffPrompt();
      } else if (this.player.sitting) {
        this.hud.setPrompt(this.input.mobile ? "Toque no E pra levantar" : "Esc ou E — levantar");
      } else {
        target = this.world.nearestInteractable(this.player.position);
        if (target) {
          this.hud.setPrompt(this.input.mobile ? `Toque no E — ${target.label}` : `E — ${target.label}`);
          this.touch?.setPromptActive(true);
        } else {
          this.hud.setPrompt("");
          this.touch?.setPromptActive(false);
        }
      }
    } else {
      this.hud.setPrompt("");
      this.touch?.setPromptActive(false);
    }

    if (playing && this.input.consumeInteract()) {
      if (this.progress.isStaffNight()) {
        this._staffInteract();
      } else if (this.player.sitting) {
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
        this.sfx.setMurmurBoost(0.7);
        this.hud.showToast("Última chamada… a noite tá acabando.", 3600);
      }
      if (playing) {
        this.sfx.setMurmurBoost(
          this.world.nightPhase > 0.85 ? 0.7 : 1 + this.world.nightPhase * 0.35
        );
      }
    }
  }

  _initCharPicker() {
    const clientsEl = document.getElementById("picker-clients");
    const waitersEl = document.getElementById("picker-waiters");
    const selEl = document.getElementById("picker-sel");
    if (!clientsEl || !waitersEl) return;

    const hex = (n) => `#${(n >>> 0).toString(16).padStart(6, "0")}`;
    const selected = this.settings.data.playableId || "cli_juca";

    const makeCard = (p, color) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "char-picker__card";
      btn.dataset.id = p.id;
      btn.setAttribute("role", "option");
      btn.innerHTML = `<span class="char-picker__swatch" style="background:${hex(color)}"></span><span class="char-picker__name">${p.name}</span><span class="char-picker__blurb">${p.blurb || ""}</span>`;
      if (p.id === selected) btn.classList.add("is-selected");
      btn.addEventListener("click", () => {
        this.settings.set("playableId", p.id);
        clientsEl.querySelectorAll(".char-picker__card").forEach((c) => c.classList.remove("is-selected"));
        waitersEl.querySelectorAll(".char-picker__card").forEach((c) => c.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        if (selEl) {
          selEl.textContent =
            p.role === "waiter" ? `Turno: ${p.name}` : `Cliente: ${p.name}`;
        }
        this.sfx.click();
      });
      return btn;
    };

    for (const c of CLIENT_CHARS) {
      clientsEl.appendChild(makeCard(c, c.shirt || c.skin || 0xc9a000));
    }
    for (const w of getWaiterPlayables()) {
      waitersEl.appendChild(makeCard(w, w.def?.skin || 0xc9a000));
    }
    const cur = getPlayable(selected);
    if (selEl) {
      selEl.textContent =
        cur.role === "waiter" ? `Turno: ${cur.name}` : `Cliente: ${cur.name}`;
    }
  }

  _clearStaffJob() {
    if (this._staffJob?.tray && this.player.mesh) {
      this.player.mesh.remove(this._staffJob.tray);
    }
    this._staffJob = null;
  }

  _attachStaffTray(itemId) {
    if (!this.player.mesh) return;
    if (this._staffJob?.tray) this.player.mesh.remove(this._staffJob.tray);
    const tray = buildTray(itemId);
    this.player.mesh.add(tray);
    if (this._staffJob) this._staffJob.tray = tray;
  }

  _updateStaffPrompt() {
    const job = this._staffJob;
    const pos = this.player.position;
    let prompt = "";
    let active = false;

    if (!job) {
      const hungry = this.world.nearestHungryCustomer(pos);
      if (hungry) {
        prompt = this.input.mobile ? "Toque no E — anotar pedido" : "E — anotar pedido";
        active = true;
      } else {
        const target = this.world.nearestInteractable(pos);
        if (target && target.kind !== "seat") {
          prompt = this.input.mobile ? `Toque no E — ${target.label}` : `E — ${target.label}`;
          active = true;
        } else {
          prompt = this.input.mobile ? "Procure mesas pedindo" : "Procure clientes pedindo (Garçom!)";
        }
      }
    } else if (job.phase === "fetch") {
      if (this.world.inStaffPickupZone(pos)) {
        prompt = this.input.mobile ? "Toque no E — pegar pedido" : "E — pegar no balcão/cozinha";
        active = true;
      } else {
        prompt = "Vá ao caixa ou à cozinha";
      }
    } else if (job.phase === "deliver") {
      const cust = job.customer;
      const d = cust?.mesh ? pos.distanceTo(cust.mesh.position) : 99;
      if (d < 2.6) {
        prompt = this.input.mobile ? "Toque no E — entregar" : "E — entregar pedido";
        active = true;
      } else {
        prompt = "Volte à mesa do cliente";
      }
    }

    this.hud.setPrompt(prompt);
    this.touch?.setPromptActive(active);
  }

  _staffInteract() {
    const pos = this.player.position;
    const job = this._staffJob;

    if (!job) {
      const hungry = this.world.nearestHungryCustomer(pos);
      if (hungry) {
        const itemId = STAFF_ITEMS[Math.floor(Math.random() * STAFF_ITEMS.length)];
        hungry._wantsOrder = false;
        hungry._orderWait = 0;
        hungry.say?.("Pode ser!", 2);
        this._staffJob = { phase: "fetch", customer: hungry, itemId, tray: null };
        this.sfx.click();
        const name = MENU[itemId]?.name || "pedido";
        this.hud.showToast(`Anotado: ${name}. Busca no caixa ou cozinha.`, 2800);
        this._refreshObjective();
        return;
      }
      const target = this.world.nearestInteractable(pos);
      if (target && target.kind !== "seat") {
        this._interact(target);
        return;
      }
      this.hud.showToast("Espere um cliente sentado pedir.", 2000);
      return;
    }

    if (job.phase === "fetch") {
      if (!this.world.inStaffPickupZone(pos)) {
        this.hud.showToast("Vá até o caixa (azul) ou a cozinha.", 2200);
        return;
      }
      this._attachStaffTray(job.itemId);
      job.phase = "deliver";
      this.sfx.glass();
      this.hud.showToast("Pedido na bandeja — leve até a mesa.", 2400);
      return;
    }

    if (job.phase === "deliver") {
      const cust = job.customer;
      if (!cust?.mesh || pos.distanceTo(cust.mesh.position) > 2.6) {
        this.hud.showToast("Chegue mais perto da mesa.", 1800);
        return;
      }
      if (cust.seat) this.serveProps.placeAtSeat(job.itemId, cust.seat);
      cust._servedByPlayer = true;
      cust._wantsOrder = false;
      cust.say?.("Valeu!", 2);
      if (job.tray && this.player.mesh) this.player.mesh.remove(job.tray);
      this._staffJob = null;
      this.sfx.order();
      const tip = 4 + Math.floor(Math.random() * 5);
      this.progress.earn(tip);
      this.progress.markStaffServe(this.progress.data.staffWaiterId);
      this._refreshMoney();
      this._refreshObjective();
      const n = this.progress.data.staffServes || 0;
      this.hud.showToast(
        n >= 3 ? `Turno fechado! Gorjeta R$ ${tip}.` : `Entregue! +R$ ${tip} · ${n}/3`,
        2800
      );
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
    const prefer = this.progress.bestMoodWaiterId();
    const delayFactor = this.progress.serveDelayFactor(prefer);
    let delay = (3.2 + Math.random() * 2) * delayFactor;
    // Humor baixo: chance de “tô ocupado”
    if (prefer && this.progress.serveBusyChance(prefer) > Math.random()) {
      delay += 2.5 + Math.random() * 2;
      this.hud.showToast("Garçom ocupado… segura aí.", 2200);
    } else if (prefer && this.progress.mood(prefer) >= 2) {
      this.hud.showToast(`Pedido anotado — ${prefer} tá de boa, vem rápido.`, 2400);
    }
    this._deliveryPreferId = prefer;
    this._deliveryTimer = delay;
    this._refreshMoney();
    this._refreshObjective();
    this.hud.showToast(`${def.emoji} ${def.name} — R$ ${def.price}`, 2600);
  }

  _menuChoices(includeFood = true) {
    const ids = MENU_ORDER.filter((id) => includeFood || MENU[id].cat !== "food");
    return ids.slice(0, 10).map((id) => {
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
    const choices = [
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
    ];

    if (def.beat && !this.progress.hasBeat(def.id)) {
      const need = def.beat.needMood || 0;
      if (mood >= need) {
        choices.splice(2, 0, this._beatChoice(def));
      } else if (need > 0) {
        choices.splice(2, 0, {
          label: `${def.beat.label} (precisa de gorjeta)`,
          next: {
            text:
              def.id === "toninho"
                ? "Nem pensa. Gorjeta primeiro — aí a gente conversa de sorriso."
                : "Ainda não. Melhora o clima com a gente primeiro.",
          },
        });
      }
    } else if (def.beat && this.progress.hasBeat(def.id)) {
      choices.splice(2, 0, {
        label: "(já ouvi essa história)",
        next: { text: "Você já conhece esse lado da casa. Bom sinal." },
      });
    }

    // Evento "promoção Fabin": oferece o beat logo no greet se ainda não feito
    if (this._nightEvent === "fabin_promo" && def.id === "fabin" && !this.progress.hasBeat("fabin")) {
      const already = choices.some((c) => c.label === def.beat.label);
      if (!already) choices.splice(1, 0, this._beatChoice(def));
    }

    choices.push({
      label: "Só passando pra cumprimentar.",
      next: { text: this._byeLine(def.id) },
    });

    this.dialogue.start(
      {
        name: def.name,
        steps: [{ text: greet, choices }],
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
        } else if (action?.startsWith("beat:")) {
          this._resolveBeatAction(def, action);
        } else if (action && MENU[action]) {
          this._addOrder(action);
        }
        this._refreshObjective();
        this.input.requestLock();
      }
    );
  }

  _beatChoice(def) {
    const b = def.beat;
    const id = def.id;

    if (id === "toninho") {
      return {
        label: b.label,
        next: {
          text: b.steps.open,
          choices: [
            {
              label: "Dar gorjeta (R$ 5) e insistir",
              action: "beat:toninho:tip",
              next: { text: b.steps.tipPath },
            },
            {
              label: "Insistir sem gorjeta",
              action: "beat:toninho:force",
              next: { text: b.steps.rare },
            },
            {
              label: "Deixa quieto",
              next: { text: "…melhor." },
            },
          ],
        },
      };
    }

    if (id === "fabin") {
      return {
        label: b.label,
        next: {
          text: b.steps.open,
          choices: [
            {
              label: `Topar batida especial (R$ ${b.giftPrice})`,
              action: "beat:fabin:accept",
              next: { text: b.steps.accept },
            },
            {
              label: "Recusar com educação",
              action: "beat:fabin:refuse",
              next: { text: b.steps.refuse },
            },
          ],
        },
      };
    }

    if (id === "oliveira") {
      return {
        label: b.label,
        next: {
          text: b.steps.open,
          choices: [
            {
              label: "Conta tudo",
              next: {
                text: b.steps.mid,
                choices: [
                  {
                    label: "E aí?",
                    action: "beat:oliveira:done",
                    next: { text: b.steps.end },
                  },
                ],
              },
            },
            {
              label: "Outra hora",
              next: { text: "Quando quiser, meu filho. O causo não vai embora." },
            },
          ],
        },
      };
    }

    if (id === "val") {
      return {
        label: b.label,
        next: {
          text: b.steps.open,
          choices: [
            {
              label: "Manda ver no cabo",
              action: "beat:val:fix",
              next: { text: b.steps.fixed },
            },
            {
              label: "Deixa quieto",
              next: { text: "Beleza. Se engasgar de novo, me chama." },
            },
          ],
        },
      };
    }

    if (id === "ney") {
      return {
        label: b.label,
        next: {
          text: b.steps.open,
          choices: [
            {
              label: "Quero saber mais",
              next: {
                text: b.steps.mid,
                choices: [
                  {
                    label: "Vou falar com o Zé",
                    action: "beat:ney:done",
                    next: { text: b.steps.end },
                  },
                ],
              },
            },
          ],
        },
      };
    }

    if (id === "carlinhos") {
      return {
        label: b.label,
        next: {
          text: b.steps.open,
          choices: [
            {
              label: "Torresmo (R$ 32)",
              action: "beat:carlinhos:torresmo",
              next: { text: b.steps.torresmo },
            },
            {
              label: "Bolinho de bacalhau (R$ 28)",
              action: "beat:carlinhos:bolinho",
              next: { text: b.steps.bolinho },
            },
            {
              label: "Deixa pra lá",
              next: { text: "Boné firme. Volta quando a fome apertar." },
            },
          ],
        },
      };
    }

    return {
      label: b.label,
      next: { text: "…" },
    };
  }

  _resolveBeatAction(def, action) {
    const parts = action.split(":");
    const kind = parts[2];
    if (def.id === "toninho") {
      if (kind === "tip") {
        const ok = this.progress.tip("toninho", 5);
        if (!ok) {
          this.hud.showToast(this.i18n.t("noMoney"), 2200);
          return;
        }
        this.sfx.coin();
        this._refreshMoney();
      }
      this.progress.markBeat("toninho");
      this.hud.showToast("Toninho quase sorriu…", 2600);
      return;
    }
    if (def.id === "fabin") {
      this.progress.markBeat("fabin");
      if (kind === "accept") {
        const price = def.beat.giftPrice || 12;
        if (!this.progress.canAfford(this.bill.total() + price)) {
          this.hud.showToast(this.i18n.t("noMoney"), 2200);
          return;
        }
        // Pedido com preço promocional: adiciona item e ajusta
        const defItem = this.bill.add("batida_especial");
        if (defItem) {
          // Corrige preço na última linha
          const last = this.bill.items[this.bill.items.length - 1];
          last.price = price;
          this._ordered = true;
          this.progress.markOrdered("batida_especial", price);
          this.sfx.order();
          this.bill.pendingDelivery = {
            itemId: "batida_especial",
            seat: this.player.seat,
            eta: 4,
          };
          this._deliveryTimer = (3.2 + Math.random() * 2) * this.progress.serveDelayFactor("fabin");
          this._deliveryPreferId = "fabin";
          this._refreshMoney();
          this.hud.showToast(`🍹 Promoção — R$ ${price}`, 2600);
        }
      } else {
        this.hud.showToast("Fabin entendeu. Oferta de pé.", 2200);
      }
      return;
    }
    if (def.id === "oliveira") {
      this.progress.markBeat("oliveira");
      this.hud.showToast("Causo da calçada ouvido.", 2400);
      return;
    }
    if (def.id === "val") {
      this.progress.markBeat("val");
      const name = this.sfx.nextStation();
      this.progress.markJukebox();
      const m = this.progress.data.waiterMood.val || 0;
      this.progress.data.waiterMood.val = Math.min(3, m + 1);
      this.progress.save();
      this.progress._syncAchievements();
      this.hud.showToast(`Val no cabo · Jukebox: ${name}`, 2800);
      return;
    }
    if (def.id === "ney") {
      this.progress.markBeat("ney");
      this.progress.markNeyHint();
      this.hud.showToast("Ney falou do Seu Zé — vai na calçada.", 3000);
      this._guideTimer = 8;
      this.hud.setGuide(true, "→ Seu Zé na calçada");
      return;
    }
    if (def.id === "carlinhos") {
      const itemId = kind === "bolinho" ? "bolinho" : "torresmo";
      if (!this._canOrder(itemId)) {
        this.hud.showToast(this.i18n.t("noMoney"), 2200);
        return;
      }
      this.progress.markBeat("carlinhos");
      this._addOrder(itemId);
      this.hud.showToast("Segredo da chapa anotado.", 2400);
    }
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
            this.serveProps.clearTable(true);
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
