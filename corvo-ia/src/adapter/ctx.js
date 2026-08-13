// 🧠 𝒀𝑨𝑲𝑨𝑴𝒀-IA — Adaptador de contexto: mensagem do 𝒀𝑨𝑲𝑨𝑴𝒀 (Baileys) → ctx da IA.
// O cérebro (ia_agent) espera um ctx com a forma do Telegraf. Este adaptador
// traduz a mensagem crua do WhatsApp para essa forma, sem tocar no corvo.
const path = require('path');
const fs = require('fs');

function extrairTexto(msg) {
  const m = msg?.message || {};
  // 🔘 Clique em botão/enquete: vira texto natural pra IA entender (e pra
  // memória do chat não poluir com marcador cru). O id dos botões da própria
  // IA começa com "IA|" — o prefixo é tirado, fica só a opção escolhida.
  // Botões do corvo (listResponse/templateButton) também são capturados pra
  // resposta seguir o fluxo do bot.
  let botao = '';
  try {
    botao =
      m.buttonsResponseMessage?.selectedButtonId ||
      m.listResponseMessage?.singleSelectReply?.selectedRowId ||
      m.templateButtonReplyMessage?.selectedId ||
      '';
    if (!botao && m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
      try {
        botao = JSON.parse(m.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)?.id || '';
      } catch (e) { botao = ''; }
    }
  } catch (e) { botao = ''; }
  const opcao = String(botao || '').replace(/^IA\|/i, '').trim();
  const textoBotao = opcao ? `O usuário clicou no botão: ${opcao}` : '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    textoBotao ||
    ''
  ).trim();
}

function numeroDeJid(jid) {
  if (!jid) return null;
  return String(jid).split('@')[0].split(':')[0] || null;
}

// 🗺️ Mapa aprendido LID → número REAL. O WhatsApp entrega o remetente de
// grupos como @lid (número aleatório); o telefone real fica no campo jid dos
// participantes do groupMetadata. A cada metadata que vemos, aprendemos o par
// (lid do participante → jid real) e usamos para reconhecer o DONO (e qualquer
// usuário) mesmo quando o contexto só tem o LID.
const lidToReal = new Map(); // lid (sem @) -> número real (sem @)

// 💾 PERSISTÊNCIA do mapa LID→real: o WhatsApp RODA os LIDs (números aleatórios
// de remetente que mudam com o tempo). Sem salvar em disco, o mapa morre no
// restart e volta a depender do seed do users.json — que pode ter mapeamentos
// antigos/errados (rotação de LID do DONO → isDono falso → a IA nega as
// ferramentas de PC). O par aprendido do groupMetadata (lid + jid do MESMO
// participante) é a fonte confiável; guardamos em data/lid_to_real.json e
// recarregamos no boot.
const LID_MAP_FILE = path.join(__dirname, '..', '..', 'data', 'lid_to_real.json');
let lidMapSaveTimer = null;
function salvarLidMap() {
  try {
    if (lidMapSaveTimer) clearTimeout(lidMapSaveTimer);
    lidMapSaveTimer = setTimeout(() => {
      try {
        fs.mkdirSync(path.dirname(LID_MAP_FILE), { recursive: true });
        fs.writeFileSync(LID_MAP_FILE, JSON.stringify([...lidToReal.entries()]));
      } catch (e) { /* persistência não derruba */ }
    }, 500);
  } catch (e) { /* timer não derruba */ }
}
function carregarLidMap() {
  try {
    if (!fs.existsSync(LID_MAP_FILE)) return;
    const arr = JSON.parse(fs.readFileSync(LID_MAP_FILE, 'utf8'));
    if (!Array.isArray(arr)) return;
    for (const [lid, real] of arr) {
      if (lid && real && !lidToReal.has(String(lid))) lidToReal.set(String(lid), String(real));
    }
  } catch (e) { /* arquivo ausente/corrompido não derruba */ }
}

