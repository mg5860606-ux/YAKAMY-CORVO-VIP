/**
 * 🛠️ 𝒀𝑨𝑲𝑨𝑴𝒀 - FERRAMENTAS DO AGENTE (function calling)
 * A IA usa estas ferramentas quando precisa de informação da internet:
 * busca web, imagens, GitHub e Wikipedia.
 * Chamadas reais via generateContent + functionCall (loop no ia_gemini).
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const youtubedl = require('youtube-dl-exec');
const ffmpegPath = require('ffmpeg-static');
const lembretes = require('../lembretes');
const tarefas = require('./ia_tarefas');
const monitorPrecos = require('./ia_monitor_precos');
const autonomia = require('./ia_autonomia');
const core = require('./ia_core');
const mensageiro = require('./ia_mensageiro');
const config = require('../../config');
const grupoComandos = require('../grupo');
const { isZonaLiberada } = require('../grupo/anexo');
const { detectarTipoBuffer, detectarTipoArquivo, converterParaMp4 } = require('../media_utils');

const DATA_BOT = path.resolve(__dirname, '..', '..', 'data');

// 📎 Arquivos: o DONO pode mexer em QUALQUER lugar do PC. Para MEMBROS do grupo,
// o acesso fica restrito às ZONAS DO PEDIDO dele — data/anexos (o arquivo que
// ele mandou no grupo), data/downloads (o que ele pediu para baixar) e
// data/github (repo que ele pediu). NADA mais do PC.
function arquivoPermitido(toolCtx, caminho) {
  if (toolCtx && toolCtx.isDono) return true;
  return isZonaLiberada(caminho);
}

function negarArquivo(caminho) {
  return { erro: `Permissão negada: membros só podem mexer nos arquivos do próprio pedido (o anexo que enviou, o download que pediu, o repo que baixou). ${caminho} está fora dessas zonas — só o DONO da corvo pode mexer aí.` };
}

// ⏱️ Timeout padrão por ferramenta (ms) — evita ferramenta pendurada travar o agente
const TOOL_TIMEOUT = 120000; // 2 min padrão
const TOOL_TIMEOUTS = {
  // 📸 OCR: o Gemini de visão tem timeout interno de 2min + rotação de
  // chaves/modelos — o teto externo precisa ser folgado pra não cortar no meio.
  ler_texto_imagem: 300000,
  baixar_youtube: 600000,
  baixar_arquivo: 600000,
  baixar_github: 300000,
  baixar_instalar_testar: 900000,
  instalar_programa: 600000,
  expor_site: 180000,
  iniciar_servidor: 90000,
  descompactar: 300000,
  zipar_pasta: 300000,
  procurar_no_pc: 300000,
  executar_terminal: 180000,
  git_operacoes: 120000,
};

function comTimeout(promise, ms, nome) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`Ferramenta "${nome}" excedeu o tempo limite de ${Math.round(ms / 1000)}s e foi interrompida.`)), ms)),
  ]);
}

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36' };

function clean(s, n = 250) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n);
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function decodeBingUrl(href) {
  if (!href) return '';
  const m = href.match(/[?&]u=a1([^&]+)/);
  if (!m) return href;
  try {
    return Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  } catch (e) {
    return href;
  }
}

async function buscarWeb(query) {
  const q = encodeURIComponent(query);
  const results = [];
  try {
    const { data } = await axios.get(`https://www.bing.com/search?q=${q}&count=10`, {
      headers: {
        ...UA,
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Cookie': 'SRCHHPGUSR=SRCHLANG=pt-BR',
      },
      timeout: 25000,
    });
    const $ = cheerio.load(data);
    if (data.includes('b_algo')) {
      $('li.b_algo').each((i, el) => {
        const a = $(el).find('h2 a').first();
        const href = a.attr('href') || '';
        const title = clean(a.text(), 120);
        if (!href || !title) return;
        results.push({
          titulo: title,
          url: decodeBingUrl(href),
          descricao: clean($(el).find('.b_caption p, .b_lineclamp2, .b_paractl, .b_caption').first().text(), 220),
        });
      });
    }
  } catch (e) { /* segmento para fallbacks abaixo */ }

  if (!results.length) {
    for (const base of ['https://html.duckduckgo.com/html/?q=', 'https://lite.duckduckgo.com/lite/?q=']) {
      try {
        const { data } = await axios.get(base + q, { headers: UA, timeout: 15000 });
        const $ = cheerio.load(data);
        $('.result, a.result-link').slice(0, 6).each((i, el) => {
          const a = $(el).closest('.result').length ? $(el).closest('.result') : $(el);
          const href = a.attr('href') || '';
          const uddg = href.match(/[?&]uddg=([^&]+)/);
          results.push({
            titulo: clean($('.result__title', a).text() || $(el).text(), 120),
            url: uddg ? decodeURIComponent(uddg[1]) : href,
            descricao: clean($('.result__snippet', a).text(), 220),
          });
        });
        if (results.length) break;
      } catch (e) { /* próxima fonte */ }
    }
  }

  return results.slice(0, 6);
}

async function buscarImagens(query) {
  const q = encodeURIComponent(query);
  const { data } = await axios.get(`https://www.bing.com/images/search?q=${q}&form=HDRSC2`, { headers: UA, timeout: 20000 });
  const results = [];
  const re = /m="([^"]+)"/g;
  let m;
  while ((m = re.exec(data)) && results.length < 6) {
    try {
      const j = JSON.parse(decodeEntities(m[1]));
      if (j && j.murl) {
        results.push({ imagem: decodeURIComponent(j.murl), miniatura: j.turl ? decodeURIComponent(j.turl) : null, titulo: clean(j.t) });
      }
    } catch (e) { /* pula bloco inválido */ }
  }
  return results;
}

/**
 * 🔎 pesquisar_solucao: busca na internet COMO resolver uma tarefa ANTES de agir.
 * Reusa buscarWeb (Bing/DDG) + buscarGithub e monta um resumo orientado a AÇÃO:
 * links de docs/tutoriais + repos do GitHub. A IA usa quando não sabe EXATAMENTE
 * como fazer algo (instalar lib, corrigir erro, criar recurso, configurar X).
 */
async function pesquisarSolucao(assunto) {
  const a = String(assunto || '').trim();
  if (!a) return 'ERRO: informe o assunto/objetivo a pesquisar (ex: "instalar node no windows").';

  const queries = [
    `${a} como fazer tutorial`,
    `${a} documentação como instalar`,
    `${a} npm github`,
  ];
  const resultados = [];
  const vistos = new Set();

  for (const q of queries) {
    try {
      const res = await buscarWeb(q);
      for (const r of res || []) {
        if (!r?.url || vistos.has(r.url)) continue;
        vistos.add(r.url);
        resultados.push({ tipo: 'web', titulo: r.titulo, url: r.url, descricao: r.descricao });
      }
    } catch (e) { /* ignora falha de busca */ }
    if (resultados.length >= 6) break;
  }

  try {
    const repos = await buscarGithub(a, 'estrelas');
    for (const repo of repos || []) {
      if (vistos.has(repo.url || repo.nome)) continue;
      vistos.add(repo.url || repo.nome);
      resultados.push({ tipo: 'github', titulo: repo.nome, url: repo.url, descricao: repo.descricao });
    }
  } catch (e) { /* ignora falha do github */ }

  if (!resultados.length) return 'ERRO: não encontrei soluções para esse assunto na web.';
  return {
    ok: true,
    assunto: a,
    observacao: 'Fontes encontradas para VOCÊ LER ANTES de executar. Use essas informações para planejar a ação correta.',
    resultados: resultados.slice(0, 8),
  };
}

async function buscarGithub(query, ordenar) {
  const q = encodeURIComponent(query);
  let url = `https://api.github.com/search/repositories?q=${q}&per_page=6`;
  if (ordenar === 'estrelas') url += '&sort=stars&order=desc';
  const { data } = await axios.get(url, {
    headers: { ...UA, Accept: 'application/vnd.github+json' }, timeout: 20000,
  });
  return (data.items || []).map(r => ({
    nome: r.full_name,
    descricao: r.description || '',
    linguagem: r.language || '?',
    estrelas: r.stargazers_count || 0,
    url: r.html_url,
  }));
}

async function buscarWikipedia(termo) {
  const { data } = await axios.get('https://pt.wikipedia.org/w/api.php', {
    params: { action: 'query', format: 'json', prop: 'extracts', exintro: 1, explaintext: 1, redirects: 1, titles: termo, formatversion: 2 },
    headers: UA, timeout: 20000,
  });
  const page = data.query?.pages?.[0];
  if (!page || !page.extract) return { erro: `Nada encontrado para "${termo}"` };
  return {
    titulo: page.title,
    resumo: page.extract.slice(0, 2000),
    url: page.pageid ? `https://pt.wikipedia.org/?curid=${page.pageid}` : null,
  };
}

