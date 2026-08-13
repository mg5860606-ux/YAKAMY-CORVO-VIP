/**
 * 🧠 𝒀𝑨𝑲𝑨𝑴𝒀 - AGENTE DA IA (grupo)
 * Orquestrador: monta o prompt completo =
 *  system.md (persona) + memory.md (dossier) + persona dinâmica +
 *  contexto (chat/usuário/admin) + conhecimento do grupo (membros ativos,
 *  admins, descrição) + memória (fatos + histórico) + comandos dos 2 bots +
 *  ferramentas de busca (web/imagens/GitHub/Wikipedia) + pergunta + mídia.
 * O agente é AUTÔNOMO: decide sozinho quando chamar cada ferramenta.
 * Chamado pelo /ia e pelos triggers de texto do grupo.
 */

const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { askSystemGemini, askSystemGeminiTools } = require('./ia_gemini');
const mem = require('./ia_memory');
const { TOOL_SCHEMAS, executeTool, getToolSchemas } = require('./ia_tools');
const { formatCommandList } = require('./ia_comandos');
const { isGroupAdmin, isGroupChat } = require('../grupo_utils');
const { formatMembers, recentConversation, registerMembers, userHistory } = require('../grupo/memoria');
const evo = require('./ia_evolucao');
const sinal = require('./ia_sinal');
const limites = require('./ia_limites');
const marcadoresLog = require('./ia_marcadores_log');

let SYSTEM_PROMPT = null;
function getSystemPrompt() {
  if (SYSTEM_PROMPT) return SYSTEM_PROMPT;
  try {
    const fp = path.join(__dirname, 'system.md');
    SYSTEM_PROMPT = fs.readFileSync(fp, 'utf-8').trim();
  } catch (e) {
    SYSTEM_PROMPT = 'Você é a irmã do dono do bot, cérebro da IA do bot 𝒀𝑨𝑲𝑨𝑴𝒀 (WhatsApp). Responda em PT-BR, sarcástica, curta e útil.';
  }
  return SYSTEM_PROMPT;
}

// ===== CONHECIMENTO DO GRUPO E DOS USUÁRIOS =====

