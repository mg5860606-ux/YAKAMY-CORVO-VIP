/**
 * 📚 𝒀𝑨𝑲𝑨𝑴𝒀 - /buscar e /memoria
 * Busca no histÃ³rico de mensagens recentes do grupo (mantido em memÃ³ria)
 */

const fs = require('fs');
const path = require('path');

const store = new Map(); // chatId -> [{id, user, userId, text, ts}]

// ===== LOG PERSISTENTE DA CONVERSA DO GRUPO (a IA sabe o que o povo conversa) =====
// Cada chat guarda as últimas N mensagens em disco (data/ia_chat_log/<chatId>.json).
// Assim a memória sobrevive a reinício do bot e a IA vê mais do papo do grupo.
const LOG_DIR = path.join(__dirname, '..', '..', 'data', 'ia_chat_log');
const LOG_MAX = 300; // mensagens por chat guardadas em disco
const STORE_MAX = 200; // janela em memória
const LOG_DEBOUNCE_MS = 4000; // grava no disco no máx. 1x a cada 4s (evita I/O a cada msg)
const saveTimers = new Map(); // chatId -> timeout

function chatLogFile(chatId) {
  return path.join(LOG_DIR, String(chatId).replace(/[^\w-]/g, '_') + '.json');
}

function loadChatLog(chatId) {
  try {
    const arr = JSON.parse(fs.readFileSync(chatLogFile(chatId), 'utf-8'));
    if (Array.isArray(arr)) return arr.slice(-LOG_MAX);
  } catch (e) { /* arquivo ausente/corrompido */ }
  return [];
}

function saveChatLog(chatId, arr) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.writeFileSync(chatLogFile(chatId), JSON.stringify(arr.slice(-LOG_MAX)));
  } catch (e) { /* falha de escrita não derruba o bot */ }
}

function scheduleChatLogSave(chatId) {
  if (saveTimers.has(chatId)) return;
  saveTimers.set(chatId, setTimeout(() => {
    saveTimers.delete(chatId);
    try {
      const arr = store.get(chatId) || [];
      // mescla com o que já estava em disco (não perde histórico antigo)
      const disc = loadChatLog(chatId);
      const combinado = [...disc, ...arr];
      // deduplica por message_id (mantém o mais novo)
      const porId = new Map();
      for (const m of combinado) if (m && m.id) porId.set(m.id, m);
      saveChatLog(chatId, [...porId.values()].sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(-LOG_MAX));
    } catch (e) {}
  }, LOG_DEBOUNCE_MS));
}

/** Cache curto p/ evitar leitura síncrona de disco a cada request da IA */
const chatLogCache = new Map(); // chatId -> { ts, arr }
const CHAT_LOG_CACHE_MS = 15000;

/** Retorna o log PERSISTIDO de um chat (mesmo se o bot reiniciou) */
function getChatLog(chatId, limit = 20) {
  const agora = Date.now();
  const cached = chatLogCache.get(chatId);
  let arr;
  if (cached && agora - cached.ts < CHAT_LOG_CACHE_MS) {
    arr = cached.arr;
  } else {
    const disc = loadChatLog(chatId);
    const mem = store.get(chatId) || [];
    const porId = new Map();
    for (const m of [...disc, ...mem]) if (m && m.id) porId.set(m.id, m);
    arr = [...porId.values()].sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(-LOG_MAX);
    chatLogCache.set(chatId, { ts: agora, arr });
  }
  return arr.slice(-Math.max(limit, 20));
}
// ===== REGISTRO PERSISTENTE DE MEMBROS DO GRUPO (quem é quem) =====
const MEMBERS_FILE = path.join(__dirname, '..', '..', 'data', 'ia_members.json');

function loadMembers() {
  try { if (fs.existsSync(MEMBERS_FILE)) return JSON.parse(fs.readFileSync(MEMBERS_FILE, 'utf-8')); } catch (e) {}
  return {};
}

function registerMember(chatId, user) {
  if (!user || !user.id) return;
  const data = loadMembers();
  const key = String(chatId);
  if (!data[key]) data[key] = {};
  const uid = String(user.id);
  const cur = data[key][uid] || {};
  data[key][uid] = {
    nome: user.first_name || cur.nome || 'Membro',
    sobrenome: user.last_name || cur.sobrenome || null,
    username: user.username || cur.username || null,
    primeiroVisto: cur.primeiroVisto || Date.now(),
    ultimaVez: Date.now(),
    msgs: (cur.msgs || 0) + 1,
  };
  try { fs.mkdirSync(path.dirname(MEMBERS_FILE), { recursive: true }); fs.writeFileSync(MEMBERS_FILE, JSON.stringify(data)); } catch (e) {}
}

/**
 * 👥 Registra VÁRIOS membros de uma vez (ex: todos os participantes do grupo)
 * com UMA ÚNICA gravação em disco — evita N writes síncronos por resposta da
 * IA em grupos grandes. NÃO incrementa o contador `msgs` (quem ainda não
 * falou fica com 0, então o ranking "quem mais fala" não é corrompido).
 */
function registerMembers(chatId, users) {
  if (!Array.isArray(users) || !users.length) return;
  const data = loadMembers();
  const key = String(chatId);
  if (!data[key]) data[key] = {};
  let mudou = false;
  for (const user of users) {
    if (!user || !user.id) continue;
    const uid = String(user.id);
    const cur = data[key][uid] || {};
    if (!data[key][uid]) {
      data[key][uid] = {
        nome: user.first_name || user.nome || 'Membro',
        sobrenome: user.last_name || cur.sobrenome || null,
        username: user.username || cur.username || null,
        primeiroVisto: Date.now(),
        ultimaVez: Date.now(),
        msgs: 0,
      };
      mudou = true;
    }
  }
  if (mudou) {
    try { fs.mkdirSync(path.dirname(MEMBERS_FILE), { recursive: true }); fs.writeFileSync(MEMBERS_FILE, JSON.stringify(data)); } catch (e) {}
  }
}

