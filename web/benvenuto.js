/* benvenuto.html: la pagina di casa del cliente. È sempre la prima cosa che si apre dopo l'accesso.
   Mostra il saluto, la sua scheda (se c'è) con il pulsante per aprirla quando vuole, e il suo trainer.
   La scheda NON si apre da sola: decide il cliente. Se la scheda arriva mentre la pagina è aperta, compare qui (controllo ogni minuto). */
(function () {
  const $ = (id) => document.getElementById(id);
  $("esci").addEventListener("click", () => Lena.esci());

  const data = (d) => d.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
  const giorno = (iso) => { const [a, m, g] = String(iso).split("-").map(Number); return new Date(a, m - 1, g); };
  const SOTTO_ATTESA = "Il tuo trainer sta preparando la tua scheda. Appena è pronta, la trovi qui: questa pagina si aggiorna da sola.";
  const SOTTO_PRONTA = "Quando vuoi, apri la tua scheda. Il tuo trainer è qui sotto.";

  // dove si è, a oggi, nella scheda: in parole
  function statoScheda(dati) {
    const inizio = giorno(dati.inizio), fine = giorno(dati.inizio); fine.setDate(fine.getDate() + dati.settimane * 7 - 1);
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
    const giorni = Math.round((oggi - inizio) / 86400000);
    const periodo = `${dati.settimane} ${dati.settimane === 1 ? "settimana" : "settimane"}, dal ${data(inizio)} al ${data(fine)}`;
    if (giorni < 0) return { periodo, stato: `Inizia il ${data(inizio)}.` };
    if (oggi > fine) return { periodo, stato: `È finita il ${data(fine)}. Il tuo trainer ne preparerà una nuova.` };
    return { periodo, stato: `Oggi sei nella settimana ${Math.floor(giorni / 7) + 1} di ${dati.settimane}.` };
  }

  // Controlla se la scheda c'è e aggiorna la pagina. Restituisce false se la sessione è scaduta.
  async function aggiornaScheda() {
    const r = await Lena.chiama("GET", "/api/me/scheda");
    if (r.stato === 401) { location.replace("/login.html?sessione=scaduta"); return false; }
    const c = r.stato === 200 && r.json && r.json.scheda && r.json.scheda.dati;   // 404 = ancora niente; un errore di rete: resta com'è
    if (r.stato !== 200 && r.stato !== 404) return true;
    $("sezione-scheda").hidden = !c;
    $("sotto-saluto").textContent = c ? SOTTO_PRONTA : SOTTO_ATTESA;
    if (c) {
      const s = statoScheda(c);
      $("scheda-titolo").textContent = c.info.titolo || "La tua scheda";
      $("scheda-periodo").textContent = s.periodo;
      $("scheda-stato").textContent = s.stato;
    }
    return true;
  }

  async function avvia() {
    const me = await Lena.chiama("GET", "/api/auth/me");
    if (me.stato === 401) return location.replace("/login.html");
    if (me.stato === 200 && me.json.ruolo === "pt") return location.replace("/pt.html");
    if (!(await aggiornaScheda())) return;

    const p = await Lena.chiama("GET", "/api/me/profilo");
    if (p.stato === 200 && p.json.nome) $("saluto").textContent = `Ciao, ${p.json.nome}.`;
    const t = await Lena.chiama("GET", "/api/me/trainer");
    if (t.stato === 200) { $("sezione-trainer").hidden = false; LenaProfilo.disegnaScheda($("scheda-trainer"), t.json, "/api/me/trainer/foto"); }
    $("pagina").hidden = false;

    setInterval(() => { if (document.visibilityState === "visible") aggiornaScheda(); }, 60000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") aggiornaScheda(); });
  }
  avvia();
})();
