/* Il riepilogo dei progressi di un cliente, calcolato dai dati della scheda e dalle sue registrazioni.
   Funzioni semplici, senza pagina né rete: gira nel browser del PT e nei test (Node).

   Come si conta un "allenamento completato": un giorno di una settimana è completato quando OGNI blocco
   (esercizio o circuito) ha la sua spunta «fatto». La scheda mette la spunta da sola quando si segnano
   tutte le serie, oppure il cliente la mette a mano. Riscaldamento e stretching non contano: sono facoltativi.
   Un giorno è "iniziato" se ha almeno un valore (kg, ripetizioni, serie o spunta), anche se non è completo. */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.LenaProgressi = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {

  // registrazioni: [{ tipo, chiave, valore }], con chiave "settimana|giorno|resto" (es. "3|A|2")
  // «oggi» si può passare (per i test); le settimane che iniziano dopo oggi sono «future»
  function riepilogoSettimane(dati, registrazioni, oggi = new Date()) {
    const fatte = new Set();      // "3|A|2" = blocco 2 del giorno A, settimana 3, con la spunta
    const toccati = new Set();    // "3|A" = giorno A della settimana 3, con almeno un valore
    for (const r of registrazioni || []) {
      const p = String(r.chiave).split("|");
      if (p.length < 3) continue;
      toccati.add(`${p[0]}|${p[1]}`);
      if (r.tipo === "fatto") fatte.add(r.chiave);
    }

    const [aa, mm, gg] = String(dati.inizio || "").split("-").map(Number);
    const oggi0 = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
    const settimane = [];
    for (let n = 1; n <= dati.settimane; n++) {
      let completati = 0, iniziati = 0;
      for (const g of dati.giorni) {
        const blocchi = g.blocchi.length;
        let tutti = blocchi > 0;
        for (let i = 1; i <= blocchi; i++) if (!fatte.has(`${n}|${g.id}|${i}`)) { tutti = false; break; }
        if (tutti) completati++;
        if (toccati.has(`${n}|${g.id}`)) iniziati++;
      }
      const sett = {
        settimana: n,
        etichetta: n < dati.settimane ? `Settimana ${n}` : "Settimana di scarico",
        completati, iniziati, totale: dati.giorni.length,
      };
      if (aa) {
        const inizioSett = new Date(aa, mm - 1, gg + 7 * (n - 1));
        sett.futura = inizioSett > oggi0 && completati === 0 && iniziati === 0;
        sett.inizioData = `${inizioSett.getFullYear()}-${String(inizioSett.getMonth() + 1).padStart(2, "0")}-${String(inizioSett.getDate()).padStart(2, "0")}`;
      }
      settimane.push(sett);
    }
    return settimane;
  }

  // "Settimana 3: 2 allenamenti su 3 completati"
  function frase(s) {
    const parola = s.completati === 1 ? "allenamento" : "allenamenti";
    let t = `${s.etichetta}: ${s.completati} ${parola} su ${s.totale} completati`;
    const incompleti = s.iniziati - s.completati;
    if (incompleti > 0) t += ` (${incompleti} ${incompleti === 1 ? "iniziato ma non finito" : "iniziati ma non finiti"})`;
    return t;
  }

  // Un riassunto di tutta la scheda
  function totale(settimane) {
    const completati = settimane.reduce((a, s) => a + s.completati, 0);
    const totali = settimane.reduce((a, s) => a + s.totale, 0);
    return { completati, totali };
  }

  return { riepilogoSettimane, frase, totale };
});
