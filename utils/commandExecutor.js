/*
 * ============================================================================
 *  🖤 𝒀𝑨𝑲𝑨𝑴𝒀 — EXECUTOR DE COMANDOS
 *  ----------------------------------------------------------------------------
 *  👑 Dono & Criador: DARK DYABYNHO
 *  💬 Telegram: @CORVO291
 *  🤖 Bot Telegram: t.me/corvo_div_bot
 *  🧠 IA: Irmã do DARK (cérebro do bot)
 *  💻 GitHub: github.com/mg5860606-ux
 *  📦 Repositório: github.com/mg5860606-ux/YAKAMY-CORVO-VIP
 * ============================================================================
 */
/**
 * ⚡ 𝒀𝑨𝑲𝑨𝑴𝒀 - EXECUTOR DE COMANDOS
 * 
 * Extrai os comandos principais do switch do corvo.js para funções
 * chamáveis programaticamente pelo agente IA.
 * 
 * Cada comando é uma função que recebe um contexto e argumentos,
 * executa a ação e retorna o resultado.
 * 
 * Criado por DARK DYABYNHO - Sistema próprio.
 */

const axios = require("axios");

/**
 * Registry de comandos executáveis.
 * { nome: { handler: async (ctx, args) => resultado } }
 */
const commandRegistry = {};

/**
 * Registra um comando no registry.
 */
function registerCommand(name, handler) {
  commandRegistry[name.toLowerCase()] = handler;
}

/**
 * Lista comandos disponíveis.
 */
function listCommands() {
  return Object.keys(commandRegistry);
}

// ================================================================
// COMANDO: ban
// Bane um membro do grupo
// ================================================================
registerCommand("ban", async (ctx, args) => {
  const { corvo, from } = ctx;
  const { usuario, motivo } = args;

  // Extrai o JID do usuário
  const banUser = usuario?.includes("@s.whatsapp.net")
    ? usuario
    : `${usuario?.replace(/[^0-9]/g, "")}@s.whatsapp.net`;

  try {
    // Verificações de segurança
    const groupMetadata = await corvo.groupMetadata(from);
    const participants = groupMetadata.participants || [];
    const botJid = corvo.user.id.split(":")[0] + "@s.whatsapp.net";

    if (!participants.find(p => p.id === banUser)) {
      return { sucesso: false, mensagem: "Usuário não está no grupo." };
    }
    // 🤖 AUTONOMIA TOTAL (regra do dono): a IA PODE banir ADMINS também —
    // o executor só protege o próprio BOT (abaixo). O DONO é protegido na
    // camada da IA (ia_tools.js), que nunca deixa o dono passar como alvo.
    if (banUser === botJid) {
      return { sucesso: false, mensagem: "Não posso me banir." };
    }

    await corvo.groupParticipantsUpdate(from, [banUser], "remove");
    const nome = banUser.split("@")[0];
    return { sucesso: true, acao: "ban", usuario: nome, mensagem: `@${nome} foi removido do grupo.${motivo ? ` Motivo: ${motivo}` : ""}` };
  } catch (e) {
    return { sucesso: false, mensagem: `Erro ao banir: ${e.message}` };
  }
});

// ================================================================
// COMANDO: kick (mesmo que ban, mas sem bloqueio)
// ================================================================
registerCommand("kick", async (ctx, args) => {
  return await commandRegistry["ban"](ctx, args);
});

// ================================================================
// COMANDO: promover
// Promove membro a admin
// ================================================================
registerCommand("promover", async (ctx, args) => {
  const { corvo, from } = ctx;
  const { usuario } = args;

  const targetUser = usuario?.includes("@s.whatsapp.net")
    ? usuario
    : `${usuario?.replace(/[^0-9]/g, "")}@s.whatsapp.net`;

  try {
    // 🤖 AUTONOMIA (regra do dono): a IA promove quem quiser (inclusive admin
    // a mais); a única proteção é o próprio BOT e o DONO (DONO protegido na IA).
    const botJid = corvo.user.id.split(":")[0] + "@s.whatsapp.net";
    if (targetUser === botJid) {
      return { sucesso: false, mensagem: "Não posso promover a mim mesma." };
    }
    await corvo.groupParticipantsUpdate(from, [targetUser], "promote");
    const nome = targetUser.split("@")[0];
    return { sucesso: true, acao: "promover", usuario: nome, mensagem: `@${nome} foi promovido a administrador! 👑` };
  } catch (e) {
    return { sucesso: false, mensagem: `Erro ao promover: ${e.message}` };
  }
});

