const fs = require('fs-extra');
const colors = require("colors");


exports.msgpremium = (numerodono) => {
return `Esse comando so pode ser utilizado para os usuários Premium, caso queira adquirir o premium contate o meu dono: wa.me//${numerodono}`

}

exports.antipv = (numerodono, prefix) => {
return `Sinto muito *#nome#*, mas meu dono não permitiu eu responder ninguém, então terei que bloquear você... ;)" 

Para mais informações contate o meu dono:
wa.me//${numerodono}`

}

exports.connecting = () => {
response = ["Inicializando ou reiniciando meu sistema, aguarde mestre...", "Só um segundinho, estou carregando as informações nescessárias.", "Inicialização do bot está em andamento! Carregando informações, aguarde...", "Já tomou um copo de água hoje? Se não vai lá! Iniciando bot...", "Oiiieee fofuxo, tudo baum? Já tô iniciando gostoso, calma aí..."]
return response[Math.floor(Math.random() * response.length)]
}

exports.ErrorBaileys401 = () => {
response = ["Houve uma desconexão, re-escaneie o QR, se preciso... Estou reiniciando!", "Minha sessão desconectou, pode reconectar e escanear o QR novamente? Gerando qr-code!", "Você me desconectou? A sessão precisa ser escaneada novamente... Estou reiniciando!"]
return response[Math.floor(Math.random() * response.length)]
}

exports.ErrorBaileys_408 = () => {
response = ["A sessão sofreu um timeout, recarregando...", "O tempo de resposta esgotou, recarregando...", "Recarregando a sessão por conta de um timeout..."]
return response[Math.floor(Math.random() * response.length)]
}

exports.ErrorBaileys_411 = () => {
response = ["A sessão salva não bate com a conexão salva, reiniciando sua sessão...", "O arquivo de sessão parece incorreto, estou tentando recarregar...", "Falha ao conectar, pois a sessão parece incorreta, recarregando..."]
return response[Math.floor(Math.random() * response.length)]
}

exports.ErrorBaileys_428 = () => {
response = ["A conexão fechou, sua internet pode ter caído? Tentando reconectar...", "Não foi possível manter a conexão com o WhatsApp, tentando de novo...", "Sua conexão com o WhatsApp parece ter caído, reconectando..."]
return response[Math.floor(Math.random() * response.length)]
}

exports.ErrorBaileys_440 = () => {
response = ["Outra sessão do WhatsApp Web foi aberta no meu número, feche-a...", "Você possui outra sessão do WhatsApp no meu número? Fecha para usar...", "Existem muitas sessões do WhatsApp conectadas no meu número, feche-as..."]
return response[Math.floor(Math.random() * response.length)]
}

exports.ErrorBaileys_500 = () => {
response = ["A sessão parece mal configurada, estarei tentando reconectar...", "Uma reconexão será feita, pois a sessão foi considerada incorreta...", "A sessão parece incorreta, a conexão estará sendo reinicializada..."]
return response[Math.floor(Math.random() * response.length)]
}

exports.ErrorBaileys_515 = () => {
response = ["Estou reiniciando, pois a sessão pediu que fosse atualizada...", "O sistema pediu para reiniciar, estou fazendo isso automaticamente...", "Meu código será reinicializado para estabilizar a conexão..."]
return response[Math.floor(Math.random() * response.length)]
}

exports.open = () => {
response = ["Sessão aberta com o WhatsApp-Web com sucesso! Próximos logs abaixo:", "Conectado(a) com sucesso ao WhatsApp-Web! Próximos logs abaixo:", "Sessão carregada com sucesso senhor(a), próximos logs abaixo:", "Online, conexão estabilizada com sucesso senhor(a), próximo logs abaixo:"]
return response[Math.floor(Math.random() * response.length)]
}

exports.connecting = () => {
response = ["Inicializando ou reiniciando meu sistema, aguarde mestre...", "Só um segundinho, estou carregando as informações nescessárias.", "Inicialização do bot está em andamento! Carregando informações, aguarde...", "Já tomou um copo de água hoje? Se não vai lá! Iniciando bot...", "Oiiieee fofuxo, tudo baum? Já tô iniciando gostoso, calma aí..."]
return response[Math.floor(Math.random() * response.length)]
}

exports.blackList = (GroupMetadata_, sab2) => { 
participant = sab2.participants[0].split("@")[0]
response = [`*@${participant}* foi removido do *${GroupMetadata_.subject}* por estar na lista negra...`, `Olha quem deu as caras por aqui! *@${participant}* achava que eu não ia te ver de novo bobinho(a)? 💅🏻`, `*@${participant}* achou que ia passar despercebido? Achou errado! Bye bye... 😵‍💫`, `😨 Oh my god! *@${participant}* acaba de ser banido do grupo, por estar na lista negra.`]
return response[Math.floor(Math.random() * response.length)]
}

exports.phrasesLeft = (getName, sab2, encodeURIComponent) => {
response = ["Devemos brindar pela partida dele(a)?", "Menos um nessa indústria vital...", "Nada pra ver aqui, ele saiu por 'acidente'...", `${encodeURIComponent(getName(sab2.participants[0]))} saiu do grupo...`]
return response[Math.floor(Math.random() * response.length)]
}

exports.phrasesWelcome = (mdata_2, getName, sab2, encodeURIComponent) => {
response = [`ao grupo ${encodeURIComponent(mdata_2.subject)}`, `O ${encodeURIComponent(getName(sab2.participants[0].split('@')[0]))} acaba de cair de paraquedas aqui no grupo...`, "Leia as regras e divirta-se!", "Mais um nessa indústria vital...", "Gostaria de um chá enquanto lê as regras?", "Saudações membro novo, aqui é a gerente do estabelecimento!"]
return response[Math.floor(Math.random() * response.length)]
}

exports.wait = () => {
response = [
    'Eitaa parece quê alguém precisa de mim hehe‍!',
    'Em 365 dias úteis termino o comando kkkk meme, to enviando!'
]
return response[Math.floor(Math.random() * response.length)]
}

exports.onlyAdmins = () => {
response = [
    'Você não é um adminstrador do grupo, atualmente você é um mero integrante da baderna, então não tem a virtude de usar comandos administrativos! 🧙🏼‍♀️🌟',
    'Como ousa usar um comando que não lhe pertence o dom de usar! *Somente adminstradores do grupo tem acesso...*',
    '*Quem é você na fila do pão?* Ponha-se no seu lugar! Este comando é só para seres superiores(adms) do grupo...',
    'Você não é um dos ademiros, será que você se tornará digno de usar isso?',
    'Ih ala, um camponês querendo usar comandos da alta patente do grupo. Este comando é só para seres superiores, são os administradores do bar! 🍻🥴',
    'Quem dera eu autorizar você à usar comandos administrativos sem fazer parte da organização do barzinho. ️🍻',
    'Esse comando é restrito para somente administradores, dono de grupo, meu chefe ou moderadores, quem sabe um dia você entre em uma dessas listas.'
]
return response[Math.floor(Math.random() * response.length)]
}

