// 🧠 𝒀𝑨𝑲𝑨𝑴𝒀-IA — IA do bot 𝒀𝑨𝑲𝑨𝑴𝒀.
// Chamado pelo hook no startcorvo() do corvo.js para CADA mensagem recebida.
// Decide quando a IA responde (DM, /ia, @menção, reply ao bot, áudio) e usa
// o MESMO cérebro do projeto principal (src/ia) — adaptado pro corvo:
// a IA DOMINA o corvo (executa comandos via commandExecutor, mexe em VIP/ban/
// broadcast/stats nos arquivos do corvo) e responde igual pessoa de verdade.
const fs = require('fs');
const crypto = require('crypto');
const config = require('./config');
const { processAgent } = require('./src/ia/ia_agent');
const memoria = require('./src/grupo/memoria');
const { criarCtx, extrairTexto, numeroDeJid, baixarMidia } = require('./src/adapter/ctx');
const { salvarAnexoWhats } = require('./src/grupo/anexo');
const core = require('./src/ia/ia_core');
const { isOwnerInGroup } = require('./src/grupo_utils');
const { sanitizarErroUsuario } = require('./src/ia/ia_gemini');
const lembretes = require('./src/lembretes');
const monitorPrecos = require('./src/ia/ia_monitor_precos');

// 🔌 Notificadores de fundo (LEMBRETES + MONITOR DE PREÇOS): o módulo de
// lembretes/monitor só conhece uma função `sender(chatId, texto)`. Aqui no
// corvo-ia (que tem o socket do corvo) a gente liga essa função — e retoma os
// pendentes salvos em disco (lembretes agendados / monitores de preço) uma
// única vez no primeiro processar (requer cache do módulo garante 1x).
// 🐛 socketAtual: a closure do sender SEMPRE usa o socket MAIS RECENTE (o
// processar atualiza a cada mensagem) — se o Baileys reconectar com socket
// novo, as notificações continuam saindo (não ficam presas no socket antigo).
let notificadoresLigados = false;
let socketAtual = null;
function ligarNotificadores(corvo) {
  socketAtual = corvo; // sempre o socket mais recente (reconexão do Baileys)
  if (notificadoresLigados) return;
  notificadoresLigados = true;
  // 📤 Envio genérico de texto: mesma forma que a IA responde (corvo.sendMessage)
  const enviar = (jid, texto) => {
    try {
      const s = socketAtual || corvo;
      const p = s.sendMessage(jid, { text: String(texto || '').slice(0, 4000) });
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) { /* notificação não bloqueia */ }
  };
  try { lembretes.setSender(enviar); } catch (e) {}
  try { monitorPrecos.setSender(enviar); } catch (e) {}
  // 🔄 Retoma pendentes que sobraram de uma sessão anterior (bot reiniciou no
  // meio de um lembrete agendado ou monitor de preço ativo).
  try { lembretes.reschedulePending(); } catch (e) {}
  try { monitorPrecos.reschedulePending(); } catch (e) {}
}

// 🔒 Trava por chat: evita processar 2 mensagens do mesmo chat em paralelo
const processando = new Map();

