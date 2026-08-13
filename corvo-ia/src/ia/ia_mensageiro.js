/**
 * 📨 𝒀𝑨𝑲𝑨𝑴𝒀 - MENSAGEIRO (recados entre pessoas do grupo via PV)
 *
 * Regra do dono: quando alguém do grupo pedir pra IA mandar mensagem no PV de
 * outra pessoa (levar um recado), a IA:
 *   1) resolve a pessoa pelo NOME (ou número) no MESMO grupo;
 *   2) entrega o recado no PV dela (com aviso de que pode responder aqui);
 *   3) guarda o recado como PENDENTE — se ela responder no PV, a IA leva a
 *      resposta DE VOLTA pro grupo (e avisa a pessoa original);
 *   4) SEMPRE notifica o DONO no PV do dono a cada uso (recado enviado e
 *      resposta entregue).
 */

const fs = require('fs');
const path = require('path');
const config = require('../../config');

const DONO = String(config.adminId || '');

// 💾 Recados pendentes/concluídos, persistidos em disco (sobrevivem a restart).
const RECADOS_FILE = path.join(__dirname, '..', '..', 'data', 'ia_recados.json');

// ⏱️ Cooldown anti-spam: cada usuário só pode mandar 1 recado por janela.
// Em memória (zera ao reiniciar) — suficiente pra frear spam de recados.
const RECADO_COOLDOWN_MS = 60 * 1000; // 60s entre recados da mesma pessoa
const recadoCooldown = new Map(); // número limpo -> timestamp do último recado

/** ⏳ Segundos que faltam pro cooldown de recado acabar (0 = liberado). */
function segundosRestantesCooldown(numeroOuJid) {
  const num = String(numeroDeJid(numeroOuJid) || '').replace(/\D/g, '');
  if (!num) return 0;
  const agora = Date.now();
  const falta = RECADO_COOLDOWN_MS - (agora - (recadoCooldown.get(num) || 0));
  return falta > 0 ? Math.ceil(falta / 1000) : 0;
}

/** ⏱️ Marca o cooldown do usuário (chamado SÓ depois do recado ser enviado). */
function registrarCooldownRecado(numeroOuJid) {
  const num = String(numeroDeJid(numeroOuJid) || '').replace(/\D/g, '');
  if (!num) return;
  recadoCooldown.set(num, Date.now());
  // 🧹 Limpeza leve pra o Map não crescer pra sempre
  if (recadoCooldown.size > 500) {
    const agora = Date.now();
    for (const [k, v] of recadoCooldown) {
      if (agora - v > RECADO_COOLDOWN_MS) recadoCooldown.delete(k);
    }
  }
}

function loadRecados() {
  try {
    if (fs.existsSync(RECADOS_FILE)) return JSON.parse(fs.readFileSync(RECADOS_FILE, 'utf8'));
  } catch (e) { /* arquivo ausente/corrompido */ }
  return [];
}

function saveRecados(lista) {
  try {
    fs.mkdirSync(path.dirname(RECADOS_FILE), { recursive: true });
    fs.writeFileSync(RECADOS_FILE, JSON.stringify(lista, null, 2));
  } catch (e) { /* falha de escrita não derruba */ }
}

function numeroDeJid(jid) {
  if (!jid) return null;
  return String(jid).split('@')[0].split(':')[0] || null;
}

/**
 * 📌 Monta a menção (@tag + jid completo) pra usar em mensagens de grupo.
 * Regra do dono: o mensageiro SEMPRE menciona os DOIS participantes — quem
 * pediu pra levar o recado e quem vai receber/responder.
 * @returns {{tag: string, jid: string}|null} ex: { tag: '@5511999999999', jid: '5511999999999@s.whatsapp.net' }
 */
function jidParaMencao(jid) {
  const s = String(jid || '').trim();
  if (!s) return null;
  const completo = s.includes('@') ? s : `${s}@s.whatsapp.net`;
  return { tag: `@${numeroDeJid(completo)}`, jid: completo };
}

