// 🧠 𝒀𝑨𝑲𝑨𝑴𝒀-IA — IA do bot 𝒀𝑨𝑲𝑨𝑴𝒀.
// Cérebro completo da 𝒀𝑨𝑲𝑨𝑴𝒀: mesma estrutura e nível da IA do CORVO,
// porém baseada NO 𝒀𝑨𝑲𝑨𝑴𝒀 — executa comandos do 𝒀𝑨𝑲𝑨𝑴𝒀, mexe nos dados do 𝒀𝑨𝑲𝑨𝑴𝒀
// (vip.json, banned.json, users.json) e manda no WhatsApp via Baileys.

const fs = require('fs');
const path = require('path');

// 📱 Número do DONO: lido do INFON/DADOS/config.json (ownerNumber[0]) — a
// MESMA fonte que o 𝒀𝑨𝑲𝑨𝑴𝒀 usa. Se o arquivo falhar, usa o fallback abaixo.
function lerAdminId() {
  const FALLBACK = '5521990682259';
  try {
    const raw = fs.readFileSync(
      path.join(__dirname, '..', 'INFON', 'DADOS', 'config.json'),
      'utf8'
    );
    const cfg = JSON.parse(raw);
    const n = String(cfg.ownerNumber?.[0] || '').replace(/\D/g, '');
    return n || FALLBACK;
  } catch (e) {
    return FALLBACK;
  }
}

const ADMIN_ID = lerAdminId();

// 🆔 LID do DONO: lido do INFON/DADOS/config.json (ownerNumber[1]). O WhatsApp
// pode mandar o remetente como @lid (número aleatório) em vez do número real —
// ter o LID cadastrado permite reconhecer o dono mesmo quando ele chega como
// LID (ex: `5521990682259` no ownerNumber[0] e o LID dele no [1]).
function lerAdminLid() {
  try {
    const raw = fs.readFileSync(
      path.join(__dirname, '..', 'INFON', 'DADOS', 'config.json'),
      'utf8'
    );
    const cfg = JSON.parse(raw);
    return String(cfg.ownerNumber?.[1] || '').replace(/\D/g, '') || '';
  } catch (e) {
    return '';
  }
}

const ADMIN_LID = lerAdminLid();

module.exports = {
  // 🤖 Nome e identidade
  botName: '𝒀𝑨𝑲𝑨𝑴𝒀',
  ownerName: 'DARK DYABYNHO',

  // 📱 Número do DONO no WhatsApp (só dígitos, com DDI) — vindo do
  // INFON/DADOS/config.json (ownerNumber[0]). É o DONO DO BOT: a IA
  // obedece ele na hora e até o fim (regra máxima).
  adminId: ADMIN_ID,

  // 🆔 LID do DONO (ownerNumber[1] do config.json) — vazio se não cadastrado.
  // Usado como FALTA-BACK na detecção: reconhece o dono quando o WhatsApp o
  // entrega como @lid em vez do número real (comum em grupos novos).
  adminLid: ADMIN_LID,

  // 🗝️ Chaves Gemini — mantidas no .env (GEMINI_API_KEY + GEMINI_API_KEY_2/_3),
  // que é protegido do push no GitHub (gitignore). Aqui ficam vazias para não
  // vazar a chave. A rotação lê múltiplas chaves do ambiente quando esta lista
  // estiver vazia (ver getGeminiKeys em corvo-ia/src/ia/ia_gemini.js).
  geminiKey: '',
  geminiKeys: [],

  // ⚙️ Executável PHP (ferramentas avançadas; vazio = desativado)
  php: '',

  // 🔌 API de consultas Gonzales (tool testar_gonzales_api): base + token ficam
  // AQUI no config, NUNCA hardcoded no arquivo de tools (regra do dono: não
  // revelar a API). A tool custom lê via config.gonzalesApiBase/Token.
  gonzalesApiBase: 'https://apis.gonzalesdev.shop/',
  gonzalesApiToken: '6b37bf0841',
};
