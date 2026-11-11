// L'ordine dell'elenco clienti. Senza database.
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ordina, OPZIONI } = require("../../web/ordina-clienti.js");

const c = (id, nome, cognome, o = {}) => ({ id, nome, cognome, schede: 1, giorni_alla_scadenza: 20, ultimo_progresso: "2026-11-01T10:00:00Z", rapporto_finito_il: null, ...o });
const ids = (l) => l.map((x) => x.id);

test("cognome e nome: ignorano maiuscole e accenti, e il rapporto finito va in fondo", () => {
  const l = [c(1, "Zoe", "Álvaro"), c(2, "Anna", "Bianchi"), c(3, "Marco", "Rossi", { rapporto_finito_il: "2026-10-01" }), c(4, "Bea", "Alvaro")];
  assert.deepEqual(ids(ordina(l, "cognome")), [4, 1, 2, 3]);   // Alvaro Bea, Álvaro Zoe: stesso cognome → per nome
  assert.deepEqual(ids(ordina(l, "nome")), [2, 4, 1, 3]);
});

test("scadenza: la più vicina (anche già scaduta) per prima, senza scheda in fondo", () => {
  const l = [c(1, "A", "A", { giorni_alla_scadenza: 30 }), c(2, "B", "B", { giorni_alla_scadenza: -3 }), c(3, "C", "C", { giorni_alla_scadenza: null, schede: 0 }), c(4, "D", "D", { giorni_alla_scadenza: 5 })];
  assert.deepEqual(ids(ordina(l, "scadenza")), [2, 4, 1, 3]);
});

test("fermi da più tempo: chi non ha mai segnato niente per primo, poi il più fermo; senza scheda in fondo", () => {
  const l = [c(1, "A", "A", { ultimo_progresso: "2026-11-08T10:00:00Z" }), c(2, "B", "B", { ultimo_progresso: "2026-09-01T10:00:00Z" }),
    c(3, "C", "C", { ultimo_progresso: null }), c(4, "D", "D", { schede: 0, ultimo_progresso: null })];
  assert.deepEqual(ids(ordina(l, "fermi")), [3, 2, 1, 4]);
});

test("non modifica l'elenco originale e un criterio sconosciuto ordina per cognome", () => {
  const l = [c(2, "B", "B"), c(1, "A", "A")];
  const copia = [...l];
  assert.deepEqual(ids(ordina(l, "boh")), [1, 2]);
  assert.deepEqual(l, copia);
  assert.equal(OPZIONI.length, 4);
});

test("la pagina usa l'ordinamento e ricorda la scelta", () => {
  const w = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "web", f), "utf8");
  assert.match(w("pt.html"), /id="ordine"/);
  assert.match(w("pt.html"), /ordina-clienti\.js/);
  assert.match(w("pt.js"), /LenaOrdinaClienti\.ordina\(clienti, ordine\)/);
});

test("l'elenco tiene i clienti con il rapporto concluso in una tendina chiusa, e la ricerca la apre", () => {
  const w = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "web", f), "utf8");
  assert.match(w("pt.html"), /<details class="altro conclusi" id="conclusi" hidden>/);
  assert.match(w("pt.html"), /id="elenco-conclusi"/);
  const js = w("pt.js");
  assert.match(js, /filter\(\(c\) => !c\.rapporto_finito_il\)/);
  assert.match(js, /Rapporto concluso \(\$\{conclusi\.length\}\)/);
  assert.match(js, /if \(q && conclusi\.length\) tendina\.open = true/);
});

test("la bozza in corso si vede nell'elenco e nella pagina del cliente", () => {
  const w = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "web", f), "utf8");
  assert.match(w("pt-comune.js"), /lena:bozza:\$\{idCliente\}/);
  assert.match(w("pt.js"), /LenaPt\.haBozza\(c\.id\)/);
  assert.match(w("pt-cliente.js"), /LenaPt\.haBozza\(id\)/);
  assert.match(w("pt-cliente.html"), /id="bozza-nota"/);
  // stessa chiave dell'editor: se una cambia e l'altra no, il segno sparisce in silenzio
  assert.match(w("pt-editor.js"), /`lena:bozza:\$\{idCliente\}`/);
});
