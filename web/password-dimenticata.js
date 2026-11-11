(function () {
  const $ = (id) => document.getElementById(id);
  const messaggio = $("messaggio");
  function mostra(tipo, testo) { messaggio.className = "messaggio " + tipo; messaggio.textContent = testo; messaggio.hidden = false; }

  $("modulo").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const email = $("email").value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      mostra("errore", "Scrivi un indirizzo email valido, per esempio nome@esempio.it.");
      $("email").focus();
      return;
    }
    $("invia").disabled = true;
    $("invia").textContent = "Un attimo…";
    const r = await Lena.chiama("POST", "/api/auth/password-dimenticata", { email });
    if (r.stato === 200) {
      // Stessa risposta per tutti: non diciamo se l'email ha un account
      $("modulo").hidden = true;
      $("introduzione").hidden = true;
      mostra("ok", "Se questa email ha un account, ti abbiamo mandato un link (vale 1 ora). Controlla anche lo spam.");
      return;
    }
    $("invia").disabled = false;
    $("invia").textContent = "Mandami il link";
    mostra("errore", Lena.messaggioComune(r) || (r.json && r.json.errore) || "Qualcosa non ha funzionato. Riprova.");
  });
})();
