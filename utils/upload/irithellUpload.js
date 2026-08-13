const axios = require("axios");
const formData = require("form-data");
const fs = require("fs");

const DOMAIN_BASE_URL = "https://irithell.shop";
const API_BASE_URL = `${DOMAIN_BASE_URL}/api`;
const NICKNAME = "corvo"; // TROQUE TEU NICK, ELE SERÁ USADO PARA VOCÊ LISTAR SEUS LINKS

const callUploadAPI = async (nickname, mediaBuffer, filename, mimetype) => {
  try {
    const form = new formData();

    form.append("midia", mediaBuffer, {
      filename: filename,
      contentType: mimetype,
      knownLength: mediaBuffer.length,
    });

    const response = await axios.post(`${API_BASE_URL}/upload`, form, {
      headers: {
        ...form.getHeaders(),
        "x-api-key": NICKNAME,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return { success: true, data: response.data };
  } catch (error) {
    const errorMsg =
      error.response?.data?.error || "Falha na conexão ou upload.";
    return { success: false, error: error.response?.data?.details || errorMsg };
  }
};

const callShortenAPI = async (originalUrl) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/shorten`,
      { originalUrl },
      {
        headers: {
          "x-api-key": NICKNAME,
          "Content-Type": "application/json",
        },
      }
    );

    return { success: true, data: response.data };
  } catch (error) {
    const errorMsg =
      error.response?.data?.error || "Falha na conexão ou encurtamento.";
    return { success: false, error: error.response?.data?.details || errorMsg };
  }
};

const callListAPI = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/media/list`, {
      headers: { "x-api-key": NICKNAME },
    });
    return { success: true, data: response.data };
  } catch (error) {
    const errorMsg =
      error.response?.data?.error || "Falha na conexão ou listagem.";
    return { success: false, error: errorMsg };
  }
};

const callDeleteAPI = async (shortCode) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/media/${shortCode}`, {
      headers: { "x-api-key": NICKNAME },
    });
    return { success: true, message: response.data.message };
  } catch (error) {
    const errorMsg =
      error.response?.data?.error || "Falha na conexão ou exclusão.";
    return { success: false, error: error.response?.data?.details || errorMsg };
  }
};

const getFinalMediaUrl = async (shortCode) => {
  const shortUrl = `${DOMAIN_BASE_URL}/${shortCode}`;

  try {
    await axios.head(shortUrl, { maxRedirects: 0 });
    return null;
  } catch (error) {
    const response = error.response;

    if (response && (response.status === 302 || response.status === 301)) {
      return response.headers.location;
    } else {
      throw new Error(
        response
          ? `Erro HTTP: ${response.status}`
          : "Erro de conexão ou timeout."
      );
    }
  }
};

const documentFromURL = async (
  jurandir,
  from,
  info,
  url,
  filename = "documento_download",
  caption = ""
) => {
  let mimetype = "application/octet-stream";

  const mimeMap = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".zip": "application/zip",
    ".rar": "application/x-rar-compressed",
    ".7z": "application/x-7z-compressed",
    ".html": "text/html",
    ".json": "application/json",
    ".xml": "application/xml",
    ".js": "text/javascript",
    ".css": "text/css",
    ".ogg": "audio/ogg",
    ".opus": "audio/ogg; codecs=opus",
    ".wav": "audio/wav",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
  };

  const extMatch = filename.toLowerCase().match(/\.([0-9a-z]+)$/i);
  if (extMatch) {
    const ext = `.${extMatch[1]}`;
    if (mimeMap[ext]) {
      mimetype = mimeMap[ext];
    }
  }

  return await jurandir.sendMessage(
    from,
    {
      document: { url },
      caption: caption ? `${caption}` : "",
      fileName: filename,
      mimetype: mimetype,
    },
    { url, quoted: info }
  );
};

const imageFromURL = async (jurandir, from, info, url, caption = "") => {
  return await jurandir.sendMessage(
    from,
    {
      image: { url },
      caption: caption ? `${caption}` : "",
    },
    { url, quoted: info }
  );
};

const audioFromURL = async (jurandir, from, info, url) => {
  return await jurandir.sendMessage(
    from,
    {
      audio: { url },
      mimetype: "audio/mp4",
    },
    { url, quoted: info }
  );
};

const videoFromURL = async (jurandir, from, info, url, caption = "") => {
  return await jurandir.sendMessage(
    from,
    {
      video: { url },
      caption: caption ? `${caption}` : "",
    },
    { url, quoted: info }
  );
};

const processUploadResponse = (apiResponse) => {
  if (!apiResponse.success) {
    if (Array.isArray(apiResponse.error)) {
      return `> Erro de Validação: ${apiResponse.error.join(", ")}`;
    }
    return `> ${
      apiResponse.error || "> Erro desconhecido ao processar upload."
    }`;
  }

  const { message, shortUrl, originalUrl, clientId, fileId } = apiResponse.data;

  return `╭══════════════════════╗
