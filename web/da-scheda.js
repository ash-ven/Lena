// Dalla scheda già inviata (dati) al modulo dell'editor (stato): serve a «Modifica» e «Copia per un altro cliente».
// È l'inverso di costruisci() in pt-editor.js. Gira sia nel browser sia nei test (una sola copia).
// Tutto ciò che l'editor non sa rappresentare (campi extra arrivati da Excel) si perde: l'editor lo dice a chi la usa.
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.LenaDaScheda = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  const t = (v) => (v === undefined || v === null ? "" : String(v));

  // «4 settimane + 1 di scarico» → scarico 1; senza scarico → 0
  function scaricoDa(dati) {
    const m = /\+\s*(\d+)\s*di scarico/i.exec(t(dati.info && dati.info.nota_durata));
    const scarico = m ? Number(m[1]) : 0;
    return scarico < dati.settimane ? scarico : 0;
  }

  function esercizioDa(b, w) {
    const schema = Array.isArray(b.schema) ? b.schema.slice(0, w).map(t) : [];
    // uno schema più corto delle settimane (succede con l'Excel) vale, per le settimane mancanti, come l'ultimo valore scritto: è ciò che il cliente vedeva
    while (schema.length < w) schema.push(schema.length ? schema[schema.length - 1] : "");
    return { tipo: "esercizio", nome: t(b.nome), serie: t(b.serie), rip: t(b.rip), rec: t(b.rec) === "/" ? "" : t(b.rec), video: t(b.video), note: t(b.note),
      progressione: t(b.progressione), perSettimana: Array.isArray(b.schema) && b.schema.length > 0, schema };
  }

  function circuitoDa(b) {
    const m = /^\s*(EMOM|AMRAP)\s*(\d+)?/i.exec(t(b.formato));
    return { tipo: "circuito", formato: m ? m[1].toUpperCase() : "EMOM", minuti: m && m[2] ? m[2] : "10", rec: t(b.rec),
      esercizi: (Array.isArray(b.esercizi) && b.esercizi.length ? b.esercizi : [{}]).map((e) => ({ nome: t(e.nome), rip: t(e.rip), video: t(e.video) })) };
  }

  // oggi = data di inizio proposta (AAAA-MM-GG): una copia riparte da oggi, non dalla data della vecchia scheda
  function statoDaDati(dati, oggi) {
    const scarico = scaricoDa(dati), w = Math.max(1, dati.settimane - scarico);
    const risc = dati.riscaldamento || {};
    const esRisc = (Array.isArray(risc.esercizi) ? risc.esercizi : []).map((e) => ({ nome: t(e[0]), video: t(e[1]) }));
    return {
      titolo: t(dati.info && dati.info.titolo), obiettivo: t(dati.info && dati.info.obiettivo), inizio: oggi,
      settimane: String(dati.settimane), scarico: String(scarico),
      risc: { durata: t(risc.durata), istruzione: t(risc.istruzione), esercizi: esRisc.length ? esRisc : [{ nome: "", video: "" }] },
      giorni: dati.giorni.map((g) => ({
        focus: t(g.focus), stretching: Array.isArray(g.stretching), stretchingDurata: Array.isArray(g.stretching) ? t(g.stretching[1]) : "5-10'",
        blocchi: (g.blocchi || []).map((b) => (b.tipo === "circuito" ? circuitoDa(b) : esercizioDa(b, w))),
      })),
    };
  }

  return { statoDaDati };
});
