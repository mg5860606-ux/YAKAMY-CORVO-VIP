/**
 * 🎙 𝒀𝑨𝑲𝑨𝑴𝒀 - TTS (texto para voz)
 * Converte texto em áudio e envia como nota de voz no WhatsApp.
 * 🎙 VOZ PRINCIPAL: GEMINI-TTS (a MESMA voz do app Gemini — voz Kore,
 * natural e expressiva, via a API Gemini que o bot já usa).
 * FALLBACK 1: Microsoft Edge neural (pt-BR-FranciscaNeural) — voz humana
 * natural, grátis e sem chave (protocolo WebSocket da Microsoft, mesmo usado
 * pelo pacote edge-tts). FALLBACK 2: Google translate_tts (gTTS).
 * Compartilhado entre o /ia (src/grupo/ia.js) e os triggers de texto
 * (src/grupo/textos.js) para a IA responder por voz nos DOIS caminhos.
 */

const axios = require('axios');
const WebSocket = require('ws');
const crypto = require('crypto');
const { execFile } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { isZonaLiberada } = require('./anexo');
const { validarVideoParaEnvio } = require('../media_utils');

// 🎙 Voz padrão: mulher brasileira neural (casa com a persona). Outras boas:
// pt-BR-AntonioNeural (homem), pt-BR-ThalitaNeural, pt-BR-LeilaNeural...
const VOZ_PADRAO = 'pt-BR-FranciscaNeural';

