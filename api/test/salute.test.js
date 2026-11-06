// Test del controllo "morbido" sui dati di salute (web/parole-salute.js) e della sua integrazione nel convertitore.
// I test descrivono anche i LIMITI: cosa il controllo sa vedere e cosa no.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Salute = require("../../web/parole-salute.js");
const { XLSX, righeBuone, xlsxDaRighe, xlsxBuono } = require("./excel-di-prova");
const { convertiXlsx } = require("../../web/convertitore.js");
const { erroreScheda } = require("../../web/valida-scheda.js");

// ---------- il riconoscimento delle parole ----------

test("riconosce testi che parlano di salute (maiuscole, accenti, apostrofi e plurali non contano)", () => {
  const positivi = [
    ["Ernia del disco L4-L5", "ernia"], ["ERNIA", "ernia"], ["Ho una protrusione lombare", "protrusione"], ["infortunio al ginocchio", "infortunio"],
    ["Infortunata alla spalla", "infortunata"], ["Diabete di tipo 2", "diabete"], ["sono in gravidanza", "gravidanza"], ["Allergia alle noci", "allergia"],
    ["allergie stagionali", "allergie"], ["prende farmaci per la pressione", "farmaci"], ["dopo l'operazione al menisco", "operazione"], ["Sciatica a sinistra", "sciatica"],
    ["Fisioterapista consiglia di evitare", "fisioterapista"], ["tendinite al gomito", "tendinite"], ["PATOLOGIA cardiaca", "patologia"], ["intervento chirurgico recente", "intervento chirurgico"],
    ["problemi di schiena: mal di schiena cronico", "mal di schiena"], ["soffre d'asma", "asma"], ["ipertensione", "ipertensione"], ["post-parto", "post parto"],
  ];
  for (const [testo, atteso] of positivi) {
    const t = Salute.trova(testo);
    assert.ok(t.length >= 1, `non riconosciuto: «${testo}»`);
    assert.ok(t.some((x) => x.includes(atteso.split(" ")[0])), `«${testo}» → ${JSON.stringify(t)}`);
  }
});

test("NON scatta sui testi normali di una scheda di allenamento (pochi falsi positivi)", () => {
  const negativi = [
    "Squat con bilanciere", "Stacco rumeno", "Panca piana", "Hip thrust", "Plank", "Lat machine", "Kettlebell swing", "Salti sul box", "Affondi camminati",
    "Farmer's walk", "Medicine ball slam", "Burpees", "Rotazioni delle spalle", "Cat cow", "Jumping jack", "Alzate laterali", "Leg press", "Crunch inverso",
    "Fai 2 giri senza pausa, ritmo leggero", "Presa larga", "Fermati un secondo in alto", "Schiena dritta, scendi sotto il parallelo", "+2,5 kg a settimana se chiudi tutte le serie",
    "4x10", "1'30\"", "EMOM 10'", "AMRAP 8'", "Stretching", "5-10'", "Tonificazione", "Programma forza e tonificazione", "4 settimane + 1 di scarico",
    "Gambe e glutei", "Parte alta", "Full body", "Respira e tieni la posizione", "Pressione sul tallone", "Palla medica", "Esercizio di mobilità per spalle e anche",
    "Cancellazione dei serbatoi", "Paternia", "Plasma", "Operare con cura sul bilanciere".replace("Operare", "Opera"), "Terapeutico", "Cardio leggero", "Corsa 20 minuti", "Camminata veloce",
  ];
  for (const testo of negativi) assert.deepEqual(Salute.trova(testo), [], `falso positivo: «${testo}» → ${JSON.stringify(Salute.trova(testo))}`);
});

test("LIMITI NOTI, detti chiaramente: sinonimi, giri di parole e altre lingue non si vedono (falsi negativi); parole ambigue possono scattare (falsi positivi)", () => {
  // falsi negativi: il controllo non capisce il senso della frase
  for (const testo of ["ho sempre male alla spalla destra", "il medico mi ha detto di non saltare", "knee injury", "hernia", "prendo le pastiglie ogni mattina", "ernya"]) {
    assert.deepEqual(Salute.trova(testo), [], `(limite noto) non dovrebbe vedere «${testo}»`);
  }
  // falsi positivi: parole della lista usate in senso non medico
  assert.ok(Salute.trova("operazione completata: passa al blocco successivo").length > 0, "(limite noto) «operazione» scatta anche in senso non medico");
  assert.ok(Salute.trova("Terapia d'urto: 5 serie").length > 0, "(limite noto) «terapia» scatta anche in senso figurato");
});

