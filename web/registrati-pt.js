(function () {
  const $ = (id) => document.getElementById(id);
  const messaggio = $("messaggio");

  function mostra(testo) {
    messaggio.className = "messaggio errore";
    messaggio.textContent = testo;
    messaggio.hidden = false;
  }
  function pronto() { $("invia").disabled = false; $("invia").textContent = "Crea accesso"; }

  $("mostra").addEventListener("change", (ev) => {
    $("password").type = ev.target.checked ? "text" : "password";
  });

  // La versione delle condizioni che si sta accettando arriva dal server (un solo punto dove si decide: api/config.js)
  let versioneCondizioni = null;
  (async () => {
    const r = await Lena.chiama("GET", "/api/privacy/versioni");
    if (r.stato === 200) { versioneCondizioni = r.json.condizioni_pt; $("versione-condizioni").textContent = versioneCondizioni; }
  })();

  $("modulo").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const nome = $("nome").value.trim();
    const email = $("email").value.trim();
    const password = $("password").value;

    if ((nome.match(/\p{L}/gu) || []).length < 2) { mostra("Scrivi il tuo nome: servono almeno due lettere."); $("nome").focus(); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      mostra("Scrivi un indirizzo email valido, per esempio nome@esempio.it.");
      $("email").focus();
      return;
    }
    if (password.length < 10) {
      mostra(`La password è troppo corta: servono almeno 10 caratteri (ne hai scritti ${password.length}).`);
      $("password").focus();
      return;
    }

    if (!$("accetta").checked) {
      mostra("Per iscriverti devi spuntare la casella delle condizioni d'uso.");
      $("accetta").focus();
      return;
    }

    $("invia").disabled = true;
    $("invia").textContent = "Un attimo…";
    const r = await Lena.chiama("POST", "/api/auth/registra-pt", { nome, email, password });

    if (r.stato === 201) {
      // L'iscrizione ha già aperto la sessione: si registra subito l'accettazione delle condizioni appena spuntate.
      // Se questa chiamata non va a buon fine nessun danno: all'ingresso nell'area la schermata delle condizioni compare comunque.
      if (versioneCondizioni) await Lena.chiama("POST", "/api/privacy/condizioni-pt", { versione: versioneCondizioni });
      location.replace(Lena.paginaDopoLogin("pt"));   // l'iscrizione ha già fatto il login
      return;
    }
    pronto();
    const errore = r.json && r.json.errore;
    if (r.stato === 409) {
      mostra("Questa email è già registrata. Se hai già un account, accedi dalla pagina di login.");
      $("email").focus();
    } else if ((r.stato === 400 || r.stato === 403) && errore) {
      mostra(errore);
    } else {
      mostra(Lena.messaggioComune(r) || "Non sono riuscito a creare l'account. Riprova.");
    }
  });
})();
