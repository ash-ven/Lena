// Cancella i clienti vecchi: quelli con «rapporto concluso» o senza attività da più di MESI_CONSERVAZIONE mesi.
//
//   node pulizia.js            (oppure: node pulizia.js --prova)   solo ELENCO: dice chi verrebbe cancellato e perché, senza toccare niente
//   node pulizia.js --esegui   cancella davvero (cliente, schede, progressi, inviti e account del cliente), un cliente alla volta
//
// Si lancia a mano, dalla cartella api. Non gira da solo: vedi il README per sapere perché e come programmarlo più avanti.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });   // prima di caricare il database
const db = require("./db");
const { mesiConservazione } = require("./config");
const { trovaScaduti, eseguiPulizia } = require("./conservazione");

const argomenti = process.argv.slice(2);
const noti = ["--prova", "--esegui"];
const sconosciuti = argomenti.filter((a) => !noti.includes(a));
if (sconosciuti.length || (argomenti.includes("--prova") && argomenti.includes("--esegui"))) {
  console.error(sconosciuti.length ? `Non conosco: ${sconosciuti.join(" ")}.` : "Scegli una cosa sola: --prova oppure --esegui.");
  console.error("Uso: node pulizia.js [--prova | --esegui]   (senza niente = --prova)");
  process.exit(1);
}
const esegui = argomenti.includes("--esegui");

const giorno = (d) => new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

(async () => {
  try {
    const mesi = mesiConservazione();
    const adesso = new Date();
    console.log(`Conservazione: ${mesi} mesi (si cambia con MESI_CONSERVAZIONE in api/.env).`);

    const { limite, scaduti } = await trovaScaduti({ adesso, mesi });
    console.log(`Si cancellano i clienti con rapporto concluso prima del ${giorno(limite)}, o (se il rapporto è in corso) senza attività da prima di quel giorno.\n`);

    if (!scaduti.length) { console.log("Nessun cliente da cancellare."); return; }
    for (const c of scaduti) {
      console.log(`  id ${c.id}: ${c.nome} ${c.cognome} (di ${c.professionista}) · ${c.motivo} dal ${giorno(c.data)}${c.utente_id ? " · ha un account" : ""}`);
    }

    if (!esegui) {
      console.log(`\nMODALITÀ PROVA: ${scaduti.length} ${scaduti.length === 1 ? "cliente verrebbe cancellato" : "clienti verrebbero cancellati"}. Non ho toccato niente.`);
      console.log("Per cancellare davvero: node pulizia.js --esegui");
      return;
    }

    const r = await eseguiPulizia({ adesso, mesi });
    console.log(`\nCancellati ${r.cancellati.length} ${r.cancellati.length === 1 ? "cliente" : "clienti"} (con schede, progressi, inviti e account).`);
    if (r.falliti.length) {
      console.error(`NON cancellati per un errore: id ${r.falliti.map((f) => `${f.id} (${f.errore})`).join(", ")}. Riprova o controlla il database.`);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("Errore:", err.code || err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