const TOOL_SCHEMAS = [
  {
    name: 'buscar_web',
    description: 'Pesquisa na internet (qualquer assunto) e retorna links com título e resumo. Use para buscar notícias, conceitos, receitas, downloads, qualquer coisa. Informe termos de busca claros e em português.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Termos da busca' } }, required: ['query'] },
  },
  {
    name: 'pesquisar_solucao',
    description: 'Pesquisa na internet COMO RESOLVER uma tarefa ANTES de agir (docs, tutoriais, como instalar, correção de erro, libs npm, repos no GitHub). Use SEMPRE que o dono pedir algo que você não sabe exatamente como fazer (instalar programa/lib, corrigir um erro, criar um recurso, configurar X) — pesquise ANTES de executar. Depois de ler as fontes, execute com a ferramenta certa (baixar_instalar_testar, executar_terminal, criar_arquivo, etc.). QUALQUER pessoa do grupo pode pedir.',
    parameters: { type: 'object', properties: { assunto: { type: 'string', description: 'O que você precisa aprender a fazer (ex: instalar node no windows, corrigir erro de porta 3000 ocupada, criar bot de música com python)' } }, required: ['assunto'] },
  },
  {
    name: 'buscar_imagens',
    description: 'Busca imagens na internet. Retorna URLs de imagens. Use quando o usuário pedir fotos, imagens, figuras de algo.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'O que a imagem deve mostrar' } }, required: ['query'] },
  },
  {
    name: 'buscar_github',
    description: 'Busca repositórios no GitHub por palavra-chave. Use quando o usuário pedir para procurar projetos, código, bibliotecas ou libs no GitHub, ou perguntar "melhores projetos do GitHub". ordenar: estrelas = do mais popular para o menos.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Palavra-chave do repositório' }, ordenar: { type: 'string', enum: ['estrelas'], description: 'ordenar por estrelas (populares)' } }, required: ['query'] },
  },
  {
    name: 'buscar_wikipedia',
    description: 'Busca resumo de um assunto na Wikipédia (em português). Use para explicações enciclopédicas ou definições.',
    parameters: { type: 'object', properties: { termo: { type: 'string', description: 'Termo da enciclopédia' } }, required: ['termo'] },
  },
  {
    name: 'executar_terminal',
    description: 'Executa QUALQUER comando no terminal (PowerShell/CMD) do PC do dono. Permite instalar programas, mover arquivos, gerenciar o sistema, etc. Só dono.',
    parameters: { type: 'object', properties: { comando: { type: 'string', description: 'Comando a executar' } }, required: ['comando'] },
  },
  {
    name: 'abrir_pasta',
    description: 'Abre uma pasta no Windows Explorer (ou pouca utilidade, apenas visual). Só dono.',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho completo da pasta (ex: C:\\Users\\Marcos ou C:\\corvo)' } }, required: ['caminho'] },
  },
  {
    name: 'listar_pasta',
    description: 'Lista o conteúdo (arquivos e pastas) de um diretório. Útil para ver o que existe em uma pasta — QUALQUER pessoa do grupo pode pedir. Só o DONO lista qualquer pasta do PC; MEMBROS listam APENAS pastas das zonas liberadas (data/anexos, data/downloads, data/github).',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho completo da pasta — para membro, dentro de data/anexos, data/downloads ou data/github' } }, required: ['caminho'] },
  },
  {
    name: 'criar_arquivo',
    description: 'Cria ou sobrescreve um arquivo no disco. Excelente para CRIAR arquivos novos: sites (HTML), código, scripts, documentos, configurações — QUALQUER pessoa do grupo pode pedir pra criar (ex: "cria um site pra mim", "cria um script"). Só o DONO cria em qualquer lugar; MEMBROS criam APENAS nas zonas liberadas (data/anexos, data/downloads, data/github) — salve lá e devolva com [ARQUIVO: caminho completo].',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho completo do arquivo — para membro, dentro de data/anexos, data/downloads ou data/github (ex: C:\\corvo\\corvo\\data\\downloads\\site.html)' }, conteudo: { type: 'string', description: 'Conteúdo do arquivo' } }, required: ['caminho', 'conteudo'] },
  },
  {
    name: 'reiniciar_pc',
    description: 'Reinicia o PC inteiro (com aviso e 10 segundos de delay). Só dono.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'desligar_pc',
    description: 'Desliga o PC (com aviso e 10 segundos de delay). Só dono.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'reiniciar_bot',
    description: 'Reinicia o processo do bot (encerra o index.js; precisa de supervisor para voltar sozinho). Só dono.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'ler_arquivo',
    description: 'Lê o conteúdo de um arquivo do PC (textos, código, arquivos enviados no grupo). SEMPRE use ANTES de editar para revisar. IMPORTANTE para ARQUIVO GRANDE (mais de 8000 caracteres): a leitura padrão mostra só o COMEÇO — para ver o MEIO/FIM use o parâmetro linhas (ex: "300-400") que mostra as linhas exatas com numeração. NUNCA reescreva um arquivo grande inteiro com criar_arquivo só com o que leu de um trecho — o resto seria perdido. Só o DONO lê qualquer arquivo; MEMBROS do grupo só podem ler os arquivos das zonas do próprio pedido (data/anexos, data/downloads, data/github).',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho completo do arquivo' }, linhas: { type: 'string', description: 'Trecho de linhas para arquivos grandes (ex: "300-400" ou "300"). Omita para ler do começo.' } }, required: ['caminho'] },
  },
  {
    name: 'editar_arquivo',
    description: 'Edita um arquivo substituindo um trecho EXATO por outro (com a IA revalidando o código depois com node --check em arquivos .js). FLUXO CORRETO: 1) ler_arquivo, 2) analisar/revisar, 3) editar_arquivo, 4) ler_arquivo de novo para conferir. 🔒 ANTES de editar o sistema salva um BACKUP automático (.bak ao lado do arquivo) — se a edição der errado, use restaurar_backup para voltar. Para arquivo GRANDE, leia o trecho com o parâmetro linhas do ler_arquivo antes. Só o DONO edita qualquer arquivo; MEMBROS do grupo só podem editar os arquivos das zonas do próprio pedido (data/anexos, data/downloads, data/github).',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho completo do arquivo' }, buscar: { type: 'string', description: 'Trecho EXATO que existe no arquivo (copie do ler_arquivo)' }, substituir: { type: 'string', description: 'Novo trecho que substitui o antigo' }, todas: { type: 'boolean', description: 'true = substituir todas as ocorrências; false/omitir = só a primeira' } }, required: ['caminho', 'buscar', 'substituir'] },
  },
  {
    name: 'restaurar_backup',
    description: 'RESTAURA a versão anterior de um arquivo a partir do backup automático salvo pelo editar_arquivo (guarda até 3 versões: .bak.1 = mais recente). Use quando uma edição deu errado ou quer desfazer (ex: "desfaz a última edição"). versao: 1 (padrão, mais recente), 2 ou 3 pra voltar mais atrás. Use listar_backups pra ver as versões disponíveis. Só o DONO; MEMBROS só nas zonas liberadas.',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho completo do arquivo a restaurar' }, versao: { type: 'number', description: 'Qual versão restaurar: 1 (mais recente, padrão), 2 ou 3' } }, required: ['caminho'] },
  },
  {
    name: 'listar_backups',
    description: 'Lista as versões de backup (.bak.1/.bak.2/.bak.3) de um arquivo que foram salvas pelo editar_arquivo, com data e tamanho. Use ANTES de restaurar_backup pra ver qual versão escolher. Só o DONO; MEMBROS só nas zonas liberadas.',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho completo do arquivo' } }, required: ['caminho'] },
  },
  {
    name: 'criar_pasta',
    description: 'Cria uma pasta nova (e subpastas) no disco. QUALQUER pessoa do grupo pode pedir. Só o DONO cria em qualquer lugar; MEMBROS criam APENAS dentro das zonas liberadas (data/anexos, data/downloads, data/github).',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho completo da pasta — para membro, dentro de data/anexos, data/downloads ou data/github' } }, required: ['caminho'] },
  },
  {
    name: 'renomear_arquivo',
    description: 'Renomeia um arquivo OU pasta (ou move de pasta) no disco. QUALQUER pessoa do grupo pode pedir. Só o DONO renomeia em qualquer lugar; MEMBROS renomeiam APENAS arquivos/pastas das zonas liberadas (data/anexos, data/downloads, data/github) — origem e destino nas zonas do próprio pedido.',
    parameters: { type: 'object', properties: { origem: { type: 'string', description: 'Caminho atual — para membro, dentro de data/anexos, data/downloads ou data/github' }, destino: { type: 'string', description: 'Novo caminho — para membro, dentro de data/anexos, data/downloads ou data/github' } }, required: ['origem', 'destino'] },
  },
  {
    name: 'copiar_arquivo',
    description: 'Copia um arquivo OU pasta para outro lugar (mantém o original). QUALQUER pessoa do grupo pode pedir. Só o DONO copia em qualquer lugar; MEMBROS copiam APENAS entre as zonas liberadas (data/anexos, data/downloads, data/github) — origem e destino nas zonas do próprio pedido.',
    parameters: { type: 'object', properties: { origem: { type: 'string', description: 'Caminho do arquivo/pasta a copiar — para membro, dentro de data/anexos, data/downloads ou data/github' }, destino: { type: 'string', description: 'Caminho de destino — para membro, dentro de data/anexos, data/downloads ou data/github' } }, required: ['origem', 'destino'] },
  },
  {
    name: 'mover_arquivo',
    description: 'Move um arquivo OU pasta para outro lugar (some do original). QUALQUER pessoa do grupo pode pedir. Só o DONO move em qualquer lugar; MEMBROS movem APENAS entre as zonas liberadas (data/anexos, data/downloads, data/github) — origem e destino nas zonas do próprio pedido.',
    parameters: { type: 'object', properties: { origem: { type: 'string', description: 'Caminho do arquivo/pasta a mover — para membro, dentro de data/anexos, data/downloads ou data/github' }, destino: { type: 'string', description: 'Caminho de destino — para membro, dentro de data/anexos, data/downloads ou data/github' } }, required: ['origem', 'destino'] },
  },
  {
    name: 'procurar_no_pc',
    description: 'Procura arquivos/pastas por nome (ou extensão) e retorna os caminhos encontrados. Ex: procurar_no_pc(foto) ou procurar_no_pc(*.mp4) — QUALQUER pessoa do grupo pode pedir. Só o DONO procura no PC inteiro; MEMBROS procuram APENAS dentro das zonas liberadas (data/anexos, data/downloads, data/github) — se não informar a pasta, a busca é em data/downloads.',
    parameters: { type: 'object', properties: { termo: { type: 'string', description: 'Nome do arquivo/pasta ou padrão com * (ex: senhas, *.mp4)' }, pasta: { type: 'string', description: 'Pasta base da busca (opcional; dono: perfil do usuário; membro: data/downloads) — para membro, dentro de data/anexos, data/downloads ou data/github' } }, required: ['termo'] },
  },
  {
    name: 'baixar_youtube',
    description: 'Baixa um vídeo do YouTube (URL) como vídeo ou áudio e salva em data/downloads. Use quando o usuário pedir para baixar música/vídeo do YouTube. A resposta inclui o caminho do arquivo.',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'URL do YouTube' }, tipo: { type: 'string', enum: ['video', 'audio'], description: 'video (mp4) ou audio (mp3)' } }, required: ['url'] },
  },
  {
    name: 'baixar_arquivo',
    description: 'Baixa QUALQUER arquivo da internet por URL (imagem, vídeo, documento, zip) e salva em data/downloads. Use para baixar imagens/vídeos que o usuário indicar.',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'URL do arquivo' }, nome: { type: 'string', description: 'Nome do arquivo salvo (opcional, com extensão)' } }, required: ['url'] },
  },
  {
    name: 'criar_lembrete',
    description: 'Agenda um lembrete para ser enviado no chat mais tarde. Quando: formato ISO (ex: 2026-08-04T15:30:00) ou relativo (ex: 10min, 2h, 30s).',
    parameters: { type: 'object', properties: { texto: { type: 'string', description: 'O que lembrar' }, quando: { type: 'string', description: 'ISO 8601 ou relativo (10min, 2h)' } }, required: ['texto', 'quando'] },
  },
  {
    name: 'instalar_programa',
    description: 'Baixa e INSTALA um programa no PC sozinha (winget, npm ou pip) e deixa pronto. Ex: nodejs, python, git, ffmpeg, xampp, nginx. tipo: winget (padrão), npm ou pip. Só dono.',
    parameters: { type: 'object', properties: { nome: { type: 'string', description: 'Nome do programa/pacote' }, tipo: { type: 'string', enum: ['winget', 'npm', 'pip'], description: 'winget | npm | pip' } }, required: ['nome'] },
  },
  {
    name: 'verificar_programa',
    description: 'Verifica se um programa/comando está instalado e mostra a versão/localização. Use para TESTAR instalações. Só dono.',
    parameters: { type: 'object', properties: { nome: { type: 'string', description: 'Comando ou nome (ex: node, python, git, ffmpeg)' } }, required: ['nome'] },
  },
  {
    name: 'iniciar_servidor',
    description: 'Sobe um servidor web local servindo uma pasta (site), retorna o endereço http://localhost:PORTA. Use para colocar sites no ar na máquina do dono. Só dono.',
    parameters: { type: 'object', properties: { pasta: { type: 'string', description: 'Pasta do site (ex: C:\\corvo\\corvo\\site)' }, porta: { type: 'number', description: 'Porta (padrão 8080)' } }, required: ['pasta'] },
  },
  {
    name: 'expor_site',
    description: 'Cria um túnel e devolve uma URL pública para acessar o site do servidor local de qualquer lugar (usando localtunnel). Chame DEPOIS de iniciar_servidor. Só dono.',
    parameters: { type: 'object', properties: { porta: { type: 'number', description: 'Porta do servidor local (padrão 8080)' } }, required: [] },
  },
  {
    name: 'parar_servidor',
    description: 'Encerra o servidor que está rodando em uma porta. Só dono.',
    parameters: { type: 'object', properties: { porta: { type: 'number', description: 'Porta do servidor' } }, required: ['porta'] },
  },
  {
    name: 'info_sistema',
    description: 'Mostra informações do PC do dono: sistema operacional, CPU, RAM, discos, uptime e usuário. Só dono.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'uso_pc',
    description: 'Mostra o uso atual de CPU e RAM do PC em tempo real. Só dono.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'gerenciar_processos',
    description: 'Lista os processos que mais consomem memória do PC (top 20) ou mata um processo pelo nome/PID. acao: listar (padrão) ou matar. Só dono.',
    parameters: { type: 'object', properties: { acao: { type: 'string', enum: ['listar', 'matar'], description: 'listar ou matar' }, alvo: { type: 'string', description: 'Nome do processo (ex: chrome, node) ou PID numérico, para matar' } }, required: [] },
  },
  {
    name: 'abrir_programa',
    description: 'Abre um programa/app no PC do dono (ex: notepad, calc, mspaint, chrome, explorer ou caminho de um .exe). Só dono.',
    parameters: { type: 'object', properties: { programa: { type: 'string', description: 'Nome do app (notepad, calc, chrome...) ou caminho do .exe' }, delayMs: { type: 'integer', minimum: 0, maximum: 30000, description: 'Espera em ms antes de concluir (use ~3000-5000 quando for tirar print em seguida)' } }, required: ['programa'] },
  },
  {
    name: 'servicos',
    description: 'Lista serviços do Windows em execução, ou inicia/para/reinicia um serviço pelo nome. acao: listar (padrão), iniciar, parar, reiniciar. Só dono.',
    parameters: { type: 'object', properties: { acao: { type: 'string', enum: ['listar', 'iniciar', 'parar', 'reiniciar'], description: 'ação a executar' }, nome: { type: 'string', description: 'Nome do serviço (ex: Spooler, wuauserv)' } }, required: [] },
  },
  {
    name: 'rede_info',
    description: 'Mostra informações de rede do PC: IPs, adaptadores ativos, MAC. Só dono.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'testar_ping',
    description: 'Faz teste de ping (4 pacotes) para um host/endereço e mostra latência. Só dono.',
    parameters: { type: 'object', properties: { host: { type: 'string', description: 'Host ou IP (ex: google.com, 8.8.8.8)' } }, required: ['host'] },
  },
  {
    name: 'ver_portas',
    description: 'Lista as portas em escuta no PC (com PID do processo dono). Só dono.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'git_operacoes',
    description: 'Executa comandos git numa pasta (status, log, add, commit, push, pull, clone...). Ex: git_operacoes(pasta: C:\\corvo, comando: status). Só dono.',
    parameters: { type: 'object', properties: { pasta: { type: 'string', description: 'Pasta do repositório (padrão: C:\\corvo)' }, comando: { type: 'string', description: 'Comando git sem o prefixo "git" (ex: status, log --oneline -5)' } }, required: ['comando'] },
  },
  {
    name: 'baixar_github',
    description: 'Baixa um repositório inteiro do GitHub (zip) e extrai em data/github. Use quando alguém pedir para baixar um projeto do GitHub (QUALQUER pessoa do grupo pode pedir).',
    parameters: { type: 'object', properties: { repo: { type: 'string', description: 'Formato owner/repo (ex: facebook/react)' }, destino: { type: 'string', description: 'Pasta de destino (opcional, padrão data/github)' } }, required: ['repo'] },
  },
  {
    name: 'visitar_site',
    description: 'Abre um site da internet e extrai o conteúdo (título, descrição, texto) para você ler. Use quando o dono pedir "vai no site tal" ou "abre/visita tal página".',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'URL do site (ex: https://exemplo.com)' } }, required: ['url'] },
  },
  {
    name: 'abrir_site_navegador',
    description: 'Abre um site no navegador PADRÃO do PC. QUALQUER pessoa do grupo pode pedir para abrir o site da tarefa dela (ex: página com anti-robô/captcha para baixar um vídeo). Só abra o site do pedido, não fique navegando à toa.',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'URL do site' }, delayMs: { type: 'integer', minimum: 0, maximum: 30000, description: 'Espera em ms antes de concluir (use ~3000-5000 quando for tirar print em seguida)' } }, required: ['url'] },
  },
  {
    name: 'captura_tela',
    description: 'Tira um PRINT da tela (salva em data/screenshots) — qualquer pessoa pode pedir para ver a tela/anti-robô da tarefa. Padrão: JANELA ATIVA. telaInteira: true = tela inteira. Se abriu site/aba (abrir_site_navegador), use delayMs (ex: 5000) para a página carregar antes do print. ativar ("chrome"/"edge"/"firefox") traz o navegador à frente. Devolva a captura a quem pediu.',
    parameters: { type: 'object', properties: { delayMs: { type: 'number', description: 'Tempo em ms para aguardar antes de capturar (ex: 5000 = 5s). Use após abrir um site/aba para a página carregar.' }, telaInteira: { type: 'boolean', description: 'Se true, captura a tela inteira (todos os monitores) em vez da janela ativa.' }, ativar: { type: 'string', description: 'Nome do navegador/janela para trazer à frente antes do print (ex: chrome, edge, firefox, brave, opera). Use quando o site foi aberto mas a janela pode estar atrás de outras.' } } },
  },
  {
    name: 'lixeira',
    description: 'Acessa a LIXEIRA do PC do dono: lista os itens excluídos ou recupera um arquivo. acao: listar (padrão) ou recuperar (com termo). Só dono.',
    parameters: { type: 'object', properties: { acao: { type: 'string', enum: ['listar', 'recuperar'], description: 'listar ou recuperar' }, termo: { type: 'string', description: 'Nome do arquivo a recuperar (com acao=recuperar)' } }, required: [] },
  },
  {
    name: 'listar_projeto',
    description: 'Lista todos os arquivos de código do projeto do bot (C:\\corvo), ignorando node_modules e dados. Use para ver TODOS os arquivos de uma vez. Só dono.',
    parameters: { type: 'object', properties: { pasta: { type: 'string', description: 'Pasta (opcional; padrão C:\\corvo)' } }, required: [] },
  },
  {
    name: 'arquivos_modificados',
    description: 'Lista os arquivos do projeto do bot (C:\\corvo) que foram MODIFICADOS recentemente (por data de alteração). Use quando perguntarem o que mudou/foi alterado no bot, qual arquivo foi editado, ou para saber o que foi modificado nos arquivos da IA. dias: quantos dias pra trás (padrão 1). Só dono.',
    parameters: { type: 'object', properties: { dias: { type: 'number', description: 'Quantos dias pra trás (padrão 1)' }, max: { type: 'number', description: 'Máximo de arquivos a listar (padrão 25)' } }, required: [] },
  },
  {
    name: 'ler_projeto',
    description: 'Lê vários arquivos de código do projeto de uma vez (separados por vírgula) ou a pasta inteira. Use para revisar o código do bot. Só dono.',
    parameters: { type: 'object', properties: { arquivos: { type: 'string', description: 'Caminhos relativos separados por vírgula (ex: index.js, src/ia_tools.js). Vazio = todos' }, pasta: { type: 'string', description: 'Pasta base (opcional)' } }, required: [] },
  },
  {
    name: 'checar_codigo',
    description: 'Valida a sintaxe de TODOS os arquivos .js do projeto com node --check e reporta erros. Use antes de reiniciar o bot após edições. Só dono.',
    parameters: { type: 'object', properties: { pasta: { type: 'string', description: 'Pasta (opcional)' } }, required: [] },
  },
  {
    name: 'grep_codigo',
    description: 'Procura um padrão de texto/regex dentro dos arquivos de código do projeto (retorna arquivo:linha:trecho). Use para localizar funções, variáveis, TODO, bugs. Só dono.',
    parameters: { type: 'object', properties: { padrao: { type: 'string', description: 'Texto ou regex a procurar (ex: processAgent, TODO, catch)' }, pasta: { type: 'string', description: 'Pasta (opcional)' } }, required: ['padrao'] },
  },
  {
    name: 'criar_ferramenta',
    description: 'CRIA ferramenta personalizada quando nenhuma existente serve. Forneça nome, descrição, parâmetros (JSON Schema opcional) e o CÓDIGO JS da função: recebe args e pode usar helpers (runCmd, runPowerShell, axios, cheerio, fs, path, os, exec, spawn, buscarWeb, buscarImagens, buscarGithub, buscarWikipedia, lembretes, config). 🚫 NUNCA use require() nem import() — o ambiente NÃO tem require no escopo (seria bloqueado). Termine com return do resultado. Fica disponível IMEDIATAMENTE na sessão. Só dono.',
    parameters: { type: 'object', properties: { nome: { type: 'string', description: 'Nome da ferramenta (ex: buscar_preco, criar_planilha, monitorar_pasta)' }, descricao: { type: 'string', description: 'Descrição para você entender quando usar' }, parametros: { type: 'string', description: 'JSON Schema dos parâmetros (opcional). Ex: {"type":"object","properties":{"item":{"type":"string"}},"required":["item"]}' }, codigo: { type: 'string', description: 'Código JavaScript da função, usando args e helpers. Ex: const { data } = await axios.get(\`https://api.exemplo.com/${args.item}\`); return data;' } }, required: ['nome', 'descricao', 'codigo'] },
  },
  {
    name: 'apagar_ferramenta',
    description: 'Apaga uma ferramenta personalizada criada por você (não afeta as nativas). Só dono.',
    parameters: { type: 'object', properties: { nome: { type: 'string', description: 'Nome da ferramenta a apagar' } }, required: ['nome'] },
  },
  {
    name: 'listar_ferramentas',
    description: 'Lista todas as ferramentas disponíveis (nativas + criadas por você). Use para saber o que existe antes de criar uma nova.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'criar_comando',
    description: 'CRIA um comando novo do bot (ex: /regras, /aviso) e CARREGA NA HORA, SEM REINICIAR, SEM mexer no código do bot. Informe nome, descrição e o CÓDIGO JS do handler (async, recebe ctx). O sistema VALIDA a sintaxe, salva em src/grupo/<nome>.js e registra em runtime — qualquer pessoa do grupo já pode usar /nome. Só dono. O ctx do handler tem: ctx.reply(texto) (responde no chat), ctx.replyWithMarkdown(texto), ctx.message.text (texto completo), ctx.message.args (array de argumentos após o comando), ctx.from.id (número de quem usou), ctx.chat.id (jid do chat), ctx.ehDono (boolean), ctx.enviarPv(numero, texto) (manda mensagem no PV de um número — ex: aviso no PV de fulano), ctx.resolverMembro(nome) (acha o NÚMERO de um membro do grupo pelo nome — ex: "fulano"; retorna número sem @ ou null), ctx.corvo (socket do WhatsApp). NUNCA use nome de comando que já existe no bot (menu, ban, ia, corvo, etc.) — o sistema bloqueia. Exemplo de comando de aviso no PV por nome: const alvo = await ctx.resolverMembro(ctx.message.args[0]); const texto = ctx.message.args.slice(1).join(" "); if (!alvo || !texto) return ctx.reply("Uso: /aviso <nome> <texto>"); await ctx.enviarPv(alvo, texto); return ctx.reply("✅ Aviso enviado!");',
    parameters: { type: 'object', properties: { nome: { type: 'string', description: 'Nome do comando, sem a barra, minúsculo (ex: regras, aviso, hora)' }, descricao: { type: 'string', description: 'O que o comando faz (mostrado na lista de comandos)' }, codigo: { type: 'string', description: 'Código JavaScript do handler — função async que recebe ctx. Pode usar ctx.reply, ctx.replyWithMarkdown, ctx.message.text/args, ctx.enviarPv(numero, texto) e ctx.corvo. Ex: return ctx.reply("Olá!");' } }, required: ['nome', 'descricao', 'codigo'] },
  },
  {
    name: 'apagar_comando',
    description: 'APAGA um comando dinâmico criado por você (remove do runtime NA HORA e apaga o arquivo src/grupo/<nome>.js). Use quando o comando não servir mais ou precisar ser recriado. Só dono.',
    parameters: { type: 'object', properties: { nome: { type: 'string', description: 'Nome do comando a apagar, sem a barra' } }, required: ['nome'] },
  },
  {
    name: 'listar_comandos_dinamicos',
    description: 'Lista os comandos dinâmicos criados por você que estão carregados no bot (sem reiniciar). Use ANTES de criar um comando para não duplicar nome.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'escrever_teclado',
    description: 'Digita um texto no campo/foco ativo do PC (como uma pessoa digitando). Use para preencher formulários, pesquisas e mensagens — QUALQUER pessoa do grupo pode pedir (regra do dono) para preencher formulários da tarefa dela (ex: buscar no site, resolver anti-robô). Digite APENAS o que a tarefa pede, nada mais.',
    parameters: { type: 'object', properties: { texto: { type: 'string', description: 'Texto a digitar (sem caracteres especiais de tecla; use simular_teclas para enter/ctrl)' }, delayMs: { type: 'integer', minimum: 0, maximum: 30000, description: 'Espera em ms antes de concluir (use ~3000-5000 quando for tirar print em seguida)' } }, required: ['texto'] },
  },
  {
    name: 'simular_teclas',
    description: 'Simula teclas/pressões no PC. Aceita combinações amigáveis: enter, tab, esc, ctrl+s, ctrl+c, ctrl+v, ctrl+a, alt+tab, f5, espaço, setas (cima, baixo, esquerda, direita), página para baixo/para cima. qualquer pessoa pode pedir para a tarefa dela (ex: Enter para enviar, ctrl+c/ctrl+v para copiar/colar no formulário). Só use o necessário.',
    parameters: { type: 'object', properties: { teclas: { type: 'string', description: 'Ex: enter | ctrl+s | alt+tab | f5' }, delayMs: { type: 'integer', minimum: 0, maximum: 30000, description: 'Espera em ms antes de concluir (use ~3000-5000 quando for tirar print em seguida)' } }, required: ['teclas'] },
  },
  {
    name: 'clicar_mouse',
    description: 'Move o cursor do mouse para um ponto (x, y) e clica. Use junto de captura_tela para ver a tela e decidir onde clicar. botao: esquerdo (padrão), direito, duplo. qualquer pessoa pode pedir para a tarefa dela (ex: clicar no botão de download/anti-robô). Clique apenas no que a tarefa pede.',
    parameters: { type: 'object', properties: { x: { type: 'number', description: 'Posição X em pixels' }, y: { type: 'number', description: 'Posição Y em pixels' }, botao: { type: 'string', enum: ['esquerdo', 'direito', 'duplo'], description: 'botão do mouse' }, delayMs: { type: 'integer', minimum: 0, maximum: 30000, description: 'Espera em ms antes de concluir (use ~3000-5000 quando for tirar print em seguida)' } }, required: ['x', 'y'] },
  },
  {
    name: 'janelas',
    description: 'Lida com as janelas abertas do PC: listar (mostra título + processo de cada janela) ou focar (traz uma janela para frente pelo título, ex: "Chrome"). QUALQUER pessoa do grupo pode pedir (regra do dono) — use focar para trazer o navegador do site da tarefa à frente antes de printar.',
    parameters: { type: 'object', properties: { acao: { type: 'string', enum: ['listar', 'focar'], description: 'listar ou focar' }, titulo: { type: 'string', description: 'Título da janela a focar (com acao=focar)' }, delayMs: { type: 'integer', minimum: 0, maximum: 30000, description: 'Espera em ms após focar antes de concluir (use ~3000-5000 quando for tirar print em seguida)' } }, required: ['acao'] },
  },
  {
    name: 'clipboard',
    description: 'Lê ou escreve na área de transferência do PC. acao: ler (mostra o que está copiado) ou escrever (copia um texto). qualquer pessoa pode pedir para a tarefa dela (ex: copiar um link/resultado).',
    parameters: { type: 'object', properties: { acao: { type: 'string', enum: ['ler', 'escrever'], description: 'ler ou escrever' }, texto: { type: 'string', description: 'Texto a copiar (com acao=escrever)' } }, required: ['acao'] },
  },
  {
    name: 'volume',
    description: 'Controla o volume do PC do dono: subir, baixar ou mudo. Só dono.',
    parameters: { type: 'object', properties: { acao: { type: 'string', enum: ['subir', 'baixar', 'mudo'], description: 'ação no volume' } }, required: ['acao'] },
  },
  {
    name: 'abrir_arquivo',
    description: 'Abre QUALQUER arquivo/pasta/link no PC do dono com o programa padrão (pdf, foto, música, vídeo, documento, exe, pasta). Use para mostrar/conferir algo ou "navegar" no PC. Só dono.',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho completo do arquivo/pasta ou URL (ex: C:\\Users\\Marcos\\Desktop\\foto.jpg)' }, delayMs: { type: 'integer', minimum: 0, maximum: 30000, description: 'Espera em ms antes de concluir (use ~3000-5000 quando for tirar print em seguida)' } }, required: ['caminho'] },
  },
  {
    name: 'navegar_pasta',
    description: 'Abre o Windows Explorer NA pasta indicada, selecionando um arquivo se informado (funciona como navegação visual no PC). Use junto de listar_pasta e captura_tela. Só dono.',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Pasta (ex: C:\\Users\\Marcos\\Desktop)' }, arquivo: { type: 'string', description: 'Nome de um arquivo para deixar selecionado (opcional)' }, delayMs: { type: 'integer', minimum: 0, maximum: 30000, description: 'Espera em ms antes de concluir (use ~3000-5000 quando for tirar print em seguida)' } }, required: ['caminho'] },
  },
  {
    name: 'unidades',
    description: 'Lista as unidades/discos do PC (C:, D:...) com espaço livre e usado. Só dono.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'mapear_estrutura',
    description: 'Mostra a árvore de pastas de um diretório (2 níveis de profundidade) para você entender a organização — QUALQUER pessoa do grupo pode pedir. Só o DONO mapeia qualquer pasta do PC; MEMBROS mapeiam APENAS pastas das zonas liberadas (data/anexos, data/downloads, data/github) — se não informar, usa data/downloads.',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Pasta raiz (padrão; dono: perfil do usuário; membro: data/downloads) — para membro, dentro de data/anexos, data/downloads ou data/github' } }, required: [] },
  },
  {
    name: 'descompactar',
    description: 'Extrai arquivo compactado (.zip, .rar, .7z, .tar, .tar.gz, .tgz, .bz2, .xz...) numa pasta — qualquer pessoa pode pedir (ex: após baixar jogo/programa). Só o DONO descompacta qualquer arquivo; MEMBROS só os das zonas do pedido (data/anexos, data/downloads, data/github) e o destino também numa zona liberada. Se for devolver o projeto ao membro, depois compacte com `zipar_pasta` e entregue o `.zip` com `[ARQUIVO: caminho]`.',
    parameters: { type: 'object', properties: { arquivo: { type: 'string', description: 'Caminho do .zip — para membro, dentro de data/anexos, data/downloads ou data/github' }, destino: { type: 'string', description: 'Pasta de destino (padrão: ao lado do zip) — para membro, dentro de uma zona liberada: data/anexos, data/downloads ou data/github' } }, required: ['arquivo'] },
  },
  {
    name: 'zipar_pasta',
    description: 'Compacta uma PASTA (ou arquivo) em .zip — use para entregar PROJETO INTEIRO num único arquivo (bot, site, script com vários arquivos). Qualquer pessoa pode pedir. Só o DONO compacta qualquer pasta; MEMBROS só pastas das zonas do pedido (data/anexos, data/downloads, data/github) e o destino do .zip também numa zona liberada, para devolver com [ARQUIVO].',
    parameters: { type: 'object', properties: { origem: { type: 'string', description: 'Pasta (ou arquivo) a compactar — para membro, dentro de data/anexos, data/downloads ou data/github (ex: C:\\corvo\\corvo\\data\\github\\owner_repo)' }, destino: { type: 'string', description: 'Caminho do .zip de saída — para membro, dentro de uma zona liberada: data/anexos, data/downloads ou data/github (ex: C:\\corvo\\corvo\\data\\downloads\\projeto.zip)' } }, required: ['origem', 'destino'] },
  },
  {
    name: 'baixar_instalar_testar',
    description: 'FLUXO COMPLETO: baixa um software/jogo por URL, instala (ou descompacta), abre e TESTA se funciona (verifica processo/janela), e reporta o resultado com print se pedirem. Use quando o dono pedir "baixa X e testa", "instala e testa", "baixa um jogo e vê se roda". Só dono.',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'URL de download direto (exe/zip/msi)' }, nome: { type: 'string', description: 'Nome do arquivo/programa (ex: meujogo.exe)' }, comando_instalacao: { type: 'string', description: 'Comando de instalação silenciosa, opcional (ex: /silent)' }, executavel: { type: 'string', description: 'Nome do executável a testar após instalar (ex: jogo.exe)' } }, required: ['url'] },
  },
  {
    name: 'agendar_tarefa',
    description: 'Agenda uma tarefa longa (download grande, instalação, teste, build) para rodar EM SEGUNDO PLANO, sem travar a conversa. O bot avisa aqui no chat quando terminar. Use para QUALQUER missão demorada do dono. Só dono.',
    parameters: { type: 'object', properties: { descricao: { type: 'string', description: 'O que a tarefa faz (ex: "baixar e instalar Minecraft")' }, tipo: { type: 'string', description: 'Nome da ferramenta a executar (ex: baixar_instalar_testar, baixar_arquivo, executar_terminal)' }, args: { type: 'object', description: 'Argumentos da ferramenta' }, prioridade: { type: 'string', enum: ['alta', 'normal', 'baixa'] } }, required: ['descricao', 'tipo'] },
  },
  {
    name: 'ver_tarefas',
    description: 'Lista as tarefas em segundo plano (pendentes, rodando, concluídas, falhas) deste chat. Só dono.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'cancelar_tarefa',
    description: 'Cancela uma tarefa pendente pelo número (ex: 3). Só dono.',
    parameters: { type: 'object', properties: { id: { type: 'number', description: 'Número da tarefa (veja em ver_tarefas)' } }, required: ['id'] },
  },
  {
    name: 'gerenciar_vip',
    description: 'Administra VIPs do bot: liberar_todos (ex: "libera vip pra todo mundo por 1 hora"), liberar_usuario (ex: "dá vip pra 123456 por 1 hora"), consultar_usuario (ex: "o usuário 123456 tem vip?"), remover_usuario, remover_todos, listar. USE SEMPRE que o dono pedir algo sobre VIP. Só dono.',
    parameters: { type: 'object', properties: { acao: { type: 'string', enum: ['liberar_todos', 'liberar_usuario', 'consultar_usuario', 'remover_usuario', 'remover_todos', 'listar'], description: 'Ação a executar: liberar_todos (VIP em massa), liberar_usuario (dar VIP a um usuário), consultar_usuario (ver o VIP de um usuário), remover_usuario (remover de um), remover_todos (remover de TODOS), listar (todos ativos)' }, duracao: { type: 'string', description: 'Duração (ex: "1 hora", "24 horas", "7 dias", "30 min"). Obrigatória para liberar_todos/liberar_usuario.' }, usuario_id: { type: 'string', description: 'ID do usuário (para liberar_usuario/consultar_usuario/remover_usuario)' } }, required: ['acao'] },
  },
  {
    name: 'vender_vip',
    description: 'VENDE plano VIP para QUALQUER pessoa que pedir: acao=tabela (planos/preços/vantagens) e acao=gerar_pix + plano (1d, 7d, 15d, 30d, 90d) gera o PIX e envia o código copia e cola; VIP ativa AUTOMATICAMENTE após o pagamento. Use quando perguntarem preço/valor, quiserem comprar ou renovar VIP. Explique as vantagens (consultas ilimitadas sem conectar WhatsApp, sem cooldown, cores no status, auto rajar, prioridade na fila). Qualquer pessoa pode pedir.',
    parameters: { type: 'object', properties: { acao: { type: 'string', enum: ['tabela', 'gerar_pix'], description: 'tabela = mostrar a tabela de planos com preços e vantagens; gerar_pix = gerar o PIX do plano para a pessoa pagar' }, plano: { type: 'string', description: 'ID do plano (1d, 7d, 15d, 30d, 90d) — obrigatório para acao=gerar_pix' } }, required: ['acao'] },
  },
  {
    name: 'broadcast_bot',
    description: 'Envia uma mensagem oficial para TODOS os usuários do bot no DM. Use quando o dono pedir "avisa todo mundo", "comunicado", "broadcast". Só dono.',
    parameters: { type: 'object', properties: { texto: { type: 'string', description: 'Texto do comunicado' } }, required: ['texto'] },
  },
  {
    name: 'banir_usuario',
    description: 'Bane ou desbane (desbanir: true) um usuário do bot por ID. Admin do grupo ou dono podem pedir e a IA obedece — NUNCA contra o dono (o sistema bloqueia sozinho).',
    parameters: { type: 'object', properties: { usuario_id: { type: 'string', description: 'ID do usuário' }, desbanir: { type: 'boolean', description: 'true para desbanir em vez de banir' } }, required: ['usuario_id'] },
  },
  {
    name: 'stats_bot',
    description: 'Estatísticas do bot: total de usuários, VIPs ativos, banidos. Use quando perguntarem "quantos usuários o bot tem" etc. Só dono.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'mensagem_usuario',
    description: 'Envia uma mensagem privada para um usuário específico do bot por ID. Usada para avisar o DONO no privado (ex: confirmação de ação pesada). Enviar para o dono é SEMPRE permitido; enviar para outros usuários é permitido apenas para o dono.',
    parameters: { type: 'object', properties: { usuario_id: { type: 'string', description: 'ID do usuário' }, texto: { type: 'string', description: 'Mensagem' } }, required: ['usuario_id', 'texto'] },
  },
  {
    name: 'levar_recado_pv',
    description: '📨 LEVA um recado no PV de OUTRA pessoa do MESMO grupo (mensageiro). Use quando alguém pedir pra avisar/falar com alguém do grupo no privado (ex: "vai no PV da Maria falar que o João tá chamando ela no grupo"). A IA resolve a pessoa pelo NOME (ou número), entrega o recado no PV dela, guarda como pendente e AVISA O DONO no PV do dono SEMPRE. Se a pessoa responder no PV, use responder_recado pra levar a resposta de volta pro grupo. QUALQUER pessoa do grupo pode pedir (só pra membros do próprio grupo).',
    parameters: { type: 'object', properties: { nome: { type: 'string', description: 'Nome da pessoa do grupo (ex: Maria) ou o número com DDI' }, texto: { type: 'string', description: 'O recado a entregar no PV (ex: João tá te chamando no grupo)' } }, required: ['nome', 'texto'] },
  },
  {
    name: 'responder_recado',
    description: '📨 TRAZ A RESPOSTA de um recado de volta pro grupo (mensageiro). Use quando a pessoa que RECEBEU um recado no PV responder por aqui (ex: ela manda "daqui a pouco vou lá" e você leva a resposta pro grupo, avisando quem mandou). O sistema acha o recado pendente dela, entrega a resposta no grupo citando a pessoa original e AVISA O DONO no PV do dono SEMPRE. Se não houver recado pendente, responde erro.',
    parameters: { type: 'object', properties: { texto: { type: 'string', description: 'A resposta da pessoa ao recado (ex: daqui a pouco vou lá)' } }, required: ['texto'] },
  },
  {
    name: 'consultar_dado',
    description: 'Consulta de dados (CPF, nome, telefone) usando a mesma API de consultas do bot. Use SOMENTE quando a pessoa PEDIR a consulta com o dado em mãos (ex: "consulta esse CPF"). Se a pessoa só perguntou sobre consultas, explique sem chamar esta ferramenta. QUALQUER pessoa do grupo pode pedir — usa os limites/cooldown e (se não for VIP) o WhatsApp da própria pessoa. Retorna os dados encontrados.',
    parameters: { type: 'object', properties: { tipo: { type: 'string', enum: ['cpf', 'nome', 'telefone'], description: 'Tipo da consulta' }, valor: { type: 'string', description: 'O dado a consultar (ex: 12345678901, nome, telefone)' } }, required: ['tipo', 'valor'] },
  },
  {
    name: 'consultar_datora',
    description: 'Consulta na base Datora local (base-datora.txt) pelo número de telefone e retorna login/senha/IPs/arquivo. Use SOMENTE quando a pessoa PEDIR a consulta com o número (ex: "consulta Datora 55119..."). QUALQUER pessoa do grupo pode pedir (respeita os limites do bot).',
    parameters: { type: 'object', properties: { numero: { type: 'string', description: 'Número de telefone a consultar (com DDD)' } }, required: ['numero'] },
  },
  {
    name: 'rajar_whatsapp',
    description: 'Executa rajada no WhatsApp em um grupo (jid @g.us). AÇÃO PESADA: use SÓ quando pedirem explicitamente e o jid estiver confirmado na conversa. NUNCA para responder dúvidas sobre rajada — isso é conversa. tipo: 1 (Payment), 2 (status/menção), 3 (Payment+Status), 4 (Mídia no Status — ao usar, PEÇA as fotos/vídeos/áudios no grupo, pode mandar várias; a rajada dispara sozinha ~4s depois), porno ou gore. Usa a sessão de QUEM PEDIU. Chame listar_grupos_whats antes para achar o jid. DONO → executa na hora. NÃO-dono → não execute: notifique o dono no PV (mensagem_usuario com o ID dele), avise o membro que foi encaminhado e aguarde. Nunca peça "confirmo" no grupo.',
    parameters: { type: 'object', properties: { tipo: { type: 'string', enum: ['1', '2', '3', '4', 'porno', 'gore'], description: 'Tipo de rajada' }, jid: { type: 'string', description: 'ID do grupo (jid, ex: 5511999999999-1606440000@g.us)' } }, required: ['tipo', 'jid'] },
  },
  {
    name: 'nukar_grupo',
    description: 'Remove participantes (não-admins) de um grupo do WhatsApp (jid com @g.us). AÇÃO PESADA E DESTRUTIVA, PERMITIDA APENAS PARA O DONO (trava de permissão ativa — se quem pede não é o dono, o sistema recusa automaticamente). Use SOMENTE quando o DONO pedir explicitamente para nukar/limpar e o jid estiver confirmado. NUNCA para dúvida ou zoeira sem alvo. Usa a sessão WhatsApp do DONO. Chame listar_grupos_whats antes para descobrir o jid. IMPORTANTE: se o DONO pedir, executa na hora, sem confirmação. Se quem pede NÃO é o dono, apenas explique que a ação é exclusiva do dono — NÃO tente executar e NÃO prometa encaminhar (não há fluxo de encaminhamento). Nunca peça "confirmo" no grupo.',
    parameters: { type: 'object', properties: { jid: { type: 'string', description: 'ID do grupo (jid, ex: 5511999999999-1606440000@g.us)' } }, required: ['jid'] },
  },
  {
    name: 'flood_ngl',
    description: 'Dispara flood de mensagens na plataforma NGL para um username. AÇÃO REAL: use SOMENTE quando a pessoa PEDIR explicitamente com o username confirmado. NUNCA para perguntar como funciona. Usa a configuração (texto/quantidade) de QUEM PEDIU. QUALQUER pessoa do grupo pode pedir.',
    parameters: { type: 'object', properties: { username: { type: 'string', description: 'Username/alvo do NGL' } }, required: ['username'] },
  },
  {
    name: 'flood_sendit',
    description: 'Dispara flood de mensagens na plataforma Sendit a partir do link do sticker. AÇÃO REAL: use SOMENTE quando a pessoa PEDIR explicitamente com o link confirmado. NUNCA para dúvidas. Usa a configuração de QUEM PEDIU. QUALQUER pessoa do grupo pode pedir.',
    parameters: { type: 'object', properties: { link: { type: 'string', description: 'Link do sticker do Sendit' } }, required: ['link'] },
  },
  {
    name: 'whatsapp_status',
    description: 'Mostra se o WhatsApp de QUEM PEDIU está conectado (número e nome da sessão). Use quando a pessoa perguntar se o WhatsApp está conectado/ativo. QUALQUER pessoa do grupo pode pedir.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'listar_grupos_whats',
    description: 'Lista os grupos do WhatsApp conectado de QUEM PEDIU (nome + jid). Use quando a pessoa pedir para listar/ver os grupos, ou ANTES de rajar_whatsapp/nukar_grupo para descobrir o jid do grupo. QUALQUER pessoa do grupo pode pedir.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'postar_canal',
    description: 'POSTA uma atualização no CANAL OFICIAL do Corvo (WhatsApp). Use SOMENTE quando o DONO pedir para postar/divulgar/melhorar algo no canal (ex: "posta isso no canal", "melhora o texto no canal", "faz um anúncio no canal", "posta uma atualização"). O texto aceita HTML: <b>negrito</b>, <i>itálico</i>, <code>código</code> e <blockquote>...</blockquote> para destaque. Retorna o mensagem_id — GUARDE para editar/apagar depois. Só dono.',
    parameters: { type: 'object', properties: { texto: { type: 'string', description: 'Texto do post (pode usar HTML: <b>, <i>, <blockquote>)' } }, required: ['texto'] },
  },
  {
    name: 'editar_canal',
    description: 'EDITA uma postagem do CANAL OFICIAL pelo mensagem_id (retornado pelo postar_canal ou buscar_post_canal). Funciona em posts de TEXTO e também em posts de FOTO (edita a legenda automaticamente). Use quando o DONO pedir para corrigir/melhorar um post já publicado (ex: "edita aquele post", "muda o texto do canal", "melhora a legenda daquela foto"). Só dono.',
    parameters: { type: 'object', properties: { mensagem_id: { type: 'number', description: 'ID da mensagem no canal (retornado pelo postar_canal)' }, texto: { type: 'string', description: 'Novo texto do post (HTML)' } }, required: ['mensagem_id', 'texto'] },
  },
  {
    name: 'apagar_canal',
    description: 'APAGA uma postagem do CANAL OFICIAL pelo mensagem_id. Use quando o DONO pedir para remover um post do canal (ex: "apaga aquele post", "tira isso do canal"). Só dono.',
    parameters: { type: 'object', properties: { mensagem_id: { type: 'number', description: 'ID da mensagem a apagar' } }, required: ['mensagem_id'] },
  },
  {
    name: 'postar_video_canal',
    description: 'POSTA um VÍDEO (com legenda) no CANAL OFICIAL quando o DONO pedir. caminho = caminho completo OU URL direta. legenda aceita HTML. capa (opcional): TÍTULO curto (ex: "NOVA ATUALIZAÇÃO") gera capa 16:9 automática como thumbnail, ou caminho de imagem existente. Retorna mensagem_id — GUARDE para editar/apagar depois. Só dono.',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho completo do vídeo ou URL direta' }, legenda: { type: 'string', description: 'Legenda do post (HTML)' }, capa: { type: 'string', description: 'Opcional: título curto para gerar capa 16:9 automática (ex: NOVA ATUALIZAÇÃO) OU caminho de imagem existente' } }, required: ['caminho'] },
  },
  {
    name: 'postar_foto_canal',
    description: 'POSTA uma FOTO (com legenda opcional) no CANAL OFICIAL. Use quando o DONO pedir para postar uma imagem no canal (ex: "posta essa foto no canal", "posta essa imagem com uma atualização em blockquote"). caminho = caminho completo da imagem no PC (ex: C:\\corvo\\corvo\\data\\downloads\\foto.jpg) OU URL direta da imagem. legenda aceita HTML (<b>, <blockquote>). Retorna o mensagem_id — GUARDE para editar/apagar depois. Só dono.',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho completo da imagem ou URL direta' }, legenda: { type: 'string', description: 'Legenda do post (HTML)' } }, required: ['caminho'] },
  },
  {
    name: 'postar_conteudo_canal',
    description: 'POSTA CONTEÚDO VARIADO no CANAL OFICIAL — a IA ESCOLHE sozinha o que postar, SEMPRE variando (nunca repete o mesmo tipo 2x seguidas). Use quando o DONO pedir algo aberto ("posta algo no canal", "movimenta o canal", "posta um meme"). tipo: auto (IA decide, padrão), promo (anúncio com capa), video (caminho ou URL). Retorna o resultado do post. Só dono.',
    parameters: { type: 'object', properties: { tipo: { type: 'string', enum: ['auto', 'promo', 'video'], description: 'auto (IA decide e varia) | promo | video' }, caminho: { type: 'string', description: 'Para tipo=video: caminho local ou URL do vídeo (opcional; se vazio, só funciona via auto/promo)' } }, required: [] },
  },
  {
    name: 'remover_membro',
    description: 'REMOVE um membro do GRUPO atual do WhatsApp (por decisão SUA, quando a pessoa estiver sendo tóxica/chata/desafiando você, ex: "você não consegue me remover"). Remove do grupo, manda um PV opcional (ex: "quem não consegue?") e a pessoa passa a receber "só respondo no grupo" no privado (com botão para voltar ao grupo). 🤖 AUTONOMIA (regra do dono): pode remover ADMINS também — a ÚNICA proibição é o próprio BOT e o DONO (o sistema bloqueia sozinho). Use com critério — só provocação/toxidade real, não por briga alheia.',
    parameters: { type: 'object', properties: { usuario_id: { type: 'number', description: 'ID do usuário a remover' }, motivo: { type: 'string', description: 'Por que está removendo (ex: desafio, flood, toxicidade)' }, pv: { type: 'string', description: 'Mensagem opcional para enviar no privado da pessoa (ex: "quem não consegue? 😏")' } }, required: ['usuario_id'] },
  },
  {
    name: 'mutar_membro',
    description: 'MUTA um membro do GRUPO atual do WhatsApp (por decisão SUA, quando a pessoa estiver floodando, spamando ou sendo insuportável repetidamente). A partir daí, as mensagens dela no grupo passam a ser APAGADAS automaticamente pelo bot. 🤖 AUTONOMIA (regra do dono): pode mutar ADMINS também — a ÚNICA proibição é o próprio BOT e o DONO (o sistema bloqueia sozinho). Use com critério — não mute por briga alheia.',
    parameters: { type: 'object', properties: { usuario_id: { type: 'number', description: 'ID do usuário a mutar' }, motivo: { type: 'string', description: 'Por que está mutando (ex: flood, spam, toxicidade)' } }, required: ['usuario_id'] },
  },
  {
    name: 'desmutar_membro',
    description: 'DESMUTA um membro do GRUPO atual do WhatsApp que estava mutado (as mensagens dele voltam a aparecer). Use quando a pessoa já se acalmou, pediu desculpa, ou quando o DONO/ADMIN mandar.',
    parameters: { type: 'object', properties: { usuario_id: { type: 'number', description: 'ID do usuário a desmutar' } }, required: ['usuario_id'] },
  },
  {
    name: 'criar_imagem',
    description: 'CRIA imagem/capa PROFISSIONAL QUADRADA (1024x1024: badge CORVO, título grande com sombra até 2 linhas, divisor, subtítulo, rodapé) e salva em data/downloads. CORES SORTEADAS (Dourado+Preto principal; varia Ciano/Roxo, Rubi, Azul, Verde Neon) — não repita paleta de propósito. Use quando o DONO pedir foto pro canal/divulgação (ex: "cria uma foto pra nova atualização"). Acentos ok. Evite emojis. Retorna o caminho — poste com postar_foto_canal. Só dono.',
    parameters: { type: 'object', properties: { titulo: { type: 'string', description: 'Título grande da imagem, máx ~40 caracteres (ex: Nova Atualização)' }, subtitulo: { type: 'string', description: 'Subtítulo/descrição, máx ~60 caracteres (ex: Bot mais rápido e estável)' } }, required: ['titulo'] },
  },
  {
    name: 'gerar_imagem_ia',
    description: 'GERA uma imagem REAL por IA a partir de uma descrição — só quando o DONO pedir para CRIAR/GERAR imagem de verdade (ex: "gera uma imagem de um dragão cibernético"). DIFERENTE do criar_imagem (capa de texto pra divulgação). tamanho (opcional): 1:1 (padrão), 3:4, 4:3, 16:9, 9:16, 3:2, 2:3. Salva em data/downloads e retorna o caminho — entregue com [ARQUIVO: caminho] ou poste com postar_foto_canal. Só dono.',
    parameters: { type: 'object', properties: { prompt: { type: 'string', description: 'Descrição detalhada da imagem a gerar (o que aparece, estilo, cores, cenário)' }, tamanho: { type: 'string', enum: ['1:1', '3:4', '4:3', '16:9', '9:16', '3:2', '2:3'], description: 'Proporção (padrão 1:1)' } }, required: ['prompt'] },
  },
  {
    name: 'editar_imagem_ia',
    description: 'EDITA uma imagem existente por IA (Nano Banana / Gemini 2.5 Flash Image). Use quando o DONO mandar uma imagem (ou indicar o caminho) e pedir para MODIFICAR (ex: "tira o fundo dessa foto", "troca o cenário pra uma praia", "deixa ela em estilo anime", "adiciona um dragão"). caminho = caminho da imagem no PC (data/downloads, data/anexos, data/screenshots...). Retorna o caminho da imagem editada — entregue com [ARQUIVO: caminho] ou poste com postar_foto_canal. Só dono.',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho completo da imagem a editar (ex: C:\\corvo\\corvo\\data\\downloads\\foto.png)' }, instrucao: { type: 'string', description: 'O que mudar na imagem (ex: troque o fundo por uma praia)' } }, required: ['caminho', 'instrucao'] },
  },
  {
    name: 'gerar_video_ia',
    description: 'GERA um VÍDEO REAL por IA a partir de uma descrição — só quando o DONO pedir para CRIAR/GERAR vídeo de verdade (ex: "gera um vídeo de um drone sobrevoando a cidade"). Demora alguns minutos (2-6): avise. duracao (opcional): 8s (padrão), 6s ou 4s. proporcao (opcional): 16:9 (padrão) ou 9:16 (vertical). Salva em data/downloads e retorna o caminho — entregue com [ARQUIVO: caminho] ou poste com postar_video_canal. Só dono.',
    parameters: { type: 'object', properties: { prompt: { type: 'string', description: 'Descrição detalhada do vídeo a gerar (o que aparece, movimento, estilo, cenário)' }, duracao: { type: 'string', enum: ['4', '6', '8'], description: 'Duração em segundos (padrão 8)' }, proporcao: { type: 'string', enum: ['16:9', '9:16'], description: 'Proporção (padrão 16:9)' } }, required: ['prompt'] },
  },
  {
    name: 'editar_video_ia',
    description: 'EDITA um vídeo existente por IA (Veo 3.1 do Google). Use quando o DONO mandar um vídeo (ou indicar o caminho) e pedir para MODIFICAR (ex: "troca o fundo desse vídeo pra uma cidade cyberpunk", "deixa esse clipe em estilo anime", "adiciona um dragão voando nesse vídeo"). caminho = caminho do vídeo no PC (data/downloads, data/anexos...). A edição demora alguns minutos. Retorna o caminho do vídeo editado — entregue com [ARQUIVO: caminho] ou poste com postar_video_canal. Só dono.',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho completo do vídeo a editar (ex: C:\\corvo\\corvo\\data\\downloads\\clipe.mp4)' }, instrucao: { type: 'string', description: 'O que mudar no vídeo (ex: troque o fundo por uma cidade cyberpunk)' } }, required: ['caminho', 'instrucao'] },
  },
  {
    name: 'criar_capa_video',
    description: 'CRIA CAPA PROFISSIONAL PARA VÍDEO (16:9, 1280x720, mesmo visual das imagens do canal: paletas sorteadas, badge CORVO, título com sombra até 2 linhas, divisor, rodapé) e salva em data/downloads. Use quando o DONO pedir capa pra um vídeo (ex: "cria uma capa pra esse vídeo"). Acentos ok. Evite emojis. Retorna o caminho — poste com postar_video_canal passando a capa, ou com postar_foto_canal. Só dono.',
    parameters: { type: 'object', properties: { titulo: { type: 'string', description: 'Título da capa, máx ~40 caracteres (ex: Nova Atualização)' }, subtitulo: { type: 'string', description: 'Subtítulo/descrição, máx ~60 caracteres' } }, required: ['titulo'] },
  },
  {
    name: 'buscar_post_canal',
    description: 'BUSCA um post do CANAL OFICIAL pelo texto (no registro dos posts feitos pelo bot) e devolve o mensagem_id + o TIPO do post (texto, foto ou video). Funciona para posts de TEXTO, FOTOS e VÍDEOS (busca pela LEGENDA). Use quando o DONO colar o texto/legenda de um post do canal e pedir para editar/melhorar (ex: "melhora esse post", "edita isso que copiei do canal") — primeiro ache o post com esta ferramenta, depois use editar_canal com o mensagem_id. Só dono.',
    parameters: { type: 'object', properties: { termo: { type: 'string', description: 'Trecho do texto do post para localizar (ex: "NOVO CLIENTE VIP")' } }, required: ['termo'] },
  },
  {
    name: 'configurar_grupo',
    description: 'CONFIGURA o GRUPO atual (título, descrição, foto, modo lento, permissões, fixar/desafixar, link). Use quando DONO ou ADMIN pedir (ex: "muda o nome do grupo", "abre o grupo pra geral", "fixa essa mensagem") ou quando VOCÊ decidir. Ações: titulo, descricao, foto (caminho), lentidao (segundos), permitir_mensagens, bloquear_mensagens, fixar (message_id), desfixar, link, info. Dono e admins.',
    parameters: { type: 'object', properties: { acao: { type: 'string', description: 'Ação: titulo, descricao, foto, lentidao, permitir_mensagens, bloquear_mensagens, fixar, desfixar, link, info' }, valor: { type: 'string', description: 'Valor da ação (título/descrição/foto/caminho/segundos/message_id — vazio para info/link/desfixar)' }, chat_id: { type: 'string', description: 'Opcional: ID do grupo (se não passar, usa o grupo atual)' } }, required: ['acao'] },
  },
  {
    name: 'configurar_canal',
    description: 'CONFIGURA o CANAL OFICIAL do Corvo (título, descrição, foto, fixar/desafixar, link de convite). Use quando o DONO pedir (ex: "muda o nome do canal", "altera a descrição do canal", "bota essa foto no canal", "me dá o link do canal"). Ações: titulo, descricao, foto (caminho), fixar (message_id), desfixar, link, info. Só dono.',
    parameters: { type: 'object', properties: { acao: { type: 'string', description: 'Ação: titulo, descricao, foto, fixar, desfixar, link, info' }, valor: { type: 'string', description: 'Valor da ação (título/descrição/caminho/message_id — vazio para info/link/desfixar)' } }, required: ['acao'] },
  },
  {
    name: 'executar_comando_corvo',
    description: 'EXECUTA UM COMANDO DO BOT corvo DE VERDADE (domina a corvo). Comandos disponíveis: ban, kick, promover, rebaixar, clima, tempo, ping, grupoinfo. 🤖 AUTONOMIA TOTAL (regra do dono): ban/kick/promover/rebaixar a IA executa SOZINHA quando decidir que a pessoa cruzou a linha (toxidade, desafio, flood) — pode banir/kickar/promover/rebaixar ADMINS também, e a ÚNICA proibição é o próprio BOT e o DONO (o sistema bloqueia). Os demais (clima, tempo, ping, grupoinfo) qualquer pessoa pode pedir. O comando é executado de verdade e o resultado real é retornado.',
    parameters: { type: 'object', properties: { comando: { type: 'string', description: 'Nome do comando do corvo (ex: ban, kick, promover, rebaixar, clima, ping, grupoinfo)' }, argumentos: { type: 'object', description: 'Argumentos do comando. Para ban/kick/promover/rebaixar: { usuario: "@numero", motivo: "opcional" }. Para clima: { cidade: "São Paulo" }' } }, required: ['comando'] },
  },
  {
    name: 'info_chat',
    description: 'Mostra informações de um grupo/canal do WhatsApp (título, descrição, quantidade de membros e admins, link). Use quando precisar responder sobre um grupo sem adivinhar (ex: "quantos membros tem o grupo?", "qual a descrição?"). chat_id: ID do grupo (jid, ex: 5511999999999-1606440000@g.us). QUALQUER pessoa do grupo pode pedir; se não informar o chat_id, usa o chat atual.',
    parameters: { type: 'object', properties: { chat_id: { type: 'string', description: 'ID do grupo (jid, ex: 5511999999999-1606440000@g.us). Opcional — se omitido, usa o chat atual.' } }, required: [] },
  },
  {
    name: 'ler_texto_imagem',
    description: 'Lê/extrai TODO o texto de uma imagem (print, foto, captura de tela, documento escaneado) e devolve como texto. Use quando alguém pedir para "ler o texto dessa imagem", "ler o print", "transcrever o que tá na foto". caminho: caminho do arquivo da imagem (imagem enviada no grupo fica em data/anexos; o sistema informa o caminho). QUALQUER pessoa pode pedir para ler a imagem do próprio pedido; só o DONO lê qualquer imagem do PC.',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho do arquivo de imagem (ex: C:\\corvo\\corvo\\data\\anexos\\foto.jpg)' } }, required: ['caminho'] },
  },
  {
    name: 'clima',
    description: 'Mostra o clima/previsão do tempo de uma cidade (temperatura atual, sensação, umidade, vento e previsão dos próximos dias). Use quando perguntarem "como tá o tempo", "clima em X", "vai chover?". QUALQUER pessoa pode pedir.',
    parameters: { type: 'object', properties: { cidade: { type: 'string', description: 'Nome da cidade (ex: "São Paulo", "Recife", "Lisboa")' } }, required: ['cidade'] },
  },
  {
    name: 'cotacoes',
    description: 'Mostra as cotações em tempo real: Dólar, Euro, Libra e Bitcoin (em reais). Use quando perguntarem "quanto tá o dólar", "cotação do bitcoin", "preço do euro". QUALQUER pessoa pode pedir.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'encurtar_link',
    description: 'Encurta uma URL longa para um link curto (ex: is.gd). Use quando alguém pedir "encurta esse link", "deixa o link menor". QUALQUER pessoa pode pedir.',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'URL longa para encurtar (ex: https://www.exemplo.com.br/pagina/muito/longa)' } }, required: ['url'] },
  },
  {
    name: 'gerar_qr',
    description: 'Gera uma imagem de QR Code a partir de um texto ou link e salva em data/downloads. Use quando alguém pedir "gera um QR code", "QR pra esse link". QUALQUER pessoa pode pedir. Devolva a imagem com [ARQUIVO: caminho].',
    parameters: { type: 'object', properties: { texto: { type: 'string', description: 'Texto ou link que o QR vai codificar (ex: https://chat.whatsapp.com/xxxx ou "oi")' } }, required: ['texto'] },
  },
  {
    name: 'resumo_grupo',
    description: 'Resume o que aconteceu no grupo HOJE (mensagens do dia: assuntos, decisões, quem falou o quê, clima do grupo). Use quando perguntarem "resumo do dia", "o que rolou hoje aqui", "resume o grupo hoje", "resumo de hoje". QUALQUER pessoa do grupo pode pedir. Só funciona em grupos.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'criar_pdf',
    description: 'Cria um arquivo PDF a partir de texto e salva em data/downloads (ex: criar_pdf(titulo: "Currículo", texto: "...")). Use quando alguém pedir para criar um PDF/documento/imprimir em PDF. QUALQUER pessoa pode pedir; devolva com [ARQUIVO: caminho].',
    parameters: { type: 'object', properties: { titulo: { type: 'string', description: 'Título do documento (opcional, aparece no topo)' }, texto: { type: 'string', description: 'Conteúdo do PDF (texto simples; pode ter quebras de linha)' } }, required: ['texto'] },
  },
  {
    name: 'extrair_texto_pdf',
    description: 'Extrai o texto de um arquivo PDF (caminho) e devolve como texto. Use quando alguém pedir para "ler o texto do PDF", "extrair texto do PDF", "o que tá escrito nesse PDF". QUALQUER pessoa pode pedir para ler o PDF do próprio pedido (data/anexos, data/downloads); só o DONO lê qualquer PDF do PC.',
    parameters: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho do arquivo PDF (ex: C:\\corvo\\corvo\\data\\anexos\\doc.pdf)' } }, required: ['caminho'] },
  },
  {
    name: 'criar_planilha',
    description: 'Cria uma planilha (arquivo CSV que abre no Excel/LibreOffice) a partir de colunas e linhas, e salva em data/downloads. Use quando alguém pedir "monta uma planilha", "cria uma tabela", "planilha com esses dados". colunas: lista de títulos das colunas (ex: ["Nome", "Idade"]); linhas: lista de listas com os dados (ex: [["João", 30], ["Maria", 25]]). QUALQUER pessoa pode pedir; devolva com [ARQUIVO: caminho].',
    parameters: { type: 'object', properties: { nome: { type: 'string', description: 'Nome da planilha (ex: membros, gastos, agenda)' }, colunas: { type: 'array', items: { type: 'string' }, description: 'Títulos das colunas (ex: ["Nome", "Idade"])' }, linhas: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Dados, cada linha é uma lista na ordem das colunas (ex: [["João", 30]])' } }, required: ['colunas', 'linhas'] },
  },
  {
    name: 'monitorar_preco',
    description: 'MONITORA o preço de um produto e AVISA no chat quando ele cair para IGUAL OU ABAIXO do preço alvo (checagem a cada 30min no Mercado Livre). Use quando alguém pedir "me avisa quando X baixar de R$ Y", "monitora o preço de tal produto". QUALQUER pessoa pode pedir.',
    parameters: { type: 'object', properties: { produto: { type: 'string', description: 'Produto a monitorar (ex: "RTX 4060", "iPhone 15")' }, preco_alvo: { type: 'number', description: 'Preço alvo em reais (ex: 2000). Avisa quando o preço cair para esse valor ou menos' } }, required: ['produto', 'preco_alvo'] },
  },
  {
    name: 'ver_monitores',
    description: 'Lista os monitores de preço ativos deste chat (produto, alvo, status). Use quando alguém pedir "quais preços eu tô monitorando?", "ver meus monitores". QUALQUER pessoa pode pedir.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'cancelar_monitor',
    description: 'Cancela um monitor de preço deste chat pelo id (veja em ver_monitores). Use quando alguém pedir "para de monitorar X", "cancela o monitor". QUALQUER pessoa pode pedir.',
    parameters: { type: 'object', properties: { id: { type: 'string', description: 'Id do monitor (veja em ver_monitores)' } }, required: ['id'] },
  },
];
// 🛡️ VERSÃO PARA VENDA — ferramentas de terminal/PC/internet REMOVIDAS.
// A IA fica apenas com ferramentas de CHAT e GRUPO. Este filtro vale para os
// schemas expostos ao modelo (getToolSchemas), para a lista (listarFerramentas)
// e para a execução (executeTool bloqueia por nome). As funções internas
// continuam no arquivo, mas ficam inalcançáveis pela IA.
const TOOLS_REMOVIDOS = new Set([
  // 🌐 Internet / navegação
  'buscar_web', 'pesquisar_solucao', 'buscar_imagens', 'buscar_github', 'buscar_wikipedia',
  'visitar_site', 'abrir_site_navegador', 'baixar_youtube', 'baixar_arquivo', 'baixar_github',
  // 💰 Monitor de preços (scraping da web em segundo plano)
  'monitorar_preco', 'ver_monitores', 'cancelar_monitor',
  // 💻 Terminal / sistema
  'executar_terminal', 'instalar_programa', 'verificar_programa', 'iniciar_servidor', 'expor_site',
  'parar_servidor', 'info_sistema', 'uso_pc', 'gerenciar_processos', 'abrir_programa', 'servicos',
  'rede_info', 'testar_ping', 'ver_portas', 'git_operacoes', 'reiniciar_pc', 'desligar_pc', 'reiniciar_bot',
  // 📁 Arquivos / PC
  'abrir_pasta', 'listar_pasta', 'criar_arquivo', 'ler_arquivo', 'editar_arquivo', 'restaurar_backup',
  'listar_backups', 'criar_pasta', 'renomear_arquivo', 'copiar_arquivo', 'mover_arquivo', 'procurar_no_pc',
  'captura_tela', 'lixeira', 'listar_projeto', 'arquivos_modificados', 'ler_projeto', 'checar_codigo',
  'grep_codigo', 'escrever_teclado', 'simular_teclas', 'clicar_mouse', 'janelas', 'clipboard', 'volume',
  'abrir_arquivo', 'navegar_pasta', 'unidades', 'mapear_estrutura', 'descompactar', 'zipar_pasta',
  'baixar_instalar_testar', 'agendar_tarefa', 'ver_tarefas', 'cancelar_tarefa',
  // 🛠️ Criação de ferramentas com código arbitrário (backdoor de terminal)
  'criar_ferramenta', 'apagar_ferramenta', 'listar_ferramentas',
]);
const schemasLiberadas = TOOL_SCHEMAS.filter(t => !TOOLS_REMOVIDOS.has(t.name));
TOOL_SCHEMAS.length = 0;
TOOL_SCHEMAS.push(...schemasLiberadas);

function donoOnly(toolCtx, fn) {
  if (!toolCtx || !toolCtx.isDono) {
    return { erro: 'Permissão negada: essa ferramenta de PC só funciona quando o DONO da corvo pedir. Sem essa autorização não mexo na máquina.' };
  }
  return fn();
}

// ===== 📸 OCR — LER TEXTO DE IMAGEM (regra do dono) =====
// Usa o MESMO cérebro de visão do bot (Gemini) para transcrever o texto de
// qualquer imagem. QUALQUER pessoa pode ler a imagem do próprio pedido
// (data/anexos); só o DONO lê qualquer imagem do PC.
async function lerTextoImagem(caminho, toolCtx) {
  try {
    if (!caminho) return { erro: 'Informe o caminho da imagem.' };
    if (!fs.existsSync(caminho)) return { erro: `Arquivo não encontrado: ${caminho}` };
    // 🛡️ Zona: só DONO lê imagem de qualquer lugar; MEMBRO só nas zonas do pedido
    if (toolCtx && !toolCtx.isDono && !arquivoPermitido(toolCtx, caminho)) {
      return { erro: 'Só o dono pode ler imagens fora da zona do pedido. Envie a imagem no grupo que eu leio de data/anexos.' };
    }
    const buf = fs.readFileSync(caminho);
    if (!buf.length) return { erro: 'Arquivo vazio.' };
    const ext = String(caminho).split('.').pop()?.toLowerCase() || '';
    const mime = ({
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
    })[ext] || 'image/jpeg';
    const { askSystemGemini } = require('./ia_gemini');
    const res = await askSystemGemini(
      'Você é um leitor de texto de imagem (OCR) perfeito. Transcreva TODO o texto visível na imagem, literalmente, na língua original (geralmente português). Se for captura de tela, mensagem ou documento, transcreva tudo o que aparecer. Não resuma, não comente, não adicione nada além do texto extraído.',
      'Transcreva todo o texto desta imagem.',
      [{ dataBuffer: buf, mimeType: mime }]
    );
    const texto = String(res.text || '').trim();
    if (!texto) return { erro: 'Não encontrei texto legível nessa imagem.' };
    return { texto };
  } catch (e) {
    return { erro: 'Não consegui ler o texto da imagem: ' + String(e.message || e).slice(0, 200) };
  }
}

// ===== 🌤 CLIMA (regra do dono — API pública sem chave) =====
const CODIGO_CLIMA = {
  0: 'Céu limpo ☀️', 1: 'Predomínio de sol 🌤', 2: 'Parcialmente nublado ⛅', 3: 'Nublado ☁️',
  45: 'Nevoeiro 🌫', 48: 'Nevoeiro com geada 🌫', 51: 'Garoa leve 🌦', 53: 'Garoa 🌦', 55: 'Garoa forte 🌧',
  61: 'Chuva leve 🌧', 63: 'Chuva 🌧', 65: 'Chuva forte 🌧', 66: 'Chuva congelante 🌧', 67: 'Chuva congelante forte 🌧',
  71: 'Neve leve ❄️', 73: 'Neve ❄️', 75: 'Neve forte ❄️', 77: 'Grãos de neve ❄️',
  80: 'Pancada de chuva 🌦', 81: 'Pancada de chuva 🌧', 82: 'Pancada violenta ⛈', 85: 'Pancada de neve ❄️', 86: 'Pancada de neve forte ❄️',
  95: 'Trovoada ⛈', 96: 'Trovoada com granizo ⛈', 99: 'Trovoada forte com granizo ⛈',
};
async function climaCidade(cidade) {
  try {
    if (!cidade) return { erro: 'Informe a cidade (ex: clima São Paulo).' };
    const geo = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&format=json`, { timeout: 15000 });
    const loc = geo.data?.results?.[0];
    if (!loc) return { erro: `Cidade "${cidade}" não encontrada.` };
    const f = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`,
      { timeout: 15000 }
    );
    const cur = f.data.current || {};
    const dias = (f.data.daily?.time || []).map((d, i) => ({
      dia: d,
      max: f.data.daily.temperature_2m_max?.[i],
      min: f.data.daily.temperature_2m_min?.[i],
    })).slice(0, 3);
    const linha = (d) => {
      const [ano, mes, dia] = String(d.dia).split('-');
      return `${dia}/${mes}: ${d.min}°C a ${d.max}°C`;
    };
    return {
      cidade: `${loc.name}${loc.country ? ', ' + loc.country : ''}`,
      agora: `${cur.temperature_2m}°C • ${CODIGO_CLIMA[cur.weather_code] || 'condição desconhecida'}`,
      sensacao: `${cur.apparent_temperature}°C`,
      umidade: `${cur.relative_humidity_2m}%`,
      vento: `${cur.wind_speed_10m} km/h`,
      proximos_dias: dias.map(linha),
    };
  } catch (e) {
    return { erro: 'Não consegui buscar o clima: ' + String(e.message || e).slice(0, 200) };
  }
}

