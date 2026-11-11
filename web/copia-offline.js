/* La copia della scheda sul telefono, per aprirla anche senza rete. Si fa SOLO se il cliente la attiva («Scheda anche senza rete»).
   Cosa contiene: gli esercizi della scheda, quello che il cliente ha segnato, l'aspetto scelto e il numero del suo account.
   Cosa NON contiene: email, foto, nome del profilo, note del trainer.
   Quanto dura: 14 giorni dall'ultima volta che la scheda si è aperta con la rete. Si cancella anche quando si preme «Esci» o si disattiva.
   Apre la scheda senza accedere: serve per la palestra senza campo. Su un telefono condiviso chi lo usa potrebbe vederla finché non si preme «Esci».
   Il file non usa direttamente il browser: la memoria gli viene passata da fuori (così si prova con test automatici). */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.LenaCopia = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  const CHIAVE = "lena:copia";    // la copia
  const VOGLIO = "lena:offline";  // «sì, tieni la copia su questo telefono»
  const GIORNI = 14;
  const GIORNO_MS = 86400000;

  const mem = (m) => m || (typeof localStorage !== "undefined" ? localStorage : null);

  function vuole(m) { try { return mem(m).getItem(VOGLIO) === "1"; } catch (e) { return false; } }

  function cancella(m) { try { mem(m).removeItem(CHIAVE); } catch (e) { /* memoria bloccata */ } }

  // attiva o disattiva; disattivando la copia sparisce subito
  function imposta(m, si) {
    try {
      if (si) mem(m).setItem(VOGLIO, "1");
      else { mem(m).removeItem(VOGLIO); mem(m).removeItem(CHIAVE); }
    } catch (e) { /* memoria bloccata */ }
  }

  // dati = { utenteId, scheda: { id, dati }, registrazioni: [{tipo, chiave, valore}], mood }  (mood può essere null)
  function salva(m, dati, ora) {
    try {
      mem(m).setItem(CHIAVE, JSON.stringify({
        v: 1, salvata: new Date(ora || Date.now()).toISOString(),
        utenteId: dati.utenteId,
        scheda: { id: dati.scheda.id, dati: dati.scheda.dati },
        registrazioni: (dati.registrazioni || []).map((r) => ({ tipo: r.tipo, chiave: r.chiave, valore: String(r.valore) })),
        mood: dati.mood || null,
      }));
      return true;
    } catch (e) { return false; }
  }

  // La copia, se c'è, è valida e non è scaduta; altrimenti null (e quella rovinata o scaduta si cancella)
  function leggi(m, ora) {
    let c = null;
    try { const t = mem(m).getItem(CHIAVE); c = t ? JSON.parse(t) : null; } catch (e) { c = null; }
    if (!c) return null;
    const eta = (ora || Date.now()) - Date.parse(c.salvata);
    const buona = c.v === 1 && Number.isInteger(c.utenteId) && c.scheda && Number.isInteger(c.scheda.id) && c.scheda.dati &&
      Array.isArray(c.scheda.dati.giorni) && Array.isArray(c.registrazioni) && eta >= 0 && eta <= GIORNI * GIORNO_MS;
    if (!buona) { cancella(m); return null; }
    return c;
  }

  // Dopo ogni salvataggio andato a buon fine: i progressi della copia restano quelli del server (la data della copia non cambia)
  function aggiornaRegistrazioni(m, schedaId, voci) {
    const c = leggi(m);
    if (!c || c.scheda.id !== schedaId) return false;
    c.registrazioni = voci.map((r) => ({ tipo: r.tipo, chiave: r.chiave, valore: String(r.valore) }));
    try { mem(m).setItem(CHIAVE, JSON.stringify(c)); return true; } catch (e) { return false; }
  }

  // Fino a quando la copia vale
  const scadenza = (c) => new Date(Date.parse(c.salvata) + GIORNI * GIORNO_MS);

  // Le stesse funzioni, già legate a una memoria: crea(null) usa quella del browser (localStorage). Chi la usa nella pagina
  // chiama direttamente LenaCopia.vuole(), LenaCopia.salva(dati)… senza passare la memoria; i test passano una memoria finta con crea(finta).
  function crea(m) {
    return {
      GIORNI, scadenza,
      vuole: () => vuole(m), imposta: (si) => imposta(m, si), salva: (dati, ora) => salva(m, dati, ora),
      leggi: (ora) => leggi(m, ora), cancella: () => cancella(m),
      aggiornaRegistrazioni: (schedaId, voci) => aggiornaRegistrazioni(m, schedaId, voci),
    };
  }
  return Object.assign({ crea }, crea(null));
});
