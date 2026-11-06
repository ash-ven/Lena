const { Pool } = require("pg");

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// Esegue "lavoro" dentro una transazione: o va a buon fine tutto, o non cambia niente.
// "lavoro" riceve il client da usare per le query (sempre lo stesso, è questo che fa la transazione).
db.transazione = async function (lavoro) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const risultato = await lavoro(client);
    await client.query("COMMIT");
    return risultato;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

module.exports = db;
