/* Modalità scura / chiara / automatica.
   Va caricato nell'<head> (senza defer), così il tema giusto c'è già al primo disegno e non si vede il lampo di colore sbagliato.
   È un file a parte perché la CSP del sito vieta gli script scritti dentro le pagine.
   La scelta si ricorda in localStorage (solo su questo dispositivo): se non si può, funziona lo stesso, solo non si ricorda. */
(function () {
  "use strict";
  var CHIAVE = "lena:tema";
  var ORDINE = ["auto", "scura", "chiara"];
  var ETICHETTE = { auto: "Automatico", scura: "Scuro", chiara: "Chiaro" };
  var ICONE = { auto: "i-auto", scura: "i-luna", chiara: "i-sole" };

  function leggi() {
    try { var v = localStorage.getItem(CHIAVE); return v === "scura" || v === "chiara" ? v : "auto"; } catch (e) { return "auto"; }
  }
  function memorizza(v) { try { if (v === "auto") localStorage.removeItem(CHIAVE); else localStorage.setItem(CHIAVE, v); } catch (e) { /* pazienza */ } }

  // Il colore della barra del browser sul telefono segue lo sfondo del tema
  function aggiornaBarra() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    var c = getComputedStyle(document.documentElement).getPropertyValue("--sfondo").trim();
    if (c) meta.setAttribute("content", c);
  }
  function applica(v) {
    var r = document.documentElement;
    if (v === "auto") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", v);
    aggiornaBarra();
  }

  applica(leggi());   // subito, prima del primo disegno

  function disegnaControllo(box) {
    var v = leggi();
    var bottone = document.createElement("button");
    bottone.type = "button";
    bottone.className = "tema-bottone";
    var icona = document.createElement("span");
    icona.className = "icona " + ICONE[v];
    icona.setAttribute("aria-hidden", "true");
    var testo = document.createElement("span");
    testo.className = "tema-testo";
    testo.textContent = ETICHETTE[v];
    var stato = document.createElement("span");
    stato.className = "solo-lettori";
    stato.setAttribute("role", "status");
    bottone.append(icona, testo, stato);
    bottone.setAttribute("aria-label", "Aspetto: " + ETICHETTE[v].toLowerCase() + ". Premi per cambiare.");
    bottone.addEventListener("click", function () {
      var prossimo = ORDINE[(ORDINE.indexOf(leggi()) + 1) % ORDINE.length];
      memorizza(prossimo);
      applica(prossimo);
      icona.className = "icona " + ICONE[prossimo];
      testo.textContent = ETICHETTE[prossimo];
      bottone.setAttribute("aria-label", "Aspetto: " + ETICHETTE[prossimo].toLowerCase() + ". Premi per cambiare.");
      stato.textContent = "Aspetto: " + ETICHETTE[prossimo].toLowerCase();
    });
    box.replaceChildren(bottone);
  }

  document.addEventListener("DOMContentLoaded", function () {
    aggiornaBarra();
    var box = document.querySelectorAll("[data-tema-controllo]");
    for (var i = 0; i < box.length; i++) disegnaControllo(box[i]);
  });
  // se il telefono cambia modalità mentre la pagina è aperta e si è in automatico, si aggiorna la barra
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: light)");
    var su = function () { if (leggi() === "auto") aggiornaBarra(); };
    if (mq.addEventListener) mq.addEventListener("change", su);
  }
  window.LenaTema = { leggi: leggi, imposta: function (v) { memorizza(v); applica(v); } };
})();