function getMembers(chatId) {
  const data = loadMembers();
  return Object.entries(data[String(chatId)] || {})
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => (b.msgs || 0) - (a.msgs || 0));
}

function formatMembers(chatId, limit = 40) {
  const arr = getMembers(chatId);
  if (!arr.length) return '';
  let out = `\n📇 QUEM É QUEM NESTE GRUPO (${arr.length} membros registrados):\n`;
  out += arr.slice(0, limit).map(m => {
    const handle = m.username ? ` @${m.username}` : '';
    const dono = String(m.id) === String(adminId()) ? ' 👑' : '';
    return `• ${m.nome}${hints(m.sobrenome)}${handle} (${m.id})${dono}`;
  }).join('\n');
  return out;
}

function adminId() { try { return require('../../config').adminId; } catch (e) { return null; } }
function hints(s) { return s ? ` ${s}` : ''; }

function recentConversation(chatId, limit = 20) {
  const arr = getChatLog(chatId, limit);
  if (!arr.length) return '';
  return '\n💬 CONVERSA RECENTE DO GRUPO (para você saber o que estão falando):\n' +
    arr.slice(-limit).map(m => `• ${m.user}: ${m.text.slice(0, 150)}`).join('\n');
}

/**
 * 🗣️ HISTÓRICO DA PESSOA QUE ESTÁ FALANDO: retorna o que aquele usuário
 * específico andou dizendo no grupo (filtra o log por userId). Aceita um id
 * ou uma lista (ex: número real + LID) — normaliza tirando @ e :, então casa
 * mesmo se o log gravou o LID e o contexto resolveu o número real. Sem
 * histórico = string vazia (a IA não inventa nada).
 */
function userHistory(chatId, userIds, limit = 12) {
  const alvos = new Set(
    (Array.isArray(userIds) ? userIds : [userIds])
      .filter(Boolean)
      .map((id) => String(id).split('@')[0].split(':')[0])
  );
  if (!alvos.size) return '';
  const arr = getChatLog(chatId, 300);
  const doUser = arr.filter((m) => {
    const uid = m && m.userId ? String(m.userId).split('@')[0].split(':')[0] : null;
    return uid && alvos.has(uid);
  });
  if (!doUser.length) return '';
  return '\n🗣️ O QUE ESTA PESSOA ANDOU FALANDO NO GRUPO (para você saber com quem conversa):\n' +
    doUser.slice(-limit).map((m) => `• ${m.user}: ${String(m.text || '').slice(0, 150)}`).join('\n');
}

function rememberMessage(chatId, message) {
  if (!store.has(chatId)) store.set(chatId, []);
  const arr = store.get(chatId);
  arr.push({
    id: message.message_id,
    user: message.from?.first_name || 'Usuário',
    userId: message.from?.id,
    text: (message.text || message.caption || '').slice(0, 200),
    ts: Date.now(),
  });
  if (arr.length > STORE_MAX) arr.splice(0, arr.length - STORE_MAX);
  chatLogCache.delete(chatId); // mensagem nova = cache inválido
  scheduleChatLogSave(chatId);
  registerMember(chatId, message.from);
}

const MAX_AGE = 30 * 60 * 1000; // 30 min

module.exports = [
  {
    command: 'buscar',
    description: 'Buscar no histÃ³rico do grupo (/buscar termo)',
    handler: async (ctx) => {
      const q = ctx.message.text.replace(/^\/(\w+)@?\w*\s*/, '').trim().toLowerCase();
      if (!q) return ctx.reply('âŒ Uso: /buscar termo');
      const arr = (store.get(ctx.chat?.id) || []).filter(m => Date.now() - m.ts < MAX_AGE && m.text.toLowerCase().includes(q));
      if (!arr.length) return ctx.reply('ðŸ“­ Nada encontrado nas Ãºltimas 30min.');
      let txt = `ðŸ” *BUSCA PARA: "${q}"*\n\n`;
      arr.slice(-8).forEach(m => {
        const ago = Math.round((Date.now() - m.ts) / 60000);
        txt += `â€¢ *${m.user}* (hÃ¡ ${ago}min): ${m.text.slice(0, 60)}\n`;
      });
      ctx.reply(txt, { parse_mode: 'Markdown' }).catch(() => {});
    }
  },
  {
    command: 'memoria',
    description: 'EstatÃ­sticas da memÃ³ria do grupo',
    handler: async (ctx) => {
      const arr = store.get(ctx.chat?.id) || [];
      const users = new Set(arr.map(m => m.userId));
      ctx.replyWithMarkdown(
        `ðŸ“š *MEMÃ“RIA DO GRUPO*\n\n` +
        `ðŸ’¬ Mensagens recentes: *${arr.length}*\n` +
        `ðŸ‘¥ UsuÃ¡rios ativos: *${users.size}*\n` +
        `â± Janela: Ãºltimas 30min`
      );
    }
  }
];

module.exports._store = store;
module.exports.rememberMessage = rememberMessage;
module.exports.registerMember = registerMember;
module.exports.registerMembers = registerMembers;
module.exports.getMembers = getMembers;
module.exports.formatMembers = formatMembers;
module.exports.recentConversation = recentConversation;
module.exports.userHistory = userHistory;
module.exports.getChatLog = getChatLog;