exports.onlyOwner = () => {
response = [
    '💫👮🏻‍♀ Você não tem nenhum direito de usar este comando, somente meu proprietário tem o poder total de usar!',
    'Olá intruso, esta é uma área restrita! Somente pessoas autorizadas tem o poder de usar – como eu e meus chefes, ninguém é permitido por aqui! 👮🏻‍♀💫',
    'Você não faz parte da organização do bot, como quer usar uma funcionalidade além do seu poder senhor(a)? 🧐🍻'
];
return response[Math.floor(Math.random() * response.length)];
}

exports.onlyGroup = () => {
response = [
    'Foi mal amiguinho, mas somente um grupo tem direito de usar de usar este comando...',
    'Como você quer usar um comando de grupo no privado? 🧐 Se este comando é liberado o uso somente em grupos...',
   'Fui configurada para este comando ser somente executado em grupos! Por favor, não insista em usar novamente, foi avisado...',
   'Olá, tudo bem? Esta função está reservada para grupos! Se quiser usar, basta me adicionar (com a permissão do meu querido proprietário), entrar em contato com ele para descobrir sobre grupos oficiais (se houver).️'   
];
return response[Math.floor(Math.random() * response.length)];
}
    
exports.onlyVipUser = () => {
response = [
    'Quem é você? 😵‍💫💫 Você não é um usuário vip, para usar esse comando você deve ser um user vip da bot! Obtenha o vip, entrando em contato com o meu dono senhor(a).',
    '🌟 *Você não tem poderes o bastante, para usar comandos da lista vip!* Então para usar este comandos, deve-se entrar em contato com o meu proprietário e negociar seu acesso vip...',
     'Este comando é exclusivo para usuários na lista vip! Você ainda não tem poder suficiente de usar funções vip.'
]
return response[Math.floor(Math.random() * response.length)];
}

exports.onlyBotAdmin = () => {
response = [
    'Em que hora te falaram que eu posso executar comandos administrativas sem ser adminstradora do grupo? Coloque-me no posto de fiscal do grupo, pois algumas funções dependem do cargo de adm...',
    '🍻👮🏼‍♀️ Eu não trabalho na segurança do bar ainda! Para me contratar, me coloque como adminstradora do grupo e estarei fazendo meu trabalho sem interrupções.',
    'Vai com calma! Eu não sou adminstradora para executar certas funções no grupo...'
];
return response[Math.floor(Math.random() * response.length)];
}

exports.onlyGroupFun = (prefixo) => {
response = [
    `🤹🏻‍♀️ - Deseja usar os comandos de diversão em seu grupo? É nescessário a ativação do ${prefixo}modobrincadeira para ser liberado o uso de todos os comandos de interação e diversão dos participantes. (Obs: Somente seres superiores aos camponêses tem autorização de liberar).`, 
    `O modo brincadeira não está atualmente ativo no grupo, solicite a um adminstrador do grupo para realizar a ativação... 🫤 Para liberar, solicite que execute o comando: *${prefixo}modobrincadeiras 1*.`
  ];
return response[Math.floor(Math.random() * response.length)];
}

exports.onlyPrivate = () => {
response = [
    '🔐 Hello, o comando só está disponível para o uso em conversas privadas...',
    '😵‍💫🌟 Hello, o comando é somente liberado em conversas privadas! Mas tome cuidado ao me chamar no privado, meu dono(a) deve ter ativado o anti-pv.'
]
return response[Math.floor(Math.random() * response.length)];
}

exports.bannedUser = () => {
response = [
    'Você infligiu uma cláusulas do meus termos e condições de uso, por isso, você está banido de usar meus comandos por tempo indeterminado...️',
    'Você está impossibilitado de usar meus comandos, ou seja, está bloqueado por tempo indeterminado até meus superiores mudar de ideia... 😭👋🏼',
    '*Meu deus!* 😱 Você deve ter deixado meu dono com muita raiva, para ele te banir mesmo de usar meus comandos...'
]
return response[Math.floor(Math.random() * response.length)];
}

exports.forbiddenStateFromDDD = (mentionUser, whichState, extractDDD) => {
  response = [
      `⚠️ Olá @${mentionUser.split('@')[0]}, você está sendo banido(a) do grupo. Por motivo que você está com ddd proibido aqui!`, 
      `🪦 Olá @${mentionUser.split('@')[0]}, venho informar que você está sendo banido(a), por motivo que você possuí um número com o DDD de um estado proibido neste grupo.`,
      `👺 Suma daqui! Números com o DDD ${extractDDD(mentionUser.split('@')[0])} não são bem-vindos neste grupo.`,
      `😾 Ei, você e nem possuidores do DDD ${extractDDD(mentionUser.split('@')[0])} não são bem-vindos neste barzinho aqui!`
    ];
  return response[Math.floor(Math.random() * response.length)];
}

exports.errorConvertSticker = () => {
return 'Falha ao converter a mídia encaminhada, tente novamente mais tarde...';
}

exports.errorCommandLink = () => {
return 'Certifique-se ️se esse é o link correto a ser utilizado no comando.';
}

exports.playResult = (data) => {
  return `      *lıl.ılı.lıll「𝐏𝐋𝐀𝐘 𝐘𝐎𝐔𝐓𝐔𝐁𝐄」llı.ıllı.ılı*

*📄 Título:* ${data.resultado[0].title}
*👤 Canal:* ${data.resultado[0].author.name}
*🕑 Duração:* ${data.resultado[0].timestamp}
*📆 Postagem:* ${data.resultado[0].ago}
*🌐 Id do video:* ${data.resultado[0].videoId}
*📁 Formato:* Mp3
*👀 Visualizações:* ${data.resultado[0].views}
*🤖 Bot: _AKAME SUPREME_*
*🥼 Criador: _YURI MODZ_*
*🖇 Link:* ${data.resultado[0].url}`
}

exports.playButtonsResult = (data) => {
  return `*な ⃝̸̷͓᪺⃔͜Título:* ${data.resultado[0].title}\n*な ⃝̸̷͓᪺⃔͜Duração:* ${data.resultado[0].timestamp} | ${data.resultado[0].seconds} segundos.\n*な ⃝̸̷͓᪺⃔͜Postado:* ${data.resultado[0].ago}\n*な ⃝̸̷͓᪺⃔͜Canal:* ${data.resultado[0].author.name}\n*な ⃝̸̷͓᪺⃔͜Descrição:* ${data.resultado[0].description}`
}

