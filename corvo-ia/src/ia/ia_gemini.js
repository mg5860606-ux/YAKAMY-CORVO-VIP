/**
 * 🤖 𝒀𝑨𝑲𝑨𝑴𝒀 - MÓDULO IA (Gemini)
 * Usado pelo /ia e /apistatus
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const config = require('../../config');

// 🐛 FIX 2026-08-10 (teste AO VIVO com as 6 chaves): o modelo que o bot usava
// ('gemini-flash-latest') está com a cota diária ESGOTADA (429) em TODAS as
// chaves — por isso a IA ficou muda/"digitando sem fim". Os modelos abaixo
// têm cota SEPARADA e foram TESTADOS AGORA (10/08/2026):
//   ✅ TODAS as chaves: flash-lite-latest, 3.1-flash-lite, 3.5-flash,
//                       3.1-flash-lite-preview, gemma-4-31b-it, gemma-4-26b
//   ✅ Algumas chaves: 2.5-flash (1,2,5), 2.5-flash-lite (2,5), 3-flash (1,5)
//   ❌ 429 hoje (existem mas cota esgotada): 2.5-pro, 2.0-flash, pro-latest,
//                       3-pro, 3.1-pro, omni — NÃO entram (queimariam rotação)
const MODEL = 'gemini-flash-latest';
const MODEL_FORTE = 'gemini-flash-latest';

// 🎭 ROTAÇÃO DE MODELOS (regra do dono): cada modelo tem cota diária SEPARADA
// no Google — mesmo com as MESMAS chaves (mesmo projeto), se o
// gemini-flash-latest estourar o 429, os modelos abaixo ainda respondem com
// cota própria (confirmado por teste ao vivo em 10/08/2026). Ordem: quem
// funciona em TODAS as chaves vem primeiro (mais chance de achar cota logo),
// depois os parciais. Só ativa o cooldown global quando TODOS esgotarem.
const MODELOS_ROTACAO = [
  'gemini-flash-latest',        // 🥇 primário (hoje 429 em todas — cota esgotada)
  'gemini-flash-lite-latest',   // 🥈 ✅ TODAS as chaves
  'gemini-3.1-flash-lite',      // 🥉 ✅ TODAS as chaves (estável)
  'gemini-3.5-flash',           // 4ª ✅ TODAS as chaves
  'gemini-3.1-flash-lite-preview', // 5ª ✅ TODAS as chaves
  'gemma-4-31b-it',             // 6ª ✅ TODAS as chaves
  'gemma-4-26b-a4b-it',         // 7ª ✅ TODAS as chaves
  'gemini-2.5-flash',           // 8ª ✅ chaves 1,2,5
  'gemini-2.5-flash-lite',      // 9ª ✅ chaves 2,5
  'gemini-3-flash-preview',     // 10ª ✅ chaves 1,5
];

// 🎭 Índice do modelo em uso (in-memory). Fica "grudado" no último modelo que
// funcionou pra NÃO queimar o primário a cada mensagem quando ele já estourou.
let indiceModelo = 0;

// 🎯 VOLTA PRO PRIMÁRIO SOZINHO (regra do dono): quando o bot cai num modelo
// fallback (primário com cota esgotada), ele tenta VOLTAR pro modelo principal
// depois de 30min — quando a cota diária do primário resetar (ex.: meia-noite),
// o bot recupera o modelo principal SEM precisar reiniciar. Custa só uma rodada
// de tentativas a cada 30min (no pior caso, 6 chamadas 429 rápidas).
const REINTENTAR_PRIMARIO_MS = 30 * 60 * 1000;
let ultimoFallbackEm = 0; // ms desde que caiu no fallback (0 = está no primário)
let ultimoModeloLogado = ''; // qual fallback já anunciou no console (1x por sessão)
let modeloManual = false; // 🔒 dono fixou o modelo via /modelo → pausa o auto-retorno

/** Lista completa de modelos da rotação. */
function getModelosRotacao() {
  return MODELOS_ROTACAO;
}

/** Modelo ATUAL da rotação (o que comRotacao está tentando agora). */
function getModeloAtual() {
  return MODELOS_ROTACAO[Math.min(indiceModelo, MODELOS_ROTACAO.length - 1)];
}

/** Volta pro modelo primário (dono pode chamar pra tentar o principal de novo). */
function resetarModelos() {
  indiceModelo = 0;
  ultimoFallbackEm = 0;
  ultimoModeloLogado = '';
  modeloManual = false; // 🔓 desbloqueia: auto-retorno ao primário volta a valer
}

/** 🔒 True quando o DONO fixou um modelo via /modelo (auto-retorno pausado). */
function getModeloManual() {
  return modeloManual;
}

/**
 * Define o modelo ATUAL da rotação pelo índice (1 = primário). Usado pelo
 * comando /modelo do dono pra trocar o modelo na hora, sem reiniciar o bot.
 * @param {number} indice - posição na lista (1..MODELOS_ROTACAO.length)
 * @returns {string|null} nome do modelo escolhido, ou null se inválido
 */
function setModelo(indice) {
  const n = Number(indice);
  if (!Number.isInteger(n) || n < 1 || n > MODELOS_ROTACAO.length) return null;
  indiceModelo = n - 1;
  // 🔒 Troca MANUAL do dono: fixa o modelo (desliga o reintento automático do
  // primário de 30min) e reseta o log pra anunciar o modelo de novo.
  modeloManual = true;
  ultimoFallbackEm = 0;
  ultimoModeloLogado = '';
  return getModeloAtual();
}

// ⏱️ TIMEOUT ANTI-TRAVA (regra do dono): chamada à API com teto de tempo. Se a
// rede travar / o Gemini não responder, a chamada falha com erro em vez de
// prender o bot no "digitando..." para sempre (bug reportado pelo dono).
const TIMEOUT_API_MS = 120000; // 2 min por chamada

function comTimeout(promise, ms, nome) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`IA demorou demais aguardando ${nome} (${Math.round(ms / 1000)}s).`)), ms)),
  ]);
}

