const path = require("path");
const fs = require("fs");
const {
  getXPForLevelUp,
  getTotalXPForLevel,
  getPatenteForLevel,
} = require("./levelingUtils");

// 🐛 FIX 2026-08-13: detecção de Termux/Android robusta.
// Antes só aceitava IS_TERMUX === "true" (o start.sh mandava "termux" e o
// canvas era tentado no celular mesmo assim, falhando no load). Agora aceita
// qualquer valor verdadeiro, a env TERMUX_VERSION (padrão do Termux) e o
// platform android.
const IS_TERMUX =
  ["true", "1", "termux", "sim", "yes"].includes(
    String(process.env.IS_TERMUX || "").toLowerCase()
  ) ||
  !!process.env.TERMUX_VERSION ||
  process.platform === "android";
let createCanvas, loadImage, registerFont;
let CANVAS_DISPONIVEL = false;

if (!IS_TERMUX) {
  try {
    const canvas = require("canvas");
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
    registerFont = canvas.registerFont;
    CANVAS_DISPONIVEL = true;
    console.log("Módulo Canvas carregado com sucesso.");

    // Registra a fonte
    const boldFontPath = path.join(
      __dirname,
      "./canva/fonts/Pixelify_Sans/static/PixelifySans-Bold.ttf"
    );
    registerFont(boldFontPath, { family: "Pixelify Sans" });
  } catch (e) {
    CANVAS_DISPONIVEL = false;
    console.warn(
      "⚠️ Aviso: Falha ao carregar o módulo Canvas. Recursos de imagem estarão indisponíveis."
    );
  }
} else {
  console.log(
    "Ambiente Termux/Windows detectado. O módulo Canvas foi ignorado."
  );
}

const designConfig = {
  width: 2048,
  height: 2048,
  fontFamily: "Pixelify Sans",
  corPrincipal: "#FFFFFF",
  mainFrame: { x: 0, y: 0, width: 2048, height: 2048 },
  avatar: {
    photo: { x: 560, y: 144, width: 928, height: 944 },
    frame: { x: 0, y: 0, width: 2048, height: 2048 },
  },
  username: { y: 1344, size: 160, padding: 240 },
  level: { x: 976, y: 1568, size: 112 },
  barraXP: { x: 0, y: 0, width: 2048, height: 2048 },
  textoXP: { x: 1220, y: 1648, size: 56 },
};