exports.playVideo = (data) => {
  return `      *lıl.ılı.lıll「𝐏𝐋𝐀𝐘 𝐕Í𝐃𝐄𝐎」llı.ıllı.ılı*

*📄 Título:* ${data.resultado[0].title}
*👤 Canal:* ${data.resultado[0].author.name}
*🕑 Duração:* ${data.resultado[0].timestamp}
*📆 Postagem:* ${data.resultado[0].ago}
*🌐 Id do video:* ${data.resultado[0].videoId}
*📁 Formato:* Mp3
*👀 Visualizações:* ${data.resultado[0].views}
*🤖 Bot: _AKAME SUPREME_*
*🥼 Criador: _YURI MODZ_*
*🖇 Link:* ${data.resultado[0].url}`
} 

exports.playVideo2 = (data) => {
  return `      *lıl.ılı.lıll「𝐏𝐋𝐀𝐘 𝐕Í𝐃𝐄𝐎」llı.ıllı.ılı*

*📄 Título:* ${data.resultado[0].title}
*👤 Canal:* ${data.resultado[0].author.name}
*🕑 Duração:* ${data.resultado[0].timestamp}
*📆 Postagem:* ${data.resultado[0].ago}
*🌐 Id do video:* ${data.resultado[0].videoId}
*📁 Formato:* Mp3
*👀 Visualizações:* ${data.resultado[0].views}
*🤖 Bot: _AKAME SUPREME_*
*🥼 Criador: _YURI MODZ_*
*🖇 Link:* ${data.resultado[0].url}`
} 

exports.playDocumentResult = (data) => {
  return `      *lıl.ılı.lıll「𝐏𝐋𝐀𝐘 𝐃𝐎𝐂𝐔𝐌𝐄𝐍𝐓𝐎」llı.ıllı.ılı*

*📄 Título:* ${data.resultado[0].title}
*👤 Canal:* ${data.resultado[0].author.name}
*🕑 Duração:* ${data.resultado[0].timestamp}
*📆 Postagem:* ${data.resultado[0].ago}
*🌐 Id do video:* ${data.resultado[0].videoId}
*📁 Formato:* Mp3
*👀 Visualizações:* ${data.resultado[0].views}
*🤖 Bot: _AKAME SUPREME_*
*🥼 Criador: _YURI MODZ_*
*🖇 Link:* ${data.resultado[0].url}`
}

exports.shz = (data) => {
  return `• Música: *${data.resultado[0].title}*\n• *Descrição:* ${data.resultado[0].description}\n• Duração: *${data.resultado[0].timestamp} - ${data.resultado[0].seconds}*\n• Link: *${data.resultado[0].url}*`
}

exports.playmixResult = (data) => {
return `*💫| Play Mix - Enviando 5 resultados de acordo com a sua pesquisa..:*\n–\n*1°* ${data.resultado[0].title}\n• *Duração:* ${data.resultado[0].timestamp} | ${data.resultado[0].seconds} segundos.\n–\n*2°* ${data.resultado[1].title}\n• *Duração:* ${data.resultado[1].timestamp} | ${data.resultado[1].seconds} segundos.\n–\n*3°* ${data.resultado[2].title}\n• *Duração:* ${data.resultado[2].timestamp} | ${data.resultado[2].seconds} segundos.\n–\n*4°* ${data.resultado[3].title}\n• *Duração:* ${data.resultado[3].timestamp} | ${data.resultado[3].seconds} segundos.\n–\n*5°* ${data.resultado[4].title}\n• *Duração:* ${data.resultado[4].timestamp} | ${data.resultado[4].seconds} segundos.`
}

exports.syntaxDownloadMusic = () => {
return `Por favor, insira o título de uma música ou vídeo.`
}

exports.syntaxPlayMix = () => {
return `Por favor, coloque um nome de um artista para obter sucesso ao resultado.`
}

exports.InstaStalker = (data, formatNumber, formatNumberDecimal) => {
return `> 𝐈𝐧𝐬𝐭𝐚𝐠𝐫𝐚𝐦 - 𝐒𝐭𝐚𝐥𝐤𝐞𝐫\n—\n• Nome: ${data.resultado.profileName|| "Usuário do Instagram"} *(@${data.resultado.username})*\n• Conta Privada? *${data.resultado.accountPrivate === true ? "Sim" : data.resultado.accountPrivate === false ? "Não" : "Não"}*\n• Conta Verificada? *${data.resultado.accountVerified === true ? "Sim" : data.resultado.accountVerified === false ? "Não" : "Não"}*\n• URL Externo: *${data.resultado.externalUrl}*\n• Postagens (Fotos & Vídeos): *${formatNumberDecimal(data.resultado.mediaCount)}*\n• Total de Seguidores: *${formatNumberDecimal(data.resultado.followersAmount)}*\n• Total de Seguidos: *${formatNumberDecimal(data.resultado.followingAmount)}*\n–\n• Biografia:\n\`\`\`${data.resultado.biography || "❌️ Sem biografia!"}\`\`\``;
}

exports.TiktokStalker = (data, formatNumberDecimal) => { 
return `> 𝐓𝐢𝐤𝐭𝐨𝐤 - 𝐒𝐭𝐚𝐥𝐤𝐞𝐫\n—\n• Nome: *${data.resultado.users.nickname}* | @${data.resultado.users.username}\n• URL: *https://tiktok.com/@${data.resultado.users.username}*\n• Conta Verificada: *${data.resultado.users.verified === true ? "Sim" : data.resultado.users.verified === false ? "Não" : "Não"}*\n• Conta Privada: *${data.resultado.users.privateAccount === true ? "Sim" : data.resultado.users.privateAccount === false ? "Não" : "Não️"}*\n• Conta Comercial: *${data.resultado.users.commerceUser === true ? "Sim" : data.resultado.users.commerceUser === false ? "Não️" : "Não️"}*\n• Região: *${data.resultado.users.region}*\n—\n• Estatísticas:\n\t• Seguidores: *${formatNumberDecimal(data.resultado.stats.followerCount)}*\n\t• Seguindo: *${data.resultado.stats.followingCount}*\n\t• Curtidas: *${formatNumberDecimal(data.resultado.stats.heartCount)}*\n\t• Vídeos Publicados: *${formatNumberDecimal(data.resultado.stats.videoCount)}*\n\t• Vídeos Curtidos: *${formatNumberDecimal(data.resultado.stats.likeCount)}*\n—\n• Biografia: \n\`\`\`${data.resultado.users.signature.replaceAll(`\n\n`, `\n`)}\`\`\``
}

