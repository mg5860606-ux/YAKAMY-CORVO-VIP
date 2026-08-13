'use strict';
const { load } = require('cheerio');
const { request } = require('undici');
const BASE_URL = 'https://www.youtube.com/results?app=desktop&sp=mAEA&search_query=';
const DEFAULT_YT_URL = 'https://www.youtube.com/watch?v=';
function getytInitialData(html) {
    const $ = load(html);
    let ytData;
    $('script').map(function() {
        const el = $(this).html();
        let regex;
        if ((regex = /var ytInitialData = /gi.exec(el || ''))) {
            ytData = JSON.parse(regex.input.replace(/^var ytInitialData = /i, '').replace(/;$/, ''));
        }
    });
    return ytData;
}

/**
 * Search video by title or url.
 * dylanzx Mods 
 * Based on module yt-search
 * @param {string} query - Termo de busca.
 * @returns {Promise<Object>} Resultados da busca.
 */
async function yts(query) {
    try {
        const opts = {
            method: 'GET',
            headers: {
                'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                'accept': 'text/html',
                'accept-language': 'en-US'
            },
        };
        const {
            body
        } = await request(BASE_URL + query, opts);
        const html = await body.text();
        const ytData = getytInitialData(html);
        if (!ytData) 
            throw new Error('ytInitialData not found');
        const results = {
            all: []
        };
        const contents = ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
        for (const item of contents) {
            const type = Object.keys(item)[0];
            const data = item[type];
            if (type === 'videoRenderer') {
                const video = {
                    type: 'video',
                    videoId: data.videoId,
                    title: data.title?.runs?.[0]?.text || '',
                    url: DEFAULT_YT_URL + data.videoId,
                    thumbnail: data.thumbnail?.thumbnails?.pop()?.url || '',
                    author: {
                        name: data.longBylineText?.runs?.[0]?.text,
                    },
                    description: data.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map(run => run.text).join('') || '',
                    viewCount: data.viewCountText?.simpleText || '',
                    duration: data.lengthText?.simpleText || '',
                    publishedTime: data.publishedTimeText?.simpleText || ''
                };
                results.all.push(video);
            }
        }
        return results;
    } catch (e) {
        throw new Error(e.message || e);
    }
}
module.exports = yts;
