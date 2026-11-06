(function () {
  const $ = (id) => document.getElementById(id);
  const messaggio = $("messaggio");
  const codice = (new URLSearchParams(location.search).get("codice") || "").trim();

  const INVITO_NON_VALIDO = "Questo invito non è valido: può essere scaduto, già usato o copiato in modo incompleto. Chiedi al tuo PT di mandartene uno nuovo.";

  function mostra(tipo, testo) {
    messaggio.className = "messaggio " + tipo;
    messaggio.textContent = testo;
    messaggio.hidden = false;
  }
  // Se l'invito non serve più, il modulo è inutile: lo togliamo e restano solo il messaggio e il link al login
  function soloMessaggio(testo) {
    $("modulo").hidden = true;
    $("introduzione").hidden = true;
    mostra("errore", testo);
  }

  if (!codice) soloMessaggio("Questo link non è completo: manca il codice dell'invito. Chiedi al tuo PT di mandartene uno nuovo.");

  $("mostra").addEventListener("change", (ev) => {
    $("password").type = ev.target.checked ? "text" : "password";
  });

  // La versione dell'informativa che si sta accettando arriva dal server (c'è un solo punto dove si decide: api/config.js)
  let versioneInformativa = null;
  async function leggiVersione() {
    const r = await Lena.chiama("GET", "/api/privacy/versioni");
    if (r.stato === 200) { versioneInformativa = r.json.informativa_cliente; $("versione-informativa").textContent = versioneInformativa; }
    return versioneInformativa;
  }
  leggiVersione();

  $("modulo").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const email = $("email").value.trim();
    const password = $("password").value;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      mostra("errore", "Scrivi un indirizzo email valido, per esempio nome@esempio.it.");
      $("email").focus();
      return;
    }
    if (password.length < 10) {
      mostra("errore", `La password è troppo corta: servono almeno 10 caratteri (ne hai scritti ${password.length}).`);
      $("password").focus();
      return;
    }

    if (!$("accetta").checked) {
      mostra("errore", "Per registrarti devi spuntare la casella «Ho letto l'informativa privacy».");
      $("accetta").focus();
      return;
    }

    $("invia").disabled = true;
    $("invia").textContent = "Un attimo…";
    if (!versioneInformativa && !(await leggiVersione())) {
      $("invia").disabled = false;
      $("invia").textContent = "Crea il mio accesso";
      mostra("errore", "Non riesco a contattare il server. Controlla la connessione e riprova.");
      return;
    }
    const r = await Lena.chiama("POST", "/api/auth/registra-cliente", { codice, email, password, accettaInformativa: true, versioneInformativa });

    if (r.stato === 201) {
      location.replace("/scheda.html");   // la registrazione ha già fatto il login
      return;
    }
    $("invia").disabled = false;
    $("invia").textContent = "Crea il mio accesso";

    const errore = r.json && r.json.errore;
    if (r.stato === 400 && errore === "Invito non valido o scaduto") {
      soloMessaggio(INVITO_NON_VALIDO);   // un solo messaggio: non diciamo se è scaduto, usato o sbagliato
    } else if (r.stato === 409) {
      mostra("errore", "Questa email è già registrata. Se hai già un account, accedi dalla pagina di login.");
      $("email").focus();
    } else if (r.stato === 400 && r.json && r.json.codice === "VERSIONE_INFORMATIVA_CAMBIATA") {
      mostra("errore", errore);   // l'informativa è cambiata mentre compilavi: si ricarica per leggerla
      versioneInformativa = null; leggiVersione(); $("accetta").checked = false;
    } else if (r.stato === 400 && errore) {
      mostra("errore", errore);   // per esempio password troppo lunga
    } else {
      mostra("errore", Lena.messaggioComune(r) || "Non sono riuscito a creare l'accesso. Riprova.");
    }
  });
})();