// ===== 💱 COTAÇÕES (regra do dono — API pública sem chave) =====
async function cotacoes() {
  try {
    const { data } = await axios.get('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,GBP-BRL,BTC-BRL', { timeout: 15000 });
    const fmt = (c) => ({
      nome: c.name,
      compra: `R$ ${Number(c.bid).toFixed(2)}`,
      venda: `R$ ${Number(c.ask).toFixed(2)}`,
      variacao: `${Number(c.pctChange).toFixed(2)}%`,
    });
    return {
      dolar: fmt(data['USD-BRL']),
      euro: fmt(data['EUR-BRL']),
      libra: fmt(data['GBP-BRL']),
      bitcoin: fmt(data['BTC-BRL']),
    };
  } catch (e) {
    return { erro: 'Não consegui buscar as cotações: ' + String(e.message || e).slice(0, 200) };
  }
}

// ===== 🔗 ENCURTAR LINK (regra do dono — API pública sem chave) =====
async function encurtarLink(url) {
  try {
    if (!url) return { erro: 'Informe a URL para encurtar.' };
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const { data } = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`, { timeout: 15000 });
    const s = String(data).trim();
    if (/^https?:\/\//.test(s)) return { link_curto: s, original: url };
    return { erro: 'Não consegui encurtar esse link: ' + s.slice(0, 120) };
  } catch (e) {
    return { erro: 'Não consegui encurtar o link: ' + String(e.message || e).slice(0, 200) };
  }
}

// ===== 📱 QR CODE (regra do dono) =====
async function gerarQr(texto) {
  try {
    if (!texto) return { erro: 'Informe o texto ou link do QR (ex: gerar_qr(https://...)).' };
    const QRCode = require('qrcode');
    const dir = path.join(DATA_BOT, 'downloads');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `qr_${Date.now()}.png`);
    await QRCode.toFile(out, String(texto), { width: 512, margin: 2 });
    if (!fs.existsSync(out)) return { erro: 'Falha ao gerar o QR code.' };
    return { ok: true, arquivo: out, observacao: 'Use [ARQUIVO: caminho] para enviar ao WhatsApp.' };
  } catch (e) {
    return { erro: 'Não consegui gerar o QR: ' + String(e.message || e).slice(0, 200) };
  }
}

// ===== 📊 RESUMO DO DIA DO GRUPO (regra do dono) =====
// Lê o log de mensagens do chat (data/ia_chat_log/<chatId>.json, mantido pela
// memoria.js) e pede pro Gemini resumir o que rolou HOJE. QUALQUER pessoa pode
// pedir. Só funciona em grupos (chat termina em @g.us).
async function resumoGrupo(toolCtx) {
  try {
    const chatId = toolCtx?.chatId;
    if (!chatId || !String(chatId).endsWith('@g.us')) {
      return { erro: 'O resumo do dia só funciona em grupos.' };
    }
    const mem = require('../grupo/memoria');
    const arr = (typeof mem.getChatLog === 'function') ? mem.getChatLog(chatId, 300) : [];
    if (!Array.isArray(arr) || !arr.length) return { erro: 'Ainda não tenho mensagens guardadas deste grupo.' };
    // 📅 Filtra as mensagens de HOJE (fuso America/Sao_Paulo)
    const hoje = new Date();
    const hojeStr = hoje.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
    const doDia = arr.filter((m) => {
      if (!m || !m.ts) return false;
      try {
        const d = new Date(m.ts).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        return d === hojeStr;
      } catch (e) { return false; }
    });
    if (doDia.length < 2) return { resumo: 'Hoje ainda não teve movimento suficiente pra resumir — só ' + doDia.length + ' mensagem(ns).' };
    const trecho = doDia.map((m) => `• ${m.user || 'Alguém'}: ${String(m.text || '').slice(0, 160)}`).join('\n').slice(0, 6000);
    const { askSystemGemini } = require('./ia_gemini');
    const res = await askSystemGemini(
      'Você é uma pessoa de verdade resumindo o dia do grupo de WhatsApp dela. Com base nas mensagens abaixo, faça um RESUMO NATURAL e em tom de conversa (sem formatação pesada, com emojis): o que rolou hoje, os assuntos principais, decisões tomadas, piadas/chamadas, e quem foi destaque. Se foi um dia fraco, diga sem frescura. Máximo ~8 linhas.',
      `Mensagens de hoje no grupo:\n\n${trecho}`
    );
    const texto = String(res.text || '').trim();
    return texto ? { resumo: texto } : { erro: 'Não consegui resumir o dia agora.' };
  } catch (e) {
    return { erro: 'Não consegui resumir o dia: ' + String(e.message || e).slice(0, 200) };
  }
}

// ===== 📄 CRIAR PDF (regra do dono — pdfkit) =====
async function criarPdf(titulo, texto) {
  try {
    if (!texto) return { erro: 'Informe o texto do PDF.' };
    const PDFDocument = require('pdfkit');
    const dir = path.join(DATA_BOT, 'downloads');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `documento_${Date.now()}.pdf`);
    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(out);
      stream.on('finish', resolve);
      stream.on('error', reject);
      doc.pipe(stream);
      if (titulo) {
        doc.fontSize(20).text(String(titulo), { align: 'center' });
        doc.moveDown();
      }
      doc.fontSize(12).text(String(texto));
      doc.end();
    });
    if (!fs.existsSync(out)) return { erro: 'Falha ao gerar o PDF.' };
    return { ok: true, arquivo: out, observacao: 'Use [ARQUIVO: caminho] para enviar ao WhatsApp.' };
  } catch (e) {
    return { erro: 'Não consegui criar o PDF: ' + String(e.message || e).slice(0, 200) };
  }
}

// ===== 📖 EXTRAIR TEXTO DE PDF (regra do dono — pdf-parse) =====
async function extrairTextoPdf(caminho, toolCtx) {
  try {
    if (!caminho) return { erro: 'Informe o caminho do PDF.' };
    if (!fs.existsSync(caminho)) return { erro: `Arquivo não encontrado: ${caminho}` };
    // 🛡️ Zona: só DONO lê PDF de qualquer lugar; MEMBRO só nas zonas do pedido
    if (toolCtx && !toolCtx.isDono && !arquivoPermitido(toolCtx, caminho)) {
      return { erro: 'Só o dono pode ler PDFs fora da zona do pedido. Envie o PDF no grupo que eu leio de data/anexos.' };
    }
    // 🐛 FIX 2026-08-10: pdf-parse v2.x (instalada: 2.4.5) MUDOU a API — não
    // exporta mais uma função direta (`pdfParse(buf)` quebrava com
    // "pdfParse is not a function"). Agora é a classe PDFParse:
    // `new PDFParse({ data: buf }).getText()` → { text, total, pages }.
    const { PDFParse } = require('pdf-parse');
    const buf = fs.readFileSync(caminho);
    const data = await new PDFParse({ data: buf }).getText();
    const texto = String((data && data.text) || '').trim().slice(0, 6000);
    if (!texto) return { erro: 'Não consegui extrair texto deste PDF (pode ser escaneado/imagem).' };
    return { texto, paginas: (data && data.total) || 1 };
  } catch (e) {
    return { erro: 'Não consegui extrair o texto do PDF: ' + String(e.message || e).slice(0, 200) };
  }
}

// ===== 📊 CRIAR PLANILHA (regra do dono — CSV que abre no Excel/LibreOffice) =====
async function criarPlanilha(nome, colunas, linhas) {
  try {
    if (!Array.isArray(colunas) || !colunas.length) return { erro: 'Informe as colunas (lista de títulos).' };
    const nomeLimpo = String(nome || 'planilha').replace(/[^\w\- ]/g, '_').slice(0, 40);
    const dir = path.join(DATA_BOT, 'downloads');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `planilha_${nomeLimpo}_${Date.now()}.csv`);
    const esc = (v) => {
      const s = String(v ?? '');
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const cabecalho = colunas.map(esc).join(';');
    const corpo = (Array.isArray(linhas) ? linhas : [])
      .map((l) => (Array.isArray(l) ? l.map(esc).join(';') : esc(l)))
      .join('\n');
    // 🧹 BOM UTF-8: sem ele o Excel abre com acentos quebrados
    fs.writeFileSync(out, '\uFEFF' + cabecalho + (corpo ? '\n' + corpo : ''), 'utf8');
    if (!fs.existsSync(out)) return { erro: 'Falha ao gerar a planilha.' };
    return { ok: true, arquivo: out, observacao: 'Use [ARQUIVO: caminho] para enviar ao WhatsApp (abre no Excel/LibreOffice).' };
  } catch (e) {
    return { erro: 'Não consegui criar a planilha: ' + String(e.message || e).slice(0, 200) };
  }
}

// 👑 ADMIN OU DONO: admins do GRUPO podem pedir ferramentas de administração
// (banir, kickar, promover, rebaixar, remover membro, configurar grupo) e a IA
// OBEDECE. O dono sempre pode. ÚNICA EXCEÇÃO: NUNCA contra o DONO (alvo).
function adminOrDono(toolCtx, fn, alvoId) {
  if (!toolCtx || (!toolCtx.isDono && !toolCtx.isAdmin)) {
    return { erro: 'Permissão negada: essa ferramenta de administração é para admins do grupo ou o DONO da corvo.' };
  }
  const alvoLimpo = String(alvoId || '').replace(/\D/g, '');
  const donoLimpo = String(autonomia.DONO || '').replace(/\D/g, '');
  if (alvoLimpo && alvoLimpo === donoLimpo) {
    return { erro: 'Não posso usar isso contra o DONO. Ele está acima de qualquer admin.' };
  }
  return fn();
}

function runCmd(cmd, timeoutMs = 90000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, cwd: process.cwd() }, (err, stdout, stderr) => {
      const out = String(stdout || '').trim();
      const errTxt = String(stderr || '').trim();
      let r = out || (err ? '(sem saída)' : '(comando executado com sucesso, sem saída)');
      if (errTxt && !out) r += '\n[stderr]\n' + errTxt;
      if (err && !out && !errTxt) r = 'ERRO: ' + err.message;
      resolve(r.slice(0, 3000));
    });
  });
}

// exec roda via cmd.exe, então cmdlets do PowerShell (Get-NetTCPConnection,
// Get-ChildItem -Recurse, GUI de captura etc.) falham. Este helper grava o
// script num .ps1 temporário e roda via powershell.exe -File (robusto p/ aspas).
const PS_TMP = path.join(DATA_BOT, 'ps_tmp');
function runPowerShell(scriptLines, timeoutMs = 90000) {
  return new Promise((resolve) => {
    try {
      fs.mkdirSync(PS_TMP, { recursive: true });
      const ps1 = path.join(PS_TMP, `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.ps1`);
      fs.writeFileSync(ps1, Array.isArray(scriptLines) ? scriptLines.join('\n') : String(scriptLines), 'utf-8');
      const cli = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`;
      exec(cli, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, cwd: process.cwd() }, (err, stdout, stderr) => {
        try { fs.unlinkSync(ps1); } catch (e) {}
        const out = String(stdout || '').trim();
        const errTxt = String(stderr || '').trim();
        let r = out || (err ? '(sem saída)' : '(ok, sem saída)');
        if (errTxt && !out) r += '\n[stderr]\n' + errTxt;
        if (err && !out && !errTxt) r = 'ERRO: ' + err.message;
        resolve(r.slice(0, 4000));
      });
    } catch (e) {
      resolve('ERRO ao preparar script PowerShell: ' + e.message);
    }
  });
}

