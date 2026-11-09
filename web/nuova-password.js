(function () {
  const $ = (id) => document.getElementById(id);
  const messaggio = $("messaggio");
  const codice = (new URLSearchParams(location.search).get("codice") || "").trim();
  function mostra(tipo, testo) { messaggio.className = "messaggio " + tipo; messaggio.textContent = testo; messaggio.hidden = false; }
  function soloMessaggio(testo) {
    $("modulo").hidden = true;
    $("introduzione").hidden = true;
    mostra("errore", testo);
    const link = document.createElement("p");
    link.className = "sotto";
    const a = document.createElement("a");
    a.href = "/password-dimenticata.html"; a.textContent = "Chiedi un nuovo link";
    link.append(a);
    messaggio.after(link);
  }

  if (!codice) soloMessaggio("Questo link non è completo: manca il codice. Apri il link dell'email per intero, oppure chiedine uno nuovo.");

  $("mostra").addEventListener("change", (ev) => { $("password").type = ev.target.checked ? "text" : "password"; });

  $("modulo").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const password = $("password").value;
    if (password.length < 10) {
      mostra("errore", `La password è troppo corta: servono almeno 10 caratteri (ne hai scritti ${password.length}).`);
      $("password").focus();
      return;
    }
    $("invia").disabled = true;
    $("invia").textContent = "Un attimo…";
    const r = await Lena.chiama("POST", "/api/auth/nuova-password", { codice, password });
    if (r.stato === 200) {
      $("modulo").hidden = true;
      $("introduzione").hidden = true;
      mostra("ok", "Password cambiata. Ora puoi accedere con quella nuova.");
      const p = document.createElement("p");
      const a = document.createElement("a");
      a.className = "pulsante"; a.href = "/login.html"; a.textContent = "Vai al login";
      p.append(a);
      messaggio.after(p);
      document.querySelector(".sotto").hidden = true;   // il pulsante sopra basta
      return;
    }
    $("invia").disabled = false;
    $("invia").textContent = "Cambia password";
    const errore = r.json && r.json.errore;
    if (r.stato === 400 && /link non è valido/.test(errore || "")) soloMessaggio(errore);
    else mostra("errore", Lena.messaggioComune(r) || errore || "Qualcosa non ha funzionato. Riprova.");
  });
})();
