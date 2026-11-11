const test = require("node:test");
const assert = require("node:assert/strict");
const { MUSCOLI, ID, muscoliDi } = require("../../web/muscoli.js");
const { ESERCIZI } = require("../catalogo-esercizi.js");

test("ogni regola usa solo muscoli che esistono", () => {
  for (const e of ESERCIZI) for (const m of muscoliDi(e)) assert.ok(ID.has(m), e + " -> " + m);
});

test("da 0 a 3 muscoli principali, senza doppioni", () => {
  for (const e of ESERCIZI) {
    const m = muscoliDi(e);
    assert.ok(m.length <= 3, e);
    assert.equal(new Set(m).size, m.length, e);
  }
});

test("quasi tutto il catalogo ha almeno un muscolo", () => {
  const con = ESERCIZI.filter((e) => muscoliDi(e).length).length;
  assert.ok(con / ESERCIZI.length >= 0.75, "con muscoli: " + con + " su " + ESERCIZI.length);
});

test("controlli a campione", () => {
  const prova = {
    "Squat": ["quadricipiti", "glutei"],
    "Panca piana": ["petto", "tricipiti"],
    "Trazioni alla sbarra": ["dorsali", "bicipiti"],
    "Curl con manubri": ["bicipiti"],
    "Pushdown con corda": ["tricipiti"],
    "Hip thrust": ["glutei"],
    "Plank": ["addome"],
    "Leg curl": ["femorali"],
    "Alzate laterali": ["spalle_laterali"],
    "Alzate frontali con manubri": ["spalle_anteriori"],
    "Face pull": ["spalle_posteriori", "schiena_alta"],
    "Military press": ["spalle_anteriori", "spalle_laterali", "tricipiti"],
    "Calf raise in piedi": ["polpacci"],
    "Cyclette": [],
    "Stretching dei quadricipiti": [],
  };
  for (const [nome, atteso] of Object.entries(prova)) assert.deepEqual(muscoliDi(nome), atteso, nome);
});

test("anche i nomi inventati dal trainer funzionano (maiuscole e accenti)", () => {
  assert.deepEqual(muscoliDi("  SQUAT  "), ["quadricipiti", "glutei"]);
  assert.deepEqual(muscoliDi("Nome mai visto xyz"), []);
  assert.equal(MUSCOLI.length, 19);
});
