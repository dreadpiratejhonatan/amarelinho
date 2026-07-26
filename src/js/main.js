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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = isTouchDevice() ? 1.65 : 1.35;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 120);

    this.input = new Input(this.canvas);
    this.hud = new HUD();
    this.dialogue = new Dialogue();
    this.sfx = new Sfx();
    this.world = new World(this.scene);
    this.player = new Player(this.camera, this.world);
    this.touch = isTouchDevice() ? new TouchControls(this.input) : null;

    this.state = "menu";
    this._last = performance.now();
    this._ordered = false;
    /** Desktop: pausa ao sair da aba / perder pointer lock até clicar de novo. */
    this._softPaused = false;

    this.btnPlay.addEventListener("click", () => {
      this.sfx.resume();
      this.sfx.click();
      this.start();
    });
    this.canvas.addEventListener("click", () => {
      if (this.state === "playing" && !this.dialogue.open && !this.input.mobile) {
        this._softPaused = false;
        this.input.clearHeld();
        this.sfx.resume();
        this.input.requestLock();
      }
    });
    this.input.onLockLost = () => {
      if (this.input.mobile) return;
      if (this.state !== "playing" && this.state !== "dialogue") return;
      this._softPaused = true;
      this.input.clearHeld();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.input.clearHeld();
        if (!this.input.mobile && this.state === "playing") this._softPaused = true;
        return;
      }
      // Voltou pra aba: zera dt e teclas; precisa clicar de novo (pointer lock exige gesto)
      this._last = performance.now();
      this.input.clearHeld();
      this.sfx.resume();
      if (!this.input.mobile && this.state === "playing" && !this.dialogue.open) {
        this._softPaused = true;
        this.hud.showToast("Clique na tela para continuar.", 3200);
      }
    });
    window.addEventListener("resize", () => this._onResize());

    // Dialogue choice clicks
    document.getElementById("dlg-choices")?.addEventListener("click", () => this.sfx.click());
    document.getElementById("dlg-next")?.addEventListener("click", () => this.sfx.click());

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  start() {
    this.menu.hidden = true;
    this.menu.setAttribute("aria-hidden", "true");
    this.hud.show();
    this.state = "playing";
    this._softPaused = false;
    this.player.position.set(0.5, CONFIG.eyeHeight, 7.2);
    this.player.yaw = Math.PI;
    this.player.pitch = -0.05;
    this.player.standUp();
    this.input.requestLock();
    this.touch?.show();
    this.sfx.open();
    this.hud.showToast("Boa noite. Anda pela calçada e pela rua — o Amarelinho tá aberto.", 3400);
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

    // Aba em segundo plano: não simula (evita “pulo” e teclas fantasmas)
    if (document.hidden) {
      this.input.clearHeld();
      return;
    }

    if (this.input.consumeEscape()) {
      if (inDialogue) {
        this.dialogue.close();
        this._softPaused = false;
        this.input.requestLock();
      } else if (this.player.sitting) {
        this.player.standUp();
        this.sfx.sit();
        this.hud.showToast("Levantou da mesa.", 1600);
      } else if (!this.input.mobile) {
        this.input.exitLock();
        this._softPaused = true;
      }
    }

    const needsClick = playing && !this.input.mobile && (!this.input.locked || this._softPaused);
    this.hud.setClickHint(needsClick);

    // Mobile: sempre “locked” — sem pointer lock no celular
    if (this.input.mobile) this.input.locked = true;
    if (this.input.locked && !this.input.mobile) this._softPaused = false;

    const canLookMove =
      playing && !this._softPaused && (this.input.locked || this.input.mobile);
    this.player.update(dt, this.input, canLookMove && !this.player.sitting);

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

    for (const w of this.world.waiters) {
      w.mesh.position.y = Math.sin(now * 0.002 + w.position.x) * 0.015;
    }
  }

  _interact(target) {
    if (target.kind === "waiter") {
      this.sfx.open();
      this._talkTo(target.def);
    } else if (target.kind === "seat") {
      this.player.sit(target);
      this.sfx.sit();
      this.hud.showToast("Sentou. Esc ou E para levantar.", 2200);
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
        this._softPaused = false;
        if (action === "order") {
          this._ordered = true;
          this.sfx.order();
          this.hud.showToast("Pedido anotado. A gelada vem aí…", 2800);
        }
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
      carlinhos: "Fechou. Boné pra cima.",
    };
    return map[id] || "Até mais.";
  }

  _orderAtCounter() {
    this.input.exitLock();
    this.state = "dialogue";
    this.dialogue.start(
      {
        name: "Balcão",
        steps: [
          {
            text: this._ordered
              ? "Seu pedido já foi. Quer mais alguma coisa?"
              : "Boa noite. O que vai ser?",
            choices: [
              {
                label: "Uma cerveja bem gelada",
                next: { text: "Saindo! Pode sentar que a gente leva na mesa." },
                action: "beer",
              },
              {
                label: "Porção pra dividir",
                next: { text: "Porção anotada. Vai bem com a conversa da calçada." },
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
        this._softPaused = false;
        if (action) {
          this._ordered = true;
          this.sfx.order();
          const msg = {
            beer: "Cerveja a caminho. Saúde!",
            food: "Porção saindo do fogão.",
            water: "Água servida.",
          }[action];
          if (msg) this.hud.showToast(msg, 2600);
        }
        this.input.requestLock();
      }
    );
  }
}

new Game();
