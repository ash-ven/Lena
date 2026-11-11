// «Nuovo massimo» nella scheda: il confronto con i pesi delle settimane precedenti. Non servono dati nel database.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const src = fs.readFileSync(path.join(__dirname, "..", "..", "web", "scheda.js"), "utf8");
const pezzo = src.slice(src.indexOf("// ---- record: inizio"), src.indexOf("// ---- record: fine ----"));
assert.ok(pezzo.length > 50, "non trovo il pezzo del record in scheda.js");
const { nuovoMassimo, pesoDa } = vm.runInNewContext(`${pezzo}; ({ nuovoMassimo, pesoDa })`);

test("i pesi si leggono anche con la virgola e con «kg»", () => {
  assert.equal(pesoDa("60"), 60);
  assert.equal(pesoDa("62,5"), 62.5);
  assert.equal(pesoDa("60 kg"), 60);
  for (const v of ["", "abc", "0", "-5", undefined, null]) assert.equal(pesoDa(v), 0, String(v));
});

test("nuovo massimo: solo se il peso supera tutti quelli delle settimane prima", () => {
  const kg = { "1|A|1": "50", "2|A|1": "55", "3|A|1": "52", "1|A|2": "20" };
  assert.deepEqual(JSON.parse(JSON.stringify(nuovoMassimo(kg, 4, "A|1", "57,5"))), { prima: 55, ora: 57.5 });
  assert.equal(nuovoMassimo(kg, 4, "A|1", "55"), null, "uguale non basta");
  assert.equal(nuovoMassimo(kg, 4, "A|1", "52"), null);
  assert.equal(nuovoMassimo(kg, 4, "A|1", ""), null);
  assert.equal(nuovoMassimo(kg, 1, "A|1", "100"), null, "la prima settimana non ha un prima");
  assert.equal(nuovoMassimo({}, 3, "A|1", "100"), null, "senza pesi precedenti non c'è un record");
  assert.equal(nuovoMassimo(kg, 4, "A|2", "25").prima, 20, "ogni esercizio ha il suo massimo");
  assert.equal(nuovoMassimo(kg, 2, "A|1", "51").prima, 50, "conta solo ciò che viene prima della settimana guardata");
});

test("il campo kg mostra il nuovo massimo, con i colori del mood", () => {
  assert.match(src, /nuovoMassimo\(mem\.kg, stato\.settimana, k, inp\.value\)/);
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "web", "scheda.css"), "utf8");
  assert.match(css, /\.campo\.record-battuto/);
});
