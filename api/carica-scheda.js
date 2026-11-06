// Carica una scheda (il file JSON prodotto dal convertitore) per un cliente.
// Uso (dalla cartella api):   node carica-scheda.js <id-cliente> <file.json>
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });   // prima di caricare il database
const db = require("./db");
const { creaScheda } = require("./operazioni");

const id = /^[1-9]\d{0,8}$/.test(process.argv[2] || "") ? Number(process.argv[2]) : null;
const file = process.argv[3];
if (!id || !file) {
  console.log("Uso: node carica-scheda.js <id-cliente> <file.json>");
  console.log("Esempio:   node carica-scheda.js 1 esempio/scheda-esempio.json");
  process.exit(1);
}

// Legge il file di testo qualunque programma l'abbia scritto: PowerShell e il Blocco note aggiungono
// spesso un segno invisibile all'inizio (BOM), e PowerShell 5 può salvare in UTF-16.
function leggiTesto(percorso) {
  const b = fs.readFileSync(percorso);
  if (b[0] === 0xff && b[1] === 0xfe) return b.toString("utf16le").replace(/^﻿/, "");
  return b.toString("utf8").replace(/^﻿/, "");
}

(async () => {
  try {
    let json;
    try {
      json = JSON.parse(leggiTesto(path.resolve(file)));
    } catch (err) {
      console.error(err.code === "ENOENT" ? `Non trovo il file «${file}».` : `Il file non è un JSON valido: ${err.message}`);
      process.exitCode = 1;
      return;
    }
    // Va bene sia l'oggetto della scheda da solo, sia { "dati": { ... } }
    const dati = json && json.dati && typeof json.dati === "object" && json.inizio === undefined ? json.dati : json;

    const c = await db.query("SELECT nome, cognome FROM cliente WHERE id = $1", [id]);
    if (!c.rows[0]) { console.error(`Non esiste nessun cliente con id ${id}.`); process.exitCode = 1; return; }

    const r = await creaScheda(id, dati);   // stessi controlli dell'API
    if (r.errore) { console.error(`Scheda non valida: ${r.errore}`); process.exitCode = 1; return; }

    console.log(`Scheda caricata (id ${r.id}) per ${c.rows[0].nome} ${c.rows[0].cognome}:`);
    console.log(`«${dati.info && dati.info.titolo}», ${dati.settimane} settimane dal ${dati.inizio}, ${dati.giorni.length} giorni.`);
    console.log("Il cliente vede sempre la scheda caricata per ultima.");
  } catch (err) {
    console.error("Errore:", err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
