#!/bin/bash
# ============================================================
#  🖤 𝒀𝑨𝑲𝑨𝑴𝒀 — INSTALAÇÃO PARA VPS (Ubuntu/Debian)
#  ------------------------------------------------------------
#  👑 Dono & Criador: DARK DYABYNHO
#  💬 Telegram: @CORVO291
#  🤖 Bot Telegram: t.me/corvo_div_bot
#  📦 Repositório: github.com/mg5860606-ux/YAKAMY-CORVO-VIP
#  ------------------------------------------------------------
#  O que este script faz (NA ORDEM CERTA):
#   1) Instala Node.js 20+ (NodeSource — o apt do Ubuntu vem com 18,
#      e o Baileys 6.x exige >= 20);
#   2) Instala ffmpeg, libwebp, imagemagick, build tools E TODAS as libs
#      do canvas (libcairo2-dev, libpango, libjpeg, libgif, librsvg) —
#      essenciais pro npm install do sharp/canvas não falhar;
#   3) Clona o projeto (ou usa a pasta atual se já estiver nela);
#   4) Roda npm install e VERIFICA se o canvas carrega (require('canvas'));
#   5) Instala o PM2 (process manager 24/7 com auto-restart);
#   6) Sobe o bot e mostra como parear via SSH.
#  ------------------------------------------------------------
#  USO:
#    bash instalar_vps.sh            → instala tudo e inicia
#    bash instalar_vps.sh --sessao   → SÓ cria/transfere sessão (não reinstala)
# ============================================================

GREEN='\033[1;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[1;36m'
RED='\033[1;31m'
WHITE='\033[1;37m'
RESET='\033[0m'

print_msg() {
  local color=$1
  shift
  echo -e "${color}$*${RESET}"
}

painel() {
  clear
  echo -e "${CYAN}"
  echo "╔═══════════════════════════════════════════════════╗"
  echo "║   🌫️ INSTALAÇÃO VPS — 𝒀𝑨𝑲𝑨𝑴𝒀  🌫️                  ║"
  echo "║      Bot 24/7 com PM2 (Ubuntu/Debian)             ║"
  echo "╚═══════════════════════════════════════════════════╝"
  echo -e "${RESET}"
}

# ------------------------------------------------------------
# 1) Node.js 20+ via NodeSource
# ------------------------------------------------------------
instalar_node() {
  print_msg "$CYAN" "🔧 Passo 1/5 — Instalando Node.js 20+..."
  if command -v node >/dev/null 2>&1; then
    VER=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
    if [ "$VER" -ge 20 ] 2>/dev/null; then
      print_msg "$GREEN" "   ✅ Node já instalado: $(node -v)"
      return
    fi
    print_msg "$YELLOW" "   ⚠️ Node $(node -v) é muito antigo (Baileys exige >= 20). Atualizando..."
  fi
  apt-get update -y
  apt-get install -y curl ca-certificates gnupg
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  print_msg "$GREEN" "   ✅ Node instalado: $(node -v)"
}

# ------------------------------------------------------------
# 2) Dependências do sistema (inclui TODAS as libs de build do canvas)
# ------------------------------------------------------------
instalar_dependencias() {
  print_msg "$CYAN" "🔧 Passo 2/5 — Instalando ffmpeg, libwebp, imagemagick e build tools..."
  apt-get update -y # 🐛 FIX: garante índice atualizado mesmo se o Node já era >= 20

  # Bloco 1 — ESSENCIAL (obrigatório): se falhar, a instalação para.
  if ! apt-get install -y \
    ffmpeg libwebp-dev imagemagick git build-essential python3 make g++ pkg-config; then
    print_msg "$RED" "   ❌ Pacotes essenciais falharam. Corrija e rode de novo."
    exit 1
  fi

  # 🎨 Bloco 2 — DEPENDÊNCIAS DO CANVAS (tolerante a falha): o cardGenerator.js
  # usa require('canvas') — sem essas libs o build do canvas falha e os CARDS DE
  # LEVEL quebram no VPS. Separado do bloco 1 pra uma lib faltando em alguma
  # versão do Ubuntu não derrubar a instalação inteira.
  if ! apt-get install -y \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libpixman-1-dev; then
    print_msg "$YELLOW" "   ⚠️ Libs de build do canvas não instalaram — os cards de LEVEL podem falhar."
    print_msg "$YELLOW" "      Tente depois: sudo apt-get install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev"
  else
    print_msg "$GREEN" "   ✅ Dependências do canvas instaladas."
  fi
  print_msg "$GREEN" "   ✅ Dependências do sistema instaladas."
}