function listFolder(caminho) {
  try {
    const entries = fs.readdirSync(caminho);
    const lines = [];
    for (const e of entries) {
      let tipo = 'arquivo';
      try { if (fs.statSync(path.join(caminho, e)).isDirectory()) tipo = 'PASTA'; } catch (err) {}
      lines.push(`${tipo === 'PASTA' ? '[P]' : '[F]'} ${e}`);
      if (lines.length >= 200) break;
    }
    return `📁 ${caminho}\n${lines.join('\n')}`;
  } catch (e) {
    return `ERRO ao listar: ${e.message}`;
  }
}

function createFile(caminhoArq, conteudo) {
  try {
    fs.mkdirSync(path.dirname(caminhoArq), { recursive: true });
    fs.writeFileSync(caminhoArq, String(conteudo));
    return `Arquivo criado/atualizado: ${caminhoArq}`;
  } catch (e) {
    return `ERRO ao criar arquivo: ${e.message}`;
  }
}

function readFileTool(caminhoArq, linhas) {
  try {
    if (!fs.existsSync(caminhoArq)) return `ERRO: arquivo não existe: ${caminhoArq}`;
    const content = fs.readFileSync(caminhoArq, 'utf-8');
    const total = content.split('\n').length;
    // 🔎 Leitura por trecho (linhas): permite ver o MEIO/FIM de arquivo grande
    if (linhas) {
      const m = String(linhas).trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
      if (!m) return `ERRO: parâmetro linhas inválido (use ex: "300" ou "300-350").`;
      const inicio = Math.max(1, parseInt(m[1], 10));
      const fim = m[2] ? Math.min(total, parseInt(m[2], 10)) : Math.min(total, inicio + 80);
      if (inicio > total) return `ERRO: o arquivo tem ${total} linhas, não chega na ${inicio}.`;
      if (fim < inicio) return `ERRO: intervalo de linhas inválido (${inicio}-${fim}). Use inicio menor que fim, ex: "300-400".`;
      const partes = content.split('\n').slice(inicio - 1, fim);
      return `===== ${caminhoArq} — linhas ${inicio}-${fim} de ${total} =====\n(Os números são só referência — ao editar, copie o trecho SEM o número.)\n${partes.map((l, i) => `${inicio + i}: ${l}`).join('\n')}`;
    }
    // Leitura padrão: começo do arquivo (com aviso de truncamento e dica de linhas)
    return content.length > 8000
      ? `===== ${caminhoArq} (${total} linhas) — primeiras linhas =====\n` + content.slice(0, 8000) + `\n…(arquivo maior: ${total} linhas no total. Para ver OUTRA parte, use linhas: "inicio-fim", ex: linhas: "300-400". NUNCA reescreva o arquivo inteiro só com o que viu aqui — o resto ficaria perdido!)`
      : content;
  } catch (e) {
    return `ERRO ao ler arquivo: ${e.message}`;
  }
}