// ================================================================
// COMANDO: rebaixar
// Rebaixa admin a membro
// ================================================================
registerCommand("rebaixar", async (ctx, args) => {
  const { corvo, from } = ctx;
  const { usuario } = args;

  const targetUser = usuario?.includes("@s.whatsapp.net")
    ? usuario
    : `${usuario?.replace(/[^0-9]/g, "")}@s.whatsapp.net`;

  try {
    // 🤖 AUTONOMIA (regra do dono): a IA rebaixa ADMINS também quando decidir;
    // a única proteção é o próprio BOT e o DONO (DONO protegido na IA).
    const botJid = corvo.user.id.split(":")[0] + "@s.whatsapp.net";
    if (targetUser === botJid) {
      return { sucesso: false, mensagem: "Não posso rebaixar a mim mesma." };
    }
    await corvo.groupParticipantsUpdate(from, [targetUser], "demote");
    const nome = targetUser.split("@")[0];
    return { sucesso: true, acao: "rebaixar", usuario: nome, mensagem: `@${nome} foi rebaixado a membro comum.` };
  } catch (e) {
    return { sucesso: false, mensagem: `Erro ao rebaixar: ${e.message}` };
  }
});

// ================================================================
// COMANDO: clima / tempo
// Previsão do tempo por cidade
// ================================================================
registerCommand("clima", async (ctx, args) => {
  const { cidade } = args;
  if (!cidade) return { sucesso: false, mensagem: "Informe o nome da cidade." };

  try {
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cidade)}&appid=f5c0840c2457fbb64188a6d4be05618f&units=metric&lang=pt_br`
    );
    const d = response.data;
    return {
      sucesso: true,
      acao: "clima",
      dados: {
        cidade: d.name,
        pais: d.sys.country,
        temperatura: `${d.main.temp}°C`,
        maxima: `${d.main.temp_max}°C`,
        minima: `${d.main.temp_min}°C`,
        descricao: d.weather[0].description,
        umidade: `${d.main.humidity}%`,
        vento: `${d.wind.speed} m/s`,
      },
      mensagem: `🌤️ *Clima em ${d.name} - ${d.sys.country}*\n🌡️ Temperatura: ${d.main.temp}°C\n🔥 Máxima: ${d.main.temp_max}°C | ❄️ Mínima: ${d.main.temp_min}°C\n🌦️ ${d.weather[0].description}\n💧 Umidade: ${d.main.humidity}%\n🌫️ Vento: ${d.wind.speed} m/s`
    };
  } catch (e) {
    if (e.response?.status === 404) {
      return { sucesso: false, mensagem: `Cidade "${cidade}" não encontrada.` };
    }
    return { sucesso: false, mensagem: `Erro ao buscar clima: ${e.message}` };
  }
});
registerCommand("tempo", commandRegistry["clima"]);

// ================================================================
// COMANDO: ping
// Verifica se o bot está online
// ================================================================
registerCommand("ping", async (ctx, args) => {
  const latency = Math.round(process.uptime() * 1000);
  return { sucesso: true, acao: "ping", mensagem: `🏓 Pong! Latência: ${latency}ms` };
});

// ================================================================
// COMANDO: info_grupo
// Informações do grupo atual
// ================================================================
registerCommand("grupoinfo", async (ctx, args) => {
  const { corvo, from } = ctx;
  try {
    const meta = await corvo.groupMetadata(from);
    return {
      sucesso: true,
      acao: "grupoinfo",
      dados: {
        nome: meta.subject,
        descricao: meta.desc?.slice(0, 200) || "Sem descrição",
        membros: meta.participants?.length || 0,
        admins: meta.participants?.filter(p => p.admin)?.length || 0,
        criado_em: meta.creation || "Desconhecido",
      },
      mensagem: `📋 *${meta.subject}*\n👥 Membros: ${meta.participants?.length || 0}\n👑 Admins: ${meta.participants?.filter(p => p.admin)?.length || 0}\n📝 ${meta.desc?.slice(0, 200) || "Sem descrição"}`
    };
  } catch (e) {
    return { sucesso: false, mensagem: `Erro: ${e.message}` };
  }
});

// ================================================================
// EXPORTS
// ================================================================

/**
 * Executa um comando pelo nome.
 * @param {string} nome - Nome do comando
 * @param {object} args - Argumentos do comando
 * @param {object} ctx - Contexto de execução { corvo, from, sender, ... }
 * @returns {Promise<object>} Resultado { sucesso, mensagem, ... }
 */
async function executeCommand(nome, args, ctx) {
  const handler = commandRegistry[nome.toLowerCase()];
  if (!handler) {
    return { sucesso: false, mensagem: `Comando "${nome}" não encontrado no executor. Tente usar o comando original com prefixo.` };
  }
  try {
    return await handler(ctx, args);
  } catch (e) {
    return { sucesso: false, mensagem: `Erro ao executar ${nome}: ${e.message}` };
  }
}

module.exports = {
  commandRegistry,
  registerCommand,
  executeCommand,
  listCommands,
};
