// 🧠 𝒀𝑨𝑲𝑨𝑴𝒀-IA — Loader de comandos do grupo (WhatsApp).
// Carrega comandos ESTÁTICOS de src/grupo/*.js (padrão: module.exports =
// { command, description, handler } ou array deles) + comandos DINÂMICOS
// criados pela IA via criar_comando (carregam SEM reiniciar, persistidos em
// arquivo — o boot lê o arquivo de novo como estático).
// Expõe executarComandoDinamico para o corvo.js disparar o handler no dispatch.
const fs = require('fs');
const path = require('path');

const GRUPO_DIR = __dirname;
// Arquivos internos que NÃO são comandos
const INTERNOS = new Set(['index.js', 'anexo.js', 'memoria.js', 'tts.js']);

const estaticos = new Map(); // nome -> cmd (lidos de arquivo)
const dinamicos = new Map(); // nome -> cmd (registrados em runtime)

let carregouEstaticos = false;
function carregarEstaticos() {
  if (carregouEstaticos) return;
  carregouEstaticos = true;
  try {
    for (const f of fs.readdirSync(GRUPO_DIR)) {
      if (!f.endsWith('.js') || INTERNOS.has(f)) continue;
      const arquivo = path.join(GRUPO_DIR, f);
      try {
        delete require.cache[require.resolve(arquivo)];
        const mod = require(arquivo);
        const cmds = Array.isArray(mod) ? mod : [mod];
        for (const cmd of cmds) {
          if (cmd && cmd.command && typeof cmd.handler === 'function') {
            estaticos.set(String(cmd.command).toLowerCase(), { ...cmd, file: f });
          }
        }
      } catch (e) { /* arquivo inválido não derruba o loader */ }
    }
  } catch (e) {}
}

/** Todos os comandos do grupo: estáticos (arquivo) + dinâmicos (runtime). */
function getGroupCommands() {
  carregarEstaticos();
  return [...estaticos.values(), ...dinamicos.values()];
}

/** Apenas os comandos dinâmicos criados pela IA em runtime. */
function getDynamicCommands() {
  return [...dinamicos.values()];
}

/** Acha um comando por nome (dinâmico primeiro, depois estático). */
function getCommand(nome) {
  const n = String(nome || '').trim().toLowerCase().replace(/^\//, '');
  carregarEstaticos();
  return dinamicos.get(n) || estaticos.get(n) || null;
}

/**
 * Registra um comando dinâmico em runtime (sem reiniciar).
 * Formato esperado pelo ia_tools: cmd = { command, description, handler, file }.
 * Retorna { ok: true } ou { erro }.
 */
async function registrarComandoDinamico(bot, cmd, logEvent) {
  try {
    const n = String((cmd && cmd.command) || '').trim().toLowerCase().replace(/^\//, '');
    if (!n) return { erro: 'Comando sem nome.' };
    if (!/^[a-z0-9_]{1,32}$/.test(n)) {
      return { erro: 'Nome de comando inválido: use só letras minúsculas, números e _ (ex: regras, aviso).' };
    }
    if (typeof cmd.handler !== 'function') {
      return { erro: 'O comando precisa de um handler (função async que recebe ctx).' };
    }
    dinamicos.set(n, {
      command: n,
      description: cmd.description || '',
      handler: cmd.handler,
      file: cmd.file || `${n}.js`,
    });
    if (logEvent) { try { logEvent('comando_dinamico', 'registrado', n); } catch (e) {} }
    return { ok: true };
  } catch (e) {
    return { erro: String(e.message || e) };
  }
}

/**
 * Remove um comando dinâmico do runtime. Se o comando tinha virado estático
 * (arquivo carregado no boot), remove do mapa estático também.
 * Retorna { ok: true, estatico } ou { erro }.
 */
async function removerComandoDinamico(nome) {
  const n = String(nome || '').trim().toLowerCase().replace(/^\//, '');
  const eraDinamico = dinamicos.delete(n);
  const eraEstatico = estaticos.has(n);
  if (eraEstatico) estaticos.delete(n);
  if (!eraDinamico && !eraEstatico) return { ok: false, erro: `Comando /${n} não encontrado.` };
  return { ok: true, estatico: eraEstatico };
}

/**
 * 🚀 DISPATCH: executa o handler de um comando dinâmico com o ctx do corvo.
 * Retorna { executado: true } se achou e rodou; { executado: false } se o
 * comando não existe. Erros do handler NÃO derrubam o bot (tenta avisar).
 */
async function executarComandoDinamico(nome, ctx) {
  const cmd = getCommand(nome);
  if (!cmd || typeof cmd.handler !== 'function') return { executado: false };
  try {
    await cmd.handler(ctx);
    return { executado: true };
  } catch (e) {
    try {
      if (ctx && typeof ctx.reply === 'function') {
        await ctx.reply(`⚠️ Erro no comando /${nome}: ${String(e.message || e).split('\n')[0]}`);
      }
    } catch (e2) {}
    return { executado: true, erro: String(e.message || e) };
  }
}

module.exports = {
  getGroupCommands,
  getDynamicCommands,
  getCommand,
  registrarComandoDinamico,
  removerComandoDinamico,
  executarComandoDinamico,
};
