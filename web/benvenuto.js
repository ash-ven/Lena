/* benvenuto.html: la pagina del cliente che ha già l'accesso ma non ha ancora una scheda.
   Mostra il saluto e il suo trainer. Appena la scheda c'è (la pagina lo controlla da sola, senza pulsanti) porta alla scheda. */
(function () {
  const $ = (id) => document.getElementById(id);
  $("esci").addEventListener("click", () => Lena.esci());

  async function controllaScheda() {
    const r = await Lena.chiama("GET", "/api/me/scheda");
    if (r.stato === 401) { location.replace("/login.html?sessione=scaduta"); return false; }
    if (r.stato === 200) { location.replace("/scheda.html"); return true; }
    return false;   // 404 = ancora niente; un errore di rete = si riprova al prossimo controllo
  }

  async function avvia() {
    const me = await Lena.chiama("GET", "/api/auth/me");
    if (me.stato === 401) return location.replace("/login.html");
    if (me.stato === 200 && me.json.ruolo === "pt") return location.replace("/pt.html");
    if (await controllaScheda()) return;

    const p = await Lena.chiama("GET", "/api/me/profilo");
    if (p.stato === 200 && p.json.nome) $("saluto").textContent = `Ciao, ${p.json.nome}.`;
    const t = await Lena.chiama("GET", "/api/me/trainer");
    if (t.stato === 200) { $("sezione-trainer").hidden = false; LenaProfilo.disegnaScheda($("scheda-trainer"), t.json, "/api/me/trainer/foto"); }
    $("pagina").hidden = false;

    // la scheda può arrivare mentre la pagina è aperta: si controlla ogni minuto e quando si torna sulla pagina
    setInterval(() => { if (document.visibilityState === "visible") controllaScheda(); }, 60000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") controllaScheda(); });
  }
  avvia();
})();
