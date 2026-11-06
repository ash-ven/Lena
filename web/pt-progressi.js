/* La vista dei progressi di un cliente, in sola lettura.
   Dati dal server: GET /api/schede/:id (la scheda) e GET /api/schede/:id/registrazioni (quello che ha segnato).
   Il riepilogo per settimana lo calcola progressi.js; la scheda con kg, ripetizioni e spunte è la STESSA
   scheda del cliente (scheda.js), mostrata in sola lettura dentro /anteprima.html: una sola fonte per la grafica. */
(function () {
  const $ = (id) => document.getElementById(id);
  const { el, messaggio } = LenaPt;

  let cliente = null, schede = [], chiudiCornice = null, giro = 0, ultimaPiuRecente = null;

  function vuoto(testo) {
    $("progressi").hidden = true;
    $("progressi-vuoto").textContent = testo;
    $("progressi-vuoto").hidden = false;
  }

  async function mostraScheda(schedaId) {
    const mio = ++giro;   // se nel frattempo si sceglie un'altra scheda, la risposta vecchia si butta
    $("progressi-settimane").replaceChildren(el("li", { class: "attesa-pt" }, "Carico i progressi…"));
    $("progressi-totale").textContent = "";
    $("progressi-aggiornati").textContent = "";

    const [s, reg] = await Promise.all([
      LenaPt.chiama("GET", `/api/schede/${schedaId}`),
      LenaPt.chiama("GET", `/api/schede/${schedaId}/registrazioni`),
    ]);
    if (mio !== giro) return;
    if (s.stato !== 200 || reg.stato !== 200) {
      const r = s.stato !== 200 ? s : reg;
      $("progressi-settimane").replaceChildren(
        messaggio("errore", "Non riesco a caricare i progressi", [LenaPt.testoErrore(r, "caricare i progressi")]),
        el("button", { class: "bottone secondario piccolo", type: "button", onclick: () => mostraScheda(schedaId) }, "Riprova"));
      return;
    }

    const dati = s.json.dati, registrazioni = reg.json;
    const settimane = LenaProgressi.riepilogoSettimane(dati, registrazioni);
    const tot = LenaProgressi.totale(settimane);
    $("progressi-totale").textContent = `In tutto: ${tot.completati} ${tot.completati === 1 ? "allenamento completato" : "allenamenti completati"} su ${tot.totali}`;
    $("progressi-settimane").replaceChildren(...settimane.map((x) => el("li", {},
      el("div", { class: "testo-sett" }, el("span", {}, LenaProgressi.frase(x))),
      el("progress", { max: x.totale, value: x.completati, "aria-label": `${x.etichetta}: ${x.completati} su ${x.totale}` }))));

    const ultimo = registrazioni.reduce((m, r) => (m && m > r.aggiornata_il ? m : r.aggiornata_il), null);
    $("progressi-aggiornati").textContent = ultimo ? `Ultimo salvataggio del cliente: ${LenaPt.dataOra(ultimo)}.` : "Il cliente non ha ancora segnato niente su questa scheda.";

    if (chiudiCornice) chiudiCornice();
    chiudiCornice = LenaPt.cornice($("progressi-scheda"), dati, registrazioni);
  }

  // Si chiama ogni volta che la pagina ha i dati del cliente e l'elenco delle sue schede (più recente per prima)
  function aggiorna(c, elencoSchede) {
    cliente = c; schede = elencoSchede;
    if (!schede.length) { if (chiudiCornice) { chiudiCornice(); chiudiCornice = null; } return vuoto("Nessuna scheda: caricane una per cominciare."); }
    if (!cliente.registrato) { if (chiudiCornice) { chiudiCornice(); chiudiCornice = null; } return vuoto("Il cliente non ha ancora creato il suo accesso, quindi non ha ancora segnato niente. Dopo la registrazione vedrai qui i suoi progressi."); }

    $("progressi-vuoto").hidden = true;
    $("progressi").hidden = false;
    const scelta = $("scelta-scheda");
    const precedente = scelta.value;
    // Se il PT stava guardando la scheda più recente (o non aveva scelto niente), quando ne arriva una nuova
    // passa a quella: è la scheda che vede il cliente. Se aveva scelto di proposito una scheda vecchia, resta lì.
    const guardavaLaPiuRecente = !precedente || precedente === ultimaPiuRecente;
    ultimaPiuRecente = String(schede[0].id);
    scelta.replaceChildren(...schede.map((s, i) => el("option", { value: s.id },
      `${s.titolo || "Scheda"} · caricata il ${LenaPt.dataBreve(s.creata_il)}${i === 0 ? " (la più recente)" : ""}`)));
    scelta.value = !guardavaLaPiuRecente && schede.some((s) => String(s.id) === precedente) ? precedente : ultimaPiuRecente;
    $("scelta-scheda-riga").hidden = schede.length < 2;
    mostraScheda(Number(scelta.value));
  }

  function avvia() {
    $("scelta-scheda").addEventListener("change", (ev) => mostraScheda(Number(ev.target.value)));
    $("aggiorna-progressi").addEventListener("click", () => mostraScheda(Number($("scelta-scheda").value)));
  }

  window.LenaPtProgressi = { avvia, aggiorna };
})();
