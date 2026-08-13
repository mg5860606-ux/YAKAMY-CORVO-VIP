/**
 * 🧠 corvo - NÚCLEO DO BOT PARA A IA
 * Ponte entre o agente (ia_tools) e as funções internas do bot corvo (Baileys).
 * A IA consegue administrar o bot de verdade: VIP, ban, broadcast, stats,
 * enviar mensagens e EXECUTAR COMANDOS DO corvo (domina a corvo).
 * O corvo-ia.js registra as funções reais no boot via setCore().
 */

const fs = require('fs');
const path = require('path');
const config = require('../../config');
let sharp = null;
try { sharp = require('sharp'); } catch (e) { sharp = null; }

const DONO = String(config.adminId || '');

// 📁 Dados do bot corvo (formato dos arquivos do corvo.js)
const CORVO_DADOS_USUARIOS = path.resolve(__dirname, '..', '..', '..', 'corvo_dados', 'usuarios');
const VIP_FILE = path.join(CORVO_DADOS_USUARIOS, 'vip.json');
const BANNED_FILE = path.join(CORVO_DADOS_USUARIOS, 'banned.json');
const USERS_FILE = path.join(CORVO_DADOS_USUARIOS, 'users.json');
const MUTED_FILE = path.resolve(__dirname, '..', '..', '..', 'corvo_dados', 'grupos', 'muted.json'); // formato corvo: [{grupo, usus: []}]

// 🗂️ Dados da própria IA (anexos/downloads/imagens — zonas liberadas)
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');

let core = null;

function setCore(fns) {
  core = fns;
}

function isReady() {
  return !!core;
}

function getCore() {
  if (!core) throw new Error('Núcleo do bot ainda não foi registrado (setCore não chamado no corvo-ia.js).');
  return core;
}

// ===== HELPERS DE ARQUIVO (formato corvo) =====
function loadJSON(file, fallback = []) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {}
  return fallback;
}

