/* Aiuti comuni alle pagine dell'area del PT (pt.html e pt-cliente.html).
   Espone un solo nome globale: LenaPt. Richiede api.js (Lena). */
(function () {
  const IT = "it-IT";

  // Prima cosa di ogni pagina del PT: chi sei? Non loggato → login; cliente → la sua scheda.
  // Restituisce l'utente (se è un PT), altrimenti non restituisce mai (la pagina cambia).
  async function verificaPt() {
    const r = await Lena.chiama("GET", "/api/auth/me");
    if (r.stato === 401) { location.replace("/login.html"); return new Promise(() => {}); }   // non è mai entrato: login pulito, senza «sessione scaduta»
    if (r.stato === 200 && r.json.ruolo !== "pt") { location.replace("/scheda.html"); return new Promise(() => {}); }
    if (r.stato !== 200) return null;   // rete o server: la pagina mostra il suo messaggio con "Riprova"
    // Le condizioni d'uso (versione corrente) vanno accettate prima di usare l'area: altrimenti si va alla schermata apposta
    const c = await Lena.chiama("GET", "/api/privacy/condizioni-pt");
    if (c.stato === 200 && !c.json.accettate) { vaiAlleCondizioni(); return new Promise(() => {}); }
    return r.json;
  }
  function vaiAlleCondizioni() { location.replace("/condizioni-pt.html"); }
  function vaiAlLogin() { location.replace("/login.html?sessione=scaduta"); }

  // Come Lena.chiama, ma se la sessione è scaduta (401) manda al login
  async function chiama(metodo, url, corpo) {
    const r = await Lena.chiama(metodo, url, corpo);
    if (r.stato === 401) { vaiAlLogin(); return new Promise(() => {}); }
    // le condizioni sono cambiate mentre si lavorava: si torna alla schermata per accettarle
    if (r.stato === 403 && r.json && r.json.codice === "CONDIZIONI_DA_ACCETTARE") { vaiAlleCondizioni(); return new Promise(() => {}); }
    return r;
  }

  // ---------- testi e date ----------
  const dataBreve = (iso) => (iso ? new Date(iso).toLocaleDateString(IT, { day: "numeric", month: "long", year: "numeric" }) : "");
  const dataOra = (iso) => (iso ? new Date(iso).toLocaleString(IT, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
  // minuscolo, senza accenti e con spazi singoli: per confrontare nomi e per cercare
  const normalizza = (t) => String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

  // Lo stato di un cliente, in parole (per l'elenco e per la pagina del cliente)
  function statoCliente(c) {
    if (c.rapporto_finito_il) return { testo: `Rapporto concluso il ${dataBreve(c.rapporto_finito_il)}`, tipo: "neutro", breve: "Concluso", dettaglio: `Il ${dataBreve(c.rapporto_finito_il)}` };
    if (!c.schede) return { testo: "Nessuna scheda", tipo: "nessuna", breve: "Nessuna scheda", dettaglio: "Ancora nessuna scheda caricata" };
    if (!c.registrato) {
      return c.invito_attivo
        ? { testo: `Invito non ancora usato (scade il ${dataBreve(c.invito_scade_il)})`, tipo: "invito", breve: "Invito in attesa", dettaglio: `Scade il ${dataBreve(c.invito_scade_il)}` }
        : { testo: "Scheda caricata, da invitare", tipo: "neutro", breve: "Da invitare", dettaglio: "Scheda caricata, manca l'invito" };
    }
    return c.ultimo_progresso
      ? { testo: `Attivo, ultimo allenamento il ${dataBreve(c.ultimo_progresso)}`, tipo: "attivo", breve: "Si allena", dettaglio: `Ultimo allenamento il ${dataBreve(c.ultimo_progresso)}` }
      : { testo: "Registrato, non ha ancora segnato nulla", tipo: "neutro", breve: "Registrato", dettaglio: "Non ha ancora segnato nulla" };
  }

  // Quando scade la scheda di un cliente: serve solo se mancano al massimo SOGLIA_SCADENZA giorni (o è già scaduta).
  const SOGLIA_SCADENZA = 14;
  function scadenza(c) {
    if (!c.schede || c.rapporto_finito_il || c.giorni_alla_scadenza == null || c.giorni_alla_scadenza > SOGLIA_SCADENZA) return null;
    const g = c.giorni_alla_scadenza;
    const giorni = (n) => `${n} ${n === 1 ? "giorno" : "giorni"}`;
    const testo = g < 0 ? `scaduta da ${giorni(-g)}` : g === 0 ? "scade oggi" : g === 1 ? "scade domani" : `scade tra ${giorni(g)}`;
    return { giorni: g, scaduta: g < 0, testo, data: c.scheda_scade_il };
  }

  // ---------- costruire pezzi di pagina SEMPRE come testo (mai come HTML) ----------
  function el(tag, attrs, ...figli) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const f of figli.flat()) if (f != null) e.append(f.nodeType ? f : document.createTextNode(String(f)));
    return e;
  }

  // Un riquadro di messaggio (errore/avviso/ok/info) con un titolo e un elenco facoltativo
  function messaggio(tipo, titolo, elenco) {
    const box = el("div", { class: `avviso-pt ${tipo}` }, titolo ? el("strong", {}, titolo) : null);
    if (elenco && elenco.length) box.append(el("ul", {}, elenco.map((v) => el("li", {}, v))));
    return box;
  }

  // Un messaggio d'errore comprensibile per una risposta del server; "cosa" = ciò che si stava facendo
  function testoErrore(r, cosa) {
    return Lena.messaggioComune(r) || (r.json && r.json.errore) || `Non sono riuscito a ${cosa}. Riprova.`;
  }

  // ---------- la cornice con l'anteprima o con la scheda del cliente ----------
  // Mostra /anteprima.html dentro "contenitore" e, quando dice "pronta", le manda i dati con postMessage.
  // Con "registrazioni" la scheda è in sola lettura con i progressi. Restituisce la funzione per chiuderla.
  function cornice(contenitore, dati, registrazioni) {
    contenitore.replaceChildren();
    const f = el("iframe", { title: registrazioni ? "La scheda del cliente, con i suoi progressi" : "Anteprima della scheda", src: "/anteprima.html" });
    let mandata = false;
    function ascolta(ev) {
      // si ascolta solo la nostra cornice, e solo dalla nostra origine
      if (ev.origin !== location.origin || ev.source !== f.contentWindow) return;
      if (ev.data && ev.data.tipo === "pronta" && !mandata) {
        mandata = true;
        f.contentWindow.postMessage({ tipo: "scheda", dati, registrazioni }, location.origin);
      }
    }
    window.addEventListener("message", ascolta);
    contenitore.append(f);
    return () => { window.removeEventListener("message", ascolta); contenitore.replaceChildren(); };
  }

  // Un messaggio da mostrare nella pagina successiva (es. "Cliente cancellato")
  const ricordaMessaggio = (testo) => { try { sessionStorage.setItem("lena:messaggio", testo); } catch (e) { /* pazienza */ } };
  function prendiMessaggio() {
    try { const t = sessionStorage.getItem("lena:messaggio"); sessionStorage.removeItem("lena:messaggio"); return t; } catch (e) { return null; }
  }

  window.LenaPt = { verificaPt, chiama, vaiAlLogin, dataBreve, dataOra, normalizza, statoCliente, scadenza, el, messaggio, testoErrore, cornice, ricordaMessaggio, prendiMessaggio };
})();
