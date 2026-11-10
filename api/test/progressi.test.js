// Test del calcolo dei progressi (web/progressi.js): "Settimana 3: 2 allenamenti su 3 completati"
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { riepilogoSettimane, frase, totale } = require("../../web/progressi.js");
const esempio = require("../esempio/scheda-esempio.json");   // 5 settimane, giorni A (4 blocchi), B (3), C (2)

const fatto = (sett, giorno, blocco) => ({ tipo: "fatto", chiave: `${sett}|${giorno}|${blocco}`, valore: "1" });
const tutti = (sett, giorno, n) => Array.from({ length: n }, (_, i) => fatto(sett, giorno, i + 1));

test("nessuna registrazione: tutte le settimane a zero", () => {
  const s = riepilogoSettimane(esempio, []);
  assert.equal(s.length, 5);
  assert.deepEqual(s.map((x) => [x.completati, x.iniziati, x.totale]), Array(5).fill([0, 0, 3]));
  assert.equal(s[0].etichetta, "Settimana 1");
  assert.equal(s[4].etichetta, "Settimana di scarico");
  assert.equal(frase(s[0]), "Settimana 1: 0 allenamenti su 3 completati");
});

test("«Settimana 3: 2 allenamenti su 3 completati»", () => {
  const reg = [...tutti(3, "A", 4), ...tutti(3, "B", 3)];
  const s = riepilogoSettimane(esempio, reg);
  assert.equal(frase(s[2]), "Settimana 3: 2 allenamenti su 3 completati");
  assert.deepEqual(totale(s), { completati: 2, totali: 15 });
  assert.equal(s[1].completati, 0, "le altre settimane non sono toccate");
});

test("un giorno a metà è «iniziato» ma non «completato»; basta un valore qualsiasi per iniziare", () => {
  const reg = [fatto(2, "A", 1), fatto(2, "A", 2), { tipo: "kg", chiave: "2|B|1", valore: "30" }, { tipo: "rip", chiave: "2|C|1|0", valore: "10" }];
  const s = riepilogoSettimane(esempio, reg)[1];
  assert.equal(s.completati, 0);
  assert.equal(s.iniziati, 3);
  assert.equal(frase(s), "Settimana 2: 0 allenamenti su 3 completati (3 iniziati ma non finiti)");
  assert.match(frase({ ...s, iniziati: 1 }), /\(1 iniziato ma non finito\)/);
  assert.match(frase({ etichetta: "Settimana 1", completati: 1, iniziati: 1, totale: 3 }), /1 allenamento su 3/, "singolare");
});

test("riscaldamento e stretching non contano; serie e kg non bastano senza la spunta del blocco", () => {
  const reg = [...tutti(1, "C", 2), fatto(1, "C", "S"), { tipo: "fatto", chiave: "1|C|R|0", valore: "1" }, { tipo: "serie", chiave: "1|A|1", valore: "4" }, { tipo: "kg", chiave: "1|A|1", valore: "40" }];
  const s = riepilogoSettimane(esempio, reg)[0];
  assert.equal(s.completati, 1, "solo il giorno C (2 blocchi su 2)");
  assert.equal(s.iniziati, 2, "C e A (A ha kg e serie ma nessuna spunta)");
});

test("registrazioni malformate o di un'altra settimana non rompono nulla", () => {
  const reg = [{ tipo: "fatto", chiave: "x", valore: "1" }, { tipo: "fatto", chiave: "99|A|1", valore: "1" }, { tipo: "kg", chiave: "1|Z|1", valore: "1" }, { tipo: "fatto", chiave: "1|A", valore: "1" }];
  const s = riepilogoSettimane(esempio, reg);
  assert.equal(totale(s).completati, 0);
});

test("un giorno senza blocchi non risulta mai completato", () => {
  const d = JSON.parse(JSON.stringify(esempio));
  d.giorni[2].blocchi = [];
  assert.equal(riepilogoSettimane(d, [])[0].completati, 0);
  assert.equal(riepilogoSettimane(d, [...tutti(1, "A", 4), ...tutti(1, "B", 3)])[0].completati, 2);
});

test("settimane future: non sono un «0 su 3», sono «future» e dicono quando partono; quelle con qualcosa di segnato non lo sono mai", () => {
  const { riepilogoSettimane } = require("../../web/progressi.js");
  const dati = { inizio: "2026-11-02", settimane: 4, giorni: [{ id: "A", blocchi: [{}] }, { id: "B", blocchi: [{}] }] };
  const s = riepilogoSettimane(dati, [], new Date(2026, 10, 10));   // 10 novembre: settimana 2 in corso
  assert.deepEqual(s.map((x) => x.futura), [false, false, true, true]);
  assert.equal(s[2].inizioData, "2026-11-16");
  const con = riepilogoSettimane(dati, [{ tipo: "kg", chiave: "3|A|1", valore: "50" }], new Date(2026, 10, 10));
  assert.equal(con[2].futura, false, "se ha già segnato qualcosa non è «futura»");
});

// ---------- andamento dei kg per esercizio ----------
const { andamentoKg, numeroKg } = require("../../web/progressi.js");
const kgReg = (chiave, valore) => ({ tipo: "kg", chiave, valore });

test("numeroKg: legge virgola e «kg», ignora testo e zero", () => {
  assert.equal(numeroKg("37,5"), 37.5);
  assert.equal(numeroKg(" 40 kg "), 40);
  assert.equal(numeroKg("12.5"), 12.5);
  for (const v of ["", "—", "tanto", "0", "-5", "10-12", null, undefined]) assert.equal(numeroKg(v), null);
});

test("andamento kg: un esercizio per volta, settimane in ordine, variazione tra primo e ultimo valore", () => {
  const a = andamentoKg(esempio, [kgReg("3|A|1", "45"), kgReg("1|A|1", "40"), kgReg("2|A|1", "42,5")]);
  assert.equal(a.length, 1);
  assert.equal(a[0].nome, "Squat con bilanciere");
  assert.deepEqual(a[0].punti, [{ settimana: 1, kg: 40 }, { settimana: 2, kg: 42.5 }, { settimana: 3, kg: 45 }]);
  assert.equal(a[0].variazione, 5);
});

test("andamento kg: un solo valore non ha variazione; ripetizioni, testo e chiavi strane si ignorano; calo negativo", () => {
  const a = andamentoKg(esempio, [kgReg("1|B|1", "30"), { tipo: "rip", chiave: "1|A|1", valore: "10" }, kgReg("1|A|2", "boh"), kgReg("x|A|1", "5"), kgReg("1|Z|1", "9")]);
  assert.equal(a.length, 1);
  assert.equal(a[0].variazione, null);
  const b = andamentoKg(esempio, [kgReg("1|A|1", "50"), kgReg("2|A|1", "47,5")]);
  assert.equal(b[0].variazione, -2.5);
});

test("andamento kg: gli esercizi di un circuito hanno le loro chiavi a quattro parti; nessun valore = lista vuota", () => {
  assert.deepEqual(andamentoKg(esempio, []), []);
  const a = andamentoKg(esempio, [kgReg("1|A|4|0", "12"), kgReg("2|A|4|0", "14"), kgReg("1|A|4|1", "8")]);
  assert.deepEqual(a.map((x) => x.nome), ["Kettlebell swing", "Salti sul box"]);
  assert.equal(a[0].variazione, 2);
});
