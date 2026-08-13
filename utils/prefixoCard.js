// 🃏 utils/prefixoCard.js — Cartão bonito do /prefixo (SVG + sharp)
// Monta um cartão quadrado estilo "capa corvo" com a FOTO DO USUÁRIO em círculo,
// o prefixo GIGANTE, o nome do bot, o nome do usuário e o cumprimento/hora.
// Reutiliza a mesma linguagem visual das capas profissionais do ia_core
// (paletas sorteadas, faixas gradiente, badge, divisores). Retorna Buffer PNG
// ou null se o sharp falhar (o chamador cai no fallback antigo).

let sharpCache = null;
function getSharp() {
  if (sharpCache !== null) return sharpCache;
  try {
    sharpCache = require('sharp');
  } catch (e) {
    sharpCache = null;
  }
  return sharpCache;
}

// 🎨 Mesmas paletas das capas corvo (peso = chance de sorteio)
const PALETAS = [
  { nome: 'ouro', bg: ['#3a2d0e', '#241a07', '#0d0903'], faixaDe: '#ffd700', faixaAte: '#8a5a00', titulo: '#ffffff', sub: '#f0e2b6', linhaDiv: '#8a6d1f', rodape: '#d4af37', peso: 3 },
  { nome: 'ciano', bg: ['#241463', '#150b3a', '#070312'], faixaDe: '#00e5ff', faixaAte: '#a855f7', titulo: '#ffffff', sub: '#cfc8ff', linhaDiv: '#4b3fa0', rodape: '#9b8cff', peso: 1 },
  { nome: 'rubi', bg: ['#3d0d14', '#200710', '#0a0305'], faixaDe: '#ff3b3b', faixaAte: '#8b0000', titulo: '#ffffff', sub: '#f5c4c4', linhaDiv: '#8b2a2a', rodape: '#ff6b6b', peso: 1 },
  { nome: 'azul', bg: ['#0d2a4d', '#071a33', '#020710'], faixaDe: '#00b3ff', faixaAte: '#1e5fff', titulo: '#ffffff', sub: '#c4e0f5', linhaDiv: '#2a5f9e', rodape: '#5bbfff', peso: 1 },
  { nome: 'verde', bg: ['#0d3a2a', '#07221a', '#020a07'], faixaDe: '#00ff88', faixaAte: '#00b366', titulo: '#ffffff', sub: '#c4f5dd', linhaDiv: '#2a8a55', rodape: '#4dffaa', peso: 1 }
];

function sortearPaleta() {
  const total = PALETAS.reduce((s, p) => s + (p.peso || 1), 0);
  let r = Math.floor(Math.random() * total);
  for (const p of PALETAS) {
    r -= p.peso || 1;
    if (r < 0) return p;
  }
  return PALETAS[0];
}

function escaparXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function limparTexto(s, max) {
  return String(s || '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 40);
}

/**
 * Gera o cartão do prefixo.
 * @param {object} opts
 * @param {Buffer|null|undefined} opts.fotoBuffer - Buffer da foto do usuário (já baixada)
 * @param {string} opts.prefixo - prefixo do bot (ex: "/")
 * @param {string} opts.nomeBot - nome do bot (badge)
 * @param {string} opts.nomeUser - nome do usuário que pediu
 * @param {string} opts.tempoLabel - cumprimento/hora (ex: "Boa noite")
 * @returns {Promise<Buffer|null>} PNG do cartão, ou null se falhar
 */
async function montarCardPrefixo({ fotoBuffer, prefixo, nomeBot, nomeUser, tempoLabel }) {
  const sharp = getSharp();
  if (!sharp) return null;
  try {
    const W = 720;
    const H = 720;
    const paleta = sortearPaleta();
    const cx = W / 2;

    // 🖼️ Foto circular: corta em círculo (208px) se tiver buffer
    let fotoCircular = null;
    if (fotoBuffer && Buffer.isBuffer(fotoBuffer) && fotoBuffer.length > 0) {
      try {
        const R = 104;
        const mascara = Buffer.from(
          `<svg width="${R * 2}" height="${R * 2}" viewBox="0 0 ${R * 2} ${R * 2}">` +
          `<circle cx="${R}" cy="${R}" r="${R}" fill="#fff"/></svg>`
        );
        fotoCircular = await sharp(fotoBuffer)
          .resize(R * 2, R * 2, { fit: 'cover', position: 'attention' })
          .composite([{ input: mascara, blend: 'dest-in' }])
          .png()
          .toBuffer();
      } catch (e) {
        fotoCircular = null; // foto inválida → segue com o anel vazio
      }
    }

    // 📝 Textos (sanitizados p/ SVG)
    const pfx = escaparXml(limparTexto(prefixo, 6) || '/');
    const nomeBotTxt = escaparXml(limparTexto(nomeBot, 22) || 'corvo');
    const nomeUserTxt = escaparXml(limparTexto(nomeUser, 26) || 'Usuário');
    const tempoTxt = escaparXml(limparTexto(tempoLabel, 30));

    // Tamanho do prefixo adapta ao nº de caracteres (ex: "/" gigante, "abc/" menor)
    const tamPfx = pfx.length <= 1 ? 150 : pfx.length <= 2 ? 118 : pfx.length <= 4 ? 88 : 62;

    // 🎨 Anel da foto (desenhado no SVG base; a foto entra por composição)
    const R = 104;
    const cyFoto = 236;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="85%">
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
  <rect x="0" y="0" width="${W}" height="12" fill="url(#faixa)"/>
  <rect x="0" y="${H - 12}" width="${W}" height="12" fill="url(#faixa)"/>
  <path d="M48 84 V48 H84" fill="none" stroke="${paleta.faixaDe}" stroke-opacity="0.5" stroke-width="3"/>
  <path d="M${W - 48} 84 V48 H${W - 84}" fill="none" stroke="${paleta.faixaAte}" stroke-opacity="0.5" stroke-width="3"/>
  <path d="M48 ${H - 84} V${H - 48} H84" fill="none" stroke="${paleta.faixaAte}" stroke-opacity="0.5" stroke-width="3"/>
  <path d="M${W - 48} ${H - 84} V${H - 48} H${W - 84}" fill="none" stroke="${paleta.faixaDe}" stroke-opacity="0.5" stroke-width="3"/>
  <rect x="${cx - 150}" y="64" width="300" height="52" rx="26" fill="#0a0603" fill-opacity="0.88" stroke="url(#bordaBadge)" stroke-width="2"/>
  <text x="${cx}" y="98" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="bold" fill="${paleta.faixaDe}" letter-spacing="5" text-anchor="middle">${nomeBotTxt}</text>
  <circle cx="${cx}" cy="${cyFoto}" r="${R + 8}" fill="none" stroke="url(#faixa)" stroke-width="5"/>
  <text x="${cx}" y="438" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="bold" fill="${paleta.titulo}" letter-spacing="8" text-anchor="middle">MEU PREFIXO</text>
  <g filter="url(#sombra)">
    <text x="${cx}" y="556" font-family="Arial, Helvetica, sans-serif" font-size="${tamPfx}" font-weight="bold" fill="url(#faixa)" text-anchor="middle">${pfx}</text>
  </g>
  <line x1="170" y1="600" x2="${cx - 44}" y2="600" stroke="${paleta.linhaDiv}" stroke-opacity="0.65" stroke-width="1.5"/>
  <line x1="${cx + 44}" y1="600" x2="${W - 170}" y2="600" stroke="${paleta.linhaDiv}" stroke-opacity="0.65" stroke-width="1.5"/>
  <rect x="${cx - 7}" y="592" width="14" height="14" transform="rotate(45 ${cx} 600)" fill="url(#faixa)"/>
  <text x="${cx}" y="656" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="bold" fill="${paleta.titulo}" text-anchor="middle">${nomeUserTxt}</text>
  ${tempoTxt ? `<text x="${cx}" y="688" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="${paleta.sub}" text-anchor="middle">${tempoTxt}</text>` : ''}
</svg>`;

    let base = await sharp(Buffer.from(svg)).png().toBuffer();

    // 🖼️ Compõe a foto circular por cima do anel
    if (fotoCircular) {
      base = await sharp(base)
        .composite([{ input: fotoCircular, left: cx - R, top: cyFoto - R }])
        .png()
        .toBuffer();
    }
    return base;
  } catch (e) {
    console.error('prefixoCard: erro ao montar cartão:', e && e.message ? e.message : e);
    return null;
  }
}

module.exports = { montarCardPrefixo, sortearPaleta, PALETAS };
