(function () {
  const $ = (id) => document.getElementById(id);
  const messaggio = $("messaggio");

  function mostra(tipo, testo) {
    messaggio.className = "messaggio " + tipo;
    messaggio.textContent = testo;
    messaggio.hidden = false;
  }

  // Se si arriva qui perché la sessione è scaduta mentre si salvava, lo diciamo con calma
  if (new URLSearchParams(location.search).get("sessione") === "scaduta") {
    mostra("avviso", "La sessione è scaduta: accedi di nuovo. Quello che avevi segnato non è andato perso, verrà salvato appena entri.");
  }

  $("mostra").addEventListener("change", (ev) => {
    $("password").type = ev.target.checked ? "text" : "password";
  });

  $("modulo").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const email = $("email").value.trim();
    const password = $("password").value;
    if (!email || !password) {
      mostra("errore", "Scrivi la tua email e la tua password.");
      (email ? $("password") : $("email")).focus();
      return;
    }

    $("invia").disabled = true;
    $("invia").textContent = "Un attimo…";
    const r = await Lena.chiama("POST", "/api/auth/login", { email, password });

    if (r.stato === 200) {
      location.replace(r.json.ruolo === "pt" ? "/pt.html" : "/scheda.html");
      return;
    }
    $("invia").disabled = false;
    $("invia").textContent = "Accedi";
    if (r.stato === 401) {
      mostra("errore", "Email o password non corrette.");
      $("password").select();
    } else {
      mostra("errore", Lena.messaggioComune(r) || "Non sono riuscito ad accedere. Riprova.");
    }
  });
})();