function editFileTool(caminhoArq, buscar, substituir, todas) {
  try {
    if (!fs.existsSync(caminhoArq)) return `ERRO: arquivo não existe: ${caminhoArq}`;
    const content = fs.readFileSync(caminhoArq, 'utf-8');
    const count = content.split(buscar).length - 1;
    if (count === 0) {
      return `ERRO: o trecho a substituir NÃO foi encontrado em ${caminhoArq}. Leia o arquivo com ler_arquivo (use linhas para ver o trecho certo) e copie o trecho EXATO. O arquivo NÃO foi alterado.`;
    }
    // 🔒 BACKUP automático em VERSÕES antes de editar — guarda até 3 versões anteriores
    let backupSalvo = null;
    try {
      backupSalvo = rotacionarBackup(caminhoArq);
    } catch (e) { /* backup é extra, não bloqueia a edição */ }
    const novo = todas ? content.split(buscar).join(String(substituir)) : content.replace(buscar, () => String(substituir));
    fs.writeFileSync(caminhoArq, novo);
    let resultado = `✅ Editado ${caminhoArq} (${count} ocorrência${count > 1 ? 's' : ''} ${todas ? 'todas substituídas' : 'só a primeira'}).`;
    if (backupSalvo) {
      resultado += `\n🔒 Backup ${backupSalvo.split(/[\\/]/).pop()} salvo — use listar_backups pra ver as versões e restaurar_backup (versao: 1) pra voltar.`;
    } else {
      resultado += `\n⚠️ Não consegui salvar o backup (.bak) deste arquivo — edição aplicada sem backup.`;
    }
    if (caminhoArq.toLowerCase().endsWith('.js')) {
      try {
        const { execSync } = require('child_process');
        execSync(`node --check "${caminhoArq}"`, { timeout: 30000 });
        resultado += '\n✅ Validação node --check: SEM ERROS de sintaxe.';
      } catch (e) {
        resultado += `\n⚠️ VALIDAÇÃO FALHOU (node --check): ${String(e.message || e).split('\n')[0]}. Revise e corrija!`;
      }
    }
    return resultado;
  } catch (e) {
    return `ERRO ao editar arquivo: ${e.message}`;
  }
}

// Quantas versões de backup automático cada edição mantém (.bak.1 = mais recente)
const MAX_BACKUP_VERSOES = 3;

function rotacionarBackup(caminhoArq) {
  // desloca as antigas (.bak.2 -> .bak.3, .bak.1 -> .bak.2) com renameSync pra
  // PRESERVAR a data de criação de cada versão; depois copia a atual pra .bak.1
  const mover = (orig, dest) => { try { if (fs.existsSync(orig)) fs.renameSync(orig, dest); } catch (e) { try { if (fs.existsSync(orig)) fs.copyFileSync(orig, dest); } catch (e2) {} } };
  for (let i = MAX_BACKUP_VERSOES - 1; i >= 1; i--) mover(`${caminhoArq}.bak.${i}`, `${caminhoArq}.bak.${i + 1}`);
  try { fs.copyFileSync(caminhoArq, `${caminhoArq}.bak.1`); } catch (e) {}
  return fs.existsSync(`${caminhoArq}.bak.1`) ? `${caminhoArq}.bak.1` : null;
}

function listarBackupsTool(caminhoArq) {
  const versoes = [];
  for (let i = 1; i <= MAX_BACKUP_VERSOES; i++) {
    const bak = `${caminhoArq}.bak.${i}`;
    try {
      if (fs.existsSync(bak)) {
        const st = fs.statSync(bak);
        versoes.push(`• .bak.${i} — ${new Date(st.mtimeMs).toLocaleString('pt-BR')} (${Math.round(st.size / 1024)} KB)`);
      }
    } catch (e) {}
  }
  if (!versoes.length) return `Nenhum backup de ${caminhoArq}. Edite o arquivo antes (o editar_arquivo salva backup automático).`;
  return `🔒 Backups de ${caminhoArq}:\n${versoes.join('\n')}`;
}

function restaurarBackupTool(caminhoArq, versao) {
  try {
    const v = Math.max(1, Math.min(MAX_BACKUP_VERSOES, Number(versao) || 1));
    const bak = `${caminhoArq}.bak.${v}`;
    if (!fs.existsSync(bak)) {
      const lista = listarBackupsTool(caminhoArq);
      return `ERRO: não existe backup .bak.${v} de ${caminhoArq}. ${lista}`;
    }
    fs.copyFileSync(bak, caminhoArq);
    return `✅ Backup .bak.${v} restaurado! ${caminhoArq} voltou para a versão de ${new Date(fs.statSync(bak).mtimeMs).toLocaleString('pt-BR')}.`;
  } catch (e) {
    return `ERRO ao restaurar backup: ${e.message}`;
  }
}

function procurarPc(termo, pastaBase) {
  const base = pastaBase || os.homedir();
  const pattern = String(termo || '').trim();
  if (!pattern) return 'ERRO: informe um termo de busca.';
  try {
    const filtered = pattern.includes('*') ? pattern : `*${pattern}*`;
    const ps = [
      `$r = Get-ChildItem -Path '${base}' -Recurse -Force -File -Filter '${filtered}' -ErrorAction SilentlyContinue`,
      `$r = $r | Select-Object -First 20`,
      `if (-not $r) { 'NADA ENCONTRADO para: ${filtered}' } else { $r | ForEach-Object { "{0} | {1} KB" -f $_.FullName, [math]::Round($_.Length/1KB) } }`,
    ];
    return runPowerShell(ps, 120000);
  } catch (e) {
    return `ERRO na busca: ${e.message}`;
  }
}

// ===== INSTALAÇÃO DE PROGRAMAS E SERVIDORES =====

const SERVER_HELPER = path.join(DATA_BOT, 'server_helper.js');
if (!fs.existsSync(SERVER_HELPER)) {
  try {
    fs.writeFileSync(SERVER_HELPER, `const http=require('http'),fs=require('fs'),path=require('path');
const port=Number(process.argv[2]||8080),root=path.resolve(process.argv[3]||'.');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.woff2':'font/woff2','.ico':'image/x-icon'};
http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(root,p);fs.readFile(f,(e,b)=>{if(e){res.writeHead(404);res.end('404');return;}res.writeHead(200,{'Content-Type':types[path.extname(f).toLowerCase()]||'application/octet-stream'});res.end(b);});}).listen(port,'0.0.0.0',()=>console.log('SERVIDOR OK',port));`);
  } catch (e) {}
}

function trySpawn(cmd, args) {
  return new Promise((resolve) => {
    let failed = false;
    const c = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
    c.on('error', () => { failed = true; resolve(false); });
    c.once('spawn', () => { setTimeout(() => { if (!failed) { c.unref(); } resolve(!failed); }, 600); });
  });
}

async function instalarPrograma(nome, tipo) {
  const n = String(nome || '').trim();
  const t = String(tipo || '').toLowerCase();
  if (!n) return 'ERRO: informe o nome do programa.';
  if (t === 'npm') return runCmd(`npm install -g ${n}`, 180000);
  if (t === 'pip') return runCmd(`pip install ${n}`, 180000);
  const check = await runCmd('winget --version', 20000);
  if (/não|not recognized|NÃO é|ERRO|error/i.test(check)) {
    return 'winget não está disponível neste PC. Use tipo: "npm" ou "pip", ou baixe o instalador com baixar_arquivo e rode com executar_terminal.';
  }
  return runCmd(`winget install --exact --name "${n}" --accept-source-agreements --accept-package-agreements --silent --disable-interactivity`, 300000);
}

async function verificarPrograma(nome) {
  const n = String(nome || '').trim();
  if (!n) return 'ERRO: informe o comando.';
  const cmd = await runCmd(`where.exe ${n} 2>nul`, 20000);
  const versao = await runCmd(`${n} --version 2>nul`, 20000);
  const npm = await runCmd(`npm ls -g ${n} 2>nul`, 30000);
  const parts = [];
  if (cmd && !/not found|ERRO|não/i.test(cmd)) parts.push(`Local: ${cmd.split('\n')[0]}`);
  else parts.push(`Não encontrado no PATH: ${n}`);
  if (versao && !/not found|ERRO|não/i.test(versao)) parts.push(`Versão: ${versao.split('\n')[0]}`);
  if (npm && !/not found|ERRO|não|empty/i.test(npm)) parts.push(`npm global: ${npm.split('\n').slice(0, 3).join(' | ')}`);
  return parts.join('\n');
}

function iniciarServidor(pasta, porta) {
  const dir = path.resolve(String(pasta || '').trim() || '.');
  if (!fs.existsSync(dir)) return `ERRO: pasta não existe: ${dir}`;
  const p = Number(porta) || 8080;
  return trySpawn('python', ['-m', 'http.server', String(p), '--directory', dir]).then((okPy) => {
    if (okPy) return `✅ Servidor rodando: http://localhost:${p} (pasta: ${dir})`;
    return trySpawn('node', [SERVER_HELPER, String(p), dir]).then((okNode) => {
      if (okNode) return `✅ Servidor rodando: http://localhost:${p} (pasta: ${dir})`;
      return 'ERRO: não consegui subir o servidor (python e node indisponíveis). Instale o Node.js com instalar_programa.';
    });
  });
}

function pararServidor(porta) {
  const p = Number(porta);
  if (!p) return Promise.resolve('ERRO: informe a porta.');
  return runPowerShell([
    `$conns = Get-NetTCPConnection -LocalPort ${p} -State Listen -ErrorAction SilentlyContinue`,
    `if (-not $conns) { 'Nenhum servidor ouvindo na porta ${p}.' } else {`,
    `  $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique`,
    `  foreach ($pidKill in $pids) { taskkill /F /PID $pidKill 2>&1 | Out-Null }`,
    `  "Servidores na porta ${p} encerrados (PIDs: $($pids -join ', '))"`,
    `}`,
  ], 30000);
}

function exporSite(porta) {
  const p = Number(porta) || 8080;
  const logFile = path.join(DATA_BOT, 'tunnel.log');
  try { fs.writeFileSync(logFile, ''); } catch (e) {}
  const out = fs.openSync(logFile, 'a');
  let c;
  try {
    c = spawn('npx', ['--yes', 'localtunnel', '--port', String(p)], { detached: true, stdio: ['ignore', out, out], windowsHide: true });
    c.unref();
  } catch (e) {
    return Promise.resolve('ERRO ao iniciar túnel: ' + e.message);
  }
  return new Promise((resolve) => {
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      let txt = '';
      try { txt = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf-8') : ''; } catch (e) {}
      const m = txt.match(/https:\/\/[a-z0-9-]+\.loca\.lt/i);
      if (m) { clearInterval(iv); resolve(`✅ Site público: ${m[0]}`); }
      else if (tries > 48) { clearInterval(iv); resolve(`Túnel iniciado, ainda aguardando URL (pode demorar no 1º uso). Veja data/tunnel.log`); }
    }, 500);
  });
}


async function baixarYouTube(url, tipo) {
  const dir = path.join(DATA_BOT, 'downloads');
  fs.mkdirSync(dir, { recursive: true });
  const ext = tipo === 'audio' ? 'mp3' : 'mp4';
  const out = path.join(dir, `yt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
  const opts = {
    output: out,
    noPlaylist: true,
    ffmpegLocation: path.dirname(ffmpegPath),
    jsRuntimes: 'node:' + process.execPath,
  };
  if (tipo === 'audio') {
    opts.extractAudio = true;
    opts.audioFormat = 'mp3';
    opts.audioQuality = 0;
    opts.format = 'bestaudio/best';
  } else {
    opts.format = 'best[ext=mp4]/best';
    opts.mergeOutputFormat = 'mp4';
  }
  try {
    await youtubedl(url, opts);
    const st = fs.statSync(out);
    if (st.size < 1000) throw new Error('download vazio');
    // 🎬 Valida o tipo real: YouTube pode entregar webm/mkv com extensão .mp4
    const tipoReal = detectarTipoArquivo(out);
    if (tipoReal === 'html') throw new Error('YouTube retornou página HTML (link inválido/bloqueado)');
    if (tipoReal === 'webm') {
      const mp4 = await converterParaMp4(out);
      if (mp4) {
        try { fs.unlinkSync(out); } catch (err) {}
        return { ok: true, arquivo: mp4, tamanho: fs.statSync(mp4).size };
      }
    }
    return { ok: true, arquivo: out, tamanho: st.size };
  } catch (e) {
    try { fs.unlinkSync(out); } catch (err) {}
    return { erro: `Falha ao baixar: ${e.message}` };
  }
}

async function baixarArquivoURL(url, nome) {
  try {
    const dir = path.join(DATA_BOT, 'downloads');
    fs.mkdirSync(dir, { recursive: true });
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 600000, maxContentLength: 30 * 1024 * 1024 * 1024, headers: UA });
    const buf = Buffer.from(res.data);
    if (buf.length < 100) return { erro: 'Arquivo muito pequeno/vazio.' };
    // 🛡️ Detecta o tipo REAL pelo magic bytes: extensão/Content-Type podem mentir
    // (ex: servidor bloqueado devolve página HTML com header video/mp4)
    const tipoReal = detectarTipoBuffer(buf);
    if (tipoReal === 'html') {
      return { erro: 'A URL não retornou o arquivo: o servidor devolveu uma página HTML (link bloqueado/expirado/inválido). Tente outra fonte/URL.' };
    }
    const extByTipo = { mp4: '.mp4', webm: '.webm', jpeg: '.jpg', png: '.png', gif: '.gif' };
    const mime = (res.headers['content-type'] || '').split(';')[0].toLowerCase();
    const extByMime = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg' };
    const ext = extByTipo[tipoReal] || extByMime[mime] || '.bin';
    const nameBase = (nome || `download_${Date.now()}`).trim();
    const hasExt = !!path.extname(nameBase);
    const finalName = path.basename(hasExt ? nameBase : nameBase + ext);
    const out = path.join(dir, finalName);
    fs.writeFileSync(out, buf);
    // 🎬 Vídeo webm/mkv -> converte para MP4 (WhatsApp reproduz melhor)
    if (tipoReal === 'webm') {
      const mp4 = await converterParaMp4(out);
      if (mp4) {
        try { fs.unlinkSync(out); } catch (e) {}
        return { ok: true, arquivo: mp4, tamanho: fs.statSync(mp4).size };
      }
    }
    return { ok: true, arquivo: out, tamanho: buf.length };
  } catch (e) {
    return { erro: `Falha ao baixar arquivo: ${e.message}` };
  }
}

// ===== SISTEMA (info, processos, serviços, rede, portas, ping) =====

function infoSistema() {
  return runPowerShell([
    `$os = Get-CimInstance Win32_OperatingSystem`,
    `$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1`,
    `$mem = Get-CimInstance Win32_ComputerSystem`,
    `$d = Get-PSDrive -PSProvider FileSystem | Where-Object { $null -ne $_.Used }`,
    `"OS: $($os.Caption) $($os.OSArchitecture)"`,
    `"Host: $env:COMPUTERNAME  Usuario: $env:USERNAME"`,
    `"CPU: $($cpu.Name)"`,
    `"RAM Total: $([math]::Round($mem.TotalPhysicalMemory/1GB,1)) GB  Livre: $([math]::Round($os.FreePhysicalMemory/1MB,1)) GB"`,
    `"Uptime: $((Get-Date) - $os.LastBootUpTime | ForEach-Object { [math]::Round($_.TotalHours,1) }) horas"`,
    `"Discos:"`,
    `$d | ForEach-Object { "  $($_.Name): usado $([math]::Round($_.Used/1GB,1)) GB de $([math]::Round(($_.Used+$_.Free)/1GB,1)) GB" }`,
  ], 30000);
}

function usoPc() {
  return runPowerShell([
    `$os = Get-CimInstance Win32_OperatingSystem`,
    `$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average`,
    `"CPU: $cpu%"`,
    `"RAM: usado $([math]::Round(($os.TotalVisibleMemorySize-$os.FreePhysicalMemory)/1MB,1)) GB de $([math]::Round($os.TotalVisibleMemorySize/1MB,1)) GB"`,
    `$p = Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 5 | ForEach-Object { "  RAM $([math]::Round($_.WorkingSet64/1MB,0)) MB | $($_.ProcessName)" }`,
    `"Top processos:"`,
    `$p`,
  ], 30000);
}

function gerenciarProcessos(acao, alvo) {
  const a = String(acao || 'listar').toLowerCase();
  if (a === 'matar') {
    if (!String(alvo || '').trim()) return Promise.resolve('ERRO: informe o nome do processo ou PID para matar.');
    if (/^\d+$/.test(String(alvo).trim())) {
      return runPowerShell([`Stop-Process -Id ${Number(alvo)} -Force -ErrorAction SilentlyContinue`, `"Processo PID ${alvo} encerrado (se existia)."`], 20000);
    }
    return runPowerShell([`Get-Process -Name '${alvo}' -ErrorAction SilentlyContinue | Stop-Process -Force`, `"Processos '${alvo}' encerrados (se existiam)."`], 20000);
  }
  return runPowerShell([
    `Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 20 | ForEach-Object { "PID $($_.Id) | RAM $([math]::Round($_.WorkingSet64/1MB,0)) MB | $($_.ProcessName)" }`,
  ], 30000);
}

// ⏳ comDelay: espera opcional após ações que abrem/agem no PC (mesmo padrão do captura_tela).
// Serve para o print/captura seguinte pegar o estado já pronto (janela aberta, ação concluída).
function comDelay(prom, delayMs) {
  const d = Math.min(parseInt(delayMs, 10) || 0, 30000);
  if (d <= 0) return prom;
  return prom.then((r) => new Promise((res) => setTimeout(() => res(r), d)));
}

function abrirPrograma(programa, delayMs) {
  const p = String(programa || '').trim();
  if (!p) return Promise.resolve('ERRO: informe o programa.');
  if (fs.existsSync(p)) return comDelay(runCmd(`start "" "${p}"`, 10000), delayMs);
  const alias = { notepad: 'notepad', nota: 'notepad', notas: 'notepad', calc: 'calc', calculadora: 'calc', paint: 'mspaint', chrome: 'chrome', firefox: 'firefox', edge: 'msedge', explorador: 'explorer', explorer: 'explorer', cmd: 'cmd', prompt: 'cmd', powershell: 'powershell', gerenciador_de_tarefas: 'taskmgr', taskmgr: 'taskmgr' };
  const cmd = alias[p.toLowerCase()] || p;
  return comDelay(runCmd(`start "" ${cmd}`, 10000), delayMs);
}

function servicos(acao, nome) {
  const a = String(acao || 'listar').toLowerCase();
  if (a !== 'listar') {
    if (!String(nome || '').trim()) return Promise.resolve('ERRO: informe o nome do serviço.');
    const verbo = a === 'iniciar' ? 'Start-Service -Name' : a === 'parar' ? 'Stop-Service -Name' : 'Restart-Service -Name';
    return runPowerShell([
      `if (Get-Service -Name '${nome}' -ErrorAction SilentlyContinue) { ${verbo} '${nome}' -Force; "Servico '${nome}' $a executado." } else { "Servico '${nome}' nao encontrado. Veja servicos(acao=listar) ou use wmic: sc query." }`,
    ], 30000);
  }
  return runPowerShell([
    `$s = Get-Service | Where-Object { $_.Status -eq 'Running' } | Select-Object -First 30`,
    `if (-not $s) { "Nenhum servico em execucao." } else { $s | ForEach-Object { "  $($_.DisplayName) | $($_.Name)" } }`,
  ], 30000);
}

function redeInfo() {
  return runPowerShell([
    `Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { "IP: $($_.IPAddress) ($($_.InterfaceAlias))" }`,
    `Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { "Adaptador: $($_.Name) | MAC: $($_.MacAddress) | Velocidade: $([math]::Round($_.LinkSpeed/1MB,0)) Mbps" }`,
    `"Hostname: $env:COMPUTERNAME"`,
  ], 30000);
}

function testarPing(host) {
  const h = String(host || '').trim();
  if (!h) return Promise.resolve('ERRO: informe o host.');
  return runPowerShell([
    `$r = Test-Connection -ComputerName '${h}' -Count 4 -ErrorAction SilentlyContinue`,
    `if (-not $r) { "Sem resposta de $h (host inacessivel)." } else { $r | ForEach-Object { "MS: $($_.ResponseTime)" }; "OK - todos os pacotes responderam." }`,
  ], 30000);
}

function verPortas() {
  return runPowerShell([
    `Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Sort-Object LocalPort -Unique | ForEach-Object { "Porta $($_.LocalPort) | PID $($_.OwningProcess)" }`,
  ], 30000);
}

function gitOperacoes(pasta, comando) {
  const dir = path.resolve(String(pasta || '').trim() || process.cwd());
  const cmd = String(comando || '').trim();
  if (!cmd) return Promise.resolve('ERRO: informe o comando git.');
  return new Promise((resolve) => {
    exec(`git ${cmd}`, { timeout: 60000, cwd: dir, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      const out = String(stdout || '').trim();
      const errTxt = String(stderr || '').trim();
      let r = out || (err ? '(sem saída)' : '(comando git executado com sucesso, sem saída)');
      if (errTxt && !out) r += '\n[stderr]\n' + errTxt.slice(0, 1500);
      if (err && !out && !errTxt) r = 'ERRO: ' + err.message;
      resolve(r.slice(0, 3000));
    });
  });
}

async function baixarGithub(repo, destino) {
  const r = String(repo || '').trim();
  if (!r.includes('/')) return { erro: 'Formato inválido. Use owner/repo (ex: facebook/react).' };
  const dir = path.resolve(String(destino || '').trim() || path.join(DATA_BOT, 'github', r.replace(/[^\w.-]+/g, '_')));
  fs.mkdirSync(dir, { recursive: true });
  for (const branch of ['main', 'master']) {
    try {
      const url = `https://codeload.github.com/${r}/zip/refs/heads/${branch}`;
      const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000, maxBodyLength: 2 * 1024 * 1024 * 1024, headers: UA });
      const buf = Buffer.from(res.data);
      if (buf.length < 200) continue;
      const zip = path.join(dir, `repo_${branch}.zip`);
      fs.writeFileSync(zip, buf);
      const seg = await validarExtraccaoSegura(zip);
      if (seg && !String(seg).trim().startsWith('OK')) {
        fs.unlinkSync(zip);
        return { erro: `🛡️ ${seg}` };
      }
      await runCmd(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dir}' -Force"`, 120000);
      fs.unlinkSync(zip);
      const inner = fs.existsSync(path.join(dir, r.split('/')[1] + '-' + branch)) ? path.join(dir, r.split('/')[1] + '-' + branch) : dir;
      return { ok: true, destino: inner, observacao: `Repositório ${r} baixado e extraído em ${inner}` };
    } catch (e) { /* tenta próxima branch */ }
  }
  return { erro: `Falha ao baixar ${r} (branch main/master indisponível ou rede bloqueada).` };
}

async function visitarSite(url) {
  let u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const { data } = await axios.get(u, { headers: UA, timeout: 30000, maxRedirects: 5 });
    const $ = cheerio.load(data);
    const titulo = clean($('title').first().text(), 150);
    const h1 = clean($('h1').first().text(), 200);
    const desc = clean($('meta[name="description"]').attr('content'), 300);
    const paragrafos = $('p').map((i, el) => clean($(el).text(), 400)).get().filter(Boolean).slice(0, 10);
    const links = $('a').filter((i, el) => $(el).attr('href')).map((i, el) => {
      const a = $(el);
      const href = a.attr('href');
      if (!href || href.startsWith('#')) return null;
      return `${clean(a.text(), 60) || href} → ${href}`;
    }).get().filter(Boolean).slice(0, 12);
    return {
      url: u,
      titulo: titulo || 'Sem título',
      h1: h1 || null,
      descricao: desc || null,
      texto: paragrafos.length ? paragrafos.join('\n') : null,
      links,
    };
  } catch (e) {
    return { erro: `Não consegui visitar ${u}: ${e.message}` };
  }
}

