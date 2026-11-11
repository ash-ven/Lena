// L'elenco di partenza degli esercizi (senza database).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ESERCIZI } = require("../catalogo-esercizi");
const { chiaveNome, CATALOGO } = require("../libreria");

test("catalogo: nomi puliti, unici e non troppo lunghi", () => {
  assert.ok(ESERCIZI.length >= 1200, `ne servono almeno 1200, ce ne sono ${ESERCIZI.length}`);
  for (const n of ESERCIZI) {
    assert.equal(typeof n, "string");
    assert.equal(n, n.trim().replace(/\s+/g, " "), `spazi in «${n}»`);
    assert.ok(n.length >= 2 && n.length <= 100, `lunghezza di «${n}»`);
    assert.ok(!/[\u0000-\u001F\u007F<>]/.test(n), `caratteri strani in «${n}»`);
  }
  assert.equal(new Set(ESERCIZI.map(chiaveNome)).size, ESERCIZI.length, "due nomi uguali a parte maiuscole e accenti");
  assert.equal(CATALOGO.length, ESERCIZI.length);
});

test("catalogo: ci sono gli esercizi e le macchine che un trainer si aspetta", () => {
  const chiavi = new Set(ESERCIZI.map(chiaveNome));
  for (const n of ["Hip thrust", "Squat bulgaro", "Stacco rumeno", "Lat machine", "Pulley basso", "Leg press", "Leg extension", "Leg curl seduto", "Pec deck",
    "Chest press", "Face pull", "Panca piana con bilanciere", "Trazioni alla sbarra", "Plank", "Kettlebell swing", "Burpees", "Abductor machine", "Adductor machine", "Cyclette", "Tapis roulant"])
    assert.ok(chiavi.has(chiaveNome(n)), `manca ${n}`);
});
