/**
 * 🟩 𝒀𝑨𝑲𝑨𝑴𝒀 - POOL DE FIGURINHAS DA IA (WhatsApp)
 * Pool de figurinhas (webp) usado quando a IA marca [STICKER: hint]: sorteia
 * uma do pool (preferindo as que combinam com o emoji/hint pedido) e o
 * corvo-ia envia via corvo.sendMessage({ sticker }).
 * 🚫 COLETA DESLIGADA (regra do dono): o pool já tem quantidade boa e NÃO
 * cresce mais — a função coletar() é no-op. O que já está em disco segue
 * valendo pro sorteio.
 * Seed: corvo_dados/data/media/sticker/convert.webp (vem com o bot) — o pool nunca fica
 * vazio, então a IA sempre consegue mandar figurinha quando decide.
 */

const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..', '..', 'data', 'stickers_whats');
const FILE = path.join(DIR, 'index.json');
const SEED = path.resolve(__dirname, '..', '..', '..', 'corvo_dados', 'data', 'media', 'sticker', 'convert.webp');
const MAX_POOL = 400;

function carregar() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

// (salvar foi removido junto com a coleta — o pool não muda mais em disco)

function caminhoDo(id) {
  return path.join(DIR, `${id}.webp`);
}

/** Coleta uma figurinha vista no chat — DESATIVADA (regra do dono: o pool já
 * tem quantidade boa e não deve mais crescer). A função fica como no-op pra
 * não quebrar quem a chama; o pool atual segue intacto pro sorteio ([STICKER]). */
function coletar() {
  return; // 🚫 coleta desligada — não salva mais nada em disco
}

/**
 * Sorteia uma figurinha do pool. Se o hint (ex: um emoji ou palavra) combinar
 * com o emoji de alguma figurinha coletada, prefere uma dessas; senão sorteia
 * qualquer uma. Retorna o CAMINHO do arquivo webp (ou o SEED se o pool vazio).
 */
function sorteiar(hint = '') {
  const arr = carregar();
  if (!arr.length) return fs.existsSync(SEED) ? SEED : null;
  const h = String(hint || '').trim();
  if (h) {
    const match = arr.filter((s) => s.emoji && s.emoji.includes(h));
    if (match.length) return caminhoDo(match[Math.floor(Math.random() * match.length)].id);
  }
  return caminhoDo(arr[Math.floor(Math.random() * arr.length)].id);
}

function getStats() {
  return { total: carregar().length, seed: fs.existsSync(SEED) ? 'convert.webp' : null };
}

module.exports = { coletar, sorteiar, getStats, DIR, MAX_POOL };
