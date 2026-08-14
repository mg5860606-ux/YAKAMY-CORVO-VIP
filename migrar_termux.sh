#!/bin/bash
# ============================================================
#  🖤 𝒀𝑨𝑲𝑨𝑴𝒀 — MIGRAÇÃO PARA TERMUX
#  ------------------------------------------------------------
#  👑 Dono & Criador: DARK DYABYNHO
#  💬 Telegram: @CORVO291
#  🤖 Bot Telegram: t.me/corvo_div_bot
#  📦 Repositório: github.com/mg5860606-ux/YAKAMY-CORVO-VIP
#  ------------------------------------------------------------
#  O que este script faz (NA ORDEM CERTA):
#   1) Encerra QUALQUER instância do bot rodando no celular;
#   2) Apaga o corvo_dados/bot.lock (PID do Windows pode colidir
#      com um processo vivo no Android e matar coisa errada);
#   3) Remove a sessão antiga (corvo_dados/qrcode) que veio do
#      PC — sessão usada em 2 máquinas = "Connection Closed";
#   4) Instala as dependências do Termux (pkg install ...);
#   5) Roda o npm install dos módulos do bot;
#   6) Mostra como conectar do jeito certo (código ou QR).
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
  echo "║   🌫️ MIGRAÇÃO PRO TERMUX — 𝒀𝑨𝑲𝑨𝑴𝒀  🌫️            ║"
  echo "║      Limpeza de sessão + instalação correta       ║"
  echo "╚═══════════════════════════════════════════════════╝"
  echo -e "${RESET}"
}

# ------------------------------------------------------------
# 0) Garante que estamos na pasta do projeto (fail-fast)
# ------------------------------------------------------------
verificar_raiz() {
  if [ ! -f "connect.js" ]; then
    print_msg "$RED" "❌ connect.js não encontrado no diretório atual!"
    print_msg "$YELLOW" "   Rode este script DENTRO da pasta do bot:"
    print_msg "$WHITE" "      cd ~/YAKAMY-CORVO-VIP"
    print_msg "$WHITE" "      bash migrar_termux.sh"
    exit 1
  fi
  print_msg "$GREEN" "✅ Pasta do projeto detectada."
}

# ------------------------------------------------------------
# 1) Encerra o bot rodando no celular (evita conflito de sessão)
# ------------------------------------------------------------
matar_bot() {
  print_msg "$CYAN" "🔍 Procurando instâncias do bot rodando no celular..."
  if command -v pgrep >/dev/null 2>&1; then
    PIDS=$(pgrep -f "connect\.js" 2>/dev/null)
  else
    PIDS=""
    print_msg "$YELLOW" "   ⚠️ pgrep não encontrado (procps). Pulando verificação de instâncias."
  fi
  if [ -n "$PIDS" ]; then
    for pid in $PIDS; do
      print_msg "$YELLOW" "   ⚠️ Encerrando instância (PID $pid)..."
      kill -9 "$pid" 2>/dev/null
    done
    sleep 1
    print_msg "$GREEN" "✅ Bot encerrado."
  else
    print_msg "$GREEN" "✅ Nenhuma instância do bot rodando."
  fi
}

# ------------------------------------------------------------
# 2) Apaga o bot.lock (PID de outra máquina pode matar processo errado)
# ------------------------------------------------------------
limpar_lock() {
  if [ -f "corvo_dados/bot.lock" ]; then
    print_msg "$YELLOW" "🗑️  Removendo corvo_dados/bot.lock (PID antigo do PC)..."
    rm -f "corvo_dados/bot.lock"
    print_msg "$GREEN" "✅ Lock removido."
  else
    print_msg "$GREEN" "✅ Nenhum bot.lock encontrado."
  fi
}

# ------------------------------------------------------------
# 3) Remove a sessão antiga — sessão usada em 2 máquinas = Connection Closed
# ------------------------------------------------------------
limpar_sessao() {
  if [ -d "corvo_dados/qrcode" ]; then
    print_msg "$RED" "⚠️  ATENÇÃO: será removida a sessão antiga (corvo_dados/qrcode)."
    print_msg "$YELLOW" "   Você vai precisar CONECTAR O BOT DE NOVO (código ou QR)."
    read -p "👉 Deseja continuar? [s/N]: " confirmar
    case "$confirmar" in
      s|S|sim|SIM|y|Y|yes|YES)
        rm -rf "corvo_dados/qrcode"
        print_msg "$GREEN" "✅ Sessão antiga removida. Bot pronto pra conexão nova."
        ;;
      *)
        print_msg "$YELLOW" "🚫 Sessão mantida. (Se der 'Connection Closed', rode este script de novo e confirme.)"
        ;;
    esac
  else
    print_msg "$GREEN" "✅ Nenhuma sessão antiga encontrada."
  fi
}

