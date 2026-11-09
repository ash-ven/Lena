/* Aiuti comuni a tutte le pagine: chiamare l'API, uscire, messaggi di errore.
   Espone un solo nome globale, "Lena", così non si scontra con altri script. */
(function () {
  // Chiama l'API. Non lancia mai errori: restituisce sempre { stato, json }.
  //   stato 0       = il server non risponde (niente rete, server spento...)
  //   stato 200-599 = la risposta vera del server
  async function chiama(metodo, url, corpo, opzioni) {
    try {
      const res = await fetch(url, {
        method: metodo,
        headers: corpo !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
        credentials: "same-origin",
        keepalive: !!(opzioni && opzioni.keepalive),   // permette all'invio di finire anche se la pagina si chiude
      });
      let json = null;
      try { json = await res.json(); } catch (e) { /* risposta senza corpo, per esempio 204 */ }
      return { stato: res.status, json };
    } catch (e) {
      return { stato: 0, json: null };
    }
  }

  // Un messaggio comprensibile per gli errori che possono capitare ovunque (null = non è uno di questi)
  function messaggioComune(r) {
    if (r.stato === 0) return "Non riesco a contattare il server. Controlla la connessione e riprova.";
    if (r.stato === 429) return "Troppi tentativi, riprova tra qualche minuto.";
    if (r.stato >= 500) return "Qualcosa non ha funzionato sul server. Riprova tra poco.";
    return null;
  }

  // Esce. Il cookie di sessione si può togliere SOLO dal server: se il server non risponde (niente rete) la sessione resta
  // aperta su questo dispositivo, e lo diciamo chiaramente invece di fingere di essere usciti (su un dispositivo condiviso
  // la persona dopo potrebbe entrare nel tuo account). "dopo" (facoltativa) parte solo quando il server ha chiuso la sessione.
  async function esci(dopo) {
    const r = await chiama("POST", "/api/auth/logout");
    if (r.stato === 0) {
      window.alert("Non riesco a uscire: manca la connessione, quindi su questo dispositivo la sessione resta aperta. Riprova quando torna la rete.");
      return false;
    }
    if (dopo) dopo();
    location.replace("/");   // dopo l'uscita si torna alla schermata iniziale di Lena, non al login
    return true;
  }

  window.Lena = { chiama, messaggioComune, esci };
})();