/** 🔤 Normaliza nome pra comparação (minúsculo, sem acentos/símbolos). */
function normalizarNome(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * 🔎 Acha o número real de um membro do grupo pelo NOME (ou número direto).
 * Usa o groupMetadata do Baileys (fonte confiável: jid real de cada membro) e
 * também o cache de membros (ia_members.json) como fallback.
 * @returns {string|null} número sem @ (ex: 5511999999999) ou null
 */
async function resolverMembro(grupoJid, nomeOuNumero) {
  const alvo = String(nomeOuNumero || '').trim();
  if (!alvo) return null;
  const soNumero = alvo.replace(/\D/g, '');
  const ehNumero = /^\d{8,15}$/.test(soNumero);
  const alvoNorm = normalizarNome(alvo);
  if (!ehNumero && !alvoNorm) return null;

  // 🎯 groupMetadata (fonte primária — jid real, nome do pushname)
  try {
    const core = require('./ia_core');
    const c = core.getCore();
    if (c && c.corvo && typeof c.corvo.groupMetadata === 'function') {
      const meta = await c.corvo.groupMetadata(String(grupoJid));
      const parts = meta?.participants || [];
      if (ehNumero) {
        // 🔢 Número direto: SÓ devolve se a pessoa for do MESMO grupo
        // (regra do dono: recado só entre membros do grupo — nunca número
        // de fora, senão qualquer membro mandaria msg pra qualquer número).
        const porNumero = parts.find((p) => {
          const n = numeroDeJid(p.jid || p.id);
          return n && n.replace(/\D/g, '') === soNumero;
        });
        if (porNumero) return numeroDeJid(porNumero.jid || porNumero.id);
      } else {
        // Passa 1: nome exato normalizado (id/jid/lid/pushname/name)
        const exato = parts.find((p) => {
          const nomes = [p.id, p.lid, p.pushname, p.name, p.notify, p.verifiedName].filter(Boolean);
          return nomes.some((n) => {
            const nNum = numeroDeJid(n);
            return (nNum && nNum === alvoNorm) || normalizarNome(n) === alvoNorm;
          });
        });
        if (exato) return numeroDeJid(exato.jid || exato.id);
        // Passa 2: contém o nome (ex: "Maria" acha "Maria Silva")
        const contem = parts.find((p) => {
          const nomes = [p.pushname, p.name, p.notify, p.verifiedName].filter(Boolean);
          return nomes.some((n) => normalizarNome(n).includes(alvoNorm));
        });
        if (contem) return numeroDeJid(contem.jid || contem.id);
      }
    }
  } catch (e) { /* metadata falhou → fallback abaixo */ }

  // 💾 Fallback: cache de membros (ia_members.json)
  try {
    const { getMembers } = require('../grupo/memoria');
    const membros = getMembers(String(grupoJid));
    const alvoNum = numeroDeJid(alvo);
    const exato = membros.find((m) => normalizarNome(m.nome) === alvoNorm || (alvoNum && numeroDeJid(m.id) === alvoNum));
    if (exato) return numeroDeJid(exato.id);
    const contem = membros.find((m) => normalizarNome(m.nome).includes(alvoNorm));
    if (contem) return numeroDeJid(contem.id);
  } catch (e) { /* cache ausente */ }

  return null;
}

/**
 * 👑 Notifica o DONO no PV do dono (regra do dono: SEMPRE que o mensageiro
 * for usado). Falha silenciosa se não conseguir.
 */
async function notificarDono(texto) {
  try {
    if (!DONO) return false;
    const core = require('./ia_core');
    const c = core.getCore();
    if (c && c.corvo && typeof c.corvo.sendMessage === 'function') {
      await c.corvo.sendMessage(`${DONO}@s.whatsapp.net`, {
        text: `📨 *MENSAGEIRO*\n${String(texto || '').slice(0, 3000)}`,
      });
      return true;
    }
  } catch (e) { /* notificação não bloqueia */ }
  return false;
}

/**
 * 📨 LEVA um recado no PV de uma pessoa do MESMO grupo.
 * @param {object} o { grupoJid, grupoNome, deNome, deId, paraNome, texto }
 * @returns {Promise<object>} { ok, numero?, erro? }
 */
async function levarRecado(o = {}) {
  const { grupoJid, grupoNome, deNome, deId, paraNome, texto } = o;
  try {
    const paraNum = await resolverMembro(grupoJid, paraNome);
    if (!paraNum) {
      return { erro: `Não consegui achar ninguém chamado "${paraNome}" neste grupo. Confere o nome (como aparece no WhatsApp) ou manda o número com DDI.` };
    }
    if (String(paraNum).replace(/\D/g, '') === String(DONO).replace(/\D/g, '')) {
      return { erro: 'Essa pessoa é o DONO — manda o recado pra ele direto no grupo, ué. 😏' };
    }
    const textoLimpo = String(texto || '').slice(0, 1500);
    if (!textoLimpo.trim()) return { erro: 'Informe o texto do recado.' };

    // ⏱️ Anti-spam: cooldown por usuário (o DONO é isento — pode mandar quantos quiser)
    const ehDono = String(deId || '').replace(/\D/g, '') === String(DONO).replace(/\D/g, '');
    if (!ehDono) {
      const falta = segundosRestantesCooldown(deId);
      if (falta > 0) {
        return { erro: `Calma aí! Aguarde ${falta}s antes de mandar outro recado — todo mundo quer usar o mensageiro. 😉` };
      }
    }

    const recado = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      grupoJid: String(grupoJid || ''),
      grupoNome: String(grupoNome || '') || null,
      deNome: String(deNome || 'Alguém'),
      deId: String(deId || ''),
      paraNome: String(paraNome || ''),
      paraNum,
      texto: textoLimpo,
      status: 'pendente', // pendente | respondido | cancelado
      criadoEm: Date.now(),
      resposta: null,
      respondidoEm: null,
    };

    const core = require('./ia_core');
    const c = core.getCore();
    if (!c || !c.corvo) return { erro: 'Socket do WhatsApp não disponível no momento.' };
    await c.corvo.sendMessage(`${paraNum}@s.whatsapp.net`, {
      text: `📨 *Recado de ${recado.deNome}*\n\n"${textoLimpo}"\n\nSe quiser responder, é só me mandar a resposta AQUI que eu levo de volta pra ${recado.deNome}! 😉`,
    });

    // ⏱️ Marca o cooldown do remetente SÓ depois de enviar de verdade
    // (se o envio falhar, não queima o tempo da pessoa).
    if (!ehDono) registrarCooldownRecado(deId);

    // 💾 Guarda pendente (antes de confirmar no grupo — se salvar falhar,
    // não anuncia recado que não ficou registrado)
    const lista = loadRecados();
    lista.push(recado);
    saveRecados(lista.slice(-200));

    // 📣 Confirma no GRUPO mencionando os DOIS participantes (quem pediu o
    // mensageiro e quem vai receber) — sem expor o texto do recado (é privado).
    try {
      if (c && c.corvo && grupoJid) {
        const quemPediu = jidParaMencao(deId);
        const quemRecebe = jidParaMencao(`${paraNum}@s.whatsapp.net`);
        const mentions = [];
        let textoConfirm = '📨 *Mensageiro:* ';
        if (quemPediu) { textoConfirm += `${quemPediu.tag} mandou um recado no PV do `; mentions.push(quemPediu.jid); }
        else textoConfirm += `${recado.deNome} mandou um recado no PV do `;
        if (quemRecebe) { textoConfirm += `${quemRecebe.tag}! 📬 A resposta chega aqui quando a pessoa responder.`; mentions.push(quemRecebe.jid); }
        else textoConfirm += `${recado.paraNome}! 📬 A resposta chega aqui quando a pessoa responder.`;
        await c.corvo.sendMessage(grupoJid, { text: textoConfirm, mentions: mentions.length ? mentions : undefined });
      }
    } catch (e) { /* confirmação no grupo não bloqueia */ }

    // 👑 Avisa o dono SEMPRE (regra do dono)
    await notificarDono(
      `📤 *Recado enviado*\n👤 ${recado.deNome} → ${recado.paraNome}\n🏷️ Grupo: ${recado.grupoNome || recado.grupoJid}\n💬 "${textoLimpo.slice(0, 200)}"\n⏳ Aguardando resposta no PV.`
    );

    return { ok: true, numero: paraNum, recadoId: recado.id, aguardandoResposta: true };
  } catch (e) {
    return { erro: `Não consegui levar o recado: ${String(e.message || e).slice(0, 200)}` };
  }
}

