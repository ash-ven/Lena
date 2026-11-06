// Mostra la versione corrente dell'informativa (la decide api/config.js, non questa pagina)
(async function () {
  const r = await Lena.chiama("GET", "/api/privacy/versioni");
  const nome = document.body.dataset.testo || "informativa_cliente";
  if (r.stato === 200) document.getElementById("versione").textContent = r.json[nome];
})();
