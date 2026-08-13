class EfiPay {
  constructor(options) {
    console.warn('[WARN] sdk-node-apis-efi stub initialized. Real implementation is not installed.');
    this.options = options;
  }

  async pixCreateImmediateCharge(params, body) {
    throw new Error('sdk-node-apis-efi is not installed. Install the real package or provide a working implementation.');
  }

  async pixGenerateQRCode(params) {
    throw new Error('sdk-node-apis-efi is not installed. Install the real package or provide a working implementation.');
  }

  async pixDetailCharge(params) {
    throw new Error('sdk-node-apis-efi is not installed. Install the real package or provide a working implementation.');
  }
}

module.exports = EfiPay;
