/**
 * Roster de personagens jogáveis.
 * Separado dos NPCs do bar (WAITERS / REGULAR / crowd em npcs.js).
 * Por enquanto: só Miriã. Para adicionar depois: PLAYABLES + playableOrder + faces/*.png.
 */
export const PLAYABLES = {
  miria: {
    id: "miria",
    name: "Miriã",
    face: "faces/miria.png",
    body: "female",
    suit: 0x6b3a5a,
    shirt: 0xc9a0b8,
    skin: 0xe8c4a0,
    tie: 0xd4a0b0,
    hair: 0x2a1810,
  },
};

export const playableOrder = ["miria"];

/** IDs antigos → Miriã. */
export const playableAlias = {
  natan: "miria",
  jorge: "miria",
  caio: "miria",
  lorenzo: "miria",
  ze: "miria",
  mika: "miria",
  maya: "miria",
  andre: "miria",
  classic: "miria",
  cli_juca: "miria",
  cli_bia: "miria",
  cli_rafa: "miria",
  cli_nanda: "miria",
  cli_zezinho: "miria",
  cli_mel: "miria",
  toninho: "miria",
  fabin: "miria",
  oliveira: "miria",
  val: "miria",
  ney: "miria",
  carlinhos: "miria",
};
