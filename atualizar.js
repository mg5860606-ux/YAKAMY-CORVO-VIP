// ============================================================================
//  🖤 𝒀𝑨𝑲𝑨𝑴𝒀 — ATUALIZADOR (GITHUB)
//  ----------------------------------------------------------------------------
//  👑 Dono & Criador: DARK DYABYNHO
//  💬 Telegram: @CORVO291
//  🤖 Bot Telegram: t.me/corvo_div_bot
//  🧠 IA: Irmã do DARK (cérebro do bot)
//  💻 GitHub: github.com/mg5860606-ux
//  📦 Repositório: github.com/mg5860606-ux/YAKAMY-CORVO-VIP
// ============================================================================
//  🔄 ATUALIZAR — 𝒀𝑨𝑲𝑨𝑴𝒀
//  ---------------------------------------------------------------------------
//  Puxa a versão mais recente do repositório GitHub oficial do bot e deixa
//  tudo pronto para reiniciar com o código novo. O reinício em si é feito
//  pelo comando /atualizar no corvo.js, que roda este script e depois sobe uma
//  nova instância do bot automaticamente.
//
//  Uso:   node atualizar.js
//  Saída: progresso no stdout; termina com:
//           "ATUALIZAR_OK"              → sucesso
//           "ATUALIZAR_ERRO: <motivo>"  → falha (sessão/configs preservadas)
//
//  ⚠️  Antes do git reset --hard, faz backup dos dados locais que NÃO podem
//      ser sobrescritos pelo repositório (sessão do WhatsApp, configs, dados
//      de usuários/grupos, package.json) e restaura tudo logo em seguida.
//      O backup só é removido DEPOIS do npm install terminar com sucesso,
//      para permitir rollback caso a instalação de dependências falhe.
// ============================================================================
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Detecta Termux/Android para ajustar variáveis de ambiente do npm
const isTermux =
  Boolean(process.env.TERMUX_VERSION) ||
  (process.env.PREFIX || "").includes("com.termux") ||
  process.platform === "android";
const TERMUX_HOME = "/data/data/com.termux/files/home";

const ROOT = __dirname;
const REPO_URL = "https://github.com/mg5860606-ux/YAKAMY-CORVO-VIP";
const BACKUP_DIR = path.join(ROOT, "corvo_dados", ".update_backup");

// Dados locais que NUNCA podem ser sobrescritos pelo repositório
// ⚠️ IMPORTANTE: qualquer arquivo de config/dados do DONO rastreado pelo git
// precisa estar aqui — senão o `git reset --hard` do update restaura a versão
// do repositório e apaga a configuração local (número do dono, nome do bot,
// APIs como Gemini, logos, dados de grupos...).
const PROTEGIDOS = [
  // 📱 Sessão do WhatsApp (não pode perder!)
  "corvo_dados/qrcode",

  // ⚙️ Números de dono e configurações de segurança
  "INFON/media/nescessario.json",
  // 🧠 Memória/chaves da IA
  "corvo-ia/data",

  // 👥 Usuários (vip/bans/leveling/nomes)
  "corvo_dados/usuarios",
  // ⚙️ Dados internos (coins, casamento, tmgroup, limitarcmd...)
  "corvo_dados/func",
  // 👥 Configurações dos grupos (inclui ATIVAÇÕES/)
  "corvo_dados/grupos",
  // ⚙️ Dados do bot (ia_switch, auditoria, figurinhas...)
  "corvo_dados/data",
  // 📊 Estatísticas locais (stats.json, totalcmd.json)
  "corvo_dados/anti_sp.json",
  "corvo_dados/antiarqv.json",
  "corvo_dados/diario.json",
  "corvo_dados/pprt_config.json",
  "corvo_dados/questions.json",
  "corvo_dados/take.json",
  "corvo_dados/vdddsf.json",

  // 🎵 Áudios / logos / mídias customizadas pelo dono
  "INFON/media/audios.json",
  "INFON/media/antispam.json",
  "INFON/media/comandos.json",
  "INFON/media/countmsg.json",
  "INFON/media/patentes.json",
  "INFON/LOGOS/logos.json",
  "INFON/LOGOS/links_img.json",

  // 🎲 Dados de jogos/funções locais
  "ARQUIVES/json/acoes.json",
  "ARQUIVES/json/advices.json",
  "ARQUIVES/json/slots.json",
  "ARQUIVES/json/sotoy.json",
  "ARQUIVES/json/tools.json",
  "ARQUIVES/json/vab.json",

  // 🔑 Variáveis de ambiente (chaves Gemini/APIs — NUNCA sobrescrever)
  ".env",
  // 📦 Usado para detectar se as dependências mudaram
  "package.json",
];

function log(msg) {
  console.log("• " + msg);
}

function tryRun(cmd, opts = {}) {
  try {
    const out = execSync(cmd, {
      encoding: "utf8",
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      ...opts,
    }).toString();
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: String(e.stdout || "") + String(e.stderr || "") };
  }
}

function copiar(origem, destino) {
  if (!fs.existsSync(origem)) return;
  fs.cpSync(origem, destino, { recursive: true, force: true });
}

function limpar(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (e) {}
}

function restaurarBackup() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  for (const p of PROTEGIDOS) {
    // ⚠️ package.json NÃO é restaurado: o repositório pode ter atualizado as
    // dependências — o reset já baixou a versão nova e ela deve permanecer
    // (só é usada na comparação do passo 8 / restaurada se o npm install falhar).
    if (p === "package.json") continue;
    copiar(path.join(BACKUP_DIR, p), path.join(ROOT, p));
  }
}

