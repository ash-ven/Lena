// «Modifica» e «Copia»: dalla scheda già inviata al modulo dell'editor. Senza database.
const path = require("node:path");
const fs = require("node:fs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { statoDaDati } = require("../../web/da-scheda.js");

const esempio = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "esempio", "scheda-esempio.json"), "utf8"));
const leggi = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "web", f), "utf8");

test("la scheda di esempio diventa un modulo completo, con inizio da oggi", () => {
  const dati = esempio.dati || esempio;
  const s = statoDaDati(dati, "2030-01-02");
  assert.equal(s.inizio, "2030-01-02");
  assert.equal(s.settimane, String(dati.settimane));
  assert.equal(s.giorni.length, dati.giorni.length);
  assert.equal(s.risc.esercizi.length, dati.riscaldamento.esercizi.length);
  dati.giorni.forEach((g, n) => assert.equal(s.giorni[n].blocchi.length, g.blocchi.length));
  for (const g of s.giorni) for (const b of g.blocchi) {
    if (b.tipo === "esercizio") { assert.ok(Array.isArray(b.schema)); assert.equal(typeof b.nome, "string"); }
    else { assert.match(b.formato, /^(EMOM|AMRAP)$/); assert.ok(b.esercizi.length >= 1); }
  }
});

test("schema per settimana, scarico, circuito e stretching si ricostruiscono", () => {
  const dati = {
    inizio: "2026-01-05", settimane: 5,
    info: { titolo: "T", nome: "A", cognome: "B", obiettivo: "O", sedute: 1, nota_durata: "4 settimane + 1 di scarico" },
    riscaldamento: { voce: "Riscaldamento", durata: "10'", istruzione: "i", esercizi: [["Cat-cow", "https://x.it/v"], ["Ponte", null]] },
    giorni: [{ id: "A", titolo: "Giorno A", focus: "Gambe", stretching: ["Stretching", "5'"], blocchi: [
      { tipo: "esercizio", nome: "Squat", serie: "4", rip: "10", rec: "/", video: null, note: null, schema: ["4x10", "4x8", "5x5", "3x12"], progressione: null },
      { tipo: "esercizio", nome: "Plank", serie: "3", rip: "30s", rec: "1'", video: null, note: "n", schema: null, progressione: "+5s" },
      { tipo: "circuito", formato: "AMRAP 12'", rec: null, esercizi: [{ nome: "Burpee", rip: "10", video: null }] }] }],
  };
  const s = statoDaDati(dati, "2030-01-02");
  assert.equal(s.scarico, "1");
  assert.deepEqual(s.risc.esercizi, [{ nome: "Cat-cow", video: "https://x.it/v" }, { nome: "Ponte", video: "" }]);
  const [squat, plank, circ] = s.giorni[0].blocchi;
  assert.equal(squat.perSettimana, true);
  assert.deepEqual(squat.schema, ["4x10", "4x8", "5x5", "3x12"]);
  assert.equal(squat.rec, "");
  assert.equal(plank.perSettimana, false);
  assert.equal(plank.schema.length, 4);
  assert.equal(plank.progressione, "+5s");
  assert.equal(circ.formato, "AMRAP"); assert.equal(circ.minuti, "12");
  assert.equal(s.giorni[0].stretching, true); assert.equal(s.giorni[0].stretchingDurata, "5'");
});

test("uno schema più corto delle settimane (come da Excel) si completa con l'ultimo valore", () => {
  const dati = JSON.parse(JSON.stringify(esempio.dati || esempio));
  const s = statoDaDati(dati, "2030-01-02");
  const sq = s.giorni[0].blocchi.find((b) => b.nome === "Squat con bilanciere");
  assert.deepEqual(sq.schema, ["4x10", "4x10", "4x10", "4x10"]);
});

test("l'editor, la pagina cliente e la scelta cliente sono collegati", () => {
  assert.match(leggi("pt-editor.html"), /da-scheda\.js/);
  assert.match(leggi("pt-editor.js"), /LenaDaScheda\.statoDaDati/);
  assert.match(leggi("pt-editor.js"), /\/api\/schede\/\$\{idBase\}/);
  assert.match(leggi("pt-cliente.js"), /Modifica \(nuova versione\)/);
  assert.match(leggi("pt-cliente.js"), /pt\.html\?copia=/);
  assert.match(leggi("pt.js"), /&base=\$\{copiaDa\}/);
});
