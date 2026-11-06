// Pagina d'ingresso: ti manda dove devi andare in base a chi sei.
(async function () {
  const r = await Lena.chiama("GET", "/api/auth/me");
  if (r.stato === 200) location.replace(r.json.ruolo === "pt" ? "/pt.html" : "/scheda.html");
  else if (r.stato === 401) location.replace("/login.html");
  else {
    document.getElementById("titolo").textContent = "Non riesco a collegarmi";
    document.getElementById("testo").textContent = Lena.messaggioComune(r) || "Qualcosa non ha funzionato.";
    document.getElementById("riprova").hidden = false;
  }
})();
