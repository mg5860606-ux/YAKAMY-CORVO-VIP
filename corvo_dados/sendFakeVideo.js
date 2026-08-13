module.exports = async function sendFakeVideo(sock, jid, link, thumb, title, duration) {
    try {
        let videoMessage = {
            video: { url: link },
            caption: title,
            gifPlayback: false,
            fileName: title + ".mp4",
            mimetype: "video/mp4",
            jpegThumbnail: Buffer.from(await (await fetch(thumb)).arrayBuffer()),
            seconds: duration
        };

        return await sock.sendMessage(jid, videoMessage);
    } catch (e) {
        console.error("ERRO sendFakeVideo:", e);
    }
};