// 😴 Helper simples de espera (usado pra simular a "digitação" da IA)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 🎞️ Mapas de mimetype por extensão (envio de mídia no WhatsApp) — nível de
// módulo pra não recriar a cada resposta.
const MIME_VIDEO = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo', m4v: 'video/mp4' };
const MIME_AUDIO = { mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/ogg; codecs=opus', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac' };
const MIME_DOC = { pdf: 'application/pdf', txt: 'text/plain', json: 'application/json', zip: 'application/zip', rar: 'application/x-rar-compressed', '7z': 'application/x-7z-compressed', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', csv: 'text/csv', html: 'text/html' };

// 🛡️ Blindagem FINAL de texto: NUNCA deixa vazar a URL da API em NENHUMA
// mensagem enviada ao WhatsApp — mesmo que a IA repita no texto um erro de
// ferramenta que contenha o link (ex: "Error fetching from
// https://generativelanguage.googleapis.com/v1beta/models/..."). Cobre a URL
// completa e o domínio solto. Aplicada em TODA saída: texto, legenda e voz.
const RE_URL_API = /https?:\/\/[a-z0-9.-]*generativelanguage\.googleapis\.com[^\s)'"}]*/gi;
const RE_DOMINIO_API = /generativelanguage\.googleapis\.com|(?:[a-z0-9-]+\.)?googleapis\.com/gi;

// 🧠 NOME da IA na mensagem: "yakamy", "Yakamy", "𝒀𝑨𝑲𝑨𝑴𝒀", "@yakamy",
// "oi yakamy" — em QUALQUER posição da frase (borda de palavra: espaço/
// pontuação antes e depois). Usada no gatilho (deveResponder) e na limpeza
// do prompt (processar) — fonte ÚNICA pra não divergirem.
const RE_NOME_IA = /(?:^|[\s\p{P}])@?(?:yakamy|𝒀𝑨𝑲𝑨𝑴𝒀)(?=$|[\s\p{P}])/iu;
// 🔁 Versão GLOBAL (pra replace) derivada da MESMA fonte — o test não pode
// usar g (lastIndex viciaria), então o replace usa esta derivada do source.
const RE_NOME_IA_G = new RegExp(RE_NOME_IA.source, 'giu');
function blindarTexto(s) {
  if (!s) return s;
  return String(s)
    .replace(RE_URL_API, '[link oculto]')
    .replace(RE_DOMINIO_API, '[serviço interno]');
}

// ⌨️ Heartbeat do "digitando...": o WhatsApp esconde o indicador de presença
// depois de ~30s sem renovar, e a IA pode demorar 1-2 min (Gemini + ferramentas
// como download/geração de vídeo). Envia "composing" imediatamente e reenvia a
// cada 10s; devolve uma função que limpa o timer e envia "paused".
const INTERVALO_COMPOSING_MS = 10000;
function iniciarComposing(corvo, jid) {
  let timer = null;
  const bater = () => {
    try {
      const p = corvo.sendPresenceUpdate?.('composing', jid);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) { /* presença não bloqueia */ }
  };
  bater(); // primeira batida imediata (feedback rápido)
  timer = setInterval(bater, INTERVALO_COMPOSING_MS);
  if (timer.unref) timer.unref(); // não segura o processo aberto
  return async () => {
    if (timer) { clearInterval(timer); timer = null; }
    try { await corvo.sendPresenceUpdate?.('paused', jid); } catch (e) { /* presença não bloqueia */ }
  };
}

// 🎙️ TTS (voz) — carregado preguiçosamente (só se a IA marcar áudio)
let ttsMod = null;
function getTts() {
  if (!ttsMod) ttsMod = require('./src/grupo/tts');
  return ttsMod;
}

// 🟩 Pool de figurinhas do WhatsApp (carregado preguiçosamente)
let stickersMod = null;
function getStickers() {
  if (!stickersMod) stickersMod = require('./src/ia/ia_stickers_whats');
  return stickersMod;
}

// 🎙️ ANTI-DUPLICADO áudio↔texto: a IA costuma marcar [AUDIO: fala] E escrever o
// MESMO conteúdo no texto (o usuário recebe áudio + texto iguais). Esta função
// decide se o texto apenas REPETE o que já foi falado (→ deve ser suprimido).
// Normaliza acentos/emojis/pontuação (aí == ai, vc == você NÃO, mas cobre as
// diferenças de emoji/sinal) e compara por COBERTURA DE PALAVRAS: se a fala
// está (quase) toda repetida no texto E o texto não é MUITO maior que a fala,
// é duplicado. Explicação de verdade (texto bem maior que a fala) NÃO é
// suprimida — o usuário recebe o áudio + a explicação por escrito.
function ehRepeticaoAudioTexto(falas, texto) {
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // tira acentos (aí→ai)
      .replace(/[^a-z0-9\s]/gi, ' ') // emojis/pontuação → espaço
      .replace(/\s+/g, ' ')
      .trim();
  const textoLimpo = norm(texto);
  if (!textoLimpo) return false;
  const palavrasTexto = textoLimpo.split(' ').filter((w) => w.length >= 3);
  const setTexto = new Set(palavrasTexto);
  return (Array.isArray(falas) ? falas : []).some((f) => {
    const fl = norm(f);
    if (!fl) return false;
    // 🎯 Igualdade exata (após limpeza de acento/emoji/pontuação) → duplicado
    if (fl === textoLimpo) return true;
    const palavrasFala = fl.split(' ').filter((w) => w.length >= 3);
    const cobertas = palavrasFala.filter((w) => setTexto.has(w)).length;
    const cobertura = palavrasFala.length ? cobertas / palavrasFala.length : 0;
    // 🧩 A fala está (quase) toda no texto E o texto não é muito maior (≤ ~3x).
    // Explicação de verdade (texto MUITO maior que a fala) não é duplicada.
    const proporcao = textoLimpo.length / Math.max(fl.length, 1);
    if (cobertura >= 0.75 && proporcao <= 3) return true;
    // 🔁 Complemento: o TEXTO está (quase) todo DENTRO da fala e é curto → o
    // áudio já cobre tudo, o texto é só sobra (ex: fala "bom dia amor",
    // texto "bom dia").
    const setFala = new Set(palavrasFala);
    const cobertasInv = palavrasTexto.filter((w) => setFala.has(w)).length;
    if (palavrasTexto.length &&
        cobertasInv / palavrasTexto.length >= 0.9 &&
        textoLimpo.length <= fl.length * 1.5) return true;
    return false;
  });
}

// 🎲 Chance de reação: a IA marca [REACAO: ...] em quase toda resposta; pra
// não ficar forçado reagindo toda hora, só ~40% das reações marcadas saem de
// verdade (exceto [REACAO_SO], que é a IA decidindo responder SÓ com reação).
const CHANCE_REACAO = 0.4;

// 🎧 Transcreve um áudio recebido (nota de voz) pra IA entender
async function transcreverAudioRecebido(corvo, msg) {
  try {
    const buf = await baixarMidia(corvo, msg);
    if (!buf || !buf.length) return '';
    // 🛡️ Guardrail: áudio grande demais pro Gemini inline (~19MB) não é
    // transcrito (mesmo limite do tts.js, exportado pra não divergir).
    if (buf.length > getTts().MAX_AUDIO_TRANSCRIBE_BYTES) return '';
    const mime = msg.message?.audioMessage?.mimetype || 'audio/ogg';
    let mp3 = buf;
    if (!/mp3|mpeg/i.test(mime)) {
      try {
        mp3 = await getTts().converterAudioParaMp3(buf, mime);
      } catch (e) { /* mantém original */ }
    }
    const { transcreverAudio } = require('./src/ia/ia_gemini');
    return await transcreverAudio(mp3, 'audio/mpeg');
  } catch (e) {
    return '';
  }
}

// 🌊 PROATIVIDADE (regra do dono): a IA pode comentar SOZINHA mensagens que
// ninguém endereçou a ela, quando parecem pergunta/assunto pro grupo. Limites
// anti-spam: chance baixa por mensagem + cooldown por grupo (máx 1 a cada 15min).
const PROATIVO_COOLDOWN_MS = 15 * 60 * 1000;
const PROATIVO_CHANCE = 0.12;
const proativoUltimo = new Map(); // jid -> timestamp da última resposta proativa

// 🤔 Parece pergunta/assunto que merece a IA entrar? (para a proatividade)
function parecePerguntaProGrupo(texto) {
  const t = String(texto || '').trim();
  if (t.length < 12 || t.length > 400) return false;
  return /\?|algu[ée]m|ningu[ée]m|como fa|quem sabe|voc[êe]s|me ajuda|ajuda a[íi]|sabem|o que [ée]|pq |por que|\bvcs\b/i.test(t);
}

// ✅ Deve a IA responder esta mensagem?
async function deveResponder(upsert, msg, ctx, prefix) {
  if (msg?.key?.fromMe) return false; // mensagem do próprio bot
  const m = msg?.message || {};
  const ehAudio = !!m.audioMessage;
  const texto = extrairTexto(msg);
  const p = prefix || '/';

  // 🧠 Trigger explícito: "ia ..." / "/ia ..." / "{prefixo}ia ..."
  const pEsc = String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexIa = new RegExp(`^(?:${pEsc})?ia(\\s|$|:)`, 'i');
  const ehComandoIa = regexIa.test(texto);

  // 🚫 Comandos do corvo (prefixo . / ! #) ficam com o corvo, salvo /ia
  const ehComando = /^[./!#]/.test(texto) && !ehComandoIa;

  // 💬 Privado (DM): responde conversa (texto ou áudio), mas NÃO rouba comandos do corvo
  if (!ctx._ehGrupo) {
    return !!(texto || ehAudio) && !ehComando;
  }

  // 👥 Grupo: só quando @mencionam o bot OU respondem a mensagem do bot OU usam /ia
  const contextInfo = m.extendedTextMessage?.contextInfo || {};
  const botJid = numeroDeJid(ctx._corvo.user?.id) || '';

  // 🔎 LID: a @menção pode vir com o LID do bot (número aleatório) em vez do
  // número real — usa o ehOBot (resolve via groupMetadata) quando o match
  // simples por número não pega.
  let mencionou = (contextInfo.mentionedJid || []).some(
    (j) => numeroDeJid(j) === botJid
  );
  if (!mencionou && (contextInfo.mentionedJid || []).length) {
    try {
      for (const j of contextInfo.mentionedJid) {
        if (await ctx.ehOBot(j)) { mencionou = true; break; }
      }
    } catch (e) {}
  }

  let respondeuBot =
    !!contextInfo.quotedMessage &&
    numeroDeJid(contextInfo.participant || '') === botJid;
  if (!respondeuBot && !!contextInfo.quotedMessage) {
    try {
      respondeuBot = await ctx.ehOBot(contextInfo.participant);
    } catch (e) {}
  }

  // 🧠 Chamou a IA pelo NOME do bot (sem @): "yakamy oi tudo bem?", "yakamy, oi",
  // "@yakamy oiii", "oi yakamy", "e ai yakamy tudo bem?" ou apenas "yakamy"
  // (case-insensitive) → é endereçada à IA. O nome é reconhecido em QUALQUER
  // posição da frase (borda de palavra: espaço/pontuação antes e depois), não
  // só no início — se falarem o nome dela no meio, ela também responde.
  const chamouPeloNome = RE_NOME_IA.test(String(texto || '').trim());

  // 🚫 REGRA: comando do bot SEMPRE fica com o bot (não rouba). Isso vale
  // TAMBÉM quando a pessoa RESPONDE à mensagem do bot com um comando
  // (ex: responde a msg do bot com /poststatus → o bot posta o status e a
  // IA NÃO responde em paralelo). Única exceção: /ia (trigger da própria IA).
  if (ehComando) return false;

  // 🔘 Clique em botão da PRÓPRIA IA (id começa com "IA|") → sempre endereçado
  let ehCliqueBotaoIa = false;
  try {
    const bid = m.buttonsResponseMessage?.selectedButtonId ||
      (m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
        ? JSON.parse(m.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)?.id
        : '') || '';
    ehCliqueBotaoIa = /^IA\|/i.test(String(bid));
  } catch (e) { ehCliqueBotaoIa = false; }

  // 🌊 PROATIVIDADE (regra do dono): se a mensagem parece pergunta/assunto pro
  // grupo e ninguém chamou a IA, ela pode entrar sozinha — chance baixa +
  // cooldown de 15min por grupo (anti-spam).
  if (!mencionou && !respondeuBot && !chamouPeloNome && !ehComandoIa && !ehCliqueBotaoIa && parecePerguntaProGrupo(texto)) {
    const agora = Date.now();
    const ultimo = proativoUltimo.get(ctx._jid) || 0;
    if (agora - ultimo >= PROATIVO_COOLDOWN_MS && Math.random() < PROATIVO_CHANCE) {
      proativoUltimo.set(ctx._jid, agora);
      return true;
    }
  }

  return (mencionou || respondeuBot || chamouPeloNome || ehComandoIa || ehCliqueBotaoIa) && (!!texto || ehAudio);
}

// 📤 Envia a resposta (texto sempre; voz se a IA marcou áudio; arquivos; reação)
async function enviarResposta(corvo, jid, res, msgOrig) {
  const fs = require('fs');
  const texto = String(res?.text || '').trim();
  const querVoz = !!(res?.somenteAudio || (Array.isArray(res?.audios) && res.audios.length) || (texto && /\[AUDIO\]/i.test(texto)));
  const textoSemMarcador = blindarTexto(String(texto || '')
    .replace(/\[AUDIO[^\]]*\]/gi, '')
    .replace(/\[REACAO[^\]]*\]/gi, '')
    .replace(/\[STICKER[^\]]*\]/gi, '')
    .replace(/\[PREFERENCIA[^\]]*\]/gi, '')
    .replace(/\[BOTOES[^\]]*\]/gi, '')
    .replace(/\[ENQUETE[^\]]*\]/gi, '')
    .replace(/\[SOLTA\]|\[CITAR\]/gi, '')
    .trim());

  // 👍 Reação na mensagem de quem falou — SÓ DE VEZ EM QUANDO (chance ~40%)
  // pra não ficar forçado reagindo toda hora. [REACAO_SO] (somenteReacao)
  // sempre sai: é a IA decidindo responder SÓ com a reação.
  // 🟩 Em modo somenteSticker ([STICKER_SO]) a reação NÃO acompanha (mesmo
  // comportamento do planejarResposta do Telegram: figurinha fala sozinha).
  if (res?.reacao && msgOrig?.key && !res.somenteSticker && (res.somenteReacao || Math.random() <= CHANCE_REACAO)) {
    try {
      await corvo.sendMessage(jid, { react: { text: res.reacao, key: msgOrig.key } });
    } catch (e) { /* reação não bloqueia */ }
  }

  // 🔘 BOTÕES INTERATIVOS ([BOTOES: título|opção1|opção2]) — a IA manda botões
  // clicáveis de verdade. O clique volta pra IA (id "IA|opção") e ela continua
  // a conversa (ctx.js transforma o clique em texto).
  const mBotoes = String(texto || '').match(/\[BOTOES:\s*([^\]]+)\]/i);
  if (mBotoes && mBotoes[1]) {
    try {
      const partes = mBotoes[1].split('|').map(p => p.trim()).filter(Boolean);
      const titulo = partes.shift() || 'Escolha uma opção: 🔽';
      const opcoes = partes.slice(0, 5);
      if (opcoes.length) {
        const buttons = opcoes.map((o) => ({
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: String(o).slice(0, 30), id: 'IA|' + String(o).slice(0, 25) }),
        }));
        await corvo.relayMessage(jid, {
          interactiveMessage: {
            body: { text: titulo.slice(0, 500) },
            footer: { text: '' },
            contextInfo: { participant: corvo.user?.id, mentionedJid: [] },
            nativeFlowMessage: { buttons, messageParamsJson: '' },
          },
        }, {});
      }
    } catch (e) { /* botões não bloqueiam */ }
  }

  // 📊 ENQUETE ([ENQUETE: pergunta|opção1|opção2|opção3]) — enquete de verdade.
  const mEnquete = String(texto || '').match(/\[ENQUETE:\s*([^\]]+)\]/i);
  if (mEnquete && mEnquete[1]) {
    try {
      const partes = mEnquete[1].split('|').map(p => p.trim()).filter(Boolean);
      const pergunta = partes.shift() || 'Enquete 📊';
      const opcoes = partes.slice(0, 10);
      if (opcoes.length) {
        await corvo.sendMessage(jid, {
          poll: { name: pergunta.slice(0, 100), values: opcoes.map(o => String(o).slice(0, 30)), selectableCount: 1 },
          mentions: [],
          contextInfo: { messageSecret: crypto.randomBytes(32) },
        });
      }
    } catch (e) { /* enquete não bloqueia */ }
  }

  // 🟩 FIGURINHAS ([STICKER: hint]) — a IA decide quando usar (como no Titanium).
  // Sorteia do pool (prefere a que combina com o hint/emoji) e envia o webp.
  if (Array.isArray(res?.stickers) && res.stickers.length) {
    let enviouFigu = false;
    for (const hint of res.stickers.slice(0, 2)) {
      try {
        const caminho = getStickers().sorteiar(hint);
        if (caminho && fs.existsSync(caminho)) {
          const buf = fs.readFileSync(caminho);
          await corvo.sendMessage(jid, { sticker: buf });
          enviouFigu = true;
        }
      } catch (e) { /* figurinha não bloqueia */ }
    }
    // 🟩 [STICKER_SO]: a IA marcou que quer responder SÓ com figurinha — retorna
    // depois de enviar (sem vazar texto vazio). Só retorna se pelo menos uma
    // figurinha saiu; senão cai pro texto pra resposta não ficar muda.
    if (res.somenteSticker && enviouFigu) return;
  }

  // 🖼️ Imagens ([IMAGEM: url]) — a IA pode marcar URLs direto (ex:
  // "manda uma foto de X" → buscar_imagens → [IMAGEM: url]). Baileys baixa a
  // URL sozinho (image: { url }). Legenda (o texto da resposta) só na primeira
  // imagem — e RETORNA depois (a imagem carrega a mensagem via legenda),
  // senão o texto sairia duplicado (legenda + mensagem separada).
  if (Array.isArray(res?.imagens) && res.imagens.length) {
    let primeira = true;
    for (const url of res.imagens.slice(0, 3)) {
      try {
        if (typeof url === 'string' && /^https?:/i.test(url)) {
          await corvo.sendMessage(jid, {
            image: { url },
            caption: primeira ? (textoSemMarcador.slice(0, 1000) || undefined) : undefined,
          });
          primeira = false;
        }
      } catch (e) { /* imagem não bloqueia */ }
    }
    return; // imagem já carrega a mensagem (legenda)
  }

  // 📎 Arquivos ([ARQUIVO: caminho]) — envia com o TIPO certo (imagem,
  // vídeo, áudio ou documento). Antes tudo virava document genérico
  // (application/octet-stream) e o WhatsApp não reproduzia mídia inline.
  // 🐛 FIX: se NENHUM arquivo for enviado (caminho não existe/erro), NÃO engole
  // o texto — cai pro envio de texto abaixo pra resposta não ficar muda.
  if (Array.isArray(res?.arquivos) && res.arquivos.length) {
    let enviouArquivo = false;
    for (const caminho of res.arquivos.slice(0, 3)) {
      try {
        if (typeof caminho === 'string' && fs.existsSync(caminho)) {
          const buf = fs.readFileSync(caminho);
          const ext = caminho.split('.').pop()?.toLowerCase() || '';
          const caption = textoSemMarcador.slice(0, 1000) || undefined;
          if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
            await corvo.sendMessage(jid, { image: buf, caption });
          } else if (MIME_VIDEO[ext]) {
            await corvo.sendMessage(jid, { video: buf, mimetype: MIME_VIDEO[ext], caption });
          } else if (MIME_AUDIO[ext]) {
            await corvo.sendMessage(jid, { audio: buf, mimetype: MIME_AUDIO[ext], caption });
          } else {
            await corvo.sendMessage(jid, {
              document: buf,
              fileName: caminho.split(/[\\/]/).pop(),
              mimetype: MIME_DOC[ext] || 'application/octet-stream',
              caption,
            });
          }
          enviouArquivo = true;
        } else if (typeof caminho === 'string' && /^https?:/i.test(caminho)) {
          await corvo.sendMessage(jid, { text: `📎 ${caminho}` });
          enviouArquivo = true;
        }
      } catch (e) { /* arquivo não bloqueia */ }
    }
    if (enviouArquivo) return; // arquivo já carrega a mensagem (legenda)
    // ⚠️ Nenhum arquivo enviado → continua pro envio de texto abaixo.
  }

  // 🎙️ Voz
  if (querVoz) {
    // 🐛 FIX: quando a IA marca [AUDIO: ...], o processAgent move a fala para
    // res.audios e REMOVE do res.text (que fica vazio). Antes o áudio era
    // ignorado e a resposta saía vazia. Agora prioriza res.audios e só usa o
    // texto como fallback.
    const falas = Array.isArray(res?.audios) && res.audios.length
      ? res.audios.slice(0, 3).map(blindarTexto)
      : (textoSemMarcador ? [textoSemMarcador] : []);
    if (falas.length) {
      try {
        let enviouAlgum = false;
        for (const fala of falas) {
          const buf = await getTts().ttsToAudio(fala);
          if (buf && buf.length) {
            // 🐛 FIX áudio corrompido: o ttsToAudio retorna MP3, mas o WhatsApp
            // (Baileys) espera OGG/OPUS para nota de voz (ptt) — enviar MP3
            // como ptt corrompe o áudio no cliente. Converte com ffmpeg.
            try {
              const ogg = await getTts().converterParaOggOpus(buf);
              await corvo.sendMessage(jid, {
                audio: ogg,
                ptt: true,
                mimetype: 'audio/ogg; codecs=opus',
              });
            } catch (e) {
              // ⚠️ Conversão falhou: manda o MP3 original como áudio comum
              // (SEM ptt e com o mimetype certo) — rotular MP3 como OGG/pTT
              // reproduziria a corrupção. Áudio comum toca MP3 sem problema.
              await corvo.sendMessage(jid, {
                audio: buf,
                mimetype: 'audio/mpeg',
              });
            }
            enviouAlgum = true;
          }
        }
        // 🐛 Se a IA mandou [AUDIO: ...] JUNTO com texto (frequente em conversa
        // leve), envia a voz E depois o texto — só retorna cedo se for áudio
        // exclusivo ([AUDIO_SO] / somenteAudio) ou não houver texto.
        if (enviouAlgum) {
          if (res?.somenteAudio || !textoSemMarcador) return;
          // 🐛 FIX duplicado: a IA costuma marcar [AUDIO: fala] e escrever o
          // MESMO conteúdo no texto — o usuário recebe áudio + texto iguais.
          // Se o texto repete o que já foi falado, pula o texto (só manda o
          // texto quando o conteúdo é DIFERENTE, tipo explicação).
          if (ehRepeticaoAudioTexto(falas, textoSemMarcador)) return;
        }
      } catch (e) { /* cai pro texto */ }
    }
  }

  if (textoSemMarcador) {
    const opts = msgOrig?.key ? { quoted: msgOrig } : undefined;
    await corvo.sendMessage(jid, { text: textoSemMarcador.slice(0, 4000) }, opts);
  }
}