// 🧹 Limpa emojis/símbolos do texto falado: a voz não lê emoji (só deixaria
// silêncio estranho ou caracteres soltos) e a resposta de voz vai SEM emoji.
// Usa propriedades Unicode oficiais (Node 10+) — cobre TODOS os emojis,
// inclusive ⌚⏰▶↕ e variações de tom de pele/ZWJ.
function limparEmojis(t) {
  return String(t || '')
    .replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}|[\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 👂 Limite de tamanho p/ transcrição via Gemini inline (~19MB máximo da API);
// usado no guardrail de áudio recebido (transcreverAudioRecebido do corvo-ia).
const MAX_AUDIO_TRANSCRIBE_BYTES = 18 * 1024 * 1024;

// 🔐 Edge TTS agora exige o token anti-bot Sec-MS-GEC (algoritmo oficial do
// edge-tts). Constantes usadas para gerar o token a cada chamada.
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' +
  ` (KHTML, like Gecko) Chrome/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0 Safari/537.36` +
  ` Edg/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0`;

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function uuidSemTraco() {
  return uuid().replace(/-/g, '');
}

/**
 * Gera o header Sec-MS-GEC (token anti-bot do Edge TTS).
 * Algoritmo oficial do edge-tts (src/edge_tts/drm.py):
 *   ticks = (unix_agora + 11644473600) arredondado para baixo a cada 5 min,
 *   convertido para intervalos de 100ns, concatenado com o TrustedClientToken,
 *   SHA-256 em hex MAIÚSCULO.
 */
function gerarSecMsgGec(offsetMs = 0) {
  const WIN_EPOCH = 11644473600;
  let ticks = Math.floor((Date.now() + offsetMs) / 1000) + WIN_EPOCH;
  ticks -= ticks % 300; // janela de 5 minutos
  ticks *= 10_000_000; // 100ns
  const strToHash = `${Math.floor(ticks)}${TRUSTED_CLIENT_TOKEN}`;
  return crypto.createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase();
}

function gerarMuid() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

function escaparXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Síntese via Edge TTS (WebSocket direto — sem pacote, usa o ws já instalado).
 * Retorna Buffer MP3 24kHz mono. Igual ao que o pacote edge-tts faz.
 */
function ttsEdge(texto, voz = VOZ_PADRAO) {
  return new Promise((resolve, reject) => {
    // Tenta com o token da janela atual; se der 403/close, tenta a janela
    // anterior (clock do PC pode estar alguns segundos adiantado/atrasado).
    const tentar = (tentativa) => {
      const url =
        'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1' +
        `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
        `&ConnectionId=${uuidSemTraco()}` +
        `&Sec-MS-GEC=${gerarSecMsgGec(tentativa === 0 ? 0 : -305000)}` +
        `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;
      const sock = new WebSocket(url, {
        // 🔁 Permessage-deflate habilitado (padrão do ws / igual ao edge-tts com compress=15)
        perMessageDeflate: true,
        headers: {
          Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          'User-Agent': USER_AGENT,
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'en-US,en;q=0.9',
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache',
          'Cookie': `muid=${gerarMuid()};`,
        },
      });

      const chunks = [];
      let done = false;
      let tentouFallback = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { sock.close(); } catch (e) {}
        if (ok && chunks.length) resolve(Buffer.concat(chunks));
        else if (!tentouFallback && tentativa === 0) {
          // 403/quota/erro na janela atual → tenta a janela anterior uma vez
          tentouFallback = true;
          tentar(1);
        } else reject(new Error('edge-tts vazio'));
      };

      const timer = setTimeout(() => finish(false), 30000);
      sock.on('error', (e) => finish(false));
      sock.on('open', () => {
        sock.send(
          `X-Timestamp:${new Date().toUTCString()}\r\n` +
            'Content-Type:application/json; charset=utf-8\r\n' +
            'Path:speech.config\r\n\r\n' +
            '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":false},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}'
        );
        // 🎚 Prosódia NATURAL e variada: em vez de pitch 0Hz/rate 0% (que soa
        // robótico/monótono), sorteia um leve tom e ritmo por chamada — a voz
        // fica mais humana e menos "lida por máquina".
        const pitchHz = Math.floor(Math.random() * 4);      // +0Hz a +3Hz
        const ratePct = 5 + Math.floor(Math.random() * 11); // +5% a +15% (mais vivo)
        const ssml =
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='pt-BR'>` +
          `<voice name='${voz}'><prosody pitch='+${pitchHz}Hz' rate='+${ratePct}%' volume='+0%'>${escaparXml(texto)}</prosody></voice></speak>`;
        sock.send(
          `X-RequestId:${uuid()}\r\n` +
            'Content-Type:application/ssml+xml\r\n' +
            `X-Timestamp:${new Date().toUTCString()}Z\r\n` +
            `Path:ssml\r\n\r\n${ssml}`
        );
      });
      sock.on('message', (data, isBinary) => {
        if (done) return;
        if (isBinary) {
          // Mensagem binária: pode trazer o cabeçalho "Path:audio\r\n" seguido do
          // áudio, ou só o áudio puro (nas mensagens seguintes).
          const sep = Buffer.from('Path:audio\r\n');
          const idx = data.indexOf(sep);
          if (idx !== -1) chunks.push(data.subarray(idx + sep.length));
          else if (chunks.length) chunks.push(data);
          return;
        }
        if (String(data).includes('turn.end')) finish(true);
      });
      sock.on('close', () => {
        if (!done) {
          // Servidor fechou sem avisar fim: entrega o que veio, se tiver áudio
          if (chunks.length) finish(true);
          else finish(false);
        }
      });
    };
    tentar(0);
  });
}

/**
 * 📌 Extra para CITAÇÃO (reply): quando a IA responde a alguém, o WhatsApp cita
 * a mensagem original da pessoa (aparece marcada como "respondeu a...").
 * allow_sending_without_reply evita erro se a mensagem original for apagada.
 * @param {number|null} msgId - message_id da mensagem a citar (null = sem citação)
 */
function extraQuote(msgId) {
  return msgId
    ? { reply_parameters: { message_id: msgId, allow_sending_without_reply: true } }
    : {};
}

// 🎙 VOZ DO GEMINI (Gemini-TTS) — a MESMA voz do app Gemini (regra do dono).
// Usa a API Interactions do Gemini (generativelanguage.googleapis.com) com o
// modelo TTS nativo e a voz prebuilt "Kore" (feminina, firme — a voz padrão da
// família Gemini). O texto ganha uma direção de VOZ em linguagem natural
// (tom casual/sarcástico da persona), igual o controle de estilo que o próprio
// Gemini oferece. Usa as MESMAS chaves Gemini do bot (rotação em quota/erro).
// Retorna Buffer MP3. É a PRIMEIRA opção do ttsToAudio(); Edge TTS fica de
// fallback (grátis e sem chave) caso a API falhe.
// 🎙 Modelos TTS em ordem de prioridade: o 2.5-flash-preview-tts é o mais
// estável e funciona na conta free. O 3.1-flash-tts-preview fica por último
// pois recebe 503 (sobrecarga) com frequência no plano gratuito.
const MODELOS_TTS_GEMINI = [
  'gemini-2.5-flash-preview-tts', // ✅ funciona na conta free (1ª opção)
  'gemini-2.5-flash-tts',         // ✅ alias estável
  'gemini-3.1-flash-tts-preview', // ⚡ novo mas 503 frequente no free
];
const VOZ_GEMINI = 'Kore';

/**
 * 🕵️ Acha o bloco de áudio na resposta da API Interactions do Gemini.
 * A resposta vem em steps[].content, onde content pode ser array OU objeto
 * chaveado por índice — cada valor com { data (base64), mime_type, sample_rate,
 * channels, type }. Retorna o ÚLTIMO bloco de áudio válido (fiel à doc oficial:
 * output_audio = último bloco gerado) — ou null se não houver.
 */
function acharBlocoAudio(data) {
  try {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (p.inlineData && p.inlineData.data) {
          let sampleRate = 24000;
          let channels = 1;
          const mime = String(p.inlineData.mimeType || '');
          const matchRate = mime.match(/rate=(\d+)/);
          if (matchRate) sampleRate = parseInt(matchRate[1], 10);
          const matchChan = mime.match(/channels=(\d+)/);
          if (matchChan) channels = parseInt(matchChan[1], 10);
          return {
            data: p.inlineData.data,
            sample_rate: sampleRate,
            channels: channels,
            mime_type: mime,
          };
        }
      }
    }
    const steps = data?.steps;
    if (Array.isArray(steps)) {
      let ultimo = null;
      for (const s of steps) {
        const c = s?.content;
        if (!c || typeof c !== 'object') continue;
        const valores = Array.isArray(c) ? c : Object.values(c);
        for (const v of valores) {
          if (v && typeof v === 'object' && v.data &&
              (v.type === 'audio' || String(v.mime_type || '').startsWith('audio') || v.sample_rate)) {
            ultimo = v; // sobrescreve: o ÚLTIMO bloco de áudio é o oficial
          }
        }
      }
      return ultimo;
    }
  } catch (e) { /* resposta malformada → null */ }
  return null;
}

function getFfmpegPath() {
  try {
    const p = require('ffmpeg-static');
    if (p && typeof p === 'string' && fs.existsSync(p)) return p;
  } catch (e) {}
  return 'ffmpeg';
}

/** Converte PCM l16 cru (raw) para MP3 via ffmpeg (estático ou do sistema). */
function pcmL16ParaMp3(pcm, rate, channels) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFfmpegPath();
    const tmpIn = path.join(os.tmpdir(), `corvo_pcm_${Date.now()}_${Math.random().toString(36).slice(2)}.raw`);
    const tmpOut = path.join(os.tmpdir(), `corvo_mp3_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`);
    try { fs.writeFileSync(tmpIn, pcm); } catch (e) { return reject(e); }
    execFile(ffmpegPath, ['-y', '-f', 's16le', '-ar', String(rate || 24000), '-ac', String(channels || 1), '-i', tmpIn, '-codec:a', 'libmp3lame', '-b:a', '48k', '-f', 'mp3', tmpOut], { timeout: 120000 }, (err) => {
      try { fs.unlinkSync(tmpIn); } catch (e) {}
      if (err) { try { fs.unlinkSync(tmpOut); } catch (e) {} return reject(err); }
      try {
        const out = fs.readFileSync(tmpOut);
        try { fs.unlinkSync(tmpOut); } catch (e) {}
        if (!out.length) return reject(new Error('mp3 vazio'));
        resolve(out);
      } catch (e) { reject(e); }
    });
  });
}

/**
 * 🎙 SÍNTESE COM A VOZ DO GEMINI (Gemini-TTS) — a mesma voz do app Gemini.
 * Tenta cada chave do bot (rotação) e cada modelo TTS disponível.
 * @param {string} texto - texto a falar (máx ~400 chars)
 * @returns {Promise<Buffer>} MP3
 */
async function ttsGemini(texto) {
  const t = limparEmojis(String(texto || '')).slice(0, 400);
  if (!t) throw new Error('texto vazio');
  const { getGeminiKeys } = require('../ia/ia_gemini');
  const chaves = getGeminiKeys();
  if (!chaves.length) throw new Error('sem chave Gemini');
  // 🎭 Direção de VOZ em linguagem natural (igual o controle de estilo do
  // próprio Gemini-TTS): tom casual, brasileiro, com o sarcasmo leve da persona
  // — a voz soa como pessoa conversando, não narrando.
  const prompt = `Fale em português brasileiro, de forma NATURAL e casual, como uma mulher brasileira conversando de boa no WhatsApp — tom leve, com um toque de sarcasmo e zoeira quando fizer sentido, sem soar robótico nem narrando. Texto: ${t}`;
  // 🔁 Itera MODELO→CHAVE (não chave→modelo): assim o modelo que funciona
  // (gemini-2.5-flash-preview-tts) é testado em TODAS as chaves antes de
  // passar pro próximo — evita que uma chave com 403/503 no modelo bom
  // desvie pra um modelo ruim com outra chave boa.
  let ultimoErro = null;
  for (const modelo of MODELOS_TTS_GEMINI) {
    for (const chave of chaves) {
      try {
        const r = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${chave}`,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: VOZ_GEMINI }
                }
              }
            }
          },
          // ⏱ Timeout por tentativa: falha rápida em 503/403 → próxima combinação
          { timeout: 20000, headers: { 'Content-Type': 'application/json' } }
        );
        // 📊 Conta o uso do TTS no /apistatus (mesmo padrão do resto do bot)
        try {
          const { recordUsage } = require('../ia/ia_gemini');
          const tokensTTS = r.data?.usageMetadata?.totalTokenCount || r.data?.usage?.totalTokens || 0;
          recordUsage(tokensTTS);
        } catch (e) { /* falha no contador não derruba a voz */ }
        const bloco = acharBlocoAudio(r.data);
        if (!bloco || !bloco.data) throw new Error('resposta sem áudio');
        const pcm = Buffer.from(bloco.data, 'base64');
        if (pcm.length < 500) throw new Error('áudio vazio');
        const mp3 = await pcmL16ParaMp3(pcm, bloco.sample_rate || 24000, bloco.channels || 1);
        if (mp3 && mp3.length >= 500) return mp3;
        throw new Error('conversão vazia');
      } catch (e) {
        ultimoErro = e;
        // 403/429/503 → tenta próxima chave, depois próximo modelo
      }
    }
  }
  throw ultimoErro || new Error('gemini-tts falhou');
}

