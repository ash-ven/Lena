// Rinominare un cliente e cancellare una scheda: pagina e script (senza database).
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const w = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "web", f), "utf8");

test("pagine: la pagina del cliente ha il modulo per il nome e la conferma per cancellare una scheda", () => {
  const h = w("pt-cliente.html");
  for (const id of ["apri-nome", "modulo-nome", "nome-nuovo", "cognome-nuovo", "salva-nome", "annulla-nome", "nome-esito"]) assert.match(h, new RegExp(`id="${id}"`));
  const j = w("pt-cliente.js");
  assert.match(j, /\/nome`/);
  assert.match(j, /DELETE", `\/api\/schede\//);
  assert.match(j, /Non si può annullare/);
  assert.match(w("pt.css"), /button\.azione-testo/);
});

test("pagine: la vista dei progressi mostra l'andamento dei kg", () => {
  const h = w("pt-cliente.html");
  for (const id of ["progressi-kg", "progressi-kg-vuoto"]) assert.match(h, new RegExp(`id="${id}"`));
  assert.match(w("pt-progressi.js"), /LenaProgressi\.andamentoKg/);
});
