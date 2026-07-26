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
    this.renderer.toneMappingExposure = isTouchDevice() ? 1.95 : 1.35;

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
    this.progress = new Progress();
    this.world = new World(this.scene);
    this.player = new Player(this.camera, this.world);
    this.touch = isTouchDevice() ? new TouchControls(this.input) : null;

    this.state = "menu";
    this._last = performance.now();
    this._ordered = this.progress.data.ordered;
    this._wasComplete = this.progress.data.nightComplete;

    this.btnPlay.addEventListener("click", () => {
      this.sfx.resume();
      this.sfx.click();
      this.start();
    });
    document.getElementById("btn-pause")?.addEventListener("click", () => {
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

    document.getElementById("dlg-choices")?.addEventListener("click", () => this.sfx.click());
    document.getElementById("dlg-next")?.addEventListener("click", () => this.sfx.click());

    const hint = document.getElementById("hud-hint");
    if (hint && isTouchDevice()) {
      hint.textContent = "Stick · arrasta direita · toque E";
    }

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  start() {
    this.menu.hidden = true;
    this.menu.setAttribute("aria-hidden", "true");
    this.hud.showPause(false);
    this.hud.show();
    this.state = "playing";
    this._ordered = this.progress.data.ordered;
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
    if (this.input.mobile) {
      this.hud.showToast("Stick pra andar · arrasta a direita pra olhar · toque E", 4000);
    } else {
      this.hud.showToast("Boa noite. Siga a missão no canto — o Amarelinho tá aberto.", 3600);
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
      this.hud.showToast("Noite completa no Amarelinho. Saúde!", 4200);
      this.sfx.order();
    }
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
      if (inDialogue) {
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

    const canMove = playing;
    const canLook = playing && (this.input.locked || this.input.mobile);
    this.player.update(dt, this.input, canMove && !this.player.sitting, canLook);

    let target = null;
    if (playing) {
      target = this.world.nearestInteractable(this.player.position);
      if (this.player.sitting) {
        this.hud.setPrompt(this.input.mobile ? "E / botão — levantar" : "Esc ou E — levantar");
      } else if (target) {
        this.hud.setPrompt(`E — ${target.label}`);
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

    if (this.state !== "menu") {
      this.world.updateNpcs(dt);
      this.world.updateTvs(now);
      this.world.updateNight(dt, now);
    }
  }

  _interact(target) {
    if (target.kind === "waiter") {
      this.sfx.open();
      this._talkTo(target.def);
    } else if (target.kind === "seat") {
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

  _talkTo(def) {
    this.input.exitLock();
    this.state = "dialogue";
    const greet = pickLine(def.lines.greet);
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
                label: "Quero pedir uma coisa.",
                next: { text: pickLine(def.lines.order) },
                action: "order",
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
        this.progress.markTalked(def.id);
        if (action === "order") {
          this._ordered = true;
          this.progress.markOrdered();
          this.sfx.order();
          this.hud.showToast("Pedido anotado. A gelada vem aí…", 2800);
        }
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
      val: "Beleza. Tamo aí.",
      ney: "Volta sempre, hein!",
      carlinhos: "Fechou. Volta na chapa quando quiser.",
    };
    return map[id] || "Até mais.";
  }

  _orderAtCounter() {
    this.input.exitLock();
    this.state = "dialogue";
    this.dialogue.start(
      {
        name: "Caixa",
        steps: [
          {
            text: this._ordered
              ? "Seu pedido já foi. Quer mais alguma coisa?"
              : "Boa noite. Aqui é o caixa — o que vai ser?",
            choices: [
              {
                label: "Uma cerveja bem gelada",
                next: { text: "Saindo da geladeira! Pode sentar que a gente leva." },
                action: "beer",
              },
              {
                label: "Porção pra dividir",
                next: { text: "Porção anotada — o Carlinhos cuida na chapa." },
                action: "food",
              },
              {
                label: "Só água por enquanto",
                next: { text: "Água na mesa. Sem pressa." },
                action: "water",
              },
              { label: "Deixa pra lá", next: { text: "Quando quiser, é só chamar." } },
            ],
          },
        ],
      },
      (action) => {
        this.state = "playing";
        if (action) {
          this._ordered = true;
          this.progress.markOrdered();
          this.sfx.order();
          const msg = {
            beer: "Cerveja a caminho. Saúde!",
            food: "Porção saindo do fogão.",
            water: "Água servida.",
          }[action];
          if (msg) this.hud.showToast(msg, 2600);
        }
        this._refreshObjective();
        this.input.requestLock();
      }
    );
  }
}

new Game();