/**
 * Entry chamado pelo corvo.js para cada mensagem (fire-and-forget).
 * @param {object} upsert evento messages.upsert
 * @param {object} corvo  socket Baileys
 * @param {string} qrcode pasta da sessão
 */
async function processar(upsert, corvo, qrcode) {
  try {
    // 🔌 Liga os notificadores de fundo (lembretes + monitor de preços) na
    // primeira mensagem e retoma os pendentes de sessões anteriores.
    ligarNotificadores(corvo);

    const msgs = upsert?.messages || [];
    if (!msgs.length) return;
    const msg = msgs[0];
    if (msg?.key?.fromMe) return;
    if (upsert.type !== 'notify') return;

    const jid = msg?.key?.remoteJid;
    if (!jid || jid === 'status@broadcast') return;

    // 🔇 IA DESLIGADA GLOBAL (/iaoff do dono): fica MUDO em TUDO — grupos e
    // PV, nem o ADM consegue usar. Só volta com /iaon. O switch é o arquivo
    // corvo_dados/data/ia_switch.json criado pelos comandos /iaon e /iaoff do corvo.
    // Sem arquivo (ou ligada: true) = IA ativa (comportamento padrão).
    try {
      const sw = JSON.parse(fs.readFileSync('./corvo_dados/data/ia_switch.json', 'utf8'));
      if (sw && sw.ligada === false) return;
    } catch (e) { /* sem arquivo/corrompido = IA ligada */ }

    if (processando.has(jid)) return; // 🔒 já processando este chat
    processando.set(jid, true);

    // ⌨️ Função de parada do "digitando..." (limpa o heartbeat + manda paused).
    // Fica no escopo do processar pra ser usada no sucesso, no finally e no erro.
    let pararComposing = null;
    // ⏱️ Watchdog anti-trava: pIA = missão de fundo em andamento; watchdogDisparou
    // = sinal pro finally segurar o lock do chat enquanto a missão de fundo termina.
    let pIA = null;
    let watchdogDisparou = false;

    try {
      // 🟩 FIGURINHAS: coleta DESLIGADA (regra do dono — o pool já tem
      // quantidade boa). Figurinha enviada no chat NÃO é mais baixada nem
      // salva em disco; o pool atual continua intacto pra IA mandar quando
      // marcar [STICKER: ...]. O early-return é mantido pra figurinha não
      // disparar resposta (mesmo comportamento de antes).
      const figurinhas = msgs.filter(
        (m) => !m?.key?.fromMe && m?.message?.stickerMessage
      );
      if (figurinhas.length) {
        return;
      }

      const ctx = criarCtx({ corvo, upsert, config });
      const ehAudio = !!msg.message?.audioMessage;
      const prefix = config.prefix || '/';

      // 🧠 Registra o núcleo com o contexto desta mensagem — a IA DOMINA o corvo:
      // comandos (commandExecutor), VIP/ban/broadcast/stats (arquivos do corvo).
      const sender = msg.key?.participant || jid;
      core.setCore({
        corvo,
        from: jid,
        sender,
        pushname: msg.pushName || 'Usuário',
        info: msg,
        prefix,
        logEvent: () => {},
      });

      // 🧠 Memória do chat (conversa + quem é quem): grava TODAS as mensagens
      // (mesmo quando a IA não responde) — é assim que ela sabe a conversa do
      // grupo pra não ficar perdida, e registra os membros que falam.
      // 🚫 Comandos do bot (/menu, /ping...) ficam de fora: poluiriam o contexto
      // de conversa com spam de comando (a IA pensaria que o povo "fala" em
      // comandos). Só mensagem normal vira memória de conversa.
      try {
        const txtMem = extrairTexto(msg);
        // 🧹 Só mensagem com TEXTO e que NÃO é comando do bot vira memória
        // (imagem sem legenda/áudio = texto vazio, não polui a conversa).
        if (txtMem && !String(txtMem).trim().startsWith(prefix)) {
          memoria.rememberMessage(jid, {
            message_id: msg.key?.id,
            from: { first_name: ctx.from.first_name, id: ctx.from.id },
            text: txtMem,
          });
        }
      } catch (e) {}

      if (!(await deveResponder(upsert, msg, ctx, prefix))) return;

      // 👑 RESTRIÇÃO (dono no grupo): em grupos, a IA só responde onde o
      // DONO está presente. Se o dono não for membro (saiu/expulso), fica
      // muda. DM (privado) NÃO é afetado. Cache de 10min evita martelar API.
      if (ctx._ehGrupo && !(await isOwnerInGroup(ctx))) return;

      // ⌨️ PRESENÇA "digitando...": aparece no TOPO do chat (PV e grupo) e,
      // em grupo, também EMBAAIXO no nome do bot na lista de membros (o
      // WhatsApp mostra os dois sozinho quando enviamos composing no grupo).
      // ⏱ Heartbeat: o WhatsApp esconde o indicador após ~30s sem renovar, e a
      // IA pode demorar 1-2 min (Gemini + ferramentas) — reenvia composing a
      // cada 10s enquanto processa. pararComposing() limpa o timer e manda
      // "paused"; é chamada no envio, no early-return e no erro.
      pararComposing = iniciarComposing(corvo, jid);
      const inicio = Date.now();

      // 🎧 Áudio recebido → transcreve pra IA entender
      let prompt = extrairTexto(msg);
      if (ehAudio) {
        const transcrito = await transcreverAudioRecebido(corvo, msg);
        prompt = transcrito
          ? `O usuário mandou um áudio de voz falando: "${transcrito}". Responda naturalmente ao que ele disse.`
          : 'O usuário mandou um áudio, mas você não entendeu o que ele falou. Peça com naturalidade para repetir em texto ou outro áudio.';
      }
      if (!prompt.trim()) return;

      // 🧠 Se o trigger foi "ia"/"/ia", tira o prefixo do prompt
      const pEsc = String(prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      prompt = prompt.replace(new RegExp(`^(?:${pEsc})?ia(\\s+|:|$)`, 'i'), '').trim() || prompt;

      // 🧠 Se chamou a IA pelo nome ("yakamy oi tudo bem?" / "oi yakamy tudo bem?"),
      // tira o nome do prompt pra IA não responder repetindo "yakamy" — em
      // QUALQUER posição da frase, não só no início.
      if (RE_NOME_IA.test(prompt)) {
        prompt = prompt
          .replace(RE_NOME_IA_G, ' ')
          .replace(/\s{2,}/g, ' ')
          // 🧹 Limpa pontuação órfã deixada pela remoção do nome
          // ("yakamy, oi" → "oi"; "oq é yakamy?" → "oq é") — só roda quando
          // o nome estava na mensagem (não mexe em prompt sem o nome).
          .replace(/^[\s\p{P}]+|[\s\p{P}]+$/g, '')
          .trim() || prompt;
      }

      // 💬 Se respondeu a mensagem do bot, usa como contexto
      // 🔎 LID: compara com número real OU resolve via groupMetadata (ehOBot)
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
      let citouOBot =
        !!contextInfo.quotedMessage &&
        numeroDeJid(contextInfo.participant || '') === numeroDeJid(corvo.user?.id);
      if (!citouOBot && !!contextInfo.quotedMessage) {
        try { citouOBot = await ctx.ehOBot(contextInfo.participant); } catch (e) {}
      }
      if (citouOBot) {
        const qt = contextInfo.quotedMessage.conversation ||
          contextInfo.quotedMessage.extendedTextMessage?.text || '';
        if (qt && !ehAudio) prompt = `Contexto: "${qt.slice(0, 400)}" — ${prompt}`;
      }

      // 📎 ARQUIVO ENVIADO NO GRUPO/PV: se a mensagem tem documento/imagem/
      // vídeo/áudio, baixa e salva em data/anexos — o cérebro recebe info.anexo
      // e pode melhorar/editar/devolver com [ARQUIVO: caminho] (regra do
      // system.md: "melhorar arquivo enviado no grupo"). Só salva quando a IA
      // vai responder (já passou pelo deveResponder acima).
      let anexo = null;
      try {
        const mArq = msg.message || {};
        // 📄 Só arquivos QUE A IA PODE MELHORAR/EDITAR viram anexo: documento,
        // imagem e vídeo. 🚫 ÁUDIO/voz NÃO: o fluxo acima já trata a nota de voz
        // como FALA do usuário (transcreve pro prompt) — salvar como anexo faria
        // a IA achar que o usuário quer "melhorar" o áudio dela mesma.
        const temArquivo = !!(mArq.documentMessage || mArq.imageMessage || mArq.videoMessage);
        if (temArquivo) anexo = await salvarAnexoWhats(corvo, msg);
      } catch (e) { anexo = null; }

      // 🧠 CÉREBRO: mesma chamada do projeto principal, com contexto do corvo
      // ⏱️ WATCHDOG ANTI-TRAVA (regra do dono): se a IA não responder em 10 min
      // (API/ferramenta travada mesmo com os timeouts internos), para de digitar
      // e avisa — NUNCA mais fica o "digitando..." sem fim e sem resposta.
      // 🐛 unref: o timer do watchdog NÃO segura o processo vivo. catch de fundo:
      // se o watchdog ganhar e a missão de fundo rejeitar depois, nada de
      // unhandled rejection.
      const WATCHDOG_IA_MS = 10 * 60 * 1000;
      pIA = processAgent(ctx, prompt, [], {
        onStream: () => {},
        onTool: () => {},
        corvoCtx: { corvo, from: jid, sender, pushname: msg.pushName || 'Usuário', info: msg, prefix },
        anexo,
      });
      pIA.catch(() => {}); // 🛡️ sem unhandled rejection se o watchdog ganhar
      const res = await Promise.race([
        pIA,
        new Promise((_, rej) => {
          const t = setTimeout(() => rej(new Error('WATCHDOG_IA_TIMEOUT')), WATCHDOG_IA_MS);
          if (t.unref) t.unref();
        }),
      ]);

      // ⏳ SIMULA DIGITAÇÃO HUMANA: quanto maior a resposta, mais tempo ela
      // fica "digitando" (o tempo que a IA já gastou pensando conta como
      // leitura/raciocínio — só espera o que falta). Base ~1.2s + 35ms/char,
      // mínimo 1.8s, máximo 9s, pra resposta não sair instantânea.
      // Só-reação (sem texto nem áudio) não precisa de delay.
      const temConteudo = !!(res?.text?.trim() || (Array.isArray(res?.audios) && res.audios.length));
      try {
        if (temConteudo) {
          const tam = String(res?.text || '').trim().length;
          const alvo = Math.min(9000, Math.max(1800, 1200 + tam * 35));
          const espera = Math.max(0, alvo - (Date.now() - inicio));
          if (espera > 0) await sleep(espera);
        }
      } catch (e) {}
      // ✋ Para de digitar (a resposta vai sair agora)
      if (pararComposing) { await pararComposing().catch(() => {}); pararComposing = null; }

      // 📤 Envio (arquivos, voz ou texto + reação)
      await enviarResposta(corvo, jid, res, msg);

      const log = `[𝒀𝑨𝑲𝑨𝑴𝒀-IA] ${new Date().toLocaleTimeString('pt-BR')} ${ctx._ehGrupo ? 'grupo' : 'DM'} ${jid} → ${String(res?.text || '').slice(0, 60)}`;
      console.log(log);
    } finally {
      if (watchdogDisparou && pIA && typeof pIA.finally === 'function') {
        // ⏱️ Watchdog ganhou: a missão de fundo AINDA roda — segura o lock do
        // chat até ela terminar (senão um 2º agente entraria no mesmo chat e
        // poderia responder 2x). Libera quando a promessa de fundo assentar.
        // 🛡️ TETO SECUNDÁRIO: se a missão de fundo NUNCA terminar (subprocesso
        // travado além dos timeouts internos), libera o lock em +5min mesmo
        // assim — o chat nunca fica bloqueado pra sempre.
        const LIBERA_LOCK_MS = 5 * 60 * 1000;
        const liberaLock = () => processando.delete(jid);
        const teto = new Promise((r) => {
          const t = setTimeout(r, LIBERA_LOCK_MS);
          if (t.unref) t.unref();
        });
        Promise.race([pIA.catch(() => {}), teto]).then(liberaLock).catch(liberaLock);
      } else {
        processando.delete(jid);
      }
      // ⌨️ Garante que o "digitando..." sempre para (cobre early-returns e erros internos)
      if (pararComposing) { await pararComposing().catch(() => {}); pararComposing = null; }
    }
  } catch (e) {
    const msgErro = String(e?.message || '');
    // ⏱️ WATCHDOG disparou: avisa que demorou demais (em vez de "erro genérico")
    // e o finally já para o "digitando...".
    if (msgErro.includes('WATCHDOG_IA_TIMEOUT')) {
      watchdogDisparou = true; // 🔒 o finally segura o lock até a missão de fundo acabar
      try {
        await corvo.sendMessage(jid, { text: '⏳ Puts, demorei demais pra responder isso e travei no meio do caminho 😅 me chama de novo que eu termino.' });
      } catch (e2) {}
      return;
    }
    // 🧹 SEMPRE sanitiza o erro antes de mostrar (nunca vaza URL da API, nome
    // do modelo, provedor Google/Gemini, chave). Quota/429 vira aviso amigável
    // — o dono precisa saber que estourou a cota em vez de resposta muda.
    const ehQuota = /429|quota|RESOURCE_EXHAUSTED|rate\s*limit/i.test(msgErro);
    let msgLimpa = 'o serviço de IA está temporariamente indisponível.';
    try { msgLimpa = sanitizarErroUsuario(msgErro); } catch (e3) { /* sanitize nunca derruba o aviso */ }
    // 🛡️ Segunda camada: mesmo que o sanitize deixe passar algo, a blindagem
    // final apaga qualquer URL/domínio da API que tenha sobrado.
    msgLimpa = blindarTexto(msgLimpa);
    try {
      const jid = upsert?.messages?.[0]?.key?.remoteJid;
      if (jid) {
        // ✋ Para de digitar também no erro (senão o indicador fica preso)
        if (pararComposing) { try { await pararComposing(); } catch (e2) {} pararComposing = null; }
        await corvo.sendMessage(jid, {
          text: ehQuota
            ? '❌ Erro na IA: estourei a cota de uso por agora. Espera uns minutos e me chama de novo — ou fala com o dono pra renovar. 😏'
            : `❌ Erro na IA: ${msgLimpa.slice(0, 150)}`,
        });
      }
    } catch (e2) {}
    // 🐛 FIX 2026-08-10: log COMPLETO do erro no console (o corte de 200 chars
    // escondia o atributo que faltava — ex: "Function call is missing a
    // `thought_signature`"). O WhatsApp continua com mensagem curta/sanitizada.
    console.log('[𝒀𝑨𝑲𝑨𝑴𝒀-IA] erro completo:', msgErro);
  }
}

module.exports = { processar, ehRepeticaoAudioTexto };
