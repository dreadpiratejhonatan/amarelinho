import * as THREE from "three";

/** Tela de TV com partida de futebol procedural (pixel art animada). */
export function createFootballTv(w = 1.35, h = 0.78) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 144;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;

  const frame = new THREE.Group();
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.55, metalness: 0.2 })
  );
  frame.add(bezel);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  screen.position.z = 0.04;
  frame.add(screen);

  const state = {
    ball: { x: 128, y: 72, vx: 1.2 + Math.random(), vy: (Math.random() - 0.5) * 1.4 },
    home: Array.from({ length: 5 }, () => ({
      x: 40 + Math.random() * 60,
      y: 30 + Math.random() * 84,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
    })),
    away: Array.from({ length: 5 }, () => ({
      x: 150 + Math.random() * 60,
      y: 30 + Math.random() * 84,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
    })),
    scoreH: Math.floor(Math.random() * 3),
    scoreA: Math.floor(Math.random() * 3),
    clock: 0,
    cheerUntil: 0,
    banner: "",
    bannerUntil: 0,
    goalBoost: 1,
  };

  let onEvent = null;

  function bounce(p, minX, maxX, minY, maxY) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < minX || p.x > maxX) p.vx *= -1;
    if (p.y < minY || p.y > maxY) p.vy *= -1;
    p.x = Math.max(minX, Math.min(maxX, p.x));
    p.y = Math.max(minY, Math.min(maxY, p.y));
  }

  function emit(type, team) {
    onEvent?.({ type, team, scoreH: state.scoreH, scoreA: state.scoreA });
  }

  function draw(t) {
    state.clock += 1;
    const cheering = state.clock < state.cheerUntil;

    ctx.fillStyle = cheering ? "#245a20" : "#1a6b2a";
    ctx.fillRect(0, 0, 256, 144);
    ctx.fillStyle = cheering ? "#2f9a40" : "#228b3a";
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(i * 32, 0, 16, 144);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 240, 128);
    ctx.beginPath();
    ctx.moveTo(128, 8);
    ctx.lineTo(128, 136);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(128, 72, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(8, 44, 18, 56);
    ctx.strokeRect(230, 44, 18, 56);

    for (const p of state.home) bounce(p, 16, 120, 16, 128);
    for (const p of state.away) bounce(p, 136, 240, 16, 128);
    bounce(state.ball, 12, 244, 12, 132);

    if (state.clock % 40 === 0) {
      const all = [...state.home, ...state.away];
      const near = all.reduce((a, b) =>
        Math.hypot(a.x - state.ball.x, a.y - state.ball.y) <
        Math.hypot(b.x - state.ball.x, b.y - state.ball.y)
          ? a
          : b
      );
      state.ball.vx = (state.ball.x - near.x) * 0.08 + (Math.random() - 0.5);
      state.ball.vy = (state.ball.y - near.y) * 0.08 + (Math.random() - 0.5);
      const r = Math.random();
      const goalChance = 0.07 * (state.goalBoost || 1);
      if (r < goalChance) {
        const homeScores = Math.random() < 0.55;
        if (homeScores) state.scoreH = Math.min(9, state.scoreH + 1);
        else state.scoreA = Math.min(9, state.scoreA + 1);
        state.cheerUntil = state.clock + 90;
        state.banner = "GOOOOL!";
        state.bannerUntil = state.clock + 90;
        emit("goal", homeScores ? "AMA" : "VIS");
      } else if (r < goalChance + 0.07) {
        state.banner = "QUASE!";
        state.bannerUntil = state.clock + 50;
        emit("almost", Math.random() < 0.5 ? "AMA" : "VIS");
      } else if (r < goalChance + 0.1) {
        state.banner = "UHHH…";
        state.bannerUntil = state.clock + 45;
        emit("boo", Math.random() < 0.5 ? "AMA" : "VIS");
      }
    }

    for (const p of state.home) {
      ctx.fillStyle = "#ffd84a";
      ctx.fillRect(p.x - 3, p.y - 4, 6, 8);
    }
    for (const p of state.away) {
      ctx.fillStyle = "#2a6ad4";
      ctx.fillRect(p.x - 3, p.y - 4, 6, 8);
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(78, 2, 100, 16);
    ctx.fillStyle = "#ffd84a";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`AMA ${state.scoreH} x ${state.scoreA} VIS`, 128, 14);

    if (state.clock < state.bannerUntil && state.banner) {
      ctx.fillStyle = "rgba(255, 216, 74, 0.92)";
      ctx.font = "bold 20px Bebas Neue, Arial Black, sans-serif";
      ctx.fillText(state.banner, 128, 72);
    }

    texture.needsUpdate = true;
  }

  return {
    frame,
    draw,
    texture,
    setOnGoal(cb) {
      // back-compat
      onEvent = (e) => {
        if (e.type === "goal") cb?.(e.team);
      };
    },
    setOnEvent(cb) {
      onEvent = cb;
    },
    setGoalBoost(mult) {
      state.goalBoost = Math.max(0.5, Math.min(3, mult));
    },
  };
}