function saveJSON(file, data) {
  try {
    if (!fs.existsSync(path.dirname(file))) fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {}
}

function logEvent(tipo, msg) {
  try {
    const c = getCore();
    if (typeof c.logEvent === 'function') c.logEvent(tipo, msg);
  } catch (e) {}
  try {
    console.log(`[𝒀𝑨𝑲𝑨𝑴𝒀-IA] ${tipo}: ${String(msg || '').slice(0, 200)}`);
  } catch (e) {}
}

// ===== 🔑 VIP (formato do corvo: [{id, jid, dias, save, infinito}]) =====
function carregarVips() {
  return loadJSON(VIP_FILE, []);
}
function salvarVips(vips) {
  saveJSON(VIP_FILE, vips);
}

function parseVipDuration(duracao) {
  const d = String(duracao || '').trim().toLowerCase();
  const m = d.match(/^(\d+)\s*(min|minuto|minutos|h|hora|horas|d|dia|dias|semana|semanas)?$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = m[2] || 'hora';
  let ms = 0;
  if (u.startsWith('min')) ms = n * 60 * 1000;
  else if (u.startsWith('h')) ms = n * 3600 * 1000;
  else if (u.startsWith('d')) ms = n * 86400 * 1000;
  else if (u.startsWith('sem')) ms = n * 7 * 86400 * 1000;
  else ms = n * 3600 * 1000;
  return { ms, label: `${n} ${u}` };
}

function totalUsers() {
  try {
    return loadJSON(USERS_FILE, []).map((u) => String(u && u.id ? u.id : u)).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function normalizarId(uid) {
  let s = String(uid || '').trim();
  if (!s) return s;
  s = s.split('@')[0].split(':')[0];
  return s;
}

/** Verifica se o usuário (jid ou número) tem VIP ativo. */
function isUserVip(userId) {
  const alvo = normalizarId(userId);
  if (!alvo) return false;
  const now = Date.now();
  return carregarVips().some((v) => {
    const id = normalizarId(v.id || v.jid);
    if (id !== alvo) return false;
    if (v.infinito) return true;
    if (!v.dias || !v.save) return false;
    const saveTs = new Date(String(v.save).replace(/-/g, '/')).getTime();
    if (!Number.isFinite(saveTs)) return false;
    const expira = saveTs + Number(v.dias) * 86400 * 1000;
    return now <= expira;
  });
}

function getVipRemainingLabel(userId) {
  const alvo = normalizarId(userId);
  if (!alvo) return null;
  const v = carregarVips().find((x) => normalizarId(x.id || x.jid) === alvo);
  if (!v) return null;
  if (v.infinito) return '∞ (infinito)';
  if (!v.dias || !v.save) return '—';
  const saveTs = new Date(String(v.save).replace(/-/g, '/')).getTime();
  if (!Number.isFinite(saveTs)) return '—';
  const expira = saveTs + Number(v.dias) * 86400 * 1000;
  const restante = Math.max(0, Math.ceil((expira - Date.now()) / 86400000));
  return `${restante} dia(s)`;
}

function registrarVip(id, dias, infinito = false) {
  const vips = carregarVips();
  const _d = new Date();
  const hoje = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`; // data LOCAL (vip.json usa data local)
  const existente = vips.find((x) => normalizarId(x.id || x.jid) === normalizarId(id));
  if (existente) {
    existente.dias = dias;
    existente.save = hoje;
    existente.infinito = infinito;
  } else {
    vips.push({ id: String(id), jid: String(id), dias, save: hoje, infinito });
  }
  salvarVips(vips);
  return vips;
}

/** Libera VIP para TODOS os usuários por `duracao` (ex: "1 hora", "7 dias"). */
async function liberarVipTodos(duracao) {
  const dur = parseVipDuration(duracao);
  if (!dur || dur.ms <= 0) return { erro: `Duração inválida: "${duracao}". Use ex: "1 hora", "24 horas", "7 dias", "30 min".` };
  const ids = [...new Set([...totalUsers(), ...carregarVips().map((v) => v.id || v.jid)])].filter((id) => normalizarId(id) !== normalizarId(DONO));
  let ok = 0;
  const dias = Math.max(1, Math.round(dur.ms / 86400000));
  for (const uid of ids) {
    if (!uid) continue;
    registrarVip(uid, dias);
    ok++;
  }
  logEvent('IA-ADMIN', `IA liberou VIP para ${ok} usuários por ${dur.label}.`);
  return { ok: true, liberados: ok, duracao: dur.label, validaAte: new Date(Date.now() + dur.ms).toLocaleString('pt-BR') };
}

/** Libera VIP para UM usuário por `duracao`. */
async function liberarVip(userId, duracao) {
  const dur = parseVipDuration(duracao);
  if (!dur || dur.ms <= 0) return { erro: `Duração inválida: "${duracao}".` };
  const id = String(userId || '').trim();
  if (!id) return { erro: 'Informe o ID do usuário.' };
  if (normalizarId(id) === normalizarId(DONO)) return { erro: 'O dono já é dono, ué. Não precisa de VIP.' };
  registrarVip(id, Math.max(1, Math.round(dur.ms / 86400000)));
  logEvent('IA-ADMIN', `IA liberou VIP para ${id} por ${dur.label}.`);
  return { ok: true, usuarioId: id, duracao: dur.label, validaAte: new Date(Date.now() + dur.ms).toLocaleString('pt-BR') };
}

/** Remove VIP de um usuário. */
async function removerVip(userId) {
  const id = String(userId || '').trim();
  if (!id) return { erro: 'Informe o ID do usuário.' };
  const vips = carregarVips();
  const antes = vips.length;
  const restantes = vips.filter((x) => normalizarId(x.id || x.jid) !== normalizarId(id));
  salvarVips(restantes);
  logEvent('IA-ADMIN', `IA removeu VIP de ${id}.`);
  return { ok: true, usuarioId: id, acao: antes !== restantes.length ? 'vip removido' : 'usuário não tinha VIP' };
}

/** Remove o VIP de TODOS os usuários. */
async function removerVipTodos() {
  const vips = carregarVips();
  const removidos = vips.filter((v) => normalizarId(v.id || v.jid) !== normalizarId(DONO)).length;
  salvarVips(vips.filter((v) => normalizarId(v.id || v.jid) === normalizarId(DONO)));
  logEvent('IA-ADMIN', `IA removeu VIP de ${removidos} usuários (todos).`);
  return { ok: true, removidos, avisosFalhos: 0 };
}

/** Lista VIPs ativos. */
async function listarVips() {
  const vips = carregarVips();
  const ativos = vips.filter((v) => v.infinito || isUserVip(v.id || v.jid));
  if (!ativos.length) return 'Nenhum VIP ativo no momento.';
  const linhas = ativos.map((v) => {
    const restante = v.infinito ? '∞' : getVipRemainingLabel(v.id || v.jid) || '—';
    return `• \`${v.id || v.jid}\` — ${v.infinito ? 'INFINITO' : `${v.dias} dia(s)`} (restante: ${restante})`;
  });
  return `💎 VIPs ativos (${ativos.length}):\n${linhas.join('\n')}`;
}

/** Consulta o VIP de UM usuário. */
async function consultarVip(userId) {
  const id = String(userId || '').trim();
  if (!id) return { erro: 'Informe o ID do usuário.' };
  if (!isUserVip(id)) return { resultado: `❌ Usuário \`${id}\` NÃO possui VIP ativo.` };
  const v = carregarVips().find((x) => normalizarId(x.id || x.jid) === normalizarId(id));
  return {
    resultado: `✅ Usuário \`${id}\` — VIP ATIVO\n💎 Tipo: ${v && v.infinito ? 'INFINITO' : v && v.dias ? `${v.dias} dia(s)` : 'PADRÃO'}\n⏳ Restante: ${v && v.infinito ? '∞' : getVipRemainingLabel(id) || '—'}`
  };
}

// ===== 📊 STATS / BAN / BROADCAST =====

/** Stats do bot (usuários, VIPs, banidos). */
async function statsBot() {
  const users = totalUsers();
  const vips = carregarVips().filter((v) => v.infinito || isUserVip(v.id || v.jid)).length;
  const banidos = loadJSON(BANNED_FILE, []).length;
  return { usuarios: users.length, vipsAtivos: vips, banidos, admins: 1 };
}

/** Envia broadcast para todos os usuários. */
async function broadcast(texto) {
  const c = getCore();
  const msg = `📢 *COMUNICADO OFICIAL corvo*\n\n${String(texto || '').slice(0, 3000)}`;
  let enviados = 0;
  const falhas = [];
  for (const uid of totalUsers()) {
    try {
      if (!c.corvo || !uid) continue;
      await c.corvo.sendMessage(uid, { text: msg });
      enviados++;
    } catch (e) {
      falhas.push(uid);
    }
  }
  logEvent('IA-ADMIN', `IA enviou broadcast para ${enviados} usuários.`);
  return { ok: true, enviados, falhas: falhas.length };
}

/** Bane ou desbane um usuário do bot (banned.json). */
async function banirUsuario(userId, desbanir = false) {
  const id = String(userId || '').trim();
  if (!id) return { erro: 'Informe o ID do usuário.' };
  if (normalizarId(id) === normalizarId(DONO)) return { erro: 'Não posso banir o dono.' };
  const banidos = loadJSON(BANNED_FILE, []);
  const jid = id.includes('@') ? id : `${id}@s.whatsapp.net`;
  const idx = banidos.indexOf(jid);
  if (desbanir) {
    if (idx >= 0) banidos.splice(idx, 1);
    saveJSON(BANNED_FILE, banidos);
    logEvent('IA-ADMIN', `IA desbaniu ${id}.`);
    return { ok: true, usuarioId: id, acao: 'desbanido' };
  }
  if (idx < 0) banidos.push(jid);
  saveJSON(BANNED_FILE, banidos);
  logEvent('IA-ADMIN', `IA baniu ${id}.`);
  return { ok: true, usuarioId: id, acao: 'banido' };
}

/** Envia mensagem para um usuário específico. */
async function mensagemPara(userId, texto) {
  const c = getCore();
  const id = String(userId || '').trim();
  if (!id) return { erro: 'Informe o ID do usuário.' };
  const jid = id.includes('@') ? id : `${id}@s.whatsapp.net`;
  try {
    if (!c.corvo) return { erro: 'Socket do WhatsApp não disponível.' };
    await c.corvo.sendMessage(jid, { text: String(texto).slice(0, 3000) });
    return { ok: true, usuarioId: id };
  } catch (e) {
    return { erro: `Não consegui enviar mensagem para ${id}: ${e.message}` };
  }
}

// ===== 🎮 EXECUTAR COMANDOS DO corvo (dominar a corvo) =====
// Usa o commandExecutor do projeto (utils/commandExecutor.js) que já tem os
// comandos reais (ban, kick, promover, rebaixar, clima, ping, grupoinfo).
async function executarComandoCorvo(nome, args = {}) {
  const c = getCore();
  try {
    const { executeCommand, listCommands } = require('../../../utils/commandExecutor');
    const ctx = {
      corvo: c.corvo,
      from: c.from,
      sender: c.sender,
      pushname: c.pushname,
      info: c.info,
      reply: (t) => { try { return c.corvo && c.from ? c.corvo.sendMessage(c.from, { text: String(t) }) : null; } catch (e) { return null; } },
      prefix: c.prefix || '/',
    };
    if (!listCommands().includes(String(nome).toLowerCase())) {
      return { sucesso: false, mensagem: `Comando "${nome}" não existe no executor da IA. Disponíveis: ${listCommands().join(', ')}.` };
    }
    // 🛡️ DEFESA EM PROFUNDIDADE (regra do dono): mesmo se o switch mudar, os
    // comandos de moderação NUNCA podem mirar o DONO nem o próprio BOT.
    const adminCmds = ['ban', 'kick', 'promover', 'rebaixar'];
    if (adminCmds.includes(String(nome).toLowerCase())) {
      const alvoLimpo = String(args.usuario || '').replace(/\D/g, '');
      const donoLimpo = String(DONO || '').replace(/\D/g, '');
      if (alvoLimpo && alvoLimpo === donoLimpo) {
        return { sucesso: false, mensagem: 'Não posso usar isso contra o DONO.' };
      }
      const botNum = c.corvo && c.corvo.user?.id ? String(c.corvo.user.id).split(':')[0] : null;
      if (botNum && alvoLimpo && alvoLimpo === botNum) {
        return { sucesso: false, mensagem: 'Não posso usar isso contra mim mesma.' };
      }
    }
    const r = await executeCommand(nome, args, ctx);
    return r.sucesso === false ? { sucesso: false, mensagem: r.mensagem || 'Falha ao executar.' } : r;
  } catch (e) {
    return { sucesso: false, mensagem: `Erro ao executar comando do corvo: ${e.message}` };
  }
}

// ===== FUNÇÕES DO BOT USADAS PELO AGENTE =====
// Ponte para funções registradas no corvo-ia.js via setCore (agente*).
// Onde o corvo não tem a função, devolve erro claro — a IA explica com humor.

/** Consulta de dados (CPF/nome/telefone...) — se o núcleo registrar. */
async function consultarDado(tipo, valor, userId) {
  try {
    const c = getCore();
    if (typeof c.agenteConsultar === 'function') return c.agenteConsultar(tipo, valor, userId);
  } catch (e) { /* setCore ainda não chamado: cai no fallback direto abaixo */ }
  // 🐛 FIX 2026-08-10: agenteConsultar nunca era registrado no setCore (o corvo-ia.js
  // só registrava corvo_dados/from/sender/...), então a tool consultar_dado SEMPRE retornava
  // "Consultas de dados não habilitadas" — a IA não conseguia puxar CPF/nome/telefone.
  // Agora a consulta REAL roda aqui direto (mesmas APIs do corvo.js: yato-apis + zero-two).
  return agenteConsultar(tipo, valor, userId);
}

/** 🔎 CONSULTA DE DADOS REAL (mesmas APIs/formatos dos comandos do corvo). */
async function agenteConsultar(tipo, valor, userId) {
  const t = String(tipo || '').toLowerCase().trim();
  const v = String(valor || '').trim();
  if (!v) return { erro: 'Informe o dado a consultar (ex: cpf 12345678901, nome Fulano, telefone 5511...).' };
  try {
    if (t === 'cpf') {
      const cpf = v.replace(/\D/g, '');
      if (cpf.length !== 11) return { erro: 'CPF inválido: envie 11 dígitos numéricos.' };
      const data = await fetchJson(`https://yato-apis.shop/consultas/cpf?cpf=${cpf}&apitoken=povo`);
      if (!data || !data.status) return { erro: (data && data.resultado) || 'Consulta CPF falhou.' };
      if (!data.dados || data.dados.status !== 'success') return { erro: 'Dados não encontrados para este CPF.' };
      const d = data.dados;
      return {
        tipo: 'cpf',
        cpf: d.cpf || cpf,
        nome: d.nome || '—',
        nasc: d.nasc || '—',
        nomeMae: d.nomeMae || '—',
        nomePai: d.nomePai || '—',
        sexo: d.sexo || '—',
      };
    }
    if (t === 'nome') {
      const data = await fetchJson(`https://zero-two-apis.com.br/consultas/bigdata/nome?query=${encodeURIComponent(v)}&apikey=SANDRO2025L`);
      if (!data || data.status === false || !Array.isArray(data.resultado) || !data.resultado.length) return { erro: 'Nome não encontrado ou inválido.' };
      // 💰 Limita a 10 registros (economia de tokens — a bigdata pode trazer dezenas)
      return { tipo: 'nome', resultado: data.resultado.slice(0, 10) };
    }
    if (t === 'telefone') {
      const data = await fetchJson(`https://zero-two-apis.com.br/consultas/assecc/telefone?query=${encodeURIComponent(v)}&apikey=SANDRO2025L`);
      if (!data || data.status === false || !data.resultado) return { erro: 'Telefone não encontrado ou inválido.' };
      return { tipo: 'telefone', resultado: data.resultado };
    }
    // credlink/sipni/sisreg/placa: o corvo.js não tem endpoint próprio p/ estes —
    // informa claramente em vez de inventar chamada que falha em silêncio.
    return { erro: `Consulta "${t}" ainda não habilitada neste bot. Use cpf, nome ou telefone.` };
  } catch (e) {
    return { erro: `Erro na consulta ${t}: ${e.message || e}` };
  }
}

/** 🌐 GET JSON com axios (mesma lib do corvo) e timeout anti-trava. */
async function fetchJson(url, opts = {}) {
  let axios = null;
  try { axios = require('axios'); } catch (e) { axios = null; }
  if (!axios) return null;
  try {
    const r = await axios.get(url, { ...opts, timeout: 20000 });
    return r.data;
  } catch (e) {
    return null;
  }
}

async function consultarDatora(numero, userId) {
  const c = getCore();
  if (typeof c.agenteConsultarDatora === 'function') return c.agenteConsultarDatora(numero, userId);
  return { erro: 'Consulta Datora não habilitada para a IA neste bot.' };
}

async function rajarWhats(tipo, jid, userId) {
  const c = getCore();
  if (typeof c.agenteRajar === 'function') return c.agenteRajar(userId, tipo, jid);
  return { erro: 'Rajada não habilitada para a IA neste bot.' };
}

async function nukarWhats(jid, userId) {
  const c = getCore();
  if (typeof c.agenteNukar === 'function') return c.agenteNukar(userId, jid);
  return { erro: 'Nuke não habilitado para a IA neste bot.' };
}

async function floodNgl(username, userId) {
  const c = getCore();
  if (typeof c.agenteFloodNgl === 'function') return c.agenteFloodNgl(userId, username);
  return { erro: 'Flood NGL não habilitado para a IA neste bot.' };
}

async function floodSendit(link, userId) {
  const c = getCore();
  if (typeof c.agenteFloodSendit === 'function') return c.agenteFloodSendit(userId, link);
  return { erro: 'Flood Sendit não habilitado para a IA neste bot.' };
}

async function whatsStatus(userId) {
  const c = getCore();
  if (typeof c.agenteWhatsStatus === 'function') return c.agenteWhatsStatus(userId);
  try {
    const id = c.corvo && c.corvo.user ? c.corvo.user.id : null;
    return { conectado: !!id, numero: id ? String(id).split(':')[0] : null };
  } catch (e) {
    return { conectado: false };
  }
}

async function listarGruposWhats(userId) {
  const c = getCore();
  if (typeof c.agenteListarGrupos === 'function') return c.agenteListarGrupos(userId);
  try {
    if (!c.corvo || typeof c.corvo.groupFetchAllParticipating !== 'function') return { erro: 'Listar grupos não habilitado para a IA.' };
    const grupos = await c.corvo.groupFetchAllParticipating();
    const lista = Object.values(grupos).map((g) => ({ jid: g.id, nome: g.subject || g.id }));
    return { ok: true, grupos: lista };
  } catch (e) {
    return { erro: `Erro ao listar grupos: ${e.message}` };
  }
}

// ===== 💎 VENDAS VIP (o corvo não tem PIX — ponte opcional) =====
async function listarPlanosVip() {
  const c = getCore();
  if (typeof c.agenteListarPlanosVip === 'function') return c.agenteListarPlanosVip();
  return { erro: 'Tabela de planos VIP não habilitada para a IA neste bot.' };
}

async function venderVip(plano, userId, chatId) {
  const c = getCore();
  if (typeof c.agenteVenderVip === 'function') return c.agenteVenderVip(plano, userId, chatId);
  return { erro: 'Venda de VIP não habilitada para a IA neste bot.' };
}

// ===== 📣 CANAL / POSTAGEM (o corvo não tem canal — ponte opcional) =====
async function postarCanal(texto) {
  const c = getCore();
  if (typeof c.agentePostarCanal === 'function') return c.agentePostarCanal(texto);
  return { erro: 'Canal não configurado para a IA neste bot.' };
}

async function editarCanal(mensagemId, texto) {
  const c = getCore();
  if (typeof c.agenteEditarCanal === 'function') return c.agenteEditarCanal(mensagemId, texto);
  return { erro: 'Canal não configurado para a IA neste bot.' };
}

async function apagarCanal(mensagemId) {
  const c = getCore();
  if (typeof c.agenteApagarCanal === 'function') return c.agenteApagarCanal(mensagemId);
  return { erro: 'Canal não configurado para a IA neste bot.' };
}

async function postarFotoCanal(caminho, legenda) {
  const c = getCore();
  if (typeof c.agentePostarFotoCanal === 'function') return c.agentePostarFotoCanal(caminho, legenda);
  return { erro: 'Canal não configurado para a IA neste bot.' };
}

async function postarVideoCanal(caminho, legenda, capa) {
  const c = getCore();
  if (typeof c.agentePostarVideoCanal === 'function') return c.agentePostarVideoCanal(caminho, legenda, capa);
  return { erro: 'Canal não configurado para a IA neste bot.' };
}

async function configurarCanal(acao, valor) {
  const c = getCore();
  if (typeof c.agenteConfigurarCanal === 'function') return c.agenteConfigurarCanal(acao, valor);
  return { erro: 'Canal não configurado para a IA neste bot.' };
}

async function buscarPostCanal(termo) {
  const c = getCore();
  if (typeof c.agenteBuscarPostCanal === 'function') return c.agenteBuscarPostCanal(termo);
  return { erro: 'Canal não configurado para a IA neste bot.' };
}

// ===== 👥 GRUPO (Baileys) =====

/** Remove um membro do grupo + PV opcional. */
async function removerMembro(userId, chatId, motivo, pv) {
  const c = getCore();
  if (typeof c.agenteRemoverMembro === 'function') return c.agenteRemoverMembro(userId, chatId, motivo, pv);
  try {
    if (!c.corvo || !chatId) return { erro: 'Socket/chat indisponível para remover membro.' };
    const jid = String(userId).includes('@') ? String(userId) : `${userId}@s.whatsapp.net`;
    const meta = await c.corvo.groupMetadata(chatId);
    const alvo = meta.participants.find((p) => String(p.id).split(':')[0].split('@')[0] === String(jid).split(':')[0].split('@')[0]);
    if (!alvo) return { erro: 'Usuário não está no grupo.' };
    // 🤖 AUTONOMIA (regra do dono): a IA PODE remover ADMINS também. Única
    // proibição: NUNCA o próprio bot e NUNCA o dono.
    const alvoNum = String(alvo.id).split(':')[0].split('@')[0];
    if (alvoNum === normalizarId(DONO)) return { erro: 'Não posso remover o DONO.' };
    const botNum = c.corvo.user?.id ? String(c.corvo.user.id).split(':')[0].split('@')[0] : null;
    if (botNum && alvoNum === botNum) return { erro: 'Não posso remover a mim mesma.' };
    await c.corvo.groupParticipantsUpdate(chatId, [alvo.id], 'remove');
    if (pv && c.corvo) {
      try { await c.corvo.sendMessage(alvo.id, { text: String(pv) }); } catch (e) {}
    }
    return { ok: true, removido: alvo.id };
  } catch (e) {
    return { erro: `Erro ao remover membro: ${e.message}` };
  }
}

/** 🔇 MUTA um membro do grupo (mensagens dele passam a ser apagadas pelo corvo). */
async function mutarUsuario(userId, chatId) {
  const c = getCore();
  try {
    if (!c.corvo || !chatId) return { erro: 'Socket/chat indisponível para mutar.' };
    const jid = String(userId).includes('@') ? String(userId) : `${userId}@s.whatsapp.net`;
    const meta = await c.corvo.groupMetadata(chatId);
    const alvo = meta.participants.find((p) => String(p.id).split(':')[0].split('@')[0] === String(jid).split(':')[0].split('@')[0]);
    if (!alvo) return { erro: 'Usuário não está no grupo.' };
    // 🤖 Autonomia (regra do dono): NUNCA mutar o próprio bot nem o DONO.
    const alvoNum = String(alvo.id).split(':')[0].split('@')[0];
    if (alvoNum === normalizarId(DONO)) return { erro: 'Não posso mutar o DONO.' };
    const botNum = c.corvo.user?.id ? String(c.corvo.user.id).split(':')[0].split('@')[0] : null;
    if (botNum && alvoNum === botNum) return { erro: 'Não posso mutar a mim mesma.' };
    const muted = carregarMuted();
    let grupo = muted.find((g) => g.grupo === chatId);
    if (!grupo) {
      grupo = { grupo: chatId, usus: [] };
      muted.push(grupo);
    }
    if (!grupo.usus.includes(alvo.id)) grupo.usus.push(alvo.id);
    salvarMuted(muted);
    logEvent('IA-ADMIN', `IA mutou ${alvo.id} no grupo ${chatId}.`);
    return { ok: true, mutado: alvo.id };
  } catch (e) {
    return { erro: `Erro ao mutar: ${e.message}` };
  }
}

/** 🔊 DESMUTA um membro do grupo (volta a falar normalmente). */
async function desmutarUsuario(userId, chatId) {
  const c = getCore();
  try {
    if (!c.corvo || !chatId) return { erro: 'Socket/chat indisponível para desmutar.' };
    const jid = String(userId).includes('@') ? String(userId) : `${userId}@s.whatsapp.net`;
    const muted = carregarMuted();
    const grupo = muted.find((g) => g.grupo === chatId);
    if (!grupo) return { ok: true, desmutado: jid, jaEstava: true };
    const idx = grupo.usus.findIndex((u) => String(u).split(':')[0].split('@')[0] === String(jid).split(':')[0].split('@')[0]);
    if (idx === -1) return { ok: true, desmutado: jid, jaEstava: true };
    grupo.usus.splice(idx, 1);
    salvarMuted(muted);
    logEvent('IA-ADMIN', `IA desmutou ${jid} no grupo ${chatId}.`);
    return { ok: true, desmutado: jid };
  } catch (e) {
    return { erro: `Erro ao desmutar: ${e.message}` };
  }
}

/** Carrega a lista de mutados (em memória do corvo quando possível + arquivo). */
function carregarMuted() {
  // 🔄 Se o corvo já carregou o muted.json em memória, usa a MESMA instância
  // (assim o corvo vê o mute na hora, sem reiniciar o bot).
  try {
    const ex = require('../../../exports');
    if (ex && Array.isArray(ex.muted)) return ex.muted;
  } catch (e) { /* exports pode não estar pronto — cai no arquivo */ }
  return loadJSON(MUTED_FILE, []);
}

/** Salva a lista de mutados no arquivo (o corvo lê em memória, mas o arquivo persiste). */
function salvarMuted(muted) {
  saveJSON(MUTED_FILE, muted);
}

/** Retorna informações de um grupo/canal (título, descrição, membros, admins). */
async function infoChat(chatId) {
  const c = getCore();
  try {
    if (!c.corvo || !chatId) return { erro: 'Socket/chat indisponível.' };
    const meta = await c.corvo.groupMetadata(chatId);
    const participantes = meta.participants || [];
    const admins = participantes.filter((p) => p.admin).length;
    return {
      ok: true,
      chat_id: chatId,
      titulo: meta.subject || '(sem título)',
      descricao: meta.desc || 'Sem descrição',
      membros: participantes.length,
      admins,
      link: meta.inviteCode ? `https://chat.whatsapp.com/${meta.inviteCode}` : null,
    };
  } catch (e) {
    return { erro: `Erro ao buscar informações do chat: ${e.message}` };
  }
}

/** Configura o GRUPO (título, descrição, link, info) via Baileys. */
async function configurarGrupo(chatId, acao, valor) {
  const c = getCore();
  if (typeof c.agenteConfigurarGrupo === 'function') return c.agenteConfigurarGrupo(chatId, acao, valor);
  try {
    if (!c.corvo || !chatId) return { erro: 'Socket/chat indisponível.' };
    const a = String(acao || '').toLowerCase();
    if (a === 'titulo' || a === 'subject') {
      await c.corvo.groupUpdateSubject(chatId, String(valor || '').slice(0, 100));
      return { ok: true, acao: 'titulo', valor: String(valor || '').slice(0, 100) };
    }
    if (a === 'descricao' || a === 'desc') {
      await c.corvo.groupUpdateDescription(chatId, String(valor || ''));
      return { ok: true, acao: 'descricao' };
    }
    if (a === 'link') {
      const code = await c.corvo.groupInviteCode(chatId);
      return { ok: true, link: `https://chat.whatsapp.com/${code}` };
    }
    if (a === 'info') {
      const meta = await c.corvo.groupMetadata(chatId);
      return { ok: true, info: `📋 ${meta.subject}\n👥 Membros: ${(meta.participants || []).length}\n📝 ${meta.desc || 'Sem descrição'}` };
    }
    if (a === 'fechar' || a === 'bloquear_mensagens') {
      await c.corvo.groupSettingUpdate(chatId, 'announcement');
      return { ok: true, acao: 'grupo fechado (só admins falam)' };
    }
    if (a === 'abrir' || a === 'permitir_mensagens') {
      await c.corvo.groupSettingUpdate(chatId, 'not_announcement');
      return { ok: true, acao: 'grupo aberto (todos falam)' };
    }
    return { erro: `Ação de grupo desconhecida: ${acao}. Use: titulo, descricao, link, info, abrir, fechar.` };
  } catch (e) {
    return { erro: `Erro ao configurar grupo: ${e.message}` };
  }
}

// ===== 🖼️ CRIAÇÃO DE IMAGEM — capa profissional da corvo (SVG + sharp) =====
const PALETAS_IMAGEM = [
  { nome: 'ouro', bg: ['#3a2d0e', '#241a07', '#0d0903'], faixaDe: '#ffd700', faixaAte: '#8a5a00', titulo: '#ffffff', sub: '#f0e2b6', linhaDiv: '#8a6d1f', rodape: '#d4af37', peso: 3 },
  { nome: 'ciano', bg: ['#241463', '#150b3a', '#070312'], faixaDe: '#00e5ff', faixaAte: '#a855f7', titulo: '#ffffff', sub: '#cfc8ff', linhaDiv: '#4b3fa0', rodape: '#9b8cff', peso: 1 },
  { nome: 'rubi', bg: ['#3d0d14', '#200710', '#0a0305'], faixaDe: '#ff3b3b', faixaAte: '#8b0000', titulo: '#ffffff', sub: '#f5c4c4', linhaDiv: '#8b2a2a', rodape: '#ff6b6b', peso: 1 },
  { nome: 'azul', bg: ['#0d2a4d', '#071a33', '#020710'], faixaDe: '#00b3ff', faixaAte: '#1e5fff', titulo: '#ffffff', sub: '#c4e0f5', linhaDiv: '#2a5f9e', rodape: '#5bbfff', peso: 1 },
  { nome: 'verde', bg: ['#0d3a2a', '#07221a', '#020a07'], faixaDe: '#00ff88', faixaAte: '#00b366', titulo: '#ffffff', sub: '#c4f5dd', linhaDiv: '#2a8a55', rodape: '#4dffaa', peso: 1 }
];

function sortearPaleta() {
  const total = PALETAS_IMAGEM.reduce((s, p) => s + (p.peso || 1), 0);
  let r = Math.floor(Math.random() * total);
  for (const p of PALETAS_IMAGEM) {
    r -= p.peso || 1;
    if (r < 0) return p;
  }
  return PALETAS_IMAGEM[0];
}

function escaparXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function limparTextoImagem(s) {
  return String(s || '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function quebrarLinhas(texto, maxChars) {
  const palavras = String(texto || '').split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    const candidata = atual ? atual + ' ' + p : p;
    if (candidata.length <= maxChars) atual = candidata;
    else {
      if (atual) linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

function montarSvgCapa(paleta, titulo, subtitulo, W, H) {
  const sx = W / 1024;
  const sy = H / 1024;
  const tituloRaw = (limparTextoImagem(titulo) || 'corvo').slice(0, 44);
  const linhasTitulo = quebrarLinhas(tituloRaw, 22).slice(0, 2);
  const tituloMaisLonga = Math.max(1, ...linhasTitulo.map((l) => l.length));
  const tamTitulo = Math.max(42, Math.min(104, Math.floor((W - 200) / (tituloMaisLonga * 0.6))));
  const lhTitulo = Math.round(tamTitulo * 1.22);
  const subRaw = limparTextoImagem(subtitulo).slice(0, 72);
  const linhasSub = subRaw ? quebrarLinhas(subRaw, 34).slice(0, 2) : [];
  const subMaisLonga = linhasSub.length ? Math.max(1, ...linhasSub.map((l) => l.length)) : 0;
  const tamSub = linhasSub.length ? Math.max(22, Math.min(44, Math.floor((W - 260) / (subMaisLonga * 0.55)))) : 0;
  const lhSub = Math.round(tamSub * 1.35);
  const yBaseTitulo = Math.round(355 * sy);
  const yDivisor = yBaseTitulo + (linhasTitulo.length - 1) * lhTitulo + Math.round(145 * sy);
  const yBaseSub = yDivisor + Math.round(80 * sy);
  const yRodape = Math.round(966 * sy);
  const xCentro = W / 2;
  const tamBadge = Math.max(18, Math.round(26 * sy));
  const badgeY = Math.round(140 * sy);
  const badgeH = Math.round(58 * sy);
  const badgeW = Math.round(280 * sx);
  const badgeX = xCentro - badgeW / 2;
  const badgeTxtY = Math.round(179 * sy);
  const barraAlt = Math.max(8, Math.round(10 * sy));
  const tamRodape = Math.max(16, Math.round(22 * sy));
  const tituloSvg = linhasTitulo.map((l, i) =>
    `<text x="${xCentro}" y="${yBaseTitulo + i * lhTitulo}" font-family="Arial, Helvetica, sans-serif" font-size="${tamTitulo}" font-weight="bold" fill="${paleta.titulo}" text-anchor="middle">${escaparXml(l)}</text>`
  ).join('\n    ');
  const subSvg = linhasSub.map((l, i) =>
    `<text x="${xCentro}" y="${yBaseSub + i * lhSub}" font-family="Arial, Helvetica, sans-serif" font-size="${tamSub}" fill="${paleta.sub}" text-anchor="middle">${escaparXml(l)}</text>`
  ).join('\n    ');
  const cX = Math.round(48 * sx);
  const cW = Math.round(88 * sx);
  const cY1 = Math.round(88 * sy);
  const cY2 = Math.round(48 * sy);
  const cY3 = Math.round(936 * sy);
  const cY4 = Math.round(976 * sy);
  const linhaX1 = Math.round(262 * sx);
  const linhaX2 = Math.round(762 * sx);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="85%">
      <stop offset="0%" stop-color="${paleta.bg[0]}"/>
      <stop offset="45%" stop-color="${paleta.bg[1]}"/>
      <stop offset="100%" stop-color="${paleta.bg[2]}"/>
    </radialGradient>
    <linearGradient id="faixa" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${paleta.faixaDe}"/>
      <stop offset="100%" stop-color="${paleta.faixaAte}"/>
    </linearGradient>
    <linearGradient id="bordaBadge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${paleta.faixaDe}"/>
      <stop offset="100%" stop-color="${paleta.faixaAte}"/>
    </linearGradient>
    <filter id="sombra" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur"/>
      <feOffset dx="0" dy="4" result="offsetBlur"/>
      <feFlood flood-color="#000000" flood-opacity="0.65" result="cor"/>
      <feComposite in="cor" in2="offsetBlur" operator="in" result="sombra"/>
      <feMerge><feMergeNode in="sombra"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${W}" height="${barraAlt}" fill="url(#faixa)"/>
  <rect x="0" y="${H - barraAlt}" width="${W}" height="${barraAlt}" fill="url(#faixa)"/>
  <path d="M${cX} ${cY1} V${cY2} H${cW}" fill="none" stroke="${paleta.faixaDe}" stroke-opacity="0.55" stroke-width="3"/>
  <path d="M${W - cX} ${cY1} V${cY2} H${W - cW}" fill="none" stroke="${paleta.faixaAte}" stroke-opacity="0.55" stroke-width="3"/>
  <path d="M${cX} ${H - cY1} V${H - cY2} H${cW}" fill="none" stroke="${paleta.faixaAte}" stroke-opacity="0.55" stroke-width="3"/>
  <path d="M${W - cX} ${H - cY1} V${H - cY2} H${W - cW}" fill="none" stroke="${paleta.faixaDe}" stroke-opacity="0.55" stroke-width="3"/>
  <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="${Math.round(badgeH / 2)}" fill="#0a0603" fill-opacity="0.88" stroke="url(#bordaBadge)" stroke-width="2"/>
  <text x="${xCentro}" y="${badgeTxtY}" font-family="Arial, Helvetica, sans-serif" font-size="${tamBadge}" font-weight="bold" fill="${paleta.faixaDe}" letter-spacing="4" text-anchor="middle">corvo • BOT</text>
  <g filter="url(#sombra)">${tituloSvg}</g>
  <line x1="${linhaX1}" y1="${yDivisor}" x2="${linhaX2}" y2="${yDivisor}" stroke="${paleta.linhaDiv}" stroke-opacity="0.65" stroke-width="1.5"/>
  <rect x="${xCentro - 7}" y="${yDivisor - 8}" width="14" height="14" transform="rotate(45 ${xCentro} ${yDivisor})" fill="url(#faixa)"/>
  ${subSvg}
  <text x="${xCentro}" y="${yRodape}" font-family="Arial, Helvetica, sans-serif" font-size="${tamRodape}" font-weight="bold" letter-spacing="5" fill="${paleta.rodape}" text-anchor="middle">corvo • ATUALIZAÇÕES</text>
</svg>`;
}

async function renderizarCapa(titulo, subtitulo, W, H, prefixo) {
  if (!sharp) return { erro: 'sharp não está disponível para gerar a imagem.' };
  const paleta = sortearPaleta();
  const svg = montarSvgCapa(paleta, titulo, subtitulo, W, H);
  try {
    const dir = path.join(DATA_DIR, 'downloads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const arquivo = path.join(dir, `${prefixo}_${Date.now()}.png`);
    await sharp(Buffer.from(svg)).png().toFile(arquivo);
    return { ok: true, caminho: arquivo, dimensoes: `${W}x${H}`, paleta: paleta.nome };
  } catch (e) {
    return { erro: `Erro ao criar imagem: ${e.message}` };
  }
}

/** Cria uma imagem de atualização (capa PROFISSIONAL QUADRADA 1024x1024). */
async function criarImagem(titulo, subtitulo) {
  return renderizarCapa(titulo, subtitulo, 1024, 1024, 'corvo_anuncio');
}

/** Cria uma CAPA PARA VÍDEO (16:9, 1280x720) com o mesmo visual. */
async function criarCapaVideo(titulo, subtitulo) {
  return renderizarCapa(titulo, subtitulo, 1280, 720, 'corvo_capa_video');
}

module.exports = {
  DONO,
  setCore,
  isReady,
  getCore,
  isUserVip,
  getVipRemainingLabel,
  liberarVipTodos,
  liberarVip,
  removerVip,
  removerVipTodos,
  listarVips,
  consultarVip,
  statsBot,
  broadcast,
  banirUsuario,
  mensagemPara,
  executarComandoCorvo,
  agenteConsultar,
  consultarDado,
  consultarDatora,
  rajarWhats,
  nukarWhats,
  floodNgl,
  floodSendit,
  whatsStatus,
  listarGruposWhats,
  listarPlanosVip,
  venderVip,
  postarCanal,
  editarCanal,
  apagarCanal,
  postarFotoCanal,
  postarVideoCanal,
  configurarCanal,
  buscarPostCanal,
  removerMembro,
  mutarUsuario,
  desmutarUsuario,
  configurarGrupo,
  infoChat,
  criarImagem,
  criarCapaVideo,
};
