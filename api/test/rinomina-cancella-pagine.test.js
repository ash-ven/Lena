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

test("scheda: nella settimana di scarico non si mostrano i pallini delle serie", () => {
  assert.match(w("scheda.js"), /const rs = scar \? null : rigaSerie\(/);
});

test("pagina del cliente: spunta accanto al nome se ha l'accesso, sezione invito nascosta, niente testo di spiegazione sui progressi", () => {
  const h = w("pt-cliente.html"), j = w("pt-cliente.js");
  assert.match(h, /id="spunta-accesso"/);
  assert.match(h, /id="sezione-invito"/);
  assert.match(h, /Il cliente vede solo l'ultima scheda che hai caricato/);
  assert.doesNotMatch(h, /si può solo guardare/);
  assert.match(j, /\$\("sezione-invito"\)\.hidden = !!cliente\.registrato/);
  assert.doesNotMatch(h, /Non inserire dati di salute\.<\/strong>Infortuni, patologie, farmaci, allergie: in questa fase Lena non può contenerli\.<\/p>\s*<div class="campo-pt">\s*<label for="note-testo">/);
});

test("account del cliente: mostra le note del trainer solo se ci sono", () => {
  assert.match(w("account.html"), /id="sezione-note" hidden/);
  assert.match(w("account.js"), /\/api\/me\/note/);
  assert.match(w("account.js"), /textContent = n\.json\.testo/);
});
