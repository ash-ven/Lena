/* L'app sul telefono: registra il service worker (sw.js) e propone di installarla.
   Due punti dove compare l'invito, entrambi opzionali (se l'elemento non c'è, non succede niente):
     - #installa: il riquadro fisso «Metti Lena sul telefono» (in «Il mio account» e nel profilo del trainer);
     - #installa-invito: la striscia in alto nella pagina del cliente e del trainer, che si può chiudere con «Non ora».
   Niente di tutto questo compare se Lena è già aperta come app. */
(function () {
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => { /* pazienza: il sito funziona lo stesso */ }); });
  }

  const giaApp = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  if (giaApp) return;

  const CHIAVE_CHIUSO = "lena:installa-chiuso";   // solo una comodità di questo dispositivo: se la memoria è bloccata, la striscia ricompare
  const suIphone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const $ = (id) => document.getElementById(id);
  const riquadro = $("installa"), invito = $("installa-invito");
  const bottoni = [$("installa-bottone"), $("installa-invito-bottone")].filter(Boolean);

  if (riquadro) riquadro.hidden = false;
  if (invito) {
    let chiuso = false;
    try { chiuso = localStorage.getItem(CHIAVE_CHIUSO) === "1"; } catch (e) { /* memoria bloccata */ }
    if (!chiuso) {
      $("installa-invito-testo").textContent = suIphone
        ? "La apri dall'icona, come un'app. Su iPhone: tocca «Condividi», poi «Aggiungi alla schermata Home»."
        : "La apri dall'icona, come un'app. Dal menu del browser scegli «Installa app» o «Aggiungi a schermata Home».";
      invito.hidden = false;
    }
    $("installa-invito-chiudi").addEventListener("click", () => {
      invito.hidden = true;
      try { localStorage.setItem(CHIAVE_CHIUSO, "1"); } catch (e) { /* pazienza */ }
    });
  }

  // Su Android/Chrome il pulsante installa con un tocco; su iPhone restano le istruzioni a parole
  let proposta = null;
  window.addEventListener("beforeinstallprompt", (ev) => {
    ev.preventDefault(); proposta = ev;
    for (const b of bottoni) b.hidden = false;
    if (invito && !invito.hidden) $("installa-invito-testo").textContent = "La apri dall'icona, come un'app.";
  });
  for (const b of bottoni) b.addEventListener("click", async () => {
    if (!proposta) return;
    proposta.prompt();
    try { await proposta.userChoice; } catch (e) { /* chiuso senza scegliere */ }
    proposta = null;
    for (const x of bottoni) x.hidden = true;
  });
  window.addEventListener("appinstalled", () => { if (riquadro) riquadro.hidden = true; if (invito) invito.hidden = true; });
})();