exports.tiktokDownload = (data) => {
return `*Usuário:*〔 @${data.resultado.username} 〕\n–\n• *Descrição:* ${data.resultado.description}`
}

exports.soundcloud = (data, tinyUrl) => {
return `• Música: *${data.resultado.titulo}*\n• *Total de Downloads: *${data.resultado.total_downloads}*\n–\n\t• Caso o *áudio* não seja enviado, baixe através do link: ${tinyUrl.data}`
}

exports.icmsResult = (data) => {
return `📊 Estado ICMS: *${data.resultado.icms}%*\n–\n• Valor ICMS _(valor líquido/taxa)_: *R$ ${data.resultado.icmsTotal}*\n• Total BRL _(valor apresentado + valor icms, em real.)_: *R$ ${data.resultado.total}*\n• Total USD _(valor apresentado + valor icms, convertido p/dolar)_: *$ ${data.resultado.dolar}*\n–\n📌 *Observação:* O valor na remessa pode ser outro, esse cálculo é uma probabilidade de que pode ser aplicada essa taxa. Também pode variar a *alíquota* de cada estado, que é a tal coisa que está sendo encomendada.\n–\n⚠️ *Como é realizado o cálculo de um valor abaixo de R$50?*\n\tProduto × icms(seu estado) = valor_icms\n\tProduto + valor_icms = total\n–\n⚠️ *Como é realizado o cálculo de um valor acima de R$50?*\n 	 Produto + (60 + icms(seu estado)) = valor_icms\n	 Produto + valor_icms = total`
}

exports.syntaxIcms = (prefix) => {
return `*Ops!* O comando está sendo utilizado de forma errada, _por favor confira abaixo a forma correta de uso, para obter sucesso._\n–\nPara usar este comando é nescessario, usar da seguinte forma: *${prefix}icms 704|82*, _explicando sobre os valores apresentados:_\n\t• *704* ‐ O valor que você deseja saber a probabilidade da possível taxa a ser aplicada sobre o valor.\n\t• *82* - O ddd do estado onde você mora, ou o que você deseja consultar.`
}

exports.syntaxTrackParcels = (prefix) => {
return `• Coloque o código da encomenda fornecido pelo Correios, abaixo tem a *explicação e o exemplo de uso*:\n–\n⚠️ *Exemplo:* ${prefix}Rastrear [Código]\n\t• O *código de rastreamento dos Correios* serve para registrar que uma encomenda foi postada e permite localizá-la durante o processo de envio.\n\t• Ele é composto por 9 números e 4 letras, duas delas localizadas no início e duas no final da numeração, como no exemplo: *PC123456789BR*.`
}

exports.invalidCodeRastrear = () => {
return `• *Código inválido ou nenhum resultado foi retornado.* Por favor informe um código válido, _verifique se você seguiu a instrução abaixo:_\n\t• Ele é composto por 9 números e 4 letras, duas delas localizadas no início e duas no final da numeração, como no exemplo: *PC123456789BR*.`
}

exports.rastrearEncomenda = (dataResult, q) => {
return `📦 Rastreio de Encomendas:\n• N° de Rastreio: *${q}*\n• Última atualização: *${dataResult.resultado[0].datePost} (${dataResult.resultado[0].timeCount})*\n——\n📍 Histórico de Localização:\n` + dataResult.resultado.map((info, index) => `${index+1}. *${info.description}*\n• Postagem: *${info.timeCount} (${info.datePost})*`).join('\n–\n');
}

exports.lyrics = (data, II) => {
 return `• Título: *${data.resultado.name}*\n• Artista: *${data.resultado.byArtist.name}*\n• Descrição: *${data.resultado.description}*\n• URL: *${data.resultado.url}*\n• Letra (Original):\n${II}${data.resultado.lyricOriginal}${II}`
}

exports.result_APOD = (dataNaga, resultExp) => {
return `🔭 Título - ${dataNaga.nasa.title}\n\n🌐📝 Explicação - ${resultExp.result}`
}

exports.searchBooks = (getBook) => {
return `• Titulo: *${getBook.data.volumeInfo.title}*\n• Autor do Livro: *${getBook.data.volumeInfo.authors[0]}*\n• Publicado em: *${getBook.data.volumeInfo.publishedDate}*\n• *Publicado por:* ${getBook.data.volumeInfo.publisher}\n• Quantidade de Paginas: *${getBook.data.volumeInfo.pageCount}*\n–\n• Descrição: *${getBook.data.volumeInfo.description}*\n–\n👓 Ler: *${getBook.data.accessInfo.webReaderLink}*\n➕ Saiba mais: *${getBook.data.volumeInfo.canonicalVolumeLink}*`
}

exports.mediafireDownload = (ABC, encurt) => {
  return `*[ MediaFire ]* - Informações Arquivo:\n–\n★ *Nome do Arquivo:* ${ABC.resultado.nama}\n★ *Tamanho:* ${ABC.resultado.size}\n★ *Tipo de arquivo a ser enviado:* ${ABC.resultado.mime}\n–\n*Por favor, aguarde um pouco estou realizando o envio do arquivo.*\n\t★ Caso haver um atraso de *2min* pode ser o tamanho do arquivo a ser enviado.\n\t★ *Não enviou?* Realize o download pelo link: ${encurt.data}`
}

exports.horoscopo = (q, ABC) =>  {
return `Signo: ${q}\n${ABC.resultado.inform}`
}

exports.respostaChatGPT = (dataResulted) => {
return `${dataResulted.result}`
}

exports.respostaResumida = (dataResulted) => {
return `${dataResulted.result}`
}

exports.respostaRedacao = (dataResulted) => {
return `${dataResulted.result}`
}

exports.wikiResposta = (wikis) => {
return `${wikis.data.query.pages[Object.keys(wikis.data.query.pages)].extract}`
}

exports.googleImage = (data) => {
return `• Título: *${data.origin.title || "Não existe título na imagem."}*\n• URL: *${data.origin.website.url || "Sem URL."}* \n• Fonte: *${data.origin.website.name || "Sem informação."} _(${data.origin.website.domain || "Sem informação."})_*\n• Resolução: *${data.height || "0"} × ${data.width || "0"}*`
}

exports.aptoide = (getApk, sizeApk, lnDown) => {
return `• Nome: *${getApk.name}*\n• Pacote do aplicativo à ser enviado: *${getApk.package}*\n• Tamanho do arquivo à ser enviado por mim: *${sizeApk} MB*\n• Versão do aplicativo à ser enviada por mim: *${getApk.file.vername}*\n——\n• [📁] *Não baixou?* Clique no link abaixo e realize o processo:\n↳ ${lnDown.data}`
}

exports.memesImages = (teks) => { 
return `${teks.titulo} (Baixado por Akame Supremacy)`
}

