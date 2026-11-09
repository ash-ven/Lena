// Il modello Excel scaricabile (web/modello-scheda-lena.xlsx) deve passare dal convertitore senza avvisi:
// se qualcuno cambia il formato del convertitore e il modello non va più bene, qui lo si scopre.
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { XLSX } = require("./excel-di-prova");
const { convertiXlsx } = require("../../web/convertitore.js");
const { erroreScheda } = require("../../web/valida-scheda.js");

const WEB = path.join(__dirname, "..", "..", "web");

test("il modello Excel si converte senza avvisi in una scheda valida", () => {
  const r = convertiXlsx(XLSX, fs.readFileSync(path.join(WEB, "modello-scheda-lena.xlsx")));
  assert.deepEqual(r.avvisi, []);
  assert.equal(erroreScheda(r.dati), null);
  assert.equal(r.dati.giorni.length, 2);
  assert.equal(r.dati.settimane, 5);                       // 4 di carico + 1 di scarico
  assert.equal(r.dati.info.sedute, r.dati.giorni.length);
  const blocchi = r.dati.giorni.flatMap((g) => g.blocchi);
  assert.ok(blocchi.some((b) => b.tipo === "circuito"), "ci deve essere un circuito di esempio");
  assert.ok(blocchi.some((b) => b.schema && b.schema.length === 4), "ci deve essere uno schema settimanale");
  assert.ok(blocchi.some((b) => b.progressione), "ci deve essere una progressione");
  assert.ok(blocchi.some((b) => b.video), "ci deve essere un video");
  assert.ok(r.dati.riscaldamento.esercizi.length >= 2);
});

test("il modello ha il foglio con le regole e la pagina cliente lo offre", () => {
  const cartella = XLSX.read(fs.readFileSync(path.join(WEB, "modello-scheda-lena.xlsx")));
  assert.deepEqual(cartella.SheetNames, ["Scheda", "Come si compila"]);
  assert.match(fs.readFileSync(path.join(WEB, "pt-cliente.html"), "utf8"), /href="\/modello-scheda-lena\.xlsx" download/);
});
