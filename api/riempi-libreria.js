// Riempie la libreria esercizi di ogni trainer con gli esercizi (e i video) delle schede che ha GIÀ caricato.
// Serve una volta sola: da qui in poi la libreria impara da sola a ogni scheda salvata.
//
//   node riempi-libreria.js            (oppure: node riempi-libreria.js --prova)   solo ELENCO: non scrive niente
//   node riempi-libreria.js --esegui   scrive davvero. Si può rilanciare senza danni: non cambia nomi e video già in libreria
//
// Si lancia a mano, dalla cartella api.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });   // prima di caricare il database
const db = require("./db");
const { riempiDallaStoria } = require("./libreria");

const argomenti = process.argv.slice(2);
if (argomenti.some((a) => !["--prova", "--esegui"].includes(a)) || (argomenti.includes("--prova") && argomenti.includes("--esegui"))) {
  console.error("Uso: node riempi-libreria.js [--prova | --esegui]   (senza niente = --prova)");
  process.exit(1);
}
const esegui = argomenti.includes("--esegui");

(async () => {
  try {
    const esito = await riempiDallaStoria({ esegui });
    if (!esito.length) { console.log("Nessuna scheda salvata: non c'è niente da aggiungere."); return; }
    for (const e of esito) {
      console.log(`  ${e.pt_nome} (id ${e.pt_id}): ${e.schede} ${e.schede === 1 ? "scheda" : "schede"}, ${e.esercizi} esercizi diversi, ${e.nuovi} ${e.nuovi === 1 ? "nuovo" : "nuovi"} per la libreria`);
    }
    if (!esegui) {
      console.log("\nMODALITÀ PROVA: non ho toccato niente.");
      console.log("Per scrivere davvero: node riempi-libreria.js --esegui");
    } else console.log("\nFatto. La libreria ora conosce gli esercizi delle schede già caricate.");
  } catch (err) {
    console.error("Errore:", err.code || err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
