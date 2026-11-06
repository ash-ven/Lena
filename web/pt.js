(async function () {
  document.getElementById("esci").addEventListener("click", () => Lena.esci());
  // Questa pagina è solo per i PT: chi non ha fatto il login va al login, un cliente alla sua scheda
  const r = await Lena.chiama("GET", "/api/auth/me");
  if (r.stato === 401) location.replace("/login.html");
  else if (r.stato === 200 && r.json.ruolo !== "pt") location.replace("/scheda.html");
})();
