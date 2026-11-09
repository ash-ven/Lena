/* "Carica scheda da Excel" nella pagina del cliente.
   Il file Excel NON esce dal browser: lo legge la libreria SheetJS (web/vendor), lo trasforma convertitore.js
   (lo stesso codice della pagina vecchia) e al server arriva solo l'oggetto della scheda.

   Regole che applica prima di inviare:
   - errori che BLOCCANO (non c'è la data di inizio, nessun giorno, formato non valido...): il pulsante resta spento;
   - avvisi che non bloccano: si mostrano ben visibili e serve la spunta «ho letto gli avvisi» per inviare;
   - nome e cognome scritti nell'Excel diversi da quelli del cliente: avviso esplicito, e serve la spunta. */
(function () {
  const $ = (id) => document.getElementById(id);
  const { el, messaggio, normalizza } = LenaPt;

  let cliente = null, suInviata = null;
  let dati = null, serveConferma = false, inCorso = false, chiudiCornice = null;

  function aggiornaPulsante() {
    $("conv-invia").disabled = inCorso || !dati || (serveConferma && !$("conv-ok").checked);
  }

  function azzera() {
    dati = null; serveConferma = false;
    $("conv-messaggi").replaceChildren();
    $("conv-conferma").hidden = true;
    $("conv-ok").checked = false;
    if (chiudiCornice) { chiudiCornice(); chiudiCornice = null; }
    $("conv-anteprima").hidden = true;
    aggiornaPulsante();
  }

  // Due persone sono "la stessa" se le parole di nome e cognome sono le stesse, anche in ordine diverso o con maiuscole/accenti diversi
  const paroleNome = (n, c) => normalizza(`${n} ${c}`).split(" ").filter(Boolean).sort().join(" ");

  async function sceltoFile(ev) {
    azzera();
    const file = ev.target.files[0];
    if (!file) return;
    const box = $("conv-messaggi");
    box.append(el("p", { class: "attesa-pt" }, "Leggo il file…"));

    let risultato;
    try {
      risultato = LenaConvertitore.convertiXlsx(XLSX, await file.arrayBuffer());
    } catch (e) {
      box.replaceChildren(messaggio("errore", "Non riesco a leggere questo file", ["Controlla che sia un file Excel (.xlsx) e che non sia danneggiato."]));
      return;
    }
    box.replaceChildren();
    const avvisi = risultato.avvisi.slice();

    // ---- errori che bloccano ----
    if (!risultato.dati) {
      box.append(messaggio("errore", "La scheda non si può creare", avvisi));
      return;
    }
    const errore = LenaValidaScheda.erroreScheda(risultato.dati);
    if (errore) {
      box.append(messaggio("errore", "La scheda non si può inviare", [errore, ...avvisi]));
      return;
    }

    // ---- avvisi che non bloccano ----
    dati = risultato.dati;
    const info = dati.info;
    const nomeDiverso = paroleNome(info.nome, info.cognome) !== paroleNome(cliente.nome, cliente.cognome);
    if (nomeDiverso) {
      box.append(messaggio("avviso", "Attenzione: il nome nell'Excel è diverso da quello del cliente", [
        `Nel file c'è «${[info.nome, info.cognome].filter(Boolean).join(" ") || "(nessun nome)"}», ma stai caricando la scheda per «${cliente.nome} ${cliente.cognome}».`,
        "Controlla di aver scelto il file giusto e il cliente giusto prima di inviare.",
      ]));
    }
    if (avvisi.length) {
      box.append(messaggio("avviso", avvisi.length === 1 ? "C'è 1 avviso da controllare" : `Ci sono ${avvisi.length} avvisi da controllare`, avvisi));
    }
    serveConferma = nomeDiverso || avvisi.length > 0;
    if (!serveConferma) {
      box.append(messaggio("ok", "Scheda pronta: nessun avviso", [
        `«${info.titolo || "Scheda"}»: ${dati.settimane} settimane dal ${LenaPt.dataBreve(dati.inizio)}, ${dati.giorni.length} giorni.`]));
    } else {
      $("conv-ok-testo").textContent = nomeDiverso && !avvisi.length
        ? "So che il nome è diverso e voglio inviare la scheda a questo cliente"
        : "Ho letto gli avvisi e voglio inviare lo stesso";
      $("conv-conferma").hidden = false;
    }

    // ---- anteprima nel telefono ----
    $("conv-anteprima").hidden = false;
    chiudiCornice = LenaPt.cornice($("conv-anteprima"), dati);
    aggiornaPulsante();
  }

  async function invia() {
    if (inCorso || !dati) return;
    inCorso = true;
    $("conv-invia").textContent = "Invio…";
    aggiornaPulsante();
    const r = await LenaPt.chiama("POST", `/api/clienti/${cliente.id}/schede`, { dati });
    inCorso = false;
    $("conv-invia").textContent = "Invia al cliente";

    if (r.stato === 201) {
      const titolo = dati.info.titolo || "La scheda";
      azzera();
      $("conv-file").value = "";
      $("conv-messaggi").append(messaggio("ok", "Scheda inviata", [`«${titolo}» è stata caricata: ${cliente.registrato ? "il cliente la vede subito." : "il cliente la vedrà appena entra con il suo invito."}`]));
      aggiornaPulsante();
      if (suInviata) await suInviata();
      return;
    }
    const motivo = r.stato === 400 && r.json && r.json.errore ? `Il server non ha accettato la scheda: ${r.json.errore}` : LenaPt.testoErrore(r, "inviare la scheda");
    $("conv-messaggi").append(messaggio("errore", "La scheda non è stata inviata", [motivo]));
    aggiornaPulsante();   // si può riprovare
  }

  function apri(aperto) {
    $("convertitore").hidden = !aperto;
    $("apri-convertitore").hidden = aperto;
    $("apri-convertitore").setAttribute("aria-expanded", String(aperto));
    if (aperto) $("conv-file").focus(); else $("apri-convertitore").focus();
  }

  function avvia(c, dopoInvio) {
    cliente = c; suInviata = dopoInvio;
    $("apri-convertitore").addEventListener("click", () => apri(true));
    $("conv-annulla").addEventListener("click", () => { azzera(); $("conv-file").value = ""; apri(false); });
    $("conv-file").addEventListener("change", sceltoFile);
    $("conv-ok").addEventListener("change", aggiornaPulsante);
    $("conv-invia").addEventListener("click", invia);
  }

  window.LenaPtConverti = { avvia };
})();
