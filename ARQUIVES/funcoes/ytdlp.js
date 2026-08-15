'use strict';
const fs = require('fs');
const path = require('path');
const youtubedl = require('youtube-dl-exec');

/**
 * 📥 dlp (yt-dlp) — Download de áudio/vídeo do YouTube para o 𝒀𝑨𝑲𝑨𝑴𝒀.
 */
const isTermux = Boolean(
  process.env.TERMUX_VERSION || 
  (process.env.PREFIX && process.env.PREFIX.includes('com.termux')) || 
  process.platform === 'android'
);

function getFfmpegPath() {
  if (isTermux) return 'ffmpeg';
  try {
    const p = require('ffmpeg-static');
    if (p && typeof p === 'string' && fs.existsSync(p)) return p;
  } catch (e) {}
  return 'ffmpeg';
}

const ffmpegPath = getFfmpegPath();
const DIR_DOWNLOADS = path.join(__dirname, '..', '..', 'corvo_dados', 'downloads');

const BASE_OPTS = {
  noPlaylist: true,
  jsRuntimes: 'node:' + process.execPath,
};

if (ffmpegPath !== 'ffmpeg') {
  BASE_OPTS.ffmpegLocation = path.dirname(ffmpegPath);
}

function garantirDir() {
  try { fs.mkdirSync(DIR_DOWNLOADS, { recursive: true }); } catch (e) {}
}

function ehUrl(termo) {
  return /^https?:\/\//i.test(String(termo || '').trim());
}

function fonte(termo) {
  const t = String(termo || '').trim();
  return ehUrl(t) ? t : `ytsearch1:${t}`;
}

/**
 * Busca os metadados (título/canal/duração/thumbnail) do 1º resultado sem baixar.
 * Usa youtube-dl-exec diretamente (sem yt-search, que pode estar quebrado no Termux).
 */
async function buscarMeta(termo) {
  try {
    console.log('[YTDLP] Buscando metadados para:', termo);

    const saida = await youtubedl(fonte(termo), Object.assign({}, BASE_OPTS, {
      dumpSingleJson: true,
      skipDownload: true,
      noWarnings: true,
    }));
    const j = (typeof saida === 'string') ? JSON.parse(saida) : saida;
    if (!j || !j.title) {
      return { ok: false, erro: 'Sem resultados.' };
    }
    console.log('[YTDLP] ✅ Metadados encontrados:', j.title);
    return {
      ok: true,
      titulo: j.title,
      canal: j.channel || j.uploader || 'Desconhecido',
      duracao: j.duration
        ? `${Math.floor(j.duration / 60)}:${String(Math.floor(j.duration % 60)).padStart(2, '0')}`
        : '--:--',
      thumb: j.thumbnail || null,
      url: j.webpage_url || j.url
    };
  } catch (e) {
    console.error('[YTDLP] ❌ Erro ao buscar metadados:', e.message || String(e));
    return { ok: false, erro: e.message || String(e) };
  }
}

/**
 * Baixa e converte áudio (mp3) ou vídeo (mp4). Retorna { ok, arquivo, tamanho } | { ok:false, erro }.
 */
async function baixar(termo, tipo) {
  garantirDir();
  const ext = tipo === 'audio' ? 'mp3' : 'mp4';
  const out = path.join(DIR_DOWNLOADS, `play_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
  
  // 1️⃣ Tenta download nativo com yt-dlp
  try {
    const opts = Object.assign({}, BASE_OPTS, { output: out });
    if (tipo === 'audio') {
      opts.extractAudio = true;
      opts.audioFormat = 'mp3';
      opts.audioQuality = 0;
      opts.format = 'bestaudio/best';
    } else {
      opts.format = 'best[ext=mp4][height<=720]/best[height<=720]';
      opts.mergeOutputFormat = 'mp4';
    }
    await youtubedl(fonte(termo), opts);
    const st = fs.statSync(out);
    if (st.size > 1000) return { ok: true, arquivo: out, tamanho: st.size };
  } catch (e) {
    console.warn(`[YTDLP] Download nativo via yt-dlp falhou (${e.message}), tentando API fallback...`);
    try { fs.unlinkSync(out); } catch (err) {}
  }

  // 2️⃣ Fallback via API caso yt-dlp/ffmpeg nativo não esteja no Termux
  try {
    const axios = require('axios');
    let apiUrl = '';
    if (tipo === 'audio') {
      apiUrl = `https://api.bronxyshost.com.br/api-bronxys/play?nome_url=${encodeURIComponent(termo)}&apikey=bronxys`;
    } else {
      apiUrl = `https://okarun-api.com.br/api/xvideos?url=${encodeURIComponent(termo)}&apikey=okarun`;
    }
    const resp = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 45000 });
    if (resp.status === 200 && resp.data && resp.data.length > 5000) {
      fs.writeFileSync(out, resp.data);
      return { ok: true, arquivo: out, tamanho: resp.data.length };
    }
  } catch (apiErr) {
    console.error('[YTDLP] ❌ Fallback de API falhou:', apiErr.message);
  }

  return { ok: false, erro: 'Não foi possível baixar no Termux. Execute no Termux: pkg install ffmpeg python -y' };
}

const baixarAudio = (termo) => baixar(termo, 'audio');
const baixarVideo = (termo) => baixar(termo, 'video');

module.exports = { buscarMeta, baixarAudio, baixarVideo };
