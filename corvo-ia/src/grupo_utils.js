/**
 * 🔧 𝒀𝑨𝑲𝑨𝑴𝒀 - UTILITÁRIOS DOS COMANDOS DO GRUPO
 * Helpers compartilhados: JSON, admin, alvo (reply/@menção)
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { DONO } = require('./ia/ia_core');
const DATA_DIR = path.join(__dirname, '..', 'data');

function loadJSON(file, fallback = {}) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file));
  } catch (e) {}
  return fallback;
}

function saveJSON(file, data) {
  try {
    if (!fs.existsSync(path.dirname(file))) fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {}
}

function isGroupChat(ctx) {
  return ctx.chat && ctx.chat.type && ctx.chat.type.includes('group');
}

/**
 * Verifica se o DONO do bot está presente no grupo.
 * A IA só deve responder em grupos onde o dono está — se ele não for
 * membro (left/kicked), retorna false para a IA ficar muda.
 */
// 👑 Cache do gate "dono no grupo": evita chamada de API a CADA mensagem
// (falha de rede/rate podia calar a IA intermitentemente) — resultado fica
// estável por 10 min por chat.
const donoNoGrupoCache = new Map(); // chatId -> { ok, ts }
const DONO_GRUPO_TTL = 10 * 60 * 1000;

const DONO_GRUPO_ERRO_TTL = 60 * 1000; // cache NEGATIVO do erro: evita martelar a API

function logDonoDebug(msg) {
  try {
    fs.appendFileSync(path.join(DATA_DIR, 'ia_debug.log'), `[${new Date().toLocaleTimeString()}] ${msg}\n`);
  } catch (e) {}
}
// (DATA_DIR é constante de módulo definida no topo — usada aqui e no module.exports)

async function isOwnerInGroup(ctx) {
  const key = String(ctx.chat?.id || '');
  const cached = donoNoGrupoCache.get(key);
  if (cached && Date.now() - cached.ts < DONO_GRUPO_TTL) return cached.ok;
  try {
    // 🔎 Tenta o número REAL do dono primeiro; se não for encontrado como
    // participante, tenta o LID configurado (ownerNumber[1]) — o WhatsApp pode
    // listar o dono no groupMetadata só pelo LID. getChatMember já compara as
    // 3 formas (jid/id/lid) de cada participante contra o alvo.
    // 🛡️ O getChatMember do ctx.js NUNCA lança: em erro de API ele já devolve
    // fail-open ({ status: 'member' }) internamente. Se algum dia lançar, o
    // catch externo abaixo preserva o fail-open original (cache 60s) — erro de
    // API não pode calar a IA.
    const alvos = [DONO, config.adminLid].filter((a) => String(a || '').trim());
    let member = null;
    for (const alvo of alvos) {
      const m = await ctx.telegram.getChatMember(ctx.chat?.id, alvo);
      if (m && m.status && m.status !== 'left' && m.status !== 'kicked') { member = m; break; }
    }
    const status = member?.status;
    let ok;
    if (!status) ok = false;
    else if (status === 'left' || status === 'kicked') ok = false;
    else if (status === 'restricted') ok = !!member.is_member;
    else ok = true; // creator, administrator, member
    donoNoGrupoCache.set(key, { ok, ts: Date.now() });
    return ok;
  } catch (e) {
    // Erro transitório (rede/rate): usa o último resultado conhecido. Se nunca
    // consultou, falha ABERTO (responde) — erro de API não pode calar a IA.
    // Cache NEGATIVO curto: não martela a API a cada mensagem enquanto falha.
    if (cached) {
      donoNoGrupoCache.set(key, { ok: cached.ok, ts: Date.now() - DONO_GRUPO_TTL + DONO_GRUPO_ERRO_TTL });
      return cached.ok;
    }
    // Cache negativo CONSISTENTE (60s), igual ao caminho com cache: evita
    // martelar a API e não deixa o fail-open aberto por 10min inteiros.
    donoNoGrupoCache.set(key, { ok: true, ts: Date.now() - DONO_GRUPO_TTL + DONO_GRUPO_ERRO_TTL });
    logDonoDebug(`⚠️ isOwnerInGroup falhou (fail-open, cache 60s): ${String(e?.message || e).slice(0, 120)}`);
    return true;
  }
}

