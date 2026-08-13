#!/bin/bash

AMBIENTE="$1"

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
  echo  "${color}$*${RESET}"
}

painel_tokito() {
  clear
  echo  "${CYAN}"
  echo "╔═══════════════════════════════════════════════════╗"
  echo "║      ${CYAN}🌫️ BOT 𝒀𝑨𝑲𝑨𝑴𝒀 — © ⏤͟͟͞͞𝒀𝑨𝑲𝑨𝑴𝒀  🌫️${CYAN}           ║"
  echo "║           \"A sua bondade é a única.\"     ║"
  echo "╚═══════════════════════════════════════════════════╝"
  echo  "${RESET}"
}

instalar_dependencias() {
  print_msg "$CYAN" "🔧 Instalando dependências do Termux..."
  pkg update -y && pkg upgrade -y
  pkg install nodejs -y
  pkg install libwebp -y
  pkg install ffmpeg -y
  pkg install imagemagick -y
  pkg install bash -y
  pkg install git -y
  pkg install wget -y
  pkg install curl -y
  pkg install python -y
  print_msg "$GREEN" "✅ Instalação concluída com sucesso!"
  read -p "🔙 Pressione Enter para voltar ao menu..."
}

comprar_arquivo() {
  print_msg "$CYAN" "\n📨 Abrindo conversa no WhatsApp..."
  termux-open-url "https://wa.me/5533998659992?text=QUERO%20COMPRAR%20O%20corvo%20MD%20%20QUANTO%20CUSTA%20%3F"
  read -p "🔙 Pressione Enter para voltar ao menu..."
}

verificar_pastas() {
    print_msg "$CYAN" "📁 Verificando pastas necessárias..."
    
    pastas_necessarias=(
        "session"
        "src"
        "src/commands"
        "src/functions"
        "src/handlers"
        "src/lib"
        "database"
        "uploads"
        "temp"
    )
    
    for pasta in "${pastas_necessarias[@]}"; do
        if [ ! -d "$pasta" ]; then
            print_msg "$YELLOW" "📂 Criando pasta: $pasta"
            mkdir -p "$pasta"
        fi
    done
    
    # Verificar arquivos essenciais
    if [ ! -f "config.js" ]; then
        print_msg "$YELLOW" "⚠️ config.js não encontrado!"
    fi
    
    if [ ! -f "connect.js" ]; then
        print_msg "$RED" "❌ connect.js não encontrado! Arquivo essencial."
        exit 1
    fi
    
    print_msg "$GREEN" "✅ Verificação de pastas concluída!"
}

renomear_canvas() {
    if [ "$AMBIENTE" = "termux" ] && [ -d "node_modules/canvas" ]; then
        mv node_modules/canvas node_modules/canvas_bak
        print_msg "$YELLOW" "[CANVAS]: Renomeado para 'canvas_bak'. Executando em modo Termux (sem Canvas)."
    elif [ -d "node_modules/canvas_bak" ]; then
        mv node_modules/canvas_bak node_modules/canvas
        print_msg "$GREEN" "[CANVAS]: Restaurado para 'canvas'. Executando em modo PC (com Canvas)."
    fi
}

restaurar_canvas() {
    if [ -d "node_modules/canvas_bak" ]; then
        mv node_modules/canvas_bak node_modules/canvas
        print_msg "$GREEN" "[CANVAS]: Restauração finalizada."
    fi
}

executar_node() {
    local args="${@:1}"

    renomear_canvas

    trap restaurar_canvas EXIT
    
    IS_TERMUX="$AMBIENTE" node connect.js $args
    
    trap - EXIT
    restaurar_canvas
}

menu() {
  echo  "${CYAN}"
  echo "╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮"
  echo "${CYAN}""┃ ${CYAN}1.${RESET}${WHITE} Conectar com número (via código)${CYAN}""┃"
  echo "${CYAN}""┃ ${CYAN}2.${RESET}${WHITE} Conectar via QR Code            ${CYAN}""┃"
  echo "${CYAN}""┃ ${CYAN}3.${RESET}${WHITE} Reiniciar automático            ${CYAN}""┃"
  echo "${CYAN}""┃ ${CYAN}4.${RESET}${WHITE} Instalar dependências do Termux ${CYAN}""┃"
  echo "${CYAN}""┃ ${CYAN}5.${RESET}${WHITE} Comprar o arquivo do bot        ${CYAN}""┃"
  echo "${CYAN}""┃ ${CYAN}0.${RESET}${WHITE} Sair                            ${CYAN}""┃"
  echo "${CYAN}""╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯"
  echo  "${RESET}"
}

while true; do
  painel_tokito
  verificar_pastas
  menu
  read -p "👉 Digite o número da opção: " opcao

  case $opcao in
    1)
      print_msg "$CYAN" "🔗 Iniciando conexão com número (pareamento)..."
      executar_node sim || print_msg "$RED" "⚠️ Erro ao conectar com número."
      read -p "🔙 Pressione Enter para voltar ao menu..."
      ;;
    2)
      print_msg "$CYAN" "🔳 Iniciando conexão via QR Code..."
      executar_node || print_msg "$RED" "⚠️ Erro ao conectar via QR Code."
      read -p "🔙 Pressione Enter para voltar ao menu..."
      ;;
    3)
      print_msg "$CYAN" "🔁 Modo automático ativado. Pressione CTRL+C para parar."
      while true; do
        painel_tokito
        verificar_pastas
        print_msg "$CYAN" "🔌 Tentando reconectar 𝒀𝑨𝑲𝑨𝑴𝒀..."
        executar_node || print_msg "$RED" "⚠️ Erro na tentativa de conexão. Verifique sua sessão."
        print_msg "$GREEN" "🔄 Aguardando para tentar novamente..."
        sleep 2
      done
      ;;
    4)
      restaurar_canvas
      instalar_dependencias
      ;;
    5)
      comprar_arquivo
      ;;
    0)
      print_msg "$RED" "🚪 Saindo do modo corvo... a sua bondade...🩷"
      exit 0
      ;;
    *)
      print_msg "$RED" "❗ Opção inválida. Tente novamente."
      sleep 2
      ;;
  esac
done