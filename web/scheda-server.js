/* Collega la scheda al server.
   Fa tre cose: (1) chiede al server la scheda del cliente e i suoi progressi; (2) prepara le tre variabili
   che scheda.js si aspetta (DATI, IN_ANTEPRIMA, LENA_ARCHIVIO); (3) carica scheda.js, che costruisce la pagina.
   La logica della scheda NON è qui: è in scheda.js, lo stesso file che usa la scheda scaricabile. */
(function () {
  const $ = (id) => document.getElementById(id);
  const R = window.LenaRegistrazioni;

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

  // ---------- l'archivio: dove scheda.js legge e salva kg, ripetizioni, serie e spunte ----------
  function creaArchivio(utente, registrazioni) {
    const confermato = R.mappaDaVoci(registrazioni);   // quello che il server ha già
    return {
      carica() { return R.memDaMappa(confermato); },
      cambiato() { /* il salvataggio sul server arriva con sincronizza.js */ },
      riquadro(el) {
        return el("div", { class: "salvataggio" },
          el("div", {}, el("b", {}, "Quello che segni si salva da solo"), " nel tuo spazio su Lena."),
          el("div", { style: "margin-top:4px" }, `Sei dentro come ${utente.email}.`),
          el("div", { class: "azioni" }, el("button", { type: "button", class: "btn piccolo", onclick: () => Lena.esci() }, "Esci")));
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
    window.LENA_ARCHIVIO = creaArchivio(me.json, registrazioni);
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
