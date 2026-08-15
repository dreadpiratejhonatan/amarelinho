export const ACHIEVEMENTS = [
  { id: "first_drink", name: "Primeira gelada", desc: "Peça qualquer bebida", icon: "🍺" },
  { id: "paid_tab", name: "Conta fechada", desc: "Pague a comanda", icon: "💵" },
  { id: "night_1", name: "Boa noite", desc: "Complete uma noite", icon: "🌙" },
  { id: "night_3", name: "Freguês", desc: "Complete 3 noites", icon: "⭐" },
  { id: "all_staff", name: "Casa toda", desc: "Fale com todos os garçons", icon: "🤝" },
  { id: "elevated", name: "Vista privilegiada", desc: "Sente no salão elevado", icon: "🪑" },
  { id: "batidas", name: "Mestre das batidas", desc: "Prove as 4 batidas", icon: "🍹" },
  { id: "tipper", name: "Mão aberta", desc: "Dê 3 gorjetas", icon: "🙏" },
  { id: "regular", name: "Causo ouvido", desc: "Ouça o Seu Zé", icon: "📜" },
  { id: "jukebox", name: "DJ da casa", desc: "Troque a estação da jukebox", icon: "🎵" },
  { id: "photo", name: "Lembrança", desc: "Tire uma foto da noite", icon: "📸" },
  { id: "round", name: "Rodada", desc: "Pague uma comanda de R$ 80+", icon: "🍻" },
  { id: "turma", name: "Conheceu a turma", desc: "Complete as 6 histórias dos garçons", icon: "💛" },
  { id: "toninho_smile", name: "Quase sorriu", desc: "Faça o Toninho quase sorrir", icon: "😐" },
  { id: "fabin_promo", name: "Promoção da casa", desc: "Aceite (ou recuse) a oferta do Fabin", icon: "😄" },
  { id: "carlinhos_secret", name: "Segredo da chapa", desc: "Peça o especial do Carlinhos", icon: "🧢" },
];

export function evaluateAchievements(data) {
  const unlocked = { ...(data.achievements || {}) };
  const mark = (id) => {
    if (!unlocked[id]) unlocked[id] = Date.now();
  };
  if (data.drinksOrdered >= 1) mark("first_drink");
  if (data.paid || data.nightsFinished >= 1) mark("paid_tab");
  if (data.nightsFinished >= 1) mark("night_1");
  if (data.nightsFinished >= 3) mark("night_3");
  if (data.allStaffEver) mark("all_staff");
  if (data.satElevated) mark("elevated");
  const bats = data.tasted || {};
  if (bats.batida && bats.batida_limao && bats.batida_maracuja && bats.batida_especial) {
    mark("batidas");
  }
  if ((data.tipsGiven || 0) >= 3) mark("tipper");
  if (data.metRegular) mark("regular");
  if (data.usedJukebox) mark("jukebox");
  if (data.tookPhoto) mark("photo");
  if (data.bigRound) mark("round");

  const beats = data.waiterBeats || {};
  const beatIds = ["toninho", "fabin", "oliveira", "val", "ney", "carlinhos"];
  if (beatIds.every((id) => beats[id])) mark("turma");
  if (beats.toninho) mark("toninho_smile");
  if (beats.fabin) mark("fabin_promo");
  if (beats.carlinhos) mark("carlinhos_secret");
  return unlocked;
}
