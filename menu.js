/* ============================================================================
 *  🖤 𝒀𝑨𝑲𝑨𝑴𝒀 — MENU DE CONEXÃO
 *  ----------------------------------------------------------------------------
 *  Mostra o menu de conexão ANTES de iniciar o bot:
 *     1. Conectar com número (via código de pareamento)
 *     2. Conectar via QR Code
 *     0. Sair
 *  Depois da escolha, inicia o connect.js com o argumento certo:
 *     node connect.js      → modo QR Code
 *     node connect.js sim  → modo pareamento (código)
 * ============================================================================
 */

// 🐛 FIX 2026-08-14: Polyfill do globalThis.crypto para Baileys em hospedagens (VexHost/Pterodactyl/Node 18/20/21)
const _nodeCrypto = require("crypto");
if (!globalThis.crypto) {
  globalThis.crypto = _nodeCrypto.webcrypto || _nodeCrypto;
}
if (globalThis.crypto && !globalThis.crypto.subtle && _nodeCrypto.webcrypto?.subtle) {
  globalThis.crypto.subtle = _nodeCrypto.webcrypto.subtle;
}

const { spawn } = require("child_process");
const readline = require("readline");
const colors = require("colors");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

function painel() {
  console.log(colors.magenta("\n╔═══════════════════════════════════════════════════╗"));
  console.log(
    colors.cyan("║") +
      colors.rainbow("      🌫️ BOT 𝒀𝑨𝑲𝑨𝑴𝒀 — © ⏤͟͟͞͞𝒀𝑨𝑲𝑨𝑴𝒀  🌫️           ") +
      colors.cyan("║")
  );
  console.log(
    colors.cyan("║") +
      colors.brightYellow("           \"A sua bondade é a única.\"               ") +
      colors.cyan("║")
  );
  console.log(colors.magenta("╚═══════════════════════════════════════════════════╝"));
  console.log();
}

function menu() {
  console.log(colors.rainbow("╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮"));
  console.log(
    colors.green("┃ ") +
      colors.brightGreen("1") +
      colors.white(". Conectar com número (via código)") +
      colors.green("  ┃")
  );
  console.log(
    colors.cyan("┃ ") +
      colors.brightCyan("2") +
      colors.white(". Conectar via QR Code") +
      colors.cyan("              ┃")
  );
  console.log(
    colors.red("┃ ") +
      colors.brightRed("0") +
      colors.white(". Sair") +
      colors.red("                             ┃")
  );
  console.log(colors.rainbow("╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯"));
  console.log();
}

function iniciarBot(args) {
  rl.close();
  const child = spawn(
    process.execPath,
    ["connect.js", ...args],
    { stdio: "inherit", cwd: __dirname }
  );
  child.on("exit", (code, signal) => {
    if (signal) {
      // Propaga o sinal (ex: Ctrl+C). No Windows o kill por sinal pode falhar,
      // então cai no exit normal se não for possível.
      try {
        process.kill(process.pid, signal);
        return;
      } catch (e) {}
    }
    process.exit(code ?? 0);
  });
  child.on("error", (err) => {
    console.error(colors.red(`❌ Erro ao iniciar o bot: ${err.message}`));
    process.exit(1);
  });
}

async function main() {
  while (true) {
    painel();
    menu();
    const opcao = (await question(colors.brightYellow("👉 Digite o número da opção: "))).trim();

    switch (opcao) {
      case "1":
        console.log(colors.brightGreen("\n🔗 Iniciando conexão com número (pareamento)...\n"));
        iniciarBot(["sim"]);
        return;
      case "2":
        console.log(colors.brightCyan("\n🔳 Iniciando conexão via QR Code...\n"));
        iniciarBot([]);
        return;
      case "0":
        console.log(colors.red("\n🚪 Saindo do modo 𝒀𝑨𝑲𝑨𝑴𝒀... a sua bondade...🩷\n"));
        rl.close();
        process.exit(0);
        return;
      default:
        console.log(colors.red("\n❗ Opção inválida. Tente novamente.\n"));
        break;
    }
  }
}

main().catch((e) => {
  console.error(colors.red("❌ Erro no menu de conexão: " + (e && e.message ? e.message : e)));
  process.exit(1);
});
