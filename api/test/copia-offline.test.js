// La copia della scheda sul telefono (scheda anche senza rete). Non servono dati nel database.
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Modulo = require("../../web/copia-offline.js");
const Sinc = require("../../web/sincronizza.js");

const leggi = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "web", f), "utf8");
const GIORNO = 86400000;
const finta = () => { const d = new Map(); return { getItem: (k) => (d.has(k) ? d.get(k) : null), setItem: (k, v) => d.set(k, String(v)), removeItem: (k) => d.delete(k), d }; };
const DATI = { utenteId: 7, scheda: { id: 3, dati: { info: { titolo: "T" }, settimane: 4, giorni: [{ id: "A", blocchi: [] }] } },
  registrazioni: [{ tipo: "kg", chiave: "1|A|1", valore: "50" }], mood: { mood: "lena", disponibili: [{ id: "lena" }] } };

test("copia: senza che il cliente la attivi non c'è niente", () => {
  const m = finta(), Copia = Modulo.crea(m);
  assert.equal(Copia.vuole(), false);
  assert.equal(Copia.leggi(), null);
  Copia.imposta(true);
  assert.equal(Copia.vuole(), true);
  assert.equal(Copia.leggi(), null, "attivata ma ancora nessuna copia");
});

test("copia: si salva e si rilegge, senza email né altri dati del profilo", () => {
  const m = finta(), Copia = Modulo.crea(m);
  Copia.salva({ ...DATI, email: "a@b.it", nome: "Mario", foto: "x" });
  const c = Copia.leggi();
  assert.equal(c.utenteId, 7);
  assert.equal(c.scheda.id, 3);
  assert.deepEqual(c.registrazioni, DATI.registrazioni);
  const grezzo = m.getItem("lena:copia");
  for (const v of ["a@b.it", "Mario", "foto"]) assert.ok(!grezzo.includes(v), `«${v}» non deve stare nella copia`);
});

test("copia: vale 14 giorni dall'ultima apertura con la rete, poi si cancella da sola", () => {
  const m = finta(), Copia = Modulo.crea(m), t0 = Date.parse("2026-11-11T10:00:00Z");
  Copia.salva(DATI, t0);
  assert.ok(Copia.leggi(t0 + 13 * GIORNO));
  assert.equal(Copia.leggi(t0 + 15 * GIORNO), null);
  assert.equal(m.getItem("lena:copia"), null, "la copia scaduta viene tolta dalla memoria");
  assert.equal(Modulo.GIORNI, 14);
  Copia.salva(DATI, t0);
  assert.equal(Copia.scadenza(Copia.leggi(t0)).toISOString(), "2026-11-25T10:00:00.000Z");
});

test("copia: disattivare o cancellare la toglie subito; una copia rovinata si ignora", () => {
  const m = finta(), Copia = Modulo.crea(m);
  Copia.imposta(true); Copia.salva(DATI);
  Copia.imposta(false);
  assert.equal(Copia.vuole(), false);
  assert.equal(m.getItem("lena:copia"), null);
  m.setItem("lena:copia", "{non è json");
  assert.equal(Copia.leggi(), null);
  m.setItem("lena:copia", JSON.stringify({ v: 1, salvata: new Date().toISOString(), utenteId: "x", scheda: {}, registrazioni: [] }));
  assert.equal(Copia.leggi(), null, "forma sbagliata");
  assert.equal(m.getItem("lena:copia"), null);
});

test("copia: i progressi si aggiornano senza cambiare la data, e solo per la stessa scheda", () => {
  const m = finta(), Copia = Modulo.crea(m), t0 = Date.now() - 2 * GIORNO;
  Copia.salva(DATI, t0);
  assert.equal(Copia.aggiornaRegistrazioni(3, [{ tipo: "fatto", chiave: "1|A|1", valore: "1" }]), true);
  const c = Copia.leggi();
  assert.deepEqual(c.registrazioni, [{ tipo: "fatto", chiave: "1|A|1", valore: "1" }]);
  assert.equal(c.salvata, new Date(t0).toISOString());
  assert.equal(Copia.aggiornaRegistrazioni(99, []), false, "un'altra scheda non si tocca");
});

test("sincronizzatore: confermate() dà le voci che il server ha, per tenere aggiornata la copia", () => {
  const s = Sinc.creaSincronizzatore({ schedaId: 3, confermato: [{ tipo: "kg", chiave: "1|A|1", valore: "50" }, { tipo: "sforzo", chiave: "2|A|1", valore: "3" }],
    chiama: async () => ({ stato: 200 }), memoria: { leggi: () => null, scrivi: () => {} }, segnala: () => {}, inLinea: () => true });
  assert.deepEqual(s.confermate(), [{ tipo: "kg", chiave: "1|A|1", valore: "50" }, { tipo: "sforzo", chiave: "2|A|1", valore: "3" }]);
});

test("la scheda del sito usa la copia solo senza rete e la cancella con «Esci»", () => {
  const srv = leggi("scheda-server.js");
  assert.match(srv, /senzaRete\(me\) \|\| senzaRete\(sch\)\) && \(copia = LenaCopia\.leggi\(\)\)/);
  assert.match(srv, /me\.stato !== 401 && sch\.stato !== 401/, "una sessione scaduta porta al login, non alla copia");
  assert.match(srv, /LenaCopia\.imposta\(false\);\s*\}\);/, "Esci cancella la copia e la scelta");
  assert.match(srv, /if \(LenaCopia\.vuole\(\)\) LenaCopia\.salva/, "con la rete la copia si rinnova solo se il cliente la vuole");
  assert.match(srv, /vecchia\.utenteId !== me\.json\.id\) LenaCopia\.cancella\(\)/, "la copia di un altro account non resta");
  for (const f of ["scheda.html", "benvenuto.html", "index.html"]) assert.match(leggi(f), /src="\/copia-offline\.js"/, f);
  assert.match(leggi("index.js"), /LenaCopia\.leggi\(\)\) \{ location\.replace\("\/scheda\.html"\)/);
  assert.match(leggi("benvenuto.js"), /LenaCopia\.leggi\(\)\) return location\.replace\("\/scheda\.html"\)/);
  assert.match(leggi("privacy.html"), /Scheda anche senza rete/);
});

test("la copia non entra nella scheda scaricabile né nel service worker", () => {
  assert.doesNotMatch(leggi("scheda.js"), /LenaCopia/);
  assert.doesNotMatch(leggi("sw.js"), /copia-offline|lena:copia/);
});
