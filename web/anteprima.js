/* Mostra una scheda dentro una cornice (iframe) dell'area del PT, senza salvare niente e senza chiamare il server.

   Come arrivano i dati: la pagina che ci contiene ci manda un messaggio (postMessage) di questo tipo
     { tipo: "scheda", dati: {...la scheda...}, registrazioni: [...facoltative...] }
   e noi la mostriamo con lo stesso scheda.js della scheda del cliente (una sola fonte).
   - Con "registrazioni" la scheda è in SOLA LETTURA con i progressi del cliente (kg, ripetizioni, serie, spunte).
   - Senza, è un'anteprima semplice (quella del convertitore).

   Perché così (e non con un iframe "srcdoc" con lo script dentro): la CSP del sito vieta gli script scritti
   nella pagina, e non va allentata. Qui lo script è un normale file del sito; i dati sono solo testo che
   passa da un messaggio. Non vengono mai interpretati come codice.

   Sicurezza dei messaggi: si accetta un messaggio solo se
     1. viene dalla stessa origine del sito (ev.origin), E
     2. viene proprio dalla pagina che ci contiene (ev.source === window.parent).
   e solo se i dati passano lo stesso controllo che usa il server (valida-scheda.js).
   Si accetta un solo messaggio per caricamento: per mostrare un'altra scheda si ricrea la cornice.

   Risposte per la pagina che ci contiene (sempre verso la nostra stessa origine):
     { tipo: "pronta" }          appena siamo pronti a ricevere
     { tipo: "mostrata" }        la scheda è visibile
     { tipo: "errore", messaggio }   i dati non sono validi o la scheda non si è potuta mostrare */
(function () {
  const ORIGINE = location.origin;
  const $ = (id) => document.getElementById(id);
  let avviata = false;

  function stato(titolo, testo) {
    $("stato-titolo").textContent = titolo;
    $("stato-testo").textContent = testo;
    $("stato-pagina").hidden = false;
    document.body.classList.add("semplice");
  }
  const rispondi = (messaggio) => window.parent.postMessage(messaggio, ORIGINE);

  function caricaScript(src) {
    return new Promise((ok, no) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = () => no(new Error("script non caricato: " + src));
      document.body.append(s);
    });
  }

  if (window.parent === window) {   // aperta da sola, non dentro l'area del PT
    stato("Questa pagina non si apre da sola", "È l'anteprima che si vede dentro l'area del PT.");
    return;
  }

  window.addEventListener("message", async (ev) => {
    if (ev.origin !== ORIGINE || ev.source !== window.parent) return;   // mittente non autorizzato: si ignora, senza dire niente
    const m = ev.data;
    if (avviata || !m || typeof m !== "object" || m.tipo !== "scheda" || !m.dati || typeof m.dati !== "object") return;

    const errore = window.LenaValidaScheda.erroreScheda(m.dati);
    if (errore) {
      stato("La scheda non si può mostrare", errore);
      rispondi({ tipo: "errore", messaggio: errore });
      return;
    }
    avviata = true;

    window.DATI = m.dati;
    window.IN_ANTEPRIMA = true;   // niente salvataggi e niente riquadro dei backup
    if (Array.isArray(m.registrazioni)) {
      const R = window.LenaRegistrazioni;
      const mem = R.memDaMappa(R.mappaDaVoci(m.registrazioni));
      window.SOLA_LETTURA = true;
      window.LENA_ARCHIVIO = { carica: () => mem, cambiato() { /* sola lettura: non si cambia niente */ } };
    }

    // Il trainer vede la scheda con lo stesso mood del cliente (per ora sempre «lena», il predefinito)
    document.documentElement.setAttribute("data-mood", "lena");
    try {
      await caricaScript("/scheda.js");
      if (!$("giorni") || !$("giorni").children.length) throw new Error("scheda vuota");
    } catch (e) {
      console.error(e);
      stato("La scheda non si può mostrare", "Qualcosa non ha funzionato.");
      rispondi({ tipo: "errore", messaggio: "La scheda non si è potuta mostrare." });
      return;
    }
    $("stato-pagina").hidden = true;
    document.body.classList.remove("semplice");
    rispondi({ tipo: "mostrata" });
  });

  rispondi({ tipo: "pronta" });
})();