/**
 * 📥 TRAZ A RESPOSTA de volta pro grupo + avisa a pessoa original.
 * Chamado quando a pessoa que RECEBEU o recado responde no PV da IA.
 * @param {object} o { deId, deNome, texto }
 */
async function responderRecado(o = {}) {
  const { deId, deNome, texto } = o;
  try {
    const deNum = numeroDeJid(deId);
    if (!deNum) return { erro: 'Não identifiquei quem está respondendo.' };
    const lista = loadRecados();
    // 🔎 Acha o recado PENDENTE cujo destinatário é quem está falando agora
    const recado = lista.find((r) => r.status === 'pendente' && String(r.paraNum).replace(/\D/g, '') === String(deNum).replace(/\D/g, ''));
    if (!recado) return { erro: 'Você não tem nenhum recado pendente pra responder por aqui.' };

    const resposta = String(texto || '').slice(0, 1500);
    if (!resposta.trim()) return { erro: 'Informe a resposta.' };

    recado.status = 'respondido';
    recado.resposta = resposta;
    recado.respondidoEm = Date.now();
    saveRecados(lista);

    const core = require('./ia_core');
    const c = core.getCore();
    const grupoAlvo = recado.grupoJid;

    // 📤 Entrega no grupo MENCIONANDO OS DOIS: quem respondeu (agora no PV)
    // e quem mandou o recado original (a pessoa do grupo).
    const original = jidParaMencao(recado.deId);
    const respondeu = jidParaMencao(deId);
    const mentions = [];
    const tagOriginal = original ? (mentions.push(original.jid), original.tag) : recado.deNome;
    const tagRespondeu = respondeu ? (mentions.push(respondeu.jid), respondeu.tag) : deNome;
    const msgGrupo = `📨 *${tagRespondeu} respondeu* o recado de ${tagOriginal}:\n\n"${resposta}"`;
    let entregueNoGrupo = false;
    try {
      if (c && c.corvo && grupoAlvo) {
        await c.corvo.sendMessage(grupoAlvo, { text: msgGrupo, mentions: mentions.length ? mentions : undefined });
        entregueNoGrupo = true;
      }
    } catch (e) { /* grupo pode ter mudado — segue */ }

    // 👑 Avisa o dono SEMPRE (regra do dono)
    await notificarDono(
      `📥 *Resposta do recado*\n👤 ${deNome} respondeu ${recado.deNome}\n🏷️ Grupo: ${recado.grupoNome || recado.grupoJid}\n📤 Recado: "${recado.texto.slice(0, 200)}"\n💬 Resposta: "${resposta.slice(0, 200)}"\n${entregueNoGrupo ? '✅ Entregue no grupo.' : '⚠️ Não consegui postar no grupo (pode ter saído).'}`
    );

    return {
      ok: true,
      entregueNoGrupo,
      resposta,
      para: recado.deNome,
      grupo: recado.grupoNome || recado.grupoJid,
    };
  } catch (e) {
    return { erro: `Erro ao responder o recado: ${String(e.message || e).slice(0, 200)}` };
  }
}

