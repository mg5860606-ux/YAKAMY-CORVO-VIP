#!/bin/bash
# ============================================================================
#  🚀 RESTART SEGURO — 𝒀𝑨𝑲𝑨𝑴𝒀
#  ---------------------------------------------------------------------------
#  Mata a instância ANTIGA do bot (via corvo_dados/bot.lock + varredura de processos
#  rodando connect.js) e SOBE uma NOVA em seguida.
#
#  Resolve o erro de boot:
#     "⚠️ Já existe outra instância do bot rodando (PID xxxx)."
#
#  Uso:
#     bash restart.sh                → reinicia normal (sessão salva / QR)
#     bash restart.sh sim            → reinicia com código de pareamento
#     bash restart.sh --check        → só mostra o que faria (não mata nada)
#     bash restart.sh --yes          → pula a confirmação quando nada é achado
#
#  ⚠️  Se o bot foi iniciado num terminal COMO ADMINISTRADOR, este script
#      também precisa rodar como administrador (senão o kill é negado).
# ============================================================================

cd "$(dirname "$0")" || exit 1

LOCK="corvo_dados/bot.lock"

GREEN='\033[1;32m'; YELLOW='\033[1;33m'; RED='\033[1;31m'; CYAN='\033[1;36m'; RESET='\033[0m'

CHECK_MODE=false
FORCE=false
for a in "$@"; do
  [ "$a" = "--check" ] && CHECK_MODE=true
  [ "$a" = "--yes" ] || [ "$a" = "-y" ] || [ "$a" = "--force" ] && FORCE=true
done

# Detecta Windows (Git Bash/MSYS/Cygwin) vs Linux/Termux
IS_WIN=false
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) IS_WIN=true ;;
esac

pid_alive() { # $1 = pid → true se vivo
  local pid="$1"
  [ -z "$pid" ] && return 1
  if [ "$IS_WIN" = true ]; then
    tasklist //FI "PID eq $pid" 2>/dev/null | grep -qi "$pid"
  else
    kill -0 "$pid" 2>/dev/null
  fi
}

kill_pid() { # $1 = pid
  if [ "$IS_WIN" = true ]; then
    taskkill //F //T //PID "$1" >/dev/null 2>&1
  else
    kill -9 "$1" 2>/dev/null
  fi
}

# ============================================================================
# 1) Descobre PIDs a matar
# ============================================================================
PIDS=""

# 1a) PID registrado no lock (fonte de verdade do próprio bot)
if [ -f "$LOCK" ]; then
  LPID=$(tr -d '[:space:]' < "$LOCK" 2>/dev/null)
  if [ -n "$LPID" ] && pid_alive "$LPID"; then
    PIDS="$LPID"
    echo -e "${YELLOW}• Instância antiga no lock: PID $LPID${RESET}"
  else
    echo -e "${YELLOW}• Lock órfão (PID $LPID não está vivo) — será limpo.${RESET}"
  fi
else
  echo -e "${YELLOW}• Nenhum lock encontrado.${RESET}"
fi

# 1b) Varredura extra: qualquer processo node rodando connect.js (lock perdido)
if [ "$IS_WIN" = true ]; then
  PS_SCAN=$(mktemp --suffix=.ps1 2>/dev/null || echo /tmp/scan_connect.ps1)
  cat > "$PS_SCAN" <<'PS'
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'connect\.js' } | Select-Object -ExpandProperty ProcessId
PS
  EXTRA=$(powershell -NoProfile -ExecutionPolicy Bypass -File "$PS_SCAN" 2>/dev/null)
  rm -f "$PS_SCAN"
else
  EXTRA=$(pgrep -f "connect\.js" 2>/dev/null)
fi
for p in $EXTRA; do
  if [ -n "$p" ] && pid_alive "$p" && ! echo " $PIDS " | grep -q " $p "; then
    PIDS="$PIDS $p"
    echo -e "${YELLOW}• Processo connect.js encontrado: PID $p${RESET}"
  fi
done

# ============================================================================
# 2) Mata (se houver)
# ============================================================================
if [ -n "$PIDS" ]; then
  if [ "$CHECK_MODE" = true ]; then
    echo -e "${CYAN}🔍 --check: mataria ${PIDS}.${RESET}"
    exit 0
  fi
  echo -e "${CYAN}🔄 Encerrando instância(s) antiga(s): $PIDS${RESET}"
  for p in $PIDS; do kill_pid "$p"; done

  # espera morrer (até ~15s)
  n=0
  while [ $n -lt 15 ]; do
    VIVOS=""
    for p in $PIDS; do pid_alive "$p" && VIVOS="$VIVOS $p"; done
    [ -z "$VIVOS" ] && break
    n=$((n + 1)); sleep 1
  done

  VIVOS=""
  for p in $PIDS; do pid_alive "$p" && VIVOS="$VIVOS $p"; done
  if [ -n "$VIVOS" ]; then
    echo -e "${RED}❌ Não consegui matar: $VIVOS (Acesso negado — processo admin?).${RESET}"
    if [ "$IS_WIN" = true ]; then
      echo -e "${RED}   Rode este script num terminal COMO ADMINISTRADOR, ou mate manualmente:${RESET}"
      for p in $VIVOS; do echo -e "${RED}      taskkill /F /T /PID $p${RESET}"; done
    else
      echo -e "${RED}   Mate manualmente: kill -9 $VIVOS${RESET}"
    fi
    exit 1
  fi
  echo -e "${GREEN}✅ Instância(s) antiga(s) encerrada(s).${RESET}"
  rm -f "$LOCK"
else
  echo -e "${GREEN}✅ Nenhuma instância antiga rodando.${RESET}"
  if [ "$CHECK_MODE" = true ]; then
    echo -e "${CYAN}🔍 --check: nada a matar, lock seria limpo e o bot iniciado.${RESET}"
    exit 0
  fi
  # ⚠️  Nada encontrado NÃO significa que o bot esteja offline (processos
  #      elevados têm CommandLine ilegível). Subir outro pode derrubar os dois.
  if [ "$FORCE" != true ]; then
    echo -e "${YELLOW}⚠️  Nenhuma instância detectada. Se o bot JÁ estiver online,${RESET}"
    echo -e "${YELLOW}   subir outro derruba os dois (sessão duplicada).${RESET}"
    read -r -p "Continuar e iniciar o bot mesmo assim? [s/N] " RESP
    case "$RESP" in s|S|sim|SIM|y|Y|yes|YES) ;; *) echo -e "${RED}Cancelado.${RESET}"; exit 1 ;; esac
  fi
  rm -f "$LOCK"
fi

# ============================================================================
# 3) Inicia o bot de verdade (filtra flags internas do script)
# ============================================================================
ARGS=()
for a in "$@"; do
  case "$a" in --check|--yes|-y|--force) ;; *) ARGS+=("$a") ;; esac
done

echo -e "${GREEN}🚀 Iniciando 𝒀𝑨𝑲𝑨𝑴𝒀...${RESET}"
exec node connect.js "${ARGS[@]}"