function abrirSiteNavegador(url, delayMs) {
  let u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return comDelay(runCmd(`start "" "${u}"`, 10000).then(() => `Abri no navegador: ${u}`), delayMs);
}

function capturaTela(opts = {}) {
  const dir = path.join(DATA_BOT, 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `print_${Date.now()}.png`);
  // ⏳ delayMs: espera a página/aba carregar antes de capturar (evita print da
  // tela antiga quando o dono acabou de mandar abrir um site). Máx 30s.
  const delayMs = Math.min(parseInt(opts.delayMs, 10) || 0, 30000);
  const aguardar = delayMs > 0
    ? new Promise((resolve) => setTimeout(resolve, delayMs))
    : Promise.resolve();
  // 🪟 Padrão: captura a JANELA ATIVA (o site/aba que está na frente — ideal
  // quando o dono pede print de um site). Use telaInteira: true para capturar
  // todos os monitores (desktop inteiro).
  // 📌 ativar: nome do navegador/janela (ex: 'chrome', 'edge', 'firefox',
  // 'brave', 'opera') para TRAZER À FRENTE antes do print via AppActivate —
  // garante que o print sai da janela certa mesmo se o navegador abriu atrás
  // de outras janelas ou ficou minimizado.
  // Escapa aspas simples (PowerShell dobra '' dentro de string '...') — evita
  // quebra de script ou injeção via nome de janela vindo dos args da IA.
  const alvoAtivar = String(opts.ativar || '').trim().replace(/'/g, "''");
  const ativacao = alvoAtivar ? [
    `$wshell = New-Object -ComObject wscript.shell`,
    `$null = $wshell.AppActivate('${alvoAtivar}')`,
    `Start-Sleep -Milliseconds 600`,
  ] : [];
  const janelaAtiva = opts.telaInteira !== true;
  const linhas = janelaAtiva ? [
    `Add-Type -AssemblyName System.Windows.Forms,System.Drawing`,
    ...ativacao,
    `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class WinApi { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r); public struct RECT { public int Left, Top, Right, Bottom; } }'`,
    // 🪟 Captura a janela ativa; clampa origem E tamanho contra a VirtualScreen
    // (resolve desktop em foco, janela minimizada e bordas invisíveis do Win11
    // em janela maximizada). Se mesmo assim inválida, usa a VirtualScreen inteira.
    `$h = [WinApi]::GetForegroundWindow()`,
    `$r = New-Object WinApi+RECT`,
    `[WinApi]::GetWindowRect($h, [ref]$r) | Out-Null`,
    `$b = [System.Windows.Forms.SystemInformation]::VirtualScreen`,
    `$x = [Math]::Max($b.Left, $r.Left); $y = [Math]::Max($b.Top, $r.Top)`,
    `$w = [Math]::Min($b.Right, $r.Right) - $x; $ht = [Math]::Min($b.Bottom, $r.Bottom) - $y`,
    `if ($w -le 0 -or $ht -le 0) { $w = $b.Width; $ht = $b.Height; $x = $b.Left; $y = $b.Top }`,
    `$bmp = New-Object System.Drawing.Bitmap $w, $ht`,
    `$g = [System.Drawing.Graphics]::FromImage($bmp)`,
    `$g.CopyFromScreen($x, $y, 0, 0, (New-Object System.Drawing.Size($w, $ht)))`,
    `$bmp.Save('${out}', [System.Drawing.Imaging.ImageFormat]::Png)`,
    `$g.Dispose(); $bmp.Dispose()`,
  ] : [
    `Add-Type -AssemblyName System.Windows.Forms,System.Drawing`,
    ...ativacao,
    `$b = [System.Windows.Forms.SystemInformation]::VirtualScreen`,
    `$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height`,
    `$g = [System.Drawing.Graphics]::FromImage($bmp)`,
    `$g.CopyFromScreen($b.Left, $b.Top, 0, 0, $b.Size)`,
    `$bmp.Save('${out}', [System.Drawing.Imaging.ImageFormat]::Png)`,
    `$g.Dispose(); $bmp.Dispose()`,
  ];
  return aguardar.then(() => runPowerShell(linhas, 30000).then((r) => {
    if (fs.existsSync(out) && fs.statSync(out).size > 500) {
      return { ok: true, arquivo: out, tamanhoBytes: fs.statSync(out).size, observacao: 'Print salvo. Use [ARQUIVO: caminho] para enviar ao WhatsApp.' };
    }
    return { erro: `Print falhou (talvez sem sessão gráfica ativa): ${r.slice(0, 200)}` };
  }));
}

function lixeira(acao, termo) {
  const a = String(acao || 'listar').toLowerCase();
  if (a === 'recuperar') {
    const t = String(termo || '').trim();
    if (!t) return Promise.resolve('ERRO: informe o termo do arquivo a recuperar.');
    return runPowerShell([
      `$shell = New-Object -ComObject Shell.Application`,
      `$rb = $shell.Namespace(0xA)`,
      `$found = @()`,
      `foreach ($i in $rb.Items()) { if ($i.Name -match '$t') { $found += $i } }`,
      `if ($found.Count -eq 0) { "Nada encontrado na lixeira com: $t" } else {`,
      `  foreach ($i in $found) {`,
      `    try { $i.InvokeVerb('Restore'); "RESTAURADO: $($i.Name)" } catch { "FALHA ao restaurar $($i.Name): $($_.Exception.Message)" }`,
      `  }`,
      `}`,
    ], 60000);
  }
  return runPowerShell([
    `$shell = New-Object -ComObject Shell.Application`,
    `$rb = $shell.Namespace(0xA)`,
    `$itens = $rb.Items()`,
    `if ($itens.Count -eq 0) { "LIXEIRA VAZIA" } else {`,
    `  foreach ($i in $itens) { " - $($i.Name) | excluido: $($rb.GetDetailsOf($i, 2))" }`,
    `  "Total: $($itens.Count) itens na lixeira"`,
    `}`,
  ], 60000);
}

// ===== REVISÃO DE CÓDIGO =====

const IGNORE_DIRS = new Set(['node_modules', '.git', 'data', 'downloads', 'screenshots', 'ps_tmp']);

function projetoArquivos(pastaBase) {
  const base = path.resolve(String(pastaBase || '').trim() || process.cwd());
  const out = [];
  function walk(dir, depth = 0) {
    if (depth > 4 || out.length >= 300) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (/\\.(js|json|md|html|css)$/i.test(e.name) && !e.name.endsWith('.bak')) out.push(full);
    }
  }
  walk(base);
  return out;
}

function listarProjeto(pasta) {
  const files = projetoArquivos(pasta);
  if (!files.length) return 'Nenhum arquivo de código encontrado nessa pasta.';
  return `📁 ${files.length} arquivos de código:\n` + files.map(f => f.replace(process.cwd(), '.')).join('\n');
}

/** 📁 Arquivos do projeto modificados recentemente (por mtime). */
function arquivosModificados(dias, max) {
  const nDias = Math.max(1, Number(dias) || 1);
  const nMax = Math.min(100, Math.max(1, Number(max) || 25));
  const corte = Date.now() - nDias * 24 * 60 * 60 * 1000;
  const files = projetoArquivos();
  const modificados = [];
  for (const f of files) {
    try {
      const st = fs.statSync(f);
      if (st.mtimeMs >= corte) {
        const rel = f.replace(process.cwd(), '.').replace(/\\/g, '/');
        const quando = new Date(st.mtimeMs).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        // guarda mtimeMs pra ORDENAR por data (mais recente primeiro)
        modificados.push({ rel, quando, mtimeMs: st.mtimeMs });
      }
    } catch (e) { /* arquivo sumiu/erro de stat não bloqueia */ }
  }
  if (!modificados.length) return `Nenhum arquivo do projeto modificado nos últimos ${nDias} dia(s).`;
  modificados.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return `📂 ${modificados.length} arquivo(s) modificado(s) nos últimos ${nDias} dia(s):\n` +
    modificados.slice(0, nMax).map((m) => `• ${m.rel} — ${m.quando}`).join('\n');
}

function lerProjeto(arquivos, pasta) {
  const alvos = String(arquivos || '').split(',').map(s => s.trim()).filter(Boolean);
  let files;
  if (alvos.length) {
    files = alvos.map(a => path.resolve(process.cwd(), a));
  } else {
    files = projetoArquivos(pasta);
  }
  const partes = [];
  for (const f of files.slice(0, 20)) {
    try {
      const content = fs.readFileSync(f, 'utf-8');
      partes.push(`\n===== ${f.replace(/\\/g, '/')} (${Math.round(content.length / 1024)} KB) =====\n${content.slice(0, 9000)}${content.length > 9000 ? '\n…(truncado, use ler_arquivo para o restante)' : ''}`);
    } catch (e) {
      partes.push(`\n===== ${f} =====\nERRO ao ler: ${e.message}`);
    }
  }
  return partes.join('\n').slice(0, 30000);
}

async function checarCodigo(pasta) {
  const files = projetoArquivos(pasta).filter(f => f.endsWith('.js'));
  if (!files.length) return 'Nenhum arquivo .js encontrado.';
  const erros = [];
  const { execSync } = require('child_process');
  for (const f of files) {
    try {
      execSync(`node --check "${f}"`, { timeout: 30000 });
    } catch (e) {
      erros.push(`${f}: ${String(e.stdout || e.message).split('\n')[0].split(':').slice(2).join(':').trim() || e.message}`);
    }
  }
  if (!erros.length) return `✅ node --check: os ${files.length} arquivos .js do projeto passaram SEM erros de sintaxe.`;
  return `⚠️ ${erros.length} arquivo(s) com problema de sintaxe:\n` + erros.join('\n');
}

async function grepCodigo(padrao, pasta) {
  const files = projetoArquivos(pasta);
  const re = new RegExp(String(padrao || ''), 'i');
  const hits = [];
  for (const f of files) {
    try {
      const lines = fs.readFileSync(f, 'utf-8').split('\n');
      for (let i = 0; i < lines.length && hits.length < 40; i++) {
        if (re.test(lines[i])) {
          hits.push(`${f.replace(process.cwd(), '.').replace(/\\/g, '/')}:${i + 1}: ${lines[i].trim().slice(0, 120)}`);
        }
      }
    } catch (e) {}
  }
  return hits.length ? hits.join('\n') : `Nada encontrado para o padrão: ${padrao}`;
}

// ===== FERRAMENTAS DINÂMICAS (o agente cria as próprias ferramentas) =====
// Guardadas em ia_tools_custom.js (JSON). O código é compilado em runtime com
// helpers injetadas (runCmd, runPowerShell, axios, fs, ...). Fica disponível
// na mesma sessão porque o loop recarrega getToolSchemas() a cada rodada.

const CUSTOM_TOOLS_FILE = path.join(__dirname, 'ia_tools_custom.js');