function aprenderLid(p) {
  try {
    // 🗃️ Garante o mapa carregado do disco + seed ANTES de qualquer aprendizado.
    // 🐛 FIX 2026-08-10: o resolverJid em GRUPO aprende sem chamar
    // semearLidToReal (só o PV e o ehDono chamavam). Sem isso, no restart em
    // que a 1ª mensagem é de grupo, o salvarLidMap sobrescreveria o arquivo
    // com só os pares em memória — perdendo os aprendidos de sessões
    // anteriores (rotação de LID do dono voltaria a quebrar). No-op se já
    // semeado (guard lidSeedFeito).
    semearLidToReal();
    const lid = p && (p.lid || p.id) ? String(p.lid || p.id).split('@')[0].split(':')[0] : null;
    const real = p && p.jid ? String(p.jid).split('@')[0].split(':')[0] : null;
    // 🐛 FIX 2026-08-10: o groupMetadata é a FONTE CONFIÁVEL (lid + jid do MESMO
    // participante). Antes, o `!lidToReal.has(lid)` BLOQUEAVA a correção quando o
    // seed do users.json tinha mapeado o LID pro número errado (rotação de LID do
    // dono → isDono falso → IA negava ferramentas de PC). Agora SEMPRE
    // sobrescreve com o par autoritativo e persiste em disco.
    if (lid && real && lid !== real) {
      lidToReal.set(lid, real);
      salvarLidMap();
    }
  } catch (e) { /* participante malformado não derruba */ }
}

// 🗃️ SEMEIA o mapa LID → número REAL a partir do users.json do corvo. O corvo
// registra cada usuário tanto como @s.whatsapp.net quanto como @lid (mesmo
// nick). Pareando os dois, o LID do dono (e de qualquer usuário) fica
// conhecido MESMO sem groupMetadata — resolve o reconhecimento no PV, que
// não tem o fallback do grupo.
let lidSeedFeito = false;
function semearLidToReal() {
  if (lidSeedFeito) return;
  lidSeedFeito = true;
  try {
    // 💾 Recarrega os pares aprendidos de sessões anteriores (sobrevivem ao restart)
    carregarLidMap();
    // 🛡️ Par AUTORITATIVO do dono (config): garante o reconhecimento dele no
    // PV mesmo se users.json estiver vazio/desatualizado ou o nick colidir.
    try {
      const cfg = require('../../config');
      if (cfg.adminId && cfg.adminLid) lidToReal.set(String(cfg.adminLid).split('@')[0].split(':')[0], String(cfg.adminId).split('@')[0].split(':')[0]);
    } catch (e) { /* config ausente não derruba */ }
    const p = path.join(__dirname, '..', '..', '..', 'corvo_dados', 'usuarios', 'users.json');
    if (!fs.existsSync(p)) return;
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!Array.isArray(arr)) return;
    // 🔤 NORMALIZA o nick (minúsculo, só letras/números): "Yakamy", "Yakamy </>",
    // "YAKAMY  </>" viram todos "yakamy". Antes o agrupamento era por nick EXATO e
    // os LIDs do dono (que rotacionam) ficavam espalhados em grupos com números
    // errados — o dono não era reconhecido e a IA negava as ferramentas de PC.
    const normNick = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    // nick -> { reals:Set, lids[] } (agrupa as formas de cada pessoa pelo nick)
    const porNick = new Map();
    for (const u of arr) {
      const id = u && (u.id || u.jid);
      if (!id) continue;
      const num = numeroDeJid(id);
      const nick = normNick(u && u.nick);
      if (!num || !nick) continue;
      if (!porNick.has(nick)) porNick.set(nick, { reals: new Set(), lids: [] });
      const e = porNick.get(nick);
      if (String(id).endsWith('@lid')) e.lids.push(num);
      else e.reals.add(num);
    }
    // 👑 ANCORA NO DONO: se o grupo de nick contém o número real do dono, TODOS
    // os LIDs desse nick são do dono (os LIDs dele rotacionam e aparecem com
    // variações de nick). Antes cada variação virava um grupo separado e os LIDs
    // do dono mapeavam pro número errado → isDono falso no grupo/PV.
    try {
      const cfg2 = require('../../config');
      const adminNum = String(cfg2.adminId || '').split('@')[0].split(':')[0];
      if (adminNum) {
        for (const [nick, e] of porNick) {
          if (e.reals.has(adminNum) && e.lids.length) {
            for (const lid of e.lids) {
              if (!lidToReal.has(lid)) { lidToReal.set(lid, adminNum); salvarLidMap(); }
            }
          }
        }
      }
    } catch (e) { /* config ausente não derruba */ }
    for (const [nick, e] of porNick) {
      // 🔒 Só mapeia quando o nick tem UM único número real — se dois usuários
      // diferentes têm o mesmo nick (ex: "Membro", "Fulano"), NÃO adivinha
      // (mapear pro errado trocaria o userId e quebraria VIP/limites/memória).
      if (e.reals.size !== 1 || !e.lids.length) continue;
      const real = [...e.reals][0];
      for (const lid of e.lids) {
        if (!lidToReal.has(lid)) lidToReal.set(lid, real);
      }
    }
  } catch (e) { /* semear não derruba */ }
}

