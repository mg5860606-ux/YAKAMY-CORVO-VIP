const { exec } = require("child_process");
const fs = require("fs");
const axios = require("axios");

module.exports = async function getVideoDuration(m3u8Url) {
    try {
        const tempFile = "./corvo_dados/temp_ep.mp4";

        // baixa primeiros segundos pra ffprobe ler
        const { data } = await axios({
            url: m3u8Url,
            method: "GET",
            responseType: "stream",
        });

        const writer = fs.createWriteStream(tempFile);
        data.pipe(writer);

        await new Promise((resolve) => writer.on("finish", resolve));

        return await new Promise((resolve, reject) => {
            exec(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${tempFile}`, (err, stdout) => {
                fs.unlinkSync(tempFile);
                if (err) return reject(err);
                resolve(parseInt(stdout.trim()));
            });
        });

    } catch (e) {
        console.error("ERRO getVideoDuration:", e);
        return 0;
    }
};
