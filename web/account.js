/* account.html: il cliente scarica i suoi dati o cancella il suo account, da solo.
   Cancellare richiede: la password riscritta + la casella di conferma. Al server arrivano entrambe (il server le controlla). */
(function () {
  const $ = (id) => document.getElementById(id);
  const msg = (tipo, titolo, testo) => {
    const d = document.createElement("div");
    d.className = "avviso-pt " + tipo;
    const s = document.createElement("strong"); s.textContent = titolo; d.append(s);
    if (testo) d.append(document.createTextNode(testo));
    return d;
  };
  let utente = null;

  $("esci").addEventListener("click", () => Lena.esci());

  // ---------- scaricare i miei dati ----------
  $("esporta").addEventListener("click", async () => {
    const esito = $("esporta-esito");
    esito.replaceChildren();
    $("esporta").disabled = true;
    try {
      const res = await fetch("/api/me/esporta", { credentials: "same-origin" });
      if (res.status === 401) { location.replace("/login.html?sessione=scaduta"); return; }
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "lena-i-miei-dati.json";
      document.body.append(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      esito.append(msg("ok", "File scaricato. ", "Contiene tutti i tuoi dati."));
    } catch (e) {
      esito.append(msg("errore", "Non sono riuscito a scaricare i dati. ", "Controlla la connessione e riprova."));
    }
    $("esporta").disabled = false;
  });

  // ---------- cancellare il mio account ----------
  const pronto = () => $("password").value.length > 0 && $("conferma").checked;
  const aggiorna = () => { if (!inCorso) $("cancella").disabled = !pronto(); };
  let inCorso = false;
  $("password").addEventListener("input", aggiorna);
  $("conferma").addEventListener("change", aggiorna);

  $("cancella").addEventListener("click", async () => {
    if (inCorso || !pronto()) return;
    inCorso = true;
    $("cancella").disabled = true;
    $("cancella").textContent = "Cancello…";
    const esito = $("cancella-esito");
    esito.replaceChildren();
    const r = await Lena.chiama("DELETE", "/api/me/account", { password: $("password").value, conferma: true });
    if (r.stato === 204) {
      // anche la copia locale dei progressi di questo utente va tolta dal dispositivo
      try { for (const k of Object.keys(localStorage)) if (k.startsWith(`lena:coda:${utente.id}:`)) localStorage.removeItem(k); } catch (e) { /* bloccata */ }
      location.replace("/account-cancellato.html");
      return;
    }
    inCorso = false;
    $("cancella").textContent = "Cancella il mio account";
    aggiorna();
    if (r.stato === 403 && r.json && r.json.codice === "PASSWORD_ERRATA") esito.append(msg("errore", "La password non è corretta. ", "Non ho cancellato niente."));
    else if (r.stato === 429) esito.append(msg("errore", "Troppi tentativi. ", "Riprova tra qualche minuto."));
    else if (r.stato === 401) location.replace("/login.html?sessione=scaduta");
    else esito.append(msg("errore", "Non ho cancellato niente. ", Lena.messaggioComune(r) || (r.json && r.json.errore) || "Riprova."));
  });

  // ---------- avvio ----------
  (async () => {
    const me = await Lena.chiama("GET", "/api/auth/me");
    if (me.stato === 401) { location.replace("/login.html"); return; }
    if (me.stato === 200 && me.json.ruolo !== "cliente") { location.replace("/pt.html"); return; }
    if (me.stato !== 200) {
      $("stato-pagina").append(msg("errore", "Non riesco a collegarmi. ", Lena.messaggioComune(me) || "Riprova tra poco."));
      return;
    }
    utente = me.json;
    $("chi").textContent = `Sei dentro come ${utente.email}.`;
    $("pagina").hidden = false;
    // Il profilo del mio trainer (se non si carica, la pagina funziona lo stesso)
    const t = await Lena.chiama("GET", "/api/me/trainer");
    if (t.stato === 200) { $("sezione-trainer").hidden = false; LenaProfilo.disegnaScheda($("scheda-trainer"), t.json, "/api/me/trainer/foto"); }
  })();
})();
