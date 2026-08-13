const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = process.env.MONGODB_URI || process.env.MONGODB_SRV_URI;

const realClient = uri
  ? new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    })
  : null;

let dbConnected = false;

async function connectToDatabase() {
  if (!realClient) {
    console.warn("Nenhuma URI MongoDB configurada. Conexão MongoDB será ignorada.");
    dbConnected = false;
    return;
  }

  try {
    await realClient.connect();
    dbConnected = true;
    console.log("Conectado ao MongoDB com sucesso.");
  } catch (err) {
    dbConnected = false;
    console.error("Falha ao conectar com o MongoDB:", err);
    // Do not exit the process; allow bot to continue in degraded mode.
  }
}

function isDbConnected() {
  return dbConnected;
}

// Dummy DB/collection that safely no-ops and returns empty results
const noopCollection = () => ({
  findOne: async () => null,
  find: () => ({ toArray: async () => [] }),
  insertOne: async () => ({ acknowledged: false }),
  updateOne: async () => ({ acknowledged: false }),
  deleteOne: async () => ({ acknowledged: false }),
  aggregate: () => ({ toArray: async () => [] }),
  updateMany: async () => ({ acknowledged: false }),
  replaceOne: async () => ({ acknowledged: false }),
});

const dummyDb = {
  collection: () => noopCollection(),
};

// Export a wrapper named `client` so existing requires (e.g., `const { client } = require(...)`) keep working.
const client = {
  db(dbName) {
    return dbConnected && realClient ? realClient.db(dbName) : dummyDb;
  },
  // expose the real client if needed through _real
  _real: realClient,
};

// Try to connect immediately but swallow errors so they become handled here.
connectToDatabase().catch((e) => {
  console.error('connectToDatabase caught error:', e && e.message ? e.message : e);
});

module.exports = {
  client,
  connectToDatabase,
  isDbConnected,
};

/*
RCjiPjOBtccenbUt

duartegaydasilva

mongodb+srv://duartegaydasilva:RCjiPjOBtccenbUt@rem.klazksd.mongodb.net/?retryWrites=true&w=majority&appName=Rem */
