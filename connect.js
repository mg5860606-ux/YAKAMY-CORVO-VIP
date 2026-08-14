/*
 * ============================================================================
 *  🖤 𝒀𝑨𝑲𝑨𝑴𝒀 — CONEXÃO (BAILEYS)
 *  ----------------------------------------------------------------------------
 *  👑 Dono & Criador: DARK DYABYNHO
 *  💬 Telegram: @CORVO291
 *  🤖 Bot Telegram: t.me/corvo_div_bot
 *  🧠 IA: Irmã do DARK (cérebro do bot)
 *  💻 GitHub: github.com/mg5860606-ux
 *  📦 Repositório: github.com/mg5860606-ux/YAKAMY-CORVO-VIP
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
// 🐛 FIX 2026-08-14: Polyfill do File global para Node.js v18 (undici/fetch requer File no globalThis)
if (!globalThis.File) {
  try { globalThis.File = require("buffer").File; } catch (e) { }
}
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeInMemoryStore,
  DisconnectReason,
  WAGroupMetadata,
  relayWAMessage,
  MediaPathMap,
  mentionedJid,
  processTime,
  MediaType,
  MessageType,
  Presence,
  Mimetype,
  Browsers,
  delay,
  fetchLatestBaileysVersion,
  MessageRetryMap,
  extractGroupMetadata,
  generateWAMessageFromContent,
  proto,
  otherOpts,
  makeCacheableSignalKeyStore,
  PHONENUMBER_MCC,
} = require("@whiskeysockets/baileys");

const {
  axios,
  setting,
  cheerio,
  colors,
  ffmpeg,
  fetch,
  isUrl,
  ms,
  moment,
  os,
  exec,
  spawn,
  speed,
  execSync,
  sendPoll,
  simih,
  joguinhodavelhajs,
  joguinhodavelhajs2,
  validmove,
  setGame,
  countMessage,
  getName,
  nit,
  supre,
  ischyt,
  limitefll,
  casamento1,
  casamento2,
  ftmenu,
  muted,
  psycatgames,
  vyroEngine,
  kyun,
  menump4,
  palavrasANA,
  enigmaArchive,
  garticArchives,
  whatMusicAr,
  quizFutebol,
  uploadToCloudinary,
  streamToBuffer,
  addComandosId,
  deleteComandos,
  getComandoBlock,
  getComandos,
  addComandos,
  isJsonIncludes,
  request,
  getAvatar,
  config,
  hora,
  data,
  banner3,
  banner2,
  banner4,
  LoggerB,
  fs,
  peth,
  readline,
  extractStateFromNumber,
  NodeCache,
  Boom,
  date,
  time,
  getGroupAdmins,
  pushnames,
} = require("./exports.js");

// Global safety handlers to prevent the process from exiting on unexpected async errors
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err && err.stack ? err.stack : err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
});
const {
  wait,
  getExtension,
  generateMessageID,
  getMembros,
  getRandom,
  temporizador,
  getBuffer,
  fetchJson,
  fetchText,
  createExif,
  getBase64,
  convertSticker,
  upload,
  getpc,
  recognize,
} = require("./ARQUIVES/funcoes/functions.js");

const { prefix, CREDENTIALS_USER } = require("./INFON/DADOS/config.json");
const { fundo1, fundo2 } = require("./INFON/LOGOS/links_img.json");


// Funções padrão para o sistema de Bem-vindo/Adeus
const welcome = (numero, grupo) => `Olá @${numero}, seja bem-vindo(a) ao grupo ${grupo}!`;
const bye = (numero) => `Que pena, o membro @${numero} saiu do grupo.`;
const welcome2 = (numero, grupo) => `Olá @${numero}, seja bem-vindo(a) ao grupo ${grupo}!`;
const bye2 = (numero) => `Que pena, o membro @${numero} saiu do grupo.`;


const util = require("util");
const nescessario = JSON.parse(
  fs.readFileSync("./INFON/media/nescessario.json")
);
var LINKS_T = require("./INFON/LOGOS/links_img.json");
let groupCache = {};
let cooldowns = new Set();
let activeSock = null; // conexão Baileys ativa (para fechar antes de reconectar)
function DLT_FL(file) {
  try {
    fs.unlinkSync(file);
  } catch (error) { }
}

const logger = LoggerB.child({});
logger.level = "silent";

try {
  var ppUrl = tokito.profilePictureUrl(from, "image");
} catch {
  var ppUrl = `https://telegra.ph/file/6ca032835ed7a16748b6f.jpg`;
}

const datadb = require("./ARQUIVES/datadb.msg.js");
var qrcode = "./corvo_dados/qrcode";
const usePairingCode = process.argv.includes("sim");
if (!usePairingCode && !fs.existsSync(`${qrcode}/creds.json`))
  console.log(
    colors.yellow(
      "- Aviso: Se você não estiver outro aparelho em mãos para realizar a leitura do qr-code, você usar a 2° opção seria ela ( sh start.sh sim ), sem os parenteses e você conectará com código de emparelhamento.\n"
    ) + "–"
  );
const useMobile = process.argv.includes("--mobile");
function collectNumbers(inputString) {
  return inputString.replace(/\D/g, "");
}
const getddd = (id) => {
  if (Number(id.slice(0, 2)) !== 55) return `Não é do Brasil`;
  nmr = Number(id.slice(2, 4));
  if (nmr >= 11 && nmr <= 19) return `São Paulo`;
  else if (nmr >= 21 && nmr <= 24 && nmr != 23) return `Rio de Janeiro`;
  else if (nmr >= 27 && nmr <= 28) return `Espírito Santo`;
  else if (nmr >= 31 && nmr <= 38) return `Minas Gerais`;
  else if (nmr >= 41 && nmr <= 46) return `Paraná`;
  else if (nmr >= 47 && nmr <= 49) return `Santa Catarina`;
  else if (nmr >= 51 && nmr <= 55 && nmr != 52) return `Rio Grande do Sul`;
  else if (nmr == 61) return `Distrito Federal`;
  else if (nmr == 62 || nmr == 64) return `Goiás`;
  else if (nmr == 63) return `Tocantins`;
  else if (nmr >= 65 && nmr <= 66) return `Mato Grosso`;
  else if (nmr == 67) return `Mato Grosso do Sul`;
  else if (nmr == 68) return `Acre`;
  else if (nmr == 69) return `Rondônia`;
  else if (nmr >= 71 && nmr <= 77 && nmr != 72 && nmr != 76) return `Bahia`;
  else if (nmr == 79) return `Sergipe`;
  else if (nmr == 81 || nmr == 87) return `Pernambuco`;
  else if (nmr == 82) return `Alagoas`;
  else if (nmr == 83) return `Paraíba`;
  else if (nmr == 84) return `Rio Grande do Norte`;
  else if (nmr == 85 || nmr == 88) return `Ceará`;
  else if (nmr == 86 || nmr == 89) return `Piauí`;
  else if (nmr >= 91 && nmr <= 94 && nmr != 92) return `Pará`;
  else if (nmr == 92 || nmr == 97) return `Amazonas`;
  else if (nmr == 95) return `Roraima`;
  else if (nmr == 96) return `Amapá`;
  else if (nmr >= 98 && nmr <= 99) return `Maranhão`;
  else return `Não está no banco de dados brasileiro`;
};
const originalConsoleInfo = console.info;
console.info = function () {
  const message = util.format(...arguments);
  const forbiddenStrings = [
    "Closing session: SessionEntry",
    "Removing old closed session: SessionEntry {",
    "Another forbidden string",
    "Closing stale open session for new outgoing prekey bundle",
  ];
  if (forbiddenStrings.some((msg) => message.includes(msg))) {
    return;
  }
  originalConsoleInfo.apply(console, arguments);
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));
const msgRetryCounterCache = new NodeCache();

// ============================================================
// TRAVA ANTI-DUPLICATA (single instance) — AUTO-KILL no boot
// Se já existir outra instância do bot (mesmo lock ou QUALQUER
// processo node rodando connect.js), ESTA instância mata a antiga
// e sobe no lugar — sem precisar do restart.sh.
// (2 conexões com a mesma credencial derrubam as duas no WhatsApp.)
// execSync já vem do require('./exports.js') no topo.
// ============================================================
const LOCK_FILE = __dirname + "/corvo_dados/bot.lock";
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM"; // existe, mas sem permissão = vivo
  }
}
function matarPid(pid, motivo) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    }
    console.log(colors.yellow(`🧹 ${motivo} (PID ${pid}) encerrada.`));
    return true;
  } catch (e) {
    console.log(
      colors.red(`❌ Não foi possível encerrar ${motivo} (PID ${pid}): ${e.message}`)
    );
    return false;
  }
}
function dormirSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (_) { }
}
function abortarSeVivo(pid, motivo) {
  if (!isProcessAlive(pid)) return;
  console.log(
    colors.red(
      `❌ Não foi possível encerrar ${motivo} (PID ${pid}).\n` +
      `   Rode 'npm start' num terminal COMO ADMINISTRADOR, ou mate manualmente:\n` +
      (process.platform === "win32"
        ? `      taskkill /F /T /PID ${pid}\n`
        : `      kill -9 ${pid}\n`)
    )
  );
  process.exit(1);
}
function matarEConfirmar(pid, motivo) {
  matarPid(pid, motivo);
  // Aguarda a morte de verdade (kill lento não pode virar falso abort)
  for (let i = 0; i < 4; i++) {
    if (!isProcessAlive(pid)) return;
    dormirSync(400);
  }
  abortarSeVivo(pid, motivo);
}
function listarPidsConnectJs() {
  try {
    let out = "";
    if (process.platform === "win32") {
      // Espelha a varredura do restart.sh (via .ps1 temporário pra evitar
      // problemas de escape de aspas no cmd)
      const psFile =
        __dirname + "/corvo_dados/_scan_connect_" + process.pid + ".ps1";
      fs.writeFileSync(
        psFile,
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'connect\\.js' } | Select-Object -ExpandProperty ProcessId\n"
      );
      try {
        out = execSync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`,
          { encoding: "utf8", timeout: 15000, windowsHide: true }
        );
      } finally {
        try { fs.unlinkSync(psFile); } catch (_) { }
      }
    } else {
      out = execSync(`pgrep -f "connect\\.js"`, {
        encoding: "utf8",
        timeout: 15000,
      });
    }
    return out
      .split(/[\r\n]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
      .map(Number);
  } catch (e) {
    return [];
  }
}
function acquireLock() {
  try {
    // 1) Instância antiga apontada pelo lock file (se ainda viva) → mata
    // 🐛 FIX: oldPid é usado fora do if (na varredura) — precisa do escopo da função
    let oldPid = 0;
    if (fs.existsSync(LOCK_FILE)) {
      oldPid = parseInt(fs.readFileSync(LOCK_FILE, "utf8"), 10);
      if (oldPid && oldPid !== process.pid && isProcessAlive(oldPid)) {
        console.log(
          colors.yellow(
            `\n⚠️  Instância antiga do bot detectada (PID ${oldPid}) — encerrando pra subir a nova...`
          )
        );
        matarEConfirmar(oldPid, "instância antiga");
      }
    }
    // 2) Reivindica o lock AGORA (antes da varredura reduz a corrida de 2 boots)
    fs.writeFileSync(LOCK_FILE, String(process.pid));
    // 🐛 Corrida de 2 boots simultâneos: confere que o lock CONTINUA sendo nosso.
    // Se outro processo sobrescreveu, ele ganhou a corrida — sai limpo em vez de
    // os dois se matarem mutuamente (bot nunca sobe).
    try {
      const confirmPid = parseInt(fs.readFileSync(LOCK_FILE, "utf8"), 10);
      if (confirmPid !== process.pid) {
        console.log(
          colors.yellow(
            `⚠️  Outra instância reivindicou o lock primeiro (PID ${confirmPid}). Abortando este boot...`
          )
        );
        process.exit(1);
      }
    } catch (e) { }
    // 3) Varredura extra: qualquer outro processo node rodando connect.js
    const outros = listarPidsConnectJs().filter(
      (p) => p !== process.pid && p !== oldPid
    );
    for (const pid of outros) {
      if (isProcessAlive(pid)) matarEConfirmar(pid, "instância duplicada de connect.js");
    }
    console.log(colors.yellow(`✅ Lock adquirido (PID ${process.pid}).`));
  } catch (e) {
    console.log("Aviso: não foi possível criar o lock file:", e.message);
  }
}
function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = parseInt(fs.readFileSync(LOCK_FILE, "utf8"), 10);
      if (pid === process.pid) fs.unlinkSync(LOCK_FILE);
    }
  } catch (e) { }
}

// ============================================================
// ESTADO DA BIO (escopo de módulo — sobrevive a reconexões,
// diferente das vars declaradas dentro do case "open", que
// resetavam a cada reconexão e perdiam a janela de espera)
// ============================================================
let lastBioUpdate = 0; // última bio atualizada com sucesso
let bioRejeitadaEm = 0; // quando o WhatsApp rejeitou por frequência
const BIO_MIN_INTERVAL_MS = 15 * 60 * 1000; // mínimo entre updates (rotina)
const BIO_MIN_RECONNECT_MS = 2 * 60 * 1000; // mínimo entre updates em reconexão
const BIO_REJEICAO_ESPERA_MS = 30 * 60 * 1000; // espera pós-rejeição por frequência

async function connectToWhatsApp() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const { state, saveCreds } = await useMultiFileAuthState(qrcode);
  let version = [2, 3000, 1044409164];
  try {
    const vRes = await fetchLatestBaileysVersion();
    if (vRes?.version) version = vRes.version;
  } catch (e) { }
  async function getMessage(key) {
    // 🐛 FIX 2026-08-13: `store` nunca é declarada no projeto (makeInMemoryStore é
    // importada mas nunca instanciada). `if (store)` lançava ReferenceError em
    // toda mensagem citada → erro ao responder/enviar. Guarda segura com typeof.
    if (typeof store !== "undefined" && store) {
      try {
        const msg = await store.loadMessage(key.remoteJid, key.id);
        return msg?.message || undefined;
      } catch (error) {
        console.error("Erro ao carregar a mensagem:", error);
        return undefined;
      }
    }
    return Promise.resolve({});
  }

  const corvo = makeWASocket({
    version: [2, 3000, 1044409164],
    logger,
    emitOwnEvents: true,
    fireInitQueries: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    connectTimeoutMs: 60000,
    qrTimeout: 180000,
    keepAliveIntervalMs: 10000,
    defaultQueryTimeoutMs: 0,
    msgRetryCounterCache,
    printQRInTerminal: !usePairingCode,
    auth: state,
    browser: ["Ubuntu", "Edge", "110.0.1587.56"],
    generateHighQualityLinkPreview: true,
    patchMessageBeforeSending: (message) => {
      const requiresPatch = !!message?.interactiveMessage;
      if (requiresPatch) {
        message = {
          viewOnceMessageV2Extension: {
            message: {
              messageContextInfo: {
                deviceListMetadataVersion: 2,
                deviceListMetadata: {},
              },
              ...message,
            },
          },
        };
      }
      return message;
    },
    getMessage,
  });
  const tokito = corvo;
  activeSock = corvo; // registra o socket ativo para o watchFile poder fechá-lo antes de reconectar
  // Strip forwarding marks from outgoing messages to avoid "encaminhada" badge
  function stripForwarding(obj) {
    try {
      if (!obj || typeof obj !== 'object') return;
      if (obj.contextInfo && typeof obj.contextInfo === 'object') {
        delete obj.contextInfo.forwardingScore;
        delete obj.contextInfo.isForwarded;
      }
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (v && typeof v === 'object') stripForwarding(v);
      }
    } catch (e) { }
  }

  const _origSendMessage = tokito.sendMessage.bind(tokito);
  tokito.sendMessage = async (jid, message, options) => {
    try {
      stripForwarding(message);
    } catch (e) { }
    return _origSendMessage(jid, message, options);
  };
  if (usePairingCode && !tokito.authState.creds.registered) {
    if (useMobile) {
      throw new Error(
        "Não é possível usar código de emparelhamento com API móvel."
      );
    }

    const phoneNumber = await question(
      `${colors.cyan("\n. Use seu número de telefone. Exemplo: 5511555555555:\n")}`
    );
    let numerosColetados = collectNumbers(phoneNumber);

    // 🐛 FIX Termux/VPS: Aguarda o WebSocket do Baileys estar totalmente ABERTO (readyState === 1)
    // No PC (Windows) a conexão é instantânea (~50ms), mas no Termux e VPS a latência exige 500ms~1500ms.
    if (!tokito.ws || tokito.ws.readyState !== 1) {
      await new Promise((resolve) => {
        const interval = setInterval(() => {
          if (tokito.ws && tokito.ws.readyState === 1) {
            clearInterval(interval);
            resolve();
          }
        }, 200);
        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 15000);
      });
    }

    const code = await tokito.requestPairingCode(numerosColetados);
    console.log(
      `\n${colors.magenta("Aqui está o código de pareamento:")} ${colors.cyan(code)}\n–\n${colors.yellow("• Vá até o whatsapp > Clique nos 3 pontinhos > Dispositivos conectados > Conectar via código > Cole o codigo la e aguarde.")}`
    );
  }

  if (useMobile && !tokito.authState.creds.registered) {
    const { registration } = tokito.authState.creds || { registration: {} };
    if (!registration.phoneNumber) {
      registration.phoneNumber = await question(
        `${colors.cyan("INSIRA O NÚMERO...\n")}`
      );
    }
    const libPhonenumber = await require("libphonenumber-js");
    const phoneNumber = libPhonenumber.parsePhoneNumber(
      registration.phoneNumber
    );
    if (!phoneNumber?.isValid()) {
      throw new Error(
        "Número de telefone inválido: " + registration.phoneNumber
      );
    }
    registration.phoneNumber = phoneNumber.format("E.164");
    registration.phoneNumberCountryCode = phoneNumber.countryCallingCode;
    registration.phoneNumberNationalNumber = phoneNumber.nationalNumber;
    const mcc = PHONENUMBER_MCC[phoneNumber.countryCallingCode];
    if (!mcc) {
      throw new Error(
        `Não foi possível encontrar MCC para o número de telefone: ${registration.phoneNumber}. Especifique o MCC manualmente!`
      );
    }
    registration.phoneNumberMobileCountryCode = mcc;
    async function enterCode() {
      try {
        const code = await question("Digite o código único:\n");
        const response = await tokito.register(
          code.replace(/["']/g, "").trim().toLowerCase()
        );
        console.log("Seu número de telefone foi registrado com sucesso.");
        console.log(response);
        rl.close();
      } catch (error) {
        console.error(
          "Falha ao registrar seu número de telefone. Por favor, tente novamente.\n",
          error
        );
        await askForOTP();
      }
    }

    async function askForOTP() {
      let code = await question(
        'Como você gostaria de receber o código único para registro? "sms" ou "voz"\n'
      );
      code = code.replace(/["']/g, "").trim().toLowerCase();
      if (code !== "sms" && code !== "voice") {
        return await askForOTP();
      }
      registration.method = code;
      try {
        await tokito.requestRegistrationCode(registration);
        await enterCode();
      } catch (error) {
        console.error(
          "Falha ao solicitar o código de registro. Por favor, tente novamente.\n",
          error
        );
        await askForOTP();
      }
    }
    askForOTP();
  }

  tokito.ev.process(async (events) => {
    if (events["group-participants.update"]) {
      try {
        var naga2 = events["group-participants.update"];
        if (!fs.existsSync(`./corvo_dados/grupos/ATIVAÇÕES/${naga2.id}.json`)) return;
        var jsonGp = JSON.parse(
          fs.readFileSync(`./corvo_dados/grupos/ATIVAÇÕES/${naga2.id}.json`)
        );

        if (naga2.participants[0].startsWith(tokito.user.id.split(":")[0]))
          return;

        try {
          var grpmdt = await tokito.groupMetadata(naga2.id);
        } catch (e) {
          return;
        }

        const isGroup2 = grpmdt.id.endsWith("@g.us");

        try {
          var GroupMetadata_ = isGroup2
            ? await tokito.groupMetadata(naga2.id)
            : "";
        } catch (e) {
          return;
        }

        const membros_ = isGroup2 ? GroupMetadata_.participants : "";
        const groupAdmins_ = isGroup2 ? getGroupAdmins(membros_) : "";

        if (naga2.action == "add") {
          num = naga2.participants[0];
          if (nescessario.listanegraG.includes(num)) {
            tokito.sendMessage(GroupMetadata_.id, {
              text: mess.blackList(GroupMetadata_, naga2),
              mentions: naga2.participants,
            });
            tokito.groupParticipantsUpdate(
              GroupMetadata_.id,
              [naga2.participants[0]],
              "remove"
            );
            return;
          }
        }
        if (naga2.action == "remove") {
          num = naga2.participants[0];
        }
        if (
          naga2.action == "add" &&
          jsonGp[0].listanegra.includes(naga2.participants[0])
        ) {
          await tokito.sendMessage(GroupMetadata_.id, {
            text: mess.blackList(GroupMetadata_, naga2),
            mentions: naga2.participants,
          });
          tokito.groupParticipantsUpdate(
            GroupMetadata_.id,
            [naga2.participants[0]],
            "remove"
          );
        }
        if (
          jsonGp[0].antifake &&
          naga2.action === "add" &&
          !naga2.participants[0].startsWith(55)
        ) {
          if (jsonGp[0].legenda_estrangeiro != "0") {
            await tokito.sendMessage(GroupMetadata_.id, {
              text: jsonGp[0].legenda_estrangeiro,
            });
          }
          setTimeout(async () => {
            tokito.groupParticipantsUpdate(
              GroupMetadata_.id,
              [naga2.participants[0]],
              "remove"
            );
          }, 1000);
        }
        if (
          jsonGp[0].ANTI_DDD.active &&
          naga2.action == "add" &&
          jsonGp[0].ANTI_DDD.listaProibidos.includes(
            extractDDD(naga2.participants[0].split("@")[0])
          )
        ) {
          tokito.sendMessage(GroupMetadata_.id, {
            text: mess.forbiddenStateFromDDD(
              naga2.participants[0],
              extractStateFromDDD,
              extractDDD
            ),
            mentions: naga2.participants,
          });
          setTimeout(async () => {
            tokito.groupParticipantsUpdate(
              GroupMetadata_.id,
              [naga2.participants[0]],
              "remove"
            );
          }, 1000);
        }
        if (
          !jsonGp[0].wellcome[1].bemvindo2 &&
          !jsonGp[0].wellcome[0].bemvindo1
        )
          return;
        try {
          var mdata_2 = isGroup2 ? await tokito.groupMetadata(naga2.id) : "";
        } catch (e) {
          return;
        }
        const isWelcomed =
          jsonGp[0].wellcome[0].legendabv != null ? true : false;
        const isByed = jsonGp[0].wellcome[0].legendasaiu != 0 ? true : false;
        const isWelcomed2 =
          jsonGp[0].wellcome[1].legendabv != null ? true : false;
        const isByed2 = jsonGp[0].wellcome[1].legendasaiu != 0 ? true : false;
        const groupDesc = await mdata_2.desc;
        if (jsonGp[0].antifake == true && !naga2.participants[0].startsWith(55))
          return;
        if (jsonGp[0].wellcome[0].bemvindo1 == true) {
          const DLT_FL = (path) => {
            try {
              fs.unlinkSync(path);
              console.log(`Arquivo ${path} deletado com sucesso.`);
            } catch (err) {
              console.error(`Erro ao deletar o arquivo ${path}:`, err);
            }
          };

          // 🧹 LIMPEZA 2026-08-10: `ppimg`/`ppgp` aqui eram código MORTO —
          // atribuídos mas nunca lidos (o card real usa ppimg2, o buffer da
          // foto do membro). Cada fetch fazia uma requisição desnecessária de
          // foto (do membro e do grupo) a cada entrada/saída. Removidos.
          // 🐛 FIX 2026-08-10: `shortpc` era uma chamada MORTA (variável nunca
          // usada) e SEM try/catch — se o tinyurl falhasse (rate limit/offline),
          // o erro derrubava o envio inteiro do boas-vindas (o catch externo
          // engolia e a mensagem nunca saía). Removida.

          if (naga2.action === "add") {
            if (isWelcomed) {
              teks = jsonGp[0].wellcome[0].legendabv
                .replace("#hora#", time)
                .replace("#nomedogp#", mdata_2.subject)
                .replace(
                  "#numerodele#",
                  "@" + naga2.participants[0].split("@")[0]
                )
                .replace("#numerobot#", tokito.user.id)
                .replace(
                  "#prefixo#",
                  jsonGp[0].multiprefix == true
                    ? jsonGp[0].prefixos[0]
                    : setting.prefix
                )
                .replace("#descrição#", groupDesc)
                .replace(
                  "#estado#",
                  extractStateFromNumber(naga2.participants[0].split("@")[0])
                );
            } else {
              teks = welcome(
                naga2.participants[0].split("@")[0],
                mdata_2.subject
              );
            }

            // 🐛 FIX 2026-08-10: o `buff` externo era morto (redeclarado dentro
            // do try) e SEM proteção — se o getBuffer falhasse, matava o envio
            // do boas-vindas. Removido; só o `buff` interno (protegido) fica.
            // 🐛 FIX FOTO DO MEMBRO: antes forçava `${numero}@c.us` — o JID real
            // do participante pode ser @s.whatsapp.net ou @lid (LID). Com o
            // domínio errado o profilePictureUrl não achava a foto e o card
            // caía no fallback genérico. Agora passa o JID como veio no evento
            // (Baileys normaliza @c.us→@s.whatsapp.net e resolve LID sozinho).
            try {
              const ppimg2 = await tokito.profilePictureUrl(
                naga2.participants[0],
                "image"
              );
              let buff = await getBuffer(ppimg2);

              await tokito.sendMessage(mdata_2.id, {
                image: buff, // Enviar o buffer diretamente
                mentions: naga2.participants,
                caption: teks,
              });
            } catch (e) {
              // 🐛 FIX 2026-08-10: `item-not-found` (404) = o membro NÃO TEM
              // foto de perfil — caso esperado em boas-vindas/despedida, não é
              // erro de verdade. Só loga 1 linha curta em vez do stack inteiro
              // do Boom (que spammava o console a cada entrada/saída sem foto).
              const errFoto = String((e && e.message) || e);
              if (!errFoto.includes("item-not-found")) {
                console.log("Erro ao obter imagem de perfil:", errFoto);
              }

              await tokito.sendMessage(mdata_2.id, {
                image: {
                  url: "https://telegra.ph/file/b5427ea4b8701bc47e751.jpg",
                },
                mentions: naga2.participants,
                caption: teks,
              });
            }
          } else if (naga2.action === "remove") {
            mem = naga2.participants[0];
            // 🧹 LIMPEZA 2026-08-10: o `ppimg` do bloco de saída também era
            // código MORTO (atribuído, nunca lido — o envio usa ppimg2).

            if (isByed) {
              teks = jsonGp[0].wellcome[0].legendasaiu
                .replace("#hora#", time)
                .replace("#nomedogp#", mdata_2.subject)
                .replace(
                  "#numerodele#",
                  "@" + naga2.participants[0].split("@")[0]
                )
                .replace("#numerobot#", tokito.user.id)
                .replace(
                  "#prefixo#",
                  jsonGp[0].multiprefix == true
                    ? jsonGp[0].prefixos[0]
                    : setting.prefix
                )
                .replace("#descrição#", groupDesc)
                .replace(
                  "#estado#",
                  extractStateFromNumber(naga2.participants[0].split("@")[0])
                );
            } else {
              teks = bye(naga2.participants[0].split("@")[0]);
            }

            // 🐛 FIX 2026-08-10: o `buff` externo era morto (redeclarado dentro
            // do try) e SEM proteção — se o getBuffer falhasse, matava o envio
            // do boas-vindas. Removido; só o `buff` interno (protegido) fica.
            // 🐛 FIX FOTO DO MEMBRO: antes forçava `${numero}@c.us` — o JID real
            // do participante pode ser @s.whatsapp.net ou @lid (LID). Com o
            // domínio errado o profilePictureUrl não achava a foto e o card
            // caía no fallback genérico. Agora passa o JID como veio no evento
            // (Baileys normaliza @c.us→@s.whatsapp.net e resolve LID sozinho).
            try {
              const ppimg2 = await tokito.profilePictureUrl(
                naga2.participants[0],
                "image"
              );
              let buff = await getBuffer(ppimg2);

              await tokito.sendMessage(mdata_2.id, {
                image: buff, // Enviar o buffer diretamente
                mentions: naga2.participants,
                caption: teks,
              });
            } catch (e) {
              // 🐛 FIX 2026-08-10: `item-not-found` (404) = o membro NÃO TEM
              // foto de perfil — caso esperado em boas-vindas/despedida, não é
              // erro de verdade. Só loga 1 linha curta em vez do stack inteiro
              // do Boom (que spammava o console a cada entrada/saída sem foto).
              const errFoto = String((e && e.message) || e);
              if (!errFoto.includes("item-not-found")) {
                console.log("Erro ao obter imagem de perfil:", errFoto);
              }

              await tokito.sendMessage(mdata_2.id, {
                image: {
                  url: "https://telegra.ph/file/b5427ea4b8701bc47e751.jpg",
                },
                mentions: naga2.participants,
                caption: teks,
              });
            }
          }
        }

        if (jsonGp[0].wellcome[1].bemvindo2 == true) {
          if (naga2.action === "add") {
            if (isWelcomed2) {
              teks = jsonGp[0].wellcome[1].legendabv
                .replace("#hora#", time)
                .replace("#nomedogp#", mdata_2.subject)
                .replace(
                  "#numerodele#",
                  "@" + naga2.participants[0].split("@")[0]
                )
                .replace("#numerobot#", tokito.user.id)
                .replace(
                  "#prefixo#",
                  jsonGp[0].multiprefix == true
                    ? jsonGp[0].prefixos[0]
                    : setting.prefix
                )
                .replace("#descrição#", groupDesc)
                .replace(
                  "#estado#",
                  extractStateFromNumber(naga2.participants[0].split("@")[0])
                );
            } else {
              teks = welcome2(
                naga2.participants[0].split("@")[0],
                mdata_2.subject
              );
            }
            tokito.sendMessage(mdata_2.id, {
              text: teks,
              mentions: naga2.participants,
            });
          } else if (naga2.action === "remove") {
            var mem = naga2.participants[0];
            if (isByed2) {
              teks = jsonGp[0].wellcome[1].legendasaiu
                .replace("#hora#", time)
                .replace("#nomedogp#", mdata_2.subject)
                .replace(
                  "#numerodele#",
                  "@" + naga2.participants[0].split("@")[0]
                )
                .replace("#numerobot#", tokito.user.id)
                .replace(
                  "#prefixo#",
                  jsonGp[0].multiprefix == true
                    ? jsonGp[0].prefixos[0]
                    : setting.prefix
                )
                .replace("#descrição#", groupDesc)
                .replace(
                  "#estado#",
                  extractStateFromNumber(naga2.participants[0].split("@")[0])
                );
            } else {
              teks = bye2(mem.split("@")[0]);
            }
            corvo.sendMessage(mdata_2.id, {
              text: teks,
              mentions: naga2.participants,
            });
          }
        }
      } catch (e) {
        console.log(e);
      }
    }

    if (events["connection.update"]) {
      const update = events["connection.update"];
      var { connection, lastDisconnect } = update;
      const shouldReconnect = new Boom(lastDisconnect?.error)?.output
        .statusCode;

      switch (connection) {
        case "close":
          if (shouldReconnect) {
            if (shouldReconnect == 401) {
              console.log(colors.red(datadb.ErrorBaileys401()));
              // 🐛 FIX 2026-08-13: 401 = sessão deslogada/revogada pelo WhatsApp.
              // Reconectar com a MESMA sessão morta só repete "Connection Closed"
              // em loop infinito. Remove a sessão pra reconexão gerar QR/pareamento
              // novo.
              try { fs.rmSync(qrcode, { recursive: true, force: true }); } catch (e) { }
            } else if (shouldReconnect == 408) {
              console.log(colors.yellow(datadb.ErrorBaileys_408()));
            } else if (shouldReconnect == 411) {
              console.log(colors.yellow(datadb.ErrorBaileys411()));
            } else if (shouldReconnect == 428) {
              console.log(colors.yellow(datadb.ErrorBaileys_428()));
            } else if (shouldReconnect == 440) {
              console.log(colors.gray(datadb.ErrorBaileys_440()));
            } else if (shouldReconnect == 500) {
              console.log(colors.gray(datadb.ErrorBaileys_500()));
            } else if (shouldReconnect == 503) {
              console.log(
                colors.gray("Ocorreu um erro desconhecido! Error: 503.")
              );
            } else if (shouldReconnect == 515) {
              console.log(colors.gray(datadb.ErrorBaileys_515()));
            } else {
              const reasonAttr = lastDisconnect?.error?.data?.attrs?.reason || lastDisconnect?.error?.data?.reason || lastDisconnect?.error?.data;
              console.log(
                `${colors.red("[CONNECTION CLOSED]")} Conexão fechada por motivo do erro: ${lastDisconnect?.error} | statusCode: ${shouldReconnect} | reason: ${JSON.stringify(reasonAttr)}`
              );
            }
            connectToWhatsApp();
          }
          break;

        case "connecting":
          console.log(
            `${colors.white("×")} [${colors.red(date, time)}] - ${colors.yellow(datadb.connecting())}`
          );
          break;

        case "open":
          console.log(banner3.string);
          console.log(banner2.string);
          console.log(banner4.string);
          console.log(
            `${colors.white("𝐎𝐥𝐚 𝐡𝐮𝐦𝐚𝐧𝐨, 𝐞𝐮 𝐬𝐨𝐮 𝒂 𝒀𝑨𝑲𝑨𝑴𝒀, 𝐚𝐠𝐮𝐚𝐫𝐝𝐞 𝟓 𝐬𝐞𝐠𝐮𝐧𝐝𝐨𝐬")}`
          );

          const frase = "🩷 𝒀𝑨𝑲𝑨𝑴𝒀 𝑪𝑶𝑵𝑬𝑪𝑻𝑨𝑫𝑨... 🩷";
          const assinatura = "© ⏤͟͟͞͞𝒀𝑨𝑲𝑨𝑴𝒀";

          const largura = Math.max(frase.length, assinatura.length) + 1; // espaço extra
          const moldura = " ".repeat(largura);

          function centralizar(texto, largura) {
            const espacos = largura - texto.length;
            const esquerda = Math.floor(espacos / 6);
            const direita = espacos - esquerda;
            return " ".repeat(esquerda) + texto + " ".repeat(direita);
          }

          console.log(
            colors.cyan(`
${moldura}
${centralizar(frase, largura)}
${centralizar(assinatura, largura)}
${moldura}
`)
          );

          // Função para pegar data e hora formatadas
          function getDataHora() {
            const agora = new Date();
            const data = agora.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            const hora = agora.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return { data, hora };
          }

          // Função para pegar emoji aleatório de relógio
          function emojiRelogio() {
            const relogios = [
              "⏰",
              "🕒",
              "🕑",
              "🕓",
              "🕔",
              "🕖",
              "🕙",
              "🕛",
              "🕞",
              "⌛",
              "⏳",
            ];
            return relogios[Math.floor(Math.random() * relogios.length)];
          }

          // Função para pegar emoji aleatório de calendário
          function emojiCalendario() {
            const calendarios = ["📅", "🗓️", "📆", "🗒️"];
            return calendarios[Math.floor(Math.random() * calendarios.length)];
          }

          // Função para gerar frases no estilo Tokito de conexão
          function gerarFraseConexao() {
            const { data, hora } = getDataHora();
            const eRelogio = emojiRelogio();
            const eCalendario = emojiCalendario();

            const modelos = [
              `🩷 𝒀𝑨𝑲𝑨𝑴𝒀 conectada às ${eRelogio} ${hora} do dia ${eCalendario} ${data}`,
              `🤍 𝒀𝑨𝑲𝑨𝑴𝒀 conectada em ${eCalendario} ${data}, às ${eRelogio} ${hora}`,
              `❤️ 𝒀𝑨𝑲𝑨𝑴𝒀 está online às ${eRelogio} ${hora} — ${eCalendario} ${data}`,
              `💛 𝒀𝑨𝑲𝑨𝑴𝒀 conectada desde ${eCalendario} ${data} às ${eRelogio} ${hora}`,
              `🩵 𝒀𝑨𝑲𝑨𝑴𝒀 conectada às ${eRelogio} ${hora} de ${eCalendario} ${data}`,
              `🩷 𝒀𝑨𝑲𝑨𝑴𝒀 conectada em ${eCalendario} ${data} às ${eRelogio} ${hora}`,
              `🤍 𝒀𝑨𝑲𝑨𝑴𝒀 conectada — ${eCalendario} ${data} ${eRelogio} ${hora}`,
            ];

            return modelos[Math.floor(Math.random() * modelos.length)];
          }

          // Função para atualizar bio
          async function atualizarBioConexao(force = false, motivo = 'rotina') {
            // 🐛 FIX 2026-08-10: só tenta atualizar a bio se a conexão estiver
            // REALMENTE aberta. Antes, o setTimeout de retry disparava no socket
            // morto e spammava 'Connection Closed (428)' sem parar.
            if (connection !== 'open') {
              console.log('[INFO] Bio não atualizada: conexão não está aberta.');
              return;
            }
            const now = Date.now();
            // ⏳ Se o WhatsApp rejeitou por bio muito frequente, NÃO fica batendo:
            // respeita uma espera mínima (mesmo em reconexão com force=true)
            if (bioRejeitadaEm && now - bioRejeitadaEm < BIO_REJEICAO_ESPERA_MS) {
              const minRest = Math.ceil(
                (BIO_REJEICAO_ESPERA_MS - (now - bioRejeitadaEm)) / 60000
              );
              console.log(
                `[INFO] Bio em espera pós-rejeição por frequência (${minRest} min restantes). Pulando (${motivo}).`
              );
              return;
            }
            // 🐛 FIX: force=true (reconexão) não pode virar martelo — se o bot
            // reconectar várias vezes em poucos minutos (440/428), o update
            // frequente CAUSA a rejeição que estamos tentando evitar.
            const minIntervalo = force ? BIO_MIN_RECONNECT_MS : BIO_MIN_INTERVAL_MS;
            if (now - lastBioUpdate < minIntervalo) {
              console.log('[INFO] Pulando atualização de bio (intervalo curto).');
              return;
            }
            try {
              const frase = gerarFraseConexao();
              await tokito.updateProfileStatus(frase);
              lastBioUpdate = Date.now();
              bioRejeitadaEm = 0; // reset após sucesso
              // 🔕 FIX 2026-08-13: log removido a pedido — o console não deve
              // mais exibir "✅ Bio atualizada..." a cada reconexão.
            } catch (e) {
              const msgErro = (e && e.message) || '';
              const isRate = e && (
                e.data === 429 ||
                msgErro.includes('rate-overlimit') ||
                msgErro.toLowerCase().includes('too frequent') ||
                msgErro.toLowerCase().includes('muito frequente') ||
                msgErro.includes('429')
              );
              if (isRate) {
                // 🐛 FIX: WhatsApp rejeitou por frequência — NÃO agenda retry
                // (senão fica batendo e agrava o bloqueio). Marca a janela de espera.
                bioRejeitadaEm = Date.now();
                lastBioUpdate = Date.now();
                console.warn(
                  `❌ Bio rejeitada por frequência (${motivo}). ` +
                  `Próxima tentativa só após ~${Math.round(BIO_REJEICAO_ESPERA_MS / 60000)} min.`
                );
              } else {
                // Erro de conexão (428/Connection Closed etc.) — loga curto, sem spam
                console.log('[INFO] Bio não atualizada:', msgErro || e);
              }
            }
          }

          // Chama a função — force=true garante re-atualizar a bio na reconexão
          atualizarBioConexao(true, 'reconexão');

          rl.close();
          break;

        default:
          break;
      }
    }

    if (events["messages.upsert"]) {
      var upsert = events["messages.upsert"];
      const msg = upsert.messages && upsert.messages[0];


      const info = upsert.messages[0];
      if (upsert.type !== "notify" && !(upsert.type === "append" && msg?.key?.fromMe)) {
        return;
      }

      const connectToWhatsApp = require("./corvo.js");
      connectToWhatsApp(upsert, corvo, qrcode)
        .then(() => { })
        .catch((error) => {
          console.log("Erro no Bot:", String(error));
        });
    }

    // Sistema para avisar mudança de TAG no grupo
    if (events["group.member-tag.update"]) {
      try {
        const tagUpdate = events["group.member-tag.update"];
        const groupId = tagUpdate.groupId; // ID do grupo
        const participant = tagUpdate.participant; // ID do membro
        const newTag = tagUpdate.label; // Pega o texto da nova tag

        if (groupId && participant) {
          let texto = "";

          if (newTag) {
            // Se o usuário colocou uma tag nova
            texto = `🏷️ *NOVA TAG DEFINIDA*\n\nO membro @${participant.split("@")[0]} definiu a sua tag no grupo para: *${newTag}*`;
          } else {
            // Se o usuário removeu a tag
            texto = `🏷️ *TAG REMOVIDA*\n\nO membro @${participant.split("@")[0]} removeu a sua tag no grupo.`;
          }

          // Envia a mensagem marcando o @ do usuário no grupo
          await corvo.sendMessage(groupId, {
            text: texto,
            mentions: [participant]
          });
        }
      } catch (e) {
        console.log("Erro no evento de tag do grupo:", e);
      }
    }



    if (events["creds.update"]) {
      await saveCreds();
    }
  });
}

// Trava anti-duplicata + limpeza do lock ao sair
acquireLock();
process.on("exit", releaseLock);
process.on("SIGINT", () => { releaseLock(); process.exit(0); });
process.on("SIGTERM", () => { releaseLock(); process.exit(0); });

connectToWhatsApp().catch(async (e) => {
  console.log(colors.red("ERROR EM INICIAR.JS: " + e));
});

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(colors.bold(`\n\n• O arquivo "${__filename}" foi atualizado.\n`));
  // FECHA a conexão Baileys anterior ANTES de recarregar, evitando sessão duplicada
  // (duas conexões com a mesma credencial fazem o WhatsApp derrubar o bot = bot mudo)
  try {
    if (activeSock && typeof activeSock.end === "function") {
      activeSock.end(undefined);
      console.log(colors.yellow("• Conexão anterior fechada, reconectando..."));
    }
  } catch (e) {
    console.log("Erro ao fechar conexão antiga:", e);
  }
  releaseLock(); // libera a trava para a nova instância (mesmo processo) poder pegá-la
  delete require.cache[file];
  require(file);
});
