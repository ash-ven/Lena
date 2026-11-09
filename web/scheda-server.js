/* Collega la scheda al server.
   Fa tre cose: (1) chiede al server la scheda del cliente e i suoi progressi; (2) prepara le tre variabili
   che scheda.js si aspetta (DATI, IN_ANTEPRIMA, LENA_ARCHIVIO); (3) carica scheda.js, che costruisce la pagina.
   La logica della scheda NON è qui: è in scheda.js, lo stesso file che usa la scheda scaricabile. */
(function () {
  const $ = (id) => document.getElementById(id);

  // ---------- messaggi di stato ----------
  function mostraStato(titolo, testo, azioni) {
    $("stato-titolo").textContent = titolo;
    $("stato-testo").textContent = testo;
    const zona = $("stato-azioni");
    zona.replaceChildren();
    for (const a of azioni || []) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pulsante" + (a.secondario ? " secondario" : "");
      b.textContent = a.testo;
      b.addEventListener("click", a.fa);
      zona.append(b);
    }
    $("stato-pagina").hidden = false;
    document.body.classList.add("semplice");
  }
  const ricarica = () => location.reload();
  const AZIONE_RIPROVA = { testo: "Riprova", fa: ricarica };
  const AZIONE_ESCI = { testo: "Esci", fa: () => Lena.esci(), secondario: true };

  function vaiAlLogin() { location.replace("/login.html"); }

  function caricaScript(src) {
    return new Promise((ok, no) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = () => no(new Error("script non caricato: " + src));
      document.body.append(s);
    });
  }

  // ---------- indicatore di salvataggio ----------
  const TESTI_STATO = {
    salvato: "Salvato ✓",
    invio: "Salvo…",
    attesa: "Non salvato, riprovo…",
    definitivo: "Non riesco a salvare: ricarica la pagina",
  };
  // Una zona invisibile che i lettori di schermo leggono ad alta voce: la usiamo solo per i problemi
  // (e per la loro risoluzione), non a ogni lettera scritta.
  const annuncio = document.createElement("div");
  annuncio.className = "solo-lettori";
  annuncio.setAttribute("role", "status");
  document.body.append(annuncio);

  let statoPrecedente = null;
  function segnalaStato(stato) {
    for (const e of document.querySelectorAll(".stato-salv")) {
      e.textContent = TESTI_STATO[stato];
      e.classList.toggle("attenzione", stato === "attesa" || stato === "definitivo");
    }
    if (stato === "attesa" || stato === "definitivo") annuncio.textContent = TESTI_STATO[stato];
    else if (stato === "salvato" && statoPrecedente === "attesa") annuncio.textContent = "Salvato";
    statoPrecedente = stato;
  }

  // Dove si copiano le modifiche non ancora inviate: una chiave diversa per ogni utente e per ogni scheda
  function memoriaBrowser(chiave) {
    return {
      leggi() { try { return JSON.parse(localStorage.getItem(chiave) || "null"); } catch (e) { return null; } },
      scrivi(valore) {
        try { if (valore) localStorage.setItem(chiave, JSON.stringify(valore)); else localStorage.removeItem(chiave); } catch (e) { /* bloccata */ }
      },
    };
  }

  // Il collegamento a «Il mio account» (scaricare i dati, cancellare l'account). L'indirizzo si imposta qui e non passa
  // da el(), che per sicurezza accetta solo indirizzi web completi.
  function vaiAlMioAccount(el) {
    const a = el("a", { class: "btn piccolo" }, "Il mio account e i miei dati");
    a.href = "/account.html";
    return a;
  }

  // ---------- l'archivio: dove scheda.js legge e salva kg, ripetizioni, serie e spunte ----------
  function creaArchivio(utente, scheda, registrazioni) {
    const sync = window.LenaSincronizza.creaSincronizzatore({
      schedaId: scheda.id,
      confermato: registrazioni,
      chiama: Lena.chiama,
      memoria: memoriaBrowser(`lena:coda:${utente.id}:${scheda.id}`),
      segnala: segnalaStato,
      inLinea: () => navigator.onLine !== false,
      sessioneScaduta: () => location.replace("/login.html?sessione=scaduta"),   // le modifiche restano sul dispositivo e partono dopo il login
      suRifiutata: (voce) => console.warn("Il server non ha accettato questa voce:", voce),
    });

    // Quando torna la rete, o la pagina sta per nascondersi/chiudersi: invia subito, senza aspettare il secondo di quiete
    window.addEventListener("online", () => sync.sincronizzaOra());
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") sync.sincronizzaOra(); });
    window.addEventListener("pagehide", () => sync.sincronizzaOra());

    // Tutte le copie locali dei progressi di QUESTO utente (una chiave per scheda): su un dispositivo condiviso non devono restare
    function cancellaCopieLocali() {
      try {
        for (const k of Object.keys(localStorage)) if (k.startsWith(`lena:coda:${utente.id}:`)) localStorage.removeItem(k);
      } catch (e) { /* memoria bloccata */ }
    }

    // Esci: prima prova a inviare tutto. Se ci riesce, esce e cancella la copia locale. Se NON ci riesce (offline) avvisa che le
    // modifiche si perdono e lascia scegliere: restare (e riprovare) o uscire. Dopo l'uscita la copia locale non c'è più.
    async function uscire() {
      const tuttoInviato = await sync.sincronizzaOra();
      if (!tuttoInviato) {
        const domanda =
          "Hai modifiche non salvate: se esci ora si perdono.\n\n" +
          "OK = esci e perdi le modifiche\nAnnulla = resta qui (riproverò a salvarle)";
        if (!window.confirm(domanda)) return;
      }
      // La copia locale si cancella solo quando il server ha davvero chiuso la sessione: se non c'è rete e l'uscita non
      // riesce, la persona resta dentro e non ha perso niente.
      await Lena.esci(() => { sync.dimentica(); cancellaCopieLocali(); });
    }

    return {
      carica: () => sync.caricaMem(),
      cambiato: (mem) => sync.cambiato(mem),
      riquadro(el) {
        return el("div", { class: "salvataggio" },
          el("div", {}, el("b", {}, "Quello che segni si salva da solo"), " nel tuo spazio su Lena."),
          el("div", { style: "margin-top:4px" }, `Sei dentro come ${utente.email}.`),
          el("div", { class: "azioni" }, vaiAlMioAccount(el), el("button", { type: "button", class: "btn piccolo", onclick: uscire }, "Esci")));
      },
    };
  }

  // ---------- l'aspetto (mood) della scheda: si sceglie qui, si salva sul profilo, la scheda si ricarica con il nuovo ----------
  function bottoneAspetto(info) {
    const crea = (tag, classe, testo) => { const e = document.createElement(tag); if (classe) e.className = classe; if (testo) e.textContent = testo; return e; };
    const pannello = crea("div", "aspetto"); pannello.hidden = true;
    const corpo = crea("div", "aspetto-corpo");
    corpo.setAttribute("role", "dialog"); corpo.setAttribute("aria-modal", "true"); corpo.setAttribute("aria-labelledby", "aspetto-titolo");
    const titolo = crea("h2", "", "Aspetto della scheda"); titolo.id = "aspetto-titolo";
    const errore = crea("p", "aspetto-errore"); errore.setAttribute("role", "alert"); errore.hidden = true;
    const lista = crea("ul", "aspetto-lista");
    let attuale = info.mood;
    const apri = crea("button", "profilo-icona"); apri.type = "button";
    apri.setAttribute("aria-label", "Cambia l'aspetto della scheda"); apri.setAttribute("aria-haspopup", "dialog");
    const ic = crea("span", "icona i-aspetto"); ic.setAttribute("aria-hidden", "true"); apri.append(ic);
    const chiudi = crea("button", "aspetto-chiudi", "Chiudi"); chiudi.type = "button";
    const chiudiPannello = () => { pannello.hidden = true; apri.focus(); };

    for (const m of info.disponibili) {
      const li = crea("li");
      const b = crea("button", "aspetto-scelta"); b.type = "button";
      b.setAttribute("aria-pressed", String(m.id === attuale));
      const testi = crea("span"); testi.append(crea("b", "", m.nome), crea("span", "sotto", m.descrizione));
      b.append(testi);
      if (m.id === attuale) { const ok = crea("span", "icona i-ok"); ok.setAttribute("aria-hidden", "true"); b.append(ok); }
      b.addEventListener("click", async () => {
        if (m.id === attuale) return chiudiPannello();
        errore.hidden = true;
        const r = await Lena.chiama("PUT", "/api/me/mood", { mood: m.id });
        if (r.stato === 200) return location.replace(location.pathname);   // ricarica senza ?mood=, con quello appena scelto
        errore.textContent = Lena.messaggioComune(r) || "Non sono riuscita a salvare la scelta. Riprova tra poco.";
        errore.hidden = false;
      });
      li.append(b); lista.append(li);
    }
    corpo.append(titolo, crea("p", "", "Scegli come vuoi vedere la tua scheda. Gli esercizi e i tuoi progressi restano gli stessi."), lista, errore, chiudi);
    pannello.append(corpo); document.body.append(pannello);
    apri.addEventListener("click", () => { pannello.hidden = false; lista.querySelector("button").focus(); });
    chiudi.addEventListener("click", chiudiPannello);
    pannello.addEventListener("click", (e) => { if (e.target === pannello) chiudiPannello(); });
    pannello.addEventListener("keydown", (e) => { if (e.key === "Escape") chiudiPannello(); });
    return apri;
  }

  // ---------- avvio ----------
  async function avvia() {
    mostraStato("Un attimo…", "Sto caricando la tua scheda.", []);
    const [me, sch, md] = await Promise.all([Lena.chiama("GET", "/api/auth/me"), Lena.chiama("GET", "/api/me/scheda"), Lena.chiama("GET", "/api/me/mood")]);

    if (me.stato === 401 || sch.stato === 401) return vaiAlLogin();
    if (me.stato === 200 && me.json.ruolo === "pt") return location.replace("/pt.html");
    if (sch.stato === 404) return location.replace("/benvenuto.html");   // niente scheda ancora: la pagina di benvenuto, con il trainer e il profilo
    if (me.stato !== 200 || sch.stato !== 200) {
      const r = me.stato !== 200 ? me : sch;
      return mostraStato("Non riesco a mostrare la scheda",
        Lena.messaggioComune(r) || "Qualcosa non ha funzionato. Riprova tra poco.", [AZIONE_RIPROVA]);
    }

    const { scheda, registrazioni } = sch.json;
    window.DATI = scheda.dati;
    window.IN_ANTEPRIMA = false;   // l'anteprima esiste solo nel convertitore
    window.LENA_ARCHIVIO = creaArchivio(me.json, scheda, registrazioni);
    document.title = `${scheda.dati.info.titolo || "La tua scheda"} · Lena`;

    // Il mood della scheda (la sua estetica): quello scelto dal cliente, altrimenti «lena». Se il server non lo dice, «lena».
    // Va messo PRIMA di scheda.js, che lo legge. (?mood=<nome> nell'indirizzo resta per provare un mood senza salvarlo.)
    const MOOD_ESISTENTI = md.stato === 200 && Array.isArray(md.json.disponibili) ? md.json.disponibili.map((m) => m.id) : ["lena"];
    const salvato = md.stato === 200 ? md.json.mood : null;
    const richiesto = new URLSearchParams(location.search).get("mood");
    document.documentElement.setAttribute("data-mood",
      MOOD_ESISTENTI.includes(richiesto) ? richiesto : MOOD_ESISTENTI.includes(salvato) ? salvato : "lena");
    try {
      await caricaScript("/scheda.js");   // costruisce la pagina e la mostra
      if (!document.getElementById("giorni") || !document.getElementById("giorni").children.length) throw new Error("scheda vuota");
    } catch (e) {
      console.error(e);
      return mostraStato("Non riesco a mostrare la scheda",
        "I dati della scheda non sono nel formato atteso. Avvisa il tuo PT.", [AZIONE_RIPROVA, AZIONE_ESCI]);
    }
    $("stato-pagina").hidden = true;
    document.body.classList.remove("semplice");
    // l'icona del profilo, sempre a portata di mano nella testata della scheda
    const sopra = document.querySelector("header .sopra");
    if (sopra) {
      const a = document.createElement("a");
      a.className = "profilo-icona"; a.href = "/account.html";
      a.setAttribute("aria-label", "Il mio profilo");
      const i = document.createElement("span"); i.className = "icona i-utente"; i.setAttribute("aria-hidden", "true");
      a.append(i);
      const casa = document.createElement("a");
      casa.className = "profilo-icona"; casa.href = "/benvenuto.html";
      casa.setAttribute("aria-label", "Torna alla home");
      const ic = document.createElement("span"); ic.className = "icona i-indietro"; ic.setAttribute("aria-hidden", "true");
      casa.append(ic);
      const gruppo = document.createElement("span"); gruppo.className = "icone-testata";
      gruppo.append(casa);
      if (md.stato === 200) gruppo.append(bottoneAspetto(md.json));
      gruppo.append(a); sopra.append(gruppo);
    }
  }

  avvia();
})();
