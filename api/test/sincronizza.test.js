// Test del motore di sincronizzazione (web/sincronizza.js) e della traduzione dei dati (web/registrazioni.js).
// Non servono né il database né il server: rete, orologio e memoria sono finti, quindi girano in un attimo.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const R = require("../../web/registrazioni.js");
const { creaSincronizzatore, ATTESE_RITENTATIVO } = require("../../web/sincronizza.js");

// ---------- gli strumenti finti ----------

// Un orologio che avanza solo quando glielo diciamo
function orologioFinto() {
  let ora = 0, prossimoId = 1;
  const programmati = new Map();
  return {
    setTimeout(f, ms) { const id = prossimoId++; programmati.set(id, { quando: ora + ms, f }); return id; },
    clearTimeout(id) { programmati.delete(id); },
    async avanza(ms) {
      const fine = ora + ms;
      for (;;) {
        const pronti = [...programmati].filter(([, t]) => t.quando <= fine).sort((a, b) => a[1].quando - b[1].quando);
        if (!pronti.length) break;
        const [id, t] = pronti[0];
        programmati.delete(id); ora = t.quando; t.f();
        await tutto();
      }
      ora = fine;
      await tutto();
    },
    inAttesa: () => programmati.size,
  };
}
// lascia finire tutte le operazioni asincrone già avviate
const tutto = async () => { for (let i = 0; i < 20; i++) await new Promise((ok) => setImmediate(ok)); };

// Un "server" finto: risponde con gli stati che gli diciamo e ricorda cosa ha ricevuto
function reteFinta(risposte = []) {
  const richieste = [];
  const coda = [...risposte];
  const chiama = async (metodo, url, corpo) => {
    richieste.push({ metodo, url, voci: corpo.voci });
    const stato = coda.length ? coda.shift() : 200;
    return { stato, json: stato === 200 ? { salvate: corpo.voci.length, cancellate: 0 } : { errore: "x" } };
  };
  return { chiama, richieste, accoda: (...s) => coda.push(...s) };
}
const memoriaFinta = (iniziale = null) => { let dato = iniziale; return { leggi: () => dato, scrivi: (v) => { dato = v; }, dato: () => dato }; };

function nuovo({ confermato = [], rete = reteFinta(), memoria = memoriaFinta(), inLinea = () => true, orologio = orologioFinto() } = {}) {
  const stati = [];
  let scaduta = 0;
  const s = creaSincronizzatore({
    schedaId: 7, confermato, chiama: rete.chiama, memoria, timer: orologio, inLinea,
    segnala: (x) => stati.push(x), sessioneScaduta: () => { scaduta++; },
  });
  return { s, rete, memoria, orologio, stati, scaduta: () => scaduta, ultimo: () => stati[stati.length - 1] };
}
const memConKg = (kg) => ({ kg, rip: {}, fatti: {}, serie: {} });

// ---------- traduzione dei dati ----------

test("registrazioni: andata e ritorno tra righe del database e oggetto della scheda", () => {
  const righe = [
    { tipo: "kg", chiave: "1|A|1", valore: "42,5" }, { tipo: "rip", chiave: "1|A|1", valore: "10-10-9" },
    { tipo: "serie", chiave: "1|A|1", valore: "3" }, { tipo: "fatto", chiave: "1|A|S", valore: "1" },
  ];
  const mem = R.memDaMappa(R.mappaDaVoci(righe));
  assert.deepEqual(mem, { kg: { "1|A|1": "42,5" }, rip: { "1|A|1": "10-10-9" }, fatti: { "1|A|S": 1 }, serie: { "1|A|1": 3 } });
  assert.equal(typeof mem.serie["1|A|1"], "number", "le serie devono tornare NUMERI (serie + 1 non deve dare «31»)");
  assert.equal(R.differenze(R.mappaDaMem(mem), R.mappaDaVoci(righe)).size, 0, "nessuna differenza dopo il giro completo");
});

test("registrazioni: le voci vuote o a zero non esistono; le cancellazioni diventano valore vuoto", () => {
  const attuale = R.mappaDaMem({ kg: { "1|A|1": "  ", "2|A|1": " 50 " }, rip: {}, fatti: { "1|A|1": 0 }, serie: { "1|A|1": 0 } });
  assert.deepEqual([...attuale], [["kg|2|A|1", "50"]]);
  const d = R.differenze(attuale, R.mappaDaVoci([{ tipo: "kg", chiave: "9|A|1", valore: "20" }]));
  assert.deepEqual([...d].sort(), [["kg|2|A|1", "50"], ["kg|9|A|1", ""]].sort());
});

