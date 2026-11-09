(function () {
  const $ = (id) => document.getElementById(id);
  const messaggio = $("messaggio");

  function mostra(testo) {
    messaggio.className = "messaggio errore";
    messaggio.textContent = testo;
    messaggio.hidden = false;
  }
  function pronto() { $("invia").disabled = false; $("invia").textContent = "Crea il mio account"; }

  $("mostra").addEventListener("change", (ev) => {
    $("password").type = ev.target.checked ? "text" : "password";
  });

  $("modulo").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const nome = $("nome").value.trim();
    const email = $("email").value.trim();
    const password = $("password").value;

    if (!nome) { mostra("Scrivi il tuo nome."); $("nome").focus(); return; }
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

    $("invia").disabled = true;
    $("invia").textContent = "Un attimo…";
    const r = await Lena.chiama("POST", "/api/auth/registra-pt", { nome, email, password });

    if (r.stato === 201) {
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
