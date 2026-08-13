const axios = require("axios");
const apiURL = "http://hub.kryzeny.com:8423";
const apiKey = "JurandirAPI";

if (!apiKey || !apiURL) {
  throw new Error(
    "A apiKey e a apiURL precisam ser definidas no arquivo apiClient.js"
  );
}

const client = axios.create({
  baseURL: apiURL,
  headers: {
    "API-key": apiKey,
  },
});

function getClient() {
  return client;
}

module.exports = {
  getClient,
}