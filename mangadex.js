"use strict";
const axios = require("axios");

const BASE = "https://api.mangadex.org";

/**
 * 🔍 Buscar mangás PT-BR
 */
async function mangadex_search(title) {
  const { data } = await axios.get(`${BASE}/manga`, {
    params: {
      title,
      limit: 10,
      availableTranslatedLanguage: ["pt-br"],
    },
  });

  return data.data.map((m) => ({
    id: m.id,
    title:
      m.attributes.title["pt-br"] ||
      m.attributes.title["en"] ||
      "Sem título",
    status: m.attributes.status,
    year: m.attributes.year,
  }));
}

/**
 * 📚 Listar capítulos
 */
async function mangadex_chapters(manga_id) {
  const { data } = await axios.get("https://api.mangadex.org/chapter", {
    params: {
      manga: manga_id,
      translatedLanguage: ["pt-br"],
      limit: 100,
      "order[chapter]": "desc",
    },
  });

  return data.data.map((c) => ({
    id: c.id,
    chapter: c.attributes.chapter || "?",
    title: c.attributes.title || "",
    pages: c.attributes.pages,
  }));
}

/**
 * 🖼️ Páginas do capítulo
 */
async function mangadex_pages(chapter_id) {
  const { data } = await axios.get(`${BASE}/at-home/server/${chapter_id}`);

  const base = data.baseUrl;
  const hash = data.chapter.hash;

  return data.chapter.data.map(
    (img) => `${base}/data/${hash}/${img}`
  );
}

module.exports = {
  mangadex_search,
  mangadex_chapters,
  mangadex_pages,
};