exports.iFunnyVideo = (teks) => { 
return `${teks.titulo} (Baixado por Akame Supremacy)`
}

exports.translator = (bla) => {
return `Seu texto foi traduzido com sucesso: ${bla.result}`
}

exports.smartphoneInfo = (smartInfo) => {
return `• *Smartphone:* ${smartInfo.resultado.nomeCelular}\n• *Resumo:* ${smartInfo.resultado.informações}\n–\n• *Informações técnicas sobre o Smartphone:*\n\n${smartInfo.resultado.resumoExtra}`
}

exports.clima = (wttrin) => {
return `⚠️️ Sobre o clima de agora no local.\n–\n→ *Local:* ${wttrin.nearest_area.map((j, i) => j.areaName[i].value+', '+j.region[i].value+', '+j.country[i].value).flat().join(' | ')}\n→ *Temperatura atual:* ${wttrin.current_condition.map(j => j.temp_C).flat().join(' | ')} C° - [${wttrin.current_condition.map(j => j.temp_F).flat().join(' | ')} F°]\n→ *Sensação térmica:* ${wttrin.current_condition.map(j => j.FeelsLikeC).flat().join(' | ')} C° = [${wttrin.current_condition.map(j => j.FeelsLikeF).flat().join(' | ')} F°]\n→ *Umidade do Ar / Ventos:* ${wttrin.current_condition.map(j => j.humidity).flat().join(' | ')}%\n→ *Chuva em polegadas:* ${wttrin.current_condition.map(j => j.precipInches).flat().join(' | ')} Pol - [${wttrin.current_condition.map(j => j.precipMM).flat().join(' | ')} MM]\n→ *Cobertura de nuvens:* ${wttrin.current_condition.map(j => j.cloudcover).flat().join(' | ')}%\n→ *Indice de Ultra-Violeta (UV):* ${wttrin.current_condition.map(j => j.uvIndex).flat().join(' | ')}\n→ *Nivel de visibilidade:* ${wttrin.current_condition.map(j => j.visibility).flat().join(' | ')} KM - [${wttrin.current_condition.map(j => j.visibilityMiles).flat().join(' | ')} M.]\n→ *Descrição do clima:* ${wttrin.current_condition.map(j => j.weatherDesc).flat().map(j => j.value).flat().join(', ')} - [ID #${wttrin.current_condition.map(j => j.weatherCode).flat().join(' | ')}]\n→ *Direção do vento:* ${wttrin.current_condition.map(j => j.winddir16Point).flat().join(', ')} - [${wttrin.current_condition.map(j => j.winddirDegree).flat().join(', ')}°]\n→ *Velocidade dos ventos em KM:* ${wttrin.current_condition.map(j => j.windspeedKmph).flat().join(', ')} KM - [${wttrin.current_condition.map(j => j.windspeedMiles).flat().join(', ')} M.]\n→ *Pressão do ar:* ${wttrin.current_condition.map(j => j.pressure).flat().join(' | ')} hPa - [${wttrin.current_condition.map(j => j.pressureInches).flat().join(' | ')} mmHg]\n–\n️🏘 Algumas informações do local.\n–\n→ *Tipo de requisição:* ${wttrin.request.map(j => j.type).flat().join(' | ')}\n→ *Local da requisição:* ${wttrin.request.map(j => j.query).flat().join(' | ')}\n→ *Local mais aproximado:* ${wttrin.nearest_area.map(j => j.latitude).flat().join(' | ')} Lat. | ${wttrin.nearest_area.map(j => j.longitude).flat().join(' | ')} Lon.\n→ *Total de Habitantes:* ${wttrin.nearest_area.map(j => j.population).flat().join(' | ')}\n→ *Data agora no local:* ${wttrin.current_condition.map(j => j.localObsDateTime).flat().join(', ')}\n→ *Tempo de observação:* ${wttrin.current_condition.map(j => j.observation_time).flat().join(', ')}`
}

exports.movies = (movieInfo) => {
return `• Título: *${movieInfo.data.results[0].title}* (${movieInfo.data.results[0].original_title})\n• Data de Lançamento: *${movieInfo.data.results[0].release_date}*\n• Avaliações: *${movieInfo.data.results[0].vote_average} - (${movieInfo.data.results[0].vote_count} Votos)*\n• Popularidade do Filme (%): *${movieInfo.data.results[0].popularity.toFixed(1)}%*\n• Classificação adulta? *${movieInfo.data.results[0].adult ? 'Sim.' : 'Não.'}*\n• Linguagem Oficial do Filme: *${movieInfo.data.results[0].original_language}*\n–\n• [🎬] *Sinopse do Filme:*\n↳ ${movieInfo.data.results[0].overview}`
}

exports.series = (serieInfo) => {
return `• Título: *${serieInfo.data.results[0].name}* (${serieInfo.data.results[0].original_name})\n• Data de Lançamento: *${serieInfo.data.results[0].first_air_date}*\n• Avaliações: *${serieInfo.data.results[0].vote_average} - (${serieInfo.data.results[0].vote_count} Votos)*\n• Popularidade da Série (%): *${serieInfo.data.results[0].popularity.toFixed(1)}%*\n• Classificação adulta? *${serieInfo.data.results[0].adult ? 'Sim.' : 'Não.'}*\n• Linguagem Oficial da Série: *${serieInfo.data.results[0].original_language}*\n–\n• [🌟] *Sinopse da Série:*\n↳ ${serieInfo.data.results[0].overview}`
}

exports.searchIpAdress = (ip) => {
return `*📡 Localizar + Informações ${ip.data.type}*\n–\n• *Código IP:* ${ip.data.ip}\n• *Tipo de Endereço IP:* ${ip.data.type}\n• *Província:* ${ip.data.region} / ${ip.data.city}\n• *Latitude:* ${ip.data.latitude}\n• *Longitude:* ${ip.data.longitude}\n• *Provedor Wi-Fi:* ${ip.data.isp}\n*Continente:* ${ip.data.continent} - ${ip.data.continent_code}\n• *País:* ${ip.data.country} - *DDI:* ${ip.data.country_phone}\n• *Sigla:* ${ip.data.country_code} - *Capital:* ${ip.data.country_capital}\n• *Fuso Horário:* ${ip.data.timezone} ${ip.data.timezone_name} ${ip.data.timezone_gmt}\n• *Moeda do País:* ${ip.data.currency} - ${ip.data.currency_code}`
}

exports.searchCep = (res) => {
return `🏠 *Consulta CEP:*\n–\n*Número informado:* ${res.cep}\n• *Logradouro:* ${res.street}\n• *Complemento:* Não encontrado.\n• *Código do DDD:* ${res.ddd}\n• *Bairro:* ${res.neighborhood}\n• *Cidade/Estado:* ${res.city} - ${res.state}\n• *Código do IBGE:* ${res.ibge}\n• *Código do Siafi:* ${res.siafi}`
}