test("registrazioni: blocchi da al massimo 200 voci", () => {
  const diff = new Map(Array.from({ length: 450 }, (_, i) => [`kg|1|A|${i}`, "1"]));
  assert.deepEqual(R.inBlocchi(diff, 200).map((b) => b.length), [200, 200, 50]);
  assert.deepEqual(R.inBlocchi(new Map()), []);
  assert.deepEqual(R.inBlocchi(new Map([["kg|1|A|1", "5"]]))[0][0], { tipo: "kg", chiave: "1|A|1", valore: "5" });
});

// ---------- il motore ----------

test("sincronizza: aspetta 1 secondo di quiete e manda UNA richiesta per tutte le modifiche", async () => {
  const t = nuovo();
  t.s.caricaMem();
  t.s.cambiato(memConKg({ "1|A|1": "4" }));
  await t.orologio.avanza(600);
  t.s.cambiato(memConKg({ "1|A|1": "40" }));       // ancora una modifica: l'attesa riparte
  await t.orologio.avanza(600);
  assert.equal(t.rete.richieste.length, 0, "dopo 1,2 secondi dalla prima ma 0,6 dall'ultima: non ha ancora inviato");
  t.s.cambiato(memConKg({ "1|A|1": "42", "2|A|1": "30" }));
  await t.orologio.avanza(1000);
  assert.equal(t.rete.richieste.length, 1);
  assert.equal(t.rete.richieste[0].url, "/api/schede/7/registrazioni");
  assert.deepEqual(t.rete.richieste[0].voci.map((v) => `${v.tipo} ${v.chiave}=${v.valore}`).sort(), ["kg 1|A|1=42", "kg 2|A|1=30"]);
  assert.equal(t.ultimo(), "salvato");
  assert.equal(t.memoria.dato(), null, "a invio riuscito la copia di riserva si svuota");
  assert.equal(t.s.inSospeso(), 0);
});

test("sincronizza: una modifica annullata prima dell'invio non manda niente", async () => {
  const t = nuovo({ confermato: [{ tipo: "kg", chiave: "1|A|1", valore: "40" }] });
  t.s.caricaMem();
  t.s.cambiato(memConKg({ "1|A|1": "45" }));
  t.s.cambiato(memConKg({ "1|A|1": "40" }));     // tornato com'era
  await t.orologio.avanza(5000);
  assert.equal(t.rete.richieste.length, 0);
  assert.equal(t.ultimo(), "salvato");
});

test("sincronizza: svuotare un campo cancella la voce (valore vuoto)", async () => {
  const t = nuovo({ confermato: [{ tipo: "kg", chiave: "1|A|1", valore: "40" }, { tipo: "fatto", chiave: "1|A|1", valore: "1" }] });
  const mem = t.s.caricaMem();
  assert.deepEqual(mem.fatti, { "1|A|1": 1 });
  t.s.cambiato({ kg: {}, rip: {}, fatti: { "1|A|1": 1 }, serie: {} });
  await t.orologio.avanza(1000);
  assert.deepEqual(t.rete.richieste[0].voci, [{ tipo: "kg", chiave: "1|A|1", valore: "" }]);
});

test("sincronizza: oltre 200 voci le divide in più richieste, ognuna con al massimo 200", async () => {
  const t = nuovo();
  t.s.caricaMem();
  const kg = {};
  for (let i = 0; i < 450; i++) kg[`1|A|${i}`] = String(i + 1);
  t.s.cambiato(memConKg(kg));
  await t.orologio.avanza(1000);
  assert.deepEqual(t.rete.richieste.map((r) => r.voci.length), [200, 200, 50]);
  assert.equal(t.s.inSospeso(), 0);
});

test("sincronizza: senza rete tiene le modifiche, segnala «attesa» e riprova con attese crescenti", async () => {
  const rete = reteFinta([0, 0, 0]);        // tre tentativi senza rete, poi tutto bene
  const t = nuovo({ rete });
  t.s.caricaMem();
  t.s.cambiato(memConKg({ "1|A|1": "40" }));
  await t.orologio.avanza(1000);            // 1° tentativo: fallisce
  assert.equal(t.rete.richieste.length, 1);
  assert.equal(t.ultimo(), "attesa");
  assert.deepEqual(t.memoria.dato(), { "kg|1|A|1": "40" }, "la modifica è al sicuro nella memoria del browser");

  await t.orologio.avanza(ATTESE_RITENTATIVO[0] - 1);
  assert.equal(t.rete.richieste.length, 1, "non riprova prima del tempo");
  await t.orologio.avanza(1);               // 2° tentativo dopo 2 s: fallisce
  assert.equal(t.rete.richieste.length, 2);
  await t.orologio.avanza(ATTESE_RITENTATIVO[1] - 1);
  assert.equal(t.rete.richieste.length, 2, "l'attesa è raddoppiata (4 s)");
  await t.orologio.avanza(1);               // 3° tentativo: fallisce
  assert.equal(t.rete.richieste.length, 3);
  await t.orologio.avanza(ATTESE_RITENTATIVO[2]);   // 4° dopo 8 s: riesce
  assert.equal(t.rete.richieste.length, 4);
  assert.equal(t.ultimo(), "salvato");
  assert.equal(t.memoria.dato(), null);
  assert.equal(t.orologio.inAttesa(), 0, "finito: niente più tentativi in programma");
});

