/**
 * 💰 𝒀𝑨𝑲𝑨𝑴𝒀 - MONITOR DE PREÇOS
 * A IA agenda um monitor via monitorar_preco (produto + preço alvo); o sistema
 * checa o preço no Mercado Livre (API pública, sem chave) a cada 30min e, quando
 * o preço fica IGUAL ou ABAIXO do alvo, avisa no chat que pediu (via sender).
 * Persistente em data/monitor_precos.json → retoma monitores após reinício.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const FILE = path.join(__dirname, '..', '..', 'data', 'monitor_precos.json');
// ⏱ Intervalo entre checagens (30min — o preço do ML não muda a cada minuto).
const INTERVALO_MS = 30 * 60 * 1000;

let sender = null; // fn(chatId, texto) — ligado no corvo-ia.js (tem o socket do corvo)
let timer = null;
let rodando = false;

function load() {
  try {
    if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE));
  } catch (e) { /* arquivo ausente/corrompido */ }
  return [];
}

function save(list) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
  } catch (e) { /* falha de escrita não derruba o bot */ }
}

function setSender(fn) { sender = fn; }

/**
 * 🔎 Busca o preço atual de um produto no Mercado Livre (primeiro resultado).
 * Retorna { nome, preco, url } ou null se não achar.
 */
async function buscarPreco(termo) {
  try {
    const { data } = await axios.get(
      `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(String(termo || ''))}&limit=1`,
      { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const item = data && data.results && data.results[0];
    if (!item || !item.title || typeof item.price !== 'number') return null;
    return { nome: item.title, preco: item.price, url: item.permalink || '' };
  } catch (e) {
    return null;
  }
}

/**
 * 💰 Agenda um monitor de preço.
 * @param {object} opts { chatId, userId, produto, precoAlvo }
 * @returns {object} confirmação com id, ou { erro }
 */
function monitorarPreco({ chatId, userId, produto, precoAlvo }) {
  const prod = String(produto || '').trim();
  const alvo = Number(precoAlvo);
  if (!prod) return { erro: 'Informe o produto para monitorar (ex: RTX 4060).' };
  if (!Number.isFinite(alvo) || alvo <= 0) return { erro: 'Informe um preço alvo válido (ex: 2000).' };

  const list = load().filter(m => m.id);
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    chatId: String(chatId),
    userId: String(userId || ''),
    produto: prod.slice(0, 120),
    precoAlvo: alvo,
    criadoEm: Date.now(),
    ultimoCheck: 0,
    avisado: false,
  };
  list.push(item);
  save(list);
  iniciarLoop(); // garante o timer rodando
  return { monitorado: true, id: item.id, produto: item.produto, precoAlvo: alvo, frequencia: 'a cada 30min' };
}

/** 📋 Lista os monitores ativos de um chat. */
function listar(chatId) {
  const now = Date.now();
  return load()
    .filter(m => String(m.chatId) === String(chatId))
    .map(m => ({
      id: m.id,
      produto: m.produto,
      precoAlvo: m.precoAlvo,
      avisado: !!m.avisado,
      criadoEm: new Date(m.criadoEm).toLocaleString('pt-BR'),
      ultimaChecagem: m.ultimoCheck ? `${Math.max(1, Math.round((now - m.ultimoCheck) / 60000))}min atrás` : 'ainda não checado',
    }));
}

/** ❌ Cancela um monitor pelo id (só do próprio chat). */
function cancelar(chatId, id) {
  const list = load();
  const rest = list.filter(m => !(String(m.chatId) === String(chatId) && String(m.id) === String(id)));
  save(rest);
  return list.length !== rest.length;
}

/** 🔁 Checa TODOS os monitores ativos (não avisados) e notifica quem caiu no alvo. */
async function verificarTodos() {
  if (rodando) return;
  rodando = true;
  try {
    const list = load();
    if (!list.length) return;
    let mudou = false;
    for (const m of list) {
      if (m.avisado) continue;
      const precoAtual = await buscarPreco(m.produto);
      m.ultimoCheck = Date.now();
      if (precoAtual && precoAtual.preco <= m.precoAlvo) {
        m.avisado = true;
        m.precoEncontrado = precoAtual.preco;
        m.precoEncontradoEm = Date.now();
        mudou = true;
        if (sender) {
          try {
            sender(
              m.chatId,
              `💰 *ALERTA DE PREÇO!*\n\n📦 *${precoAtual.nome.slice(0, 80)}*\n` +
              `💵 Preço agora: *R$ ${precoAtual.preco.toFixed(2)}* (alvo: R$ ${m.precoAlvo.toFixed(2)})\n\n` +
              `✅ Caiu no seu alvo! ${precoAtual.url ? '\n🔗 ' + precoAtual.url : ''}`
            );
          } catch (e) { /* notificação falhou não derruba */ }
        }
      }
    }
    if (mudou) save(list);
  } catch (e) {
    /* checagem com erro não derruba o loop */
  } finally {
    rodando = false;
  }
}

/** ▶️ Garante o loop periódico rodando (setInterval com unref p/ não segurar o processo). */
function iniciarLoop() {
  if (timer) return;
  timer = setInterval(verificarTodos, INTERVALO_MS);
  if (timer.unref) timer.unref();
  // 🔁 1ª checagem imediata (quem acabou de criar não espera 30min)
  verificarTodos();
}

/** 🔄 Retoma monitores pendentes após reinício (chamar uma vez no boot). */
function reschedulePending() {
  const list = load();
  if (list.length) iniciarLoop();
  return list.length;
}

module.exports = { setSender, monitorarPreco, listar, cancelar, verificarTodos, reschedulePending, buscarPreco };
