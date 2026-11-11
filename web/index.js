// Pagina d'ingresso: se sei già dentro ti porta alla tua pagina, altrimenti mostra la scelta tra trainer e cliente.
// La frase sotto il logo cambia a ogni visita: una a caso tra queste (la prima è anche quella scritta nell'HTML, per chi non ha JavaScript)
const FRASI = [
  "La tua scheda, sempre con te.",
  "Ogni allenamento, al suo posto.",
  "Un passo alla volta.",
  "Serie dopo serie, settimana dopo settimana.",
];

(async function () {
  const home = document.getElementById("home");
  const frase = document.querySelector(".home-frase");
  if (frase) frase.textContent = FRASI[Math.floor(Math.random() * FRASI.length)];
  const r = await Lena.chiama("GET", "/api/auth/me");
  if (r.stato === 200) { location.replace(r.json.ruolo === "pt" ? "/pt.html" : "/benvenuto.html"); return; }
  // Senza rete, con la copia della scheda sul telefono (l'ha attivata il cliente): si apre direttamente la scheda
  if ((r.stato === 0 || r.stato >= 500) && window.LenaCopia && LenaCopia.leggi()) { location.replace("/scheda.html"); return; }
  if (r.stato !== 401) {   // il server non risponde: la scelta si vede lo stesso, con un avviso
    const a = document.getElementById("avviso");
    a.textContent = Lena.messaggioComune(r) || "Non riesco a collegarmi al server. Riprova tra poco.";
    a.hidden = false;
  }
  home.hidden = false;
})();
