const PATENTES = [
  { nome: "Madeira V", nivelMin: 1, icone: "🪵" },
  { nome: "Madeira IV", nivelMin: 5, icone: "🪵" },
  { nome: "Madeira III", nivelMin: 10, icone: "🪵" },
  { nome: "Madeira II", nivelMin: 15, icone: "🪵" },
  { nome: "Madeira I", nivelMin: 20, icone: "🪵" },
  { nome: "Bronze V", nivelMin: 25, icone: "🥉" },
  { nome: "Bronze IV", nivelMin: 30, icone: "🥉" },
  { nome: "Bronze III", nivelMin: 35, icone: "🥉" },
  { nome: "Bronze II", nivelMin: 40, icone: "🥉" },
  { nome: "Bronze I", nivelMin: 45, icone: "🥉" },
  { nome: "Prata V", nivelMin: 50, icone: "🥈" },
  { nome: "Prata IV", nivelMin: 60, icone: "🥈" },
  { nome: "Prata III", nivelMin: 70, icone: "🥈" },
  { nome: "Prata II", nivelMin: 80, icone: "🥈" },
  { nome: "Prata I", nivelMin: 90, icone: "🥈" },
  { nome: "Ouro V", nivelMin: 100, icone: "🥇" },
  { nome: "Ouro IV", nivelMin: 120, icone: "🥇" },
  { nome: "Ouro III", nivelMin: 140, icone: "🥇" },
  { nome: "Ouro II", nivelMin: 160, icone: "🥇" },
  { nome: "Ouro I", nivelMin: 180, icone: "🥇" },
  { nome: "Platina V", nivelMin: 200, icone: "💠" },
  { nome: "Platina IV", nivelMin: 220, icone: "💠" },
  { nome: "Platina III", nivelMin: 240, icone: "💠" },
  { nome: "Platina II", nivelMin: 260, icone: "💠" },
  { nome: "Platina I", nivelMin: 280, icone: "💠" },
  { nome: "Diamante V", nivelMin: 300, icone: "💎" },
  { nome: "Diamante IV", nivelMin: 320, icone: "💎" },
  { nome: "Diamante III", nivelMin: 340, icone: "💎" },
  { nome: "Diamante II", nivelMin: 360, icone: "💎" },
  { nome: "Diamante I", nivelMin: 380, icone: "💎" },
  { nome: "Mestre V", nivelMin: 400, icone: "🔮" },
  { nome: "Mestre IV", nivelMin: 425, icone: "🔮" },
  { nome: "Mestre III", nivelMin: 450, icone: "🔮" },
  { nome: "Mestre II", nivelMin: 475, icone: "🔮" },
  { nome: "Mestre I", nivelMin: 490, icone: "🔮" },
  { nome: "Lendário", nivelMin: 500, icone: "🌟" },
];

const getXPForLevelUp = (level) =>
  Math.floor(5 * level ** 2 + 50 * level + 100);

const getTotalXPForLevel = (level) => {
  let totalXP = 0;
  for (let i = 0; i < level; i++) {
    totalXP += getXPForLevelUp(i);
  }
  return totalXP;
};

const getLevelForXP = (xp) => {
  let level = 0;
  while (xp >= getTotalXPForLevel(level + 1)) {
    level++;
  }
  return level;
};

const getPatenteForLevel = (level) => {
  return (
    PATENTES.slice()
      .reverse()
      .find((p) => level >= p.nivelMin) || PATENTES[0]
  );
};

module.exports = {
  PATENTES,
  getXPForLevelUp,
  getTotalXPForLevel,
  getLevelForXP,
  getPatenteForLevel,
};
