/** Cardápio do Amarelinho — preços em R$. */
export const MENU = {
  beer: { id: "beer", name: "Cerveja gelada", price: 12, emoji: "🍺", cat: "drink" },
  water: { id: "water", name: "Água", price: 5, emoji: "💧", cat: "drink" },
  batida: { id: "batida", name: "Batida da casa", price: 18, emoji: "🍹", cat: "batida" },
  batida_limao: { id: "batida_limao", name: "Batida de limão", price: 18, emoji: "🍋", cat: "batida" },
  batida_maracuja: { id: "batida_maracuja", name: "Batida de maracujá", price: 20, emoji: "🥭", cat: "batida" },
  batida_especial: { id: "batida_especial", name: "Amarelinho especial", price: 24, emoji: "✨", cat: "batida" },
  food: { id: "food", name: "Porção pra dividir", price: 48, emoji: "🍤", cat: "food" },
  torresmo: { id: "torresmo", name: "Torresmo", price: 32, emoji: "🥓", cat: "food" },
  bolinho: { id: "bolinho", name: "Bolinho de bacalhau", price: 28, emoji: "🟡", cat: "food" },
  calabresa: { id: "calabresa", name: "Calabresa acebolada", price: 36, emoji: "🌶️", cat: "food" },
};

export const MENU_ORDER = [
  "beer",
  "batida",
  "batida_limao",
  "batida_maracuja",
  "batida_especial",
  "food",
  "torresmo",
  "bolinho",
  "calabresa",
  "water",
];

export function menuChoice(id, more = {}) {
  const def = MENU[id];
  return {
    label: `${def.emoji} ${def.name} — R$ ${def.price}`,
    action: id,
    ...more,
  };
}

export class Bill {
  constructor() {
    this.items = [];
    this.paid = false;
    this.pendingDelivery = null;
  }

  add(itemId) {
    const def = MENU[itemId];
    if (!def) return null;
    this.items.push({ ...def, at: Date.now() });
    this.paid = false;
    return def;
  }

  total() {
    return this.items.reduce((s, i) => s + i.price, 0);
  }

  count() {
    return this.items.length;
  }

  clear() {
    this.items = [];
    this.paid = true;
    this.pendingDelivery = null;
  }

  summaryLines() {
    if (!this.items.length) return ["(comanda vazia)"];
    const counts = {};
    for (const i of this.items) {
      counts[i.id] = (counts[i.id] || 0) + 1;
    }
    return Object.entries(counts).map(([id, n]) => {
      const def = MENU[id];
      return `${def.emoji} ${n}× ${def.name} — R$ ${def.price * n}`;
    });
  }
}
