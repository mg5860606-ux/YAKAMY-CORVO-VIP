/**
 * 🎞️ 𝒀𝑨𝑲𝑨𝑴𝒀 - UTILITÁRIOS DE MÍDIA
 * Detecta o tipo REAL de um arquivo pelos primeiros bytes (magic bytes) — não
 * confia em extensão nem em Content-Type — e converte vídeos para MP4 (H.264 +
 * AAC) quando o formato original (webm/mkv) não é bem reproduzido no WhatsApp.
 * Usado pela IA (src/ia/ia_tools.js) e pelo envio de arquivos (src/grupo/tts.js)
 * para nunca mandar "vídeo corrompido" (ex: página HTML salva como .mp4).
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const DIR_DOWNLOADS = path.resolve(__dirname, '..', 'data', 'downloads');

// Detecta o tipo real pelo conteúdo (magic bytes), não pela extensão/header
function detectarTipoBuffer(buf) {
  if (!buf || buf.length < 12) return 'desconhecido';
  // MP4 / MOV (ISO BMFF): bytes 4-8 = 'ftyp'
  if (buf.toString('latin1', 4, 8) === 'ftyp') return 'mp4';
  // WebM / Matroska: 1A 45 DF A3
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm';
  // HTML (página de erro/bloqueio baixada no lugar do arquivo)
  const head = buf.toString('latin1', 0, Math.min(buf.length, 64)).trimStart().toLowerCase();
  if (head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<?xml')) return 'html';
  if (head.startsWith('<')) return 'html';
  // Imagens
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.toString('latin1', 0, 4) === 'GIF8') return 'gif';
  return 'desconhecido';
}

function detectarTipoArquivo(caminho) {
  try {
    const fd = fs.openSync(caminho, 'r');
    const buf = Buffer.alloc(64);
    const lidos = fs.readSync(fd, buf, 0, 64, 0);
    fs.closeSync(fd);
    return detectarTipoBuffer(buf.subarray(0, lidos));
  } catch (e) {
    return 'desconhecido';
  }
}

/**
 * Converte qualquer vídeo para MP4 (H.264 + AAC) usando ffmpeg-static.
 * Retorna o caminho do MP4 convertido ou null em caso de falha.
 */
function converterParaMp4(caminhoOrigem) {
  return new Promise((resolve) => {
    try {
      fs.mkdirSync(DIR_DOWNLOADS, { recursive: true });
      const saida = path.join(DIR_DOWNLOADS, `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp4`);
      const args = ['-y', '-i', caminhoOrigem, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', saida];
      execFile(ffmpegPath, args, { timeout: 300000 }, (err) => {
        if (err) {
          try { fs.unlinkSync(saida); } catch (e) {}
          return resolve(null);
        }
        try {
          if (fs.statSync(saida).size < 1000) {
            fs.unlinkSync(saida);
            return resolve(null);
          }
        } catch (e) {
          return resolve(null);
        }
        resolve(saida);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Valida um arquivo de vídeo antes de enviar. Retorna:
 * - { ok: true, arquivo, convertido? } se for MP4 real (ou convertido de webm)
 * - { ok: false, motivo } se for HTML/lixo/imagem (NÃO enviar como vídeo)
 */
async function validarVideoParaEnvio(caminho) {
  const tipo = detectarTipoArquivo(caminho);
  if (tipo === 'html') {
    return { ok: false, motivo: 'O download não gerou um vídeo: o servidor retornou uma página HTML (link bloqueado/expirado/inválido). Peça para a IA tentar outra fonte.' };
  }
  // Tamanho mínimo (só p/ vídeo): pega downloads truncados/arquivos vazios sem
  // prejudicar clipes curtos legítimos. 4KB é o suficiente p/ um MP4 real mínimo.
  if (tipo === 'mp4' || tipo === 'webm') {
    try {
      if (fs.statSync(caminho).size < 4 * 1024) {
        return { ok: false, motivo: 'O arquivo baixado é pequeno demais para ser um vídeo válido (download truncado/incompleto).' };
      }
    } catch (e) {
      return { ok: false, motivo: 'Não consegui ler o arquivo de vídeo.' };
    }
  }
  if (tipo === 'mp4') return { ok: true, arquivo: caminho };
  if (tipo === 'webm') {
    const mp4 = await converterParaMp4(caminho);
    if (mp4) return { ok: true, arquivo: mp4, convertido: true };
    return { ok: false, motivo: 'Não consegui converter o vídeo para MP4.' };
  }
  if (tipo === 'jpeg' || tipo === 'png' || tipo === 'gif') {
    return { ok: false, motivo: 'Esse arquivo é uma imagem, não um vídeo.' };
  }
  return { ok: false, motivo: 'O arquivo baixado não parece ser um vídeo válido.' };
}

module.exports = { detectarTipoBuffer, detectarTipoArquivo, converterParaMp4, validarVideoParaEnvio, DIR_DOWNLOADS };
