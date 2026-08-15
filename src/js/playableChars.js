import { WAITERS, buildWaiterMesh, buildCustomerMesh } from "./npcs.js";

/** Clientes jogáveis (fregueses). */
export const CLIENT_CHARS = [
  {
    id: "cli_juca",
    role: "client",
    name: "Juca",
    blurb: "Camisa amarela, sempre na calçada",
    skin: 0xc68642,
    hair: 0x2a1a10,
    hairStyle: "short",
    face: "smile",
    height: 1.0,
    shirt: 0xc9a000,
    pants: 0x1a1a22,
  },
  {
    id: "cli_bia",
    role: "client",
    name: "Bia",
    blurb: "Vem pelo samba da jukebox",
    skin: 0xd9a066,
    hair: 0x3b2414,
    hairStyle: "medium",
    face: "kind",
    height: 0.96,
    shirt: 0x8b2020,
    pants: 0x2a3548,
  },
  {
    id: "cli_rafa",
    role: "client",
    name: "Rafa",
    blurb: "Só quer gelada e o placar",
    skin: 0x5c3a28,
    hair: 0x1a120e,
    hairStyle: "cap",
    face: "neutral",
    height: 1.02,
    shirt: 0x2a4a7a,
    pants: 0x222228,
    capColor: 0x1a1a1a,
  },
  {
    id: "cli_nanda",
    role: "client",
    name: "Nanda",
    blurb: "Porção pra dividir ou nada",
    skin: 0xe0ac69,
    hair: 0x6b4423,
    hairStyle: "short",
    face: "smile",
    height: 0.98,
    shirt: 0x6b3fa0,
    pants: 0x1a1a22,
  },
  {
    id: "cli_zezinho",
    role: "client",
    name: "Zezinho",
    blurb: "Aprendiz do Seu Zé",
    skin: 0x8d5524,
    hair: 0xf2f2f0,
    hairStyle: "baldish",
    face: "kind",
    height: 0.94,
    shirt: 0x2d6a3e,
    pants: 0x2a2a30,
  },
  {
    id: "cli_mel",
    role: "client",
    name: "Mel",
    blurb: "Batida especial é lei",
    skin: 0xf1c27d,
    hair: 0xc45c26,
    hairStyle: "medium",
    face: "smile",
    height: 0.97,
    shirt: 0xd4782a,
    pants: 0x3a2a1a,
  },
];

export function getWaiterPlayables() {
  return WAITERS.map((w) => ({
    id: w.id,
    role: "waiter",
    name: w.name,
    blurb: `Turno: ${w.name}`,
    def: w,
  }));
}

export function getAllPlayables() {
  return [...CLIENT_CHARS, ...getWaiterPlayables()];
}

export function getPlayable(id) {
  return getAllPlayables().find((c) => c.id === id) || CLIENT_CHARS[0];
}

export function buildPlayableMesh(playable) {
  if (playable.role === "waiter") {
    const def = playable.def || WAITERS.find((w) => w.id === playable.id);
    const mesh = buildWaiterMesh(def);
    // Sem nametag flutuante no player (polui 3ª pessoa)
    for (const child of [...mesh.children]) {
      if (child.isSprite && child.position.y > 2) mesh.remove(child);
    }
    return mesh;
  }
  const def = {
    id: playable.id,
    name: playable.name,
    skin: playable.skin,
    hair: playable.hair,
    hairStyle: playable.hairStyle,
    face: playable.face,
    height: playable.height,
    shirt: playable.shirt,
    pants: playable.pants,
    capColor: playable.capColor,
  };
  const mesh = buildCustomerMesh(def);
  for (const child of [...mesh.children]) {
    if (child.isSprite && child.position.y > 2) mesh.remove(child);
  }
  return mesh;
}