test("la lista è facile da cambiare: una voce con * cerca l'inizio della parola, senza * la parola intera", () => {
  assert.ok(Salute.PAROLE.includes("infortun*") && Salute.PAROLE.includes("ernia"));
  assert.ok(Salute.trova("infortunatissimo").length > 0, "infortun* trova le derivazioni");
  assert.deepEqual(Salute.trova("paternia"), [], "«ernia» non si trova dentro un'altra parola");
  assert.deepEqual(Salute.trova(""), []);
  assert.deepEqual(Salute.trova(null), []);
  assert.deepEqual(Salute.trova(12345), []);
  assert.ok(Salute.PAROLE.length >= 30 && Salute.PAROLE.length <= 120, "una lista ragionevole: né vuota né da dizionario medico");
});

// ---------- nel convertitore ----------

const conNota = (nota) => convertiXlsx(XLSX, xlsxBuono({ notaHip: nota }));

test("Excel pulito: nessun avviso sulla salute; Excel con «Ernia del disco» nelle note: avviso NON bloccante con l'indicazione di dove", () => {
  assert.deepEqual(convertiXlsx(XLSX, xlsxBuono({})).avvisi, []);

  const r = conNota("Ernia del disco L4-L5, evita i carichi sulla schiena");
  assert.ok(r.dati, "la scheda c'è: non è un blocco");
  assert.equal(erroreScheda(r.dati), null, "ed è valida: il professionista può inviarla con la spunta");
  assert.equal(r.avvisi.length, 1);
  assert.match(r.avvisi[0], /^Questo testo sembra contenere informazioni sulla salute: verifica di averne il consenso o toglile\./);
  assert.match(r.avvisi[0], /Giorno A, «Hip thrust» \(note\)/);
  assert.match(r.avvisi[0], /Ernia del disco/);
  assert.match(r.avvisi[0], /parola riconosciuta: ernia/);
});

test("il controllo guarda in tutti i punti della scheda: nomi esercizi, titolo, obiettivo, progressione, circuiti, riscaldamento", () => {
  const casi = [
    [{ nomeSquat: "Squat (infortunio al ginocchio)" }, /Giorno A, «Squat \(infortunio al ginocchio\)»/],
    [{ titolo: "Programma post operazione" }, /titolo della scheda/],
    [{ obiettivo: "Recupero dopo gravidanza" }, /obiettivo/],
  ];
  for (const [opz, atteso] of casi) {
    const r = convertiXlsx(XLSX, xlsxBuono(opz));
    assert.ok(r.avvisi.some((a) => atteso.test(a)), `${JSON.stringify(opz)} → ${JSON.stringify(r.avvisi)}`);
  }
  // circuito e routine di riscaldamento
  const righe = righeBuone();
  righe.find((r) => r[0] === "Salti sul box")[0] = "Salti sul box (allergia al lattice)";
  righe.find((r) => r[0] === "Cat cow")[0] = "Cat cow (diabete)";
  const r = convertiXlsx(XLSX, xlsxDaRighe(righe));
  assert.ok(r.avvisi.some((a) => /Giorno A, «Salti sul box \(allergia al lattice\)»/.test(a)), JSON.stringify(r.avvisi));
  assert.ok(r.avvisi.some((a) => /\[riscaldamento\].*diabete/.test(a)), JSON.stringify(r.avvisi));
});

test("nome e cognome del cliente non vengono controllati (sono anagrafica, e un cognome come «Ernia» non è un dato di salute)", () => {
  const r = convertiXlsx(XLSX, xlsxBuono({ nome: "Mario", cognome: "Ernia" }));
  assert.deepEqual(r.avvisi, []);
});

test("molte occorrenze: gli avvisi non inondano l'elenco (al massimo 8 più una riga di riepilogo)", () => {
  const righe = righeBuone();
  for (let i = 0; i < 15; i++) righe.splice(13, 0, [`Esercizio ${i} per ernia`, "3", "10", "1'"]);
  const r = convertiXlsx(XLSX, xlsxDaRighe(righe));
  const salute = r.avvisi.filter((a) => /salute/.test(a));
  assert.equal(salute.length, 9);
  assert.match(salute[8], /…e altri \d+ testi/);
});

test("il PT può proseguire: la pagina tratta questi avvisi come tutti gli altri (spunta «ho letto gli avvisi»)", () => {
  const fs = require("node:fs"), path = require("node:path");
  const web = path.join(__dirname, "..", "..", "web");
  const js = fs.readFileSync(path.join(web, "pt-converti.js"), "utf8");
  assert.match(js, /serveConferma = nomeDiverso \|\| avvisi\.length > 0/, "qualunque avviso richiede la spunta, non blocca");
  const html = fs.readFileSync(path.join(web, "pt-cliente.html"), "utf8");
  assert.match(html, /Non inserire dati di salute/);
  assert.match(html.replace(/\s+/g, " "), /parole-salute\.js"><\/script> <script src="\/convertitore\.js"/, "la lista si carica prima del convertitore");
  assert.match(fs.readFileSync(path.join(web, "..", "convertitore-test.html"), "utf8"), /parole-salute\.js/);
});