test("sincronizza: l'attesa tra i tentativi si ferma a 60 secondi", async () => {
  const rete = reteFinta(new Array(50).fill(503));    // il server resta in errore per un bel po'
  const t = nuovo({ rete });
  t.s.caricaMem();
  t.s.cambiato(memConKg({ "1|A|1": "40" }));
  await t.orologio.avanza(1000);
  // le attese crescono (2, 4, 8, 16, 32 secondi) finché si arriva al tetto di 60
  while (t.rete.richieste.length < ATTESE_RITENTATIVO.length + 1) await t.orologio.avanza(1000);
  for (let giro = 0; giro < 3; giro++) {
    const prima = t.rete.richieste.length;
    await t.orologio.avanza(59000);
    assert.equal(t.rete.richieste.length, prima, "nei 59 secondi dopo un tentativo non ne parte un altro");
    await t.orologio.avanza(1000);
    assert.equal(t.rete.richieste.length, prima + 1, "al 60° secondo riprova, non prima e non molto dopo");
  }
  assert.equal(t.ultimo(), "attesa");
});

test("sincronizza: quando torna la rete (evento «online») invia subito, senza aspettare", async () => {
  let rete = false;
  const t = nuovo({ inLinea: () => rete });
  t.s.caricaMem();
  t.s.cambiato(memConKg({ "1|A|1": "40" }));
  await t.orologio.avanza(1000);
  assert.equal(t.rete.richieste.length, 0, "offline: non prova nemmeno a chiamare");
  assert.equal(t.ultimo(), "attesa");
  rete = true;
  const fatto = await t.s.sincronizzaOra();
  assert.equal(fatto, true);
  assert.equal(t.rete.richieste.length, 1);
  assert.equal(t.ultimo(), "salvato");
});

test("sincronizza: errore del server (500) → riprova; poi riesce", async () => {
  const t = nuovo({ rete: reteFinta([500]) });
  t.s.caricaMem();
  t.s.cambiato(memConKg({ "1|A|1": "40" }));
  await t.orologio.avanza(1000);
  assert.equal(t.ultimo(), "attesa");
  await t.orologio.avanza(ATTESE_RITENTATIVO[0]);
  assert.equal(t.ultimo(), "salvato");
});

test("sincronizza: sessione scaduta (401) → non perde niente, avvisa la pagina e non insiste", async () => {
  const t = nuovo({ rete: reteFinta([401]) });
  t.s.caricaMem();
  t.s.cambiato(memConKg({ "1|A|1": "40" }));
  await t.orologio.avanza(1000);
  assert.equal(t.scaduta(), 1, "la pagina viene avvisata (manderà al login)");
  assert.deepEqual(t.memoria.dato(), { "kg|1|A|1": "40" }, "la modifica resta salvata sul dispositivo");
  await t.orologio.avanza(120000);
  assert.equal(t.rete.richieste.length, 1, "non insiste con una sessione che non vale più");
});

test("sincronizza: dopo il nuovo login le modifiche rimaste in sospeso vengono inviate", async () => {
  // «prima»: modifica fatta, sessione scaduta
  const memoria = memoriaFinta();
  const prima = nuovo({ rete: reteFinta([401]), memoria, confermato: [{ tipo: "kg", chiave: "9|A|1", valore: "20" }] });
  prima.s.caricaMem();
  prima.s.cambiato({ kg: { "9|A|1": "20", "1|A|1": "40" }, rip: {}, fatti: { "1|A|1": 1 }, serie: { "1|A|1": 2 } });
  await prima.orologio.avanza(1000);
  assert.equal(prima.scaduta(), 1);

  // «dopo»: la pagina si riapre, il server ha ancora i vecchi dati, ma la memoria del browser ha le modifiche
  const dopo = nuovo({ memoria, confermato: [{ tipo: "kg", chiave: "9|A|1", valore: "20" }] });
  const mem = dopo.s.caricaMem();
  assert.deepEqual(mem, { kg: { "9|A|1": "20", "1|A|1": "40" }, rip: {}, fatti: { "1|A|1": 1 }, serie: { "1|A|1": 2 } },
    "la scheda riparte con le modifiche non ancora inviate, non con i dati vecchi del server");
  await dopo.orologio.avanza(0);
  assert.equal(dopo.rete.richieste.length, 1);
  assert.deepEqual(dopo.rete.richieste[0].voci.map((v) => `${v.tipo}:${v.chiave}=${v.valore}`).sort(), ["fatto:1|A|1=1", "kg:1|A|1=40", "serie:1|A|1=2"]);
  assert.equal(dopo.ultimo(), "salvato");
  assert.equal(memoria.dato(), null);
});

