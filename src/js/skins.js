import * as THREE from "three";
import { PLAYABLES, playableOrder, playableAlias } from "./playableChars.js";
import { SkinPreview } from "./skinPreview.js";

const STORAGE_KEY = "amarelinho_playable";
const faceTexCache = new Map();
const loader = new THREE.TextureLoader();

export function assetUrl(rel) {
  if (!rel) return rel;
  try {
    return new URL(rel, document.baseURI || window.location.href).href;
  } catch {
    return rel;
  }
}

export function resolveSkinId(id) {
  if (id && PLAYABLES[id]) return id;
  const alias = id && playableAlias[id];
  if (alias && PLAYABLES[alias]) return alias;
  return playableOrder[0] || "miria";
}

export function getSkin(id) {
  return PLAYABLES[resolveSkinId(id)];
}

export function listSkins() {
  return playableOrder.map((id) => PLAYABLES[id]).filter(Boolean);
}

export function shuffleSkins(skins) {
  const arr = skins.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function loadSkinId() {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) return null;
    return resolveSkinId(id);
  } catch {
    /* private mode */
  }
  return null;
}

export function saveSkinId(id) {
  const resolved = resolveSkinId(id);
  if (!PLAYABLES[resolved]) return false;
  try {
    localStorage.setItem(STORAGE_KEY, resolved);
  } catch {
    /* private mode */
  }
  return true;
}

export function faceUrl(skin) {
  const def = typeof skin === "string" ? getSkin(skin) : skin;
  return def?.face ? assetUrl(def.face) : null;
}

export function loadFaceTexture(url) {
  const resolved = assetUrl(url);
  if (!resolved) return Promise.resolve(null);
  if (typeof document === "undefined") return Promise.resolve(null);
  if (faceTexCache.has(resolved)) return faceTexCache.get(resolved);
  const p = new Promise((resolve) => {
    loader.load(
      resolved,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        resolve(tex);
      },
      undefined,
      () => {
        console.warn("Face texture failed:", resolved);
        resolve(null);
      }
    );
  });
  faceTexCache.set(resolved, p);
  return p;
}

export function applySkinToPlayer(player, id) {
  if (!player?.applySkin) return;
  player.applySkin(resolveSkinId(id));
}

/**
 * Escolha de personagem (rostos em playableOrder).
 * @param {{ force?: boolean, onGesture?: () => void }} [opts]
 */
export function runSkinPicker({ force = true, onGesture } = {}) {
  const el = document.getElementById("skin-picker");
  const grid = document.getElementById("skin-grid");
  const btn = document.getElementById("skin-confirm");
  const canvas = document.getElementById("skin-preview");
  const hint = document.getElementById("skin-pick-hint");
  if (!el || !grid) {
    return Promise.resolve(resolveSkinId(loadSkinId() || "miria"));
  }

  if (!force) {
    const existing = loadSkinId();
    if (existing) {
      el.hidden = true;
      return Promise.resolve(existing);
    }
  }

  el.hidden = false;
  el.setAttribute("aria-hidden", "false");

  const skins = listSkins(); // um personagem: sem shuffle
  let selected = skins[0]?.id || "miria";
  let preview = null;
  if (canvas) {
    try {
      preview = new SkinPreview(canvas);
      preview.setSkin(selected);
    } catch (err) {
      console.warn("Skin preview:", err);
    }
  }

  if (btn) {
    btn.disabled = false;
    btn.textContent = `Entrar como ${getSkin(selected).name}`;
  }
  if (hint) {
    hint.textContent =
      skins.length === 1
        ? "Miriã — arraste o boneco para girar e confirme."
        : `Clique num dos ${skins.length} rostos. Arraste o boneco para girar.`;
  }

  const render = () => {
    grid.innerHTML = skins
      .map((s) => {
        const active = s.id === selected ? " is-selected" : "";
        const src = faceUrl(s) || "";
        const face = src
          ? `<img class="skin-card__face" src="${src}" alt="${s.name}" width="88" height="88" draggable="false" />`
          : "";
        return `<button type="button" class="skin-card${active}" data-skin-id="${s.id}" aria-pressed="${s.id === selected}">
          ${face}
          <span class="skin-card__name">${s.name}</span>
        </button>`;
      })
      .join("");
  };
  render();

  return new Promise((resolve) => {
    let gestured = false;
    const fireGesture = () => {
      if (gestured) return;
      gestured = true;
      try {
        onGesture?.();
      } catch {
        /* optional */
      }
    };

    const finish = (id) => {
      preview?.dispose();
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
      el.removeEventListener("click", onClick);
      el.removeEventListener("pointerdown", onPointerDown);
      resolve(resolveSkinId(id));
    };

    const onPointerDown = (e) => {
      if (e.target.closest?.("[data-skin-id], #skin-confirm")) fireGesture();
    };

    const onClick = (e) => {
      const card = e.target.closest("[data-skin-id]");
      if (card) {
        fireGesture();
        selected = card.dataset.skinId;
        render();
        preview?.setSkin(selected);
        if (btn) {
          btn.disabled = false;
          btn.textContent = `Entrar como ${getSkin(selected).name}`;
        }
        if (hint) hint.textContent = "Arraste o boneco para girar · confirme para jogar";
        return;
      }
      if (e.target.closest("#skin-confirm")) {
        if (!selected) {
          if (hint) hint.textContent = "Escolha um personagem antes de continuar.";
          return;
        }
        fireGesture();
        saveSkinId(selected);
        finish(selected);
      }
    };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("click", onClick);
  });
}