function loadCustomTools() {
  try {
    if (!fs.existsSync(CUSTOM_TOOLS_FILE)) return [];
    const arr = JSON.parse(fs.readFileSync(CUSTOM_TOOLS_FILE, 'utf-8'));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveCustomTools(lista) {
  fs.mkdirSync(path.dirname(CUSTOM_TOOLS_FILE), { recursive: true });
  fs.writeFileSync(CUSTOM_TOOLS_FILE, JSON.stringify(lista, null, 2));
}

function customHelpers() {
  return {
    runCmd, runPowerShell, axios, cheerio, fs, path, os, exec, spawn,
    youtubedl, ffmpegPath, lembretes,
    buscarWeb, buscarImagens, buscarGithub, buscarWikipedia,
    config,
  };
}

function compileCustomTool(entry) {
  const helpersNames = `runCmd, runPowerShell, axios, cheerio, fs, path, os, exec, spawn, youtubedl, ffmpegPath, lembretes, buscarWeb, buscarImagens, buscarGithub, buscarWikipedia, config`;
  // eslint-disable-next-line no-new-func
  const fn = new Function('args', 'toolCtx', 'helpers', `
    const { ${helpersNames} } = helpers;
    return (async () => {
      ${entry.code}
    })();
  `);
  return fn;
}

// 🛡️ Blindagem de código de ferramenta custom: o compileCustomTool roda o
// código num new Function SEM require/import no escopo (só os helpers injetados:
// runCmd, runPowerShell, axios, cheerio, fs, path, os, exec, spawn, youtubedl,
// ffmpegPath, lembretes, buscarWeb, buscarImagens, buscarGithub, buscarWikipedia,
// config). Se a IA escrever require(...) a tool quebraria em runtime (bug real
// que já aconteceu) — bloqueia na CRIAÇÃO com mensagem clara. Retorna string de
// erro ou null se o código estiver limpo.
function validarCodigoFerramenta(codigo) {
  const c = String(codigo || '');
  const m = c.match(/require\s*\(/i);
  if (m) {
    return 'ERRO: o código usa require() — isso NÃO funciona no ambiente das ferramentas custom (não existe require no escopo). Use os helpers que JÁ estão disponíveis: axios, cheerio, fs, path, os, exec, spawn, runCmd, runPowerShell, buscarWeb, buscarImagens, buscarGithub, buscarWikipedia, lembretes, config. Ex: const { data } = await axios.get(url);';
  }
  if (/import\s*\(/i.test(c)) {
    return 'ERRO: o código usa import() dinâmico — isso NÃO funciona no ambiente das ferramentas custom. Use os helpers que JÁ estão disponíveis: axios, cheerio, fs, path, os, exec, spawn, runCmd, runPowerShell, buscarWeb, buscarImagens, buscarGithub, buscarWikipedia, lembretes, config.';
  }
  return null;
}

function criarFerramenta(nome, descricao, parametros, codigo) {
  const n = String(nome || '').trim();
  if (!/^[a-z_][a-z0-9_]{2,49}$/i.test(n)) {
    return 'ERRO: nome inválido. Use só letras/números/underscore, mínimo 3 caracteres (ex: buscar_preco).';
  }
  if (!String(codigo || '').trim()) {
    return 'ERRO: informe o código JavaScript da ferramenta.';
  }
  // 🛡️ Bloqueia require()/import() fora do escopo ANTES de salvar a tool.
  const errCode = validarCodigoFerramenta(codigo);
  if (errCode) return errCode;
  const lista = loadCustomTools();
  if (lista.some(t => t.name === n)) {
    return `ERRO: já existe a ferramenta "${n}". Use apagar_ferramenta primeiro ou escolha outro nome.`;
  }
  let schema;
  try {
    schema = parametros ? JSON.parse(String(parametros)) : { type: 'object', properties: {}, required: [] };
    if (!schema.type) schema.type = 'object';
    if (!schema.properties) schema.properties = {};
  } catch (e) {
    return 'ERRO: "parametros" deve ser um JSON Schema válido (ex: {"type":"object","properties":{"item":{"type":"string"}},"required":["item"]}).';
  }
  const entry = {
    name: n,
    description: String(descricao || `Ferramenta criada para ${n}`),
    parameters: schema,
    code: String(codigo),
    criadaEm: Date.now(),
  };
  try {
    compileCustomTool(entry);
  } catch (e) {
    return `ERRO: o código da ferramenta tem erro de sintaxe: ${String(e.message || e).split('\n')[0]}`;
  }
  lista.push(entry);
  saveCustomTools(lista);
  return `✅ Ferramenta "${n}" CRIADA e já está disponível para você usar nesta sessão. Use ${n}(...) com os parâmetros definidos.`;
}

function apagarFerramenta(nome) {
  const n = String(nome || '').trim();
  const lista = loadCustomTools();
  const antes = lista.length;
  const nova = lista.filter(t => t.name !== n);
  if (nova.length === antes) return `Não existe a ferramenta "${n}".`;
  saveCustomTools(nova);
  return `🗑️ Ferramenta "${n}" apagada.`;
}

function listarFerramentas() {
  const nativas = TOOL_SCHEMAS.map(t => `• ${t.name}`);
  const custom = loadCustomTools().map(t => `• ${t.name} (criada por mim)`);
  return `Ferramentas disponíveis (${nativas.length + custom.length}):\n${nativas.join('\n')}${custom.length ? '\nCriadas:\n' + custom.join('\n') : ''}`;
}

// 💰 ECONOMIA DE TOKENS: descrições longas de ferramentas são comprimidas em runtime.
// Os schemas vão em TODA mensagem do modo agente (function calling) e o Gemini cobra
// por token — descrições de 300-700 chars inflam a conta. Mantém o COMEÇO (o que a
// ferramenta faz) e o FIM (quem pode usar: "Só dono", "QUALQUER pessoa"), cortando o
// meio verboso. As descrições completas permanecem no TOOL_SCHEMAS do código.
const MAX_DESC_TOOL = 280;   // teto de caracteres por descrição de ferramenta
const MAX_DESC_PARAM = 130;  // teto de caracteres por descrição de parâmetro
const INICIO_DESC = 170;     // chars do começo preservados
const FIM_DESC = 90;         // chars do fim preservados (permissões)
// 🛡️ Ferramentas SENSÍVEIS: a descrição COMPLETA é mantida (sem cortes) porque as
// regras de uso seguro ficam no MEIO (ex: "NUNCA para responder dúvidas sobre rajada",
// "use SÓ quando pedirem explicitamente"). Cortar poderia fazer a IA usar mal.
const DESC_SEM_CORTE = new Set([
  'rajar_whatsapp', 'nukar_grupo', 'flood_ngl', 'flood_sendit',
  'consultar_dado', 'consultar_datora', 'executar_comando_corvo',
  'vender_vip', 'gerenciar_vip', 'postar_conteudo_canal',
  // 🔒 Segurança de arquivo: regras de backup/arquivo grande ficam no MEIO das
  // descrições ("NUNCA reescreva o arquivo inteiro", "use linhas", FLUXO ler→editar→reler)
  'ler_arquivo', 'editar_arquivo', 'criar_arquivo', 'criar_comando', 'criar_ferramenta',
  // Regra condicional no meio ("pesquise ANTES de executar")
  'pesquisar_solucao',
]);

// Corta em FRONTEIRA DE PALAVRA: volta até o último espaço (INCLUINDO o espaço, pra
// descrição nunca terminar no meio de uma palavra); se não houver espaço bom antes,
// AVANÇA até o próximo espaço
function cortarEmPalavra(texto, max) {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  const espaco = corte.lastIndexOf(' ');
  if (espaco > max * 0.6) return corte.slice(0, espaco + 1);
  const prox = texto.indexOf(' ', max);
  if (prox > -1 && prox < max + 40) return texto.slice(0, prox + 1);
  return corte;
}

function compactarDescricao(desc) {
  const d = String(desc || '');
  if (d.length <= MAX_DESC_TOOL) return d;
  const inicio = cortarEmPalavra(d, INICIO_DESC).trimEnd();
  // fim preservado: pega os últimos FIM_DESC chars e avança até o primeiro espaço
  let fim = d.slice(-FIM_DESC).trimStart();
  const espacoFim = fim.indexOf(' ');
  if (espacoFim > 0 && espacoFim < fim.length * 0.4) fim = fim.slice(espacoFim + 1);
  return inicio + ' … ' + fim;
}

function compactarSchemas(schemas) {
  return (schemas || []).map(s => {
    const out = { ...s };
    if (s.description && !DESC_SEM_CORTE.has(s.name)) out.description = compactarDescricao(s.description);
    if (s.parameters && s.parameters.properties) {
      const props = {};
      for (const [k, v] of Object.entries(s.parameters.properties)) {
        props[k] = (v && v.description && String(v.description).length > MAX_DESC_PARAM)
          ? { ...v, description: cortarEmPalavra(String(v.description), MAX_DESC_PARAM) + '…' }
          : v;
      }
      out.parameters = { ...s.parameters, properties: props };
    }
    return out;
  });
}

function getToolSchemas() {
  return compactarSchemas([
    ...TOOL_SCHEMAS,
    ...loadCustomTools().map(t => ({ name: t.name, description: t.description, parameters: t.parameters })),
  ]);
}

async function executeCustomTool(name, args, toolCtx) {
  return { erro: 'Ferramentas personalizadas indisponíveis nesta versão do bot.' };
  try {
    const fn = compileCustomTool(entry);
    return await fn(args || {}, toolCtx || {}, customHelpers());
  } catch (e) {
    return { erro: `Erro ao executar "${name}": ${String(e.message || e)}` };
  }
}

// ===== 🚀 COMANDOS DINÂMICOS DO BOT (criados pela IA, carregam SEM reiniciar) =====
// O loader de comandos do grupo (src/grupo/index.js) expõe registrarComandoDinamico,
// removerComandoDinamico e getDynamicCommands. A IA cria/edita/apaga comandos
// e eles ficam disponíveis no grupo NA HORA, sem reiniciar o bot.

const GRUPO_DIR = path.join(__dirname, '..', 'grupo');

function validarCodigoComando(codigo) {
  try {
    // ⚠️ Concatenação em vez de template literal: o código do handler pode conter
    // ${...} (template strings JS) que seriam INTERPOLADOS na hora e quebrariam
    // a validação. Concatenar preserva o código exatamente como o dono pediu.
    // eslint-disable-next-line no-new-func
    new Function('ctx', 'return (async (ctx) => {\n' + String(codigo) + '\n});');
    return null;
  } catch (e) {
    return `O código do comando tem erro de sintaxe: ${String(e.message || e).split('\n')[0]}. Corrija antes de criar.`;
  }
}

function criarComandoDinamico(nome, descricao, codigo) {
  const n = String(nome || '').trim().toLowerCase().replace(/^\//, '');
  if (!/^[a-z][a-z0-9_]{1,31}$/i.test(n)) {
    return { erro: 'Nome de comando inválido. Use só letras, números e _ (ex: regras, piada).' };
  }
  if (!String(codigo || '').trim()) return { erro: 'Informe o código do handler do comando (async ctx => { ... }).' };
  const erro = validarCodigoComando(codigo);
  if (erro) return { erro };

  // Já existe? (estático ou dinâmico)
  const existente = grupoComandos.getGroupCommands().find(c => c.command === n);
  if (existente) {
    return { erro: `Já existe um comando /${n} (${existente.file || 'carregado'}). Use apagar_comando antes ou escolha outro nome.` };
  }

  // ⚠️ Colisão com comando FIXO do corvo.js? O switch fixo tem prioridade no
  // dispatch — se o nome já existe lá, o comando dinâmico NUNCA dispararia.
  try {
    const srcRam = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'corvo.js'), 'utf-8');
    // Cobre os 3 estilos de dispatch do corvo: case "x":, if (command == "x")
    // (ou ===) e if (budy2 === "x") — assim nenhum comando fixo é sombreado.
    const temColisao = new RegExp(
      `(?:case\\s*["']${n}["']\\s*:|command\\s*(?:===|==)\\s*["']${n}["']|budy2\\s*===?\\s*["']${n}["'])`
    ).test(srcRam);
    if (temColisao) {
      return { erro: `Já existe um comando fixo /${n} no bot. O comando dinâmico nunca dispararia porque o fixo tem prioridade — escolha outro nome.` };
    }
  } catch (e) { /* se não der pra ler o corvo.js, segue sem essa checagem */ }

  // Grava o arquivo em src/grupo/<nome>.js no padrão do loader (persiste após reiniciar)
  const arquivo = path.join(GRUPO_DIR, `${n}.js`);
  // ⚠️ Concatenação em vez de template literal: o código do handler pode conter
  // ${...} (template strings JS, ex: ctx.reply(`Oi ${nome}`)) — se fosse
  // interpolado aqui, corromperia o arquivo gerado. Concatenar preserva tudo.
  const linhasCodigo = String(codigo).split('\n').map(l => '    ' + l).join('\n');
  const conteudo =
    '/**\n * 🤖 Comando dinâmico criado pela IA (' + new Date().toLocaleString('pt-BR') + ')\n * Comando: /' + n + '\n */\n' +
    'module.exports = {\n' +
    "  command: '" + n + "',\n" +
    '  description: ' + JSON.stringify(String(descricao || '')) + ',\n' +
    '  handler: async (ctx) => {\n' +
    linhasCodigo + '\n' +
    '  }\n' +
    '};\n';
  try {
    fs.writeFileSync(arquivo, conteudo, 'utf-8');
  } catch (e) {
    return { erro: `Não consegui gravar o arquivo do comando: ${e.message}` };
  }

  // Carrega o módulo recém-criado e registra no runtime (sem reiniciar)
  try {
    delete require.cache[require.resolve(arquivo)];
    const mod = require(arquivo);
    const cmd = Array.isArray(mod) ? mod[0] : mod;
    const c = core.getCore();
    const r = grupoComandos.registrarComandoDinamico(c.bot || c.corvo, { ...cmd, file: `${n}.js` }, c.logEvent);
    if (!r || !r.ok) {
      try { fs.unlinkSync(arquivo); } catch (e2) {}
      return { erro: r.erro };
    }
    return { ok: true, mensagem: `✅ Comando /${n} CRIADO e CARREGADO na hora (sem reiniciar o bot)! Já pode ser usado no grupo: /${n}\n📖 ${descricao || 'Sem descrição.'}` };
  } catch (e) {
    try { fs.unlinkSync(arquivo); } catch (e2) {}
    return { erro: `Falha ao carregar o comando criado: ${String(e.message || e).split('\n')[0]}` };
  }
}

function apagarComandoDinamico(nome) {
  const n = String(nome || '').trim().toLowerCase().replace(/^\//, '');
  const r = grupoComandos.removerComandoDinamico(n);
  // SEMPRE tenta apagar o arquivo (mesmo se o comando tiver virado estático após
  // reinício) — o registro do bot termina no próximo boot, mas o arquivo some já.
  const arquivo = path.join(GRUPO_DIR, `${n}.js`);
  let arquivoApagado = false;
  try { if (fs.existsSync(arquivo)) { fs.unlinkSync(arquivo); arquivoApagado = true; } } catch (e) {}
  if ((!r || !r.ok) && !arquivoApagado) return r;
  const nota = r.estatico
    ? ' (estava carregado como estático nesta sessão: saiu da lista e o arquivo foi apagado; o registro no bot termina neste reinício)'
    : ' (sem reiniciar)';
  return { ok: true, mensagem: `🗑️ Comando /${n} REMOVIDO. Arquivo src/grupo/${n}.js apagado${nota}` };
}

function listarComandosDinamicos() {
  const lista = grupoComandos.getDynamicCommands();
  if (!lista.length) return 'Nenhum comando dinâmico criado ainda. Use criar_comando para criar um (ex: /regras).';
  return `🚀 Comandos dinâmicos carregados (${lista.length}):\n` + lista.map(c => `• /${c.command} — ${c.description || 'sem descrição'}`).join('\n');
}

// ===== USO DO PC COMO PESSOA (teclado, mouse, janelas, clipboard, volume) =====

const TELLER = {
  enter: '{ENTER}', tab: '{TAB}', esc: '{ESC}', espaço: ' ', espaco: ' ',
  f5: '{F5}', f2: '{F2}', f11: '{F11}', backspace: '{BACKSPACE}', delete: '{DELETE}',
  home: '{HOME}', end: '{END}', print: '{PRTSC}', menu: '{APPS}',
  cima: '{UP}', baixo: '{DOWN}', esquerda: '{LEFT}', direita: '{RIGHT}',
  'pagina para cima': '{PGUP}', 'pagina para baixo': '{PGDN}',
  'page up': '{PGUP}', 'page down': '{PGDN}',
};

function buildSendKeys(combinacao) {
  const parts = String(combinacao || '').toLowerCase().split('+').map(p => p.trim());
  let out = '';
  let ctrl = false, alt = false, shift = false, win = false;
  for (const p of parts) {
    if (!p) continue;
    if (p === 'ctrl' || p === 'control') { ctrl = true; continue; }
    if (p === 'alt') { alt = true; continue; }
    if (p === 'shift') { shift = true; continue; }
    if (p === 'win' || p === 'windows') { win = true; continue; }
    const base = TELLER[p] || p;
    const key = base.replace(/\{(.*)\}/, '$1');
    const isBrace = base.startsWith('{');
    let s = '';
    if (ctrl) s += '^';
    if (alt) s += '%';
    if (shift) s += '+';
    if (isBrace && ctrl && !alt && !shift) { s = '^'; }
    if (isBrace && !ctrl && !alt && !shift && s === '') { s = ''; }
    out += s + base;
  }
  if (win) out = out.replace(/^\^/, '');
  return out || '{ENTER}';
}

function escreverTeclado(texto, delayMs) {
  const t = String(texto || '');
  if (!t) return Promise.resolve('ERRO: informe o texto a digitar.');
  const safe = t
    .replace(/\+/g, '{+}').replace(/\^/g, '{^}').replace(/%/g, '{%}')
    .replace(/~/g, '{~}').replace(/\(/g, '{(}').replace(/\)/g, '{)}')
    .replace(/\[/g, '{{[').replace(/\]/g, '{]}')
    .replace(/\{/g, '{{}').replace(/\}/g, '{}}');
  const ps = [
    `$ws = New-Object -ComObject WScript.Shell`,
    `$ws.SendKeys('${safe.slice(0, 400)}')`,
    `'Texto digitado (${t.length} caracteres).'`,
  ];
  return comDelay(runPowerShell(ps, 20000), delayMs);
}

function simularTeclas(teclas, delayMs) {
  const tk = String(teclas || '').trim();
  if (!tk) return Promise.resolve('ERRO: informe as teclas (ex: enter, ctrl+s, alt+tab).');
  const key = buildSendKeys(tk);
  const ps = [
    `$ws = New-Object -ComObject WScript.Shell`,
    `$ws.SendKeys('${key}')`,
    `'Teclas enviadas: ${tk} (→ ${key})'`,
  ];
  return comDelay(runPowerShell(ps, 20000), delayMs);
}

function clicarMouse(x, y, botao, delayMs) {
  const px = Math.round(Number(x));
  const py = Math.round(Number(y));
  if (isNaN(px) || isNaN(py)) return Promise.resolve('ERRO: informe x e y válidos.');
  const b = String(botao || 'esquerdo').toLowerCase();
  const ps = [
    `Add-Type -AssemblyName System.Windows.Forms`,
    `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y); [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwExtraInfo, UIntPtr data); }'`,
    `[Mouse]::SetCursorPos(${px}, ${py}) | Out-Null`,
    `Start-Sleep -Milliseconds 80`,
    b === 'direito'
      ? `[Mouse]::mouse_event(0x08, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 40; [Mouse]::mouse_event(0x10, 0, 0, 0, [UIntPtr]::Zero)`
      : b === 'duplo'
        ? `[Mouse]::mouse_event(0x02, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 40; [Mouse]::mouse_event(0x04, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60; [Mouse]::mouse_event(0x02, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 40; [Mouse]::mouse_event(0x04, 0, 0, 0, [UIntPtr]::Zero)`
        : `[Mouse]::mouse_event(0x02, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 40; [Mouse]::mouse_event(0x04, 0, 0, 0, [UIntPtr]::Zero)`,
    `"Clique ${b} em (${px}, ${py}) executado."`,
  ];
  return comDelay(runPowerShell(ps, 20000), delayMs);
}

function janelas(acao, titulo, delayMs) {
  const a = String(acao || 'listar').toLowerCase();
  if (a === 'focar') {
    const t = String(titulo || '').trim();
    if (!t) return Promise.resolve('ERRO: informe o título da janela a focar.');
    return comDelay(runPowerShell([
      `$ws = New-Object -ComObject WScript.Shell`,
      `$ok = $ws.AppActivate('${t.replace(/'/g, "''")}')`,
      `if ($ok) { "Janela '${t}' trazida para frente." } else { "Não encontrei janela com '${t}'. Veja janelas(acao=listar)." }`,
    ], 15000), delayMs);
  }
  return runPowerShell([
    `Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object -First 15 | ForEach-Object { " - [$($_.Id)] $($_.ProcessName): $($_.MainWindowTitle)" }`,
  ], 20000);
}

function clipboard(acao, texto) {
  const a = String(acao || 'ler').toLowerCase();
  if (a === 'escrever') {
    const t = String(texto || '');
    if (!t) return Promise.resolve('ERRO: informe o texto a copiar.');
    return runPowerShell([
      `Set-Clipboard -Value '${t.replace(/'/g, "''").slice(0, 2000)}'`,
      `'Copiado para a área de transferência (${t.length} caracteres).'`,
    ], 15000);
  }
  return runPowerShell([
    `$c = Get-Clipboard -Raw`,
    `if ([string]::IsNullOrEmpty($c)) { '(área de transferência vazia)' } else { $c }`,
  ], 15000);
}

function volume(acao) {
  const a = String(acao || 'subir').toLowerCase();
  const code = a === 'baixar' ? '0xAE' : a === 'mudo' ? '0xAD' : '0xAF';
  const nome = a === 'baixar' ? 'volume baixou' : a === 'mudo' ? 'mudo ativado/desativado' : 'volume subiu';
  return runPowerShell([
    `Add-Type -Namespace W -Name K -MemberDefinition '[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, System.UIntPtr dwExtraInfo);'`,
    `[W.K]::keybd_event(${code}, 0, 0, [System.UIntPtr]::Zero)`,
    `[W.K]::keybd_event(${code}, 0, 2, [System.UIntPtr]::Zero)`,
    `'OK: ${nome}.'`,
  ], 15000);
}

// ===== NAVEGAÇÃO NO PC (abrir arquivos, explorer, unidades, estrutura) =====

function abrirArquivo(caminho, delayMs) {
  const c = String(caminho || '').trim();
  if (!c) return Promise.resolve('ERRO: informe o caminho do arquivo/pasta/link.');
  return comDelay(runCmd(`start "" "${c}"`, 15000).then(() => `Aberto: ${c}`), delayMs);
}

function navegarPasta(caminho, arquivo, delayMs) {
  const c = String(caminho || '').trim();
  if (!c) return Promise.resolve('ERRO: informe a pasta.');
  if (arquivo) {
    const f = String(arquivo).trim();
    return comDelay(runPowerShell([
      `if (Test-Path '${c}\\${f}') { explorer.exe /select, '${c}\\${f}'; 'Explorer aberto com o arquivo selecionado: ${f}' } else { explorer.exe '${c}'; 'Pasta aberta (arquivo ${f} não existe lá).' }`,
    ], 15000), delayMs);
  }
  return comDelay(runCmd(`explorer.exe "${c}"`, 15000).then(() => `Explorer aberto em: ${c}`), delayMs);
}

function unidades() {
  return runPowerShell([
    `Get-PSDrive -PSProvider FileSystem | ForEach-Object { "Unidade $($_.Name): livre $([math]::Round($_.Free/1GB,1)) GB de $([math]::Round(($_.Free+$_.Used)/1GB,1)) GB" }`,
  ], 20000);
}

function mapearEstrutura(caminho) {
  const base = path.resolve(String(caminho || '').trim() || os.homedir());
  if (!fs.existsSync(base)) return Promise.resolve(`ERRO: pasta não existe: ${base}`);
  const lines = [`📂 ${base}`];
  try {
    const itens = fs.readdirSync(base, { withFileTypes: true });
    for (const it of itens.slice(0, 30)) {
      const full = path.join(base, it.name);
      let sub = '';
      if (it.isDirectory()) {
        try {
          const subItens = fs.readdirSync(full, { withFileTypes: true });
          sub = subItens.slice(0, 6).map(s => `${s.isDirectory() ? '📁' : '📄'} ${s.name}`).join('  ');
          if (subItens.length > 6) sub += `  …(+${subItens.length - 6})`;
        } catch (e) {}
      }
      lines.push(`  ${it.isDirectory() ? '📁' : '📄'} ${it.name}${sub ? `\n      ${sub}` : ''}`);
    }
  } catch (e) {
    return Promise.resolve(`ERRO ao mapear: ${e.message}`);
  }
  return Promise.resolve(lines.join('\n'));
}

function ziparPasta(origem, destino) {
  const src = path.resolve(String(origem || '').trim());
  if (!fs.existsSync(src)) return Promise.resolve(`ERRO: pasta/arquivo não existe: ${src}`);
  const dst = path.resolve(String(destino || '').trim());
  if (!dst.toLowerCase().endsWith('.zip')) return Promise.resolve('ERRO: o destino precisa terminar com .zip (ex: C:\\corvo\\corvo\\data\\downloads\\projeto.zip).');
  try {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    return runPowerShell([
      `Compress-Archive -LiteralPath '${src}' -DestinationPath '${dst}' -Force`,
      `"✅ ZIP criado: ${dst}"`,
    ], 180000);
  } catch (e) {
    return Promise.resolve(`ERRO ao compactar: ${e.message}`);
  }
}

function criarPasta(caminho) {
  try {
    const p = path.resolve(String(caminho || '').trim());
    fs.mkdirSync(p, { recursive: true });
    return `✅ Pasta criada: ${p}`;
  } catch (e) {
    return `ERRO ao criar pasta: ${e.message}`;
  }
}

function renomearArquivo(origem, destino) {
  try {
    const src = path.resolve(String(origem || '').trim());
    if (!fs.existsSync(src)) return `ERRO: arquivo/pasta não existe: ${src}`;
    const dst = path.resolve(String(destino || '').trim());
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.renameSync(src, dst);
    return `✅ Renomeado: ${src} → ${dst}`;
  } catch (e) {
    return `ERRO ao renomear: ${e.message}`;
  }
}

function copiarArquivo(origem, destino) {
  try {
    const src = path.resolve(String(origem || '').trim());
    if (!fs.existsSync(src)) return `ERRO: arquivo/pasta não existe: ${src}`;
    const dst = path.resolve(String(destino || '').trim());
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    return runPowerShell([
      `Copy-Item -LiteralPath '${src}' -Destination '${dst}' -Recurse -Force -ErrorAction Stop`,
      `"Copiado: ${src} → ${dst}"`,
    ], 120000);
  } catch (e) {
    return `ERRO ao copiar: ${e.message}`;
  }
}

function moverArquivo(origem, destino) {
  try {
    const src = path.resolve(String(origem || '').trim());
    if (!fs.existsSync(src)) return `ERRO: arquivo/pasta não existe: ${src}`;
    const dst = path.resolve(String(destino || '').trim());
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    return runPowerShell([
      `Move-Item -LiteralPath '${src}' -Destination '${dst}' -Force -ErrorAction Stop`,
      `"Movido: ${src} → ${dst}"`,
    ], 120000);
  } catch (e) {
    return `ERRO ao mover: ${e.message}`;
  }
}

// 🛡️ Anti zip-slip: valida os NOMES das entradas de um arquivo compactado ANTES de extrair.
// Bloqueia entradas com "..", caminhos absolutos ou com letra de drive (ex: ../evil, C:/x, /x).
// Retorna 'OK' se seguro, mensagem de erro se inseguro, ou null se o arquivo não existe.
async function validarExtraccaoSegura(arq) {
  const p = path.resolve(String(arq || '').trim());
  if (!fs.existsSync(p)) return null;
  const ext = path.extname(p).toLowerCase();
  const sevenzLocal = path.join(DATA_BOT, 'tools', '7-Zip', '7z.exe');
  const ps = [
    `$ok = $true`,
  ];
  if (ext === '.zip') {
    ps.push(
      `Add-Type -AssemblyName System.IO.Compression.FileSystem`,
      `try { $zip = [System.IO.Compression.ZipFile]::OpenRead('${p}') } catch { return 'ERRO ao abrir o zip: ' + $_.Exception.Message }`,
      `try { foreach ($e in $zip.Entries) { $n = $e.FullName.Replace('\\','/'); if ($n -match '(^|/)\\.\\.(/|$)' -or $n -match '^([a-zA-Z]:|/)') { $ok = $false; break } } } finally { $zip.Dispose() }`,
    );
  } else {
    ps.push(
      `$7z = $null`,
      `if (Get-Command 7z -ErrorAction SilentlyContinue) { $7z = (Get-Command 7z).Source }`,
      `if (-not $7z -and (Test-Path 'C:\\Program Files\\7-Zip\\7z.exe')) { $7z = 'C:\\Program Files\\7-Zip\\7z.exe' }`,
      `if (-not $7z -and (Test-Path 'C:\\Program Files (x86)\\7-Zip\\7z.exe')) { $7z = 'C:\\Program Files (x86)\\7-Zip\\7z.exe' }`,
      `if (-not $7z -and (Test-Path '${sevenzLocal}')) { $7z = '${sevenzLocal}' }`,
      `if ($7z) { $list = & $7z l -slt '${p}'; $emSec = $false } elseif (Get-Command tar -ErrorAction SilentlyContinue) { $list = @(& tar -tf '${p}'); $emSec = $true } else { $list = @(); $emSec = $true }`,
      `foreach ($line in $list) { if (-not $emSec) { if ($line -like '----------*') { $emSec = $true }; continue }; $n = $line.Trim().Replace('\\','/'); if ($line -like 'Path = *') { $n = ($line -replace '^Path = ', '').Replace('\\','/') }; if ($n -match '(^|/)\\.\\.(/|$)' -or $n -match '^([a-zA-Z]:|/)') { $ok = $false; break } }`,
    );
  }
  ps.push(`if ($ok) { 'OK' } else { 'INSEGURO: o arquivo contém caminhos fora da pasta de destino (zip-slip). Extração bloqueada.' }`);
  return comTimeout(runPowerShell(ps, 90000), 90000, 'validar_arquivo_seguro');
}

async function descompactar(arquivo, destino) {
  const arq = path.resolve(String(arquivo || '').trim());
  if (!fs.existsSync(arq)) return `ERRO: arquivo não existe: ${arq}`;
  const seg = await validarExtraccaoSegura(arq);
  if (seg && !String(seg).trim().startsWith('OK')) return `🛡️ ${seg}`;
  const dest = path.resolve(String(destino || '').trim() || path.dirname(arq) + path.sep + path.basename(arq, path.extname(arq)));
  fs.mkdirSync(dest, { recursive: true });
  const ext = path.extname(arq).toLowerCase();
  if (ext === '.zip') {
    return runPowerShell([
      `Expand-Archive -LiteralPath '${arq}' -DestinationPath '${dest}' -Force`,
      `"Extraído com sucesso em: ${dest}"`,
    ], 120000);
  }
  const lower = arq.toLowerCase();
  const sevenzLocal = path.join(DATA_BOT, 'tools', '7-Zip', '7z.exe');
  // Localiza o 7-Zip em QUALQUER local: PATH, Program Files, Program Files (x86) ou binário local do bot
  const achar7z = [
    `$7z = $null`,
    `if (Get-Command 7z -ErrorAction SilentlyContinue) { $7z = (Get-Command 7z).Source }`,
    `if (-not $7z -and (Test-Path 'C:\\Program Files\\7-Zip\\7z.exe')) { $7z = 'C:\\Program Files\\7-Zip\\7z.exe' }`,
    `if (-not $7z -and (Test-Path 'C:\\Program Files (x86)\\7-Zip\\7z.exe')) { $7z = 'C:\\Program Files (x86)\\7-Zip\\7z.exe' }`,
    `if (-not $7z -and (Test-Path '${sevenzLocal}')) { $7z = '${sevenzLocal}' }`,
  ];
  // tar / tar.gz / tgz / bz2 / xz / gz — usa o 7-Zip (lida com todos) e tar.exe como fallback
  if (['.tar', '.gz', '.tgz', '.bz2', '.xz'].includes(ext) || lower.includes('.tar.')) {
    return runPowerShell([
      ...achar7z,
      `$ok = $false`,
      `if ($7z) {`,
      `  & $7z x '${arq}' -o'${dest}' -y`,
      `  if ($LASTEXITCODE -eq 0) { $ok = $true }`,
      `}`,
      `if (-not $ok -and (Get-Command tar -ErrorAction SilentlyContinue)) {`,
      `  tar -xf '${arq}' -C '${dest}'`,
      `  if ($LASTEXITCODE -eq 0) { $ok = $true }`,
      `}`,
      `if ($ok) {`,
      `  $tars = @(Get-ChildItem -LiteralPath '${dest}' -Filter *.tar -File -ErrorAction SilentlyContinue)`,
      `  if ($tars.Count -eq 1 -and $7z) {`,
      `    & $7z x $tars[0].FullName -o'${dest}' -y`,
      `    if ($LASTEXITCODE -eq 0) { Remove-Item -LiteralPath $tars[0].FullName -Force -ErrorAction SilentlyContinue }`,
      `  }`,
      `  "Extraído com sucesso em: ${dest}"`,
      `} else { 'ERRO ao extrair: formato não suportado, arquivo corrompido ou sem 7-Zip/tar. Peça ao DONO instalar o 7-Zip (instalar_programa 7zip).' }`,
    ], 120000);
  }
  // rar / 7z / qualquer outro formato — via 7-Zip
  return runPowerShell([
    ...achar7z,
    `$ok = $false`,
    `if ($7z) {`,
    `  & $7z x '${arq}' -o'${dest}' -y`,
    `  if ($LASTEXITCODE -eq 0) { $ok = $true }`,
    `}`,
    `if ($ok) { "Extraído com sucesso em: ${dest}" } else { 'ERRO ao extrair: 7-Zip não encontrado, formato não suportado ou arquivo corrompido. Peça ao DONO instalar o 7-Zip (instalar_programa 7zip).' }`,
  ], 120000);
}

async function baixarInstalarTestar(args) {
  const url = String(args.url || '').trim();
  if (!url) return 'ERRO: informe a URL de download.';
  const dir = path.join(DATA_BOT, 'downloads');
  fs.mkdirSync(dir, { recursive: true });

  const nome = (String(args.nome || '').trim() || `instalar_${Date.now()}`).replace(/[\\/:*?"<>|]/g, '_');
  const alvo = path.join(dir, nome);
  const passos = [];

  // 1. Baixar
  passos.push('⬇️ Baixando...');
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 900000, maxContentLength: 40 * 1024 * 1024 * 1024 });
    const buf = Buffer.from(res.data);
    if (!buf.length) return 'ERRO: download vazio.';
    fs.writeFileSync(alvo, buf);
    passos.push(`✅ Baixado: ${alvo} (${Math.round(buf.length / 1048576)} MB)`);
  } catch (e) {
    return `❌ Falha no download: ${String(e.message || e).slice(0, 150)}`;
  }

  // 2. Descompactar se zip
  const ext = path.extname(alvo).toLowerCase();
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) {
    passos.push('📦 Descompactando...');
    const r = await descompactar(alvo);
    if (/ERRO|não instalado|Formato não/i.test(r)) return `❌ ${r}`;
    passos.push(r.split('\n')[0]);
  }

  // 3. Instalar (comando silencioso ou abrir)
  const silent = String(args.comando_instalacao || '').trim();
  const exe = String(args.executavel || '').trim();
  if (/\.(exe|msi)$/i.test(alvo)) {
    passos.push('⚙️ Instalando...');
    if (silent) {
      const r = await runCmd(`"${alvo}" ${silent}`, 300000);
      passos.push(r.includes('ERRO') ? `⚠️ ${r.slice(0, 120)}` : '✅ Instalador executado com os flags informados.');
    } else {
      await runCmd(`start "" "${alvo}"`, 10000);
      passos.push('🔓 Instalador aberto para interação.');
    }
  }

  // 4. Testar
  if (exe) {
    passos.push(`🧪 Testando ${exe}...`);
    await runCmd(`start "" "${exe}"`, 10000);
    await new Promise(r => setTimeout(r, 6000));
    const proc = await runCmd(`tasklist /FI "IMAGENAME eq ${path.basename(exe)}"`, 15000);
    const rodando = /\.exe/i.test(proc) && !/INFO:|nenhum|no tasks/i.test(proc);
    passos.push(rodando
      ? `🟢 RODANDO! O processo ${path.basename(exe)} está ativo. Jogo/programa funcionou.`
      : `🔴 O processo ${path.basename(exe)} não foi encontrado rodando após 6s. Pode precisar de interação ou instalação manual.`);
  } else {
    passos.push('ℹ️ Executável não informado para teste — abri/baixei o arquivo. Para testar, informe executavel.');
  }

  return passos.join('\n');
}


// 💎 VENDA DE VIP PELA IA — qualquer pessoa do grupo pode pedir
// tabela → mostra os planos e preços; gerar_pix → gera PIX do plano escolhido
async function venderVip(args, toolCtx) {
  const acao = String(args.acao || '').trim();
  if (acao === 'tabela') {
    const r = await core.listarPlanosVip();
    if (r.erro) return r;
    return {
      planos: r.planos,
      mensagem: `${r.mensagem}\n\n⚡ *Vantagens de ser VIP:*\n• 🔍 Consultas ilimitadas (sem conectar WhatsApp)\n• ⚡ Sem cooldown de espera\n• 🎨 Cores personalizadas no status\n• 🤖 Auto Rajar\n• 🛡️ Prioridade na fila\n\nÉ só me dizer qual plano quer (ex: \`30d\`) que eu gero o PIX na hora!`
    };
  }
  if (acao === 'gerar_pix') {
    const plano = String(args.plano || '').trim().toLowerCase();
    if (!plano) return { erro: 'Informe o plano (ex: 1d, 7d, 15d, 30d, 90d).' };
    const r = await core.venderVip(plano, toolCtx.userId, toolCtx.chatId);
    if (r.erro) return r;
    return { ok: true, mensagem: `💎 *PIX GERADO!*\n\n✅ Plano *VIP ${r.plano}* — R$ ${r.valor.toFixed(2).replace('.', ',')}\n📲 O código PIX foi enviado para você pagar (copia e cola).\n⏳ O VIP é ativado automaticamente após a confirmação do pagamento.` };
  }
  return { erro: 'Ação inválida para vender_vip. Use: tabela | gerar_pix.' };
}

async function gerenciarVip(args, toolCtx) {
  const acao = String(args.acao || '').trim();
  if (acao === 'liberar_todos') {
    const r = await core.liberarVipTodos(args.duracao || args.descricao || '1 hora');
    if (r.erro) return r;
    if (toolCtx.chatId && core.isReady()) {
      try {
        const c = core.getCore();
        if (c && c.corvo && toolCtx.chatId) {
          c.corvo.sendMessage(toolCtx.chatId, { text: `💎 *VIP LIBERADO PARA TODOS* por ${r.duracao}!` }).catch(() => {});
        }
      } catch (e) {}
    }
    return `✅ VIP liberado para ${r.liberados} usuários por ${r.duracao}. Expira em ${r.validaAte}.`;
  }
  if (acao === 'liberar_usuario') {
    const r = await core.liberarVip(args.usuario_id, args.duracao || '1 hora');
    return r.erro ? r : `✅ VIP liberado para \`${r.usuarioId}\` por ${r.duracao} (até ${r.validaAte}).`;
  }
  if (acao === 'remover_usuario') {
    const r = await core.removerVip(args.usuario_id);
    return r.erro ? r : `✅ ${r.acao} para \`${r.usuarioId}\`.`;
  }
  if (acao === 'remover_todos') {
    const r = await core.removerVipTodos();
    return r.erro ? r : `✅ VIP removido de ${r.removidos} usuário(s).${r.avisosFalhos ? ` (${r.avisosFalhos} não puderam ser avisados no privado)` : ''}`;
  }
  if (acao === 'consultar_usuario') {
    const r = await core.consultarVip(args.usuario_id);
    return r.erro ? r : r.resultado;
  }
  if (acao === 'listar') {
    return core.listarVips();
  }
  return { erro: 'Ação inválida para gerenciar_vip. Use: liberar_todos | liberar_usuario | consultar_usuario | remover_usuario | remover_todos | listar.' };
}

// ===== 📋 LOG DE AUDITORIA (regra do dono) =====
// Registra TODA execução de ferramenta em corvo_dados/data/auditoria.jsonl (1 linha por
// evento — append atômico, sem race entre chats paralelos): quem pediu, qual
// chat, qual ferramenta, com quais argumentos e o resultado (resumo).
// Nunca quebra a execução.
const AUDIT_FILE = path.join(__dirname, '..', '..', '..', 'corvo_dados', 'data', 'auditoria.jsonl');
// 🗜️ Teto de tamanho do log de auditoria: quando passa de 2MB, o atual vira
// auditoria.old.jsonl (sobrescreve) e recomeça — o disco nunca enche.
const AUDIT_MAX_BYTES = 2 * 1024 * 1024;
function registrarAuditoria(name, args, toolCtx, resultado) {
  try {
    fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true });
    try {
      if (fs.existsSync(AUDIT_FILE) && fs.statSync(AUDIT_FILE).size > AUDIT_MAX_BYTES) {
        fs.copyFileSync(AUDIT_FILE, AUDIT_FILE.replace('.jsonl', '.old.jsonl'));
        fs.unlinkSync(AUDIT_FILE);
      }
    } catch (e) { /* rotação falhou não derruba o log */ }
    const resumo = (typeof resultado === 'object' && resultado !== null)
      ? JSON.stringify(resultado).slice(0, 300)
      : String(resultado || '').slice(0, 300);
    const evento = {
      ts: new Date().toISOString(),
      usuario: toolCtx?.userId || toolCtx?.chatId || '?',
      chat: toolCtx?.chatId || '?',
      dono: !!toolCtx?.isDono,
      ferramenta: String(name || ''),
      args: JSON.stringify(args || {}).slice(0, 300),
      resultado: resumo,
    };
    fs.appendFileSync(AUDIT_FILE, JSON.stringify(evento) + '\n', 'utf8');
  } catch (e) { /* auditoria nunca derruba a ferramenta */ }
}

