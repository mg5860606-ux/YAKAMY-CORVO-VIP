const { client } = require("../mongodb/database.js");
const db = client.db("Rem");
const usersCollection = db.collection("users");
const groupsCollection = db.collection("groups");
const {
  PATENTES,
  getXPForLevelUp,
  getTotalXPForLevel,
  getLevelForXP,
  getPatenteForLevel,
} = require("./levelingUtils.js");
const { generateUserCard } = require("./cardGenerator.js");

const XP_COOLDOWN_SECONDS = 5;

const processXP = async (userId, groupId, pushname, jurandir) => {
  const groupConfig = await groupsCollection.findOne({ _id: groupId });
  if (!groupConfig || !groupConfig.levelingSystem) {
    return;
  }

  const now = new Date();
  const initialUserData = {
    pushname: pushname,
    xp: 0,
    level: 0,
    patente: PATENTES[0].nome,
    prestige: 0,
    lastXpGain: now,
  };

  await usersCollection.updateOne(
    { _id: userId },
    { $setOnInsert: initialUserData },
    { upsert: true }
  );

  let user = await usersCollection.findOne({ _id: userId });

  const lastGain = user.lastXpGain ? new Date(user.lastXpGain) : new Date(0);
  const secondsSinceLastGain = (now.getTime() - lastGain.getTime()) / 1000;
  if (secondsSinceLastGain < XP_COOLDOWN_SECONDS) {
    return;
  }

  const xpGained = Math.floor(Math.random() * (250 - 50 + 1)) + 50;
  const newXP = (user.xp || 0) + xpGained;
  const oldLevel = user.level || 0;
  const newLevel = getLevelForXP(newXP);

  const oldPatente = getPatenteForLevel(oldLevel);
  const newPatente = getPatenteForLevel(newLevel);

  const updateData = {
    $set: {
      xp: newXP,
      pushname: pushname,
      lastXpGain: now,
      level: oldLevel,
      patente: oldPatente.nome,
    },
  };

  let levelUpMessage = null;

  if (newLevel > oldLevel) {
    updateData.$set.level = newLevel;
    updateData.$set.patente = newPatente.nome;

    await usersCollection.updateOne({ _id: userId }, updateData);

    const updatedUser = {
      ...user,
      ...updateData.$set,
    };

    const cardBuffer = await generateUserCard(updatedUser);

    levelUpMessage = `🎉 Parabéns, @${
      userId.split("@")[0]
    }! Você subiu para o *Nível ${newLevel}*!`;
    if (newPatente.nome !== oldPatente.nome) {
      levelUpMessage += `\n\nE alcançou uma nova patente: *${newPatente.icone} ${newPatente.nome}*! Continue assim!`;
    }

    if (cardBuffer) {
      await jurandir.sendMessage(groupId, {
        image: cardBuffer,
        caption: levelUpMessage,
        mentions: [userId],
      });
    } else {
      await jurandir.sendMessage(groupId, {
        text: levelUpMessage,
        mentions: [userId],
      });
    }
  } else {
    await usersCollection.updateOne({ _id: userId }, updateData);
  }
};
const LOOT_COOLDOWN_HOURS = 1;

const processLootBox = async (sender, from, pushname, jurandir) => {
  const now = new Date();
  let user = await usersCollection.findOne({ _id: sender });

  if (!user) {
    user = {
      _id: sender,
      pushname: pushname,
      xp: 0,
      level: 0,
      patente: PATENTES[0].nome,
      prestige: 0,
    };
    await usersCollection.insertOne(user);
  }

  const lastLoot = user.lastLootGain
    ? new Date(user.lastLootGain)
    : new Date(0);
  const hoursSinceLastLoot =
    (now.getTime() - lastLoot.getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastLoot < LOOT_COOLDOWN_HOURS) {
    const remainingTimeMs =
      LOOT_COOLDOWN_HOURS * 60 * 60 * 1000 -
      (now.getTime() - lastLoot.getTime());

    const remainingHours = Math.floor(remainingTimeMs / (1000 * 60 * 60));
    const remainingMinutes = Math.ceil(
      (remainingTimeMs % (1000 * 60 * 60)) / (1000 * 60)
    );

    let timeLeft = "";
    if (remainingHours > 0) timeLeft += `${remainingHours}h `;
    timeLeft += `${remainingMinutes}m`;

    return `> ⏳ Sua Caixa Loot ainda está em resfriamento. Tente novamente em *${timeLeft}*.`;
  }

  const currentLevel = user.level || 0;

  const xpToLevelUp = getXPForLevelUp(currentLevel);

  const dynamicMinXP = Math.max(1000, Math.floor(xpToLevelUp * 0.05));
  const dynamicMaxXP = Math.floor(xpToLevelUp * 0.25);

  const INSTANT_LEVEL_CHANCE = 0.02;
  const isInstantLevel = Math.random() < INSTANT_LEVEL_CHANCE;

  let xpGained;
  let bonusMessage = "┃";

  if (isInstantLevel) {
    const currentXPBase = user.xp || 0;
    const xpNoNivel = currentXPBase - getTotalXPForLevel(currentLevel);
    xpGained = xpToLevelUp - xpNoNivel;
    bonusMessage = "\n┃\n┃ 👑 *BÔNUS!* Nível instantâneo alcançado!";
  } else {
    xpGained =
      Math.floor(Math.random() * (dynamicMaxXP - dynamicMinXP + 1)) +
      dynamicMinXP;
  }

  const newXP = (user.xp || 0) + xpGained;
  const oldLevel = user.level || 0;
  const newLevel = getLevelForXP(newXP);
  const newPatente = getPatenteForLevel(newLevel);

  const updateData = {
    $set: {
      xp: newXP,
      pushname: pushname,
      lastLootGain: now,
    },
  };

  let levelUpMessage = "┃";

  if (newLevel > oldLevel) {
    updateData.$set.level = newLevel;
    updateData.$set.patente = newPatente.nome;

    const oldPatente = getPatenteForLevel(oldLevel);

    levelUpMessage = `┃\n┃ Você subiu para o *Nível ${newLevel}*!`;
    if (newPatente.nome !== oldPatente.nome) {
      levelUpMessage += `\n┃  E alcançou a nova patente: *${newPatente.icone} ${newPatente.nome}*!`;
    }
    levelUpMessage += "\n┃";
  }

  await usersCollection.updateOne({ _id: sender }, updateData);

  const lootMessage = `
╭══════════════════════╗
╰╮  🎁 *CAIXA LOOT ABERTA!*
╭┤  *Parabéns, ${pushname}!*
┃╰═════════════════════╝
┃
┃  ✨ Você ganhou *+${xpGained.toLocaleString("pt-BR")} XP*!
┃  📈 XP Total: ${newXP.toLocaleString("pt-BR")}
${bonusMessage}
${levelUpMessage}
╰╔═════════════════════╗
╭┤           🐱  𝙹𝚄𝚁𝙰𝙽𝙳𝙸𝚁  🐱
╰╚═════════════════════╝
`;

  return lootMessage.trim();
};

module.exports = {
  processXP,
  processLootBox,
};
