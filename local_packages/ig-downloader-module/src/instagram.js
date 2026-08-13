const axios = require("axios");
const cheerio = require("cheerio");

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Content-Type": "application/x-www-form-urlencoded",
  "Origin": "https://snapinsta.to",
  "Referer": "https://snapinsta.to/pt"
};

async function instagram_dl(url) {
  if (!url.includes("instagram.com")) {
    return { status: false, message: "URL inválida do Instagram" };
  }

  try {
    const { data } = await axios.post(
      "https://snapinsta.to/action.php",
      new URLSearchParams({ url }),
      { headers }
    );

    const $ = cheerio.load(data);
    let results = [];

    $(".download-items__btn a").each((i, el) => {
      const link = $(el).attr("href");
      if (link && link.startsWith("http")) {
        results.push({
          tipo: link.includes(".mp4") ? "video" : "image",
          url: link
        });
      }
    });

    if (results.length === 0) {
      return { status: false, message: "Não foi possível encontrar mídia" };
    }

    return {
      status: true,
      total: results.length,
      resultados: results
    };

  } catch (err) {
    return { status: false, message: "Erro ao acessar SnapInsta" };
  }
}

module.exports = { instagram_dl };