/** 📋 Recados PENDENTES para uma pessoa (para injetar no contexto da IA). */
function recadosPendentesPara(numeroOuJid) {
  const alvo = String(numeroDeJid(numeroOuJid) || '').replace(/\D/g, '');
  if (!alvo) return [];
  return loadRecados().filter(
    (r) => r.status === 'pendente' && String(r.paraNum).replace(/\D/g, '') === alvo
  );
}

/**
 * 🧠 Bloco de contexto para o prompt da IA: mostra os recados pendentes que a
 * pessoa RECEBEU — assim a IA sabe que a resposta no PV é pra levar de volta.
 */
function formatRecadosPendentes(numeroOuJid) {
  const pendentes = recadosPendentesPara(numeroOuJid);
  if (!pendentes.length) return '';
  const linhas = pendentes.map((r, i) =>
    `${i + 1}. De *${r.deNome}* (grupo ${r.grupoNome || r.grupoJid}): "${r.texto}"`
  ).join('\n');
  return (
    `\n📨 VOCÊ TEM RECADO(S) PENDENTE(S) (levados pela IA):\n${linhas}\n` +
    `Se esta mensagem for a RESPOSTA a um desses recados, use a ferramenta responder_recado para eu levar de volta pro grupo. Se for conversa normal, responda normal.\n`
  );
}

module.exports = {
  resolverMembro,
  levarRecado,
  responderRecado,
  recadosPendentesPara,
  formatRecadosPendentes,
};
