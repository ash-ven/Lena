/* La logica che trasforma un foglio Excel nell'oggetto DATI della scheda.
   È l'UNICA copia: la usano sia la pagina vecchia (convertitore-test.html, che si apre con "npx serve")
   sia l'area del PT nel sito. Non tocca la pagina né la rete: riceve le righe dell'Excel e restituisce
   { dati, avvisi }. "dati" è null se la scheda non si può costruire (es. manca la data di inizio).
   Per leggere un file .xlsx si usa la libreria SheetJS (web/vendor/xlsx.full.min.js): vedi convertiXlsx. */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica(require("./parole-salute.js"));
  else radice.LenaConvertitore = fabbrica(radice.LenaParoleSalute);
})(typeof self !== "undefined" ? self : this, function (ParoleSalute) {

// ---------- piccoli aiuti ----------
function testo(v) { return v == null ? "" : String(v).trim(); }
function èLink(v) { return /^https?:\/\//i.test(testo(v)); }
function rigaVuota(r) { return r.every(c => testo(c) === ""); }

// Trasforma una data di Excel in testo "2026-10-26", leggendo l'ora locale.
// Se la cella è vuota o contiene testo (non una vera data) restituisce null.
function dataInTesto(d) {
  if (!(d instanceof Date) || isNaN(d)) return null;
  const x = new Date(d.getTime() + 12 * 3600 * 1000);
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const gg = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${mm}-${gg}`;
}

// ---------- intestazione e giorni ----------
function leggiInfo(righe) {
  const info = {};
  info.titolo = testo(righe[0][1]);   // B1: il titolo del programma
  for (const r of righe) {
    const etichetta = typeof r[0] === "string" ? r[0].trim() : "";
    if (!etichetta.endsWith(":")) continue;

    const valore = r[1];
    if (etichetta === "Nome:") info.nome = testo(valore);   // testo(): una cella vuota dà "", non la parola "null"
    if (etichetta === "Cognome:") info.cognome = testo(valore);
    if (etichetta === "Obiettivo:") info.obiettivo = testo(valore);
    if (etichetta === "N° sedute a settimana:") info.sedute = Number(valore);
    if (etichetta === "Data inizio scheda:") info.inizio = dataInTesto(valore);
    if (etichetta === "Data fine scheda:") {
      info.fine = dataInTesto(valore);
      info.nota_durata = r[2] ? String(r[2]).trim() : null;
    }
  }
  return info;
}

function trovaGiorni(righe) {
  const giorni = [];
  for (let i = 0; i < righe.length; i++) {
    const a = testo(righe[i][0]);
    const m = a.match(/^GIORNO\s+(\w+)\s*\((.+)\)$/i);
    if (!m) continue;

    // il giorno finisce alla riga "Stretching"; se manca, si ferma al giorno
    // successivo, alla "Routine riscaldamento" o alla fine del foglio
    let fine = righe.length, senzaStretching = true, stretching = null;
    for (let j = i + 1; j < righe.length; j++) {
      const b = testo(righe[j][0]).toLowerCase();
      if (b === "stretching") {
        fine = j;
        senzaStretching = false;
        stretching = [testo(righe[j][0]), testo(righe[j][2])];   // nome e durata, es. ["Stretching", "5-10'"]
        break;
      }
      if (/^giorno\s+\w+\s*\(/.test(b) || b.startsWith("*routine")) { fine = j; break; }
    }

    const focus = m[2].toLowerCase();
    giorni.push({
      id: m[1].toUpperCase(),
      titolo_originale: a,
      focus: focus.charAt(0).toUpperCase() + focus.slice(1),
      rigaInizio: i + 1,
      rigaFine: fine + 1,
      senzaStretching,
      stretching,
    });
  }
  return giorni;
}

// ---------- esercizi e circuiti ----------
// "progressioni" = insieme delle righe in cui F:L è una cella unita (il testo della progressione)
function leggiBlocchi(righe, giorno, avvisi, progressioni) {
  const blocchi = [];
  const ultima = giorno.rigaFine - 1;
  let i = giorno.rigaInizio;

  while (i < ultima) {
    const r = righe[i];
    const nome = testo(r[0]).toLowerCase();

    if (rigaVuota(r) || nome === "esercizio" || nome.startsWith("riscaldamento")) { i++; continue; }

    // circuito: in colonna B c'è EMOM o AMRAP
    if (/^(EMOM|AMRAP)/i.test(testo(r[1]))) {
      const circuito = { tipo: "circuito", formato: testo(r[1]), rec: testo(r[3]) || null, esercizi: [] };
      while (i < ultima && !rigaVuota(righe[i])) {
        const c = righe[i];
        const link = c.find(èLink);
        circuito.esercizi.push({ nome: testo(c[0]), rip: testo(c[2]), video: link ? testo(link) : null });
        i++;
      }
      blocchi.push(circuito);
      continue;
    }

    // riga con del contenuto ma senza il nome dell'esercizio: la salto e lo segnalo
    if (!testo(r[0])) {
      avvisi.push(`Riga ${i + 1}: c'è del contenuto ma manca il nome dell'esercizio, l'ho saltata`);
      i++;
      continue;
    }

    // esercizio normale
    const e = {
      tipo: "esercizio", nome: testo(r[0]), serie: testo(r[1]), rip: testo(r[2]), rec: testo(r[3]),
      video: null, note: null, schema: null, progressione: null, riga: i + 1,
    };
    const schema = [], note = [];
    r.forEach((cella, col) => {
      const t = testo(cella);
      if (col < 4 || !t) return;
      if (col === 4 && /^[\d.,]+$/.test(t)) return;                     // E = Kg: un numero non è una nota
      if (èLink(t)) e.video = t;                                         // un link vale come video, ovunque sia
      else if (/^\d+\s*x\s*\d+$/i.test(t)) schema.push(t.replace(/\s/g, ""));   // "4x5"
      else if (col === 5 && progressioni.has(i)) e.progressione = t;     // testo nella cella unita F:L
      else note.push(t);                                                 // qualsiasi altro testo è una nota
    });
    e.schema = schema.length ? schema : null;
    e.note = note.length ? note.join(" ") : null;

    if (!e.serie || !e.rip) {
      avvisi.push(`Riga ${i + 1}: "${e.nome}" non ha serie o ripetizioni`);
    } else if (!/^\d+$/.test(e.serie)) {
      avvisi.push(`Riga ${i + 1}: "${e.nome}" ha come serie «${e.serie}», che non è un numero: la scheda non mostrerà i pallini delle serie`);
    }
    blocchi.push(e);
    i++;
  }
  return blocchi;
}

// ---------- oggetto DATI completo ----------
const PALETTE = [
  { colore: "D49A9A", chiaro: "F6E9E7", scuro: "A86A6B" },
  { colore: "9DB5A0", chiaro: "E8EFE8", scuro: "62806A" },
  { colore: "D9B26F", chiaro: "F7EEDC", scuro: "9C7A3C" },
];

function leggiRoutine(righe) {
  const inizio = righe.findIndex(r => testo(r[0]).toLowerCase().startsWith("*routine"));
  if (inizio < 0) return { istruzione: "", esercizi: [] };

  let istruzione = "";
  const esercizi = [];
  for (let i = inizio + 1; i < righe.length; i++) {
    const r = righe[i];
    if (rigaVuota(r)) break;
    const frase = r.slice(1).map(testo).find(t => t && !èLink(t));
    if (frase && !istruzione) istruzione = frase;
    const link = r.find(èLink);
    esercizi.push([testo(r[0]), link ? testo(link) : null]);
  }
  return { istruzione, esercizi };
}

function convertiExcel(righe, merges) {
  const avvisi = [];
  const info = leggiInfo(righe);

  // senza data di inizio la scheda non si può costruire
  if (!info.inizio) {
    avvisi.push("Non trovo la data di inizio («Data inizio scheda:», colonna B). In Excel deve essere una data vera, non un testo.");
    return { dati: null, avvisi };
  }

  const giorni = trovaGiorni(righe);
  if (giorni.length === 0) avvisi.push("Non trovo nessun giorno (cerco righe tipo «GIORNO A (...)»)");
  if (info.sedute && giorni.length && info.sedute !== giorni.length) {
    avvisi.push(`L'Excel dice ${info.sedute} sedute a settimana, ma ho trovato ${giorni.length} giorni`);
  }

  // righe (indice da 0) in cui F:L è una cella unita: lì sta il testo della progressione
  const progressioni = new Set((merges || [])
    .filter(m => m.s.c === 5 && m.e.c === 11 && m.s.r === m.e.r)
    .map(m => m.s.r));

  const rigaRisc = righe.find(r => testo(r[0]).toLowerCase().startsWith("riscaldamento"));
  const routine = leggiRoutine(righe);
  const riscaldamento = {
    voce: rigaRisc ? testo(rigaRisc[1]) : "",
    durata: rigaRisc ? testo(rigaRisc[2]) : "",
    istruzione: routine.istruzione,
    esercizi: routine.esercizi,
  };

  const intestazione = righe.find(r => testo(r[0]).toLowerCase() === "esercizio") || [];
  const colonneSettimana = intestazione.filter(c => /settimana/i.test(testo(c))).length;
  const scarico = (info.nota_durata || "").match(/(\d+)\s*di scarico/i);
  const settimane = colonneSettimana + (scarico ? Number(scarico[1]) : 0);

  const fineAttesa = new Date(info.inizio + "T00:00:00");
  fineAttesa.setDate(fineAttesa.getDate() + settimane * 7 - 1);
  const fineAttesaTesto = dataInTesto(fineAttesa);
  if (info.fine && fineAttesaTesto !== info.fine) {
    avvisi.push(`Date: ${settimane} settimane da ${info.inizio} finiscono il ${fineAttesaTesto}, ma l'Excel dice ${info.fine}`);
  }

  giorni.forEach((g, n) => {
    if (g.senzaStretching) avvisi.push(`Giorno ${g.id}: manca la riga «Stretching» che lo chiude (l'ho chiuso prima della riga ${g.rigaFine})`);
    g.blocchi = leggiBlocchi(righe, g, avvisi, progressioni);
    g.blocchi.forEach(b => delete b.riga);
    g.titolo = "Giorno " + g.id;
    Object.assign(g, PALETTE[n % PALETTE.length]);
    delete g.rigaInizio;
    delete g.rigaFine;
    delete g.senzaStretching;
  });

  const dati = {
    inizio: info.inizio,
    settimane,
    info: {
      titolo: info.titolo, nome: info.nome, cognome: info.cognome,
      obiettivo: info.obiettivo, sedute: info.sedute, nota_durata: info.nota_durata,
    },
    riscaldamento,
    giorni,
  };
  // Controllo morbido sui dati di salute: se un testo sembra contenerne, un avviso NON bloccante (vedi parole-salute.js)
  if (ParoleSalute) avvisi.push(...ParoleSalute.avvisi(dati));
  return { dati, avvisi };
}

// ---------- dal file .xlsx all'oggetto DATI ----------
// "XLSX" è la libreria SheetJS; "byte" è il contenuto del file (ArrayBuffer o Buffer).
function convertiXlsx(XLSX, byte) {
  const cartella = XLSX.read(byte, { cellDates: true });
  const foglio = cartella.Sheets[cartella.SheetNames[0]];
  const righe = XLSX.utils.sheet_to_json(foglio, { header: 1, blankrows: true, defval: null });
  return convertiExcel(righe, foglio["!merges"]);
}

return { convertiExcel, convertiXlsx, dataInTesto };
});
