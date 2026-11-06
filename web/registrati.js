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

    $("invia").disabled = true;
    $("invia").textContent = "Un attimo…";
    const r = await Lena.chiama("POST", "/api/auth/registra-cliente", { codice, email, password });

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
    } else if (r.stato === 400 && errore) {
      mostra("errore", errore);   // per esempio password troppo lunga
    } else {
      mostra("errore", Lena.messaggioComune(r) || "Non sono riuscito a creare l'accesso. Riprova.");
    }
  });
})();
