@echo off
chcp 65001 >nul
REM ============================================================================
REM  RESTART SEGURO - 𝒀𝑨𝑲𝑨𝑴𝒀 (Windows)
REM  ----------------------------------------------------------------------------
REM  Mata a instancia ANTIGA do bot (corvo_dados\bot.lock) e SOBE uma NOVA em seguida.
REM  Resolve: "Ja existe outra instancia do bot rodando (PID xxxx)."
REM
REM  Uso: restart.bat            -> reinicia normal
REM       restart.bat sim        -> reinicia com codigo de pareamento
REM       restart.bat --check    -> so mostra o que faria (nao mata nada)
REM       restart.bat --yes      -> pula a confirmacao quando nada e achado
REM
REM  Obs: se o bot roda como ADMINISTRADOR, rode este arquivo tambem como
REM       administrador (botao direito -> Executar como administrador).
REM ============================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "LOCK=corvo_dados\bot.lock"
set "CHECK=0"
set "FORCE=0"
for %%a in (%*) do (
  if "%%a"=="--check" set "CHECK=1"
  if "%%a"=="--yes" set "FORCE=1"
  if "%%a"=="-y" set "FORCE=1"
  if "%%a"=="--force" set "FORCE=1"
)

echo.
echo =============================================
echo    RESTART SEGURO - 𝒀𝑨𝑲𝑨𝑴𝒀
echo =============================================
echo.

REM ---------- 1) PID do lock (so se estiver vivo) ----------
set "PIDS="
if not exist "%LOCK%" goto nolock
set /p LPID=<"%LOCK%"
tasklist /FI "PID eq !LPID!" 2>nul | findstr /I "!LPID!" >nul
if errorlevel 1 goto orfao
set "PIDS=!LPID!"
echo   - Instancia antiga no lock: PID !PIDS!
goto killphase

:nolock
echo   - Nenhum lock encontrado.
goto killphase

:orfao
echo   - Lock orfao (PID !LPID! nao esta vivo) - sera limpo.
goto killphase

REM ---------- 2) kill ----------
:killphase
if not defined PIDS goto nada
if "%CHECK%"=="1" (
  echo   [CHECK] Mataria: !PIDS!
  echo   [CHECK] Lock seria limpo e o bot iniciado - nada foi feito.
  goto fim
)

echo   - Encerrando: !PIDS!
for %%p in (!PIDS!) do (
  taskkill /F /T /PID %%p >nul 2>&1
  if errorlevel 1 echo     ! Falha ao matar %%p - rode como ADMINISTRADOR
)

REM espera morrer (ate ~15s)
set /a n=0
:wait
set "VIVOS="
for %%p in (!PIDS!) do (
  tasklist /FI "PID eq %%p" 2>nul | findstr /I "%%p" >nul && set "VIVOS=1"
)
if defined VIVOS (
  set /a n+=1
  if !n! LSS 15 (
    timeout /t 1 /nobreak >nul
    goto wait
  )
  echo   ! NAO consegui matar !PIDS! - Acesso negado?
  echo     Feche o terminal antigo ou rode COMO ADMINISTRADOR:
  echo     taskkill /F /T /PID !PIDS!
  goto fim
)
echo   - Instancia antiga encerrada.
goto start

REM ---------- 3) nada encontrado -> confirma antes de subir ----------
:nada
echo   - Nenhuma instancia antiga rodando.
if "%CHECK%"=="1" (
  echo   [CHECK] Nada a matar. Lock seria limpo e o bot iniciado.
  goto fim
)
if "%FORCE%"=="1" goto start
echo.
echo   AVISO: nenhuma instancia detectada.
echo   Se o bot JA estiver online, subir outro derruba os dois.
set /p RESP=Continuar e iniciar o bot mesmo assim? (s/N):
if /i "%RESP%"=="s" goto start
if /i "%RESP%"=="sim" goto start
if /i "%RESP%"=="y" goto start
if /i "%RESP%"=="yes" goto start
echo   Cancelado.
goto fim

REM ---------- 4) inicia (filtra flags internas) ----------
:start
del /f "%LOCK%" >nul 2>&1
echo.
echo   Iniciando 𝒀𝑨𝑲𝑨𝑴𝒀...
set "ARGS="
for %%a in (%*) do (
  if not "%%a"=="--check" (
    if not "%%a"=="--yes" (
      if not "%%a"=="-y" (
        if not "%%a"=="--force" set "ARGS=!ARGS! %%a"
      )
    )
  )
)
node connect.js %ARGS%

:fim
echo.
if "%CHECK%"=="1" exit /b 0
pause
