/* pt.html: l'elenco dei clienti del PT, la ricerca e il modulo "Nuovo cliente". */
(function () {
  const $ = (id) => document.getElementById(id);
  const { el, normalizza } = LenaPt;
  let clienti = [];

  $("esci").addEventListener("click", () => Lena.esci());

  // La foto del cliente (o le sue iniziali)
  function avatar(c) {
    const a = el("span", { class: "avatar" });
    LenaProfilo.disegnaAvatar(a, { nome: `${c.nome} ${c.cognome}`, haFoto: c.ha_foto, fotoAggiornataIl: c.foto_aggiornata_il }, `/api/clienti/${c.id}/foto`);
    return a;
  }

  // ---------- elenco, ricerca e ordine ----------
  // L'ordine scelto si ricorda su questo dispositivo (solo una comodità: se la memoria è bloccata si riparte da «Cognome»)
  const CHIAVE_ORDINE = "lena:ordine-clienti";
  let ordine = "cognome";
  try { const salvato = localStorage.getItem(CHIAVE_ORDINE); if (LenaOrdinaClienti.OPZIONI.some((o) => o.id === salvato)) ordine = salvato; } catch (e) { /* memoria bloccata */ }
  $("ordine").replaceChildren(...LenaOrdinaClienti.OPZIONI.map((o) => el("option", { value: o.id, selected: o.id === ordine ? "" : null }, o.testo)));
  $("ordine").addEventListener("change", () => {
    ordine = $("ordine").value;
    try { localStorage.setItem(CHIAVE_ORDINE, ordine); } catch (e) { /* pazienza */ }
    disegnaElenco();
  });

  function disegnaElenco() {
    const q = normalizza($("cerca").value);
    const visibili = LenaOrdinaClienti.ordina(clienti, ordine).filter((c) => normalizza(`${c.nome} ${c.cognome} ${c.cognome} ${c.nome}`).includes(q));
    const ul = $("elenco");
    ul.replaceChildren(...visibili.map((c) => {
      const r = LenaPt.riepilogoRiga(c);
      return el("li", {}, el("a", { href: `/pt-cliente.html?id=${c.id}` },
        avatar(c),
        el("span", { class: "corpo-cliente" },
          el("span", { class: "nome-cliente" }, `${c.nome} ${c.cognome}`),
          el("span", { class: "dettaglio" },
            r.stato.tipo === "neutro" ? null : el("span", { class: `stato ${r.stato.tipo}` }, r.stato.breve),
            LenaPt.haBozza(c.id) ? el("span", { class: "stato bozza" }, "Bozza in corso") : null, r.testo),
          r.scad ? el("span", { class: "dettaglio scadenza-riga" + (r.scad.urgente ? " urgente" : "") }, r.scad.testo) : null),
        el("span", { class: "icona i-avanti vai", "aria-hidden": "true" })));
    }));
    $("conteggio").textContent = !clienti.length ? "" : q
      ? `${visibili.length} su ${clienti.length}`
      : `${clienti.length} ${clienti.length === 1 ? "cliente" : "clienti"}`;
    const vuoto = $("stato-elenco");
    vuoto.replaceChildren();
    if (!clienti.length) vuoto.append(el("p", { class: "attesa-pt" }, "Non hai ancora clienti. Crea il primo con «Nuovo cliente»."));
    else if (!visibili.length) vuoto.append(el("p", { class: "attesa-pt" }, "Nessun cliente corrisponde alla ricerca."));
  }
  $("cerca").addEventListener("input", disegnaElenco);

  // ---------- schede in scadenza (entro 14 giorni, o già scadute): le più urgenti per prime ----------
  function disegnaScadenze() {
    const urgenti = clienti.map((c) => ({ c, s: LenaPt.scadenza(c) })).filter((x) => x.s).sort((a, b) => a.s.giorni - b.s.giorni);
    $("in-scadenza").hidden = !urgenti.length;
    $("elenco-scadenze").replaceChildren(...urgenti.map(({ c, s }) => el("li", {}, el("a", { href: `/pt-cliente.html?id=${c.id}` },
      avatar(c),
      el("span", { class: "corpo-cliente" },
        el("span", { class: "nome-cliente" }, `${c.nome} ${c.cognome}`),
        el("span", { class: "dettaglio" }, `La scheda finisce il ${LenaPt.dataBreve(s.data)}.`)),
      el("span", { class: "conto" }, el("span", { class: "solo-lettori" }, s.testo),
        el("b", { "aria-hidden": "true" }, s.giorni === 0 ? "Oggi" : String(Math.abs(s.giorni))),
        el("small", { "aria-hidden": "true" }, s.giorni === 0 ? "" : s.giorni > 0 ? (s.giorni === 1 ? "giorno" : "giorni") : "giorni fa · scaduta")),
      el("span", { class: "icona i-avanti vai", "aria-hidden": "true" })))));
  }

  async function carica() {
    $("stato-elenco").replaceChildren(el("p", { class: "attesa-pt" }, "Carico i clienti…"));
    $("contenuto").setAttribute("aria-busy", "true");
    const r = await LenaPt.chiama("GET", "/api/clienti");
    $("contenuto").removeAttribute("aria-busy");
    if (r.stato !== 200) {
      $("stato-elenco").replaceChildren(
        LenaPt.messaggio("errore", "Non riesco a caricare i clienti", [LenaPt.testoErrore(r, "caricare i clienti")]),
        el("button", { class: "bottone", type: "button", onclick: carica }, "Riprova"));
      $("elenco").replaceChildren();
      $("conteggio").textContent = "";
      return;
    }
    clienti = r.json;
    disegnaScadenze();
    disegnaElenco();
    if (copiaDa && !copiaAperta) { copiaAperta = true; apriScelta(true, "copia"); }
  }

  // ---------- crea una scheda da qui: si sceglie il cliente e si apre l'editor ----------
  const attivi = () => clienti.filter((c) => !c.rapporto_finito_il);
  let modoScelta = "crea";   // "crea" = editor; "carica" = caricamento di un Excel (nella pagina del cliente)
  // «Copia per un altro cliente» arriva dalla pagina di un cliente con ?copia=ID della scheda da copiare
  const copiaDa = (() => { const v = new URLSearchParams(location.search).get("copia"); return /^[1-9]\d{0,8}$/.test(v || "") ? Number(v) : null; })();
  let copiaAperta = false;
  const indirizzoScelta = (c) => modoScelta === "copia" ? `/pt-editor.html?cliente=${c.id}&base=${copiaDa}` : modoScelta === "carica" ? `/pt-cliente.html?id=${c.id}&carica=1` : `/pt-editor.html?cliente=${c.id}`;
  function disegnaScelta() {
    const q = normalizza($("cerca-scelta").value);
    const lista = attivi().filter((c) => normalizza(`${c.nome} ${c.cognome} ${c.cognome} ${c.nome}`).includes(q));
    $("elenco-scelta").replaceChildren(...lista.map((c) => el("li", {}, el("a", { href: indirizzoScelta(c) },
      avatar(c),
      el("span", { class: "corpo-cliente" }, el("span", { class: "nome-cliente" }, `${c.nome} ${c.cognome}`)),
      el("span", { class: "icona i-avanti vai", "aria-hidden": "true" })))));
    $("scelta-nessuno").hidden = lista.length > 0 || !attivi().length;
  }
  function apriScelta(aperto, modo) {
    if (modo) modoScelta = modo;
    $("scelta-cliente").hidden = !aperto;
    for (const [bottone, m] of [["apri-scelta", "crea"], ["apri-carica", "carica"]]) $(bottone).setAttribute("aria-expanded", String(aperto && modoScelta === m));
    if (aperto) {
      $("scelta-descrizione").textContent = modoScelta === "copia" ? "Scegli il cliente a cui dare una copia di questa scheda: la apri nell'editor, cambi quello che serve e la invii." : modoScelta === "carica" ? "Scegli il cliente: poi carichi il file Excel con la sua scheda." : "Scegli il cliente: poi compili la scheda qui, in Lena.";
      const vuoto = !attivi().length;
      $("scelta-vuoto").hidden = !vuoto; $("scelta-corpo").hidden = vuoto;
      $("cerca-scelta").value = ""; disegnaScelta();
      (vuoto ? $("annulla-scelta") : $("cerca-scelta")).focus();
    } else $(modoScelta === "carica" ? "apri-carica" : "apri-scelta").focus();
  }
  // lo stesso pannello serve ai due pulsanti: se è già aperto per l'altro scopo, cambia scopo; se è per lo stesso, si chiude
  function pulsanteScelta(modo) {
    if (!$("modulo-nuovo").hidden) $("annulla-nuovo").click();
    apriScelta($("scelta-cliente").hidden || modoScelta !== modo, modo);
  }
  $("apri-scelta").addEventListener("click", () => pulsanteScelta("crea"));
  $("apri-carica").addEventListener("click", () => pulsanteScelta("carica"));
  $("annulla-scelta").addEventListener("click", () => apriScelta(false));
  $("cerca-scelta").addEventListener("input", disegnaScelta);

  // ---------- nuovo cliente ----------
  const modulo = $("modulo-nuovo");
  function apriModulo(aperto) {
    modulo.hidden = !aperto;
    $("apri-nuovo").hidden = aperto;
    $("apri-nuovo").setAttribute("aria-expanded", String(aperto));
    $("errore-nuovo").replaceChildren();
    if (aperto) $("nuovo-nome").focus(); else $("apri-nuovo").focus();
  }
  $("apri-nuovo").addEventListener("click", () => { if (!$("scelta-cliente").hidden) apriScelta(false); apriModulo(true); });
  $("annulla-nuovo").addEventListener("click", () => { modulo.reset(); apriModulo(false); });

  let inCorso = false;   // contro il doppio clic: non nascono due clienti uguali
  modulo.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (inCorso) return;
    const nome = $("nuovo-nome").value.trim(), cognome = $("nuovo-cognome").value.trim();
    const errore = $("errore-nuovo");
    errore.replaceChildren();
    if (!nome || !cognome) {
      errore.append(LenaPt.messaggio("errore", "Servono nome e cognome."));
      (nome ? $("nuovo-cognome") : $("nuovo-nome")).focus();
      return;
    }
    inCorso = true;
    $("crea-cliente").disabled = true;
    $("crea-cliente").textContent = "Creo il cliente…";
    const r = await LenaPt.chiama("POST", "/api/clienti", { nome, cognome });
    if (r.stato === 201) { location.assign(`/pt-cliente.html?id=${r.json.id}`); return; }   // va subito alla sua pagina
    inCorso = false;
    $("crea-cliente").disabled = false;
    $("crea-cliente").textContent = "Crea cliente";
    errore.append(LenaPt.messaggio("errore", LenaPt.testoErrore(r, "creare il cliente")));
  });

  // ---------- avvio ----------
  (async () => {
    const utente = await LenaPt.verificaPt();
    const msg = LenaPt.prendiMessaggio();
    if (msg) $("messaggio-pagina").append(LenaPt.messaggio("ok", msg));
    if (!utente) {   // il server non risponde: lo diciamo con il pulsante "Riprova"
      $("stato-elenco").replaceChildren(
        LenaPt.messaggio("errore", "Non riesco a collegarmi al server", ["Controlla la connessione e riprova."]),
        el("button", { class: "bottone", type: "button", onclick: () => location.reload() }, "Riprova"));
      return;
    }
    carica();
    // I dati del titolare servono all'informativa dei clienti: senza, non si può invitare nessuno
    const t = await LenaPt.chiama("GET", "/api/pt/titolare");
    if (t.stato === 200 && !t.json.completo) {
      $("messaggio-pagina").append(LenaPt.messaggio("avviso", "Completa i dati per l'informativa privacy", [
        el("span", {}, "Prima di invitare i tuoi clienti serve il tuo nome (o della palestra), l'indirizzo e un'email per la privacy. ",
          el("a", { href: "/pt-profilo.html" }, "Vai al tuo profilo"), "."),
      ]));
    }
  })();
})();