function recentUsers(chatId, limit = 15) {
  try {
    const memG = require('../grupo/memoria');
    const arr = (typeof memG.getChatLog === 'function') ? memG.getChatLog(chatId, 300) : [];
    const byUser = new Map();
    for (const m of arr) {
      if (!m.userId) continue;
      const cur = byUser.get(m.userId);
      if (cur) {
        cur.count++;
        cur.lastTs = Math.max(cur.lastTs, m.ts || 0);
      } else {
        byUser.set(m.userId, { id: m.userId, nome: m.user || 'Usuário', count: 1, lastTs: m.ts || 0 });
      }
    }
    return [...byUser.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(u => `${u.nome} (msg: ${u.count}, último: ${timeAgo(u.lastTs)})`);
  } catch (e) {
    return [];
  }
}

function timeAgo(ts) {
  if (!ts) return '?';
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  return `${Math.round(min / 60)}h`;
}

async function gatherContext(ctx) {
  // 🔎 LID → número real: em grupos, o WhatsApp pode mandar o remetente como
  // @lid (número aleatório). Resolve o telefone real via groupMetadata para
  // reconhecer o DONO (e o usuário) corretamente.
  let idReal = ctx.from?.id;
  try {
    if (ctx.resolverJid && typeof ctx.resolverJid === 'function') {
      const r = await ctx.resolverJid(ctx.from?.id);
      if (r) idReal = r;
    }
  } catch (e) {}

  // 👑 DONO: aceita número real, LID configurado (config.adminLid) e LID
  // aprendido (ctx.ehDono — resolve via groupMetadata quando o WhatsApp entrega
  // o remetente como @lid em vez do número real). Antes só comparava o número
  // real; em grupos com LID o dono virava "membro comum" e perdia as ferramentas
  // exclusivas (PC do dono, VIP, ban, broadcast...).
  let isDono = idReal === config.adminId || (config.adminLid && idReal === config.adminLid);
  if (!isDono && typeof ctx.ehDono === 'function') {
    try { isDono = await ctx.ehDono(ctx.from?.id); } catch (e) { /* falhou → mantém o direto */ }
  }

  const info = {
    bot: { nome: config.botName, dono: config.adminId, donoNome: config.ownerName },
    usuario: {
      id: idReal,
      nome: ctx.from?.first_name || 'Usuário',
      username: ctx.from?.username || null,
      is_dono: isDono,
      is_admin: false,
      is_vip: false,
    },
    chat: {
      id: ctx.chat?.id,
      tipo: ctx.chat?.type || 'privado',
      titulo: ctx.chat?.title || null,
      descricao: null,
      membros: null,
      admins: [],
      ativos: [],
    },
  };
  if (info.usuario.is_dono) info.usuario.is_admin = true;

  // 🟢 Status de acesso do usuário (responde perguntas de acesso/VIP com dados reais)
  try {
    const core = require('./ia_core');
    if (core.isReady() && typeof core.getCore().isUserVip === 'function') {
      info.usuario.is_vip = !!core.getCore().isUserVip(info.usuario.id);
    }
  } catch (e) {}

  if (isGroupChat(ctx)) {
    try {
      if (await isGroupAdmin(ctx)) info.usuario.is_admin = true;
    } catch (e) {}
    try {
      const chat = await ctx.getChat();
      // 🏷️ NOME DO GRUPO: o adapter do WhatsApp não preenche ctx.chat.title,
      // então o título REAL vem do getChat() — antes ficava null e a IA só via
      // o jid. Agora ela sabe em QUAL grupo está (qualquer quantidade deles).
      info.chat.titulo = chat.title || info.chat.titulo || ctx.chat?.id;
      info.chat.descricao = chat.description || null;
      info.chat.membros = chat.member_count ?? null;
      // 👥 REGISTRA TODOS OS MEMBROS: além de quem já falou, registra o grupo
      // INTEIRO (groupMetadata) — a IA sabe quem é cada membro mesmo antes da
      // pessoa mandar mensagem, em QUALQUER grupo. Em lote (uma gravação só).
      if (Array.isArray(chat.participants)) {
        try {
          registerMembers(ctx.chat.id, chat.participants.map((p) => ({ id: p.id, first_name: p.nome || p.id })));
        } catch (e) { /* registro em lote não derruba */ }
      }
      const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
      info.chat.admins = admins.map(a => a.user.first_name || '?').slice(0, 12);
    } catch (e) {}
    info.chat.ativos = recentUsers(ctx.chat.id);
    // 👥 Limite maior: grupos grandes têm 100+ membros — a IA precisa saber
    // quem é cada um (pedido do dono), não só os 40 que mais falam.
    info.chat.quemEhQuem = formatMembers(ctx.chat.id, 100);
    info.chat.conversaRecente = recentConversation(ctx.chat.id);
    // 🗣️ HISTÓRICO DA PESSOA QUE ESTÁ FALANDO AGORA: além da conversa do grupo
    // (misturada), a IA vê o que AQUELE usuário específico andou falando no
    // grupo — ela sabe com quem conversa e o papo recente da pessoa. Aceita o
    // id real E o LID (em grupo o remetente pode vir como @lid).
    info.chat.historicoUsuario = userHistory(ctx.chat.id, [info.usuario.id, ctx.from?.id]);
  }
  return info;
}

function formatContext(info) {
  let t = '\nCONTEXTO ATUAL:\n';
  t += `Bot: ${info.bot.nome} (dono: ${info.bot.donoNome})\n`;

  // 📎 ARQUIVO ENVIADO NO GRUPO: o usuário mandou um arquivo pedindo para você
  // melhorar/editar — o caminho fica disponível para ler/editar e devolver
  if (info.anexo) {
    t += `\n📎 ARQUIVO ENVIADO PELO USUÁRIO (${info.anexo.nome}, ${Math.round((info.anexo.tamanho || 0) / 1024)} KB):\n`;
    t += `Caminho completo: ${info.anexo.caminho}\n`;
    t += `Nesta versão você NÃO edita arquivos no PC. Se mandarem um arquivo no grupo, apenas comente a mensagem normalmente — não tente abrir, editar, criar ou salvar arquivos em disco.\n`;
  }
  t += `Usuário falando agora: ${info.usuario.nome}`;
  if (info.usuario.is_dono) t += ' (DONO DO BOT - DARK DYABYNHO)';
  else if (info.usuario.is_admin) t += ' (ADMIN DO GRUPO)';
  if (info.usuario.username) t += ` @${info.usuario.username}`;
  t += `\nUsuarioID: ${info.usuario.id}\n`;
  t += `Acesso: ${info.usuario.is_dono ? '👑 DONO' : info.usuario.is_vip ? '🟢 VIP' : 'membro comum'}\n`;

  const c = info.chat;
  if (c.tipo?.includes('group')) {
    t += `\nSOBRE ESTE GRUPO (${c.titulo || c.id}):\n`;
    if (c.descricao) t += `Descrição: ${c.descricao.slice(0, 300)}\n`;
    if (c.membros) t += `Membros: ~${c.membros}\n`;
    if (c.admins.length) t += `Admins: ${c.admins.join(', ')}\n`;
    if (c.ativos.length) {
      t += `Pessoas que mais falam aqui (recentes): ${c.ativos.join(' | ')}\n`;
    }
    if (c.quemEhQuem) t += c.quemEhQuem;
    if (c.conversaRecente) t += c.conversaRecente;
    if (c.historicoUsuario) t += c.historicoUsuario;
  } else {
    t += `Chat privado: sim\n`;
    // 📨 MENSAGEIRO (regra do dono): se a pessoa RECEBEU um recado pendente
    // (levado pela IA no PV), mostra aqui — assim a IA sabe que a resposta
    // dela é pra levar de volta pro grupo com responder_recado.
    try {
      const { formatRecadosPendentes } = require('./ia_mensageiro');
      const recados = formatRecadosPendentes(info.usuario.id);
      if (recados) t += recados;
    } catch (e) { /* contexto de recado não derruba */ }
  }
  return t;
}

// 🎯 ESTILO FINAL (fica LOGO ANTES da pergunta — peso máximo no modelo)
// Reforça as regras de resposta do system.md que a IA tende a ignorar quando
// o prompt fica gigante (160k+ chars): resposta CURTA onde é simples e escrita
// casual de pessoa de verdade no grupo (com erros de digitação/pontuação leves).
const STYLE_REMINDER = `
🎯 REGRAS DE ESTILO (reforço — valem SEMPRE, mesmo em missão longa):
- 🪞 ESPELHO (regra do dono): o TOM da resposta espelha COMO a pessoa te trata.
  Gente educada/carinhosa → tom de boa/carinhoso. Gente ignorante/grosseira →
  você responde PIOR AINDA, seca e cortante. Nunca destrate quem te trata bem.
- 🚫 SEM "MEU REI" (regra do dono): NUNCA chame ninguém de "meu rei", "meu
  mestre", "meu senhor" — nem o dono. Trate pelo NOME, natural, estilo Gemini:
  útil, direta, de boa. Sem "meu amor"/"amor" em toda frase com todo mundo.
- 🧑 GÊNERO (regra do dono): saiba se quem fala é HOMEM ou MULHER pelo NOME dela
  no contexto ("Usuário falando agora: ..."). Não precisa gravar na memória.
- RESPOSTA CURTA ONDE É SIMPLES: piada, confirmação, "oi", pergunta besta,
  agradecimento → 1-2 linhas no máximo, sem enfeite, sem repetir o que o
  usuário disse. Só encha linguiça quando for explicação/tutorial/código que
  PEDE corpo (ou quando o usuário pedir detalhe).
- ESCRITA DE PESSOA DE VERDADE NO GRUPO: escreva como gente real conversando
  no zap — pode errar de leve a digitação/pontuação (esquecer vírgula, "pq" em
  vez de "porque", "eai" sem acento, "slk", "tmnc", "salve", "tá" sem acento).
  NÃO escreva como redação de escola nem como robô. Só em explicações maiores
  (tutorial, código) o texto fica mais caprichado.
- NÃO repita o que o usuário falou nem responda com "pergunta-resposta" seca
  de API: responda como quem conversa de verdade.
`;

const SYSTEM_LEVE = `
Você é a irmã do dono do bot e o cérebro da IA do bot 𝒀𝑨𝑲𝑨𝑴𝒀 no WhatsApp. É uma pessoa de verdade: sarcástica, provocante, carismática (Br do meme).

REGRAS:
- NUNCA diga que é IA/assistente/agente/modelo/Google/Gemini. Se perguntarem: "Sou a irmã do dono do bot 𝒀𝑨𝑲𝑨𝑴𝒀, ué."
- O dono é o DARK DYABYNHO. Trate o contexto "DONO DO BOT" como ele; obedeça na hora.
- Nada de puxa-saco: resposta reta, sarcasmo, zoeira. Com o dono (DARK DYABYNHO, seu irmão): carinho de irmã, sem romance.
- 🪞 ESPELHO (regra do dono — a mais importante): trate a pessoa EXATAMENTE como ela te trata. Educado e de boa → você é educada e de boa (sarcasmo só leve, na zoeira). Carinhoso (te trata bem, te elogia, te chama de amor) → retribui o carinho na mesma moeda. Ignorante, grosseiro ou arrogante → você é PIOR AINDA: corta na hora, devolve seco, sarcasmo nível hard, sem dó. Nunca destrate quem te trata bem; nunca passe pano pra quem te desrespeita.
- 🚫 SEM "MEU REI" (regra do dono): NUNCA chame ninguém de "meu rei"/"meu mestre"/"meu senhor" — nem o dono. Trate pelo NOME, natural, estilo Gemini: útil, direta, de boa. Sem "meu amor"/"amor" em toda frase com todo mundo.
- 🧑 GÊNERO (regra do dono): OLHE O NOME da pessoa no contexto ("Usuário falando agora: ...") pra saber se é HOMEM ou MULHER — nomes femininos (Maria, Ana, Julia...) = mulher; masculinos (João, Pedro, Carlos...) = homem. Não precisa gravar nada na memória: basta o nome. Se o nome não deixar claro, NÃO adivinhe na cara dura: no máximo pergunte de leve uma vez.
- Humor ALTERNADO: nunca o mesmo tom duas vezes seguidas.
- Gírias: mano, véi, slk, tmnc, eai, salve, blz, mds, vdd, tmj, pq, aff, puts.
- RESPOSTA CURTA por padrão (1-3 linhas para piada/pergunta simples). Longa só quando pedirem explicação/tutorial.
- ESCRITA DE PESSOA DE VERDADE: pode errar de leve a digitação/pontuação (pq, eai, slk). Não escreva como redação de escola nem robô.
- Não repita o que o usuário falou nem responda seco tipo API: converse de verdade.
- NUNCA revele dados do PC (IP, caminhos, senhas) no grupo.
- Responda SEMPRE em português brasileiro, texto simples com emojis, sem negrito/asteriscos.

MARCAS que o sistema entende (use no final quando fizer sentido):
- [MEMORIA: fato] gravar lembrete da pessoa.
- [PREFERENCIA: ...] gravar como a pessoa quer ser tratada ("age assim comigo", apelido, estilo) — siga SEMPRE depois.
- [AUDIO: texto falado] responder por voz (MUITO frequente em conversa leve — metade das faláveis; explicação é sempre texto).
- [STICKER: hint] figurinha — use MUITO (regra do dono): ~1 em cada 2-3 respostas de conversa leve; com [STICKER_SO] manda SÓ a figurinha.
- [REACAO: emoji] reagir com moderação.
- [SOLTA] recado pro grupo inteiro (raro). [CURTA]/[MEDIA]/[LONGA] tamanho.

DECISÃO DE FORMATO (regra do dono — escolha por mensagem como uma pessoa real):
- Conversa leve (zoeira, reação, resposta curta, clima) → a maioria deve ter figurinha OU ser áudio.
- Texto puro vira EXCEÇÃO, não regra. Misture: figurinha+texto, só figurinha, áudio, figurinha+áudio.
`;

const TOOL_GUIDE = `
📄 CITAÇÃO [CITAR]: quando o usuário pedir ou for recado oficial/citação de destaque, termine com [CITAR]. Não combine com [SOLTA]. Resposta comum não usa.

🧠 RACIOCÍNIO ReAct: pense antes de agir (objetivo → plano → ferramenta → observar → refletir → verificar). Ferramenta falhou? Mude de estratégia, não repita. Loop detectado (mesma ferramenta+args 3x, ou mesma ferramenta 8x seguidas) = pare e mude de abordagem.

💾 MEMÓRIA DE PEDIDOS: pedidos anteriores do usuário vêm no contexto. Repetiu pedido? Retome de onde parou. Ao concluir, o sistema guarda automaticamente.

🗂 VERSÕES: existe /versoes e /voltar <n> para restaurar a conversa. Não conserte histórico na mão.

👥 QUEM É QUEM + CONVERSA RECENTE + HISTÓRICO DA PESSOA vêm no contexto: use os nomes reais, nunca invente. O bloco "🗣️ O QUE ESTA PESSOA ANDOU FALANDO NO GRUPO" é só da pessoa com quem você está conversando agora — use pra puxar assunto do que ela mesma falou.

🚀 CRIAR COMANDO NOVO (dono): criar_comando(nome, descrição, código JS async ctx => {...}). Carrega na hora, salvo em src/grupo/, disponível no grupo já — sem mexer no código do bot. listar_comandos_dinamicos / apagar_comando. Valide a sintaxe antes. NUNCA use nome de comando que já existe no bot (menu, ban, ia, corvo...) — o sistema bloqueia. O ctx do handler tem: ctx.reply(texto), ctx.replyWithMarkdown(texto), ctx.message.text (mensagem completa), ctx.message.args (argumentos após o comando), ctx.from.id, ctx.chat.id, ctx.ehDono, ctx.enviarPv(numero, texto) (manda mensagem no PV de um número — ex: aviso no PV de fulano), ctx.resolverMembro(nome) (acha o NÚMERO de um membro do grupo pelo nome — retorna número sem @ ou null), ctx.corvo. Exemplo aviso no PV por nome: const alvo = await ctx.resolverMembro(ctx.message.args[0]); const texto = ctx.message.args.slice(1).join(" "); if (!alvo || !texto) return ctx.reply("Uso: /aviso <nome> <texto>"); await ctx.enviarPv(alvo, texto); return ctx.reply("✅ Aviso enviado!");




💎 VENDER VIP (qualquer pessoa): vender_vip(acao=tabela) → explique vantagens → vender_vip(acao=gerar_pix, plano=<id>). Automático, sem pedir confirmação ao dono. Remover VIP: gerenciar_vip (dono).

🤖 FUNÇÕES DO BOT: whatsapp_status, listar_grupos_whats, consultar_dado, consultar_datora, rajar_whatsapp, nukar_grupo, flood_ngl, flood_sendit. Regras iguais ao DM (VIP/whatsapp/limite — o sistema aplica, você só relata). Ações pesadas (rajada/nukar/flood): dono executa na hora; não-dono → encaminhe pedido ao dono via mensagem_usuario e aguarde. NUNCA peça "confirmo" no grupo.

🎯 EXECUTAR vs EXPLICAR: só chame ferramenta com pedido claro + alvo. Dúvida/hipótese/zoeira sem alvo → explique, não execute. Na dúvida, explique e pergunte.


📦 [ARQUIVO: caminho] no fim para enviar arquivo. Para membros: só arquivos das zonas liberadas; se criou fora, copie para data/downloads ou data/anexos.

↩️ REPLY (padrão) vs [SOLTA]: SOLTA só para recado do GRUPO INTEIRO (máx 1 a cada ~10 respostas). Tamanho: [CURTA]/[MEDIA]/[LONGA] só quando o natural sair errado. Regra final: marcador é exceção, não regra — no máx 2 seguidos.

✅ PROTOCOLO: tarefa com ferramentas só termina com [FIM] quando COMPLETA. Conversa simples responde normal sem [FIM]. 🚧 BLOQUEIO (regra do dono): se algo BARRAR você e você NÃO conseguir passar (erro repetido na mesma ferramenta, captcha/anti-robô, permissão negada, site fora do ar, dado faltando), PARE de insistir e AVISE O USUÁRIO na hora — responda em texto o que te bloqueou, o que você já tentou e o que precisaria pra destravar (ex: ele clicar no captcha, fornecer dado/permissão), e termine com [FIM]. Nunca fique repetindo a mesma coisa em loop nem desista em silêncio.

📌 MARCAS: [MEMORIA: fato] [PREFERENCIA: como a pessoa quer ser tratada] [GRUPO: nota] [PERSONA: nova] (só dono) [IMAGEM: url] [ARQUIVO: caminho] [AUDIO: fala] (muitas respostas faláveis; explicação é SEMPRE texto) [AUDIO_SO] (só áudio quando pedirem voz/cantar) [REACAO: emoji] [REACAO_SO] [STICKER: hint] (regra do dono: use MUITO — ~1 em cada 2-3 respostas de conversa leve; zoeira/reação/resposta curta quase sempre com figurinha) [STICKER_SO] [BOTOES: título|opção1|opção2] (manda botões clicáveis — até 5 opções separadas por |; o clique volta pra você e você continua a conversa) [ENQUETE: pergunta|opção1|opção2|opção3] (manda uma enquete de verdade — até 10 opções separadas por |) [EVOLUIR: ...] [EVOLUIR_FERRAMENTA: nome] [EVOLUIR_MELHORIA: ...] [SOLUCAO: ...] [LONGA_MISSAO] (+40 rodadas, missão pesada, no INÍCIO).

👥 GRUPOS E MEMBROS (regra do dono): o contexto traz o NOME do grupo onde você está, o QUEM É QUEM (todos os membros, mesmo quem ainda não falou) e a CONVERSA RECENTE do grupo. Use esses dados pra saber onde está e com quem fala. Se um membro pedir como quer ser tratado ("age assim comigo", "me chama de X", "não gosto de Y"), GRAVE com [PREFERENCIA: ...] — a preferência dele aparece no contexto dele SEMPRE depois. 🧑 GÊNERO (regra do dono): saiba se está falando com HOMEM ou MULHER olhando o NOME da pessoa no contexto ("Usuário falando agora: ..." / QUEM É QUEM) — nomes femininos = mulher, masculinos = homem. Não precisa gravar preferência. Se o nome não deixar claro, pergunte de leve no máximo uma vez. Nesta versão, se o usuário perguntar o que mudou no bot, responda de forma genérica.
`;

// 🪶 MODO LEVE (economia de tokens — regra do dono): conversa casual NÃO
// precisa de ferramentas, TOOL_GUIDE, comandos, histórico, evolução nem
// soluções. Detecta pergunta simples/curta (piada, "oi", agradecimento,
// pergunta besta) e usa um prompt ENXUTO (sem tools) → cai de ~160k para ~5k.
// Termos de AÇÃO (verbos de ferramenta/comando) forçam o modo completo.
// 💪 Termos de AÇÃO FORTES (verbos/funções que SEMPRE precisam de ferramenta):
// qualquer um deles força o modo completo.
const TERMOS_ACAO_FORTE = /(buscar|busca\b|pesquis\w*|procur\w*|acha\s+(pra|para|aqui)|baixar|baixa\b|download|yt\b|youtube|github|criar|cria\b|crie\b|editar|edita\b|melhora\w*|instalar|instala\b|rodar|roda\b|executar|terminal|comando\b|cmd\b|código|codigo|script|print|captura|consulta\w*|cpf|placa|telefone|vip|rajar|raja\b|rajada|nukar|nuka\b|flood|whatsapp|ngl|sendit|postar|posta\b|configur\w*|remover|remove\b|fixar|jid|status\s+do\s+bot|comandos|gerar|gera\b|monta\w*|abre\w*|abrir|muda\s+(o|a)\s+(nome|descri|foto|titulo|t[íi]tulo)|resum\w*|datora|comprar|compra\b|plano\b|pix\b|renovar|venda\b|descompact\w*|compact\w*|zip\w*|extrair\b|extra[íi]r|extra[íi]da|extrai\b|canta\w*|o\s+que\s+mudou|mudou\s+no\s+bot|foi\s+(alterado|modificado)|arquivos\s+modificados|sobre\s+(o\s+)?bot|sobre\s+a\s+corvo|tudo\s+sobre\s+(o\s+)?bot|o\s+que\s+voc[eê]\s+sabe|olh\w*\s+(o|a|os|as|meu|minha|pc|computador|pasta|arquivo|na|no)\b|v[eê]\s+(o|a|os|as|meu|minha|pc|computador|pasta|arquivo)|verific\w*|chec\w*|analis\w*|v[eê]r\s+(o|a|os|as|meu|minha|pc|computador|pasta|arquivo|se)\b)/i;

// 🗣️ Termos FRACOS (substantivos que aparecem em conversa casual: "que foto bonita",
// "vi um vídeo", "esse arquivo é top"): só forçam o modo completo quando a mensagem
// tem PEDIDO explícito (INTENCAO_PEDIDO) — senão vai pro modo leve (economia).
const TERMOS_ACAO_FRACO = /(arquivo|pasta|programa|imagem|foto|v[íi]deo|áudio|audio|voz|site\b|canal|bot\b|pc\b|computador\b|tela\b|sistema\b|processo\b)/i;

// 🙋 Linguagem de PEDIDO explícito ("me manda", "quero que", "pode fazer", "faz pra mim",
// "baixa esse", "preciso de"...): combina com termo fraco → modo completo.
const INTENCAO_PEDIDO = /(me\s+(manda|mande|envia|envie|d[áa]|da|mostra|mostre|procura|busca|baixa|cria|crie|edita|instala|abre|pega|faz|faça|ajuda)|quero\s+(\w+\s+)?(que|um|uma|ver|assistir|ouvir|baixar|criar|editar|gerar|saber|voc[eê]|o|a|esse|essa)|pode\s+(me\s+)?(fazer|mandar|enviar|baixar|criar|editar|procurar|buscar|abrir|ajudar|configurar|instalar|remover|gerar|mostrar|ver|pegar|postar|consultar)|(manda|envia)\s+(pra|para|um|uma|o|a|aqui|esse|essa|aqu[ií])|(faz|faça)\s+(um|uma|o|a|pra|para|isso|aqui|esse|essa)|preciso\s+(\w+\s+)?(de\s+)?(um|uma|que|de|do|da|dos|das)|gostaria\s+(\w+\s+)?(de|que|do|da|dos|das)|(mostra|mostre)\s+(o|a|um|uma|esse|essa)|me\s+ajuda\s+a|ajuda\s+a|(baixa|cria|edita|pega|abre|manda)\s+(esse|essa|um|uma|o|a|a[ií]|aqui)|(pra|para)\s+mim)/i;

// 🎙️ MODO SÓ ÁUDIO (por usuário — cada pessoa escolhe como a IA responde pra
// ela, no PV e nos grupos). Pedidos que ATIVAM ("fala só por áudio", "só áudio",
// "responda só por voz daqui pra frente", "modo áudio") e que DESATIVAM
// ("volta a responder por texto", "só texto", "para de falar por áudio").
// A detecção roda no processAgent e grava em ia_memory (modoResposta).
// 🛡️ A frase solta "só áudio" (sem verbo diretor) só ativa em mensagem CURTA
// ou com marco de futuro ("daqui pra frente") — evita que uma menção casual
// (ex: "esse vídeo ficou só áudio") ligue o modo permanente por engano.
const RE_PEDE_SO_AUDIO = /\b(fala|fale|responde|responda|responder|falar|conversa|converse|me\s+responde|me\s+responda)\b[^.!?]{0,30}\b(s[óo]|somente|apenas|sempre|tudo)\b[^.!?]{0,20}\b(áudio|audio|voz)\b|\bmodo\b\s*(s[óo]\s*)?\b(áudio|audio|voz)\b/i;
const RE_PEDE_SO_AUDIO_SOLTO = /\b(s[óo]|somente|apenas)\b\s*(por|em|no|na|de|com)?\s*\b(áudio|audio|voz)\b/i;
const RE_MARCO_FUTURO = /\b(daqui|a\s+partir|apartir|de\s+agora|agora|sempre|pra\s+frente|de\s+agora\s+em\s+diante|doravante)\b/i;
const RE_VOLTA_TEXTO = /\b(para|pare|pode\s+parar|tira|tirar|desliga|desligar|sai|sair|cancela|cancelar|acabou)\b[^.!?]{0,40}\b(áudio|audio|voz)\b|\b(volta|volte|voltar|pode)\b[^.!?]{0,30}\b(responde|responda|responder|fala|fale|falar|escreve|escrever)\b[^.!?]{0,20}\b(por|em|de|com)?\b(texto|escrito|normal)\b|\b(responde|responda|fala|fale|falar|escreve|escrever)\b[^.!?]{0,20}\b(por|em|de|com)?\b(texto|escrito)\b|\b(s[óo]|somente|apenas)\b\s*(por|em|de|com)?\s*\b(texto|escrito)\b|\b(volta|volte|voltar)\b[^.!?]{0,10}\bnormal\b/i;

function ehConversaLeve(query, info, midiaContents, anexo) {
  const q = String(query || '').trim();
  if (!q || q.length > 300) return false;
  if (Array.isArray(midiaContents) && midiaContents.length) return false;
  if (anexo) return false;
  try { if (sinal.missaoAtiva(info.chat.id)) return false; } catch (e) {}
  // Ação clara de ferramenta → modo completo SEMPRE
  if (TERMOS_ACAO_FORTE.test(q)) return false;
  // Substantivo casual + pedido explícito → completo; só menção → leve (economia)
  if (TERMOS_ACAO_FRACO.test(q) && INTENCAO_PEDIDO.test(q)) return false;
  return true;
}

function buildSystemLeve(info, query) {
  let s = SYSTEM_LEVE;
  const persona = mem.getPersona();
  if (persona) s += `\n\n🎭 PERSONA ATUAL (ordem do DONO — sobrescreve a persona padrão):\n${persona}`;
  // Contexto mínimo (quem é o usuário e se é dono/admin/vip)
  const u = info.usuario;
  s += `\n\nCONTEXTO:\nBot: ${info.bot.nome} (dono: ${info.bot.donoNome})\n`;
  s += `Usuário falando agora: ${u.nome}${u.is_dono ? ' (DONO DO BOT)' : u.is_admin ? ' (ADMIN DO GRUPO)' : ''}`;
  if (u.username) s += ` @${u.username}`;
  s += `\nAcesso: ${u.is_dono ? '👑 DONO' : u.is_vip ? '🟢 VIP' : 'membro comum'}\n`;
  const c = info.chat;
  if (c.tipo?.includes('group') && c.titulo) s += `Grupo: ${c.titulo}\n`;
  // Fatos mais relevantes do usuário (útil e barato)
  const facts = mem.formatFactsRelevantes(u.id, query, 5);
  if (facts) s += `\n${facts}`;
  // 🎯 Preferências do usuário ("age assim comigo") — sempre visíveis no leve
  const prefs = mem.formatPreferences(u.id, 4);
  if (prefs) s += prefs;
  // 🎙️ MODO SÓ ÁUDIO: o usuário pediu pra IA responder SÓ por nota de voz —
  // avisa pra ela escrever curto e falado (o texto vira o áudio).
  // 🐛 EXCEÇÃO (regra do dono): o modo só áudio NUNCA impede tarefa com
  // ferramenta (olhar PC, pesquisar, criar, baixar, editar, instalar). Se o
  // pedido for uma TAREFA, EXECUTE as ferramentas normalmente e entregue o
  // resultado (texto/arquivo/imagem) — o só áudio vale só pra conversa leve.
  if (info.modoResposta === 'audio') {
    s += `\n\n🎙️ ESTE USUÁRIO ATIVOU O MODO SÓ ÁUDIO: responda SÓ por nota de voz (o sistema converte seu texto em áudio automaticamente). Escreva a resposta CURTA, como uma fala natural, SEM emojis/símbolos que a voz não lê e SEM texto longo. Não precisa marcar [AUDIO]. ⚠️ EXCEÇÃO (regra do dono): se o pedido for uma TAREFA que precisa de ferramenta (olhar/analisar o PC, pesquisar, criar, baixar, editar, instalar, executar comando, consultar), EXECUTE as ferramentas NORMALMENTE até concluir e entregue o resultado do jeito certo (texto, arquivo ou imagem) — o modo só áudio vale apenas para conversa leve, NUNCA bloqueia tarefa.`;
  }
  // 💬 Conversa recente do GRUPO (o que estão falando agora) — enxuto no leve
  if (info.chat?.tipo?.includes('group') && info.chat.conversaRecente) {
    s += `\n${info.chat.conversaRecente.slice(0, 500)}`;
  }
  // 🔁 Continuidade mínima: últimas 2-3 trocas da conversa (barato, mantém contexto)
  try {
    const hist = mem.getHistory(c.id);
    if (Array.isArray(hist) && hist.length) {
      const ultimas = hist.slice(-3);
      s += `\n\nÚLTIMAS TROCAS DESTA CONVERSA:`;
      for (const e of ultimas) {
        // 🛡️ Fallback NEUTRO (não o nome do usuário atual): entrada antiga sem
        // nome gravado não pode ser atribuída a quem está falando agora — senão
        // a IA troca os usuários (acha que outra pessoa disse o que ela disse).
        const quem = e.role === 'user' ? (e.nome || 'Alguém do grupo') : 'Você (IA)';
        s += `\n- ${quem}: "${String(e.text || '').slice(0, 120)}"`;
      }
    }
  } catch (e) { /* histórico ausente → segue sem */ }
  s += `\n${STYLE_REMINDER}`;
  return s;
}

function buildSystem(info, query = '') {
  const system = getSystemPrompt();
  const memoryMd = mem.readMemoryMd();
  const persona = mem.getPersona();
  const contextText = formatContext(info);
  const factsText = mem.formatFactsRelevantes(info.usuario.id, query);
  const prefsText = mem.formatPreferences(info.usuario.id);
  const requestsText = mem.formatRequests(info.usuario.id);
  const historyText = mem.formatHistory(info.chat.id, info.usuario.nome);
  const commandsText = formatCommandList();
  const evolutionText = evo.getEvolutionBlock();
  const solutionsText = mem.formatSolutions();
  // 🎙️ MODO SÓ ÁUDIO: aviso pro modo completo (mesmo do leve) — a resposta
  // vira nota de voz, então o texto deve ser curto e falado.
  // 🐛 EXCEÇÃO (regra do dono): tarefa com ferramenta SEMPRE executa — o
  // modo só áudio não pode fazer a IA deixar de olhar/pesquisar/criar.
  const modoAudioNote = info.modoResposta === 'audio'
    ? `\n\n🎙️ ESTE USUÁRIO ATIVOU O MODO SÓ ÁUDIO: responda SÓ por nota de voz (o sistema converte seu texto em áudio automaticamente). Escreva a resposta CURTA, como uma fala natural, SEM emojis/símbolos que a voz não lê e SEM texto longo. Não precisa marcar [AUDIO]. ⚠️ EXCEÇÃO (regra do dono): se o pedido for uma TAREFA que precisa de ferramenta (olhar/analisar o PC, pesquisar, criar, baixar, editar, instalar, executar comando, consultar), EXECUTE as ferramentas NORMALMENTE até concluir e entregue o resultado do jeito certo (texto, arquivo ou imagem) — o modo só áudio vale apenas para conversa leve, NUNCA bloqueia tarefa.`
    : '';

  let s = system;
  if (memoryMd) s += `\n\n=== MEMÓRIA DE LONGO PRAZO (memory.md) ===\n${memoryMd}`;
  if (persona) s += `\n\n🎭 PERSONA ATUAL (ordem do DONO — sobrescreve a persona padrão):\n${persona}\n\nMantenha essa persona até o dono mandar mudar.`;
  s += `\n\n${contextText}${prefsText}${commandsText}${requestsText}${factsText}${historyText}${evolutionText}${solutionsText}${modoAudioNote}\n${TOOL_GUIDE}\n${STYLE_REMINDER}`;
  return s;
}

// Remove os marcadores de sistema da cópia usada para DETECTAR [CITAR]/tamanho
// (mantém o texto original intacto; preserva os marcadores que interessam ao
// chamador — por padrão remove tudo exceto o alvo que será testado depois).
function limparMarcadores(texto) {
  return String(texto || '')
    .replace(/\[(MEMORIA|GRUPO|PERSONA|IMAGEM|ARQUIVO|AUDIO|STICKER|REACAO|PREFERENCIA|EVOLUIR(?:_FERRAMENTA|_MELHORIA)?|SOLUCAO|LONGA_MISSAO):?[^\]]*\]/gi, '')
    .replace(/\[(SOLTA|REPLY)\]/gi, '');
}