/**
 * Converte texto em buffer de áudio MP3 (máx ~400 chars por chamada).
 * 🎙 PRIMEIRO: voz do GEMINI (a mesma do app Gemini — natural e expressiva,
 * regra do dono). FALLBACK 1: Edge TTS (voz neural, grátis e sem chave).
 * FALLBACK 2: Google translate_tts (gTTS). Nunca quebra: se tudo falhar,
 * relança o último erro.
 */
async function ttsToAudio(texto) {
  const t = limparEmojis(String(texto || '')).slice(0, 400);
  // 🎙 VOZ DO GEMINI primeiro (a mesma do app Gemini)
  try {
    const buf = await ttsGemini(t);
    if (buf && buf.length >= 500) return buf;
  } catch (e) {
    // cai pro Edge
  }
  // 🎙 FALLBACK 1: Edge TTS (voz neural grátis)
  try {
    const buf = await ttsEdge(t);
    if (buf && buf.length >= 500) return buf;
  } catch (e) {
    // cai pro Google
  }
  // 🎙 FALLBACK 2: Google translate_tts (gTTS)
  const { data } = await axios.get('https://translate.google.com/translate_tts', {
    params: {
      ie: 'UTF-8',
      q: t,
      tl: 'pt',
      client: 'tw-ob',
      total: 1,
      idx: 0,
      textlen: t.length,
    },
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36' },
  });
  const buf = Buffer.from(data);
  if (!buf.length || buf.length < 500) throw new Error('áudio vazio');
  return buf;
}