# ------------------------------------------------------------
# 3) Clona o projeto (ou usa a pasta atual)
# ------------------------------------------------------------
obter_projeto() {
  print_msg "$CYAN" "🔧 Passo 3/5 — Obtendo o projeto..."
  if [ -f "connect.js" ]; then
    print_msg "$GREEN" "   ✅ Já estou dentro da pasta do projeto."
    return
  fi
  if [ -d "YAKAMY-CORVO-VIP" ]; then
    cd YAKAMY-CORVO-VIP || exit 1
    print_msg "$GREEN" "   ✅ Pasta YAKAMY-CORVO-VIP encontrada."
    return
  fi
  print_msg "$YELLOW" "   📥 Clonando repositório..."
  git clone https://github.com/mg5860606-ux/YAKAMY-CORVO-VIP.git
  cd YAKAMY-CORVO-VIP || exit 1
  print_msg "$GREEN" "   ✅ Projeto clonado."
}

# ------------------------------------------------------------
# 4) npm install — garante o canvas COMPILADO de verdade
# ------------------------------------------------------------
instalar_modulos() {
  print_msg "$CYAN" "🔧 Passo 4/5 — Instalando módulos (npm install)..."
  print_msg "$YELLOW" "   ⏳ Pode demorar alguns minutos..."
  npm install --no-audit --no-fund
  if [ $? -ne 0 ]; then
    print_msg "$RED" "   ❌ npm install falhou."
    print_msg "$YELLOW" "   Tentando recompilar o canvas do zero (build from source)..."
    # 🐛 FIX: --no-save evita adicionar canvas ao package.json sem querer
    npm install canvas --build-from-source --no-save --no-audit --no-fund
    npm install --no-audit --no-fund
    if [ $? -ne 0 ]; then
      print_msg "$RED" "   ❌ Falhou de novo. Instale manualmente: npm install"
      return 1
    fi
  fi

  # 🐛 FIX 2026-08-13: verificação REAL — garante que o require('canvas')
  # funciona (sem isso o cardGenerator.js quebra no VPS). Se quebrar, tenta
  # recompilar do zero. Só desabilita como último recurso, avisando.
  print_msg "$YELLOW" "   🔍 Verificando se o canvas carrega..."
  if ! node -e "require('canvas'); console.log('canvas OK')" >/dev/null 2>&1; then
    print_msg "$YELLOW" "   ⚠️ canvas não carrega — recompilando do zero..."
    npm install canvas --build-from-source --no-save --no-audit --no-fund
    if ! node -e "require('canvas'); console.log('canvas OK')" >/dev/null 2>&1; then
      print_msg "$YELLOW" "   ⚠️ canvas ainda não carrega. Desabilitando como último recurso..."
      if [ -d "node_modules/canvas" ]; then
        mv node_modules/canvas node_modules/canvas_bak
      fi
      print_msg "$YELLOW" "   ⚠️ canvas desabilitado — os cards de LEVEL vão falhar. Reinstale depois:"
      print_msg "$WHITE" "      sudo apt-get install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev"
      print_msg "$WHITE" "      npm install canvas --build-from-source"
    else
      print_msg "$GREEN" "   ✅ canvas recompilado com sucesso!"
    fi
  else
    print_msg "$GREEN" "   ✅ canvas funcionando."
  fi
  print_msg "$GREEN" "   ✅ Módulos instalados."
}

# ------------------------------------------------------------
# 5) PM2 — processo 24/7 com auto-restart
# ------------------------------------------------------------
instalar_pm2() {
  print_msg "$CYAN" "🔧 Passo 5/5 — Configurando PM2 (auto-restart)..."
  if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
  fi
  print_msg "$GREEN" "   ✅ PM2 instalado: $(pm2 -v 2>/dev/null)"
}

# ------------------------------------------------------------
# Cria o .env a partir do exemplo (se não existir)
# ------------------------------------------------------------
criar_env() {
  if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    print_msg "$YELLOW" "   ⚠️ .env criado a partir do .env.example —"
    print_msg "$YELLOW" "      EDITE com suas chaves: nano .env"
  fi
}

# ------------------------------------------------------------
# Sobe o bot no PM2
# ------------------------------------------------------------
iniciar_bot() {
  print_msg "$CYAN" "🚀 Iniciando o bot no PM2..."
  # 🐛 FIX: se NÃO há sessão, o PM2 em modo QR é inútil em VPS headless.
  # Pede o pareamento primeiro (foreground), e só então sobe o PM2.
  if [ ! -f "corvo_dados/qrcode/creds.json" ]; then
    print_msg "$YELLOW" "   ⚠️ Nenhuma sessão encontrada — pareando antes de subir o PM2..."
    print_msg "$WHITE" "      (digite o número com DDI, ex: 5533999999999, copie o código)"
    print_msg "$WHITE" "      Depois de parear, pressione CTRL+C para voltar ao script."
    echo ""
    node connect.js sim
    echo ""
    # 🐛 FIX 2026-08-13: checa se o pareamento REALMENTE gerou a sessão.
    # Se falhou (número errado, internet), NÃO sobe o PM2 em modo QR
    # (inútil em VPS headless) — aborta com instrução clara.
    if [ ! -f "corvo_dados/qrcode/creds.json" ]; then
      print_msg "$RED" "   ❌ Pareamento não concluído (nenhuma sessão gerada)."
      print_msg "$YELLOW" "      Rode manualmente e confira o erro:"
      print_msg "$WHITE" "         node connect.js sim"
      print_msg "$YELLOW" "      Depois que conectar, suba com:"
      print_msg "$WHITE" "         pm2 start connect.js --name corvo && pm2 save"
      return 1
    fi
    print_msg "$GREEN" "   ✅ Pareamento concluído. Subindo no PM2..."
  fi
  if pm2 describe corvo >/dev/null 2>&1; then
    pm2 restart corvo --update-env
  else
    pm2 start connect.js --name corvo
  fi
  pm2 save
  # 🐛 FIX: executa o startup de verdade (script roda como root)
  pm2 startup systemd -u root --hp "$HOME" 2>/dev/null || true
  print_msg "$GREEN" "✅ Bot rodando. Veja os logs: pm2 logs corvo"
}

