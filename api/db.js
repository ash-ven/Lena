const { Pool, types } = require("pg");

// Le colonne DATE (es. scheda.inizio) arrivano come testo "2026-10-26", non come oggetto Date.
// Senza questa riga diventerebbero "2026-10-25T23:00:00.000Z" (mezzanotte italiana in ora UTC):
// il giorno prima!
types.setTypeParser(types.builtins.DATE, (testo) => testo);

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
