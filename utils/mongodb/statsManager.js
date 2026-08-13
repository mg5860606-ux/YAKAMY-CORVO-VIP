fs = require("fs");
const path = require("path");
const STATS_PATH = path.resolve(__dirname, "./database/stats.json");

const getInitialStats = () => ({
  botStartTime: new Date().toISOString(),
  globalStats: {
    totalMessages: 0,
    totalCommands: 0,
  },
  users: {},
  groups: {},
});

const loadStats = () => {
  if (!fs.existsSync(STATS_PATH)) {
    const initialStats = getInitialStats();
    fs.writeFileSync(STATS_PATH, JSON.stringify(initialStats, null, 2));
    return initialStats;
  }
  try {
    const data = JSON.parse(fs.readFileSync(STATS_PATH, "utf-8"));

    if (!data.globalStats) {
      console.log(
        "Detectada estrutura de stats antiga. Resetando para a nova estrutura."
      );
      return getInitialStats();
    }
    return data;
  } catch (e) {
    console.error("Erro ao ler stats.json, resetando o arquivo.", e);
    const initialStats = getInitialStats();
    fs.writeFileSync(STATS_PATH, JSON.stringify(initialStats, null, 2));
    return initialStats;
  }
};

const saveStats = (stats) => {
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
};

const recordMessage = (userId, groupId, pushname) => {
  const stats = loadStats();

  stats.globalStats.totalMessages = (stats.globalStats.totalMessages || 0) + 1;

  if (!stats.users[userId]) {
    stats.users[userId] = {
      lastSeenName: pushname,
      totalMessages: 0,
      perGroup: {},
    };
  }

  stats.users[userId].lastSeenName = pushname;
  stats.users[userId].totalMessages =
    (stats.users[userId].totalMessages || 0) + 1;

  if (groupId) {
    if (!stats.groups[groupId]) {
      stats.groups[groupId] = {
        totalMessages: 0,
      };
    }
    stats.groups[groupId].totalMessages =
      (stats.groups[groupId].totalMessages || 0) + 1;

    if (!stats.users[userId].perGroup[groupId]) {
      stats.users[userId].perGroup[groupId] = 0;
    }
    stats.users[userId].perGroup[groupId] =
      (stats.users[userId].perGroup[groupId] || 0) + 1;
  }

  saveStats(stats);
};

const incrementCommandCount = () => {
  const stats = loadStats();
  stats.globalStats.totalCommands = (stats.globalStats.totalCommands || 0) + 1;
  saveStats(stats);
};

const setBotStartTime = () => {
  const stats = loadStats();
  stats.botStartTime = new Date().toISOString();
  saveStats(stats);
};

module.exports = {
  loadStats,
  recordMessage,
  incrementCommandCount,
  setBotStartTime,
};