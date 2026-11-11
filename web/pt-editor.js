/* pt-editor.html?cliente=...: l'editor delle schede.
   Il trainer compila il modulo; qui si costruisce LO STESSO oggetto «dati» che produce il convertitore dell'Excel,
   si controlla con la stessa funzione (valida-scheda.js) e si invia allo stesso indirizzo. La scheda del cliente non cambia.

   Come è fatto:
   - «stato» è il modulo (testi così come scritti). Scrivere in un campo aggiorna lo stato, senza ridisegnare (il cursore resta dov'è).
     Aggiungere, togliere o spostare qualcosa ridisegna il modulo.
   - «costruisci()» trasforma lo stato nell'oggetto «dati» e raccoglie gli errori in italiano, con il punto preciso.
   - La bozza si ricorda su questo dispositivo (localStorage) finché la scheda non viene inviata.
   - Il nome di un esercizio si completa dalla libreria del trainer (/api/pt/esercizi) e ricompila il video già usato
     (anche quello scritto poco prima nella stessa scheda). Gli esercizi entrano in libreria quando la scheda viene inviata. */
(function () {
  const $ = (id) => document.getElementById(id);
  const { el, messaggio, normalizza } = LenaPt;

  const MAX_GIORNI = 7, MAX_BLOCCHI = 100;
  // gli stessi colori che usa il convertitore dell'Excel
  const PALETTE = [
    { colore: "D49A9A", chiaro: "F6E9E7", scuro: "A86A6B" },
    { colore: "9DB5A0", chiaro: "E8EFE8", scuro: "62806A" },
    { colore: "D9B26F", chiaro: "F7EEDC", scuro: "9C7A3C" },
  ];
  const LETTERE = "ABCDEFGHIJKLMN";

  const idCliente = (() => { const v = new URLSearchParams(location.search).get("cliente"); return /^[1-9]\d{0,8}$/.test(v || "") ? Number(v) : null; })();
  const idBase = (() => { const v = new URLSearchParams(location.search).get("base"); return /^[1-9]\d{0,8}$/.test(v || "") ? Number(v) : null; })();   // scheda da cui partire (modifica o copia)
  let cliente = null, stato = null, chiudiCornice = null, contatore = 0, daFocalizzare = null, inCorso = false;

  $("esci").addEventListener("click", () => Lena.esci());

  // ---------- il modulo vuoto ----------
  const oggi = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const nuovoEsercizio = () => ({ tipo: "esercizio", nome: "", serie: "", rip: "", rec: "", video: "", note: "", progressione: "", perSettimana: false, schema: [] });
  const nuovoCircuito = () => ({ tipo: "circuito", formato: "EMOM", minuti: "10", rec: "", esercizi: [{ nome: "", rip: "", video: "" }] });
  const nuovoGiorno = () => ({ focus: "", stretching: true, stretchingDurata: "5-10'", blocchi: [] });
  const nuovoStato = () => ({ titolo: "", obiettivo: "", inizio: oggi(), settimane: "4", scarico: "1",
    risc: { durata: "10'", istruzione: "", esercizi: [{ nome: "", video: "" }] }, riscPerGiorno: false, giorni: [nuovoGiorno()] });
  // il riscaldamento di un giorno (solo se «uguale per tutti» è spento): nasce come copia di quello comune
  const copiaRisc = (r) => JSON.parse(JSON.stringify(r));
  const riscDelGiorno = (g) => g.risc || (g.risc = copiaRisc(stato.risc));

  // ---------- la bozza (solo su questo dispositivo) ----------
  const chiaveBozza = () => `lena:bozza:${idCliente}`;
  let timerBozza = null;
  function salvaBozza() {
    clearTimeout(timerBozza);
    timerBozza = setTimeout(() => { try { localStorage.setItem(chiaveBozza(), JSON.stringify(stato)); } catch (e) { /* pazienza */ } }, 400);
  }
  function leggiBozza() {
    try {
      const t = localStorage.getItem(chiaveBozza());
      if (!t) return null;
      const b = JSON.parse(t);
      return b && Array.isArray(b.giorni) && b.risc && Array.isArray(b.risc.esercizi) ? b : null;
    } catch (e) { return null; }
  }
  function cancellaBozza() { clearTimeout(timerBozza); try { localStorage.removeItem(chiaveBozza()); } catch (e) { /* pazienza */ } }

  // ---------- libreria esercizi ----------
  const conosciuti = new Map();   // dalla libreria del trainer: nome normalizzato → { nome, video }
  const locali = new Map();       // video scritti in questa scheda (anche prima dell'invio): nome normalizzato → video
  let timerRicerca = null;
  function ricerca(testo, quando) {
    clearTimeout(timerRicerca);
    if (!testo.trim()) { quando([]); return; }
    timerRicerca = setTimeout(async () => {
      const r = await Lena.chiama("GET", `/api/pt/esercizi?q=${encodeURIComponent(testo.trim())}`);
      if (r.stato !== 200 || !Array.isArray(r.json)) return quando([]);   // senza libreria si scrive a mano: niente di grave
      for (const e of r.json) conosciuti.set(normalizza(e.nome), e);
      quando(r.json);
    }, 200);
  }
  const videoNoto = (nome) => { const k = normalizza(nome); return locali.get(k) || (conosciuti.get(k) || {}).video || ""; };
  // Se il nome è già noto e il video è vuoto, lo ricompila (si chiama a ogni lettera, a fine ricerca e quando si sceglie un suggerimento)
  function proponiVideo(input, oggetto) {
    const contenitore = input.closest("[data-voce]");
    const video = contenitore && contenitore.querySelector('[data-campo="video"]');
    const noto = videoNoto(input.value);
    if (!noto || !video || video.value) return;
    video.value = noto; oggetto.video = noto; salvaBozza();
    const campoVideo = video.closest(".campo-pt");
    if (campoVideo && !campoVideo.querySelector(".aiuto-pt")) campoVideo.append(el("span", { class: "aiuto-pt" }, "Video ricordato: puoi cambiarlo."));
  }

  // L'elenco dei suggerimenti: sempre sotto il campo e largo come il campo. Frecce e Invio da tastiera, Esc per chiudere.
  function conSuggerimenti(input, oggetto) {
    const idLista = nuovoId("lista");
    const lista = el("ul", { class: "suggerimenti", id: idLista, role: "listbox", "aria-label": "Esercizi che hai già usato e dal catalogo", hidden: "" });
    input.setAttribute("role", "combobox"); input.setAttribute("aria-autocomplete", "list"); input.setAttribute("aria-expanded", "false"); input.setAttribute("aria-controls", idLista);
    let voci = [], attiva = -1;
    const chiudi = () => { lista.hidden = true; attiva = -1; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); };
    const evidenzia = (n) => {
      attiva = n;
      [...lista.children].forEach((li, k) => li.setAttribute("aria-selected", k === n ? "true" : "false"));
      if (n >= 0) input.setAttribute("aria-activedescendant", lista.children[n].id); else input.removeAttribute("aria-activedescendant");
    };
    const scegli = (e) => {
      input.value = e.nome; oggetto.nome = e.nome; chiudi(); salvaBozza(); proponiVideo(input, oggetto);
    };
    const mostra = (elenco) => {
      voci = elenco.filter((e) => !(elenco.length === 1 && normalizza(e.nome) === normalizza(input.value)));
      if (!voci.length) return chiudi();
      lista.replaceChildren(...voci.map((e, k) => el("li", { role: "option", id: `${idLista}-${k}`, "aria-selected": "false",
        onmousedown: (ev) => { ev.preventDefault(); scegli(e); } },
        el("span", { class: "nome-sugg" }, e.nome), e.video ? el("span", { class: "con-video" }, "con video") : null)));
      lista.hidden = false; input.setAttribute("aria-expanded", "true"); attiva = -1;
    };
    input.addEventListener("input", () => {
      proponiVideo(input, oggetto);
      if (!input.value.trim()) { clearTimeout(timerRicerca); return chiudi(); }
      const scritto = input.value;
      ricerca(scritto, (r) => {
        if (document.activeElement === input && input.value === scritto) mostra(r);
        proponiVideo(input, oggetto);   // la risposta può arrivare dopo l'ultima lettera: il video si ricompila lo stesso
      });
    });
    input.addEventListener("keydown", (ev) => {
      if (lista.hidden || !voci.length) return;
      if (ev.key === "ArrowDown") { ev.preventDefault(); evidenzia((attiva + 1) % voci.length); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); evidenzia((attiva - 1 + voci.length) % voci.length); }
      else if (ev.key === "Enter" && attiva >= 0) { ev.preventDefault(); scegli(voci[attiva]); }
      else if (ev.key === "Escape") { ev.preventDefault(); chiudi(); }
    });
    input.addEventListener("focusout", chiudi);
    return el("div", { class: "combo" }, input, lista);
  }

  // ---------- pezzi di modulo ----------
  const nuovoId = (p) => `${p}-${++contatore}`;

  // Un campo di testo legato a oggetto[chiave]
  function campo(etichetta, oggetto, chiave, o = {}) {
    const id = nuovoId("c");
    const input = el("input", { id, type: o.tipo || "text", value: oggetto[chiave] ?? "", maxlength: o.max || 200, placeholder: o.segnaposto || null,
      autocomplete: "off", inputmode: o.modo || null, "data-campo": o.nomeCampo || null, min: o.min || null, max: o.tipo === "number" ? o.maxNum : null });
    input.addEventListener("input", () => { oggetto[chiave] = input.value; salvaBozza(); if (o.alCambio) o.alCambio(input); });
    if (o.alFine) input.addEventListener("change", () => o.alFine(input));
    return el("div", { class: `campo-pt ${o.classe || ""}` }, el("label", { for: id }, etichetta), o.suggerisci ? conSuggerimenti(input, oggetto) : input, o.aiuto ? el("span", { class: "aiuto-pt" }, o.aiuto) : null);
  }
  function campoLungo(etichetta, oggetto, chiave, o = {}) {
    const id = nuovoId("c");
    const area = el("textarea", { id, rows: o.righe || 2, maxlength: o.max || 300, placeholder: o.segnaposto || null });
    area.value = oggetto[chiave] ?? "";
    area.addEventListener("input", () => { oggetto[chiave] = area.value; salvaBozza(); });
    return el("div", { class: "campo-pt" }, el("label", { for: id }, etichetta), area, o.aiuto ? el("span", { class: "aiuto-pt" }, o.aiuto) : null);
  }
  // Il nome di un esercizio: si completa dalla libreria e, se il video è vuoto, lo ricompila
  function campoNome(oggetto, etichetta = "Nome dell'esercizio") {
    return campo(etichetta, oggetto, "nome", { suggerisci: true, max: 100, nomeCampo: "nome" });
  }
  // Un video scritto qui vale subito per lo stesso esercizio nel resto della scheda; con l'invio entra nella libreria
  function campoVideo(oggetto) {
    return campo("Link al video (facoltativo)", oggetto, "video", { tipo: "url", max: 2000, segnaposto: "https://…", nomeCampo: "video", modo: "url",
      alFine: (input) => { const v = input.value.trim(), nome = oggetto.nome && normalizza(oggetto.nome); if (nome && v) locali.set(nome, v); } });
  }

  function pulsanteIcona(testo, classeIcona, azione, extra = "") {
    return el("button", { class: `bottone secondario piccolo icona-sola ${extra}`, type: "button", "aria-label": testo, title: testo, onclick: azione },
      el("span", { class: `icona ${classeIcona}`, "aria-hidden": "true" }));
  }
  function muovi(lista, i, d, focus) {
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    daFocalizzare = focus ? focus(j) : null; salvaBozza(); disegna();
  }
  function togli(lista, i) { lista.splice(i, 1); daFocalizzare = null; salvaBozza(); disegna(); }
  // Sposta su / sposta giù / togli, per qualsiasi elemento di una lista
  function comandi(lista, i, nome) {
    const focusSu = (j) => `[data-id="${nome}-${j}"]`;
    return el("div", { class: "comandi-riga" },
      pulsanteIcona(`Sposta su: ${nome}`, "i-su", () => muovi(lista, i, -1), i === 0 ? "spento" : ""),
      pulsanteIcona(`Sposta giù: ${nome}`, "i-giu", () => muovi(lista, i, +1), i === lista.length - 1 ? "spento" : ""),
      pulsanteIcona(`Togli: ${nome}`, "i-cestino", () => togli(lista, i), "pericolo"));
  }

  const settimaneLavoro = () => Math.max(1, (parseInt(stato.settimane, 10) || 1) - Math.max(0, parseInt(stato.scarico, 10) || 0));

  // ---------- disegno ----------
  function sezioneDati() {
    return el("section", { class: "pannello", "aria-labelledby": "t-dati" },
      el("h2", { class: "sezione-pt", id: "t-dati" }, "La scheda"),
      campo("Titolo", stato, "titolo", { max: 100, segnaposto: "Es. Programma forza e tonificazione" }),
      campo("Obiettivo (facoltativo)", stato, "obiettivo", { max: 100, segnaposto: "Es. Tonificazione" }),
      el("div", { class: "griglia-campi griglia-dati" },
        campo("Inizia il", stato, "inizio", { tipo: "date" }),
        campo("Settimane in tutto", stato, "settimane", { tipo: "number", min: "1", maxNum: "52", modo: "numeric", aiuto: "Comprese quelle di scarico", alCambio: aggiornaSettimane }),
        campo("Di cui di scarico", stato, "scarico", { tipo: "number", min: "0", maxNum: "51", modo: "numeric", aiuto: "Sono le ultime", alCambio: aggiornaSettimane })));
  }
  // se cambiano le settimane, gli schemi per settimana degli esercizi si adattano: si ridisegna a campo lasciato
  function aggiornaSettimane(input) {
    input.addEventListener("change", () => { sistemaSchemi(); disegna(); }, { once: true });
  }
  function sistemaSchemi() {
    const w = settimaneLavoro();
    for (const g of stato.giorni) for (const b of g.blocchi) if (b.tipo === "esercizio") {
      while (b.schema.length < w) b.schema.push("");
      b.schema.length = w;
    }
  }

  // Durata, istruzione ed esercizi di UN riscaldamento. «sigla» distingue quelli dei giorni (A, B…) dal comune.
  function bloccoRisc(r, sigla) {
    const pref = sigla ? `riscaldamento-${sigla}` : "riscaldamento";
    return el("div", {},
      el("div", { class: "griglia-campi" }, campo("Durata", r, "durata", { max: 20, segnaposto: "10'" }),
        campo("Come si fa", r, "istruzione", { max: 300, classe: "doppio", segnaposto: "Es. 2 giri senza pausa, ritmo leggero" })),
      el("ul", { class: "elenco-editor" }, r.esercizi.map((e, i) =>
        el("li", { class: "voce", "data-voce": "", "data-id": `${pref}-${i}` },
          el("div", { class: "testa-voce" }, el("strong", {}, `Esercizio ${i + 1}`), comandi(r.esercizi, i, `${pref}-${i}`)),
          campoNome(e), campoVideo(e)))),
      el("div", { class: "azioni-pt" }, el("button", { class: "bottone secondario", type: "button", onclick: () => {
        r.esercizi.push({ nome: "", video: "" }); daFocalizzare = `[data-id="${pref}-${r.esercizi.length - 1}"] input`; salvaBozza(); disegna(); } },
        el("span", { class: "icona i-piu", "aria-hidden": "true" }), "Aggiungi esercizio")));
  }

  function sezioneRiscaldamento() {
    const uguale = el("input", { type: "checkbox" }); uguale.checked = !stato.riscPerGiorno;
    uguale.addEventListener("change", () => {
      stato.riscPerGiorno = !uguale.checked;
      if (stato.riscPerGiorno) for (const g of stato.giorni) riscDelGiorno(g);   // ogni giorno parte da una copia di quello comune
      daFocalizzare = null; salvaBozza(); disegna();
    });
    return el("section", { class: "pannello", "aria-labelledby": "t-risc" },
      el("h2", { class: "sezione-pt", id: "t-risc" }, "Riscaldamento"),
      el("label", { class: "spunta-pt" }, uguale, el("span", {}, "Uguale per tutti i giorni")),
      el("p", { class: "nota" }, stato.riscPerGiorno ? "Ogni giorno ha il suo riscaldamento: il cliente lo vede all'inizio di quell'allenamento." : "Il cliente lo vede all'inizio di ogni allenamento."),
      stato.riscPerGiorno
        ? stato.giorni.map((g, n) => el("div", { class: "risc-giorno" }, el("h3", { class: "sotto-sezione" }, `Giorno ${LETTERE[n]}`), bloccoRisc(riscDelGiorno(g), LETTERE[n])))
        : bloccoRisc(stato.risc, ""));
  }

  function bloccoEsercizio(g, b, i) {
    const w = settimaneLavoro();
    const schema = b.perSettimana ? el("div", { class: "schema" },
      el("p", { class: "nota" }, "Scrivi per ogni settimana serie × ripetizioni: per esempio 6x6 la prima settimana, 6x7 la seconda. Le settimane di scarico si compilano da sole."),
      el("div", { class: "griglia-schema" }, Array.from({ length: w }, (_, n) =>
        campo(`Settimana ${n + 1}`, b.schema, n, { max: 10, segnaposto: "es. 6x6" })))) : null;
    const cambia = (w > 1 || b.perSettimana) ? el("label", { class: "spunta-pt" }, (() => {
      const c = el("input", { type: "checkbox" }); c.checked = b.perSettimana;
      c.addEventListener("change", () => {
        b.perSettimana = c.checked;
        if (!c.checked) {   // tornando ai valori fissi si riparte da quelli della prima settimana, se i campi sono vuoti
          const m = /^(\d+)x(\d+)$/i.exec(testo(b.schema[0]).replace(/\s/g, ""));
          if (m && !testo(b.serie)) b.serie = m[1];
          if (m && !testo(b.rip)) b.rip = m[2];
        }
        if (c.checked) { const prima = /^\d+$/.test(b.serie.trim()) && /^\d+$/.test(b.rip.trim()) ? `${b.serie.trim()}x${b.rip.trim()}` : ""; b.schema = Array.from({ length: w }, (_, n) => b.schema[n] || prima); }
        daFocalizzare = null; salvaBozza(); disegna();
      });
      return c;
    })(), el("span", {}, "Serie e ripetizioni cambiano ogni settimana")) : null;
    return el("li", { class: "blocco", "data-voce": "", "data-id": `blocco-${i}` },
      el("div", { class: "testa-voce" }, el("strong", {}, `${i + 1}. Esercizio`), comandi(g.blocchi, i, `blocco-${i}`)),
      campoNome(b),
      // con lo schema per settimana, serie e ripetizioni stanno SOLO nello schema (un'unica fonte: niente valori «base» che lo contraddicono)
      el("div", { class: b.perSettimana ? "griglia-1" : "griglia-3" },
        b.perSettimana ? null : campo("Serie", b, "serie", { max: 10, modo: "numeric", segnaposto: "4" }),
        b.perSettimana ? null : campo("Ripetizioni", b, "rip", { max: 30, segnaposto: "10" }),
        campo("Recupero", b, "rec", { max: 30, segnaposto: "1'30\"" })),
      cambia, schema,
      campoVideo(b),
      el("details", { class: "altro", open: b.aperto || b.note || b.progressione ? "" : null, ontoggle: (ev) => { b.aperto = ev.target.open; } },
        el("summary", {}, "Altro: note e progressione"),
        campoLungo("Note (facoltative)", b, "note", { aiuto: "Es. schiena dritta, scendi sotto il parallelo" }),
        campoLungo("Progressione (facoltativa)", b, "progressione", { aiuto: "Es. +2,5 kg a settimana se chiudi tutte le serie. Se la scrivi, il cliente può segnare le ripetizioni fatte." })));
  }

  function bloccoCircuito(g, b, i) {
    const id = nuovoId("f");
    const formato = el("select", { id }, ["EMOM", "AMRAP"].map((f) => el("option", { value: f, selected: f === b.formato ? "" : null }, f)));
    formato.addEventListener("change", () => { b.formato = formato.value; salvaBozza(); });
    return el("li", { class: "blocco circuito", "data-id": `blocco-${i}` },
      el("div", { class: "testa-voce" }, el("strong", {}, `${i + 1}. Circuito`), comandi(g.blocchi, i, `blocco-${i}`)),
      el("div", { class: "griglia-3 griglia-circuito" },
        el("div", { class: "campo-pt" }, el("label", { for: id }, "Tipo"), formato),
        campo("Minuti", b, "minuti", { tipo: "number", min: "1", maxNum: "180", modo: "numeric" }),
        campo("Recupero", b, "rec", { max: 30, segnaposto: "Facoltativo, es. 1'" })),
      el("p", { class: "nota" }, "EMOM: ogni minuto si fa il lavoro. AMRAP: più giri possibili nel tempo. Il cliente trova un timer già impostato."),
      el("ul", { class: "elenco-editor" }, b.esercizi.map((e, k) =>
        el("li", { class: "voce", "data-voce": "", "data-id": `blocco-${i}-ex-${k}` },
          el("div", { class: "testa-voce" }, el("strong", {}, `Esercizio ${k + 1}`), comandi(b.esercizi, k, `blocco-${i}-ex-${k}`)),
          campoNome(e), campo("Ripetizioni", e, "rip", { max: 30, segnaposto: "10" }), campoVideo(e)))),
      el("div", { class: "azioni-pt" }, el("button", { class: "bottone secondario", type: "button", onclick: () => {
        b.esercizi.push({ nome: "", rip: "", video: "" }); daFocalizzare = `${dentroGiorno(g)} [data-id="blocco-${i}-ex-${b.esercizi.length - 1}"] input`; salvaBozza(); disegna(); } },
        el("span", { class: "icona i-piu", "aria-hidden": "true" }), "Aggiungi esercizio al circuito")));
  }

  function giornoCard(g, n) {
    const lettera = LETTERE[n];
    const aggiungi = (nuovo, tipo) => {
      if (g.blocchi.length >= MAX_BLOCCHI) return;
      g.blocchi.push(nuovo); daFocalizzare = `${dentroGiorno(g)} [data-id="blocco-${g.blocchi.length - 1}"] input`; salvaBozza(); disegna();
    };
    return el("section", { class: "pannello giorno", "aria-labelledby": `t-g${n}`, "data-id": `giorno-${n}`, "data-g": String(n + 1) },
      el("div", { class: "testa-voce" }, el("div", { class: "titolo-giorno-riga" }, el("span", { class: "pastiglia-giorno", "aria-hidden": "true" }, lettera), el("h2", { class: "titolo-giorno", id: `t-g${n}` }, `Giorno ${lettera}`)),
        stato.giorni.length > 1 ? comandi(stato.giorni, n, `giorno-${n}`) : null),
      campo("Su cosa si lavora", g, "focus", { max: 60, segnaposto: "Es. Gambe e glutei" }),
      el("ol", { class: "elenco-editor" }, g.blocchi.map((b, i) => b.tipo === "esercizio" ? bloccoEsercizio(g, b, i) : bloccoCircuito(g, b, i))),
      g.blocchi.length ? null : el("p", { class: "nota" }, "Ancora nessun esercizio in questo giorno."),
      el("div", { class: "azioni-pt" },
        el("button", { class: "bottone secondario", type: "button", onclick: () => aggiungi(nuovoEsercizio()) }, el("span", { class: "icona i-piu", "aria-hidden": "true" }), "Aggiungi esercizio"),
        el("button", { class: "bottone secondario", type: "button", onclick: () => aggiungi(nuovoCircuito()) }, el("span", { class: "icona i-piu", "aria-hidden": "true" }), "Aggiungi circuito")),
      el("hr", { class: "separatore" }),
      el("label", { class: "spunta-pt" }, (() => {
        const c = el("input", { type: "checkbox" }); c.checked = g.stretching;
        c.addEventListener("change", () => { g.stretching = c.checked; salvaBozza(); disegna(); });
        return c;
      })(), el("span", {}, "Chiudi con lo stretching")),
      g.stretching ? campo("Durata dello stretching", g, "stretchingDurata", { max: 20, segnaposto: "5-10'" }) : null);
  }

  // I blocchi si chiamano «blocco-0, blocco-1…» in OGNI giorno: per mettere il cursore nel posto giusto la ricerca deve partire dal giorno,
  // altrimenti trova per primo il blocco con lo stesso numero del Giorno A (e chi scrive subito lo sovrascrive).
  const dentroGiorno = (g) => `[data-id="giorno-${stato.giorni.indexOf(g)}"]`;

  function disegna() {
    const radice = $("editor");
    radice.replaceChildren(
      sezioneDati(), sezioneRiscaldamento(),
      ...stato.giorni.map((g, n) => giornoCard(g, n)),
      el("div", { class: "azioni-pt" }, stato.giorni.length >= MAX_GIORNI ? el("p", { class: "nota" }, `Hai raggiunto il massimo di ${MAX_GIORNI} giorni.`)
        : el("button", { class: "bottone secondario", type: "button", onclick: () => {
          stato.giorni.push(nuovoGiorno()); daFocalizzare = `[data-id="giorno-${stato.giorni.length - 1}"] input`; salvaBozza(); disegna(); } },
        el("span", { class: "icona i-piu", "aria-hidden": "true" }), "Aggiungi giorno")));
    if (daFocalizzare) {
      const x = radice.querySelector(daFocalizzare);
      if (x) { x.focus(); x.scrollIntoView({ block: "center" }); }
      daFocalizzare = null;
    }
  }

  // ---------- da modulo a «dati» ----------
  const testo = (v) => String(v == null ? "" : v).trim().replace(/\s+/g, " ");
  const oNull = (v) => (testo(v) ? testo(v) : null);
  // un link scritto senza https:// (es. youtube.com/...) lo completa Lena; un altro tipo di indirizzo (javascript:, ftp:...) resta com'è e viene rifiutato
  const conHttps = (v) => { const t = testo(v); return t && !/^[a-z][a-z0-9+.-]*:/i.test(t) && /^[^\s/]+\.[^\s/]+/.test(t) ? `https://${t}` : t; };
  const indirizzoOk = (v) => !testo(v) || (/^https?:\/\/\S+$/i.test(conHttps(v)) && conHttps(v).length <= 2000);

  function costruisci() {
    const errori = [], err = (m) => errori.push(m), avvisiScheda = [];
    const s = stato;
    const settimane = Number(s.settimane), scarico = s.scarico === "" ? 0 : Number(s.scarico);
    if (!testo(s.titolo)) err("Scrivi il titolo della scheda.");
    if (!s.inizio) err("Scegli la data di inizio.");
    if (!Number.isInteger(settimane) || settimane < 1 || settimane > 52) err("Le settimane devono essere un numero da 1 a 52.");
    else if (!Number.isInteger(scarico) || scarico < 0 || scarico >= settimane) err("Le settimane di scarico devono essere meno delle settimane in tutto.");
    const w = Number.isInteger(settimane) && Number.isInteger(scarico) ? settimane - scarico : 1;

    const costruisciRisc = (r, dove) => {
      if (!testo(r.durata)) err(`${dove}: scrivi la durata.`);
      const rEs = [];
      r.esercizi.forEach((e, i) => {
        if (!testo(e.nome)) { if (testo(e.video)) err(`${dove}, esercizio ${i + 1}: c'è il video ma manca il nome.`); return; }
        if (!indirizzoOk(e.video)) err(`${dove}, «${testo(e.nome)}»: il link al video deve iniziare con http:// o https://.`);
        rEs.push([testo(e.nome), oNull(conHttps(e.video))]);
      });
      if (!rEs.length) err(`${dove}: aggiungi almeno un esercizio (il cliente lo vede all'inizio dell'allenamento).`);
      return { voce: "Riscaldamento", durata: testo(r.durata), istruzione: testo(r.istruzione), esercizi: rEs };
    };
    const riscComune = s.riscPerGiorno ? null : costruisciRisc(s.risc, "Riscaldamento");

    const giorni = s.giorni.map((g, n) => {
      const nome = `Giorno ${LETTERE[n]}`;
      const blocchi = [];
      g.blocchi.forEach((b, i) => {
        const dove = `${nome}, blocco ${i + 1}`;
        if (b.tipo === "esercizio") {
          const nm = testo(b.nome);
          if (!nm) return err(`${dove}: manca il nome dell'esercizio.`);
          if (!b.perSettimana && !testo(b.serie)) err(`${dove} («${nm}»): scrivi le serie.`);
          if (!b.perSettimana && !testo(b.rip)) err(`${dove} («${nm}»): scrivi le ripetizioni.`);
          if (!b.perSettimana && testo(b.serie) && !/^\d{1,2}$/.test(testo(b.serie))) avvisiScheda.push(`${dove} («${nm}»): le serie sono scritte «${testo(b.serie)}», non come numero: il cliente non vedrà i pallini delle serie. Scrivi per esempio 3.`);
          if (!indirizzoOk(b.video)) err(`${dove} («${nm}»): il link al video deve iniziare con http:// o https://.`);
          let schema = null;
          if (b.perSettimana) {
            schema = [];
            for (let k = 0; k < w; k++) {
              const v = testo(b.schema[k]).replace(/\s/g, "").replace(/[×*]/g, "x").toLowerCase();
              if (!/^\d+x\d+$/.test(v)) { err(`${dove} («${nm}»): nella settimana ${k + 1} scrivi serie e ripetizioni come 6x6.`); break; }
              schema.push(v);
            }
          }
          // con lo schema, serie e ripetizioni base sono quelle della prima settimana (la scheda mostra comunque quelle della settimana scelta)
          const base1 = schema && /^(\d+)x(\d+)$/.exec(schema[0] || "");
          blocchi.push({ tipo: "esercizio", nome: nm, serie: base1 ? base1[1] : testo(b.serie), rip: base1 ? base1[2] : testo(b.rip), rec: testo(b.rec) || "/", video: oNull(conHttps(b.video)),
            note: oNull(b.note), schema, progressione: oNull(b.progressione) });
        } else {
          const min = Number(b.minuti);
          if (!Number.isInteger(min) || min < 1 || min > 180) err(`${dove}: i minuti del circuito devono essere un numero da 1 a 180.`);
          const ex = [];
          b.esercizi.forEach((e, k) => {
            if (!testo(e.nome)) { if (testo(e.rip) || testo(e.video)) err(`${dove}, esercizio ${k + 1}: manca il nome.`); return; }
            if (!indirizzoOk(e.video)) err(`${dove}, «${testo(e.nome)}»: il link al video deve iniziare con http:// o https://.`);
            ex.push({ nome: testo(e.nome), rip: testo(e.rip), video: oNull(conHttps(e.video)) });
          });
          if (!ex.length) err(`${dove}: il circuito non ha esercizi.`);
          blocchi.push({ tipo: "circuito", formato: `${b.formato} ${min}'`, rec: oNull(b.rec), esercizi: ex });
        }
      });
      if (!blocchi.length) err(`${nome}: aggiungi almeno un esercizio o un circuito.`);
      const riscaldamento = s.riscPerGiorno ? costruisciRisc(riscDelGiorno(g), `Riscaldamento, ${nome}`) : null;
      if (g.stretching && !testo(g.stretchingDurata)) err(`${nome}: scrivi la durata dello stretching o toglila.`);
      return { id: LETTERE[n], titolo: nome, focus: testo(g.focus) || "", stretching: g.stretching ? ["Stretching", testo(g.stretchingDurata)] : null,
        ...PALETTE[n % PALETTE.length], ...(riscaldamento ? { riscaldamento } : {}), blocchi };
    });

    const dati = {
      inizio: s.inizio, settimane,
      info: { titolo: testo(s.titolo), nome: cliente.nome, cognome: cliente.cognome, obiettivo: testo(s.obiettivo), sedute: giorni.length,
        nota_durata: scarico ? `${w} settimane + ${scarico} di scarico` : `${w} settimane` },
      riscaldamento: riscComune || giorni[0].riscaldamento,   // con un riscaldamento per giorno, quello «comune» è il primo (serve a chi legge schede vecchie)
      giorni,
    };
    if (!errori.length) { const e = LenaValidaScheda.erroreScheda(dati); if (e) err(`La scheda non è valida: ${e}.`); }
    const avvisi = errori.length ? [] : [...avvisiScheda, ...(window.LenaParoleSalute ? LenaParoleSalute.avvisi(dati) : [])];
    return { dati, errori, avvisi };
  }

  // ---------- controllo, anteprima, invio ----------
  function azzeraEsito() {
    $("ed-messaggi").replaceChildren();
    if (chiudiCornice) { chiudiCornice(); chiudiCornice = null; }
    $("ed-telefono").hidden = true;
  }
  function mostraErrori(errori) {
    $("ed-messaggi").replaceChildren(messaggio("errore", errori.length === 1 ? "C'è una cosa da sistemare" : `Ci sono ${errori.length} cose da sistemare`, errori));
    $("ed-messaggi").scrollIntoView({ block: "center" });
  }
  function anteprima() {
    azzeraEsito();
    const { dati, errori } = costruisci();
    if (errori.length) return mostraErrori(errori);
    $("ed-telefono").hidden = false;
    chiudiCornice = LenaPt.cornice($("ed-telefono"), dati);
    $("ed-telefono").scrollIntoView({ block: "center" });
  }
  async function invia() {
    if (inCorso) return;
    $("ed-messaggi").replaceChildren();
    const { dati, errori, avvisi } = costruisci();
    if (errori.length) { $("ed-conferma").hidden = true; return mostraErrori(errori); }
    if (avvisi.length) {
      $("ed-messaggi").replaceChildren(messaggio("avviso", avvisi.length === 1 ? "C'è 1 avviso da controllare" : `Ci sono ${avvisi.length} avvisi da controllare`, avvisi));
      if (!$("ed-conferma").hidden && $("ed-ok").checked) { /* ha già confermato: si invia */ }
      else { $("ed-conferma").hidden = false; $("ed-messaggi").scrollIntoView({ block: "center" }); return; }
    }
    inCorso = true; $("ed-invia").disabled = true; $("ed-invia").textContent = "Invio…";
    const r = await LenaPt.chiama("POST", `/api/clienti/${idCliente}/schede`, { dati });
    inCorso = false; $("ed-invia").disabled = false; $("ed-invia").textContent = "Invia al cliente";
    if (r.stato === 201) {
      cancellaBozza();
      LenaPt.ricordaMessaggio(`Scheda «${dati.info.titolo}» inviata: ${cliente.registrato ? `${cliente.nome} la vede subito` : `${cliente.nome} la vedrà appena entra con il suo invito`}.`);
      location.assign(`/pt-cliente.html?id=${idCliente}`);
      return;
    }
    const motivo = r.stato === 400 && r.json && r.json.errore ? `Il server non ha accettato la scheda: ${r.json.errore}` : LenaPt.testoErrore(r, "inviare la scheda");
    $("ed-messaggi").replaceChildren(messaggio("errore", "La scheda non è stata inviata", [motivo, "Quello che hai scritto è ancora qui: puoi riprovare."]));
  }

  // ---------- avvio ----------
  function erroreIntera(titolo, testoMsg, riprova) {
    $("pagina").hidden = true;
    $("stato-pagina").replaceChildren(messaggio("errore", titolo, testoMsg ? [testoMsg] : []),
      riprova ? el("button", { class: "bottone", type: "button", onclick: riprova }, "Riprova") : el("a", { class: "bottone", href: "/pt.html" }, "Torna ai clienti"));
  }
  async function avvia() {
    if (!idCliente) return erroreIntera("Cliente non trovato", "Apri questa pagina dal pulsante «Crea scheda» nella pagina del cliente.");
    const utente = await LenaPt.verificaPt();
    if (!utente) return erroreIntera("Non riesco a collegarmi", "Controlla la connessione e riprova.", () => location.reload());
    $("indietro").href = `/pt-cliente.html?id=${idCliente}`;
    const r = await LenaPt.chiama("GET", `/api/clienti/${idCliente}`);
    if (r.stato === 404) return erroreIntera("Cliente non trovato", "Forse è stato cancellato.");
    if (r.stato !== 200) return erroreIntera("Non riesco a caricare il cliente", LenaPt.testoErrore(r, "caricare il cliente"), () => location.reload());
    cliente = r.json;
    $("nome-cliente").textContent = `${cliente.nome} ${cliente.cognome}`;
    document.title = `Crea scheda · ${cliente.nome} ${cliente.cognome} · Lena`;

    let bozza = leggiBozza();
    let base = null;   // { stato, titolo } se si parte da una scheda già inviata
    if (idBase) {
      const b = await LenaPt.chiama("GET", `/api/schede/${idBase}`);
      if (b.stato === 200 && b.json && b.json.dati) {
        base = { stato: LenaDaScheda.statoDaDati(b.json.dati, oggi()), titolo: b.json.dati.info.titolo || "senza titolo", daAltro: b.json.cliente_id !== idCliente };
        // una bozza in corso per questo cliente non si butta via di nascosto
        if (bozza && !confirm("Per questo cliente hai una bozza in corso. Vuoi sostituirla con la copia della scheda scelta?\n\nOK = sostituisci la bozza. Annulla = tieni la bozza.")) base = null;
        else bozza = null;
      } else {
        $("bozza-avviso").replaceChildren(messaggio("avviso", "Non ho trovato la scheda da cui partire", ["Puoi comunque compilarne una nuova."]));
      }
    }
    stato = bozza || (base && base.stato) || nuovoStato();
    if (base) {
      $("bozza-avviso").replaceChildren(messaggio("info", `Sei partito dalla scheda «${base.titolo}»`, [
        base.daAltro ? "Controlla titolo, obiettivo e date prima di inviarla a questo cliente." : "Sistema quello che serve e invia: il cliente vedrà questa come nuova versione.",
        "Quello che il cliente ha già segnato (kg, spunte) resta sulla scheda vecchia e non passa a questa.",
        "Se la vecchia scheda aveva note o campi particolari arrivati da Excel, qui potrebbero mancare: guarda l'anteprima."]));
      salvaBozza();
    }
    if (bozza) {
      $("bozza-avviso").replaceChildren(messaggio("info", "Ho ripreso la bozza che stavi scrivendo", []),
        el("button", { class: "bottone secondario piccolo", type: "button", onclick: () => {
          if (!confirm("Vuoi cancellare la bozza e ricominciare da zero?")) return;
          cancellaBozza(); stato = nuovoStato(); $("bozza-avviso").replaceChildren(); azzeraEsito(); disegna(); window.scrollTo(0, 0); } }, "Ricomincia da zero"));
    }
    sistemaSchemi();
    $("pagina").hidden = false;
    disegna();
    $("ed-invia").addEventListener("click", invia);
    $("ed-anteprima").addEventListener("click", anteprima);
  }
  avvia();
})();