/**
 * Envia uma nota de voz para cada fala da lista ([AUDIO: ...] marcado pela IA).
 * Se o TTS falhar (rede/quota), cai para texto com 🎙 para não perder a resposta.
 * @param {object} ctx - Telegraf context (precisa de replyWithVoice/reply)
 * @param {string[]} audios - lista de textos falados
 * @param {object} opts - { somenteAudio: boolean } — true envia SÓ a voz, sem
 *   caption, e retorna quantas notas de voz foram enviadas com sucesso.
 * @returns {Promise<number>} quantos áudios foram enviados com sucesso
 */
async function enviarAudios(ctx, audios = [], opts = {}) {
  let enviados = 0;
  const quote = extraQuote(opts.quoteMsgId);
  for (const fala of audios) {
    try {
      const buf = await ttsToAudio(fala);
      // 🚫 Sem caption/emoji na nota de voz: só o áudio vai
      const sent = await ctx.replyWithVoice({ source: buf }, quote);
      // 🐛 FIX reply: registrar áudio no feedback (reply a ele continua a conversa)
      if (sent?.message_id) {
        try {
          require('../ia/ia_feedback').registrarResposta(sent.message_id, ctx.chat?.id, fala);
        } catch (e) {}
      }
      enviados++;
    } catch (e) {
      // 🔄 Fallback: TTS falhou → manda o texto. Também registra no feedback
      // (reply a esse texto fallback continua a conversa)
      const fb = await ctx.reply(`🎙 (áudio) ${String(fala).slice(0, 300)}`).catch(() => null);
      if (fb?.message_id) {
        try {
          require('../ia/ia_feedback').registrarResposta(fb.message_id, ctx.chat?.id, fala);
        } catch (e2) {}
      }
    }
  }
  return enviados;
}

