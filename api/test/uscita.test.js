// Uscita da un dispositivo condiviso: dopo «Esci» confermato la copia locale dei progressi non c'è più e non parte più nessun invio.
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { creaSincronizzatore } = require("../../web/sincronizza.js");

const tutto = async () => { for (let i = 0; i < 10; i++) await new Promise((ok) => setImmediate(ok)); };
function nuovo(confermato = []) {
  const chiamate = [];
  let dato = null;
  const timer = { programmati: new Map(), n: 1, setTimeout(f, ms) { const id = this.n++; this.programmati.set(id, f); return id; }, clearTimeout(id) { this.programmati.delete(id); } };
  const s = creaSincronizzatore({
    schedaId: 7, confermato, timer, segnala() {}, sessioneScaduta() {},
    chiama: async (m, u, corpo) => { chiamate.push(corpo.voci); return { stato: 200, json: {} }; },
    memoria: { leggi: () => dato, scrivi: (v) => { dato = v; } },
  });
  return { s, chiamate, memoria: () => dato, timer };
}
const mem = (kg) => ({ kg, rip: {}, fatti: {}, serie: {} });

test("dimentica(): cancella la copia locale, annulla gli invii in programma e ignora le modifiche successive", async () => {
  const t = nuovo();
  t.s.caricaMem();
  t.s.cambiato(mem({ "1|A|1": "40" }));
  assert.deepEqual(t.memoria(), { "kg|1|A|1": "40" }, "prima di uscire la modifica è copiata sul dispositivo");
  assert.equal(t.timer.programmati.size, 1, "e c'è un invio in programma");

  t.s.dimentica();
  assert.equal(t.memoria(), null, "la copia locale è stata cancellata");
  assert.equal(t.timer.programmati.size, 0, "nessun invio resta in programma");

  t.s.cambiato(mem({ "1|A|1": "99" }));                    // la pagina sta chiudendo: una modifica in ritardo non deve riscrivere la copia
  assert.equal(t.memoria(), null, "una modifica tardiva non ricrea la copia locale");
  await t.s.sincronizzaOra();                               // anche gli eventi di chiusura pagina non inviano più niente
  await tutto();
  assert.equal(t.chiamate.length, 0, "non è partita nessuna richiesta");
});

test("dimentica() dopo un invio fallito (offline): anche la modifica che non era mai partita sparisce dal dispositivo", async () => {
  const chiamate = [];
  let dato = null;
  const timer = { programmati: new Map(), n: 1, setTimeout(f) { const id = this.n++; this.programmati.set(id, f); return id; }, clearTimeout(id) { this.programmati.delete(id); } };
  const s = creaSincronizzatore({
    schedaId: 7, confermato: [], timer, segnala() {}, sessioneScaduta() {}, inLinea: () => false,
    chiama: async () => { chiamate.push(1); return { stato: 0, json: null }; },
    memoria: { leggi: () => dato, scrivi: (v) => { dato = v; } },
  });
  s.caricaMem();
  s.cambiato(mem({ "1|A|1": "40" }));
  const inProgramma = [...timer.programmati.values()];
  timer.programmati.clear();                                // (come l'orologio vero: un timer scattato non c'è più)
  for (const f of inProgramma) f();                         // scatta il tentativo: senza rete non parte e resta in attesa
  await tutto();
  assert.equal(s.inSospeso(), 1);
  assert.deepEqual(dato, { "kg|1|A|1": "40" });
  s.dimentica();
  assert.equal(dato, null);
  assert.equal(timer.programmati.size, 0);
});

test("il codice della scheda: Esci avvisa con la frase prevista, cancella le copie dell'utente e non esce se manca la rete", () => {
  const web = path.join(__dirname, "..", "..", "web");
  const sv = fs.readFileSync(path.join(web, "scheda-server.js"), "utf8");
  assert.match(sv, /Hai modifiche non salvate: se esci ora si perdono/);
  assert.match(sv, /lena:coda:\$\{utente\.id\}:/, "le copie si cancellano per utente");
  assert.match(sv, /sync\.dimentica\(\); cancellaCopieLocali\(\)/);
  const api = fs.readFileSync(path.join(web, "api.js"), "utf8");
  assert.match(api, /async function esci\(dopo\)/);
  assert.match(api, /if \(r\.stato === 0\)/, "senza rete non finge di essere uscito");
});