// 📎 Extrai o caminho de um arquivo criado/baixado/gerado pelo resultado de uma
// ferramenta (string "Arquivo criado: C:\..." ou objeto { arquivo/caminho } ).
function extrairCaminhoGerado(name, out, toolCtx) {
  try {
    if (!out) return null;
    let caminho = null;
    // 🛡️ Gate por nome de ferramenta: só ferramentas que CRIAM/BAIXAM/GERAM
    // arquivo de verdade têm o caminho no retorno. Ferramentas de leitura/lista
    // (listar_pasta, ler_arquivo) só MENCIONAM caminhos — sem esse gate, elas
    // poderiam auto-enviar arquivo que nunca foi criado.
    const ehCriadora = /^(criar_|copiar_|baixar_|zipar_|descompactar_|gerar_|editar_|captura|salvar|extrair)/i.test(String(name));
    if (typeof out === 'string') {
      const m = out.match(/(?:criado|atualizado|salvo|baixado|extraído|gerado|ZIP)[^:]*:\s*([^\n\r]+)/i);
      if (m && m[1]) caminho = m[1].trim();
      // 🛡️ Fallback por drive-letter (o retorno dessas ferramentas tem o caminho)
      if (!caminho && ehCriadora) {
        const mp = out.match(/[A-Za-z]:\\[^\n\r"']+/);
        if (mp) caminho = mp[0].trim();
      }
    } else if (out && typeof out === 'object') {
      // 🛡️ Mesmo gate: só as ferramentas criadoras/baixadoras auto-entregam.
      if (ehCriadora) {
        caminho = out.arquivo || out.caminho || out.arquivoFinal || null;
        if (caminho && typeof caminho !== 'string') caminho = null;
      }
    }
    // 🛡️ Restrição de zonas SÓ para NÃO-donos: membros só recebem arquivos
    // das zonas liberadas (data/downloads, data/anexos, data/github). O DONO
    // cria/baixa em QUALQUER lugar do PC (regra do dono) — bloquear a auto-
    // entrega pra ele fazia o arquivo criado nunca chegar no WhatsApp.
    if (caminho && !toolCtx?.isDono && !/data[\/\\](?:downloads|anexos|github)/i.test(caminho)) caminho = null;
    return caminho && fs.existsSync(caminho) ? caminho : null;
  } catch (e) { return null; }
}

/**
 * Escolhe o modelo conforme a dificuldade da tarefa:
 * - flash: conversa rápida, piadas, dúvidas simples
 * - pro: tarefas longas/complexas (mídia, código, missões com ferramentas)
 */
function escolherModelo(system, userText, opts = {}) {
  if (opts.model) return opts.model;
  const q = String(userText || '');
  // 💰 ECONOMIA (regra do dono): o pro é CARO — só vai para ele tarefa
  // REALMENTE pesada. Limiar de tamanho subiu de 350 → 500 (texto longo
  // sozinho não é tarefa pesada) e a lista de palavras foi enxugada:
  // palavras comuns da zoeira (faz, monte, analisa, resumo, tabela) ficam
  // no flash, que dá conta. Sinais fortes (código/site/script/instalar/
  // baixar/projetos) e ações pesadas do bot continuam indo pro pro.
  const complexo =
    q.length > 500 ||
    /(crie|criar|desenvolva|projete|site\b|código|codigo|script\b|instala|baixa|planilha|relat[óo]rio)/i.test(q) ||
    /(buscar_web|executar_terminal|baixar_|criar_arquivo|editar_arquivo)/i.test(q) ||
    // 🧠 Ações pesadas do bot (consultas, rajada, nukar, flood) merecem
    // raciocínio mais profundo: caem no pro com thinkingBudget maior.
    // Só sinais FORTES de ação (imperativos/verbos) para não pegar palavras
    // comuns da zoeira (ex: "vai dar flood", "marcar uma consulta").
    /(\braja\b|\brajad|rajar\b|\bnuka\b|\bnukar\b|flood[aeiou]|consultar\b|datora)/i.test(q);
  return complexo ? MODEL_FORTE : MODEL;
}

/**
 * Extrai APENAS o texto de resposta final de um response do Gemini,
 * ignorando os blocos de RACIOCÍNIO interno (parts com thought: true) que o
 * Gemini 2.5 produz ao pensar. O SDK 0.24.x não filtra isso sozinho — sem
 * este filtro, o raciocínio vazaria na resposta pro usuário.
 */
function extrairTexto(response) {
  try {
    const parts = response?.candidates?.[0]?.content?.parts || [];
    return parts.filter(p => !p.thought && p.text).map(p => p.text).join('');
  } catch (e) {
    return '';
  }
}

/**
 * Executa generateContent com STREAMING opcional (onStream recebe os trechos
 * conforme chegam, para o bot editar a mensagem em tempo real). Filtra os
 * trechos de raciocínio interno (thought) para não vazar no streaming.
 */
// 🐛 FIX 2026-08-10 (400 "Function call is missing a `name`/`thought_signature`"):
// Sanitização FINAL do histórico antes de QUALQUER envio — a última barreira.
// 1) Descarta functionCall/functionResponse SEM `name` válido (senão a API dá 400).
// 2) Modelo SEM ferramentas (relatório) recebe histórico SEM partes de função:
//    mandar functionCall/functionResponse sem tools declaradas também vira 400.
// 3) Corrige o `role` do content: o SDK antigo agrega o stream sem role, e a
//    API rejeita functionCall dentro de role 'user'.
function limparContentsParaEnvio(contents, temTools) {
  if (!Array.isArray(contents)) return contents;
  return contents
    .map((c) => {
      if (!c || !Array.isArray(c.parts)) return c;
      // 🎯 Role determinístico: se sobrou functionCall → content é do MODELO
      // (o SDK antigo agrega stream com role 'user' padrão — a causa do 400);
      // functionResponse → role 'user'. Sem parte de função, mantém o original.
      let role = c.role;
      let temCall = false;
      const parts = c.parts.filter((p) => {
        if (!p || typeof p !== 'object') return false;
        if (p.functionCall) {
          if (!(p.functionCall.name && String(p.functionCall.name).trim())) return false;
          if (!temTools) return false;
          temCall = true;
          return true;
        }
        if (p.functionResponse) {
          if (!(p.functionResponse.name && String(p.functionResponse.name).trim())) return false;
          if (!temTools) return false;
          return true;
        }
        return true;
      });
      if (temCall) role = 'model';
      else if (parts.some((p) => p && p.functionResponse)) role = 'user';
      if (!parts.length) return null;
      return { ...c, role, parts };
    })
    .filter((c) => c && c.parts && c.parts.length);
}

async function generateContentComStream(model, contents, onStream, temTools = true) {
  const contentsLimpos = limparContentsParaEnvio(contents, temTools);
  // 🛡️ DEFESA FINAL: se o filtro removeu TUDO (ex: só partes de função num
  // request sem tools), garante pelo menos um content de texto — `contents: []`
  // também geraria 400 na API.
  if (Array.isArray(contentsLimpos) && !contentsLimpos.length) {
    contentsLimpos.push({ role: 'user', parts: [{ text: 'Sem contexto adicional.' }] });
  }
  if (typeof onStream === 'function') {
    let textoAcumulado = '';
    // 🐛 FIX 2026-08-10 (400 "Function call is missing a thought_signature"):
    // o aggregateResponses do SDK 0.24.1 só copia text/functionCall/executableCode/
    // codeExecutionResult ao juntar o stream — descarta o campo thoughtSignature
    // (nível de PART, irmão do functionCall) que o Gemini 3 exige no turno do
    // modelo. Captura aqui as parts CRUAS com functionCall (preservam o campo)
    // pra re-injetá-las no histórico na próxima rodada.
    const partsBrutas = [];
    const stream = await model.generateContentStream({ contents: contentsLimpos });
    for await (const chunk of stream.stream) {
      try {
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        for (const p of parts) {
          if (p && p.functionCall && !partsBrutas.includes(p)) partsBrutas.push(p);
        }
        let t = '';
        t = parts.filter(p => !p.thought && p.text).map(p => p.text).join('');
        if (t) { textoAcumulado += t; try { onStream(t); } catch (e) {} }
      } catch (e) {}
    }
    const response = await stream.response;
    return { response, textoAcumulado, partsBrutas };
  }
  const result = await model.generateContent({ contents: contentsLimpos });
  return { response: result.response, partsBrutas: [] };
}

// ===== 🔑 ROTAÇÃO DE CHAVES GEMINI (regra do dono) =====
// Várias chaves em config.geminiKeys (ou env GEMINI_API_KEY + GEMINI_API_KEY_2).
// SEMPRE usa a MESMA chave; só avança para a PRÓXIMA quando a atual esgotar
// (429/quota/exhausted) ou estiver inválida — sequência 1→2→3→…→N→1→2→…
// 💾 O índice em uso é SALVO em disco (data/gemini_chave_atual.json) e
// restaurado ao iniciar — reiniciar o bot NÃO volta pra chave 1.
const CHAVE_ATUAL_FILE = path.join(__dirname, '..', '..', 'data', 'gemini_chave_atual.json');

function carregarIndiceChave() {
  try {
    if (fs.existsSync(CHAVE_ATUAL_FILE)) {
      const j = JSON.parse(fs.readFileSync(CHAVE_ATUAL_FILE, 'utf-8'));
      const n = Number(j.indiceChave);
      if (Number.isInteger(n) && n >= 0) return n;
    }
  } catch (e) { /* arquivo corrompido/ausente → recomeça na 1 */ }
  return 0;
}

function salvarIndiceChave() {
  try {
    fs.mkdirSync(path.dirname(CHAVE_ATUAL_FILE), { recursive: true });
    fs.writeFileSync(CHAVE_ATUAL_FILE, JSON.stringify({ indiceChave, atualizadoEm: new Date().toISOString() }, null, 2));
  } catch (e) { /* falha ao salvar não quebra a rotação */ }
}

let indiceChave = carregarIndiceChave();
let genAI = null;

// ===== 🔴 EXCLUSÃO PERMANENTE DE CHAVES (regra do dono) =====
// Chave que dá erro PERMANENTE (404 modelo não disponível / 401 / 403 chave
// inválida ou revogada) é EXCLUÍDA da rotação e persistida em disco — nunca
// mais é usada, mesmo reiniciando o bot. Erro TEMPORÁRIO (429 quota/rate)
// só rotaciona, NÃO exclui (a cota volta).
const CHAVES_EXCLUIDAS_FILE = path.join(__dirname, '..', '..', 'data', 'gemini_chaves_excluidas.json');

function carregarChavesExcluidas() {
  try {
    if (fs.existsSync(CHAVES_EXCLUIDAS_FILE)) {
      const j = JSON.parse(fs.readFileSync(CHAVES_EXCLUIDAS_FILE, 'utf-8'));
      // 🔤 trim() nas excluídas: o getGeminiKeys() compara com chaves já
      // trimadas — entrada com espaço sobrando não filtraria a chave certa.
      if (Array.isArray(j.chaves)) return j.chaves.map(k => String(k).trim()).filter(k => k);
    }
  } catch (e) { /* arquivo corrompido/ausente → começa vazio */ }
  return [];
}

function salvarChavesExcluidas() {
  try {
    fs.mkdirSync(path.dirname(CHAVES_EXCLUIDAS_FILE), { recursive: true });
    fs.writeFileSync(CHAVES_EXCLUIDAS_FILE, JSON.stringify({ chaves: chavesExcluidas, atualizadoEm: new Date().toISOString() }, null, 2));
  } catch (e) { /* falha ao salvar não quebra a rotação */ }
}

let chavesExcluidas = carregarChavesExcluidas();

// ===== ⏳ COOLDOWN GLOBAL DE QUOTA (regra do dono) =====
// Quando TODAS as chaves estouram a cota (429), o bot PARA de martelar a API
// por alguns minutos (persistido em disco): responde rápido com aviso amigável
// e retoma sozinho quando o cooldown passa. Evita o "digitando sem fim" e não
// queima chamadas à toa. (As chaves atuais são do MESMO projeto Google — cota
// compartilhada — então rotacionar não multiplica limite; o cooldown segura o
// impacto até a cota resetar.)
const QUOTA_COOLDOWN_MS = 5 * 60 * 1000; // 5 min
const QUOTA_COOLDOWN_FILE = path.join(__dirname, '..', '..', 'data', 'gemini_quota_cooldown.json');

function carregarCooldownQuota() {
  try {
    if (fs.existsSync(QUOTA_COOLDOWN_FILE)) {
      const j = JSON.parse(fs.readFileSync(QUOTA_COOLDOWN_FILE, 'utf-8'));
      const ate = Number(j.ate);
      if (Number.isFinite(ate) && ate > 0) return ate;
    }
  } catch (e) { /* arquivo corrompido/ausente → sem cooldown */ }
  return 0;
}

let quotaCooldownAte = carregarCooldownQuota();

function salvarCooldownQuota() {
  try {
    fs.mkdirSync(path.dirname(QUOTA_COOLDOWN_FILE), { recursive: true });
    fs.writeFileSync(QUOTA_COOLDOWN_FILE, JSON.stringify({ ate: quotaCooldownAte, atualizadoEm: new Date().toISOString() }, null, 2));
  } catch (e) { /* falha ao salvar não quebra a rotação */ }
}

function ativarCooldownQuota() {
  quotaCooldownAte = Date.now() + QUOTA_COOLDOWN_MS;
  salvarCooldownQuota();
  try {
    console.log(`[IA] ⏳ Cota estourada em TODAS as chaves E TODOS os modelos — IA em pausa por ${Math.round(QUOTA_COOLDOWN_MS / 60000)}min (retoma automático).`);
  } catch (e) { /* log não bloqueia */ }
}

/** Milissegundos restantes de cooldown de quota (0 = sem cooldown). */
function cooldownQuotaRestante() {
  const r = quotaCooldownAte - Date.now();
  return r > 0 ? r : 0;
}

/** Remove o cooldown manualmente (dono pode destravar antes dos 5min). */
function resetarCooldownQuota() {
  quotaCooldownAte = 0;
  try { fs.unlinkSync(QUOTA_COOLDOWN_FILE); } catch (e) {}
}

/** Erro PERMANENTE (404/401/403/modelo indisponível) — NÃO é 429 quota. */
function ehErroPermanente(e) {
  const msg = `${e?.status || ''} ${e?.message || e || ''}`;
  // 429/quota/rate limit é TEMPORÁRIO — não exclui a chave (a cota volta).
  if (/429|quota|RESOURCE_EXHAUSTED|rate\s*limit/i.test(msg)) return false;
  return /401|403|404|invalid\s*api\s*key|api\s*key\s*not\s*valid|permission\s*denied|no\s*longer\s*available|not\s*found/i.test(msg);
}

function excluirChave(chave) {
  if (!chave) return;
  if (chavesExcluidas.includes(chave)) return;
  chavesExcluidas.push(chave);
  salvarChavesExcluidas();
  // 🖥️ Visibilidade pro dono (console do bot): mostra qual chave foi queimada.
  try {
    console.log(`[IA] 🔴 Chave ${String(chave).slice(0, 8)}... EXCLUÍDA da rotação (erro permanente). Restam ${getGeminiKeys().length} chave(s).`);
  } catch (e) { /* log não bloqueia */ }
  // NOTA: não há auto-reset — chave excluída fica de vez (regra do dono).
  // Recuperação manual: resetarChavesExcluidas() ou apagar o arquivo
  // data/gemini_chaves_excluidas.json.
}

/** Lista as chaves excluídas (para diagnóstico / re-adicionar manualmente). */
function getChavesExcluidas() {
  return [...chavesExcluidas];
}

/** Remove TODAS as exclusões (re-adiciona todas as chaves do config). */
function resetarChavesExcluidas() {
  chavesExcluidas = [];
  salvarChavesExcluidas();
}

function getGeminiKeys() {
  // Regra do dono: se config.geminiKeys estiver definido, usa ELAS (rotação + persistência).
  // O env GEMINI_API_KEY (e GEMINI_API_KEY_2 em diante) vira FALLBACK só quando o config não tiver lista.
  const envKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(k => k && String(k).trim());
  const ks = (Array.isArray(config.geminiKeys) && config.geminiKeys.length)
    ? config.geminiKeys
    : (envKeys.length ? envKeys
        : (config.geminiKey ? [config.geminiKey] : []));
  // 🔴 Filtra as chaves EXCLUÍDAS: chave com erro permanente nunca mais entra
  return (ks || [])
    .map(k => String(k).trim())
    .filter((k, i, arr) => k && arr.indexOf(k) === i && !chavesExcluidas.includes(k));
}

/**
 * Retorna a chave ATUAL da rotação (de env ou config fixa)
 */
function getGeminiKey() {
  const ks = getGeminiKeys();
  if (!ks.length) return '';
  if (indiceChave >= ks.length) {
    indiceChave = 0;
    salvarIndiceChave(); // índice persistido fora do range: corrige E persiste
  }
  return ks[indiceChave];
}

function criarGenAI() {
  genAI = new GoogleGenerativeAI(getGeminiKey());
  return genAI;
}

// 🎡 Avança para a PRÓXIMA chave (sequencial 1→2→…→N→1). Só é chamada quando
// a chave ATUAL esgotou (quota) — o resto do tempo fica na mesma chave.
function rotacionarChave() {
  const ks = getGeminiKeys();
  if (ks.length <= 1) return;
  indiceChave = (indiceChave + 1) % ks.length;
  salvarIndiceChave(); // 💾 sobrevive a reinício do bot
}

function ehErroQuota(e) {
  const msg = `${e?.status || ''} ${e?.message || e || ''}`;
  // Quota (429/exhausted/rate limit), chave inválida/revogada (401/403) OU
  // chave sem acesso ao modelo (404 "no longer available to new users" —
  // tokens novos não enxergam gemini-2.5-flash): nos 3 casos a chave atual
  // não serve → deve rotacionar pra próxima.
  return /429|quota|RESOURCE_EXHAUSTED|rate\s*limit|exhausted|401|403|404|invalid\s*api\s*key|api\s*key\s*not\s*valid|permission\s*denied|no\s*longer\s*available|not\s*found/i.test(msg);
}

/**
 * 🚫 SANITIZA ERRO PRO USUÁRIO — regra do dono: NENHUM erro que vaza pro
 * grupo/DM pode revelar a infraestrutura por trás (Google/Gemini/flash,
 * URLs da API, chaves). Troca por termos genéricos e apaga detalhes.
 * Usado nos handlers de /ia e triggers de texto (ia.js, textos.js).
 */
function sanitizarErroUsuario(msg) {
  let s = String(msg || '')
    // URLs da API (generativelanguage.googleapis.com, etc.)
    .replace(/https?:\/\/[^\s]+/gi, '(serviço de IA)')
    .replace(/generativelanguage[a-z.\-]*/gi, 'serviço de IA')
    // Frases COMPLETAS do provedor (antes de trocar nomes, pra não deixar resto)
    .replace(/this model models?\/[a-z0-9.\-]* is no longer available[^.\n]*\.?/gi, '')
    .replace(/no longer available to new users[^.\n]*\.?/gi, '')
    .replace(/please update your code to use a newer model[^.\n]*\.?/gi, '')
    // Nome do provedor e do modelo (gemini, gemini-2.5-flash, gemini-2.5-pro,
    // veo, veo-3.1-..., nano banana) — tudo vira a MARCA do bot (𝒀𝑨𝑲𝑨𝑴𝒀 Generated)
    // pra não entregar a API real nem nos erros de geração de imagem/vídeo.
    .replace(/gemini[a-z0-9.\-]*/gi, '𝒀𝑨𝑲𝑨𝑴𝒀 Generated')
    .replace(/nano\s*banana[a-z0-9.\-]*/gi, '𝒀𝑨𝑲𝑨𝑴𝒀 Generated')
    .replace(/\bveo[a-z0-9.\-]*/gi, '𝒀𝑨𝑲𝑨𝑴𝒀 Generated')
    // 🧠 DeepSeek / deepsproxy / Playwright (novo provider de texto): também vira
    // a MARCA do bot — nunca vaza o nome do provedor real pro usuário
    .replace(/deepseek[a-z0-9.\-]*/gi, '𝒀𝑨𝑲𝑨𝑴𝒀 Generated')
    .replace(/deepsproxy[a-z0-9.\-]*/gi, '𝒀𝑨𝑲𝑨𝑴𝒀 Generated')
    .replace(/playwright[a-z0-9.\-]*/gi, 'fornecedor')
    .replace(/localhost:\d+/gi, 'serviço de IA')
    .replace(/google[a-z.\-]*/gi, 'fornecedor')
    .replace(/models?\/[a-z0-9.\-]*/gi, 'modelo')
    // Fragmentos sobrando ("This model modelo", "The model models/...")
    .replace(/(this|the|a) model modelo/gi, '')
    // Chaves de API expostas
    .replace(/\bAIza[0-9A-Za-z_\-]{30,}\b/g, '[chave]')
    .replace(/\bAQ\.[0-9A-Za-z_\-./=]{10,}\b/g, '[chave]')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Se sobrou vazio (mensagem era só a frase do provedor), cai num texto genérico
  if (!s) s = 'o serviço de IA está temporariamente indisponível.';
  return s;
}

/**
 * Executa fn() tentando cada chave da rotação quando a atual estoura quota.
 * Erro não-quota é repassado na hora (não queima chaves à toa).
 */
async function comRotacao(fn) {
  const ks = getGeminiKeys();
  if (!ks.length) throw new Error('Nenhuma chave de IA configurada.');

  // ⏳ Se a cota estourou em TODAS as chaves E TODOS os modelos recentemente,
  // responde RÁPIDO (fast-fail) em vez de martelar a API — retoma sozinho.
  const cooldownRestante = cooldownQuotaRestante();
  if (cooldownRestante > 0) {
    const e = new Error(`Cota da IA em pausa por mais ${Math.ceil(cooldownRestante / 60000)}min (429 quota).`);
    e.status = 429;
    throw e;
  }

  // 🎯 VOLTA PRO PRIMÁRIO PERIODICAMENTE: se está num fallback há 30min+,
  // recomeça do modelo principal — quando a cota dele resetar, o bot
  // recupera sozinho (senão ficaria no fallback até reiniciar o processo).
  // 🔒 Se o DONO fixou o modelo via /modelo (modeloManual), não volta sozinho.
  if (!modeloManual && indiceModelo > 0 && ultimoFallbackEm > 0 && Date.now() - ultimoFallbackEm > REINTENTAR_PRIMARIO_MS) {
    indiceModelo = 0;
    ultimoFallbackEm = 0;
  }

  // 🎭 ROTAÇÃO DE MODELOS: começa no modelo que funcionou por último (sticky)
  // e, se TODAS as chaves falharem nele, pula pro PRÓXIMO modelo da lista.
  // Cada modelo tem cota diária separada — trocar de modelo escapa do 429
  // mesmo com as mesmas chaves (todas do mesmo projeto).
  const modelos = getModelosRotacao();
  let ultimoErro = null;
  let viuQuota = false;

  for (let mi = indiceModelo; mi < modelos.length; mi++) {
    indiceModelo = mi;
    const ehPrimario = mi === 0;
    // 🎯 Cronometra a entrada no fallback (pra saber quando voltar ao primário)
    if (ehPrimario) ultimoFallbackEm = 0;
    else if (!ultimoFallbackEm) ultimoFallbackEm = Date.now();
    // 🔄 Re-snapshot das chaves A CADA modelo: se uma chave foi excluída no
    // modelo anterior (erro permanente no primário), o bound não fica stale.
    const chavesAgora = getGeminiKeys();
    for (let i = 0; i < chavesAgora.length; i++) {
      const chaveEmUso = getGeminiKey();
      try {
        const resultado = await fn();
        // 🖥️ Log de diagnóstico: anuncia UMA VEZ quando o fallback assume (e
        // quando troca de fallback). Evita spam de console a cada mensagem
        // com o primário em pausa o dia todo — o dono vê o resgate sem ruído.
        if (mi > 0 && ultimoModeloLogado !== modelos[mi]) {
          ultimoModeloLogado = modelos[mi];
          try { console.log(`[IA] ✅ Respondeu via ${modelos[mi]} (primário em pausa/limite).`); } catch (e) {}
        } else if (mi === 0) {
          ultimoModeloLogado = ''; // primário de volta → próximo fallback anuncia de novo
        }
        return resultado;
      } catch (e) {
        ultimoErro = e;
        if (!ehErroQuota(e)) throw e;
        // 🚨 429/quota REAL (não 401/403/404 permanente) → marca pra cooldown
        if (ehErroQuota(e) && !ehErroPermanente(e)) viuQuota = true;
        // 🔴 Erro PERMANENTE (404/401/403/modelo indisponível) no modelo
        // PRIMÁRIO: EXCLUI a chave (persistida em disco) — a chave não serve.
        // Em modelo de FALLBACK, 404/indisponível NÃO exclui a chave: o modelo
        // é que não existe pra ela, mas a chave continua boa no primário.
        if (ehPrimario && ehErroPermanente(e)) excluirChave(chaveEmUso);
        rotacionarChave();
        criarGenAI();
      }
    }
    // 🎭 Todas as chaves falharam NESTE modelo → volta pra 1ª chave e tenta o próximo
    indiceChave = 0;
    salvarIndiceChave();
    criarGenAI();
  }
  // 🎭 Loop de modelos esgotou SEM sucesso (quota OU erro permanente em todos):
  // volta pro PRIMÁRIO pra próxima chamada — não fica preso no último fallback
  // (se o 404/403 foi por modelo indisponível, o primário pode funcionar).
  indiceModelo = 0;
  ultimoFallbackEm = 0;
  ultimoModeloLogado = '';
  modeloManual = false; // 🔓 esgotou tudo → destrava o manual (volta ao normal)
  // 🚨 TODAS as chaves E TODOS os modelos falharam por quota → pausa global
  if (viuQuota) ativarCooldownQuota();
  throw ultimoErro;
}

/**
 * Chamada com system prompt + mídia opcional (usado pelo agente)
 * @param {string} system - system instruction (persona/contexto)
 * @param {string} prompt - pergunta
 * @param {Array} midia - [{dataBuffer, mimeType}] opcional
 */
async function askSystemGemini(system, prompt, midia = [], opts = {}) {
  if (!getGeminiKey()) throw new Error('Nenhuma chave de IA configurada.');

  const parts = [];
  for (const m of midia) {
    if (m && m.dataBuffer) {
      const b = Buffer.isBuffer(m.dataBuffer) ? m.dataBuffer : Buffer.from(m.dataBuffer);
      parts.push({ inlineData: { data: b.toString('base64'), mimeType: m.mimeType || 'image/jpeg' } });
    }
  }
  parts.push({ text: prompt });

  const result = await comTimeout(comRotacao(async () => {
    const g = new GoogleGenerativeAI(getGeminiKey());
    // 🎭 ROTAÇÃO DE MODELOS: usa o modelo ATUAL da rotação (troca sozinho no 429)
    const m = g.getGenerativeModel({ model: getModeloAtual() });
    const generationConfig = {};
    // 💰 MODO LEVE (economia): thinking reduzido a 128 — conversa casual não
    // precisa de raciocínio profundo (o padrão do flash gasta bem mais).
    if (opts.thinkingBudget) {
      generationConfig.thinkingConfig = { thinkingBudget: opts.thinkingBudget };
    }
    return m.generateContent({
      contents: [{ role: 'user', parts }],
      systemInstruction: system,
      ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
    });
  }), TIMEOUT_API_MS, 'resposta da IA');
  const response = result.response;
  // 📊 Conta o uso NA FONTE (cada chamada real à API), com os tokens reais
  recordUsage(response.usageMetadata?.totalTokens);
  return {
    text: extrairTexto(response) || 'Sem resposta.',
    tokens: response.usageMetadata?.totalTokens,
  };
}

/**
 * Chamada com system prompt + ferramentas (function calling) + loop autônomo.
 * O modelo pode chamar ferramentas (busca web, imagens, GitHub...), o sistema
 * executa e devolve o resultado, até responder em texto final.
 * @param {string} system - system instruction (persona/contexto)
 * @param {string} userText - pergunta
 * @param {object} opts - { midia: [{dataBuffer,mimeType}], tools: [declarations], toolExecutor: fn(name,args,toolCtx), toolCtx: any }
 */
async function askSystemGeminiTools(system, userText, opts = {}) {
  if (!getGeminiKey()) throw new Error('Nenhuma chave de IA configurada.');
  criarGenAI(); // usa a chave atual da rotação

  const { midia = [], tools = [], toolExecutor, toolCtx = {}, maxRounds: maxRoundsReq, endMarker = '[FIM]', onTool = null, onStream = null, toolsGetter = null, sinal = null, missaoLongaBonus = 40 } = opts;
  // 🔋 MISSÃO LONGA: a IA pode marcar [LONGA_MISSAO] no início de tarefas pesadas
  // (criar bot/site, instalar+testar, missões longas) para GANHAR rodadas extras
  // na hora — o limite sobe e a missão continua até o fim.
  // 🛡️ ECONOMIA DE API (regra do dono): padrão agora é 50 rodadas (antes 30 —
  // subiu porque tarefas de NAVEGAÇÃO longas — site → formulário → print →
  // download → entrega — gastam ~10-20 rodadas só no meio do caminho e
  // desistiam cedo). Cada rodada REENVIA o histórico inteiro, então quanto
  // menos, melhor; missões realmente pesadas pedem +40 explícito com
  // [LONGA_MISSAO]. NÃO existe mais auto-extensão silenciosa.
  let maxRounds = maxRoundsReq || 50;
  // 🛡️ Teto ABSOLUTO de rodadas (contra loop infinito): acima disso, retorna o que tiver
  const MAX_ROUNDS = 150;
  let missaoLongaAtivada = false;

  const modeloEscolhido = escolherModelo(system, userText, opts);

  function buildModel(nomeModelo) {
    // 🎭 ROTAÇÃO DE MODELOS: o modelo REAL usado é o atual da rotação
    // (getModeloAtual), NÃO o nomeModelo. O nomeModelo (MODEL/MODEL_FORTE)
    // só decide o orçamento de raciocínio abaixo — não "consertar" isso sem
    // saber: trocar pro nomeModelo quebraria o fallback de cota por modelo.
    const modelOpts = { model: getModeloAtual() };
    if (system) modelOpts.systemInstruction = system;
    // 🐛 FIX 2026-08-10: a API rejeita com 400 "Function call is missing a
    // `name` attribute" se algum functionDeclaration chegar SEM name válido.
    // Filtro defensivo: declaração sem name é descartada (não quebra a missão).
    const schemas = (typeof toolsGetter === 'function' ? toolsGetter() : tools || [])
      .filter(s => s && s.name && String(s.name).trim());
    if (schemas.length) modelOpts.tools = [{ functionDeclarations: schemas }];
    // 🧠 RACIOCÍNIO NATIVO ANTES DE AGIR: o Gemini 2.5 pensa antes de responder
    // ou chamar QUALQUER ferramenta. Orçamento maior no modelo forte (tarefas
    // complexas = mais raciocínio), menor no flash (conversa rápida).
    // Desligável com opts.thinking === false; ajustável via opts.thinkingBudget.
    if (opts.thinking !== false) {
      // 💰 ECONOMIA (regra do dono): thinking do pro reduzido de 8192 → 4096
      // (raciocínio interno é cobrado por token e o pro é caro). Flash mantém 1024.
      // 🐛 FIX: MODEL_FORTE == MODEL ('gemini-flash-latest') hoje — comparar por
      // nome ('pro' no nome) em vez de === MODEL_FORTE, senão TUDO usaria 4096.
      const budget = opts.thinkingBudget || (/pro/i.test(nomeModelo) ? 4096 : 1024);
      modelOpts.generationConfig = {
        thinkingConfig: { thinkingBudget: budget },
      };
    }
    return genAI.getGenerativeModel(modelOpts);
  }

  let model = buildModel(modeloEscolhido);
  let tentouFallback = false;

  const userParts = [];
  for (const m of midia) {
    if (m && m.dataBuffer) {
      const b = Buffer.isBuffer(m.dataBuffer) ? m.dataBuffer : Buffer.from(m.dataBuffer);
      userParts.push({ inlineData: { data: b.toString('base64'), mimeType: m.mimeType || 'image/jpeg' } });
    }
  }
  userParts.push({ text: String(userText || '') });

  const contents = [{ role: 'user', parts: userParts }];
  let text = '';
  let totalTokens = 0;
  // 📎 Arquivos que as FERRAMENTAS criaram/baixaram (caminhos reais em disco).
  // Se a IA esquecer o marcador [ARQUIVO: ...], o agente entrega mesmo assim.
  const arquivosGerados = [];
  let usedTools = false;
  // 🏁 Flag de CONCLUSÃO da missão: só vira true quando a IA responde com [FIM]
  // (missão terminou de verdade). Se as rodadas acabarem SEM ela, o agente NÃO
  // pode parar em silêncio — roda um relatório final obrigatório (ver abaixo).
  let concluida = false;
  let lastPushMsg = '';
  // 🌀 Detector de loop: conta quantas vezes cada ferramenta+args se repete
  const repeticoes = new Map();
  // 🌀 Contador por FERRAMENTA (qualquer argumento): mesma ferramenta 8x
  // SEGUIDAS (consecutivas, sem outra ferramenta no meio) = travada nela.
  // Usar a mesma ferramenta com QUANTIDADES variadas (ex: criar_arquivo 10x
  // pra montar um projeto) NÃO é loop — o contador zera ao trocar de ferramenta.
  const vezesPorFerramenta = new Map();
  let ultimaFerramenta = null;
  // 🚧 BLOQUEIO (regra do dono): se algo BARRAR a missão e a IA não conseguir
  // passar (mesma ferramenta falhando 2x SEGUIDAS, loop de 3x nos mesmos args
  // ou 8x na mesma ferramenta), ela deve AVISAR O USUÁRIO ANTES de terminar —
  // não pode ficar queimando rodadas às cegas nem esperar o fim pra falar.
  const falhasPorFerramenta = new Map(); // ferramenta -> falhas consecutivas
  let avisoBloqueioEnviado = false;

  for (let round = 0; round < maxRounds; round++) {
    // 🛑 Sinal de interrupção/reavaliação do usuário (missão em andamento)
    if (typeof sinal === 'function') {
      try {
        const sig = sinal();
        if (sig && sig.acao === 'parar') {
          text = `🛑 Missão interrompida a pedido do usuário.${sig.motivo ? `\nMotivo: ${sig.motivo}` : ''}\n\nSe precisar continuar depois, chame de novo que eu retomo de onde parei.`;
          return { text, tokens: totalTokens, arquivosGerados };
        }
        if (sig && sig.acao === 'reavaliar') {
          contents.push({
            role: 'user',
            parts: [{ text: `🔄 O usuário pediu para você PARAR e REAVALIAR sua abordagem. Motivo: ${sig.motivo || 'reanálise'}. Raciocine de novo: o plano atual está certo? Mude de estratégia se precisar. Depois continue as ferramentas e só termine com ${endMarker} quando estiver FEITO.` }],
          });
        }
      } catch (e) { /* ignora erro de sinal */ }
    }

    let result, textoAcumulado = '';
    try {
      // 🔑 ROTAÇÃO: tenta cada chave (zigue-zague) se a atual estourar quota
      const r = await comTimeout(comRotacao(async () => {
        model = buildModel(modeloEscolhido);
        return generateContentComStream(model, contents, onStream);
      }), TIMEOUT_API_MS, 'resposta da IA');
      result = r;
      textoAcumulado = r.textoAcumulado || '';
    } catch (e) {
      // ⚠️ FALLBACK: se o modelo forte falhar (429/quota/erro), tenta o flash
      if (!tentouFallback && modeloEscolhido !== MODEL) {
        tentouFallback = true;
        // 🔑 O fallback TAMBÉM passa pela rotação: se a chave atual não tiver
        // acesso ao flash (404 "no longer available"), pula pra próxima.
        const r2 = await comTimeout(comRotacao(async () => {
          model = buildModel(MODEL); // reconstrói com persona + tools preservados
          return generateContentComStream(model, contents, onStream);
        }), TIMEOUT_API_MS, 'resposta fallback');
        result = r2;
        textoAcumulado = r2.textoAcumulado || '';
      } else {
        throw e;
      }
    }
    totalTokens += result.response?.usageMetadata?.totalTokens || 0;
    // 📊 CONTADOR DE USO (regra do dono): registra CADA chamada real à API na
    // fonte, com os tokens reais da rodada — antes o contador só via o total da
    // última resposta e ficava zerado (890 req / 0 tokens).
    recordUsage(result.response?.usageMetadata?.totalTokens || 0);

    // 🔋 MISSÃO LONGA: se a IA marcou [LONGA_MISSAO] nesta resposta, ativa o
    // bônus de rodadas extras IMEDIATAMENTE (não espera acabar o limite).
    // Só ativa se a resposta NÃO já veio com [FIM] (missão concluída) — evita
    // bônus inútil e mensagem de confirmação à toa.
    const textoRodada = textoAcumulado || extrairTexto(result.response) || '';
    if (!missaoLongaAtivada && !textoRodada.includes(endMarker) && /\[LONGA_MISSAO\]/i.test(textoRodada)) {
      missaoLongaAtivada = true;
      maxRounds = Math.min(maxRounds + missaoLongaBonus, MAX_ROUNDS);
      contents.push({
        role: 'user',
        parts: [{ text: `🔋 MISSÃO LONGA ATIVADA: você marcou [LONGA_MISSAO] e ganhou +${missaoLongaBonus} rodadas extras (limite agora: ${maxRounds}). Continue a missão até o FIM, sem parar no meio. Finalize com ${endMarker} quando concluíres.` }],
      });
    }

    const content = result.response?.candidates?.[0]?.content;
    if (!content || !Array.isArray(content.parts)) {
      text = textoAcumulado || extrairTexto(result.response) || '';
      break;
    }

    // 🐛 FIX 2026-08-10: o Gemini às vezes devolve functionCall SEM `name`
    // (principalmente em streaming). Mandar esse histórico de volta gera o
    // erro 400 "Function call is missing a `name` attribute" e a missão morre.
    // Aqui: só processa calls com name válido e reconstroi o content SEM as
    // parts malformadas (senão o round seguinte reenvia a call quebrada).
    // 🐛 FIX dupla execução (quirk do SDK antigo): o aggregateResponses do
    // @google/generative-ai 0.24.1 empurra o MESMO objeto newPart para cada
    // part de um chunk — se um chunk veio com text + functionCall juntos, a
    // mesma call aparece 2x (mesma referência) e a ferramenta rodaria em dobro.
    // Dedup por referência do objeto functionCall resolve sem perder calls reais.
    const callsUnicos = [];
    const callVistos = new Set();
    for (const p of content.parts) {
      if (p.functionCall && p.functionCall.name && String(p.functionCall.name).trim()) {
        if (!callVistos.has(p.functionCall)) {
          callVistos.add(p.functionCall);
          callsUnicos.push(p);
        }
      }
    }
    const calls = callsUnicos;
    // 🖥️ Log de diagnóstico: se o Gemini devolver functionCall sem name, avisa
    // no console (o fix evita o 400, mas o caso fica visível pro dono). Fica
    // FORA do if abaixo para também pegar o caso em que TODAS as calls são
    // inválidas (senão degradaria silencioso para "Sem resposta.").
    if (content.parts.some(p => p.functionCall && !(p.functionCall.name && String(p.functionCall.name).trim()))) {
      console.log('[IA] ⚠️ functionCall sem name ignorado (400 evitado).');
    }
    if (calls.length) {
      usedTools = true;
      let flagSetNestaRodada = false; // 🚧 bloqueio detectado nesta rodada
      // 🐛 Mesmo dedup por referência no histórico: sem isso a call duplicada
      // iria no push do content e viraria 2 functionCalls iguais no request.
      // ⚠️ Usa um Set NOVO (callsSet), não o callVistos da 1ª passagem — senão
      // TODAS as calls válidas já estariam no Set e nenhuma sobreviveria aqui.
      // 🔁 Só a PRIMEIRA ocorrência de cada call entra no histórico (o quirk do
      // aggregateResponses pode empurrar a mesma referência 2x — as duas
      // passariam no callsSet.has e duplicariam a part no request).
      const callsSet = new Set(calls.map(p => p.functionCall));
      const vistosHist = new Set();
      const partsLimpos = content.parts.filter(p => {
        if (p.functionCall) {
          if (!callsSet.has(p.functionCall) || vistosHist.has(p.functionCall)) return false;
          vistosHist.add(p.functionCall);
        }
        return true;
      });
      // 🐛 FIX 2026-08-10 (400 "Function call is missing a thought_signature"):
      // o aggregateResponses do SDK descarta o campo thoughtSignature (part-
      // level). Recoloca as parts CRUAS capturadas no streaming — que preservam
      // a assinatura — no turno do MODELO do histórico (a doc do Gemini 3 diz
      // que a assinatura deve voltar NA PART do functionCall do turno do modelo,
      // NÃO na functionResponse). Sem isso a rodada seguinte leva 400.
      const rawPorCall = new Map();
      for (const pb of (result.partsBrutas || [])) {
        if (pb && pb.functionCall && callsSet.has(pb.functionCall) && !rawPorCall.has(pb.functionCall)) {
          rawPorCall.set(pb.functionCall, pb);
        }
      }
      const partsComSignature = partsLimpos.map((p) => {
        if (p.functionCall && rawPorCall.has(p.functionCall)) return rawPorCall.get(p.functionCall);
        return p;
      });
      // 🐛 FIX: o SDK antigo agrega o stream SEM role no content do modelo — a
      // API rejeita functionCall dentro de role 'user'. Força role 'model' aqui
      // e a limparContentsParaEnvio reforça no envio.
      contents.push({ ...content, role: 'model', parts: partsComSignature });
      for (const c of calls) {
        const name = String(c.functionCall.name).trim();
        // 🐛 FIX: no STREAMING o SDK antigo devolve functionCall.args como
        // STRING JSON (não objeto) — parseia antes de executar a ferramenta.
        let args = c.functionCall.args;
        if (typeof args === 'string') {
          try { args = JSON.parse(args) || {}; } catch (e) { args = {}; }
        }
        if (!args || typeof args !== 'object' || Array.isArray(args)) args = {};
        if (typeof onTool === 'function') {
          try { onTool(name, args); } catch (e) {}
        }
        let out;
        try {
          out = toolExecutor ? await toolExecutor(name, args, toolCtx) : { erro: 'Sem executor de ferramentas' };
        } catch (e) {
          out = { erro: String(e.message || 'erro') };
        }
        // 📝 A functionResponse NÃO ecoa a thoughtSignature: a doc do Gemini 3
        // diz que a assinatura pertence à PART do functionCall no turno do
        // MODELO (re-injetada em partsComSignature acima) — não na response.
        contents.push({ role: 'user', parts: [{ functionResponse: { name, response: { result: out } } }] });

        // 📎 AUTO-ENTREGA DE ARQUIVO (regra do dono): se a ferramenta criou/baixou
        // um arquivo e a IA esquecer o marcador [ARQUIVO: ...], o sistema coleta o
        // caminho real e entrega o arquivo mesmo assim (ia_agent.js anexa na resposta).
        try {
          const cam = extrairCaminhoGerado(name, out, toolCtx);
          if (cam && !arquivosGerados.includes(cam)) arquivosGerados.push(cam);
        } catch (e) { /* coleta de caminho não quebra o loop */ }

        // 📸 FEEDBACK DE IMAGEM: quando a ferramenta é captura_tela, a IA PRECISA VER o print
        // (páginas com anti-robô/captcha, botões, formulários). Carrega o PNG e anexa como
        // imagem na próxima chamada — senão a IA só recebe o caminho em texto e fica cega.
        if (name === 'captura_tela' && out && out.arquivo && fs.existsSync(out.arquivo)) {
          try {
            const buf = fs.readFileSync(out.arquivo);
            if (buf.length > 0) {
              contents.push({
                role: 'user',
                parts: [
                  { inlineData: { data: buf.toString('base64'), mimeType: 'image/png' } },
                  { text: '📸 Print da tela (captura_tela). Analise a imagem para decidir o próximo passo (botões, formulários, anti-robô/captcha).' },
                ],
              });
            }
          } catch (e) { /* se falhar ao anexar a imagem, segue com o texto */ }
        }

        // 🌀 ANTI-LOOP (2 níveis):
        // 1) Mesma ferramenta com os MESMOS argumentos 3x = círculo.
        // 2) Mesma ferramenta (QUALQUER argumento) 8x SEGUIDAS = travada nela.
        const chave = `${name}::${JSON.stringify(args).slice(0, 200)}`;
        repeticoes.set(chave, (repeticoes.get(chave) || 0) + 1);
        if (ultimaFerramenta !== null && ultimaFerramenta !== name) {
          vezesPorFerramenta.clear(); // trocou de ferramenta: zera a contagem
          falhasPorFerramenta.clear(); // 🚧 e zera as falhas consecutivas
        }
        ultimaFerramenta = name;
        vezesPorFerramenta.set(name, (vezesPorFerramenta.get(name) || 0) + 1);
        const vezesMesmosArgs = repeticoes.get(chave);
        const vezesTotal = vezesPorFerramenta.get(name);
        // 🛠️ Ferramentas de arquivo são repetidas LEGITIMAMENTE (criar site com
        // N páginas = criar_arquivo x10 seguidas). O corte de 8x vale para
        // ferramentas de AÇÃO/PESQUISA, não para criar/ler/editar arquivos.
        const ferramentaDeArquivo = /^(criar_arquivo|ler_arquivo|editar_arquivo)$/i.test(name);
        // 🪞 REFLEXÃO: ferramenta falhou (objeto {erro} OU string 'ERRO: ...')
        const erroMsg = (out && typeof out === 'object' && out.erro)
          ? String(out.erro)
          : (typeof out === 'string' && /^ERRO/i.test(out) ? out : null);
        // 🐛 Só conta falhas SEGUIDAS: se a ferramenta CONSEGUIU agora, zera o
        // contador dela (senão falha → sucesso → falha contaria como 2 e o
        // bloqueio dispararia prematuro).
        if (erroMsg) falhasPorFerramenta.set(name, (falhasPorFerramenta.get(name) || 0) + 1);
        else if (falhasPorFerramenta.has(name)) falhasPorFerramenta.set(name, 0);
        const falhasSeguidas = falhasPorFerramenta.get(name) || 0;
        // 🚧 BLOQUEIO REAL (regra do dono): mesma ferramenta falhando 2x SEGUIDAS,
        // 3x nos mesmos args ou 8x no total = não está conseguindo passar. Em vez
        // de queimar rodadas à toa, PARE e AVISE O USUÁRIO — o aviso vira a
        // resposta final (a IA termina com [FIM]).
        const bloqueio = (erroMsg && falhasSeguidas >= 2) || (!ferramentaDeArquivo && vezesTotal >= 8) || vezesMesmosArgs >= 3;
        if (bloqueio && !avisoBloqueioEnviado) {
          avisoBloqueioEnviado = true;
          flagSetNestaRodada = true;
          const motivo = erroMsg
            ? `a ferramenta ${name} falhou ${falhasSeguidas}x seguidas (${erroMsg.slice(0, 200)})`
            : (vezesTotal >= 8
                ? `você chamou ${name} ${vezesTotal}x seguidas sem resolver`
                : `você repetiu ${name} com os MESMOS argumentos ${vezesMesmosArgs}x`);
          contents.push({
            role: 'user',
            parts: [{ text: `🚧 VOCÊ ESTÁ BLOQUEADA NESTA MISSÃO (regra do dono): ${motivo}. PARE de tentar agora — NÃO chame mais NENHUMA ferramenta. AVISE O USUÁRIO em texto respondendo (1) o que te bloqueou, (2) o que você já tentou, (3) o que precisaria para destravar (ex: ele clicar no captcha/anti-robô, fornecer dado/permissão, site voltar). Seja honesta — não invente que terminou. Finalize a resposta com ${endMarker}.` }],
          });
        } else if (!bloqueio && erroMsg) {
          contents.push({
            role: 'user',
            parts: [{ text: `❌ A ferramenta ${name} FALHOU: ${erroMsg.slice(0, 300)}\n\n🧠 REFLEXÃO OBRIGATÓRIA: por que falhou? O plano está certo? Existe OUTRA ferramenta ou outro caminho? Ajuste a estratégia e tente de novo — não repita a mesma tentativa.` }],
          });
        }
      }
      // 🚧 ENFORCEMENT do bloqueio: a IA já foi avisada que está bloqueada mas
      // chamou ferramenta de novo — reforça a ordem de parar e avisar (sem isso
      // ela poderia queimar as rodadas restantes em silêncio).
      if (avisoBloqueioEnviado && !flagSetNestaRodada) {
        contents.push({
          role: 'user',
          parts: [{ text: `⛔ VOCÊ ESTÁ BLOQUEADA (regra do dono) e JÁ FOI AVISADA. NÃO chame mais NENHUMA ferramenta. Responda AGORA em texto, avisando o usuário do que te bloqueou, e finalize com ${endMarker}.` }],
        });
      }
      continue;
    }

    text = textoAcumulado || extrairTexto(result.response);

    if (text.includes(endMarker) || !usedTools) {
      if (text.includes(endMarker)) concluida = true;
      text = text.split(endMarker).join('').trim();
      break;
    }

    if (round + 1 < maxRounds) {
      // 🚧 Se já houve BLOQUEIO, o push padrão ("não desistas") CONTRADIZ a ordem
      // de parar e avisar — nesse caso só lembra de finalizar o aviso com [FIM].
      const pushMsg = avisoBloqueioEnviado
        ? `⛔ Você foi instruída a avisar o usuário sobre o bloqueio. NÃO chame mais ferramentas. Finalize AGORA o seu aviso em texto e termine com ${endMarker}.`
        : `⚠️ Tarefa ainda não concluída (rodada ${round + 1}/${maxRounds}). Não desistas: raciocina o que falta fazer, escolhe a melhor ferramenta, executa e VERIFICA o resultado. Só termina quando estiver FEITO de verdade. Quando terminares, termina tua resposta com ${endMarker}.`;
      if (pushMsg !== lastPushMsg) {
        lastPushMsg = pushMsg;
        contents.push({ role: 'user', parts: [{ text: pushMsg }] });
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: avisoBloqueioEnviado ? `⛔ Finalize agora o aviso do bloqueio com ${endMarker}.` : `Continua! Só tens ${maxRounds - round - 1} rodadas restantes. Analisa o resultado anterior, decide o próximo passo e executa. Finaliza com ${endMarker} quando concluíres.` }],
        });
      }
    }
    // 🛑 SEM AUTO-EXTENSÃO (economia de API — regra do dono): se as rodadas
    // acabarem sem concluir, o loop termina e a IA avisa que a missão é grande
    // demais (ou o usuário re-chama com [LONGA_MISSAO] explícito).
  }

  if (text.includes(endMarker)) text = text.split(endMarker).join('').trim();
  text = String(text || '').replace(/\[LONGA_MISSAO\]/gi, '').trim();

  // 🚨 MISSÃO NÃO CONCLUÍDA: o agente usou ferramentas (estava numa missão) mas
  // as rodadas acabaram SEM [FIM] — a IA NUNCA pode parar sem explicar por quê.
  // Regra do dono: em missão, só volta com o RESULTADO; se não conseguir,
  // avisa o PROBLEMA antes de parar. Roda UMA chamada final de relatório (sem
  // ferramentas) pra IA dizer o que conseguiu, o que travou e o que faltava.
  if (usedTools && !concluida) {
    contents.push({
      role: 'user',
      parts: [{ text: '⚠️ Suas rodadas acabaram e a missão NÃO foi concluída. NÃO chame mais nenhuma ferramenta — responda APENAS em texto: (1) o que você JÁ CONSEGUIU fazer; (2) o PROBLEMA/OBSTÁCULO exato que impediu de terminar (erro, bloqueio, dado faltando, permissão negada, etc.); (3) o que ainda faltava fazer. Seja honesto e direto — não invente que terminou.' }],
    });
    try {
      // 🔒 Modelo SEM ferramentas: a IA só pode escrever o relatório, não executar
      const modelSemTools = genAI.getGenerativeModel({
        model: getModeloAtual(),
        ...(system ? { systemInstruction: system } : {}),
      });
      // 🐛 FIX: relatório SEM ferramentas → limparContentsParaEnvio remove as
      // partes de função do histórico (functionCall/functionResponse sem tools
      // declaradas também geram 400).
      const rReport = await comTimeout(comRotacao(async () => generateContentComStream(modelSemTools, contents, onStream, false)), TIMEOUT_API_MS, 'relatório');
      const tokensReport = rReport.response?.usageMetadata?.totalTokens || 0;
      totalTokens += tokensReport;
      recordUsage(tokensReport);
      const relatorio = rReport.textoAcumulado || extrairTexto(rReport.response) || '';
      if (relatorio.trim()) {
        // 🧹 Limpa os marcadores de sistema do relatório ([FIM]/[LONGA_MISSAO] —
        // o modelo aprendeu a anexar [FIM] no fim e vazaria literal pro usuário)
        text = relatorio.replace(/\[LONGA_MISSAO\]/gi, '').trim();
        if (text.includes(endMarker)) text = text.split(endMarker).join('').trim();
      } else {
        text = '⚠️ Não consegui concluir essa missão e minhas rodadas acabaram no meio. O problema ficou no caminho — me chama de novo que eu retomo de onde parei.';
      }
    } catch (e) {
      text = text || '⚠️ Não consegui concluir essa missão: minhas rodadas acabaram antes do fim. Me chama de novo que eu retomo de onde parei.';
    }
  }

  if (!text && usedTools) {
    text = 'Puts, essa missão é gigante e eu ainda tô no meio dela. Continua me chamando que eu retomo de onde parei e termino.';
  }
  return { text: text || 'Sem resposta.', tokens: totalTokens, arquivosGerados };
}