/**
 * Converte qualquer áudio (ogg/opus/wav/m4a...) para MP3 usando ffmpeg-static,
 * o formato mais compatível com o Gemini (e com o Edge TTS se precisar).
 * @param {Buffer} buffer - áudio original
 * @param {string} mimeType - tipo do buffer (ex: 'audio/ogg')
 * @returns {Promise<Buffer>} áudio em MP3
 */
function converterAudioParaMp3(buffer, mimeType = '') {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFfmpegPath();
    const tmpIn = path.join(os.tmpdir(), `corvo_audio_in_${Date.now()}_${Math.random().toString(36).slice(2)}.${mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'm4a'}`);
    const tmpOut = path.join(os.tmpdir(), `corvo_audio_out_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`);
    try { fs.writeFileSync(tmpIn, buffer); } catch (e) { return reject(e); }
    execFile(ffmpegPath, ['-y', '-i', tmpIn, '-ar', '24000', '-b:a', '48k', '-f', 'mp3', tmpOut], { timeout: 120000 }, (err) => {
      try { fs.unlinkSync(tmpIn); } catch (e) {}
      if (err) { try { fs.unlinkSync(tmpOut); } catch (e) {} return reject(err); }
      try {
        const out = fs.readFileSync(tmpOut);
        try { fs.unlinkSync(tmpOut); } catch (e) {}
        if (!out.length) return reject(new Error('áudio convertido vazio'));
        resolve(out);
      } catch (e) { reject(e); }
    });
  });
}

/**
 * 🎙️ Converte áudio (MP3/WAV/OGG...) para OGG/OPUS — o formato NATIVO de nota
 * de voz do WhatsApp. O ttsToAudio retorna MP3, mas enviar MP3 como ptt no
 * Baileys corrompe o áudio no cliente; o WhatsApp espera OGG com codec Opus.
 * @param {Buffer} buffer - áudio original (ex: MP3 do TTS)
 * @returns {Promise<Buffer>} áudio em OGG/OPUS
 */
function converterParaOggOpus(buffer) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFfmpegPath();
    const tmpIn = path.join(os.tmpdir(), `corvo_ogg_in_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`);
    const tmpOut = path.join(os.tmpdir(), `corvo_ogg_out_${Date.now()}_${Math.random().toString(36).slice(2)}.ogg`);
    try { fs.writeFileSync(tmpIn, buffer); } catch (e) { return reject(e); }
    execFile(ffmpegPath, ['-y', '-i', tmpIn, '-c:a', 'libopus', '-b:a', '32k', '-ar', '24000', '-f', 'ogg', tmpOut], { timeout: 120000 }, (err) => {
      try { fs.unlinkSync(tmpIn); } catch (e) {}
      if (err) { try { fs.unlinkSync(tmpOut); } catch (e) {} return reject(err); }
      try {
        const out = fs.readFileSync(tmpOut);
        try { fs.unlinkSync(tmpOut); } catch (e) {}
        if (!out.length) return reject(new Error('áudio ogg vazio'));
        resolve(out);
      } catch (e) { reject(e); }
    });
  });
}