exports.noresult = () => {
return `Desculpe, não consegui encontrar o que você procurava utilizando essa forma, pode tentar de outra maneira?`;
}

exports.profileInformation = (pushname, sender, info, isCargo, isChVip, putar, putar2, gostosurar, gostosurar2, nivelgador, nivelgado2r, programa, status, conselho) => {
return `ຊ 𝙽𝚘𝚖𝚎: *${pushname}*\nຊ 𝙽𝚞𝚖𝚎𝚛𝚘: *https://wa.me/${sender.split("@")[0]}*\nຊ 𝙲𝚊𝚛𝚐𝚘: *${isCargo}*\nຊ 𝙿𝚘𝚜𝚜𝚞í 𝚟𝚒𝚙?: *${isChVip}*\nຊ 𝙲𝚘𝚗𝚎𝚌𝚝𝚊𝚍𝚘(𝚊) 𝚎𝚖 𝚞𝚖 𝚍𝚒𝚜𝚙𝚘𝚜𝚒𝚝𝚒𝚟𝚘: ${info.key.id.length > 21 ? '*Android*' : info.key.id.substring(0, 2) == '3A' ? '*iOS*' : '*Windows/Linux*'}\nຊ 𝙱𝚒𝚘𝚐𝚛𝚊𝚏𝚒𝚊:\n*${status}*\n–\nຊ😈 𝚂𝚎𝚞 𝚗í𝚟𝚎𝚕 𝚍𝚎 𝚙𝚛𝚘𝚜𝚝𝚒𝚝𝚞𝚒çã𝚘: *${putar}${putar2}%*\nຊ😋 𝚂𝚎𝚞 𝚗í𝚟𝚎𝚕 𝚍𝚎 𝚐𝚘𝚜𝚝𝚘𝚜𝚞𝚛𝚊: *${gostosurar}${gostosurar2}%*\nຊ🐂 𝚂𝚎𝚞 𝚗í𝚟𝚎𝚕 𝚍𝚘 𝚐𝚊𝚍𝚘𝚖𝚎𝚝𝚛𝚘: *${nivelgador}${nivelgado2r}%*\nຊ🍼 𝚅𝚊𝚕𝚘𝚛 𝚍𝚘 𝚜𝚎𝚞 𝚙𝚛𝚘𝚐𝚛𝚊𝚖𝚊: *R$${programa}*\n–\n〘 𝙲𝙾𝙽𝚂𝙴𝙻𝙷𝙾 〙\n–\n• ${conselho}`
}

exports.warningAdvertencia = (menc_os2, dfqn) => {
return `Olá @${menc_os2.split("@")[0]} - Você foi advertido ${dfqn}/3, tome cuidado com 3 advertências, você será removido...`
}

exports.finishAdvertencia = (menc_os2) => {
return `Adeus usuário: @${menc_os2.split("@")[0]} - Você completou 3 advertências, fale com a administração do grupo para ter noção do que foi ocorrido.`
}

exports.syntaxAnonymousMail = (prefix) => {
return `*Para usar o correio elegante ou não*, pode ser uma indireta também.. 😬\n–\nVocê deve primeiramente copiar o número do seu crush ou inimigo(a), após isso, pense em uma mensagem.\n   • Exemplo: *${prefix}correio [número/msg]*\n   • Exemplo sendo usado em prática: *${prefix}correio +5565.../eu te amo*`
}

exports.anonymousMail = (txt2) => {
return `📪 Você recebeu uma mensagem do maior correio anônimo do Brasil.\n–\n▶️ Quem te enviou? *Desconhecido*\n–\n`+"```"+txt2+"```"
}

exports.sucessAnonymousMail = () => {
return `✅ O correio foi enviado para o remetente com sucesso.\n–\n• *Obs:* Ele(a) pode descobrir quem enviou. _Não me responsabilizo se você enviou mensagens desencorajadas._`
}

exports.unbannedMessage = (blcp) => {
return `@${blcp.split('@')[0]} foi desbanido e poderá novamente usar os comandos do bot.`
}

exports.bannedMessage = (blcp) => {
return `@${blcp.split('@')[0]} foi banido e não poderá mais usar os comandos do bot.`
}

exports.ownersList = (NomeDoBot, numerodono_ofc, numero_dono1, numero_dono2, numero_dono3, numero_dono4, numero_dono5, numero_dono6) => {
return `Olá, aqui está a lista de proprietários do bot: ${NomeDoBot}\n–\n*Dono Oficial:* wa.me/${numerodono_ofc}\n–\nDono [ 1 ] - wa.me/${numero_dono1}\nDono [ 2 ] - wa.me/${numero_dono2}\nDono [ 3 ] - wa.me/${numero_dono3}\nDono [ 4 ] - wa.me/${numero_dono4}\nDono [ 5 ] - wa.me/${numero_dono5}\nDono [ 6 ] - wa.me/${numero_dono6}`
}

exports.statusBot = (isAnticall, isAntiImg, isAntiVid, isAntiAudio, isAntiSticker, isAntiDDD, Antidoc, isAntiCtt, Antiloc, isAntilinkgp, isAntiLinkHard, isAntiLinkEasy, isAntifake, isAntiNotas, isAnticatalogo, isPalavrao, isAntiFlood, isWelkom, isWelkom2, isSimi, isSimi2, isAutofigu, isAutorepo, isModobn, isModoAluguel, isLevelingOn) => {
return `Status de funcionalidades ativaveis para proteger o grupo / se divertir com seus participantes.\nAs funcionalidades como *Anti Privado - Anti Ligação - Modo Aluguel*, são ativações que somente o dono, pode executar, _então caso esteja ativa você não poderá executar comandos no privado ou fazer ligações ao número do bot._\n–\n➱ Anti Ligação: ${isAnticall ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti PV Block: ${isAntiPv ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti PV (2) - Sem bloqueio de usuário(s): ${isAntiPv2 ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti PV (3) - Não responde ninguém no privado: ${isAntiPv3 ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti Imagem: ${isAntiImg ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti Vídeo: ${isAntiVid ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti Áudio: ${isAntiAudio? '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti Sticker: ${isAntiSticker ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti Documento: ${Antidoc ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti Contato ${isAntiCtt ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti Localização: ${Antiloc ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti Link Grupo: ${isAntilinkgp ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti Link Hard: ${isAntiLinkHard ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti Link Easy: ${isAntiLinkEasy ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti Fake: ${isAntifake ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti Notas: ${isAntiNotas ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti Catalogo: ${isAnticatalogo ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti Palavrão: ${isPalavrao ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Limite Caracteres: ${isAntiFlood ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Bem Vindo 1: ${isWelkom ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Bem Vindo 2: ${isWelkom2 ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Simi 1: ${isSimi ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Simi 2: ${isSimi2 ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Auto Sticker: ${isAutofigu ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Auto Resposta: ${isAutorepo ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Modo Brincadeira: ${isModobn ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Modo Aluguel: ${isModoAluguel ?  '✓ - Função ativa.' : '✕ - Não ativado.'}\n➱ Level: ${isLevelingOn ?  '✓ - Função ativa.' : '✕ - Desativado.'}\n➱ Anti DDD: ${isAntiDDD ?  '✓ - Função ativa.' : '✕ - Desativado.'}`
}

