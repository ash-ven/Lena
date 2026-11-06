/* pt.html: l'elenco dei clienti del PT, la ricerca e il modulo "Nuovo cliente". */
(function () {
  const $ = (id) => document.getElementById(id);
  const { el, normalizza, statoCliente } = LenaPt;
  let clienti = [];

  $("esci").addEventListener("click", () => Lena.esci());

  // La foto del cliente (o le sue iniziali)
  function avatar(c) {
    const a = el("span", { class: "avatar" });
    LenaProfilo.disegnaAvatar(a, { nome: `${c.nome} ${c.cognome}`, haFoto: c.ha_foto, fotoAggiornataIl: c.foto_aggiornata_il }, `/api/clienti/${c.id}/foto`);
    return a;
  }

  // ---------- elenco e ricerca ----------
  function disegnaElenco() {
    const q = normalizza($("cerca").value);
    const visibili = clienti.filter((c) => normalizza(`${c.nome} ${c.cognome} ${c.cognome} ${c.nome}`).includes(q));
    const ul = $("elenco");
    ul.replaceChildren(...visibili.map((c) => {
      const s = statoCliente(c);
      return el("li", {}, el("a", { href: `/pt-cliente.html?id=${c.id}` },
        avatar(c),
        el("span", { class: "corpo-cliente" },
          el("span", { class: "nome-cliente" }, `${c.cognome} ${c.nome}`),
          el("span", { class: `stato ${s.tipo}` }, s.breve),
          el("span", { class: "dettaglio" }, s.dettaglio)),
        el("span", { class: "icona i-avanti", "aria-hidden": "true" })));
    }));
    $("conteggio").textContent = !clienti.length ? "" : q
      ? `${visibili.length} ${visibili.length === 1 ? "cliente trovato" : "clienti trovati"} su ${clienti.length}`
      : `${clienti.length} ${clienti.length === 1 ? "cliente" : "clienti"}`;
    const vuoto = $("stato-elenco");
    vuoto.replaceChildren();
    if (!clienti.length) vuoto.append(el("p", { class: "attesa-pt" }, "Non hai ancora clienti. Crea il primo con «Nuovo cliente»."));
    else if (!visibili.length) vuoto.append(el("p", { class: "attesa-pt" }, "Nessun cliente corrisponde alla ricerca."));
  }
  $("cerca").addEventListener("input", disegnaElenco);

  // ---------- riepilogo in numeri ----------
  function disegnaRiepilogo() {
    const ul = $("riepilogo");
    ul.hidden = !clienti.length;
    if (!clienti.length) return;
    const attivi = clienti.filter((c) => !c.rapporto_finito_il && c.registrato && c.ultimo_progresso).length;
    const inviti = clienti.filter((c) => !c.rapporto_finito_il && c.schede && !c.registrato && c.invito_attivo).length;
    const senza = clienti.filter((c) => !c.rapporto_finito_il && !c.schede).length;
    const voce = (n, t) => el("li", {}, el("span", { class: "cifra" }, String(n)), el("span", { class: "dida" }, t));
    ul.replaceChildren(voce(clienti.length, clienti.length === 1 ? "cliente" : "clienti"), voce(attivi, attivi === 1 ? "si allena" : "si allenano"),
      voce(inviti, inviti === 1 ? "invito in attesa" : "inviti in attesa"), voce(senza, "senza scheda"));
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
    disegnaRiepilogo();
    disegnaElenco();
  }

  // ---------- nuovo cliente ----------
  const modulo = $("modulo-nuovo");
  function apriModulo(aperto) {
    modulo.hidden = !aperto;
    $("apri-nuovo").hidden = aperto;
    $("apri-nuovo").setAttribute("aria-expanded", String(aperto));
    $("errore-nuovo").replaceChildren();
    if (aperto) $("nuovo-nome").focus(); else $("apri-nuovo").focus();
  }
  $("apri-nuovo").addEventListener("click", () => apriModulo(true));
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
  })();
})();
