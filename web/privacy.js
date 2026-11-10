// Mostra la versione corrente dell'informativa (la decide api/config.js, non questa pagina)
// e, nell'informativa dei clienti, i dati del titolare: il trainer di chi legge.
(async function () {
  const r = await Lena.chiama("GET", "/api/privacy/versioni");
  const nome = document.body.dataset.testo || "informativa_cliente";
  if (r.stato === 200) document.getElementById("versione").textContent = r.json[nome];

  const campi = document.querySelectorAll("[data-titolare]");
  if (!campi.length) return;
  // Dall'invito (prima di registrarsi) oppure, se hai già un account, dal tuo trainer
  const codice = (new URLSearchParams(location.search).get("codice") || "").trim();
  const t = await Lena.chiama("GET", codice ? "/api/privacy/titolare?codice=" + encodeURIComponent(codice) : "/api/me/titolare");
  for (const c of campi) {
    const valore = t.stato === 200 && t.json ? t.json[c.dataset.titolare] : "";
    if (valore) { c.textContent = valore; c.classList.remove("segnaposto"); }
    else { c.textContent = "[i dati del professionista compaiono aprendo questa pagina dal tuo invito o dopo l'accesso]"; c.classList.add("segnaposto"); }
  }
})();