# ------------------------------------------------------------
# Modo --sessao: só cria/transfere a sessão
# ------------------------------------------------------------
modo_sessao() {
  painel
  print_msg "$CYAN" "🔑 MODO SESSÃO — pareamento via SSH"
  echo ""
  print_msg "$WHITE" "No VPS NÃO tem tela pra QR Code, então você usa o código de pareamento:"
  echo ""
  print_msg "$WHITE" "   1) Rode o bot em modo pareamento:"
  print_msg "$GREEN" "      node connect.js sim"
  print_msg "$WHITE" "   2) Digite o número com DDI (ex: 5533999999999)"
  print_msg "$WHITE" "   3) Copie o código que aparecer e cole em:"
  print_msg "$GREEN" "      WhatsApp > Aparelhos conectados > Conectar via código"
  echo ""
  print_msg "$YELLOW" "   Depois de parear, CTRL+C e suba com PM2: pm2 start connect.js --name corvo"
  echo ""
  print_msg "$WHITE" "   📦 Já tem sessão no PC/Termux? Suba a pasta corvo_dados/qrcode"
  print_msg "$WHITE" "      do seu PC pro VPS (scp/rsync) — mas NÃO rode o bot em 2"
  print_msg "$WHITE" "      lugares ao mesmo tempo, senão o WhatsApp derruba (Connection Closed)."
}

# ============================================================
# EXECUÇÃO
# ============================================================
if [ "$1" = "--sessao" ]; then
  modo_sessao
  exit 0
fi

painel

# Fail-fast: precisa de root/sudo pra apt
if [ "$(id -u)" -ne 0 ]; then
  print_msg "$RED" "❌ Rode com sudo ou como root:"
  print_msg "$WHITE" "      sudo bash instalar_vps.sh"
  exit 1
fi

print_msg "$YELLOW" "⚠️  Isso vai instalar Node 20+, ffmpeg, PM2 e o bot na VPS."
read -p "👉 Continuar? [s/N]: " iniciar
case "$iniciar" in
  s|S|sim|SIM|y|Y|yes|YES) ;;
  *)
    print_msg "$RED" "🚪 Cancelado. Nada foi alterado."
    exit 0
    ;;
esac

echo ""
instalar_node
instalar_dependencias
obter_projeto
criar_env
instalar_modulos || exit 1
instalar_pm2
iniciar_bot || exit 1 # 🐛 FIX: se o pareamento falhar, não imprime "VPS CONFIGURADA!"
echo ""
print_msg "$CYAN" "╔═══════════════════════════════════════════════════╗"
print_msg "$CYAN" "║        ✅ VPS CONFIGURADA!                         ║"
print_msg "$CYAN" "╚═══════════════════════════════════════════════════╝"
echo ""
print_msg "$WHITE" "   👉 Se o bot ainda NÃO está pareado (ou perdeu a sessão):"
print_msg "$GREEN" "      pm2 delete corvo && node connect.js sim"
print_msg "$WHITE" "      (digite o número, cole o código no WhatsApp, CTRL+C)"
print_msg "$GREEN" "      pm2 start connect.js --name corvo && pm2 save"
echo ""
print_msg "$WHITE" "   👉 Comandos úteis (rode DENTRO da pasta do projeto):"
print_msg "$GREEN" "      pm2 logs corvo        # ver logs ao vivo"
print_msg "$GREEN" "      pm2 restart corvo     # reiniciar"
print_msg "$GREEN" "      pm2 stop corvo        # parar"
echo ""
print_msg "$YELLOW" "   ⚠️  IMPORTANTE:"
print_msg "$YELLOW" "   • NÃO rode o bot no PC/Termux E na VPS ao mesmo tempo —"
print_msg "$YELLOW" "     o WhatsApp derruba uma das conexões (Connection Closed)."
print_msg "$YELLOW" "   • Se aparecer 'Connection Closed (401)', apague a pasta"
print_msg "$YELLOW" "     corvo_dados/qrcode e pareie de novo."
