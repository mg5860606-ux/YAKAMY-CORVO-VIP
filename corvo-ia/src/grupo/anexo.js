/**
 * 📎 𝒀𝑨𝑲𝑨𝑴𝒀 - ANEXOS DE ARQUIVO NO GRUPO (WhatsApp)
 * Baixa um arquivo enviado no WhatsApp (documento/imagem/vídeo/áudio da
 * mensagem) via Baileys (downloadMediaMessage) e salva em data/anexos/<chatId>/,
 * devolvendo o caminho para a IA ler/editar e devolver com [ARQUIVO: caminho].
 * Qualquer pessoa do grupo pode usar — o acesso fica restrito às zonas
 * liberadas do bot (data/anexos, data/downloads, data/screenshots, data/github),
 * nunca ao PC inteiro.
 */

const fs = require('fs');
const path = require('path');
const { baixarMidia } = require('../adapter/ctx');

const ANEXOS_DIR = path.resolve(__dirname, '..', '..', 'data', 'anexos');
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');

// 📥 Zonas de TRABALHO liberadas para qualquer pessoa do grupo (criar/ler/editar,
// baixar e DEVOLVER arquivos): anexos (enviados no grupo), downloads (baixados
// da internet), github (repos baixados) e screenshots (prints pedidos — regra do
// dono: membros podem pedir print/captura para tarefas como anti-robô/captcha).
const ZONAS_LIBERADAS = ['anexos', 'downloads', 'github', 'screenshots'];

function dentroDe(base, caminho) {
  if (!caminho) return false;
  const p = path.resolve(String(caminho));
  const b = path.resolve(base);
  // Windows é case-insensitive: compara tudo em minúsculas para não negar
  // um caminho legítimo só por causa de maiúscula/minúscula
  if (process.platform === 'win32') {
    const pp = p.toLowerCase();
    const bb = b.toLowerCase();
    return pp === bb || pp.startsWith(bb + path.sep);
  }
  return p === b || p.startsWith(b + path.sep);
}

/**
 * Verifica se um caminho está DENTRO da pasta de anexos (data/anexos).
 * Mantido para compatibilidade.
 */
function isAnexo(caminho) {
  return dentroDe(ANEXOS_DIR, caminho);
}

/**
 * Verifica se um caminho está numa ZONA LIBERADA (data/anexos, data/downloads,
 * data/screenshots ou data/github) — ou seja, onde QUALQUER pessoa do grupo pode
 * criar/ler/editar/baixar e onde os arquivos PODEM ser devolvidos pra quem pediu.
 */
function isZonaLiberada(caminho) {
  for (const zona of ZONAS_LIBERADAS) {
    if (dentroDe(path.join(DATA_DIR, zona), caminho)) return true;
  }
  return false;
}

function nomeLimpo(nome) {
  const base = String(nome || 'anexo')
    .split(/[\\/]/).pop()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .trim()
    .slice(0, 80);
  return base || 'anexo';
}

/**
 * Baixa um arquivo enviado no WhatsApp (documento/imagem/vídeo/áudio) da
 * mensagem atual e salva em data/anexos/<chatId>/. Usa o Baileys
 * (downloadMediaMessage via baixarMidia do adaptador) — sem depender de
 * Telegram file_id.
 * @param {object} corvo - socket Baileys
 * @param {object} msg - mensagem crua do WhatsApp
 * @returns {Promise<null|{caminho: string, nome: string, tamanho: number}>}
 */
async function salvarAnexoWhats(corvo, msg) {
  try {
    const m = msg?.message || {};
    let nome = '';

    // 🚫 ÁUDIO/voz NÃO entra aqui: o corvo-ia.js trata nota de voz como FALA do
    // usuário (transcreve pro prompt), nunca como anexo pra "melhorar".
    if (m.documentMessage) { nome = m.documentMessage.fileName || 'documento'; }
    else if (m.imageMessage) { nome = 'foto.jpg'; }
    else if (m.videoMessage) { nome = m.videoMessage.fileName || 'video.mp4'; }
    if (!nome) return null;

    const buf = await baixarMidia(corvo, msg);
    if (!buf || !buf.length) return null;

    const chatId = String(msg?.key?.remoteJid || 'geral').replace(/[^\w-]/g, '') || 'geral';
    const dir = path.join(ANEXOS_DIR, chatId);
    fs.mkdirSync(dir, { recursive: true });
    const caminho = path.join(dir, `${Date.now()}-${nomeLimpo(nome)}`);
    fs.writeFileSync(caminho, buf);

    return { caminho, nome: nomeLimpo(nome), tamanho: buf.length };
  } catch (e) {
    return null;
  }
}

module.exports = { salvarAnexoWhats, isAnexo, isZonaLiberada, ANEXOS_DIR, DATA_DIR, ZONAS_LIBERADAS };
