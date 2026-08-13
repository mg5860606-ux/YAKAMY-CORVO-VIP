"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) =>
  __copyProps(__defProp({}, "__esModule", { value: true }), mod);

var mangadex_exports = {};
__export(mangadex_exports, {
  mangadex_search: () => mangadex_search,
  mangadex_chapters: () => mangadex_chapters,
  mangadex_pages: () => mangadex_pages
});
module.exports = __toCommonJS(mangadex_exports);

const axios = require("axios");

const BASE = "https://api.mangadex.org";

/**
 * 🔍 Buscar mangás em PT-BR
 */
async function mangadex_search(title) {
  const { data } = await axios.get(`${BASE}/manga`, {
    params: {
      title,
      limit: 10,
      availableTranslatedLanguage: ["pt-br"]
    }
  });

  return data.data.map(m => ({
    id: m.id,
    title:
      m.attributes.title["pt-br"] ||
      m.attributes.title["en"] ||
      "Sem título",
    status: m.attributes.status,
    year: m.attributes.year
  }));
}

/**
 * 📚 Listar capítulos PT-BR
 */
async function mangadex_chapters(manga_id) {
  const { data } = await axios.get(`${BASE}/chapter`, {
    params: {
      manga: manga_id,
      translatedLanguage: ["pt-br"],
      order: { chapter: "desc" },
      limit: 100
    }
  });

  return data.data.map(c => ({
    id: c.id,
    chapter: c.attributes.chapter || "?",
    title: c.attributes.title || "",
    pages: c.attributes.pages
  }));
}

/**
 * 🖼️ Páginas do capítulo
 */
async function mangadex_pages(chapter_id) {
  const { data } = await axios.get(`${BASE}/at-home/server/${chapter_id}`);

  const base = data.baseUrl;
  const hash = data.chapter.hash;

  return data.chapter.data.map(img =>
    `${base}/data/${hash}/${img}`
  );
}
