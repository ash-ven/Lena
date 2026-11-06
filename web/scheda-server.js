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

    // Esci: prima prova a inviare tutto; se non ci riesce, chiede conferma (le modifiche restano su questo dispositivo)
    async function uscire() {
      const tuttoInviato = await sync.sincronizzaOra();
      const domanda =
        "Alcune modifiche non sono ancora state salvate sul server (manca la connessione?).\n\n" +
        "Restano su questo dispositivo e partiranno quando rientri con questo stesso account.\n\n" +
        "Vuoi uscire lo stesso?";
      if (!tuttoInviato && !window.confirm(domanda)) return;
      await Lena.esci();
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

  // ---------- avvio ----------
  async function avvia() {
    mostraStato("Un attimo…", "Sto caricando la tua scheda.", []);
    const [me, sch] = await Promise.all([Lena.chiama("GET", "/api/auth/me"), Lena.chiama("GET", "/api/me/scheda")]);

    if (me.stato === 401 || sch.stato === 401) return vaiAlLogin();
    if (me.stato === 200 && me.json.ruolo === "pt") return location.replace("/pt.html");
    if (sch.stato === 404) {
      return mostraStato("La tua scheda non c'è ancora",
        "Il tuo PT non ti ha ancora caricato una scheda. Appena lo fa, la trovi qui.",
        [{ testo: "Controlla di nuovo", fa: ricarica }, AZIONE_ESCI]);
    }
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

    try {
      await caricaScript("/scheda.js");   // costruisce la pagina e la mostra
      if (!document.getElementById("giorni") || !document.getElementById("giorni").children.length) throw new Error("scheda vuota");
    } catch (e) {
      console.error(e);
      return mostraStato("Non riesco a mostrare la scheda",
        "I dati della scheda non sono nel formato atteso. Avvisa il tuo PT.", [AZIONE_RIPROVA, AZIONE_ESCI]);
    }
    $("stato-pagina").hidden = true;
  }

  avvia();
})();
