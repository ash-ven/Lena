/* L'omino a fine scheda: mostra i muscoli che la scheda allena, come una mappa che si illumina.
   Più esercizi allenano lo stesso muscolo, più quel muscolo è luminoso.
   Si usa solo sul sito (non nella scheda scaricabile). Servono, già caricati: muscoli.js e omino-dati.js.
   Le funzioni «pure» (conteggi, livelli) sono esportate per i test; il resto disegna la pagina. */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica(require("./muscoli.js"), require("./omino-dati.js"));
  else radice.LenaOmino = fabbrica(radice.LenaMuscoli, radice.LenaOminoDati);
})(typeof self !== "undefined" ? self : this, function (Muscoli, DATI_FIGURE) {
  const LIVELLI = 5;
  const LARGHEZZA = 402;   // la figura più larga (in pixel dell'immagine)

  // Per ogni muscolo, quanti esercizi lo allenano nei giorni indicati. Contano gli esercizi dei blocchi
  // (anche quelli dentro un circuito); riscaldamento e stretching no.
  function conteggi(giorni) {
    const n = {};
    const conta = (nome) => { for (const m of Muscoli.muscoliDi(nome)) n[m] = (n[m] || 0) + 1; };
    for (const g of giorni || []) {
      for (const b of g.blocchi || []) {
        if (b.tipo === "circuito") for (const e of b.esercizi || []) conta(e.nome);
        else conta(b.nome);
      }
    }
    return n;
  }

  // Da quanti esercizi a quanto si illumina (1 = appena acceso … 5 = al massimo).
  // Un solo giorno: 1 esercizio = livello 1, 2 = livello 2 … da 5 in su = 5.
  // Tutta la scheda: i numeri sono più alti, quindi si confronta con il muscolo più allenato.
  function livelli(n, relativo) {
    const ids = Object.keys(n).filter((m) => n[m] > 0);
    const max = Math.max(1, ...ids.map((m) => n[m]));
    const l = {};
    for (const m of ids) l[m] = relativo ? Math.max(1, Math.ceil((LIVELLI * n[m]) / max)) : Math.min(LIVELLI, n[m]);
    return l;
  }

  // Quali muscoli compaiono in una figura (id), in base ai tracciati disponibili
  function muscoliVisibili(chiave) {
    const f = DATI_FIGURE[chiave];
    const ids = Object.keys(f.parti);
    if (f.parti.glutei && /dietro/.test(chiave)) ids.push("abduttori");   // il gluteo medio è la parte laterale dei glutei
    return ids;
  }

  const NS = "http://www.w3.org/2000/svg";
  const S = (tag, attrs = {}, ...figli) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
    for (const f of figli) if (f) e.append(f);
    return e;
  };

  // Una figura (uomo/donna, davanti/dietro) con i muscoli accesi secondo i livelli
  function figura(sesso, lato, lv, id) {
    const chiave = `${sesso}-${lato}`, f = DATI_FIGURE[chiave];
    const url = (nome) => `/omino/${chiave}${nome}`;
    const p = (d, extra) => S("path", Object.assign({ d }, extra));
    // stessa scala per tutte le figure: si guarda una finestra larga come la più larga, centrata sul corpo
    const svg = S("svg", { class: "omino-fig", viewBox: `${(f.w - LARGHEZZA) / 2} 0 ${LARGHEZZA} ${f.h}`, role: "img" });
    const ids = Object.keys(lv).filter((m) => lv[m] > 0 && (f.parti[m] || (m === "abduttori" && f.parti.glutei)));
    svg.setAttribute("aria-label", (lato === "davanti" ? "Davanti" : "Dietro") + (ids.length ? ": " + ids.map((m) => (Muscoli.MUSCOLI.find((x) => x.id === m) || {}).nome).filter(Boolean).join(", ") : ": nessun muscolo acceso"));
    const defs = S("defs");
    defs.append(
      S("mask", { id: `${id}-m`, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: f.w, height: f.h }, S("image", { href: url("-sagoma.png"), width: f.w, height: f.h })),
      S("clipPath", { id: `${id}-l` }, S("rect", { x: 0, y: 380, width: f.cx - 52, height: 200 }), S("rect", { x: f.cx + 52, y: 380, width: f.w, height: 200 })),
      S("filter", { id: `${id}-f1`, x: "-20%", y: "-20%", width: "140%", height: "140%" }, S("feGaussianBlur", { stdDeviation: 2.5 })),
      S("filter", { id: `${id}-f2`, x: "-20%", y: "-20%", width: "140%", height: "140%" }, S("feGaussianBlur", { stdDeviation: 5 })),
      S("filter", { id: `${id}-f3`, x: "-40%", y: "-40%", width: "180%", height: "180%" }, S("feGaussianBlur", { stdDeviation: 18 })));
    svg.append(defs, S("image", { href: url(".webp"), width: f.w, height: f.h, class: "omino-base" }));
    // una pila di strati: bagliore largo (fuori dal corpo), tinta sul corpo, luce sul corpo
    const strato = (classe, filtro, mascherato) => {
      const g = S("g", { class: classe, mask: mascherato ? `url(#${id}-m)` : null });
      for (let n = 1; n <= LIVELLI; n++) {
        const dentro = S("g", { class: `i${n}`, filter: `url(#${id}-${filtro})` });
        for (const m of ids.filter((x) => lv[x] === n)) {
          if (m === "abduttori") for (const d of f.parti.glutei) dentro.append(p(d, { "clip-path": `url(#${id}-l)` }));
          else for (const d of f.parti[m]) dentro.append(p(d));
        }
        if (dentro.childNodes.length > 1 || dentro.childNodes.length === 1) g.append(dentro);
      }
      return g;
    };
    svg.append(strato("omino-alone", "f3", false), strato("omino-tinta", "f1", true), strato("omino-luce", "f2", true));
    return svg;
  }

  // ---------- la sezione in fondo alla scheda ----------
  function monta(DATI, doc) {
    const d = doc || document;
    if (!DATI || !Array.isArray(DATI.giorni) || !DATI.giorni.length) return null;
    const sceltaFigura = () => { try { return localStorage.getItem("lena:omino") === "f" ? "f" : "m"; } catch (e) { return "m"; } };
    const stato = { sesso: sceltaFigura(), scope: "tutta" };

    const sezione = d.createElement("section");
    sezione.className = "omino card";
    sezione.id = "omino";
    const titolo = d.createElement("h3");
    titolo.className = "sezione";
    titolo.append("Muscoli allenati");
    const sotto = d.createElement("span");
    sotto.textContent = "Più esercizi lavorano lo stesso muscolo, più si illumina.";
    titolo.append(sotto);

    const barraSesso = d.createElement("div");
    barraSesso.className = "omino-scelta";
    barraSesso.setAttribute("role", "group");
    barraSesso.setAttribute("aria-label", "Figura");
    const barraGiorni = d.createElement("div");
    barraGiorni.className = "omino-scelta omino-giorni";
    barraGiorni.setAttribute("role", "group");
    barraGiorni.setAttribute("aria-label", "Giorni da mostrare");
    const quadro = d.createElement("div");
    quadro.className = "omino-quadro";
    const elenco = d.createElement("details");
    elenco.className = "omino-elenco";
    const legenda = d.createElement("div");
    legenda.className = "omino-legenda";
    legenda.setAttribute("aria-hidden", "true");
    const meno = d.createElement("span"); meno.textContent = "Meno";
    const barra = d.createElement("i");
    const piu = d.createElement("span"); piu.textContent = "Più";
    legenda.append(meno, barra, piu);

    const bottone = (testo, premuto, fa) => {
      const b = d.createElement("button");
      b.type = "button"; b.className = "btn piccolo"; b.textContent = testo;
      b.setAttribute("aria-pressed", String(premuto));
      b.addEventListener("click", fa);
      return b;
    };

    let contatore = 0;
    function disegna() {
      barraSesso.replaceChildren(
        bottone("Uomo", stato.sesso === "m", () => { stato.sesso = "m"; try { localStorage.setItem("lena:omino", "m"); } catch (e) { /* memoria bloccata */ } disegna(); }),
        bottone("Donna", stato.sesso === "f", () => { stato.sesso = "f"; try { localStorage.setItem("lena:omino", "f"); } catch (e) { /* memoria bloccata */ } disegna(); }));
      barraGiorni.replaceChildren(
        bottone("Tutta la scheda", stato.scope === "tutta", () => { stato.scope = "tutta"; disegna(); }),
        ...DATI.giorni.map((g, i) => bottone(g.titolo, stato.scope === i, () => { stato.scope = i; disegna(); })));
      const giorni = stato.scope === "tutta" ? DATI.giorni : [DATI.giorni[stato.scope]];
      const n = conteggi(giorni), lv = livelli(n, stato.scope === "tutta");
      contatore++;
      quadro.replaceChildren(figura(stato.sesso, "davanti", lv, `o${contatore}a`), figura(stato.sesso, "dietro", lv, `o${contatore}b`));
      // l'elenco a parole: per chi non vede l'immagine, e per leggere i numeri
      const voci = Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b));
      const sum = d.createElement("summary");
      sum.textContent = voci.length ? "Quali muscoli, in ordine" : "Nessun muscolo da mostrare";
      const ul = d.createElement("ul");
      for (const m of voci) {
        const li = d.createElement("li");
        li.textContent = `${(Muscoli.MUSCOLI.find((x) => x.id === m) || { nome: m }).nome}: ${n[m]} ${n[m] === 1 ? "esercizio" : "esercizi"}`;
        ul.append(li);
      }
      elenco.replaceChildren(sum, ...(voci.length ? [ul] : []));
      if (!voci.length) {
        const nota = d.createElement("p");
        nota.className = "omino-nota";
        nota.textContent = "Qui non ci sono esercizi che allenano un muscolo in particolare, come cardio o stretching.";
        elenco.append(nota);
      }
    }
    disegna();
    sezione.append(titolo, barraSesso, barraGiorni, quadro, legenda, elenco);
    return sezione;
  }

  // Sul sito: dopo che scheda.js ha costruito la pagina, aggiunge la sezione prima del riquadro dei salvataggi
  function avvia() {
    if (typeof document === "undefined" || typeof DATI === "undefined" || !document.getElementById("contenuto")) return;
    const dove = document.getElementById("zona-salvataggio");
    if (!dove || document.getElementById("omino")) return;
    const s = monta(window.DATI);
    if (!s) return;
    const involucro = document.createElement("div");
    involucro.className = "wrap";
    involucro.append(s);
    dove.before(involucro);
  }

  return { LIVELLI, conteggi, livelli, muscoliVisibili, figura, monta, avvia };
});