function main() {
  // 0) git instalado?
  const gitv = tryRun("git --version");
  if (!gitv.ok) {
    console.log(
      "ATUALIZAR_ERRO: Git não encontrado no sistema. Instale o Git e tente novamente."
    );
    process.exit(1);
  }
  log("Git: " + gitv.out.trim());

  // 0.1) corrige "detected dubious ownership" no Android/Termux
  //      (ocorre quando a pasta está em /storage/emulated/0 e pertence
  //       a um UID diferente do usuário Termux que está rodando o git)
  tryRun(`git config --global safe.directory "${ROOT}"`);
  tryRun("git config --global safe.directory '*'");

  // 1) garante que a pasta é um repositório git
  if (!fs.existsSync(path.join(ROOT, ".git"))) {
    log("Inicializando repositório git...");
    const init = tryRun("git init");
    if (!init.ok) {
      console.log(
        "ATUALIZAR_ERRO: não foi possível inicializar o git: " +
          (init.out.trim() || "erro desconhecido")
      );
      process.exit(1);
    }
  }

  // 2) garante o remote 'origin' apontando para o repositório oficial
  const rem = tryRun("git remote get-url origin");
  if (!rem.ok || rem.out.trim() !== REPO_URL) {
    tryRun("git remote remove origin");
    const add = tryRun(`git remote add origin ${REPO_URL}`);
    if (!add.ok) {
      console.log(
        "ATUALIZAR_ERRO: não foi possível configurar o remote: " +
          (add.out.trim() || "erro desconhecido")
      );
      process.exit(1);
    }
  }
  log("Remote configurado: " + REPO_URL);

  // 3) descobre o branch padrão do repositório
  const refs = tryRun("git ls-remote --symref origin HEAD");
  const m = refs.out.match(/ref:\s*refs\/heads\/(\S+)\s+HEAD/);
  const branch = m ? m[1] : null;
  if (!branch) {
    console.log(
      "ATUALIZAR_ERRO: o repositório do GitHub está vazio ou inacessível. " +
        "Envie o código do bot para o repositório (branch main ou master) e tente novamente."
    );
    process.exit(1);
  }
  log("Branch: " + branch);

  // 4) backup dos dados locais críticos (fica salvo até o npm install acabar)
  log("Fazendo backup dos dados locais...");
  limpar(BACKUP_DIR);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  for (const p of PROTEGIDOS) {
    copiar(path.join(ROOT, p), path.join(BACKUP_DIR, p));
  }

  // 5) baixa e aplica a versão mais recente
  log("Baixando atualizações do GitHub...");
  const fetch = tryRun(`git fetch origin ${branch} --depth 1`);
  if (!fetch.ok) {
    restaurarBackup();
    limpar(BACKUP_DIR);
    console.log(
      "ATUALIZAR_ERRO: falha ao baixar do GitHub: " +
        (fetch.out.trim() || "erro desconhecido")
    );
    process.exit(1);
  }

  log("Aplicando a versão mais recente...");
  const reset = tryRun(`git reset --hard origin/${branch}`);
  if (!reset.ok) {
    restaurarBackup();
    limpar(BACKUP_DIR);
    console.log(
      "ATUALIZAR_ERRO: falha ao aplicar a atualização: " +
        (reset.out.trim() || "erro desconhecido")
    );
    process.exit(1);
  }

  // 6) restaura os dados locais (sessão, configs, usuários, grupos)
  log("Restaurando dados locais...");
  restaurarBackup();

  // 7) garante um .gitignore básico (para o dono não subir sessão/node_modules)
  const gitignore = path.join(ROOT, ".gitignore");
  if (!fs.existsSync(gitignore)) {
    const base =
      ["node_modules/", "corvo_dados/qrcode/", "corvo_dados/.update_backup/", "temp_videos/", ".env", "session/", "*.log"].join(
        "\n"
      ) + "\n";
    try {
      fs.writeFileSync(gitignore, base);
      log(".gitignore criado (sessão e node_modules protegidos).");
    } catch (e) {}
  }

  // 8) reinstala dependências se o package.json mudou
  const pkgAntes = fs.existsSync(path.join(BACKUP_DIR, "package.json"))
    ? fs.readFileSync(path.join(BACKUP_DIR, "package.json"), "utf8")
    : "";
  const pkgDepois = fs.existsSync(path.join(ROOT, "package.json"))
    ? fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
    : "";
  if (pkgAntes !== pkgDepois) {
    log("package.json mudou — instalando dependências (pode demorar)...");

    // No Termux, define HOME correto e usa --unsafe-perm para evitar erro de permissão
    const npmEnv = isTermux
      ? { ...process.env, HOME: TERMUX_HOME }
      : process.env;
    const npmCmd = "npm install --legacy-peer-deps --no-audit --no-fund";

    const inst = tryRun(npmCmd, { timeout: 540000, env: npmEnv });
    if (!inst.ok) {
      log("⚠️ Avisos durante o npm install. Os arquivos do bot foram atualizados com sucesso.");
    } else {
      log("✅ Dependências instaladas.");
    }
  } else {
    log("Dependências inalteradas.");
  }

  // 9) npm install ok (ou desnecessário) → backup pode ser removido
  limpar(BACKUP_DIR);

  const ultimo = tryRun(`git log -1 --oneline origin/${branch}`);
  if (ultimo.ok) log("Último commit: " + ultimo.out.trim());

  // Aviso honesto sobre customizações locais de código
  log(
    "⚠️ Arquivos de código locais foram substituídos pela versão do repositório. " +
      "Sessão, configurações e dados foram preservados."
  );

  console.log("ATUALIZAR_OK");
  process.exit(0);
}

main();
