/**
 * 📋 corvo - INVENTÁRIO DE COMANDOS DO BOT
 * A IA usa esta lista para ENTENDER e EXPLICAR todos os comandos do bot corvo.
 * Alimentada dinamicamente pelo conhecimento oficial do corvo (botKnowledge)
 * + comandos de grupo do loader.
 */

const { getGroupCommands } = require('../grupo');
const config = require('../../config');

/** Lista de comandos do grupo (do loader) com descrição */
function getGroupList() {
  const cmds = getGroupCommands().filter(c => c.command);
  return cmds.map(c => ({
    cmd: '/' + c.command,
    area: 'grupo',
  }));
}

/**
 * Texto formatado com todos os comandos p/ injetar no prompt da IA.
 * Usa o catálogo oficial do corvo (utils/botKnowledge) — sempre sincronizado
 * com os comandos reais do bot.
 */
function formatCommandList() {
  try {
    // 🧠 Conhecimento oficial do corvo: categorias + comandos reais
    const { getBotKnowledge } = require('../../../utils/botKnowledge');
    const conhecimento = getBotKnowledge('/', config.botName, 'Usuário');
    return `
=== COMANDOS DO BOT 𝒀𝑨𝑲𝑨𝑴𝒀 (WhatsApp) ===
${conhecimento}
`;
  } catch (e) {
    // Fallback: lista mínima se o botKnowledge falhar
    return `
=== COMANDOS DO BOT 𝒀𝑨𝑲𝑨𝑴𝒀 (WhatsApp) ===
• /ia — falar com a IA
• /corvo — IA da corvo
• /corvo1 — agente IA com ferramentas
• /coder — agente de programação (admins)
• /ban, /kick, /promover, /rebaixar — admin de grupo
• /clima, /ping, /grupoinfo — utilidades
`;
  }
}

function getFullList() {
  return getGroupList();
}

module.exports = { getGroupList, getFullList, formatCommandList };