exports.errorUploadImage = () => {
return `Ocorreu algum erro, desculpa! O limite do tamanho de vídeo que gero o link, é até 30 segundos.`
}

exports.noArgsSearch = () => {
return `Como deseja realizar uma pesquisa sem conter nenhum argumento? `
}

exports.syntaxLogos = () => {
return `Cadê o texto? Para eu criar uma logo preciso que você coloque um texto atribuído ao comando..`
}

exports.playmixError = (n) => {
return `Desculpe, ocorreu um erro ao enviar o resultado do ${n}° áudio..`
}

exports.quoteCurrencies = (response) => {
return `*[COTAÇÃO]* - Os dados informados são atualizados 24h por dia: 🗣💰\n–\n• Moeda: *${response.name}*\n• Valor da moeda mais alto em 24 horas: *R$ ${Number(reponse.high).toFixed(2)}*\n• Valor da moeda mais baixo em 24 horas: *R$ ${Number(repose.low).toFixed(2)}*\n• Valor da moeda atualizado agora no momento: *R$ ${Number(resposta.bid).toFixed(2)}*`
}

exports.syntaxWebSticker = (prefix) => {
    return `🤖 *Como usar o comando 'figuweb'?*\n• *Função:* Criar uma figurinha com texto personalizado e fundo colorido.\n——\n• *Sintaxe do Comando:*\n\t- ${prefix}figuweb [texto]/[número da cor]\n• *Escolhendo a Cor de Fundo:*\n\t- Você pode escolher entre 4 cores diferentes para o fundo da sua figurinha. Basta adicionar o número correspondente à cor desejada após o texto, separado por uma barra (/).\n—\n• *Numerações das cores dos fundos da figurinha de texto:*\n\t- 1. Preto (Padrão), 2. Branco, 3. Vermelho, 4. Azul\n—\n• *Exemplos de usos:*\n \t- ${prefix}figuweb Olá, como vai?/1 (Fundo na cor Preto)\n\t- ${prefix}figuweb Bom dia!/2 (Fundo na cor Branco)\n\t- ${prefix}figuweb Boa tarde!/3 (Fundo na cor Vermelho)\n\t- ${prefix}figuweb Boa noite!/4 (Fundo na cor Azul)\n—\n• Se você não especificar uma cor, o fundo padrão (Preto) será usado.`
}

exports.groupInvitation = (sender, cnvt, prefix) => {
return `*[SOLICITAÇÃO]* - Foi enviado um convite para o bot entrar em um grupo.\n–\n⚙️ *Informações:*\n      • Número: *wa.me/${sender.split("@")[0]}*\n      • Link: *${cnvt}*\n–\n📑 *Como aceitar ou recusar o pedido?*\n      • Para aceitar o pedido é nescessario você usar o comando: ${prefix}entrar e o link do grupo do(a) solicitante.\n          Ex: *${prefix}entrar ${cnvt}*\n      • *Recusar o pedido é fácil!* Mas lembrando ele só serve para notificar o usuário que o pedido foi recusado.\n          Ex: *${prefix}recusar ${sender.split("@")[0]}*`
}

exports.thinkingPrefix = (pushname, prefix) => {
return `Olá ${pushname}, aqui está meu prefixo para uso dos meus comandos: ${prefix}`
}

exports.chamandoBot = (pushname, tempo) => {
const response = [
 `Olá ${pushname}, em que posso ajudar?`, 
 `Olá meu amiguinho(a), tudo bem?`,
 `${tempo} ${pushname}, em que posso ajudar você?`,
 `Por qual motivo você me chamas? 🤔💭`
] 
buffer = response[Math.floor(Math.random() * response.length)]
return buffer 
}

exports.removeUserAntiPlvr = () => {
return `*「 REMOVIDO(A) POR UTILIZAR UMA PALAVRA PROIBIDA 」*\nVocê será banido do grupo, na proxima veja as regras ao digitar qualquer palavra!`
}

exports.permissionDenied_rUser = () => {
return `Infelizmente, não sou um administrador, entt não posso te banir!`
}

exports.antisRandomMessage = () => {
return `Uma dessas opções estão ativada, mas por você ser adm, não será removido(a) _(ANTI CONTATO - ANTI CATALOGO - ANTI LOCALIZAÇÃO)_`
}

exports.charactersAnti = () => {
return `Muitos caracteres enviados, isto é contra as normas do grupo, por precaução, eu irei remover.`
}

exports.markingAllMember = () => {
return `*O participante foi removido do grupo* - Motivo: Membro comum com mensagem de marcação de todos do grupo, por conta disso irei remover do grupo, qualquer coisa entre em contato com um administrador...`
}

exports.absenceRecordOwner = (NickDono, tabelin) => {
return `Olá, o meu proprietário "${NickDono}" se encontra ausente no momento.\n↺Desde do Horário: ${tabelin.Ausente_Desde}\n–\n☇ Mensagem de Ausência: ${tabelin.Motivo_Da_Ausência}`
}

exports.absenceRecordAdmin = (blak) => {
return `*Registro de Ausência* - O adminstrador "@${blak.id.split("@")[0]}" se encontra *ausente* nesse momento.\n–\n☇ Mensagem: ${blak.msg}`
}

exports.floodCommands = () => {
return `Espere *5s* para usar outro comando ou executar o mesmo...`
}

exports.timeRequired = () => {
return `Não é possível realizar download de áudios ou vídeos acima de *20 minutos*.`
}

exports.error = () => {
return `Desculpe, ocorreu um erro. Por favor, tente novamente mais tarde.`
}

exports.messageProhibitedDetAdmin = () => {
return `Mensagem proibida detectada, porém é admin logo a punição será anulada.`
}

exports.messageProhibitedDetUser = () => {
return `Mensagem proibida detectada, banindo o infrator...`
}

exports.antiCalls = () => {
return `Olá amigo, o anti ligar está ativo no momento, ou seja, estou recebendo as ordens de bloquear aqueles que efetuarem ligações para mim.`
}

