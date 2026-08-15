// 🧠 𝒀𝑨𝑲𝑨𝑴𝒀-IA — IA do bot 𝒀𝑨𝑲𝑨𝑴𝒀.
// Cérebro completo da 𝒀𝑨𝑲𝑨𝑴𝒀: mesma estrutura e nível da IA do CORVO,
// porém baseada NO 𝒀𝑨𝑲𝑨𝑴𝒀 — executa comandos do 𝒀𝑨𝑲𝑨𝑴𝒀, mexe nos dados do 𝒀𝑨𝑲𝑨𝑴𝒀
// (vip.json, banned.json, users.json) e manda no WhatsApp via Baileys.

const fs = require('fs');
const path = require('path');

// 📱 Número do DONO e Números Autorizados
function lerAdminNumbers() {
  const FALLBACKS = ['5521990682259', '555197727857', '5551997727857'];
  try {
    const raw = fs.readFileSync(
      path.join(__dirname, '..', 'INFON', 'DADOS', 'config.json'),
      'utf8'
    );
    const cfg = JSON.parse(raw);
    const list = Array.isArray(cfg.ownerNumber) ? cfg.ownerNumber : [cfg.ownerNumber];
    const nums = list.map(n => String(n || '').replace(/\D/g, '')).filter(Boolean);
    if (!nums.some(n => n.includes('5197727857') || n.includes('51997727857'))) {
      nums.push('555197727857', '5551997727857');
    }
    return nums;
  } catch (e) {
    return FALLBACKS;
  }
}

const ADMIN_NUMBERS = lerAdminNumbers();
const ADMIN_ID = ADMIN_NUMBERS[0] || '5521990682259';

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

  // 📱 Número do DONO principal e lista de autorizados
  adminId: ADMIN_ID,
  adminNumbers: ADMIN_NUMBERS,

  // 🕵️ Checadores de autorização
  isOwnerNumber: (id) => {
    if (!id) return false;
    const num = String(id).replace(/\D/g, '');
    if (!num) return false;
    return ADMIN_NUMBERS.some(n => {
      const cleanN = String(n).replace(/\D/g, '');
      return num === cleanN || num.endsWith(cleanN) || cleanN.endsWith(num) || (num.length >= 8 && cleanN.length >= 8 && num.slice(-8) === cleanN.slice(-8));
    });
  },
  isOwnerPrincipal: (id) => {
    if (!id) return false;
    const num = String(id).replace(/\D/g, '');
    const p = String(ADMIN_ID).replace(/\D/g, '');
    return num === p || num.endsWith(p) || p.endsWith(num);
  },

  // 🆔 LID do DONO
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
