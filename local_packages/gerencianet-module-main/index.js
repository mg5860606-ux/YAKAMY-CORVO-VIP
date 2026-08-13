//By: 𖧄 𝐋𝐔𝐂𝐀𝐒 𝐌𝐎𝐃 𝐃𝐎𝐌𝐈𝐍𝐀 𖧄
//Canal: https://whatsapp.com/channel/0029Vb69bDnAe5VmzSMwBH11

const fs = require('fs')
const path = require('path')
let EfiPay
try {
	EfiPay = require('sdk-node-apis-efi')
} catch (e) {
	// Optional SDK missing — silently disable Efí Pay features to avoid noisy startup logs.
	EfiPay = null
}
const QRCode = require('qrcode')
const fileType = require('file-type')
const axios = require('axios')
const zerosite = "https://zero-two-apis.com.br"
const API_KEY_ZEROTWO = "RAIKEY"

async function upload(mediaBuffer, fileName = "file") {
return new Promise(async (resolve, reject) => {
try {// By: 𖧄 𝐋𝐔𝐂𝐀𝐒 𝐌𝐎𝐃 𝐃𝐎𝐌𝐈𝐍𝐀 𖧄
// Canal: https://whatsapp.com/channel/0029Va6riekH5JLwLULwI7P2B
console.log("Iniciando o processamento do media...")
if (Buffer.isBuffer(mediaBuffer)) {
console.log("Media recebido é um buffer. Preparando para upload...")
const mediaType = await fileType.fromBuffer(mediaBuffer)
console.log("Tipo de mídia detectado:", mediaType)
if (!mediaType) {
console.error("Não foi possível determinar o tipo do arquivo.")
return reject("Não foi possível determinar o tipo do arquivo.")
}
try {
const uploadRes = await axios.post(`${zerosite}/api/upload`, {
apikey: API_KEY_ZEROTWO,
media: mediaBuffer,
filename: fileName
}, {
headers: {
'Content-Type': 'multipart/form-data'
}
})
if (uploadRes.data.status) {
console.log("Link gerado com sucesso:", uploadRes.data.resultado)
resolve(uploadRes.data.resultado)
} else {
console.error("Erro ao gerar o link:", uploadRes.data.message || 'Erro desconhecido')
reject("Erro ao gerar o link.")
}
} catch (uploadError) {
console.error("Erro ao enviar para a API de upload:", uploadError.message)
reject("Falha ao enviar a mídia para a API.")
}
} else {
console.error("Erro: O formato do media não é um buffer.")
reject("Formato do media não suportado. Envie um buffer.")
}
} catch (error) {
console.error("Erro ao processar o media:", error.message)
reject("Falha ao processar o media: " + error.message)
}
})
}

class EfiPayPayment {
	constructor(pixKey) {
		// If SDK not available, keep object functional but with Efipay disabled.
		if (!EfiPay) {
			this.efi = null;
			this.pixKey = pixKey;
			return;
		}

		const certificatePath = path.join(__dirname, 'producao_zerotwo.p12');
		if (!fs.existsSync(certificatePath)) {
			// Certificate missing; log minimal warning.
			console.warn(`Certificado não encontrado: ${certificatePath}. Efipay pode falhar.`);
		}

		this.pixKey = pixKey;
		const options = {
			sandbox: false,
			client_id: 'seu cliente id',
			client_secret: 'seu cliente secret',
			certificate: certificatePath,
			cert_base64: false,
			scopes: ['pix.write', 'pix.read'],
		};

		try {
			this.efi = new EfiPay(options);
		} catch (e) {
			console.error('Falha ao inicializar SDK da Efí Pay:', e && e.message ? e.message : e);
			this.efi = null;
		}
	}

async createPixPayment(pacote) {
if (!this.efi) {
throw new Error('SDK da Efí Pay não inicializado. Verifique o certificado.')
}
console.log('[INFO] Iniciando criação de pagamento PIX...')
const valorOriginal = parseFloat(pacote.valor).toFixed(2)
const nomePacote = `Pacote de ${pacote.requests} Requests / ${pacote.consultas} Consultas`
const chargeBody = {
calendario: {
expiracao: 900,
},
valor: {
original: valorOriginal,
},
chave: this.pixKey,
infoAdicionais: [
{
nome: nomePacote,
valor: nomePacote,
},
],
}
try {
const response = await this.efi.pixCreateImmediateCharge({}, chargeBody)
console.log('[DEBUG] Resposta completa de pixCreateImmediateCharge:', response)
if (!response?.txid) {
throw new Error('Falha na criação de cobrança: resposta incompleta')
}
const txid = response.txid
console.log('[SUCESSO] Cobrança PIX criada:', { txid })
console.log('[INFO] Gerando QR Code...')
const qrCodeParams = { id: response.loc.id }
const qrCodeResponse = await this.efi.pixGenerateQRCode(qrCodeParams)
console.log('[SUCESSO] QR Code gerado com sucesso.')
const pixCopiaECola = response.pixCopiaECola
const qrCodeBuffer = await QRCode.toBuffer(pixCopiaECola, {
type: 'png',
errorCorrectionLevel: 'H',
})
const uploadedImage = await upload(qrCodeBuffer, "QRCODE-PIX")
console.log('[SUCESSO] Imagem QR Code enviada para o servidor.')
return {
txid,
qr_code: qrCodeResponse.qrcode,
qr_code_base64: qrCodeResponse.imagemQrcode,
uploaded_image_url: uploadedImage,
pix_copia_e_cola: pixCopiaECola,
valor: chargeBody.valor.original,
}
} catch (error) {
console.error('[ERRO] Falha ao criar pagamento PIX:', error)
console.error('[DEBUG] Status HTTP:', error.code)
console.error('[DEBUG] Resposta completa:', error.response?.data)
return null
}
}

async checkPayment(txid) {
if (!this.efi) {
throw new Error('SDK da Efí Pay não inicializado. Verifique o certificado.')
}
console.log('[INFO] Verificando status do pagamento PIX para TXID:', txid)
try {
const params = { txid }
const response = await this.efi.pixDetailCharge(params)
console.log('[SUCESSO] Status do pagamento:', response.status)
return response.status
} catch (error) {
console.error('[ERRO] Falha ao verificar pagamento PIX:', error)
return null
}
}

startPaymentStatusCheck(txid) {
console.log(`[INFO] Iniciando verificação de pagamento para TXID: ${txid}`)
const intervalId = setInterval(async () => {
const status = await this.checkPayment(txid)
const finalStatuses = ['COMPLETED', 'CONCLUIDA', 'CANCELED', 'CANCELADO', 'EXPIRED', 'EXPIRADO']
if (finalStatuses.includes(status.toUpperCase())) {
console.log(`[INFO] Pagamento finalizado com status: ${status}`)
clearInterval(intervalId)
} else if (status.toUpperCase() === 'ATIVA') {
console.log(`[INFO] Pagamento ainda ATIVO. Aguardando confirmação...`)
} else {
console.log(`[INFO] Status atual: ${status}. Continuando verificação...`)
}
}, 15000)
}
}

module.exports = { EfiPayPayment }
