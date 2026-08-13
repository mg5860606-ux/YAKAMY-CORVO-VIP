'use strict';
/**
 * 📥 dlp (yt-dlp) — Download de áudio/vídeo do YouTube para o 𝒀𝑨𝑲𝑨𝑴𝒀.
 *
 * Usa o pacote `youtube-dl-exec` (que baixa o binário do yt-dlp) + `ffmpeg-static`
 * para não depender de ffmpeg instalado no sistema (que não existe no PATH da máquina).
 *
 * Suporta:
 *  - busca por nome (ex: "midnight")  → ytsearch1
 *  - link direto do YouTube           → usa a URL como está
 */
const fs = require('fs');
const path = require('path');
const youtubedl = require('youtube-dl-exec');
const ffmpegPath = require('ffmpeg-static');

const DIR_DOWNLOADS = path.join(__dirname, '..', '..', 'corvo_dados', 'downloads');

const BASE_OPTS = {
  noPlaylist: true,
  ffmpegLocation: path.dirname(ffmpegPath),
  jsRuntimes: 'node:' + process.execPath,
};

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
      console.error('[YTDLP] Sem resultados encontrados para:', termo);
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
  const opts = Object.assign({}, BASE_OPTS, { output: out });
  if (tipo === 'audio') {
    opts.extractAudio = true;
    opts.audioFormat = 'mp3';
    opts.audioQuality = 0;
    opts.format = 'bestaudio/best';
  } else {
    // 🎬 Cap 720p p/ o arquivo não estourar o limite de envio do WhatsApp
    opts.format = 'best[ext=mp4][height<=720]/best[height<=720]';
    opts.mergeOutputFormat = 'mp4';
  }
  try {
    await youtubedl(fonte(termo), opts);
    const st = fs.statSync(out);
    if (st.size < 1000) throw new Error('download vazio');
    return { ok: true, arquivo: out, tamanho: st.size };
  } catch (e) {
    try { fs.unlinkSync(out); } catch (err) {}
    return { ok: false, erro: e.message || String(e) };
  }
}

const baixarAudio = (termo) => baixar(termo, 'audio');
const baixarVideo = (termo) => baixar(termo, 'video');

module.exports = { buscarMeta, baixarAudio, baixarVideo };