test("sincronizza: una cancellazione rimasta in sospeso si applica anche dopo la riapertura", async () => {
  const memoria = memoriaFinta({ "kg|1|A|1": "" });
  const t = nuovo({ memoria, confermato: [{ tipo: "kg", chiave: "1|A|1", valore: "40" }] });
  assert.deepEqual(t.s.caricaMem().kg, {}, "il kg cancellato non ricompare");
  await t.orologio.avanza(0);
  assert.deepEqual(t.rete.richieste[0].voci, [{ tipo: "kg", chiave: "1|A|1", valore: "" }]);
});

test("sincronizza: dati rovinati nella memoria del browser vengono ignorati", async () => {
  const memoria = memoriaFinta({ "kg|1|A|1": 5, "boh|x": "1", "senzaseparatore": "1", "fatto|1|A|1": "1" });
  const t = nuovo({ memoria });
  const mem = t.s.caricaMem();
  assert.deepEqual(mem, { kg: {}, rip: {}, fatti: { "1|A|1": 1 }, serie: {} });
});

test("sincronizza: il server rifiuta una voce (400) → le altre passano, quella sbagliata si scarta e non si riprova", async () => {
  // il blocco da 3 voci viene rifiutato; poi una a una: la 1ª ok, la 2ª rifiutata, la 3ª ok
  const rifiutate = [];
  const rete = reteFinta([400, 200, 400, 200]);
  const stati = [];
  const orologio = orologioFinto();
  const s = creaSincronizzatore({ schedaId: 7, confermato: [], chiama: rete.chiama, memoria: memoriaFinta(), timer: orologio,
    segnala: (x) => stati.push(x), sessioneScaduta() {}, suRifiutata: (v) => rifiutate.push(v.chiave) });
  s.caricaMem();
  s.cambiato(memConKg({ "1|A|1": "10", "1|A|2": "20", "1|A|3": "30" }));
  await orologio.avanza(1000);
  assert.equal(rete.richieste.length, 4);
  assert.deepEqual(rifiutate, ["1|A|2"]);
  assert.equal(stati[stati.length - 1], "salvato");
  assert.equal(s.inSospeso(), 0);
  await orologio.avanza(120000);
  assert.equal(rete.richieste.length, 4, "nessun nuovo tentativo");
});

test("sincronizza: scheda non più accessibile (404) → errore definitivo, nessun tentativo ripetuto", async () => {
  const t = nuovo({ rete: reteFinta([404]) });
  t.s.caricaMem();
  t.s.cambiato(memConKg({ "1|A|1": "40" }));
  await t.orologio.avanza(1000);
  assert.equal(t.ultimo(), "definitivo");
  await t.orologio.avanza(300000);
  assert.equal(t.rete.richieste.length, 1);
});

test("sincronizza: modifiche fatte mentre l'invio è in corso vengono inviate subito dopo", async () => {
  let sblocca;
  const richieste = [];
  const chiama = async (m, u, corpo) => { richieste.push(corpo.voci); if (richieste.length === 1) await new Promise((ok) => { sblocca = ok; }); return { stato: 200, json: {} }; };
  const orologio = orologioFinto();
  const s = creaSincronizzatore({ schedaId: 7, confermato: [], chiama, memoria: memoriaFinta(), timer: orologio, segnala() {}, sessioneScaduta() {} });
  s.caricaMem();
  s.cambiato(memConKg({ "1|A|1": "10" }));
  await orologio.avanza(1000);                       // primo invio parte e resta in attesa di risposta
  s.cambiato(memConKg({ "1|A|1": "10", "1|A|2": "20" }));   // intanto una nuova modifica
  sblocca(); await tutto();
  await orologio.avanza(1000);
  assert.equal(richieste.length, 2);
  assert.deepEqual(richieste[1], [{ tipo: "kg", chiave: "1|A|2", valore: "20" }], "la seconda richiesta contiene solo la novità");
  assert.equal(s.inSospeso(), 0);
});