/**
 * Gera resposta de texto simples
 * @param {string} prompt
 * @param {object} opts - { image?: {data(Buffer), mime}, history?: [{role,parts}] }
 */
async function askGemini(prompt, opts = {}) {
  if (!getGeminiKey()) throw new Error('Nenhuma chave de IA configurada.');

  const contents = [];
  if (Array.isArray(opts.history)) {
    for (const h of opts.history) {
      if (h && h.role && Array.isArray(h.parts)) contents.push(h);
    }
  }

  const inlineData = opts.image?.dataBuffer && opts.image?.mimeType
    ? { inlineData: { data: Buffer.from(opts.image.dataBuffer).toString('base64'), mimeType: opts.image.mimeType } }
    : null;

  contents.push({ role: 'user', parts: inlineData ? [inlineData, { text: prompt }] : [{ text: prompt }] });

  const result = await comRotacao(async () => {
    const g = new GoogleGenerativeAI(getGeminiKey());
    const m = g.getGenerativeModel({ model: opts.model || getModeloAtual() });
    return m.generateContent({ contents });
  });
  const response = result.response;
  // 📊 Conta o uso NA FONTE (cada chamada real à API), com os tokens reais
  recordUsage(response.usageMetadata?.totalTokens);
  return {
    text: extrairTexto(response) || 'Sem resposta.',
    tokens: response.usageMetadata?.totalTokens,
  };
}