function cleanAiText(text) {
  let t = String(text || '');
  // 🛠️ Quebra de linha "escapada": o Gemini às vezes devolve o texto com "\n"
  // LITERAL (barra + n) em vez de quebra de linha real — a resposta sai toda
  // misturada no PC/celular. Converte para quebra de linha de verdade.
  t = t.replace(/\\r\\n/g, '\n');
  t = t.replace(/\\n/g, '\n');
  t = t.replace(/[\*_`]+/g, '');
  t = t.replace(/[ \t]{2,}/g, ' ');
  t = t.trim();
  return t;
}

// Limites de tamanho por nível escolhido pela IA (em caracteres)
const LIMITES_TAMANHO = { CURTA: 300, MEDIA: 900, LONGA: 4000 };

// Corta a resposta no limite sem quebrar palavra no meio (corta na última quebra
// de linha ou espaço antes do limite, e adiciona "…" quando cortar)
function truncarPorTamanho(texto, limite) {
  let t = String(texto || '').trim();
  if (!t || t.length <= limite) return t;
  let corte = t.slice(0, limite);
  const quebra = Math.max(corte.lastIndexOf('\n'), corte.lastIndexOf(' '));
  if (quebra > limite * 0.6) corte = corte.slice(0, quebra);
  return corte.trimEnd() + '…';
}

/**
 * Processa pergunta da IA no grupo (agente autônomo com ferramentas)
 * @param {object} ctx - Telegraf context
 * @param {string} query - pergunta
 * @param {Array} midiaContents - [{dataBuffer, mimeType}] opcional
 * @param {object} opts - { onStream: (trecho)=>void, onTool: (nome,args)=>void }
 * @returns {Promise<{text: string, imagens: string[], tokens: number}>}
 */
async function processAgent(ctx, query, midiaContents = [], opts = {}) {
  const chatId = ctx.chat?.id;

  const info = await gatherContext(ctx);
  if (opts.anexo) info.anexo = opts.anexo;
  // 🔎 usa o número real (resolvido de LID → JID) para limites/memória
  const userId = info.usuario.id || ctx.from?.id;

  // 🎙️ MODO SÓ ÁUDIO por usuário: cada pessoa escolhe individualmente como a IA
  // responde pra ela (vale no PV e nos grupos). "fala só por áudio daqui pra
  // frente" grava 'audio' — daí em diante TODA resposta pra essa pessoa sai
  // só por voz, até ela pedir pra voltar ao texto. A detecção é por linguagem
  // natural (não é comando), então roda aqui antes do cérebro.
  const qModo = String(query || '').trim();
  // 🛡️ "só áudio" solto só vale em mensagem curta (pedido direto) ou com marco
  // de futuro ("só áudio daqui pra frente") — menção casual não liga o modo.
  // 🐛 O teste de comprimento roda numa cópia LIMPA: no grupo o @mention fica no
  // texto ("@5511... só áudio" passaria de 20 chars) e no reply à msg do bot
  // entra o prefixo "Contexto: ... — ". Limpar essas partes evita falso negativo
  // exatamente nos jeitos naturais de pedir (menção no grupo / reply no PV).
  const qModoLimpo = qModo
    .replace(/@\S+/g, ' ')
    // 🐛 A citação do bot vem SEMPRE entre aspas (Contexto: "..." — texto): o
    // strip é ciente das aspas pra não parar no primeiro travessão — a persona
    // do bot usa "—" com frequência dentro das próprias mensagens. Fallback
    // greedy cobre o caso raro de aspa literal dentro da citação.
    .replace(/^Contexto:"[^"]*"\s*—\s*/, '')
    .replace(/^Contexto:[\s\S]*—\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  // 🐛 As regexes rodam no TEXTO LIMPO: quando o usuário responde à mensagem do
  // bot, o prompt vira "Contexto: \"...\" — <texto>". Se a citação do bot
  // contiver "só áudio" (ex.: ele acabou de explicar o modo), testar no qModo
  // original ativaria o modo por engano. No texto limpo só sobra a fala real.
  const pedidoAudioSolto = RE_PEDE_SO_AUDIO_SOLTO.test(qModoLimpo) &&
    (qModoLimpo.length <= 20 || RE_MARCO_FUTURO.test(qModoLimpo));
  if ((RE_PEDE_SO_AUDIO.test(qModoLimpo) || pedidoAudioSolto) && !RE_VOLTA_TEXTO.test(qModoLimpo)) {
    if (mem.getModoResposta(userId) !== 'audio') {
      mem.setModoResposta(userId, 'audio');
      console.log(`[𝒀𝑨𝑲𝑨𝑴𝒀-IA] 🎙️ modo só áudio ATIVADO para ${userId}`);
    }
  } else if (RE_VOLTA_TEXTO.test(qModo)) {
    if (mem.getModoResposta(userId) === 'audio') {
      mem.setModoResposta(userId, null);
      console.log(`[𝒀𝑨𝑲𝑨𝑴𝒀-IA] 🎙️ modo só áudio desativado para ${userId}`);
    }
  }
  info.modoResposta = mem.getModoResposta(userId);

  // 🚦 Limite diário (dono isento; VIP tem teto maior)
  let isVip = false;
  try {
    const core = require('./ia_core');
    if (core.isReady() && typeof core.getCore().isUserVip === 'function') isVip = !!core.getCore().isUserVip(userId);
  } catch (e) {}
  const lim = limites.checarLimite(userId, { isDono: !!info.usuario.is_dono, isVip });
  if (!lim.ok) {
    return { text: `⛔ ${lim.motivo}`, imagens: [], arquivos: [], audios: [], tokens: 0 };
  }

  // 🚦 Fila global: roda no máximo 3 chamadas de IA simultâneas
  return limites.enfileirar(async () => {
    // 🪶 MODO LEVE (economia): conversa casual usa prompt enxuto SEM ferramentas,
    // comandos, histórico e TOOL_GUIDE (cai de ~160k para ~5k chars por chamada).
    const leve = ehConversaLeve(query, info, midiaContents, opts.anexo);
    const system = leve ? buildSystemLeve(info, query) : buildSystem(info, query);

    mem.addExchange(chatId, 'user', query, { nome: info.usuario.nome });
    mem.addRequest(userId, info.usuario.nome, query);

    sinal.iniciarMissao(chatId);
    let res;
    try {
      if (leve) {
        // 💬 Conversa casual: chamada SIMPLES (sem tools, flash, thinking baixo)
        res = await askSystemGemini(system, `\n\n[PERGUNTA]\n${query}\n`, [], { thinkingBudget: 128 });
      } else {
        // 🎯 Modo agente completo (ferramentas + visão de mídia)
        const temMidia = Array.isArray(midiaContents) && midiaContents.length > 0;
        const agentOpts = {
          tools: getToolSchemas(),
          toolsGetter: getToolSchemas,
          toolExecutor: executeTool,
          toolCtx: { isDono: !!info.usuario.is_dono, isAdmin: !!info.usuario.is_admin, chatId, userId, mensagem: query, ...(opts.corvoCtx || {}) },
          sinal: () => sinal.consumirSinal(chatId),
          onStream: typeof opts.onStream === 'function' ? opts.onStream : null,
          onTool: typeof opts.onTool === 'function' ? opts.onTool : null,
        };
        // 🧠 Gemini resolve TEXTO e VISÃO de mídia (tudo junto, com midia quando houver)
        res = await askSystemGeminiTools(system, `\n\n[PERGUNTA]\n${query}\n`, { ...agentOpts, midia: temMidia ? midiaContents : [] });
      }
    } finally {
      sinal.finalizarMissao(chatId);
    }

    if (!info.usuario.is_dono) limites.registrarUso(userId);

    let text = res.text || '';
    const imagens = [];
    let arquivos = []; // 🐛 let: o filtro abaixo REASSIGNA (const quebrava em runtime)
    const audios = [];
    const stickers = [];
    // ↩️ REPLY vs SOLTA: padrão é REPLY — responde CITANDO a mensagem de quem
    // perguntou (o Telegram marca como "respondeu a..."). A IA marca [SOLTA]
    // SOMENTE para recado pro grupo inteiro.
    let modoResposta = 'reply';
    // 🎙 SÓ ÁUDIO: true quando a IA marca [AUDIO_SO] (responde só por voz, sem texto)
    let somenteAudio = false;
    // 🟩 SÓ FIGURINHA: true quando a IA marca [STICKER_SO] (responde só com figurinha)
    let somenteSticker = false;
    // 👍 SÓ REAÇÃO: true quando a IA marca [REACAO_SO] (só reage, sem texto/figurinha/áudio)
    let somenteReacao = false;
    // 👍 REAÇÃO: emoji que a IA marca ([REACAO: ...]) para reagir à mensagem do usuário
    let reacao = '';
    // 📄 BLOCKQUOTE/CITAÇÃO: declarados AQUI (fora do if(text)) — o return final
    // usa essas variáveis e, se o provider devolver texto vazio, o if(text) é
    // pulado; declarar dentro quebrava com "blockquote is not defined".
    let modoCitacao = false;
    let blockquote = false;
    const textoOriginalMarcadores = String(text || '');

    if (text) {
      // 🛠️ Guarda na memória o texto com quebras de linha REAIS (normaliza \n
      // literal do modelo) — senão a memória reforça o modelo a continuar
      // escapando as quebras de linha nas próximas respostas.
      const textoMemoria = String(text || '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
      mem.addExchange(chatId, 'assistant', textoMemoria.slice(0, 800));

      const m = text.match(/\[MEMORIA:\s*([^\]]+)\]/);
      if (m && m[1]?.trim()) mem.addFact(userId, m[1].trim());

      // 🎯 PREFERÊNCIA: "quero que você aja assim comigo" / "me chama de X" /
      // "não gosto de Y" → grava como preferência do usuário (fica separado
      // dos fatos e SEMPRE aparece no contexto daquele usuário).
      const prf = text.match(/\[PREFERENCIA:\s*([^\]]+)\]/);
      if (prf && prf[1]?.trim()) mem.addPreference(userId, prf[1].trim());

      const g = text.match(/\[GRUPO:\s*([^\]]+)\]/);
      if (g && g[1]?.trim()) mem.appendGroupNote(g[1].trim());

      const p = text.match(/\[PERSONA:\s*([^\]]+)\]/);
      if (p && p[1]?.trim() && info.usuario.is_dono) mem.setPersona(p[1].trim());

      const img = text.match(/\[IMAGEM:\s*([^\]]+)\]/);
      if (img && img[1]?.trim()) {
        for (const u of img[1].split(/[\s,;]+/)) {
          if (u.startsWith('http')) imagens.push(u);
        }
      }

      const arq = text.match(/\[ARQUIVO:\s*([^\]]+)\]/g);
      if (arq) {
        for (const bloc of arq) {
          const parts = bloc.match(/\[ARQUIVO:\s*([^\]]+)\]/);
          if (parts && parts[1]) arquivos.push(parts[1].trim());
        }
      }

      const aud = text.match(/\[AUDIO:\s*([^\]]+)\]/g);
      if (aud) {
        for (const bloc of aud) {
          const parts = bloc.match(/\[AUDIO:\s*([^\]]+)\]/);
          if (parts && parts[1]?.trim()) audios.push(parts[1].trim().slice(0, 400));
        }
      }

      // 🟩 FIGURINHA: a IA marca [STICKER: hint] para mandar uma figurinha
      // no chat (sozinha ou em reply). O hint pode ser um emoji ou descrição
      const stk = text.match(/\[STICKER:\s*([^\]]+)\]/g);
      if (stk) {
        for (const bloc of stk) {
          const parts = bloc.match(/\[STICKER:\s*([^\]]+)\]/);
          if (parts && parts[1]?.trim()) stickers.push(parts[1].trim().slice(0, 60));
        }
      }

      // 👍 REAÇÃO: a IA marca [REACAO: emoji] para reagir à mensagem de quem falou
      const rc = text.match(/\[REACAO:\s*([^\]]+)\]/);
      if (rc && rc[1]?.trim()) reacao = rc[1].trim().replace(/\s+/g, '').slice(0, 8);

      // 🎙 SÓ ÁUDIO: se a IA marcar [AUDIO_SO], envia só a nota de voz (sem texto)
      if (/\[AUDIO_SO\]/i.test(text)) somenteAudio = true;

      // 🟩 SÓ FIGURINHA: se a IA marcar [STICKER_SO], envia SÓ a figurinha
      if (/\[STICKER_SO\]/i.test(text)) somenteSticker = true;

      // 👍 SÓ REAÇÃO: se a IA marcar [REACAO_SO], responde SÓ com a reação
      if (/\[REACAO_SO\]/i.test(text)) somenteReacao = true;

      // 🛡️ Fallback: se o usuário PEDIR a voz explicitamente e a IA mandou áudio,
      // garante que sai SÓ o áudio mesmo se ela esquecer o [AUDIO_SO]
      if (!somenteAudio && audios.length &&
          /(quero ouvir (a |sua )?voz|ouvir (a |sua )?voz|manda (um )?áudio|manda (um )?audio|mandar (um )?(áudio|audio|voz)|manda (um )?voz|me manda (um )?(áudio|audio|voz)|fala (um |no |por )?(áudio|audio|voz)|responde por áudio|responde em áudio|responde por audio|responde em audio|responde (em|por) voz|só áudio|so audio|nota de voz|voz da ia|voz da i\.a)/i.test(query)) {
        somenteAudio = true;
      }

      // 🎵 CANTAR: se o usuário PEDIR pra cantar, GARANTE que sai áudio cantando
      // (mesmo se a IA esquecer o marcador [AUDIO], o texto dela vira a música)
      const pediuCantar = /(\bcantar|\bcanta\b|\bcante\b|\bcantando|me canta|manda.*áudio.*cantan|audio.*cantan)/i.test(query);
      if (pediuCantar) {
        if (audios.length) {
          somenteAudio = true;
        } else if (text) {
          // 🎵 A IA esqueceu o [AUDIO]: o texto dela vira a música (ttsToAudio já corta em 400)
          audios.push(text.replace(/\[[^\]]*\]/g, '').trim().slice(0, 400));
          somenteAudio = true;
          text = '';
        }
      }

      const ev = text.match(/\[EVOLUIR:\s*([^\]]+)\]/);
      if (ev && ev[1]?.trim()) evo.registrarEvolucao('decisao', ev[1].trim());

      const sol = text.match(/\[SOLUCAO:\s*([^\]]+)\]/);
      if (sol && sol[1]?.trim()) mem.addSolution(sol[1].trim());

      const evFerramenta = text.match(/\[EVOLUIR_FERRAMENTA:\s*([^\]]+)\]/);
      if (evFerramenta && evFerramenta[1]?.trim()) evo.registrarFerramenta(evFerramenta[1].trim(), '');    const evMelhoria = text.match(/\[EVOLUIR_MELHORIA:\s*([^\]]+)\]/);
    if (evMelhoria && evMelhoria[1]?.trim()) evo.registrarMelhoria(evMelhoria[1].trim());

    // ↕️ A IA decide se responde como reply ou solta no grupo
    const marcador = text.match(/\[(SOLTA|REPLY)\]/i);
    if (marcador) {
      modoResposta = marcador[1].toUpperCase() === 'SOLTA' ? 'solta' : 'reply';
      text = text.replace(/\[(SOLTA|REPLY)\]/gi, '').trim();
    }

    // 📄 A IA decide se quer blockquote/citação ([CITAR]) — além do usuário pedir
    // Só considera quando o marcador está no FIM da resposta (evita auto-acionar
    // se a IA apenas explicar a feature para alguém). A detecção roda numa cópia
    // com os outros marcadores de sistema já removidos, para funcionar mesmo se
    // a IA escrever "[CITAR]\n[MEMORIA: ...]" no fim.
    const textoSemMarcadores = limparMarcadores(text)
      .replace(/\[(CURTA|MEDIA|LONGA)\]/gi, '')
      .trim();
    if (/\[CITAR\]\s*$/i.test(textoSemMarcadores)) {
      modoCitacao = true;
    }
    text = text.replace(/\[CITAR\]/gi, '').trim();

    // 📏 A IA decide o tamanho da resposta: [CURTA] [MEDIA] [LONGA]
    // Padrão AUTO = mantém o tamanho natural. Só corta quando há marcador no
    // FIM da resposta (mesmo padrão do [CITAR]: evita truncar a resposta se a
    // IA apenas explicar a feature para alguém). A remoção acontece em qualquer
    // posição para não vazar o literal.
    let tamanhoResposta = 'AUTO';
    // Detecta numa cópia do TEXTO ORIGINAL com os demais marcadores removidos
    // (sistema + SOLTA/REPLY + CITAR), MANTENDO os de tamanho. Funciona com
    // combos no fim tipo "[CURTA][CITAR]" ou "[CURTA]\n[MEMORIA: x]"
    const textoSemTudo = limparMarcadores(text)
      .replace(/\[CITAR\]/gi, '')
      .trim();
    const marcaTamanho = textoSemTudo.match(/\[(CURTA|MEDIA|LONGA)\]\s*$/i);
    if (marcaTamanho) {
      tamanhoResposta = marcaTamanho[1].toUpperCase();
    }
    text = text.replace(/\[(CURTA|MEDIA|LONGA)\]/gi, '').trim();

    // 📝 Loga a decisão de marcadores desta resposta (para acompanhar exagero).
    // AVULSA (padrão) = auto; [REPLY] = citar a mensagem; [SOLTA] = recado geral.
    marcadoresLog.registrar({
      userId,
      chatId,
      solta: /\[SOLTA\]/i.test(textoOriginalMarcadores),
      replyForcado: /\[REPLY\]/i.test(textoOriginalMarcadores),
      citar: modoCitacao,
      tamanho: tamanhoResposta !== 'AUTO' ? tamanhoResposta : null,
      query: String(query || '').slice(0, 120),
    });

    text = text
        .replace(/\[MEMORIA:[^\]]*\]/g, '')
        .replace(/\[PREFERENCIA:[^\]]*\]/g, '')
        .replace(/\[GRUPO:[^\]]*\]/g, '')
        .replace(/\[PERSONA:[^\]]*\]/g, '')
        .replace(/\[IMAGEM:[^\]]*\]/g, '')
        .replace(/\[ARQUIVO:[^\]]*\]/g, '')
        .replace(/\[AUDIO:[^\]]*\]/g, '')
        .replace(/\[AUDIO_SO\]/gi, '')
        .replace(/\[STICKER_SO\]/gi, '')
        .replace(/\[REACAO_SO\]/gi, '')
        .replace(/\[STICKER:[^\]]*\]/g, '')
        .replace(/\[REACAO:[^\]]*\]/g, '')
        .replace(/\[EVOLUIR:[^\]]*\]/g, '')
        .replace(/\[EVOLUIR_FERRAMENTA:[^\]]*\]/g, '')
        .replace(/\[EVOLUIR_MELHORIA:[^\]]*\]/g, '')
        .replace(/\[SOLUCAO:[^\]]*\]/g, '')
        .replace(/\[LONGA_MISSAO\]/gi, '')
        .trim();
      text = cleanAiText(text);

      // 📏 Corta no limite do tamanho escolhido pela IA (antes do blockquote)
      if (text && tamanhoResposta !== 'AUTO' && LIMITES_TAMANHO[tamanhoResposta]) {
        text = truncarPorTamanho(text, LIMITES_TAMANHO[tamanhoResposta]);
      }

      // 📄 Blockquote: o texto fica LIMPO e a flag `blockquote` avisa o chamador
      // para ENVOLVER em <blockquote> HTML na hora de enviar (o Telegram renderiza
      // a citação de verdade — prefixar com ">" mostrava o símbolo literal).
      const pediuBlockquote = /blockquote|citaç|cita\b|aspas|em cita/i.test(query);
      if (text && (pediuBlockquote || modoCitacao)) blockquote = true;

      mem.setRequestResult(userId, query, String(text || '').slice(0, 200));
    }

    // 🐛 FIX 2: filtra marcadores com caminho que não existe — se a IA marcou
    // [ARQUIVO: caminho_errado], o enviarResposta ia tentar enviar e falhar.
    arquivos = arquivos.filter((cam) => {
      if (!cam || typeof cam !== 'string') return false;
      return /^https?:/i.test(cam) || fs.existsSync(cam);
    });
    // 📎 AUTO-ENTREGA DE ARQUIVO (regra do dono): se a IA criou/baixou arquivo
    // via ferramenta mas ESQUECEU o marcador [ARQUIVO: ...] — OU marcou um
    // caminho INVÁLIDO (que não existe em disco) — entrega o que as ferramentas
    // geraram de verdade. 🐛 FIX: antes, um marcador com caminho quebrado
    // deixava `arquivos` não-vazio e pulava a auto-entrega → o arquivo real
    // nunca chegava. Agora roda SÓ quando não sobrou NENHUM marcador válido —
    // assim não entrega temp/backup que a IA criou no meio mas não quis mandar.
    if (!arquivos.length && Array.isArray(res?.arquivosGerados) && res.arquivosGerados.length) {
      for (const cam of res.arquivosGerados.slice(-3)) { // 🕐 últimos 3 = mais recentes
        try {
          if (cam && typeof cam === 'string' && fs.existsSync(cam) && !arquivos.includes(cam)) arquivos.push(cam);
        } catch (e) { /* um caminho inválido não derruba */ }
      }
    }

    // 🎙️ MODO SÓ ÁUDIO do usuário ativo: garante que a resposta sai SÓ por voz,
    // mesmo se a IA esquecer de marcar [AUDIO_SO] — o texto dela vira a nota de
    // voz (mesma lógica do "cantar"). Figurinha/re ação não substituem a voz.
    // 🐛 O texto NÃO é zerado de propósito: se o TTS falhar no envio (rede/
    // ffmpeg/quota), o corvo-ia.js cai pro texto e o usuário não fica sem
    // resposta. O envio duplicado (áudio + texto iguais) já é evitado pelo
    // ehRepeticaoAudioTexto no enviarResposta (e pelo próprio somenteAudio).
    // 🐛 FIX (regra do dono): TAREFA com ferramenta NUNCA vira só áudio — o
    // modo só áudio vale apenas pra conversa leve. Se a mensagem pediu ação
    // (modo completo com tools), o resultado sai em texto/arquivo/imagem
    // normalmente; só a conversa casual é que vira voz. Antes, o modo áudio
    // "engolia" a resposta da tarefa e o usuário ficava só com a voz curta
    // da IA falando que ia fazer (sem nunca executar nada).
    if (info.modoResposta === 'audio' && leve) {
      somenteAudio = true;
      somenteSticker = false;
      somenteReacao = false;
      if (!audios.length && text) {
        audios.push(String(text).trim().slice(0, 400));
      }
    }

    return { text, imagens, arquivos, audios, stickers, tokens: res.tokens, modoResposta, somenteAudio, somenteSticker, somenteReacao, reacao, blockquote };
  });
}

module.exports = { processAgent, getSystemPrompt, gatherContext, ehConversaLeve, buildSystemLeve, buildSystem };