function getProfileImage(user) {
  if (user.pfpUrl && user.pfpUrl !== "default") return user.pfpUrl;

  const animePacksDir = path.join(__dirname, "./canva/assets/anime_packs");
  if (!fs.existsSync(animePacksDir))
    return path.join(__dirname, "./canva/assets/borders/default_avatar.png");

  const subfolders = fs
    .readdirSync(animePacksDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  if (subfolders.length === 0)
    return path.join(__dirname, "./canva/assets/borders/default_avatar.png");

  const chosenFolder =
    subfolders[Math.floor(Math.random() * subfolders.length)];
  const folderPath = path.join(animePacksDir, chosenFolder);
  const images = fs
    .readdirSync(folderPath)
    .filter((file) => /\.(png|jpg|jpeg|gif)$/i.test(file));

  if (images.length === 0)
    return path.join(__dirname, "./canva/assets/borders/default_avatar.png");

  const chosenImage = images[Math.floor(Math.random() * images.length)];
  return path.join(folderPath, chosenImage);
}

async function generateUserCard(user) {
  // 🐛 FIX 2026-08-13: o cartão NUNCA pode derrubar o bot. Se algo falhar
  // (assets ausentes, fonte faltando, canvas indisponível), retorna null e o
  // chamador cai no fallback de texto.
  try {
    if (!CANVAS_DISPONIVEL) {
      console.log(
        "generateUserCard chamado, mas Canvas indisponível. Retornando null."
      );
      return null;
    }

    const assetsDir = path.join(__dirname, "./canva/assets/");
    if (!fs.existsSync(path.join(assetsDir, "background"))) {
      console.log(
        "generateUserCard: pasta canva/assets/background ausente. Retornando null."
      );
      return null;
    }

    const level = user.level || 0;
    const xp = user.xp || 0;
    const xpNoNivel = xp - getTotalXPForLevel(level);
    const xpTotalDoNivel = getXPForLevelUp(level);
    const progressoPercent = Math.min(1, xpNoNivel / xpTotalDoNivel);

    const totalFrames = 49;
    const xpFrameNumber = Math.max(
      1,
      Math.min(totalFrames, Math.ceil(progressoPercent * totalFrames))
    );
    const backgroundFiles = fs.readdirSync(path.join(assetsDir, "background"));
    if (!backgroundFiles.length) return null;
    const assets = {
      background:
        backgroundFiles[Math.floor(Math.random() * backgroundFiles.length)],
      mainFrame: "main_frame.png",
      avatarFrame: "avatar_frame.png",
      xpBar: `xp_bar${xpFrameNumber}.png`,
    };

    const [background, mainFrame, avatarFrame, xpBar] = await Promise.all([
      loadImage(path.join(assetsDir, "background", assets.background)),
      loadImage(path.join(assetsDir, "borders", assets.mainFrame)),
      loadImage(path.join(assetsDir, "borders", assets.avatarFrame)),
      loadImage(path.join(assetsDir, "xp_bar", assets.xpBar)),
    ]);

  const canvas = createCanvas(designConfig.width, designConfig.height);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  ctx.drawImage(background, 0, 0, designConfig.width, designConfig.height);
  ctx.drawImage(mainFrame, 0, 0, designConfig.width, designConfig.height);

  try {
    const avatarPath = getProfileImage(user);
    const avatar = await loadImage(avatarPath);
    if (avatarPath.includes("default_avatar.png")) {
      ctx.drawImage(avatar, 0, 0, 512, 512);
    } else {
      ctx.drawImage(
        avatar,
        designConfig.avatar.photo.x,
        designConfig.avatar.photo.y,
        designConfig.avatar.photo.width,
        designConfig.avatar.photo.height
      );
    }
  } catch (e) {
    ctx.fillStyle = "#222";
    ctx.fillRect(
      designConfig.avatar.photo.x,
      designConfig.avatar.photo.y,
      designConfig.avatar.photo.width,
      designConfig.avatar.photo.height
    );
  }

  ctx.drawImage(
    avatarFrame,
    designConfig.avatar.frame.x,
    designConfig.avatar.frame.y,
    designConfig.avatar.frame.width,
    designConfig.avatar.frame.height
  );

  ctx.fillStyle = designConfig.corPrincipal;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${designConfig.username.size}px ${designConfig.fontFamily}`;
  let usernameText = user.pushname || "Usuário";
  if (usernameText.length > 9) usernameText = usernameText.slice(0, 11) + "...";
  ctx.fillText(usernameText, designConfig.width / 2, designConfig.username.y);

  ctx.drawImage(
    xpBar,
    designConfig.barraXP.x,
    designConfig.barraXP.y,
    designConfig.barraXP.width,
    designConfig.barraXP.height
  );

  ctx.font = `bold ${designConfig.level.size}px ${designConfig.fontFamily}`;
  const levelText = `Level ${level}`;
  ctx.fillText(levelText, designConfig.width / 2, designConfig.level.y);

  ctx.font = `bold ${designConfig.textoXP.size}px ${designConfig.fontFamily}`;
  const xpText = `${xpNoNivel.toLocaleString(
    "pt-BR"
  )}/${xpTotalDoNivel.toLocaleString("pt-BR")}`;
  ctx.fillText(xpText, designConfig.width / 2, designConfig.textoXP.y);

  const patente = getPatenteForLevel(level);
  ctx.font = `bold 80px ${designConfig.fontFamily}`;
  ctx.fillStyle = "#FFD700";
  const barraY = Math.round((116 / 128) * 2048);
  ctx.fillText(
    `${patente.icone} ${patente.nome}`,
    designConfig.width / 2,
    barraY
  );

  return canvas.toBuffer("image/png");
  } catch (e) {
    // 🐛 FIX 2026-08-13: qualquer erro de geração (asset corrompido, fonte
    // faltando, imagem inválida) vira null — o chamador cai no fallback.
    console.log(
      "generateUserCard: erro ao gerar cartão, usando fallback:",
      e && e.message ? e.message : e
    );
    return null;
  }
}

module.exports = { generateUserCard };