// 🗃️ CACHE ÚNICO de groupMetadata (compartilhado entre resolverJid, ehOBot,
// getChat, getChatAdministrators e getChatMember). Evita chamar a API do
// WhatsApp várias vezes para o MESMO grupo numa mesma mensagem (antes eram
// até 5 chamadas por resposta da IA). TTL de 1min + dedup de chamadas
// concorrentes (mesma promise enquanto estiver em voo).
const metaCache = new Map(); // jid -> { ts, promise, inFlight }
const META_TTL_MS = 60 * 1000;

async function getGroupMetadata(corvo, chatId) {
  const key = String(chatId || '');
  if (!key) return null;
  const now = Date.now();
  const hit = metaCache.get(key);
  if (hit && now - hit.ts < META_TTL_MS) return hit.promise;

  // 🔁 dedup: se já tem uma busca em andamento, reutiliza (não dispara outra)
  if (hit && hit.inFlight) return hit.promise;

  // 🧹 hit expirado: descarta antes de recriar (evita segurar dados velhos)
  if (hit) metaCache.delete(key);

  // 🧹 teto de tamanho: evita crescimento infinito em bot de longa duração
  if (metaCache.size >= 500) {
    const agora = Date.now();
    for (const [k, e] of metaCache) {
      if (!e.inFlight && agora - e.ts >= META_TTL_MS) metaCache.delete(k);
    }
  }

  const entry = { ts: now, inFlight: true, promise: null };
  entry.promise = (async () => {
    try {
      return await corvo.groupMetadata(key);
    } catch (e) {
      // erro transitório: remove do cache p/ tentar de novo na próxima
      metaCache.delete(key);
      throw e;
    } finally {
      entry.inFlight = false;
      // ⏱ TTL conta da RESOLUÇÃO (não do início): fetch lento não come o cache
      entry.ts = Date.now();
    }
  })();
  metaCache.set(key, entry);
  return entry.promise;
}

/**
 * Monta um ctx compatível com o cérebro da IA a partir de uma mensagem do corvo.
 * @param {object} opts { corvo, upsert, config }
 */
