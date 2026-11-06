// Costruisce file Excel (.xlsx) di prova con la libreria SheetJS già presente nel progetto (web/vendor).
// Servono ai test del convertitore e alle prove nel browser. Non è un test: il nome non finisce in .test.js
const path = require("node:path");
const XLSX = require(path.join(__dirname, "..", "..", "web", "vendor", "xlsx.full.min.js"));

const data = (a, m, g) => new Date(a, m - 1, g);   // a mezzanotte, come le date vere di Excel

// Le righe di un Excel "buono": 2 giorni, 4 settimane + 1 di scarico, un circuito, uno stretching, la routine di riscaldamento.
// "opz" permette di rompere una cosa alla volta (vedi i test).
function righeBuone(opz = {}) {
  const nome = opz.nome === undefined ? "Asiha" : opz.nome;
  const cognome = opz.cognome === undefined ? "Venturi" : opz.cognome;
  const inizio = opz.inizio === undefined ? data(2026, 11, 2) : opz.inizio;
  const fine = opz.fine === undefined ? data(2026, 12, 6) : opz.fine;
  const intest = ["Esercizio", "Serie", "Ripetizioni", "Recupero", "Kg", "Settimana 1", "Settimana 2", "Settimana 3", "Settimana 4"];
  const nomeSquat = opz.nomeSquat === undefined ? "Squat con bilanciere" : opz.nomeSquat;
  const righe = [
    [null, opz.titolo === undefined ? "Programma forza e tonificazione" : opz.titolo],
    ["Nome:", nome],
    ["Cognome:", cognome],
    ["Obiettivo:", opz.obiettivo === undefined ? "Tonificazione" : opz.obiettivo],
    ["N° sedute a settimana:", opz.sedute === undefined ? 2 : opz.sedute],
    ["Data inizio scheda:", inizio],
    ["Data fine scheda:", fine, opz.notaDurata === undefined ? "4 settimane + 1 di scarico" : opz.notaDurata],
    [],
    ["GIORNO A (gambe e glutei)"],
    ["Riscaldamento", "Routine riscaldamento", "10'"],
    intest,
    [nomeSquat, opz.serieSquat === undefined ? "4" : opz.serieSquat, "10", "1'30\"", "4x10", "+2,5 kg a settimana se chiudi tutte le serie", null, null, null, null, null, "https://example.com/squat"],
    ["Hip thrust", "3", "12", "1'", null, opz.notaHip === undefined ? "Fermati un secondo in alto" : opz.notaHip],
    ["Kettlebell swing", "EMOM 10'", "15", null],
    ["Salti sul box", null, "8", null, null, "https://example.com/box"],
    [],
    ["Stretching", null, "5-10'"],
    [],
    ["GIORNO B (parte alta)"],
    intest,
    ["Lat machine", "4", "10", "1'30\"", null, "Presa larga"],
    ["Panca con manubri", "4", "10", "1'30\""],
    ["Stretching", null, "5-10'"],
    [],
    ["*Routine riscaldamento"],
    ["Jumping jack", "Fai 2 giri senza pausa"],
    ["Cat cow", null, "https://example.com/catcow"],
  ];
  if (opz.senzaGiorni) return righe.slice(0, 8);
  return righe;
}

// Righe → file .xlsx (Buffer). "unioni" sono le celle unite (la progressione dell'esercizio sta in una cella unita F:L)
function xlsxDaRighe(righe, { unioni } = {}) {
  const foglio = XLSX.utils.aoa_to_sheet(righe, { cellDates: true });
  foglio["!merges"] = unioni || [{ s: { r: 11, c: 5 }, e: { r: 11, c: 11 } }];   // la progressione dello squat sta nella cella unita F12:L12
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, foglio, "Scheda");
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx", cellDates: true });
}

const xlsxBuono = (opz) => xlsxDaRighe(righeBuone(opz));

module.exports = { XLSX, righeBuone, xlsxDaRighe, xlsxBuono, data };