/**
 * 👂 𝒀𝑨𝑲𝑨𝑴𝒀 - TRANSCRIÇÃO DE ÁUDIO (ouvidos da IA)
 * Transcreve um áudio (voz/nota de voz/música) para texto usando o Gemini
 * (gemini-2.5-flash suporta áudio inline). Usa a MESMA rotação de chaves.
 * @param {Buffer} dataBuffer - buffer do áudio (mp3/ogg/wav...)
 * @param {string} mimeType - ex: 'audio/ogg', 'audio/mpeg', 'audio/wav'
 * @returns {Promise<string>} transcrição literal (ou '' se falhar)
 */
async function transcreverAudio(dataBuffer, mimeType = 'audio/ogg') {
  if (!dataBuffer || !dataBuffer.length) return '';
  const res = await askSystemGemini(
    'Você é um transcritor de áudio perfeito. Transcreva EXATAMENTE o que foi dito no áudio, na língua original (geralmente português brasileiro). Não resuma, não comente, não adicione nada além da transcrição literal do que foi falado.',
    'Transcreva literalmente o áudio abaixo.',
    [{ dataBuffer, mimeType }]
  );
  return String(res.text || '').trim();
}

const USAGE_FILE = path.join(__dirname, '..', '..', 'data', 'token_usage.json');

function loadUsage() {
  try { if (fs.existsSync(USAGE_FILE)) return JSON.parse(fs.readFileSync(USAGE_FILE)); } catch (e) {}
  return { requests: 0, tokens: 0, sessions: 0 };
}

function recordUsage(tokens = 0) {
  const u = loadUsage();
  u.requests += 1;
  u.tokens += tokens || 0;
  fs.writeFileSync(USAGE_FILE, JSON.stringify(u, null, 2));
  return u;
}

module.exports = { askGemini, askSystemGemini, askSystemGeminiTools, transcreverAudio, comRotacao, getGeminiKey, getGeminiKeys, getModelosRotacao, getModeloAtual, setModelo, resetarModelos, getModeloManual, getChavesExcluidas, resetarChavesExcluidas, cooldownQuotaRestante, resetarCooldownQuota, loadUsage, recordUsage, sanitizarErroUsuario };