/**
 * 🖼📎 𝒀𝑨𝑲𝑨𝑴𝒀 - Envio de mídias marcadas pela IA
 * Envia as imagens ([IMAGEM: url]) e os arquivos ([ARQUIVO: caminho]) que a
 * IA marcou na resposta. Compartilhado entre o /ia (src/grupo/ia.js) e os
 * triggers de texto (src/grupo/textos.js) para os DOIS caminhos se comportarem
 * igual. Arquivos do PC só são enviados ao DONO; os demais veem um aviso.
 * @param {object} ctx - Telegraf context
 * @param {object} res - resultado do processAgent ({ imagens: [], arquivos: [] })
 */
async function enviarImagensEArquivos(ctx, res = {}, opts = {}) {
  const isDono = ctx?.from && ctx.from.id === require('../../config').adminId;
  const fs = require('fs');
  // 📌 Citação: se a IA respondeu a alguém (quoteMsgId), as mídias também citam
  const quote = extraQuote(opts.quoteMsgId);

  // 🖼 Imagens: qualquer pessoa recebe (são URLs da internet). A foto vai SEM
  // caption — a mídia fala sozinha (regra do dono: nada de "arqui.jpg" junto).
  for (const imgUrl of (res.imagens || [])) {
    try {
      await ctx.replyWithPhoto(imgUrl, { ...quote });
    } catch (e) {
      ctx.reply(`🖼 ${imgUrl}`).catch(() => {});
    }
  }

  // 📎 Arquivos: o DONO recebe qualquer um; QUALQUER pessoa recebe arquivos das
  // ZONAS LIBERADAS (data/anexos, data/downloads, data/screenshots, data/github)
  // — ex: a versão melhorada de um arquivo enviado, ou um download que ela pediu.
  const bloqueados = [];
  for (const arq of (res.arquivos || [])) {
    if (!isDono && !isZonaLiberada(arq)) { bloqueados.push(arq); continue; }
    try {
      if (!fs.existsSync(arq)) { ctx.reply(`📎 Arquivo não encontrado: ${arq}`).catch(() => {}); continue; }
      const ext = arq.toLowerCase().split('.').pop();
      // 🎨 MÍDIA (foto/vídeo/áudio) vai SEM caption — a mídia fala sozinha
      // (regra do dono: nada de "arqui.jpg"/"video.mp4" escrito junto).
      // Só DOCUMENTO (zip/código/txt) mantém o nome do arquivo como legenda.
      const cap = `📎 ${arq.split(/[\\/]/).pop()}`;
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) await ctx.replyWithPhoto({ source: arq }, { ...quote });
      else if (['mp3', 'm4a', 'ogg', 'opus', 'wav'].includes(ext)) await ctx.replyWithAudio({ source: arq }, { ...quote });
      else if (['mp4', 'webm', 'mkv', 'mov'].includes(ext)) {
        // 🛡️ Valida que é um vídeo REAL (não HTML/lixo) e converte webm->mp4
        const v = await validarVideoParaEnvio(arq);
        if (!v.ok) { ctx.reply(`⚠️ ${v.motivo}`).catch(() => {}); continue; }
        try {
          await ctx.replyWithVideo({ source: v.arquivo }, { ...quote });
        } catch (e) {
          try { await ctx.replyWithDocument({ source: v.arquivo }, { ...quote }); } catch (e2) {}
        }
        if (v.convertido) { try { fs.unlinkSync(v.arquivo); } catch (e) {} }
      }
      else await ctx.replyWithDocument({ source: arq }, { caption: cap, ...quote });
    } catch (e) {
      ctx.reply(`📎 ${arq}`).catch(() => {});
    }
  }
  if (bloqueados.length) {
    ctx.reply('🔒 Arquivos fora das zonas liberadas (anexos/downloads/screenshots) são exclusivos do dono 😌').catch(() => {});
  }
}

