// Test del convertitore Excel → scheda (web/convertitore.js) con file .xlsx veri, creati in memoria.
// Un file buono e una serie di file "rotti" (uno per difetto): gli avvisi e i blocchi devono funzionare.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { XLSX, righeBuone, xlsxDaRighe, xlsxBuono, data } = require("./excel-di-prova");
const { convertiXlsx } = require("../../web/convertitore.js");
const { erroreScheda } = require("../../web/valida-scheda.js");

const converti = (buffer) => convertiXlsx(XLSX, buffer);
const daOpzioni = (opz) => converti(xlsxBuono(opz));
// Una scheda si può inviare solo se il convertitore la costruisce E il validatore (lo stesso del server) la accetta
const bloccata = (r) => r.dati === null || erroreScheda(r.dati) !== null;

test("Excel buono: scheda completa, nessun avviso, accettata dal validatore del server", () => {
  const r = daOpzioni({});
  assert.deepEqual(r.avvisi, []);
  assert.equal(erroreScheda(r.dati), null);
  const d = r.dati;
  assert.equal(d.inizio, "2026-11-02");
  assert.equal(d.settimane, 5, "4 colonne settimana + 1 di scarico");
  assert.deepEqual(d.info, { titolo: "Programma forza e tonificazione", nome: "Asiha", cognome: "Venturi", obiettivo: "Tonificazione", sedute: 2, nota_durata: "4 settimane + 1 di scarico" });
  assert.deepEqual(d.giorni.map((g) => [g.id, g.focus, g.blocchi.length, !!g.stretching]), [["A", "Gambe e glutei", 3, true], ["B", "Parte alta", 2, true]]);
  const squat = d.giorni[0].blocchi[0];
  assert.equal(squat.nome, "Squat con bilanciere");
  assert.equal(squat.serie, "4"); assert.equal(squat.rip, "10"); assert.equal(squat.rec, "1'30\"");
  assert.deepEqual(squat.schema, ["4x10"]);
  assert.equal(squat.progressione, "+2,5 kg a settimana se chiudi tutte le serie");
  assert.equal(squat.video, "https://example.com/squat");
  assert.equal(d.giorni[0].blocchi[2].tipo, "circuito");
  assert.deepEqual(d.giorni[0].blocchi[2].esercizi.map((e) => e.nome), ["Kettlebell swing", "Salti sul box"]);
  assert.deepEqual(d.riscaldamento.esercizi, [["Jumping jack", null], ["Cat cow", "https://example.com/catcow"]]);
  assert.equal(d.giorni[0].colore, "D49A9A", "i colori dei giorni li sceglie il convertitore");
});

test("senza data di inizio la scheda è BLOCCATA (dati null) con un avviso chiaro", () => {
  for (const inizio of [null, "26 ottobre", "2026-11-02"]) {   // vuota, testo, testo che sembra una data: non sono date vere
    const r = daOpzioni({ inizio });
    assert.equal(r.dati, null, `inizio=${inizio}`);
    assert.match(r.avvisi[0], /Non trovo la data di inizio/);
    assert.ok(bloccata(r));
  }
});

test("senza nessun giorno la scheda è bloccata (il validatore la rifiuta) e c'è un avviso", () => {
  const r = daOpzioni({ senzaGiorni: true });
  assert.ok(r.avvisi.some((a) => /Non trovo nessun giorno/.test(a)));
  assert.ok(bloccata(r));
});

