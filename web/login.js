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

  // Da quale porta della home si arriva: "pt" o "cliente" (senza, il login funziona come prima)
  const q = new URLSearchParams(location.search).get("ruolo");
  const ruolo = q === "pt" || q === "cliente" ? q : null;
  if (ruolo === "pt") {
    document.title = "Accesso trainer · Lena";
    $("titolo-login").textContent = "Area trainer.";
    $("testo-login").textContent = "Entra per gestire i tuoi clienti e le loro schede.";
    $("sotto-login").textContent = "Gli account trainer li attiva chi gestisce Lena. Se ti serve, contattaci.";
  } else if (ruolo === "cliente") {
    document.title = "Accesso cliente · Lena";
  }
  if (ruolo) $("cambia").hidden = false;

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
    const r = await Lena.chiama("POST", "/api/auth/login", ruolo ? { email, password, ruolo } : { email, password });

    if (r.stato === 200) {
      location.replace(Lena.paginaDopoLogin(r.json.ruolo));
      return;
    }
    $("invia").disabled = false;
    $("invia").textContent = "Accedi";
    if (r.stato === 403 && r.json && r.json.codice === "RUOLO_SBAGLIATO") {
      mostra("errore", r.json.ruolo === "pt"
        ? "Questo account è di un personal trainer. Torna indietro e scegli «Sono un personal trainer»."
        : "Questo account è di un cliente. Torna indietro e scegli «Sono un cliente».");
    } else if (r.stato === 401) {
      mostra("errore", "Email o password non corrette.");
      $("password").select();
    } else {
      mostra("errore", Lena.messaggioComune(r) || "Non sono riuscito ad accedere. Riprova.");
    }
  });
})();
