/**
 * Planta do Amarelinho (vista de cima).
 * +Z = rua / calçada (frente) · −Z = fundos · −X = esquerda · +X = direita
 *
 * lavanda  calçada + árvores
 * verde    mesas elevadas (+escada)
 * amarelo  mesas no nível do solo (L: corredor + salão fundos-esq)
 * azul     caixa + geladeiras de cerveja
 * vermelho cozinha (Carlinhos)
 * lima     banheiro entrada lateral
 * índigo   banheiro dos fundos
 */
export const LAYOUT = {
  // Calçada (lavanda)
  sidewalk: { x0: -14, x1: 14, z0: 2.2, z1: 7.6 },
  trees: [
    [-9.5, 4.6],
    [9.5, 4.8],
  ],

  // Verde — elevado
  green: { x0: -13.5, x1: -3.6, z0: -6.2, z1: 1.4, height: 0.45 },
  // Escada na borda leste do verde (virada pro corredor amarelo)
  stairs: { x0: -3.9, x1: -3.15, z0: -5.5, z1: 0.8, steps: 4 },

  // Amarelo — solo: corredor central + salão fundos-esquerda
  yellowCorridor: { x0: -3.2, x1: 2.2, z0: -6.2, z1: 1.4 },
  yellowHall: { x0: -13.5, x1: 2.2, z0: -15.5, z1: -6.2 },

  // Azul — caixa + geladeiras
  blue: { x0: 2.5, x1: 12.5, z0: -6.5, z1: 1.4 },

  // Vermelho — cozinha
  kitchen: { x0: 2.5, x1: 12.5, z0: -11.8, z1: -6.5 },

  // Banheiros
  bathLime: { x0: 2.5, x1: 7.2, z0: -15.5, z1: -11.8 }, // entrada lateral (oeste)
  bathIndigo: { x0: 7.5, x1: 12.5, z0: -15.5, z1: -11.8 }, // fundos

  // Envelope do prédio
  building: { x0: -14, x1: 13, z0: -15.8, z1: 1.6, W: 27 },
};

export function inRect(x, z, r) {
  return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
}

/** Altura do piso (plataforma verde + escada). */
export function floorHeightAt(x, z) {
  const g = LAYOUT.green;
  const s = LAYOUT.stairs;
  if (inRect(x, z, g)) return g.height;
  if (inRect(x, z, s)) {
    // Sobe de leste (amarelo, y=0) → oeste (verde, y=height)
    const t = (s.x1 - x) / (s.x1 - s.x0);
    return Math.max(0, Math.min(1, t)) * g.height;
  }
  return 0;
}

export function rectCenter(r) {
  return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
}

export function rectSize(r) {
  return { w: r.x1 - r.x0, d: r.z1 - r.z0 };
}
