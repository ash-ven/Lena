// Controlla che "dati" abbia la forma prodotta dal convertitore (web/convertitore.js)
// e usata dalla scheda (web/scheda.js). Gira sia nel browser (prima di inviare) sia sul server (prima di salvare):
// è una sola copia, quindi i due controlli non possono mai essere diversi. Controlla solo ciò che la scheda usa davvero:
// se manca, la pagina del cliente si romperebbe. Restituisce un messaggio di errore oppure null.
//
// Forma attesa (in breve):
// {
//   inizio: "2026-10-26",            // data vera, testo AAAA-MM-GG
//   settimane: 5,                    // intero 1-52 (comprese quelle di scarico)
//   info: { titolo, nome, cognome, obiettivo, sedute, nota_durata },
//   riscaldamento: { voce, durata, istruzione, esercizi: [[nome, linkVideo], ...] },
//   giorni: [ { id: "A", titolo, focus, colore: "D49A9A", chiaro, scuro, stretching,
//               blocchi: [ { tipo: "esercizio", nome, serie, rip, rec, ... }
//                        | { tipo: "circuito", formato, rec, esercizi: [ { nome, rip, video } ] } ] } ]
// }

(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.LenaValidaScheda = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
const èOggetto = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const testoOpzionale = (v) => v === undefined || v === null || typeof v === "string";
// Un indirizzo (video) deve essere http o https: niente "javascript:" o altro
const indirizzoOk = (v) => v === undefined || v === null || v === "" || (typeof v === "string" && /^https?:\/\/\S+$/i.test(v) && v.length <= 2000);

function dataVera(testo) {
  if (typeof testo !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(testo)) return false;
  const d = new Date(testo + "T00:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === testo;   // scarta per esempio il 2026-02-30
}

function erroreScheda(dati) {
  if (!èOggetto(dati)) return "manca l'oggetto «dati»";
  if (!dataVera(dati.inizio)) return "data di inizio mancante o non valida (formato AAAA-MM-GG)";
  if (!Number.isInteger(dati.settimane) || dati.settimane < 1 || dati.settimane > 52) return "settimane fuori range (1-52)";

  if (!èOggetto(dati.info)) return "manca «info» (titolo, nome, cognome...)";
  for (const campo of ["titolo", "nome", "cognome", "obiettivo", "nota_durata"])
    if (!testoOpzionale(dati.info[campo])) return `info.${campo} deve essere un testo`;

  if (!èOggetto(dati.riscaldamento) || !Array.isArray(dati.riscaldamento.esercizi))
    return "manca «riscaldamento» con la lista «esercizi»";

  for (const voce of dati.riscaldamento.esercizi) {
    if (!Array.isArray(voce) || typeof voce[0] !== "string") return "una voce del riscaldamento non è valida";
    if (!indirizzoOk(voce[1])) return "un video del riscaldamento non ha un indirizzo http o https valido";
  }

  if (!Array.isArray(dati.giorni) || dati.giorni.length === 0) return "nessun giorno di allenamento";
  if (dati.giorni.length > 14) return "troppi giorni (massimo 14)";
  const visti = new Set();
  for (const g of dati.giorni) {
    if (!èOggetto(g)) return "un giorno non è valido";
    const id = String(g.id ?? "");
    if (!/^\w{1,10}$/.test(id)) return `giorno con id non valido («${id}»): servono lettere o numeri`;
    if (visti.has(id)) return `il giorno «${id}» compare due volte`;
    visti.add(id);
    for (const c of ["colore", "chiaro", "scuro"])
      if (g[c] !== undefined && !/^[0-9A-Fa-f]{6}$/.test(String(g[c]))) return `giorno ${id}: colore «${c}» non valido`;
    if (!Array.isArray(g.blocchi)) return `giorno ${id}: manca la lista «blocchi»`;
    if (g.blocchi.length > 100) return `giorno ${id}: troppi blocchi`;
    for (const b of g.blocchi) {
      if (!èOggetto(b) || !["esercizio", "circuito"].includes(b.tipo))
        return `giorno ${id}: ogni blocco deve essere un «esercizio» o un «circuito»`;
      if (b.tipo === "circuito" && !Array.isArray(b.esercizi)) return `giorno ${id}: un circuito senza «esercizi»`;
      if (!indirizzoOk(b.video)) return `giorno ${id}: un video non ha un indirizzo http o https valido`;
      for (const e of b.esercizi || []) if (!èOggetto(e) || !indirizzoOk(e.video)) return `giorno ${id}: un esercizio del circuito non è valido (video)`;
    }
  }
  return null;
}

return { erroreScheda };
});