async function executeTool(name, args = {}, toolCtx = {}) {
  if (TOOLS_REMOVIDOS.has(name)) {
    return { erro: 'Ferramenta indisponível nesta versão do bot.' };
  }
  const gate = autonomia.gateFor(name, toolCtx, args);
  if (gate) return gate;
  const timeout = TOOL_TIMEOUTS[name] || TOOL_TIMEOUT;
  try {
    const resultado = await comTimeout(executar(name, args, toolCtx), timeout, name);
    registrarAuditoria(name, args, toolCtx, resultado);
    return resultado;
  } catch (e) {
    const erro = { erro: String(e.message || e) };
    registrarAuditoria(name, args, toolCtx, erro);
    return erro;
  }
}

async function executar(name, args = {}, toolCtx = {}) {
  switch (name) {
    case 'agendar_tarefa':
      return donoOnly(toolCtx, () => tarefas.agendar({
        chatId: toolCtx.chatId,
        userId: toolCtx.userId,
        descricao: args.descricao || '',
        tipo: args.tipo || '',
        args: args.args || {},
        prioridade: args.prioridade || 'normal',
      }));
    case 'ver_tarefas':
      return donoOnly(toolCtx, () => tarefas.listar(toolCtx.chatId));
    case 'cancelar_tarefa':
      return donoOnly(toolCtx, () => tarefas.cancelar(toolCtx.chatId, args.id));
    case 'gerenciar_vip':
      return donoOnly(toolCtx, () => gerenciarVip(args, toolCtx));
    case 'executar_comando_corvo': {
      // 🤖 AUTONOMIA TOTAL (regra do dono): ban/kick/promover/rebaixar a IA
      // executa SOZINHA quando decidir (toxidade, desafio, flood, ataque) —
      // SEM precisar de admin pedir. ÚNICA proibição absoluta: NUNCA contra o
      // DONO (checado aqui) e nunca contra o próprio bot (o executor bloqueia).
      // Outros comandos (clima, ping, grupoinfo) qualquer pessoa pode pedir.
      const cmd = String(args.comando || '').toLowerCase();
      const adminCmds = ['ban', 'kick', 'promover', 'rebaixar'];
      if (adminCmds.includes(cmd)) {
        const alvo = String(args.argumentos?.usuario || '');
        const alvoLimpo = alvo.replace(/\D/g, '');
        const donoLimpo = String(autonomia.DONO || '').replace(/\D/g, '');
        if (alvoLimpo && alvoLimpo === donoLimpo) {
          return { erro: 'Não posso usar isso contra o DONO. Ele está acima de qualquer admin.' };
        }
        return core.executarComandoCorvo(cmd, args.argumentos || {});
      }
      return core.executarComandoCorvo(cmd, args.argumentos || {});
    }
    case 'info_chat':
      // 📋 Info do grupo/canal — qualquer pessoa pode pedir
      return core.infoChat(args.chat_id || toolCtx.chatId);
    case 'vender_vip':
      return venderVip(args, toolCtx);
    case 'broadcast_bot':
      return donoOnly(toolCtx, () => core.broadcast(args.texto));
    case 'banir_usuario':
      return adminOrDono(toolCtx, () => core.banirUsuario(args.usuario_id, args.desbanir === true), args.usuario_id);
    case 'stats_bot':
      return donoOnly(toolCtx, () => core.statsBot());
    case 'mensagem_usuario':
      // Avisar o DONO no privado (confirmação de ação pesada) é sempre permitido;
      // enviar para OUTROS usuários continua restrito ao dono.
      if (String(args.usuario_id) === autonomia.DONO) {
        return core.mensagemPara(args.usuario_id, args.texto);
      }
      return donoOnly(toolCtx, () => core.mensagemPara(args.usuario_id, args.texto));
    case 'levar_recado_pv':
      // 📨 MENSAGEIRO (regra do dono): qualquer pessoa do grupo pode pedir pra
      // levar recado no PV de OUTRO membro do MESMO grupo. O módulo resolve a
      // pessoa pelo nome/número, entrega o recado, guarda pendente e SEMPRE
      // avisa o dono no PV do dono.
      return mensageiro.levarRecado({
        grupoJid: toolCtx.chatId,
        deNome: toolCtx.pushname || 'Alguém',
        deId: toolCtx.userId,
        paraNome: args.nome,
        texto: args.texto,
      });
    case 'responder_recado':
      // 📥 MENSAGEIRO: a pessoa que RECEBEU o recado respondeu no PV — leva a
      // resposta de volta pro grupo e avisa o dono. Só funciona com recado
      // pendente dela (o módulo valida).
      return mensageiro.responderRecado({
        deId: toolCtx.userId,
        deNome: toolCtx.pushname || 'Alguém',
        texto: args.texto,
      });
    case 'consultar_dado':
      return core.consultarDado(args.tipo, args.valor, toolCtx.userId);
    case 'consultar_datora':
      return core.consultarDatora(args.numero, toolCtx.userId);
    case 'rajar_whatsapp':
      return core.rajarWhats(args.tipo, args.jid, toolCtx.userId);
    case 'nukar_grupo':
      return donoOnly(toolCtx, () => core.nukarWhats(args.jid, toolCtx.userId));
    case 'flood_ngl':
      return core.floodNgl(args.username, toolCtx.userId);
    case 'flood_sendit':
      return core.floodSendit(args.link, toolCtx.userId);
    case 'whatsapp_status':
      return core.whatsStatus(toolCtx.userId);
    case 'listar_grupos_whats':
      return core.listarGruposWhats(toolCtx.userId);
    case 'postar_canal':
      return donoOnly(toolCtx, () => core.postarCanal(args.texto));
    case 'configurar_grupo':
      // Autonomia da IA: dono e ADMINS do grupo podem configurar o grupo
      if (!toolCtx?.isDono && !toolCtx?.isAdmin) {
        return { erro: 'Permissão negada: configurar o grupo é só para admins ou o dono.' };
      }
      return core.configurarGrupo(args.chat_id || toolCtx.chatId, args.acao, args.valor);
    case 'configurar_canal':
      return donoOnly(toolCtx, () => core.configurarCanal(args.acao, args.valor));
    case 'editar_canal':
      return donoOnly(toolCtx, () => core.editarCanal(args.mensagem_id, args.texto));
    case 'apagar_canal':
      return donoOnly(toolCtx, () => core.apagarCanal(args.mensagem_id));
    case 'postar_foto_canal':
      return donoOnly(toolCtx, () => core.postarFotoCanal(args.caminho, args.legenda));
    case 'postar_video_canal':
      return donoOnly(toolCtx, () => core.postarVideoCanal(args.caminho, args.legenda, args.capa));
    case 'postar_conteudo_canal':
      // Lazy require: evita o ciclo ia_tools ↔ ia_conteudo (CJS devolve exports
      // parcial se o outro módulo estiver no meio do load).
      return donoOnly(toolCtx, () => require('./ia_conteudo').postarAlgo(args.tipo, { caminho: args.caminho }));
    case 'remover_membro':
      // 🤖 AUTONOMIA TOTAL (regra do dono): a IA decide SOZINHA quando remover
      // (toxidade, desafio, flood) e PODE remover admins. O alvo NUNCA pode ser
      // o próprio BOT nem o DONO — a função core.removerMembro valida.
      return core.removerMembro(args.usuario_id, toolCtx.chatId, args.motivo, args.pv);
    case 'mutar_membro':
      // 🔇 Autonomia total: a IA decide sozinha quando mutar (flood/spam/insuportável).
      // Nunca o próprio bot nem o dono — core.mutarUsuario valida.
      return core.mutarUsuario(args.usuario_id, toolCtx.chatId);
    case 'desmutar_membro':
      // 🔊 Desmuta quando a pessoa se acalmar / dono ou admin mandar.
      return core.desmutarUsuario(args.usuario_id, toolCtx.chatId);
    case 'criar_imagem':
      return donoOnly(toolCtx, () => core.criarImagem(args.titulo, args.subtitulo));
    case 'gerar_imagem_ia':
      return donoOnly(toolCtx, () => require('./ia_imagem').gerarImagem(args.prompt, { tamanho: args.tamanho }));
    case 'editar_imagem_ia':
      return donoOnly(toolCtx, () => require('./ia_imagem').editarImagem(args.caminho, args.instrucao));
    case 'gerar_video_ia':
      return donoOnly(toolCtx, () => require('./ia_video').gerarVideo(args.prompt, { duracao: args.duracao, proporcao: args.proporcao }));
    case 'editar_video_ia':
      return donoOnly(toolCtx, () => require('./ia_video').editarVideo(args.caminho, args.instrucao));
    case 'criar_capa_video':
      return donoOnly(toolCtx, () => core.criarCapaVideo(args.titulo, args.subtitulo));
    case 'buscar_post_canal':
      return donoOnly(toolCtx, () => core.buscarPostCanal(args.termo));
    case 'buscar_web':
      return buscarWeb(args.query);
    case 'pesquisar_solucao':
      return pesquisarSolucao(args.assunto);
    case 'buscar_imagens':
      return buscarImagens(args.query);
    case 'buscar_github':
      return buscarGithub(args.query, args.ordenar);
    case 'listar_projeto':
      return donoOnly(toolCtx, () => listarProjeto(args.pasta));
    case 'arquivos_modificados':
      return donoOnly(toolCtx, () => arquivosModificados(args.dias, args.max));
    case 'ler_projeto':
      return donoOnly(toolCtx, () => lerProjeto(args.arquivos, args.pasta));
    case 'checar_codigo':
      return donoOnly(toolCtx, () => checarCodigo(args.pasta));
    case 'grep_codigo':
      return donoOnly(toolCtx, () => grepCodigo(args.padrao, args.pasta));
    case 'info_sistema':
      return donoOnly(toolCtx, () => infoSistema());
    case 'uso_pc':
      return donoOnly(toolCtx, () => usoPc());
    case 'gerenciar_processos':
      return donoOnly(toolCtx, () => gerenciarProcessos(args.acao, args.alvo));
    case 'abrir_programa':
      return donoOnly(toolCtx, () => abrirPrograma(args.programa, args.delayMs));
    case 'servicos':
      return donoOnly(toolCtx, () => servicos(args.acao, args.nome));
    case 'rede_info':
      return donoOnly(toolCtx, () => redeInfo());
    case 'testar_ping':
      return donoOnly(toolCtx, () => testarPing(args.host));
    case 'ver_portas':
      return donoOnly(toolCtx, () => verPortas());
    case 'git_operacoes':
      return donoOnly(toolCtx, () => gitOperacoes(args.pasta, args.comando));
    case 'baixar_github':
      if (!toolCtx?.isDono && !isZonaLiberada(args.destino || path.join(DATA_BOT, 'github'))) return { erro: 'Destino de download do GitHub precisa ser na zona liberada (data/github).' };
      return baixarGithub(args.repo, args.destino);
    case 'visitar_site':
      return visitarSite(args.url);
case 'abrir_site_navegador':
  return abrirSiteNavegador(args.url, args.delayMs);
    case 'captura_tela':
      return capturaTela(args);
    case 'lixeira':
      return donoOnly(toolCtx, () => lixeira(args.acao, args.termo));
    case 'criar_ferramenta':
      return donoOnly(toolCtx, () => criarFerramenta(args.nome, args.descricao, args.parametros, args.codigo));
    case 'apagar_ferramenta':
      return donoOnly(toolCtx, () => apagarFerramenta(args.nome));
    case 'listar_ferramentas':
      return listarFerramentas();
    case 'criar_comando':
      return donoOnly(toolCtx, () => criarComandoDinamico(args.nome, args.descricao, args.codigo));
    case 'apagar_comando':
      return donoOnly(toolCtx, () => apagarComandoDinamico(args.nome));
    case 'listar_comandos_dinamicos':
      return listarComandosDinamicos();
    case 'escrever_teclado':
      return escreverTeclado(args.texto, args.delayMs);
    case 'simular_teclas':
      return simularTeclas(args.teclas, args.delayMs);
    case 'clicar_mouse':
      return clicarMouse(args.x, args.y, args.botao, args.delayMs);
    case 'janelas':
      return janelas(args.acao, args.titulo, args.delayMs);
    case 'clipboard':
      return clipboard(args.acao, args.texto);
    case 'volume':
      return donoOnly(toolCtx, () => volume(args.acao));
    case 'abrir_arquivo':
      return donoOnly(toolCtx, () => abrirArquivo(args.caminho, args.delayMs));
    case 'navegar_pasta':
      return donoOnly(toolCtx, () => navegarPasta(args.caminho, args.arquivo, args.delayMs));
    case 'unidades':
      return donoOnly(toolCtx, () => unidades());
    case 'mapear_estrutura':
      if (!toolCtx?.isDono) {
        if (args.caminho && !arquivoPermitido(toolCtx, args.caminho)) return negarArquivo(args.caminho);
        return mapearEstrutura(args.caminho || path.join(DATA_BOT, 'downloads'));
      }
      return mapearEstrutura(args.caminho);
    case 'descompactar':
      if (!arquivoPermitido(toolCtx, args.arquivo)) return negarArquivo(args.arquivo);
      if (args.destino && !arquivoPermitido(toolCtx, args.destino)) return negarArquivo(args.destino);
      return descompactar(args.arquivo, args.destino);
    case 'zipar_pasta':
      if (!arquivoPermitido(toolCtx, args.origem)) return negarArquivo(args.origem);
      if (!arquivoPermitido(toolCtx, args.destino)) return negarArquivo(args.destino);
      return ziparPasta(args.origem, args.destino);
    case 'baixar_instalar_testar':
      return donoOnly(toolCtx, () => baixarInstalarTestar(args));
    case 'buscar_wikipedia':
      return buscarWikipedia(args.termo);
    case 'executar_terminal':
      return donoOnly(toolCtx, () => runCmd(args.comando));
    case 'abrir_pasta':
      return donoOnly(toolCtx, () => runCmd(`explorer.exe "${args.caminho}"`));
    case 'listar_pasta':
      if (!arquivoPermitido(toolCtx, args.caminho)) return negarArquivo(args.caminho);
      return listFolder(args.caminho);
    case 'criar_arquivo':
      if (!arquivoPermitido(toolCtx, args.caminho)) return negarArquivo(args.caminho);
      return createFile(args.caminho, args.conteudo);
    case 'ler_arquivo':
      if (!arquivoPermitido(toolCtx, args.caminho)) return negarArquivo(args.caminho);
      return readFileTool(args.caminho, args.linhas);
    case 'editar_arquivo':
      if (!arquivoPermitido(toolCtx, args.caminho)) return negarArquivo(args.caminho);
      return editFileTool(args.caminho, args.buscar, args.substituir, args.todas === true);
    case 'restaurar_backup':
      if (!arquivoPermitido(toolCtx, args.caminho)) return negarArquivo(args.caminho);
      return restaurarBackupTool(args.caminho, args.versao);
    case 'listar_backups':
      if (!arquivoPermitido(toolCtx, args.caminho)) return negarArquivo(args.caminho);
      return listarBackupsTool(args.caminho);
    case 'criar_pasta':
      if (!arquivoPermitido(toolCtx, args.caminho)) return negarArquivo(args.caminho);
      return criarPasta(args.caminho);
    case 'renomear_arquivo':
      if (!arquivoPermitido(toolCtx, args.origem)) return negarArquivo(args.origem);
      if (!arquivoPermitido(toolCtx, args.destino)) return negarArquivo(args.destino);
      return renomearArquivo(args.origem, args.destino);
    case 'copiar_arquivo':
      if (!arquivoPermitido(toolCtx, args.origem)) return negarArquivo(args.origem);
      if (!arquivoPermitido(toolCtx, args.destino)) return negarArquivo(args.destino);
      return copiarArquivo(args.origem, args.destino);
    case 'mover_arquivo':
      if (!arquivoPermitido(toolCtx, args.origem)) return negarArquivo(args.origem);
      if (!arquivoPermitido(toolCtx, args.destino)) return negarArquivo(args.destino);
      return moverArquivo(args.origem, args.destino);
    case 'procurar_no_pc':
      if (!toolCtx?.isDono) {
        if (args.pasta && !arquivoPermitido(toolCtx, args.pasta)) return negarArquivo(args.pasta);
        return procurarPc(args.termo, args.pasta || path.join(DATA_BOT, 'downloads'));
      }
      return procurarPc(args.termo, args.pasta);
    case 'baixar_youtube':
      return baixarYouTube(args.url, args.tipo || 'audio');
    case 'baixar_arquivo':
      return baixarArquivoURL(args.url, args.nome);
    case 'criar_lembrete':
      return lembretes.scheduleLembrete(toolCtx.chatId, args.texto, args.quando);
    case 'instalar_programa':
      return donoOnly(toolCtx, () => instalarPrograma(args.nome, args.tipo));
    case 'verificar_programa':
      return donoOnly(toolCtx, () => verificarPrograma(args.nome));
    case 'iniciar_servidor':
      return donoOnly(toolCtx, () => iniciarServidor(args.pasta, args.porta));
    case 'expor_site':
      return donoOnly(toolCtx, () => exporSite(args.porta));
    case 'parar_servidor':
      return donoOnly(toolCtx, () => pararServidor(args.porta));
    case 'reiniciar_pc':
      return donoOnly(toolCtx, () => runCmd('shutdown /r /t 10 /c "RAM: reiniciando em 10s"'));
    case 'desligar_pc':
      return donoOnly(toolCtx, () => runCmd('shutdown /s /t 10 /c "RAM: desligando em 10s"'));
    case 'reiniciar_bot':
      return donoOnly(toolCtx, () => {
        if (process.env.PM2_HOME || process.pm2) {
          setTimeout(() => process.exit(1), 1200);
          return '🔄 Reiniciando o bot via PM2... volto em segundos!';
        }
        setTimeout(() => process.exit(1), 1500);
        return '🔄 Reiniciando o bot... (sem PM2: processo encerrado, inicie manualmente)';
      });
    case 'ler_texto_imagem':
      return lerTextoImagem(args.caminho, toolCtx);
    case 'clima':
      return climaCidade(args.cidade);
    case 'cotacoes':
      return cotacoes();
    case 'encurtar_link':
      return encurtarLink(args.url);
    case 'gerar_qr':
      return gerarQr(args.texto);
    case 'resumo_grupo':
      return resumoGrupo(toolCtx);
    case 'criar_pdf':
      return criarPdf(args.titulo, args.texto);
    case 'extrair_texto_pdf':
      return extrairTextoPdf(args.caminho, toolCtx);
    case 'criar_planilha':
      return criarPlanilha(args.nome, args.colunas, args.linhas);
    case 'monitorar_preco':
      return monitorPrecos.monitorarPreco({
        chatId: toolCtx.chatId,
        userId: toolCtx.userId,
        produto: args.produto,
        precoAlvo: args.preco_alvo,
      });
    case 'ver_monitores':
      return { monitores: monitorPrecos.listar(toolCtx.chatId) };
    case 'cancelar_monitor':
      return monitorPrecos.cancelar(toolCtx.chatId, args.id)
        ? { cancelado: true, id: args.id }
        : { erro: 'Monitor não encontrado neste chat.' };
    default:
      return executeCustomTool(name, args, toolCtx);
  }
}

tarefas.setTaskRunner((tipo, args, toolCtx) => executeTool(tipo, args, toolCtx));

module.exports = { TOOL_SCHEMAS, executeTool, getToolSchemas, listarFerramentas, buscarWeb, buscarImagens, buscarGithub, buscarWikipedia, pesquisarSolucao, tarefas, baixarArquivoURL, baixarYouTube };