function criarCtx({ corvo, upsert, config }) {
  const msgs = upsert?.messages || [];
  const msg = msgs[0];
  const jid = msg?.key?.remoteJid || '';
  const ehGrupo = String(jid).endsWith('@g.us');
  const autorJid = msg?.key?.participant || jid;
  const autorNum = numeroDeJid(autorJid);
  const nomeAutor = msg?.pushName || 'Usuário';

  return {
    // 🔧 estado interno (o cérebro não usa, mas o entry precisa)
    _corvo: corvo,
    _upsert: upsert,
    _jid: jid,
    _ehGrupo: ehGrupo,

    // 📌 forma Telegraf-like que o cérebro espera
    chat: {
      id: jid,
      type: ehGrupo ? 'group' : 'private',
      title: null,
    },
    from: {
      id: autorNum,
      first_name: nomeAutor,
      username: null,
    },
    message: {
      message_id: msg?.key?.id || null,
      text: extrairTexto(msg),
      reply_to_message: null,
    },

    // ✍️ envio de resposta
    reply: (texto) => corvo.sendMessage(jid, { text: String(texto) }),
    replyWithVoice: async (buffer) => {
      await corvo.sendMessage(jid, {
        audio: buffer,
        ptt: true,
        mimetype: 'audio/ogg; codecs=opus',
      });
    },
    replyWithChatAction: async () => {},

    // 👥 grupo (o cérebro usa para saber onde está)
    // 🔎 Resolve o número REAL de um participante (LID → JID) via groupMetadata.
    // Em grupos, o WhatsApp pode mandar o remetente como @lid (número aleatório);
    // o telefone de verdade fica no campo jid dos participantes. Usado para
    // reconhecer o DONO (e qualquer usuário) corretamente dentro do grupo.
    resolverJid: async (usuarioId) => {
      if (!ehGrupo) {
        // 🐛 FIX dono no PV: antes devolvia o número CRU (que podia ser o LID)
        // e nunca consultava o mapa — no PV o dono chegando como @lid não era
        // reconhecido (o grupo tem fallback via groupMetadata, o PV não).
        // Agora PREFERE o número REAL resolvido (lidToReal semeado + aprendido)
        // e só cai pro número cru quando não há mapeamento.
        semearLidToReal();
        const bruto = numeroDeJid(autorJid);
        return lidToReal.get(bruto) || bruto || null;
      }
      try {
        const meta = await getGroupMetadata(corvo, jid);
        // 🗺️ Aprende os pares LID→real deste grupo (para o ehDono e para DMs)
        try { (meta?.participants || []).forEach(aprenderLid); } catch (e) {}
        const alvo = String(usuarioId || '').split('@')[0].split(':')[0];
        const parte = (meta?.participants || []).find((p) => {
          const cands = [p && p.id, p && p.lid].filter(Boolean);
          return cands.some((c) => String(c).split('@')[0].split(':')[0] === alvo);
        });
        return parte ? numeroDeJid(parte.jid || parte.id) : lidToReal.get(alvo) || null;
      } catch (e) {
        return lidToReal.get(String(usuarioId || '').split('@')[0].split(':')[0]) || null;
      }
    },

    // 👑 O usuário é o DONO do bot? Aceita o número real, o LID configurado
    // (config.adminLid) ou o LID aprendido (mapa lidToReal). Mesma lógica do
    // ehOBot: compara as 3 formas (jid/id/lid) de quem fala contra o dono.
    ehDono: async (usuarioId) => {
      semearLidToReal(); // 🗃️ garante o mapa (dono reconhecido no PV mesmo sem grupo)
      const alvo = String(usuarioId || '').split('@')[0].split(':')[0];
      const donoNum = String(config.adminId || '').split('@')[0].split(':')[0];
      const donoLid = String(config.adminLid || '').split('@')[0].split(':')[0];
      if (!alvo) return false;
      // 1) número real bate direto
      if (alvo === donoNum) return true;
      // 2) LID configurado bate
      if (donoLid && alvo === donoLid) return true;
      // 3) LID aprendido resolve para o número do dono
      if (lidToReal.get(alvo) === donoNum) return true;
      if (!ehGrupo) return false;
      // 4) em grupo: acha o participante do dono e compara com quem fala
      try {
        const meta = await getGroupMetadata(corvo, jid);
        try { (meta?.participants || []).forEach(aprenderLid); } catch (e) {}
        const dono = (meta?.participants || []).find((p) => {
          const cands = [p && (p.jid || p.id), p && p.id, p && p.lid].filter(Boolean);
          return cands.some((c) => String(c).split('@')[0].split(':')[0] === donoNum);
        });
        if (!dono) return false;
        const donoCands = [dono && (dono.jid || dono.id), dono && dono.id, dono && dono.lid].filter(Boolean);
        return donoCands.some((c) => String(c).split('@')[0].split(':')[0] === alvo);
      } catch (e) {
        return false;
      }
    },

    // 🤖 O JID é o PRÓPRIO BOT? Usado nos triggers de @menção e reply: o
    // WhatsApp pode mandar o JID do bot como LID (número aleatório, ex
    // 123456789012345@lid) em vez do número real — comparar só o número
    // falhava. Resolve o LID do bot via groupMetadata (participante cujo
    // jid == número do bot) e compara as 3 formas (jid/id/lid).
    ehOBot: async (jidAlvo) => {
      if (!jidAlvo) return false;
      const alvo = numeroDeJid(jidAlvo);
      const botNum = numeroDeJid(corvo && corvo.user && corvo.user.id);
      if (alvo && botNum && alvo === botNum) return true;
      if (!ehGrupo) return false;
      try {
        const meta = await getGroupMetadata(corvo, jid);
        const eu = (meta?.participants || []).find(
          (p) => numeroDeJid(p.jid || p.id) === botNum
        );
        if (!eu) return false;
        const cands = [eu && (eu.jid || eu.id), eu && eu.id, eu && eu.lid].filter(Boolean);
        return cands.some((c) => numeroDeJid(c) === alvo);
      } catch (e) {
        return false;
      }
    },
    getChat: async () => {
      if (!ehGrupo) return { description: null, member_count: null, title: null, participants: [] };
      try {
        const meta = await getGroupMetadata(corvo, jid);
        // 👥 TODOS os participantes (número real + nome + admin) — a IA usa pra
        // saber QUEM é membro do grupo, independente da quantidade de grupos.
        const participants = (meta?.participants || []).map((p) => ({
          id: numeroDeJid(p.jid || p.id),
          nome: p.name || p.pushname || numeroDeJid(p.jid || p.id) || 'Membro',
          admin: !!p.admin,
        }));
        return {
          description: meta?.desc || meta?.description || null,
          member_count: participants.length,
          title: meta?.subject || null,
          participants,
        };
      } catch (e) {
        return { description: null, member_count: null, title: null, participants: [] };
      }
    },
    telegram: {
      getChatAdministrators: async () => {
        if (!ehGrupo) return [];
        try {
          const meta = await getGroupMetadata(corvo, jid);
          return (meta?.participants || [])
            .filter((p) => p.admin)
            .map((p) => ({
              user: { id: numeroDeJid(p.jid || p.id), first_name: numeroDeJid(p.jid || p.id) || '?' },
              // ⚠️ LID: guarda também o id vinculado p/ comparação robusta
              lid: numeroDeJid(p.id),
            }));
        } catch (e) {
          return [];
        }
      },
      // 👍 Reação a uma mensagem (Baileys: sendMessage com react). Compatível
      // com a chamada do Telegraf setMessageReaction(chatId, messageId, [{emoji}]).
      // O messageId é o id da mensagem do WhatsApp (msg.key.id). Falha silenciosa.
      setMessageReaction: async (chatId, messageId, reactions) => {
        try {
          const e = Array.isArray(reactions) && reactions[0] && reactions[0].emoji;
          if (!e || !chatId || !messageId) return false;
          await corvo.sendMessage(String(chatId), {
            react: { text: String(e), key: { remoteJid: String(chatId), id: String(messageId), fromMe: false } },
          });
          return true;
        } catch (err) {
          return false;
        }
      },
      getChatMember: async (chatId, userId) => {
        // 👑 Verifica se um usuário (ex: o dono) é membro do grupo — usado pelo
        // gate isOwnerInGroup. O Baileys não tem getChatMember: checa nos
        // participantes do groupMetadata se o número bate.
        // ⚠️ Atenção: cada participante pode ter id (LID aleatório), jid
        // (número real) e lid. O número do dono só casa com o jid — por isso
        // comparamos as 3 formas.
        try {
          const meta = await getGroupMetadata(corvo, chatId || jid);
          const alvo = String(userId || '').split('@')[0].split(':')[0];
          const parte = (meta?.participants || []).find((p) => {
            const cands = [p && (p.jid || p.id), p && p.id, p && p.lid].filter(Boolean);
            return cands.some((c) => String(c).split('@')[0].split(':')[0] === alvo);
          });
          if (!parte) return { status: 'left' };
          return { status: parte.admin ? 'administrator' : 'member', is_member: true };
        } catch (e) {
          return { status: 'member', is_member: true };
        }
      },
      sendChatAction: async () => {},
    },
  };
}

// 🎙️ Baixa uma mídia (áudio/imagem) da mensagem do corvo
async function baixarMidia(corvo, msg) {
  try {
    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      { logger: undefined, reuploadRequest: corvo.updateMediaMessage.bind(corvo) }
    );
    return buffer;
  } catch (e) {
    return null;
  }
}

module.exports = { criarCtx, extrairTexto, numeroDeJid, baixarMidia };
