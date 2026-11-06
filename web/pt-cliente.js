/* pt-cliente.html?id=...: la pagina di un cliente del PT.
   Mette insieme: dati e stato, elenco schede, caricamento dell'Excel (pt-converti.js), invito,
   progressi (pt-progressi.js) e dati personali (esporta / cancella). */
(function () {
  const $ = (id) => document.getElementById(id);
  const { el, messaggio, statoCliente } = LenaPt;

  const id = (() => { const v = new URLSearchParams(location.search).get("id"); return /^[1-9]\d{0,8}$/.test(v || "") ? Number(v) : null; })();
  let cliente = null;
  let firmaProgressi = null;   // cambia solo se cambiano schede, valori segnati o registrazione: allora si ricarica la vista dei progressi

  $("esci").addEventListener("click", () => Lena.esci());

  function erroreIntera(titolo, testo, riprova) {
    $("pagina").hidden = true;
    $("stato-pagina").replaceChildren(
      messaggio("errore", titolo, testo ? [testo] : []),
      riprova ? el("button", { class: "bottone", type: "button", onclick: riprova }, "Riprova") : el("a", { class: "bottone", href: "/pt.html" }, "Torna ai clienti"));
  }

  // ---------- disegno ----------
  function disegnaDati() {
    const s = statoCliente(cliente);
    document.title = `${cliente.nome} ${cliente.cognome} · Lena`;
    $("nome-cliente").textContent = `${cliente.nome} ${cliente.cognome}`;
    $("riga-stato").replaceChildren(el("span", { class: `stato ${s.tipo}` }, s.testo), " ",
      cliente.registrato ? "Ha creato il suo accesso." : "Non ha ancora creato il suo accesso.");
    $("nome-da-scrivere").textContent = `${cliente.nome} ${cliente.cognome}`;
  }

  function disegnaSchede(schede) {
    const lista = $("schede-lista");
    lista.replaceChildren(...schede.map((s, i) => el("li", {},
      el("span", { class: "titolo-scheda" }, s.titolo || "Scheda"),
      i === 0 ? el("span", { class: "etichetta" }, "la vede il cliente") : null,
      el("div", { class: "nota" }, `Caricata il ${LenaPt.dataBreve(s.creata_il)} · ${s.settimane} settimane dal ${LenaPt.dataBreve(s.inizio)}`
        + (s.registrazioni ? ` · ${s.registrazioni} valori segnati` : "")))));
    $("schede-vuoto").hidden = schede.length > 0;
  }

  function disegnaInvito() {
    const stato = $("invito-stato"), bottone = $("crea-invito");
    if (cliente.registrato) {
      stato.textContent = "Il cliente ha già creato il suo accesso: non serve un invito.";
      bottone.hidden = true;
      return;
    }
    bottone.hidden = false;
    if (cliente.invito_attivo) {
      stato.textContent = `C'è un invito attivo, valido fino al ${LenaPt.dataBreve(cliente.invito_scade_il)}. Il link si vede una sola volta, quando lo crei: se non ce l'hai più, creane uno nuovo (quello vecchio smette di funzionare).`;
      bottone.textContent = "Crea un nuovo invito";
    } else {
      stato.textContent = "Per far entrare il cliente crea un invito: ottieni un link da mandargli. Vale 7 giorni e si può usare una volta sola.";
      bottone.textContent = "Crea invito";
    }
  }

  // ---------- caricamento ----------
  async function ricarica(silenzioso) {
    if (!silenzioso) {
      $("stato-pagina").replaceChildren(el("p", { class: "attesa-pt" }, "Carico il cliente…"));
      $("contenuto").setAttribute("aria-busy", "true");
    }
    const [c, s] = await Promise.all([LenaPt.chiama("GET", `/api/clienti/${id}`), LenaPt.chiama("GET", `/api/clienti/${id}/schede`)]);
    $("contenuto").removeAttribute("aria-busy");
    if (c.stato === 404) return erroreIntera("Cliente non trovato", "Questo cliente non esiste (o è stato cancellato).");
    if (c.stato !== 200 || s.stato !== 200) {
      const r = c.stato !== 200 ? c : s;
      return erroreIntera("Non riesco a caricare il cliente", LenaPt.testoErrore(r, "caricare il cliente"), () => ricarica(false));
    }
    cliente = c.json;
    $("stato-pagina").replaceChildren();
    $("pagina").hidden = false;
    disegnaDati();
    disegnaSchede(s.json);
    disegnaInvito();
    const firma = JSON.stringify([cliente.registrato, cliente.ultimo_progresso, s.json.map((x) => [x.id, x.registrazioni])]);
    if (firma !== firmaProgressi) { firmaProgressi = firma; LenaPtProgressi.aggiorna(cliente, s.json); }
  }

  // ---------- invito ----------
  let invitoInCorso = false;
  $("crea-invito").addEventListener("click", async () => {
    if (invitoInCorso) return;   // il doppio clic non crea due inviti (il secondo annullerebbe il primo!)
    invitoInCorso = true;
    $("crea-invito").disabled = true;
    const zona = $("invito-nuovo");
    zona.replaceChildren();
    const r = await LenaPt.chiama("POST", `/api/clienti/${id}/invito`);
    invitoInCorso = false;
    $("crea-invito").disabled = false;
    if (r.stato !== 201) {
      zona.append(messaggio("errore", r.stato === 409 ? "Questo cliente ha già un account" : "Non sono riuscito a creare l'invito", [LenaPt.testoErrore(r, "creare l'invito")]));
      if (r.stato === 409) ricarica(true);
      return;
    }
    const link = `${location.origin}/registrati.html?codice=${encodeURIComponent(r.json.codice)}`;
    const campo = el("input", { type: "text", readonly: true, value: link, id: "link-invito", "aria-label": "Link di invito da mandare al cliente" });
    const esito = el("span", { class: "nota", role: "status" });
    const copia = el("button", { class: "bottone", type: "button" }, "Copia");
    copia.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(link); esito.textContent = "Copiato ✓"; }
      catch (e) {
        campo.focus(); campo.select();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (e2) { /* non disponibile */ }
        esito.textContent = ok ? "Copiato ✓" : "Non riesco a copiare da solo: il link è selezionato, premi Ctrl+C.";
      }
    });
    zona.append(messaggio("ok", "Invito creato", [
      `Manda questo link al cliente. Scade il ${LenaPt.dataBreve(r.json.scade_il)} e si può usare una volta sola.`]),
      el("div", { class: "link-invito" }, campo, copia), esito,
      messaggio("avviso", "Copialo adesso", [
        "Il link si vede una volta sola: se lasci o ricarichi questa pagina non puoi più rivederlo.",
        "Se ne crei un altro, questo smette di funzionare."]));
    campo.focus(); campo.select();
    ricarica(true);   // aggiorna lo stato dell'invito, senza cancellare il link appena mostrato
  });

  // ---------- dati personali ----------
  $("esporta").addEventListener("click", async () => {
    const esito = $("esporta-esito");
    esito.replaceChildren(el("p", { class: "nota" }, "Preparo il file…"));
    $("esporta").disabled = true;
    try {
      const res = await fetch(`/api/clienti/${id}/esporta`, { credentials: "same-origin" });
      if (res.status === 401) return LenaPt.vaiAlLogin();
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const a = el("a", { href: URL.createObjectURL(blob), download: `lena-${cliente.cognome}-${cliente.nome}.json`.toLowerCase().replace(/[^a-z0-9.]+/g, "-") });
      document.body.append(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      esito.replaceChildren(messaggio("ok", "File scaricato", ["Contiene l'anagrafica, le schede e i progressi del cliente."]));
    } catch (e) {
      esito.replaceChildren(messaggio("errore", "Non sono riuscito a scaricare i dati", ["Controlla la connessione e riprova."]));
    }
    $("esporta").disabled = false;
  });

  const uguali = () => LenaPt.normalizza($("conferma-nome").value) === LenaPt.normalizza(`${cliente.nome} ${cliente.cognome}`);
  $("conferma-nome").addEventListener("input", () => { $("cancella").disabled = !uguali(); });

  let cancellazioneInCorso = false;
  $("cancella").addEventListener("click", async () => {
    if (cancellazioneInCorso || !uguali()) return;
    cancellazioneInCorso = true;
    $("cancella").disabled = true; $("cancella").textContent = "Cancello…";
    const r = await LenaPt.chiama("DELETE", `/api/clienti/${id}`);
    if (r.stato === 204) {
      LenaPt.ricordaMessaggio(`Cliente «${cliente.nome} ${cliente.cognome}» cancellato, con le sue schede, i suoi progressi e il suo account.`);
      location.replace("/pt.html");
      return;
    }
    cancellazioneInCorso = false;
    $("cancella").textContent = "Cancella cliente";
    $("cancella").disabled = !uguali();
    $("cancella-esito").replaceChildren(messaggio("errore", "Non ho cancellato niente", [LenaPt.testoErrore(r, "cancellare il cliente")]));
  });

  // ---------- avvio ----------
  (async () => {
    if (!id) return erroreIntera("Indirizzo non valido", "Manca il numero del cliente. Torna all'elenco e scegli un cliente.");
    const utente = await LenaPt.verificaPt();
    if (!utente) return erroreIntera("Non riesco a collegarmi al server", "Controlla la connessione e riprova.", () => location.reload());
    LenaPtProgressi.avvia();
    await ricarica(false);
    if (cliente) LenaPtConverti.avvia(cliente, () => ricarica(true));
  })();
})();
