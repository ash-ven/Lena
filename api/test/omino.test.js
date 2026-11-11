// L'omino a fine scheda: conteggi, livelli e completezza dei disegni. Non servono dati nel database.
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Omino = require("../../web/omino.js");
const Dati = require("../../web/omino-dati.js");
const { MUSCOLI } = require("../../web/muscoli.js");

const WEB = path.join(__dirname, "..", "..", "web");
const leggi = (f) => fs.readFileSync(path.join(WEB, f), "utf8");
const es = (nome) => ({ tipo: "esercizio", nome, serie: "3", rip: "10", rec: "60" });

test("ci sono le quattro figure (uomo e donna, davanti e dietro), ognuna con immagine e sagoma", () => {
  for (const c of ["m-davanti", "m-dietro", "f-davanti", "f-dietro"]) {
    assert.ok(Dati[c], c);
    for (const f of [`omino/${c}.webp`, `omino/${c}-sagoma.png`]) assert.ok(fs.existsSync(path.join(WEB, f)), f);
    assert.ok(Dati[c].w > 300 && Dati[c].w <= 402 && Dati[c].h === 1024, `${c}: misure`);
    assert.ok(Dati[c].cx > 100 && Dati[c].cx < Dati[c].w);
  }
});

test("ogni tracciato appartiene a un muscolo che esiste", () => {
  const ids = new Set(MUSCOLI.map((m) => m.id));
  for (const [c, f] of Object.entries(Dati)) {
    for (const [m, tracciati] of Object.entries(f.parti)) {
      assert.ok(ids.has(m), `${c}: «${m}» non è un muscolo di muscoli.js`);
      assert.ok(tracciati.length >= 1 && tracciati.every((d) => /^M[\d.,LC -]+Z$/.test(d)), `${c}/${m}: tracciato non valido`);
    }
  }
});

test("tutti e 19 i muscoli si vedono in almeno una vista, per l'uomo e per la donna", () => {
  for (const sesso of ["m", "f"]) {
    const visti = new Set([...Omino.muscoliVisibili(`${sesso}-davanti`), ...Omino.muscoliVisibili(`${sesso}-dietro`)]);
    for (const m of MUSCOLI) assert.ok(visti.has(m.id), `${sesso}: «${m.id}» non si vede da nessuna parte`);
  }
});

test("conteggi: contano gli esercizi dei blocchi e dei circuiti, non riscaldamento e stretching", () => {
  const giorni = [{
    id: "A", titolo: "Giorno A", stretching: ["Stretching", "5'"], riscaldamento: { esercizi: [["Squat", ""]] },
    blocchi: [es("Panca piana"), es("Croci ai cavi"), es("Squat"),
      { tipo: "circuito", formato: "EMOM 10'", rec: "/", esercizi: [{ nome: "Plank" }, { nome: "Panca piana" }] }],
  }];
  const n = Omino.conteggi(giorni);
  assert.equal(n.petto, 3, "panca, croci e panca nel circuito");
  assert.equal(n.quadricipiti, 1, "solo lo squat dei blocchi, non quello del riscaldamento");
  assert.equal(n.addome, 1);
  assert.equal(n.polpacci, undefined);
  assert.deepEqual(Omino.conteggi([]), {});
  assert.deepEqual(Omino.conteggi(undefined), {});
});

test("più esercizi sullo stesso muscolo = più luminoso", () => {
  const poco = Omino.livelli({ petto: 1, dorsali: 3 }, false);
  assert.ok(poco.dorsali > poco.petto);
  assert.deepEqual(Omino.livelli({ petto: 1, bicipiti: 2, tricipiti: 3, glutei: 4, femorali: 5, addome: 9 }, false),
    { petto: 1, bicipiti: 2, tricipiti: 3, glutei: 4, femorali: 5, addome: Omino.LIVELLI });
});

test("tutta la scheda: i livelli sono relativi al muscolo più allenato, da 1 a 5", () => {
  const l = Omino.livelli({ petto: 12, dorsali: 6, bicipiti: 1 }, true);
  assert.equal(l.petto, Omino.LIVELLI);
  assert.ok(l.dorsali > l.bicipiti);
  assert.equal(l.bicipiti, 1);
  for (const v of Object.values(l)) assert.ok(v >= 1 && v <= Omino.LIVELLI);
});

test("l'omino è collegato alla scheda del sito, non a quella scaricabile", () => {
  assert.match(leggi("scheda.html"), /href="\/omino\.css"/);
  const srv = leggi("scheda-server.js");
  for (const f of ["/muscoli.js", "/omino-dati.js", "/omino.js"]) assert.ok(srv.includes(f), `scheda-server.js non carica ${f}`);
  assert.doesNotMatch(leggi("scheda.js"), /omino/i, "scheda.js (usata anche dalla scheda scaricabile) non deve conoscere l'omino");
});

test("omino.js e omino.css: niente colori scritti a mano, niente innerHTML", () => {
  const colore = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
  assert.doesNotMatch(leggi("omino.css"), colore, "omino.css ha un colore scritto a mano");
  assert.doesNotMatch(leggi("omino.js"), colore, "omino.js ha un colore scritto a mano");
  assert.doesNotMatch(leggi("omino.js"), /innerHTML|eval\(|new Function/);
});