┃ *𝚄𝚂𝚄𝙰𝚁𝙸𝙾: ${clientId}*
┃ *𝙵𝙸𝙻𝙴 𝙸𝙳: ${fileId}*
╰══════════════════════╝

    𝙻𝙸𝙽𝙺 𝙲𝚄𝚁𝚃𝙾
☞ ${shortUrl}

    𝙻𝙸𝙽𝙺 𝙳𝙸𝚁𝙴𝚃𝙾
☞ ${originalUrl}

╭══════════════════════╗
┃           🐱  𝙹𝚄𝚁𝙰𝙽𝙳𝙸𝚁  🐱
╰══════════════════════╝`.trim();
};

const processShortenResponse = (apiResponse) => {
  if (!apiResponse.success) {
    if (Array.isArray(apiResponse.error)) {
      return `> Erro de Validação: ${apiResponse.error.join(", ")}`;
    }
    return `> ${apiResponse.error || "> Erro desconhecido ao encurtar link."}`;
  }

  const { message, shortUrl, originalUrl, clientId } = apiResponse.data;

  return `
╭══════════════════════╗
┃ *𝚄𝚂𝚄𝙰𝚁𝙸𝙾: ${clientId}*
╰══════════════════════╝

    𝙻𝙸𝙽𝙺 𝙲𝚄𝚁𝚃𝙾
☞ ${shortUrl}

    𝙻𝙸𝙽𝙺 𝙳𝙸𝚁𝙴𝚃𝙾
☞ ${originalUrl}

╭══════════════════════╗
┃           🐱  𝙹𝚄𝚁𝙰𝙽𝙳𝙸𝚁  🐱
╰══════════════════════╝`.trim();
};

const formatBrazilianDate = (dateString) => {
  const datePart = dateString.split(" ")[0];
  const [year, month, day] = datePart.split("-");

  return `${day}/${month}/${year}`;
};

const processListResponse = (apiResponse) => {
  if (!apiResponse.success) {
    return `> ${apiResponse.error || "> Erro desconhecido ao listar links."}`;
  }

  const mediaList = apiResponse.data;

  if (mediaList.length === 0) {
    return "> Você não possui links ou mídias cadastrados com este nickname.";
  }

  const listText = mediaList.reduce((acc, item, index) => {
    const formattedDate = formatBrazilianDate(item.createdAt);

    const itemBlock = `\n\n*${index + 1}.* 𝙲𝙾𝙳𝙸𝙶𝙾: ${item.shortCode}
    𝙻𝙸𝙽𝙺 𝙲𝚄𝚁𝚃𝙾
☞ ${item.shortUrl}
𝙲𝚁𝙸𝙰𝙳𝙾: ${formattedDate}`;

    acc += itemBlock;

    if (index < mediaList.length - 1) {
      acc += "\n════════════════════════";
    }

    return acc;
  }, "");

  return `
╭══════════════════════╗
┃ *𝚄𝚂𝚄𝙰𝚁𝙸𝙾: ${NICKNAME}*
┃ *𝚃𝙾𝚃𝙰𝙻: ${mediaList.length}*
╰══════════════════════╝
${listText.trim()}
╭══════════════════════╗
┃           🐱  𝙹𝚄𝚁𝙰𝙽𝙳𝙸𝚁  🐱
╰══════════════════════╝
`.trim();
};

const processDeleteResponse = (apiResponse) => {
  if (!apiResponse.success) {
    return `> ${apiResponse.error || "> Erro desconhecido ao excluir link."}`;
  }

  const { message } = apiResponse;

  return `
╭══════════════════════╗
┃ *𝚄𝚂𝚄𝙰𝚁𝙸𝙾: ${NICKNAME}*
╰══════════════════════╝

${message}

╭══════════════════════╗
┃           🐱  𝙹𝚄𝚁𝙰𝙽𝙳𝙸𝚁  🐱
╰══════════════════════╝
`.trim();
};

module.exports = {
  NICKNAME,
  callUploadAPI,
  callShortenAPI,
  callListAPI,
  callDeleteAPI,
  getFinalMediaUrl,
  documentFromURL,
  imageFromURL,
  audioFromURL,
  videoFromURL,
  processUploadResponse,
  processShortenResponse,
  processListResponse,
  processDeleteResponse,
};