/**
 * 🎙 𝒀𝑨𝑲𝑨𝑴𝒀 - DECISÃO AUTOMÁTICA DE RESPONDER POR VOZ
 * A IA nem sempre marca [AUDIO: ...] na resposta — para garantir que ela fale
 * por áudio com frequência (regra do dono), o sistema decide por ela quando a
 * resposta é falável (curta, natural, sem código/links/lista) e envia também
 * como nota de voz (o texto continua indo junto, como no marcador [AUDIO]).
 * Chamado depois de enviarAudios, nos DOIS caminhos (/ia e triggers).
 *
 * Regras:
 * - Nunca duplica: só age se a IA NÃO marcou [AUDIO] e não é somente áudio.
 * - Texto ideal: 1-2 frases curtas e naturais (até ~220 chars).
 * - Bloqueia conteúdo técnico: código, links, listas longas, markdown pesado.
 * - Probabilidade: ~quase metade das respostas faláveis vira voz (45%).
 *
 * @param {object} ctx - Telegraf context
 * @param {object} res - resultado do processAgent ({ text, audios, somenteAudio })
 * @param {object} opts - { quoteMsgId } citação igual ao enviarAudios
 * @returns {Promise<number>} 1 se enviou voz automática, 0 caso contrário
 */
async function enviarVozAutomatica(ctx, res = {}, opts = {}) {
  try {
    // 🚫 Já tem áudio marcado pela IA ou é modo só-áudio → não duplica
    if (Array.isArray(res.audios) && res.audios.length) return 0;
    if (res.somenteAudio) return 0;
    // 🚫 Recado oficial/citação em blockquote NÃO vira voz automática (a flag
    // substituiu o antigo prefixo ">" que o guard /^\s*>/ detectava)
    if (res.blockquote) return 0;

    const texto = String(res.text || '').trim();
    if (!texto || texto.length < 10) return 0;

    // 🚫 Não vira voz: explicação longa, código, links, listas, markdown
    const falavel =
      texto.length <= 220 &&
      !/```/.test(texto) &&
      !/https?:\/\//i.test(texto) &&
      !/^\s*[-*•]\s/m.test(texto) &&
      !/^\s*\d+\.\s/m.test(texto) &&
      !/\n\n/.test(texto) &&
      !/[|┃┏┗┣━]/.test(texto) &&
      !/\b(código|codigo|script|função|funcao|tutorial)\b/i.test(texto) &&
      !/\binstala(?:r|ção|do)?\b/i.test(texto);
    if (!falavel) return 0;

    // 🎲 ~45% das respostas faláveis viram voz (decisão automática do sistema)
    if (Math.random() > 0.45) return 0;

    const quote = extraQuote(opts.quoteMsgId);
    const buf = await ttsToAudio(texto);
    // 🚫 Sem caption/emoji na nota de voz: só o áudio vai
    const sent = await ctx.replyWithVoice({ source: buf }, quote);
    // 🐛 FIX reply: registrar TODA resposta da IA no feedback — antes só o
    // texto puro era registrado (resposta.js), então reply a nota de voz,
    // figurinha ou áudio falhava o ehRespostaDaIA e a IA ficava muda.
    if (sent?.message_id) {
      try {
        require('../ia/ia_feedback').registrarResposta(sent.message_id, ctx.chat?.id, texto);
      } catch (e) {}
    }
    return 1;
  } catch (e) {
    // Falha de TTS nunca derruba a resposta em texto
    return 0;
  }
}

/**
 * 📄 Envolve o texto em blockquote HTML real (`<blockquote>`), o que o WhatsApp
 * renderiza como citação de verdade. Prefixar com ">" mostrava o símbolo
 * literal — por isso a IA só marca a FLAG e quem envia aplica aqui.
 * @param {string} texto - texto da resposta
 * @returns {string} texto com <blockquote> (pronto pra parse_mode:'HTML')
 */
function formatarBlockquote(texto) {
  const limpo = String(texto || '').trim();
  if (!limpo) return limpo;
  // Escapa < > & que o HTML interpretaria (o resto é seguro)
  const esc = limpo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<blockquote>${esc}</blockquote>`;
}

/**
 * 🧭 DECIDE A FORMA DA RESPOSTA da IA (texto/figurinha/áudio/reção/só-reação),
 * aplicando a regra de SINCRONIA REALISTA do dono: figurinha + áudio juntos É
 * permitido, mas a IA NUNCA repete o mesmo padrão toda hora — ela VARIA como
 * pessoa de verdade. Quando marca áudio + figurinha juntos (sem SO), sorteia:
 *   ~35% só áudio | ~35% figurinha+texto | ~30% os DOIS juntos (figurinha_audio)
 * Prioridade quando marca mais de um:
 *   somenteReacao > somenteSticker > somenteAudio > áudio+figurinha (sorteio) > só áudio > figurinha+texto
 * @param {object} res - resultado do processAgent ({ text, audios, stickers, reacao, somenteAudio, somenteSticker, somenteReacao })
 * @param {function} rand - função aleatória injetável (padrão Math.random) p/ testes
 * @returns {{ modo: 'texto'|'figurinha'|'audio'|'so_reacao'|'figurinha_texto'|'figurinha_audio', audios: string[], stickers: string[], reacao: string, text: string }}
 */
function planejarResposta(res = {}, rand = Math.random) {
  const audios = Array.isArray(res.audios) ? res.audios.slice() : [];
  const stickers = Array.isArray(res.stickers) ? res.stickers.slice() : [];
  const reacao = res.reacao || '';
  const text = String(res.text || '');

  // 👍 SÓ REAÇÃO: responde apenas reagindo à mensagem da pessoa
  if (res.somenteReacao && reacao) {
    return { modo: 'so_reacao', audios: [], stickers: [], reacao, text: '' };
  }
  // 🟩 SÓ FIGURINHA: só a figurinha, sem texto nem áudio
  if (res.somenteSticker && stickers.length) {
    return { modo: 'figurinha', audios: [], stickers, reacao: '', text: '' };
  }
  // 🎙 SÓ ÁUDIO: só a nota de voz, sem texto
  if (res.somenteAudio && audios.length) {
    return { modo: 'audio', audios, stickers: [], reacao, text: '' };
  }
  // 🎭 ÁUDIO + FIGURINHA marcados juntos (sem SÓ): VARIA como pessoa de verdade —
  // às vezes só áudio, às vezes figurinha+texto, às vezes os DOIS juntos.
  // NUNCA repete o mesmo padrão toda hora (regra do dono: comportamento realista).
  if (audios.length && stickers.length) {
    const r = rand();
    if (r < 0.35) return { modo: 'audio', audios, stickers: [], reacao, text: '' };               // só áudio
    if (r < 0.7) return { modo: 'figurinha_texto', audios: [], stickers, reacao: '', text };      // figurinha + texto
    return { modo: 'figurinha_audio', audios, stickers, reacao: '', text };                        // os dois juntos
  }
  // 🎙 Só áudio marcado (sem figurinha)
  if (audios.length) {
    return { modo: 'audio', audios, stickers: [], reacao, text: '' };
  }
  // 🟩 Figurinha marcada (sem áudio): figurinha ACOMPANHA o texto (normal).
  // Reação NÃO acompanha figurinha (regra do system.md) → limpa a reação.
  if (stickers.length) {
    return { modo: 'figurinha_texto', audios: [], stickers, reacao: '', text };
  }
  // 📝 Só texto
  return { modo: 'texto', audios: [], stickers: [], reacao, text };
}

/**
 * 👍 Reage à MENSAGEM do usuário com um emoji (decisão da IA via [REACAO: ...]).
 * Usa a API react do WhatsApp (via adaptador ctx.telegram.setMessageReaction,
 * compatível com o Telegraf). Falha silenciosa:
 * se o emoji não for suportado no grupo, simplesmente não reage.
 * @param {object} ctx - Telegraf context
 * @param {number|string} messageId - id da mensagem a reagir (a do usuário)
 * @param {string} emoji - emoji da reação (ex: "👍")
 * @returns {Promise<boolean>} true se reagiu, false caso contrário
 */
async function reagirMensagem(ctx, messageId, emoji) {
  try {
    // Pega SÓ o primeiro emoji (com tom de pele/variação) — reação com vários
    // emojis juntos é inválida na API e falharia silenciosamente
    const m = String(emoji || '').match(/(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}][\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]*)/u);
    const e = m ? m[0] : '';
    if (!e || !ctx?.chat?.id || !messageId) return false;
    await ctx.telegram.setMessageReaction(ctx.chat.id, messageId, [{ type: 'emoji', emoji: e }]);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  ttsToAudio,
  ttsGemini,
  enviarAudios,
  enviarImagensEArquivos,
  extraQuote,
  converterAudioParaMp3,
  converterParaOggOpus,
  enviarVozAutomatica,
  reagirMensagem,
  formatarBlockquote,
  planejarResposta,
  MAX_AUDIO_TRANSCRIBE_BYTES,
};
