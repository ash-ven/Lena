// «Com'è andata» (facile / giusto / pesante) a ogni esercizio. Non servono dati nel database.
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const R = require("../../web/registrazioni.js");

const leggi = (...p) => fs.readFileSync(path.join(__dirname, "..", "..", ...p), "utf8");

test("sforzo: va e torna tra database e scheda; un valore strano si ignora", () => {
  const righe = [
    { tipo: "sforzo", chiave: "2|A|1", valore: "1" },
    { tipo: "sforzo", chiave: "2|A|2", valore: "9" },
    { tipo: "sforzo", chiave: "2|A|3", valore: "ciao" },
  ];
  const mem = R.memDaMappa(R.mappaDaVoci(righe));
  assert.deepEqual(mem.sforzo, { "2|A|1": "1" });
  assert.equal(R.mappaDaMem({ kg: {}, rip: {}, fatti: {}, serie: {}, sforzo: { "2|A|1": "3" } }).get("sforzo|2|A|1"), "3");
  const d = R.differenze(R.mappaDaMem({ sforzo: {} }), R.mappaDaVoci([righe[0]]));
  assert.deepEqual([...d], [["sforzo|2|A|1", ""]], "togliere la risposta cancella la riga");
});

test("sforzo: il server ammette solo 1, 2 o 3 e solo per un esercizio intero", () => {
  const srv = leggi("api", "schede.js");
  assert.match(srv, /const TIPI = \["kg", "rip", "serie", "fatto", "sforzo"\]/);
  assert.match(srv, /\["1", "2", "3"\]\.includes\(valore\)/);
  assert.match(srv, /\^\\d\{1,2\}\\\|\\w\{1,10\}\\\|\\d\{1,3\}\$/);
});

test("sforzo: la migrazione 14 e lo schema iniziale ammettono il nuovo tipo", () => {
  assert.match(leggi("db", "initdb", "14_sforzo.sql"), /'fatto', 'sforzo'/);
  assert.match(leggi("db", "initdb", "02_schede.sql"), /'fatto', 'sforzo'/);
});

test("sforzo: la scheda ha le tre risposte fisse e il trainer le vede in sola lettura", () => {
  const s = leggi("web", "scheda.js");
  assert.match(s, /\["1","Facile"\],\["2","Giusto"\],\["3","Pesante"\]/);
  assert.match(s, /if \(LETTURA\)\{ const s = SFORZI/);
  assert.match(leggi("web", "scheda.css"), /\.sforzo \.btn\[aria-pressed="true"\]/);
});