exports.helpGroupSettings = (prefix, sender) => {
return `🤠 Olá administrador(a) *@${sender.split("@")[0]}*! Tudo bem?\n- Seja bem vindo(a), ao menu de ajuda do comando *'grupo'*:\n–\n1. _${prefix}grupo_ *-open* _→_ Permite o envio das mensagens por todos os participantes do grupo.\n\n2. _${prefix}grupo_ *-close* _→_ Permite o envio de mensagens apenas somente para administradores do grupo.\n\n3. _${prefix}grupo_ *-livre* _→_ Permite a todos os integrantes que editem os dados.\n\n4. _${prefix}grupo_ *-private* _→_ Só irá permitir que as alterações nos dados do grupo, sejam alteradas somente por administradores do mesmo.`
}

exports.helpPhotoPrivacy = (prefix, sender) => {
return `🤪 Olá proprietário(a) *@${sender.split("@")[0]}*! Tudo bem?\n- Seja bem vindo(a), ao menu de ajuda do comando *'wprivacyph'*:\n–\n1. _${prefix}wprivacyph_ *-cntt* _→_ Permite somente que os contatos salvos no dispositivo, vejam a foto de perfil.\n\n2. _${prefix}wprivacyph_ *-all* _→_ Permite que todos vejam a foto de perfil do bot.\n\n3. _${prefix}wprivacyph_ *-noall* _→_ Ninguém irá ver a foto de perfil colocada no bot, ou seja, até o proprietário está restrito(oculto) de ver.\n–\n📍 *Função:* O comando tem a função de alterar a privacidade da foto de perfil, ou seja, você tem como alterar diretamente do bot, sem a precisão abrir o numero do bot e mexer nas configurações.`
}

exports.helpGroupPrivacy = (prefix, sender) => {
return `🤪 Olá proprietário(a) *@${sender.split("@")[0]}*! Tudo bem?\n- Seja bem vindo(a), ao menu de ajuda do comando *'wprivacygp'*:\n–\n1. _${prefix}wprivacygp_ *-cntt* _→_ Permite somente que os contatos salvos no dispositivo, adicionem em grupo.\n\n2. _${prefix}wprivacygp_ *-all* _→_ Permite que todos os contatos adicionem no grupo, sem nenhuma interferência.\n\n3. _${prefix}wprivacygp_ *-noall* _→_ Ninguém conseguirá adicionar o bot em grupos, até o(a) dono(a) está restrito.\n–\n📍 *Função:* O comando tem a função de alterar a privacidade de todos os usuários adicionar o contato da bot em grupos, ou seja, você tem como alterar diretamente do bot, sem a precisão abrir o numero do bot e mexer nas configurações do número.`
}

exports.errorResponseSimi = () => {
response = ["Eu não entendo tudo senhor(a), sou uma simples simi! Me explique...", "Eu sei, eu sei! 👀 Não querendo abusar, o que é isso? Me ensina...", "Não me xinga amor! 😭 Eu ainda tenho muito à aprender...", "*An, oxe?* 🤷🏻‍♀ O que é isso? Poderia me explicar por favor humano(a)?", "Eu sou um(a) bot! 🤖 Mas eu não sei de tudo não! Me explica por favor?"];
return response[Math.floor(Math.random() * response.length)]
}

exports.GshowGE = (dataResult) => {
return dataResult.resultado.map((info, index) => `${index+1}. *${info.titulo || 'Manchete sem título.'}* - (${info.horarioPostagem || 'Há X horas.'})\n• ${info.trechoManchete || 'Manchete sem descrição.'}`).join('\n–\n');
}

exports.helpNoticesG = (sender, prefix) => {
return `😸 Olá @${sender.split('@')[0]}, seja bem-vindo ao menu de ajuda e tutoriais do comando: *'gamenews'* | *'gamesnews'*\n–\n# O comando possuí 11 argumentações de uso, cada uma tem um filtro de notícia. Lembrando, este comando é somente para notícias de jogos online! Para ver notícias de Time, use: _${prefix}esportenews_.\n–\n*01.* Call of Duty: ${prefix}gamenews -cod\n*02.* Counter-Strike: ${prefix}gamenews -csgo\n*03.* FIFA 2024: ${prefix}gamenews -fifa\n*04.* Fortnite: ${prefix}gamenews -fortnite\n*05.* GameXP: ${prefix}gamenews -gamexp\n*06.* PES 2024: ${prefix}gamenews -pes\n*07.* League of Legends: ${prefix}gamenews -lol\n*08.* Pokemon: ${prefix}gamenews -pokemon\n*09.* Rainbow 6: ${prefix}gamenews -r6\n*10.* Valorant: ${prefix}gamenews -valorant\n*11.* Pokemon TCG: ${prefix}gamenews -tcg`
}

exports.helpNoticesEsporte = (sender, prefix) => {
return `🌟 Olá @${sender.split('@')[0]}, seja bem-vindo ao menu de ajuda e tutoriais do comando: *'esporte_noticias'* | *'esportenews'*\n–\n# O comando possuí 18 argumentações de uso, cada uma tem um filtro de notícia. Lembrando, este comando é somente para notícias de esportes! Para ver notícias de jogos online, use: _${prefix}gamenews_.\n–\n*01.* Todas as categorias agrupadas à um só parâmetro: ${prefix}esportenews -all\n*02.* Futebol: ${prefix}esportenews -futebol\n*03.* Futsal: ${prefix}esportenews -futsal\n*04.* Skate: ${prefix}esportenews -skate\n*05.* Surfe: ${prefix}esportenews -surf\n*06.* Basquete: ${prefix}esportenews -basquete\n*07.* Vôlei: ${prefix}esportenews -volei\n*08.* Tênis: ${prefix}esportenews -tenis\n*09.* Atletismo: ${prefix}esportenews -atletismo\n*10.* Natação: ${prefix}esportenews -natacao\n*11.* Ciclismo: ${prefix}esportenews -ciclismo\n*12.* Boxe: ${prefix}esportenews -boxe\n*13.* Beisebol: ${prefix}esportenews -beisebol\n*14.* Futebol EUA: ${prefix}esportenews -futebol-eua\n*15.* Judô: ${prefix}esportenews -judo\n*16.* Ginástica: ${prefix}esportenews -ginastica\n*17.* Golfe: ${prefix}esportenews -golfe\n*18.* Fórmula 1: ${prefix}esportenews -f1`
}



fs.watchFile(require.resolve(__filename), () => {
fs.unwatchFile(require.resolve(__filename));
console.log(colors.blue(`Alterações salvas - ${__filename}`));
delete require.cache[require.resolve(__filename)]
require(require.resolve(__filename))
})