# ------------------------------------------------------------
# 4) Instala as dependências do sistema (NA ORDEM CERTA)
# ------------------------------------------------------------
instalar_pacotes() {
  print_msg "$CYAN" "🔧 Passo 1/2 — Instalando pacotes do Termux..."
  print_msg "$WHITE" "   > pkg update -y && pkg upgrade -y"
  pkg update -y && pkg upgrade -y
  print_msg "$WHITE" "   > pkg install nodejs libwebp ffmpeg imagemagick bash git wget curl python -y"
  pkg install nodejs -y
  pkg install libwebp -y
  pkg install ffmpeg -y
  pkg install imagemagick -y
  pkg install bash -y
  pkg install git -y
  pkg install wget -y
  pkg install curl -y
  pkg install python -y
  print_msg "$GREEN" "✅ Pacotes do sistema instalados."
}

# ------------------------------------------------------------
# 5) Instala os módulos do bot
# ------------------------------------------------------------
instalar_modulos() {
  print_msg "$CYAN" "🔧 Passo 2/2 — Instalando módulos do bot (npm install)..."
  print_msg "$YELLOW" "   ⏳ Isso pode demorar alguns minutos. Não feche o Termux!"
  npm install --no-audit --no-fund
  if [ $? -eq 0 ]; then
    print_msg "$GREEN" "✅ Módulos instalados com sucesso!"
  else
    print_msg "$RED" "❌ Falha no npm install."
    print_msg "$YELLOW" "   ⚠️ Se o erro for no módulo 'sharp' (comum no Termux), instale as"
    print_msg "$YELLOW" "   ferramentas de build e recompile ele sozinho:"
    print_msg "$WHITE" "      pkg install binutils make g++ -y"
    print_msg "$WHITE" "      npm install sharp --build-from-source"
    print_msg "$WHITE" "      npm install"
  fi
}

# ------------------------------------------------------------
# 6) Instruções finais de conexão
# ------------------------------------------------------------
instrucoes_finais() {
  print_msg "$CYAN" ""
  print_msg "$CYAN" "╔═══════════════════════════════════════════════════╗"
  print_msg "$CYAN" "║        ✅ MIGRAÇÃO CONCLUÍDA!                      ║"
  print_msg "$CYAN" "╚═══════════════════════════════════════════════════╝"
  echo ""
  print_msg "$WHITE" "Agora é só conectar do jeito que preferir:"
  echo ""
  print_msg "$WHITE" "   🔗 Opção A — Conectar com NÚMERO (código de pareamento):"
  print_msg "$GREEN" "      bash start.sh termux"
  print_msg "$WHITE" "      (no menu, escolha a opção 1 e digite seu número com DDI, ex: 5533999999999)"
  echo ""
  print_msg "$WHITE" "   🔳 Opção B — Conectar via QR CODE:"
  print_msg "$GREEN" "      bash start.sh termux"
  print_msg "$WHITE" "      (no menu, escolha a opção 2 e escaneie o QR com o WhatsApp)"
  echo ""
  print_msg "$YELLOW" "   ⚠️  IMPORTANTE:"
  print_msg "$YELLOW" "   • NÃO rode o bot no PC e no celular ao mesmo tempo com a mesma sessão —"
  print_msg "$YELLOW" "     o WhatsApp derruba uma das conexões (Connection Closed)."
  print_msg "$YELLOW" "   • Se aparecer 'Connection Closed (401)', rode este script de novo para"
  print_msg "$YELLOW" "     gerar uma sessão nova."
  print_msg "$YELLOW" "   • Para o bot ficar online com a tela bloqueada, ative o wake lock:"
  print_msg "$WHITE" "      termux-wake-lock"
}

# ============================================================
# EXECUÇÃO
# ============================================================
painel

# Garante que estamos na pasta do projeto ANTES de qualquer confirmação
verificar_raiz

# Confirmação geral antes de começar
print_msg "$RED" "⚠️  Este script prepara o bot pra rodar NO CELULAR (Termux)."
print_msg "$YELLOW" "   Ele vai: matar o bot local, apagar lock e sessão, e instalar tudo."
read -p "👉 Continuar? [s/N]: " iniciar
case "$iniciar" in
  s|S|sim|SIM|y|Y|yes|YES) ;;
  *)
    print_msg "$RED" "🚪 Cancelado. Nada foi alterado."
    exit 0
    ;;
esac

echo ""
matar_bot
limpar_lock
limpar_sessao
echo ""
instalar_pacotes
instalar_modulos
echo ""
instrucoes_finais