test("avvisi NON bloccanti: la scheda c'è ed è valida, ma il PT deve essere avvisato", () => {
  const casi = [
    [{ sedute: 3 }, /dice 3 sedute a settimana, ma ho trovato 2 giorni/],
    [{ fine: data(2026, 12, 20) }, /Date: 5 settimane da 2026-11-02 finiscono il 2026-12-06, ma l'Excel dice 2026-12-20/],
    [{ serieSquat: "3-4" }, /non è un numero: la scheda non mostrerà i pallini/],
    [{ serieSquat: "" }, /non ha serie o ripetizioni/],
  ];
  for (const [opz, atteso] of casi) {
    const r = daOpzioni(opz);
    assert.ok(r.dati, JSON.stringify(opz));
    assert.ok(r.avvisi.some((a) => atteso.test(a)), `${JSON.stringify(opz)} → ${JSON.stringify(r.avvisi)}`);
    assert.equal(erroreScheda(r.dati), null, "la scheda si può comunque inviare");
  }
});

test("manca la riga «Stretching» che chiude il giorno: avviso", () => {
  const righe = righeBuone();
  righe.splice(righe.findIndex((r) => r[0] === "Stretching"), 1);
  const r = converti(xlsxDaRighe(righe));
  assert.ok(r.dati);
  assert.ok(r.avvisi.some((a) => /manca la riga «Stretching»/.test(a)), JSON.stringify(r.avvisi));
});

test("riga con contenuto ma senza nome dell'esercizio: saltata, con avviso", () => {
  const righe = righeBuone();
  righe.splice(13, 0, [null, "3", "10", "1'"]);
  const r = converti(xlsxDaRighe(righe, { unioni: [{ s: { r: 11, c: 5 }, e: { r: 11, c: 11 } }] }));
  assert.ok(r.avvisi.some((a) => /manca il nome dell'esercizio, l'ho saltata/.test(a)), JSON.stringify(r.avvisi));
});

test("file che non è un Excel o è vuoto: nessuna scheda e nessun crash non gestito", () => {
  for (const contenuto of [Buffer.from("questo non è un file excel"), Buffer.alloc(0), Buffer.from([0, 1, 2, 3, 255])]) {
    let r;
    try { r = converti(contenuto); } catch (e) { r = { errore: e.message }; }
    assert.ok(r.errore || r.dati === null || bloccata(r), "o lancia un errore (che la pagina mostra) o la scheda è bloccata");
  }
});

test("intestazione (nome, cognome, titolo) vuota: non compare il testo «null» o «undefined»", () => {
  const r = daOpzioni({ nome: null, cognome: null, obiettivo: null, titolo: null });
  assert.ok(r.dati);
  for (const campo of ["nome", "cognome", "obiettivo", "titolo"]) {
    assert.ok(!/^(null|undefined)$/.test(String(r.dati.info[campo])), `info.${campo} = ${r.dati.info[campo]}`);
  }
});

test("testo con codice HTML/JavaScript nell'Excel: arriva nei dati come testo qualsiasi (non viene toccato né interpretato)", () => {
  const strano = [`<img src=x onerror=alert(1)>`, `"><script>alert(1)</script>`, `<svg/onload=alert(1)>`];
  const r = daOpzioni({ nomeSquat: strano[0], notaHip: strano[1], titolo: strano[2] });
  assert.equal(r.dati.giorni[0].blocchi[0].nome, strano[0]);
  assert.equal(r.dati.giorni[0].blocchi[1].note, strano[1]);
  assert.equal(r.dati.info.titolo, strano[2]);
  assert.equal(erroreScheda(r.dati), null, "sono testi: il server li accetta e li conserva, ed è la pagina a doverli mostrare come testo");
});

test("indirizzi pericolosi nelle celle dei video non diventano video: il convertitore li tratta come note", () => {
  const righe = righeBuone();
  righe[12][5] = "javascript:alert(1)";   // l'Hip thrust: una cella con un indirizzo non http(s)
  const r = converti(xlsxDaRighe(righe));
  const hip = r.dati.giorni[0].blocchi[1];
  assert.equal(hip.video, null);
  assert.equal(erroreScheda(r.dati), null);
});

test("il validatore rifiuta indirizzi non http(s) anche se arrivano da un invio manomesso", () => {
  const d = daOpzioni({}).dati;
  d.giorni[0].blocchi[0].video = "javascript:alert(1)";
  assert.match(erroreScheda(d), /video/);
  d.giorni[0].blocchi[0].video = "https://example.com/ok";
  d.riscaldamento.esercizi[1][1] = "data:text/html,<script>1</script>";
  assert.match(erroreScheda(d), /riscaldamento/);
});

test("lo stesso Excel dà lo stesso risultato ad ogni lettura", () => {
  const b = xlsxBuono({});
  assert.deepEqual(converti(b), converti(b));
});
