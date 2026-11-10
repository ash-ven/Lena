/* L'app sul telefono: registra il service worker (sw.js) e gestisce il riquadro «Metti Lena sul telefono».
   Il riquadro compare solo dove c'è l'elemento #installa e solo se Lena non è già aperta come app. */
(function () {
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => { /* pazienza: il sito funziona lo stesso */ }); });
  }

  const riquadro = document.getElementById("installa");
  if (!riquadro) return;
  const giaApp = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  if (giaApp) return;
  riquadro.hidden = false;

  // Su Android/Chrome il pulsante installa con un tocco; su iPhone restano le istruzioni a parole
  const bottone = document.getElementById("installa-bottone");
  let proposta = null;
  window.addEventListener("beforeinstallprompt", (ev) => { ev.preventDefault(); proposta = ev; bottone.hidden = false; });
  bottone.addEventListener("click", async () => {
    if (!proposta) return;
    proposta.prompt();
    try { await proposta.userChoice; } catch (e) { /* chiuso senza scegliere */ }
    proposta = null;
    bottone.hidden = true;
  });
  window.addEventListener("appinstalled", () => { riquadro.hidden = true; });
})();
