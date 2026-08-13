'use strict';
/**
 * dylanzx Mods dominah devs
 * O melhor de todos ( dylanzx)
 *
 * Sitema aprimorado e otimizado.
 */

const yts = require('./yt-search.js');
const { get } = require('axios');
const {
    createAgent,
    getInfo,
    getVideoID
} = require('@distube/ytdl-core');

const cookies = [{
    "name": "DV",
    "value": "8zd_0hfYFUIegCmcapqN1YPK1rhPIBk"
}, {
    "name": "SID",
    "value": "g.a000oAicdXBaHMNxB1IMNUMKwLCadS8hSOaGSLeILmw55djTumlwZOPDfiVIG0HweuxQfpkTeQACgYKATkSARISFQHGX2MiRAHCHbdtO09BSH2gomj0ZxoVAUF8yKpGFJ-lDXNp7OOG1c00esPT0076"
}, {
    "name": "APISID",
    "value": "PsYYSdQAgX1eqxFn/AWV5EkK2tamHM7eVb"
}, {
    "name": "SAPISID",
    "value": "cwBCPi_3yn4f9coY/AxiQ0iYdvnIItDtpR"
}, {
    "name": "__Secure-1PAPISID",
    "value": "cwBCPi_3yn4f9coY/AxiQ0iYdvnIItDtpR"
}, {
    "name": "__Secure-3PAPISID",
    "value": "cwBCPi_3yn4f9coY/AxiQ0iYdvnIItDtpR"
}, {
    "name": "SEARCH_SAMESITE",
    "value": "CgQIkJwB"
}, {
    "name": "SIDCC",
    "value": "AKEyXzWnf8Ql0itdJoa6mfbFuawWpglAPHr5SO5vugUFxWOSsqfPW4UL6PhOW2peojQIJfdk"
}];

const agentOptions = {
    pipelining: 5,
    maxRedirections: 0,
    localAddress: "127.0.0.1",
};

const agent = createAgent(cookies, agentOptions);
const BASE_YT_URL = 'https://www.youtube.com/watch?v=';

const requestURL = async (url, type) => {
    try {
        const id = getVideoID(url);
        const {
            videoDetails,
            formats
        } = await getInfo(`${BASE_YT_URL}${id}`, {
            quality: type === 'audio' ? 'lowestaudio' : 'lowest',
            filter: type === 'audio' ? 'audioonly' : 'videoandaudio'
        }, {
            agent
        });
        
        const data = type === 'audio' ? formats.find(format => format.audioBitrate) : formats.find(format => format.container == 'mp4' && format.hasVideo);

        return {
            title: videoDetails.title,
            thumb: videoDetails.thumbnails[0].url,
            channel: videoDetails.author.name,
            publi: videoDetails.uploadDate,
            views: videoDetails.viewCount,
            url: data.url
        };
    } catch (e) {
        throw new Error(`Erro ao processar resultados\n${e}`);
    }
};

const requestQuery = async (query, type) => {
    try {
        const data = await ytSearch(query);
        const url = data.find(item => item.type === 'video').url;

        return await requestURL(url, type);
    } catch (e) {
        throw new Error(`Falha ao obter resultados\n${e}`);
    }
};

async function ytSearch(query) {
    try {
        const { all } = await yts(query);
        return all;
    } catch (e) {
        throw new Error(e);
    }
}

const getBufferURL = async (url, opcoes = {}) => {
    try {
        const { data } = await get(url, {
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                'Referer': 'https://www.youtube.com/',
                'Origin': 'https://www.youtube.com',
                'Accept': '*/*',
                'Connection': 'keep-alive',
                'Range': 'bytes=0-'
            },
            responseType: 'arraybuffer'
        }); 
        return data;
    } catch (erro) {
        console.log(`Erro identificado: ${erro}`);
    }
};
module.exports = {
    ytDonlodMp3: (url) => requestURL(url, 'audio'),
    ytDonlodMp4: (url) => requestURL(url, 'video'),
    ytPlayMp3: (query) => requestQuery(query, 'audio'),
    ytPlayMp4: (query) => requestQuery(query, 'video'),
    ytSearch,
    getBufferURL
};