/**
 * Verifica se o usuário é admin do grupo (ou dono do bot)
 */
async function isGroupAdmin(ctx) {
  try {
    const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
    // ⚠️ LID: compara o número real (user.id) e o id vinculado (lid), porque
    // o ctx.from.id pode vir como LID ou como JID dependendo do remetente.
    return admins.some(
      (a) => a.user.id === ctx.from.id || a.lid === ctx.from.id
    );
  } catch (e) {
    return false;
  }
}

/**
 * Resolve o usuário alvo: reply > @menção (text_mention) > dono ao mencionado
 * @returns {object|null} { id, name, username } ou null
 */
function resolveTarget(ctx) {
  const replyTo = ctx.message?.reply_to_message;

  if (replyTo?.from) {
    return {
      id: replyTo.from.id,
      name: replyTo.from.first_name || 'Usuário',
      username: replyTo.from.username
    };
  }

  const entities = ctx.message?.entities || [];
  for (const ent of entities) {
    if (ent.type === 'text_mention' && ent.user) {
      return {
        id: ent.user.id,
        name: ent.user.first_name || 'Usuário',
        username: ent.user.username
      };
    }
  }

  // @username no payload
  const match = ctx.message?.text?.match(/@([A-Za-z0-9_]{3,32})/);
  if (match) {
    return { id: null, name: match[1], username: match[1] };
  }

  return null;
}

/**
 * Extrai texto sem as menções (para /avisar, /totag etc.)
 */
function cleanText(ctx, text) {
  let clean = String(text || '');
  if (ctx.message?.entities) {
    clean = clean.replace(/@([A-Za-z0-9_]{3,32})/g, '').trim();
  }
  return clean.replace(/\/\w+\s*/, '').trim();
}

/**
 * Gera string com escape respeitando HTML
 */
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// --- INFORMAÇÕES DO PRÓPRIO BOT (para detectar @menção) ---
let botInfo = null;

/**
 * Guarda as informações do próprio bot (resultado do getMe): id + username.
 * Chamado no index.js logo após bot.telegram.getMe().
 */
function setBotInfo(info) {
  botInfo = info || null;
}

function getBotInfo() {
  return botInfo;
}

/**
 * Verifica se o bot foi @mencionado na mensagem (@username ou menção por ID).
 */
function isBotMentioned(ctx) {
  if (!ctx?.message?.entities?.length) return false;
  const text = ctx.message.text || '';
  const username = botInfo?.username ? String(botInfo.username).toLowerCase() : null;
  for (const ent of ctx.message.entities) {
    if (ent.type === 'mention') {
      const m = text.slice(ent.offset, ent.offset + ent.length).replace(/^@/, '').toLowerCase();
      if (username && m === username) return true;
    } else if (ent.type === 'text_mention') {
      if (botInfo && ent.user && String(ent.user.id) === String(botInfo.id)) return true;
    }
  }
  return false;
}

/**
 * Remove as menções (@username e text_mention) do texto da mensagem.
 */
function textoSemMencoes(ctx) {
  const text = ctx?.message?.text || '';
  const entities = ctx?.message?.entities || [];
  const ranges = entities
    .filter(e => e.type === 'mention' || e.type === 'text_mention')
    .map(e => [e.offset, e.offset + e.length])
    .sort((a, b) => b[0] - a[0]);
  let out = text;
  for (const [s, e] of ranges) {
    out = out.slice(0, s) + out.slice(e);
  }
  return out.replace(/\s+/g, ' ').trim();
}

module.exports = {
  loadJSON,
  saveJSON,
  isGroupChat,
  isOwnerInGroup,
  isGroupAdmin,
  resolveTarget,
  cleanText,
  escapeHtml,
  setBotInfo,
  getBotInfo,
  isBotMentioned,
  textoSemMencoes,
  DATA_DIR
};