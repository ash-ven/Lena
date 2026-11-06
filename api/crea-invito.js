// Crea l'invito per un cliente e stampa il link da mandargli.
// Uso (dalla cartella api):   node crea-invito.js <id-cliente>
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });   // prima di caricare il database
const db = require("./db");
const { creaInvito, DURATA_INVITO_GIORNI } = require("./operazioni");

const id = /^[1-9]\d{0,8}$/.test(process.argv[2] || "") ? Number(process.argv[2]) : null;
if (!id) {
  console.log("Uso: node crea-invito.js <id-cliente>");
  console.log('Per vedere gli id dei clienti:  docker exec lena-db psql -U lena -d lena -c "SELECT id, nome, cognome FROM cliente"');
  process.exit(1);
}

(async () => {
  try {
    const r = await db.query("SELECT nome, cognome, utente_id FROM cliente WHERE id = $1", [id]);
    const cliente = r.rows[0];
    if (!cliente) { console.error(`Non esiste nessun cliente con id ${id}.`); process.exitCode = 1; return; }
    if (cliente.utente_id) { console.error(`${cliente.nome} ${cliente.cognome} ha già un account: non serve un invito.`); process.exitCode = 1; return; }

    const { codice } = await creaInvito(id);
    const base = (process.env.URL_BASE || `http://localhost:${process.env.PORT || 3001}`).replace(/\/+$/, "");
    console.log(`Invito creato per ${cliente.nome} ${cliente.cognome}.`);
    console.log(`\nApri questo link nel browser (vale ${DURATA_INVITO_GIORNI} giorni e si può usare una volta sola):\n`);
    console.log(`${base}/registrati.html?codice=${codice}\n`);
    console.log("Il codice si vede solo adesso: nel database resta soltanto la sua impronta.");
    console.log("Se ne crei un altro per lo stesso cliente, questo smette di funzionare.");
  } catch (err) {
    console.error("Errore:", err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
