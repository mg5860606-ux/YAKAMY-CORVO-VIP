async function writeExifWebp(buffer, metadata) {
    const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(8).toString("hex")}.webp`);
    const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(8).toString("hex")}.webp`);

    fs.writeFileSync(tmpFileIn, buffer);

    const img = new webp.Image();
    await img.load(tmpFileIn);

    const json = {
        "sticker-pack-id": "https://github.com",
        "sticker-pack-name": metadata.packname || "",
        "sticker-pack-publisher": metadata.author || "",
        "emojis": [""]
    };

    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2A, 0x00,
        0x08, 0x00, 0x00, 0x00,
        0x01, 0x00,
        0x41, 0x57,
        0x07, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x16, 0x00, 0x00, 0x00
    ]);

    const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
    const exif = Buffer.concat([exifAttr, jsonBuff]);

    exif.writeUIntLE(jsonBuff.length, 14, 4);

    img.exif = exif;
    await img.save(tmpFileOut);

    const finalWebp = fs.readFileSync(tmpFileOut);

    fs.unlinkSync(tmpFileIn);
    fs.unlinkSync(tmpFileOut);

    return finalWebp;
}


// =======================================================================
// FUNÇÃO renameContextSticker — AGORA FUNCIONANDO 100%
// =======================================================================

async function renameContextSticker(pack, author, name, info) {
    try {
        const quoted = info.message.extendedTextMessage.contextInfo.quotedMessage;
        const sticker = quoted.stickerMessage;

        // buffer do sticker
        const buffer = await getFileBuffer(sticker, "sticker");

        // aplica metadados
        const finalSticker = await writeExifWebp(buffer, {
            packname: pack,
            author: author
        });

        // ENVIA A FIGURINHA RENOMEADA
        await athenabot.sendMessage(
            info.key.remoteJid,
            { sticker: finalSticker },
            { quoted: info }
        );

        return true;
    } catch (e) {
        console.log("Erro no renameContextSticker:", e);
        return false;
    }
}
