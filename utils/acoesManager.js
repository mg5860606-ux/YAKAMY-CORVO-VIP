const fs = require("fs");
const path = require("path");

const acoesFilePath = path.join(__dirname, "../ARQUIVES/json/acoes.json");

function formatarNome(jid) {
  return jid.split("@")[0];
}

function carregarPontos() {
  try {
    return JSON.parse(fs.readFileSync(acoesFilePath, "utf-8"));
  } catch (err) {
    return { usuarios: {} };
  }
}

function salvarPontos(dados) {
  fs.writeFileSync(acoesFilePath, JSON.stringify(dados, null, 2));
}

function atualizarPontos(acao, remetente, alvo) {
  const pontos = carregarPontos();

  if (!pontos.usuarios[remetente]) {
    pontos.usuarios[remetente] = { [acao + "_enviados"]: 0 };
  }
  if (!pontos.usuarios[alvo]) {
    pontos.usuarios[alvo] = { [acao + "_recebidos"]: 0 };
  }

  pontos.usuarios[remetente][acao + "_enviados"] =
    (pontos.usuarios[remetente][acao + "_enviados"] || 0) + 1;
  pontos.usuarios[alvo][acao + "_recebidos"] =
    (pontos.usuarios[alvo][acao + "_recebidos"] || 0) + 1;

  salvarPontos(pontos);
  return pontos.usuarios[alvo][acao + "_recebidos"];
}


module.exports = { atualizarPontos };