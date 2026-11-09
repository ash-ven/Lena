// Riempire la libreria dalle schede già salvate: la parte che non ha bisogno del database.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { aggregaSchede } = require("../libreria");
const db = require("../db");
const schedaCon = (...es) => ({ riscaldamento: { esercizi: [] }, giorni: [{ blocchi: es.map(([nome, video]) => ({ tipo: "esercizio", nome, video })) }] });

test("aggregaSchede: nome e video dell'ultima scheda, usi = quante schede, senza dimenticare un video vecchio", () => {
  const t = aggregaSchede([schedaCon(["squat", "https://a.it/v"]), schedaCon(["Squat", null]), schedaCon(["Squat  ", null], ["Plank", null])]);
  const sq = t.get("squat");
  assert.equal(sq.nome, "Squat"); assert.equal(sq.video, "https://a.it/v"); assert.equal(sq.usi, 3);
  assert.equal(t.get("plank").usi, 1);
});

test("lo script e il README esistono e riempi-libreria parte in prova", () => {
  const fs = require("node:fs"), path = require("node:path");
  const s = fs.readFileSync(path.join(__dirname, "..", "riempi-libreria.js"), "utf8");
  assert.match(s, /const esegui = argomenti\.includes\("--esegui"\)/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8"), /riempi-libreria\.js/);
});

test.after(() => db.end());
