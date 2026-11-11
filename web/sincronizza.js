/* Il "motore" che manda al server kg, ripetizioni, serie e spunte.

   Come ragiona (semplice, di proposito):
   - tiene due fotografie: CONFERMATO (quello che il server ha di sicuro) e ATTUALE (quello che c'è sulla scheda);
   - quello che va mandato è sempre la DIFFERENZA tra le due. Non c'è una "lista di cose da fare" che può
     sbagliarsi o duplicarsi: se mando due volte la stessa cosa, il risultato è identico;
   - dopo ogni modifica aspetta 1 secondo di quiete (così non manda una richiesta per ogni lettera scritta);
   - manda al massimo 200 voci per richiesta, come chiede il server;
   - se qualcosa va storto (niente rete, server in errore) riprova da solo con attese sempre più lunghe,
     e subito quando torna la rete;
   - la differenza ancora da mandare è copiata nella memoria del browser (localStorage), così non si perde
     se chiudi la pagina o scade la sessione.

   Il file non usa direttamente il browser: rete, orologio e memoria gli vengono passati da fuori.
   Per questo si può provare con test automatici (api/test/sincronizza.test.js). */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica(require("./registrazioni.js"));
  else radice.LenaSincronizza = fabbrica(radice.LenaRegistrazioni);
})(typeof self !== "undefined" ? self : this, function (R) {
  const ATTESA_DOPO_MODIFICA = 1000;                                  // 1 secondo di quiete prima di inviare
  const ATTESE_RITENTATIVO = [2000, 4000, 8000, 16000, 32000, 60000]; // poi resta a 60 secondi
  const MAX_VOCI = 200;                                               // limite del server per richiesta

  /* opzioni:
       schedaId        numero della scheda
       confermato      le righe che il server ha già: [{ tipo, chiave, valore }]
       chiama          funzione di rete: (metodo, url, corpo, opzioni) → { stato, json }   (stato 0 = niente rete)
       memoria         { leggi() → oggetto|null, scrivi(oggetto|null) }  dove copiare cosa resta da inviare
       segnala         (stato) => … con stato: "salvato" | "invio" | "attesa" | "definitivo"
       sessioneScaduta () => … chiamata se il server risponde 401
       inLinea         () => true/false (c'è rete?)
       timer           { setTimeout, clearTimeout }
       suRifiutata     (voce) => …  facoltativa: una voce che il server non accetta */
  function creaSincronizzatore(op) {
    const confermato = R.mappaDaVoci(op.confermato);
    let attuale = new Map(confermato);
    const timer = op.timer || { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (i) => clearTimeout(i) };
    const inLinea = op.inLinea || (() => true);
    const segnala = op.segnala || (() => {});
    const suRifiutata = op.suRifiutata || (() => {});

    let idTimer = null;      // il prossimo invio in programma
    let inCorso = null;      // la richiesta in volo (una sola per volta)
    let inErrore = false;    // l'ultimo tentativo è fallito: stiamo riprovando
    let fermo = false;       // errore definitivo: inutile riprovare
    let tentativi = 0;

    const daInviare = () => R.differenze(attuale, confermato);

    // Copia nella memoria del browser cosa resta da inviare (o la svuota)
    function salvaInMemoria() {
      const d = daInviare();
      try { op.memoria.scrivi(d.size ? Object.fromEntries(d) : null); } catch (e) { /* memoria piena o bloccata: pazienza */ }
    }

    function programma(ms) {
      if (idTimer !== null) timer.clearTimeout(idTimer);
      idTimer = timer.setTimeout(() => { idTimer = null; provaInvio(); }, ms);
    }

    function riuscito() {
      inErrore = false; tentativi = 0;
      segnala("salvato");
    }

    function fallito() {
      inErrore = true;
      segnala("attesa");
      programma(ATTESE_RITENTATIVO[Math.min(tentativi, ATTESE_RITENTATIVO.length - 1)]);
      tentativi++;
    }

    function registraComeConfermate(voci) {
      for (const v of voci) {
        const k = R.chiaveMappa(v.tipo, v.chiave);
        if (v.valore === "") confermato.delete(k); else confermato.set(k, v.valore);
      }
    }

    // Un blocco è stato rifiutato con 400: lo rimando voce per voce per capire quali sono sbagliate.
    // Quelle sbagliate si scartano (per non riprovarle all'infinito); le altre passano.
    async function inviaUnaAUna(blocco) {
      for (const voce of blocco) {
        const r = await op.chiama("PUT", `/api/schede/${op.schedaId}/registrazioni`, { voci: [voce] }, { keepalive: true });
        if (r.stato === 200) registraComeConfermate([voce]);
        else if (r.stato === 400) { suRifiutata(voce); registraComeConfermate([voce]); }
        else return r.stato;   // un altro problema (rete, 401...): si ferma e lo gestisce chi chiama
      }
      return 200;
    }

    // Un tentativo: manda tutte le differenze, a blocchi. Restituisce "ok" | "401" | "errore" | "definitivo"
    async function eseguiInvio() {
      for (const blocco of R.inBlocchi(daInviare(), MAX_VOCI)) {
        let stato;
        const r = await op.chiama("PUT", `/api/schede/${op.schedaId}/registrazioni`, { voci: blocco }, { keepalive: true });
        stato = r.stato;
        if (stato === 200) { registraComeConfermate(blocco); continue; }
        if (stato === 400) stato = await inviaUnaAUna(blocco);
        if (stato === 200) continue;
        if (stato === 401) return "401";
        if (stato === 403 || stato === 404) return "definitivo";   // la scheda non è più accessibile: riprovare non serve
        return "errore";                                            // 0 (niente rete), 429, 5xx…
      }
      return "ok";
    }

    function provaInvio() {
      if (inCorso) return inCorso;
      if (fermo) return Promise.resolve();
      if (idTimer !== null) { timer.clearTimeout(idTimer); idTimer = null; }
      if (daInviare().size === 0) { riuscito(); return Promise.resolve(); }
      if (!inLinea()) { fallito(); return Promise.resolve(); }   // niente rete: inutile provare, aspettiamo

      segnala(inErrore ? "attesa" : "invio");
      inCorso = eseguiInvio().then((esito) => {
        inCorso = null;
        salvaInMemoria();
        if (esito === "401") { segnala("attesa"); fermo = true; op.sessioneScaduta(); }
        else if (esito === "definitivo") { fermo = true; segnala("definitivo"); }
        else if (esito === "errore") fallito();
        else if (daInviare().size) { inErrore = false; tentativi = 0; programma(ATTESA_DOPO_MODIFICA); segnala("invio"); }   // qualcosa è cambiato mentre inviavo
        else riuscito();
      });
      return inCorso;
    }

    return {
      // All'apertura: i dati del server + le modifiche che erano rimaste in sospeso. Restituisce l'oggetto "mem" della scheda.
      caricaMem() {
        let rimaste = null;
        try { rimaste = op.memoria.leggi(); } catch (e) { /* memoria non leggibile */ }
        attuale = new Map(confermato);
        if (rimaste && typeof rimaste === "object") {
          for (const [k, v] of Object.entries(rimaste)) {
            // si accettano solo voci con un tipo che conosciamo e un valore di testo (la memoria del browser non è affidabile)
            if (typeof v !== "string" || !R.CAMPO_MEM[k.slice(0, Math.max(0, k.indexOf("|")))]) continue;
            if (v === "") attuale.delete(k); else attuale.set(k, v);
          }
        }
        if (daInviare().size) { segnala("invio"); programma(0); } else segnala("salvato");
        return R.memDaMappa(attuale);
      },

      // La scheda ha cambiato qualcosa (chiamata a ogni modifica)
      cambiato(mem) {
        if (fermo) return;
        attuale = R.mappaDaMem(mem);
        salvaInMemoria();
        if (daInviare().size === 0) { if (!inCorso && !inErrore) { if (idTimer !== null) { timer.clearTimeout(idTimer); idTimer = null; } riuscito(); } return; }
        if (inErrore) return;                 // c'è già un nuovo tentativo in programma, con la sua attesa
        segnala("invio");
        programma(ATTESA_DOPO_MODIFICA);      // 1 secondo senza altre modifiche, poi si invia
      },

      // Invia SUBITO (torna la rete, la pagina si nasconde, l'utente esce). Restituisce true se non resta niente da inviare.
      async sincronizzaOra() {
        if (fermo) return daInviare().size === 0;
        tentativi = 0;
        await provaInvio();
        return daInviare().size === 0;
      },

      // Si esce da questo account su un dispositivo che può essere condiviso: niente più invii, e la copia locale delle
      // modifiche in sospeso viene CANCELLATA (le modifiche non inviate si perdono, la persona lo ha confermato).
      dimentica() {
        fermo = true;
        if (idTimer !== null) { timer.clearTimeout(idTimer); idTimer = null; }
        attuale = new Map(confermato);
        try { op.memoria.scrivi(null); } catch (e) { /* memoria bloccata */ }
      },

      // Le voci che il server ha di sicuro (per tenere aggiornata la copia sul telefono)
      confermate: () => [...confermato].map(([k, valore]) => { const i = k.indexOf("|"); return { tipo: k.slice(0, i), chiave: k.slice(i + 1), valore }; }),

      inSospeso: () => daInviare().size,
    };
  }

  return { creaSincronizzatore, ATTESA_DOPO_MODIFICA, ATTESE_RITENTATIVO, MAX_VOCI };
});
