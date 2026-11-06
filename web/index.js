// Pagina d'ingresso: se sei già dentro ti porta alla tua pagina, altrimenti mostra la scelta tra trainer e cliente.
(async function () {
  const home = document.getElementById("home");
  const r = await Lena.chiama("GET", "/api/auth/me");
  if (r.stato === 200) { location.replace(r.json.ruolo === "pt" ? "/pt.html" : "/scheda.html"); return; }
  if (r.stato !== 401) {   // il server non risponde: la scelta si vede lo stesso, con un avviso
    const a = document.getElementById("avviso");
    a.textContent = Lena.messaggioComune(r) || "Non riesco a collegarmi al server. Riprova tra poco.";
    a.hidden = false;
  }
  home.hidden = false;
})();
