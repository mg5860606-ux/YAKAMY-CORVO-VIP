const { getClient } = require("./getClient.js");

const getPinterestMedia = async (query, type, count = 1) => {
  try {
    const endpoint =
      type === "image" ? "/pinterest/images" : "/pinterest/videos";
    const apiUrl = `${endpoint}/${encodeURIComponent(query)}`;
    const response = await getClient().get(apiUrl);
    if (
      !response.data ||
      !response.data[type === "image" ? "images" : "videos"]?.length
    ) {
      return {
        error: "Nenhum resultado encontrado.",
      };
    }
    const mediaArray = response.data[type === "image" ? "images" : "videos"];
    const results = [];
    const usedIndices = new Set();
    while (
      results.length < Math.min(count, mediaArray.length) &&
      usedIndices.size < mediaArray.length
    ) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * mediaArray.length);
      } while (usedIndices.has(randomIndex));
      usedIndices.add(randomIndex);
      const media = mediaArray[randomIndex];
      const mediaUrl = type === "image" ? media.url : media.videoUrl;
      if (type === "video") {
        try {
          await axios.head(mediaUrl, {
            timeout: 5000,
          });
        } catch {
          continue;
        }
      }
      results.push(mediaUrl);
      if (count === 1) {
        return {
          mediaUrl,
        };
      }
    }
    if (results.length === 0) {
      return {
        error: "Não foi possível encontrar mídias disponíveis.",
      };
    }
    return {
      mediaUrls: results,
    };
  } catch (error) {
    console.error(`Erro ao buscar ${type} no Pinterest:`, error.message);
    return {
      error: "Erro ao conectar-se à API.",
    };
  }
};

module.exports = {
  getPinterestMedia,
};