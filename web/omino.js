/* Il riepilogo allenamento: mostra i muscoli lavorati in un allenamento (l'ultimo, o uno precedente) come una mappa che si illumina.
   Più esercizi allenano lo stesso muscolo, più quel muscolo è luminoso.
   Si usa nella pagina di benvenuto del cliente. Servono, già caricati: muscoli.js e omino-dati.js.
   Le funzioni «pure» (conteggi, livelli) sono esportate per i test; il resto disegna la pagina. */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica(require("./muscoli.js"), require("./omino-dati.js"));
  else radice.LenaOmino = fabbrica(radice.LenaMuscoli, radice.LenaOminoDati);
})(typeof self !== "undefined" ? self : this, function (Muscoli, DATI_FIGURE) {
  const LIVELLI = 5;
  const LARGHEZZA = 402;   // la figura più larga (in pixel dell'immagine)

  // Per ogni muscolo, quanti esercizi lo allenano. Contano gli esercizi dei blocchi (anche quelli dentro un circuito);
  // riscaldamento e stretching no.
  function contaBlocchi(blocchi) {
    const n = {};
    const conta = (nome) => { for (const m of Muscoli.muscoliDi(nome)) n[m] = (n[m] || 0) + 1; };
    for (const b of blocchi || []) {
      if (b.tipo === "circuito") for (const e of b.esercizi || []) conta(e.nome);
      else conta(b.nome);
    }
    return n;
  }
  function conteggi(giorni) {
    const blocchi = [];
    for (const g of giorni || []) blocchi.push(...(g.blocchi || []));
    return contaBlocchi(blocchi);
  }

  // Gli allenamenti fatti, dal più recente: un allenamento è un giorno della scheda in una settimana (es. «Giorno A, settimana 3»)
  // in cui è stato fatto almeno un esercizio (spunta, o almeno una serie). Le voci arrivano dal server con la data dell'ultimo
  // salvataggio. Il riscaldamento e lo stretching non contano come esercizi.
  function allenamenti(DATI, registrazioni) {
    const gruppi = new Map();
    for (const r of registrazioni || []) {
      const p = String(r.chiave || "").split("|");
      if (p.length < 3) continue;
      const k = p[0] + "|" + p[1];
      let g = gruppi.get(k);
      if (!g) gruppi.set(k, (g = { sett: Number(p[0]), giornoId: p[1], fatti: new Set(), data: 0 }));
      const t = Date.parse(r.aggiornata_il);
      if (t > g.data) g.data = t;
      const blocco = /^\d+$/.test(p[2]) ? Number(p[2]) : null;
      if (blocco && p.length === 3 && ((r.tipo === "fatto" && String(r.valore) !== "") || (r.tipo === "serie" && Number(r.valore) > 0))) g.fatti.add(blocco);
    }
    const out = [];
    for (const g of gruppi.values()) {
      const giorno = ((DATI && DATI.giorni) || []).find((x) => x.id === g.giornoId);
      if (!giorno || !g.fatti.size || !Number.isInteger(g.sett)) continue;
      const indici = [...g.fatti].filter((i) => i >= 1 && i <= giorno.blocchi.length).sort((a, b) => a - b);
      if (!indici.length) continue;
      out.push({ sett: g.sett, giorno, data: g.data, esercizi: indici.length, n: contaBlocchi(indici.map((i) => giorno.blocchi[i - 1])) });
    }
    return out.sort((a, b) => b.data - a.data);
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

  // ---------- il riepilogo allenamento (nella pagina di benvenuto) ----------
  const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const dataLunga = (t) => { const d = new Date(t); return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`; };
  const dataBreve = (t) => { const d = new Date(t); return `${d.getDate()} ${MESI[d.getMonth()].slice(0, 3)}`; };

  // Disegna il riepilogo dentro «host» e restituisce { aggiorna(DATI, registrazioni) }: aggiorna() torna false se non c'è
  // ancora nessun allenamento. Ricorda la scelta (uomo/donna, allenamento guardato) anche quando la pagina si aggiorna da sola.
  function riepilogo(host, doc) {
    const d = doc || document;
    const stato = { sesso: "m", scelto: 0, firma: null, lista: [] };
    try { if (localStorage.getItem("lena:omino") === "f") stato.sesso = "f"; } catch (e) { /* memoria bloccata */ }
    let contatore = 0, DATI = null;

    const el = (tag, classe, testo) => { const e = d.createElement(tag); if (classe) e.className = classe; if (testo != null) e.textContent = testo; return e; };
    const testa = el("div", "omino-testa");
    const titolo = el("p", "omino-titolo"), dettaglio = el("p", "nota omino-dettaglio");
    testa.append(titolo, dettaglio);
    const tendina = el("div", "omino-tendina");
    const etichetta = el("label", "", "Vedi un altro allenamento");
    etichetta.setAttribute("for", "omino-scelta-allenamento");
    const select = el("select", "scelta"); select.id = "omino-scelta-allenamento";
    tendina.append(etichetta, select);
    const barraSesso = el("div", "omino-scelta");
    barraSesso.setAttribute("role", "group"); barraSesso.setAttribute("aria-label", "Figura");
    const quadro = el("div", "omino-quadro");
    const legenda = el("div", "omino-legenda"); legenda.setAttribute("aria-hidden", "true");
    const barra = el("i");
    legenda.append(el("span", "", "Meno"), barra, el("span", "", "Più"));
    const nota = el("p", "nota", "Più esercizi lavorano lo stesso muscolo, più si illumina.");
    const elenco = el("details", "omino-elenco");
    host.replaceChildren(testa, tendina, barraSesso, quadro, legenda, nota, elenco);

    const bottone = (testo, premuto, fa) => {
      const b = el("button", "bottone secondario piccolo", testo);
      b.type = "button"; b.setAttribute("aria-pressed", String(premuto)); b.addEventListener("click", fa);
      return b;
    };
    const scegliSesso = (s) => { stato.sesso = s; try { localStorage.setItem("lena:omino", s); } catch (e) { /* memoria bloccata */ } disegna(); };

    select.addEventListener("change", () => { stato.scelto = Number(select.value) || 0; disegna(); });

    function disegna() {
      const a = stato.lista[stato.scelto];
      titolo.textContent = `${a.giorno.titolo}${a.giorno.focus ? " · " + a.giorno.focus : ""}`;
      dettaglio.textContent = `${stato.scelto === 0 ? "Ultimo allenamento" : "Allenamento"} · settimana ${a.sett} · ${dataLunga(a.data)} · ${a.esercizi} ${a.esercizi === 1 ? "esercizio" : "esercizi"}`;
      tendina.hidden = stato.lista.length < 2;
      select.replaceChildren(...stato.lista.map((x, i) => {
        const o = el("option", "", `${i === 0 ? "Ultimo: " : ""}${x.giorno.titolo} · sett. ${x.sett} · ${dataBreve(x.data)}`);
        o.value = String(i); return o;
      }));
      select.value = String(stato.scelto);
      barraSesso.replaceChildren(bottone("Uomo", stato.sesso === "m", () => scegliSesso("m")), bottone("Donna", stato.sesso === "f", () => scegliSesso("f")));
      const lv = livelli(a.n, false);
      contatore++;
      quadro.replaceChildren(figura(stato.sesso, "davanti", lv, `o${contatore}a`), figura(stato.sesso, "dietro", lv, `o${contatore}b`));
      const voci = Object.keys(a.n).sort((x, y) => a.n[y] - a.n[x] || x.localeCompare(y));
      const sum = el("summary", "", voci.length ? "Quali muscoli, in ordine" : "Nessun muscolo da mostrare");
      elenco.replaceChildren(sum);
      if (voci.length) {
        const ul = el("ul");
        for (const m of voci) ul.append(el("li", "", `${(Muscoli.MUSCOLI.find((x) => x.id === m) || { nome: m }).nome}: ${a.n[m]} ${a.n[m] === 1 ? "esercizio" : "esercizi"}`));
        elenco.append(ul);
      } else elenco.append(el("p", "nota", "In questo allenamento non ci sono esercizi che lavorano un muscolo in particolare, come cardio o stretching."));
    }

    return {
      aggiorna(dati, registrazioni) {
        DATI = dati;
        const lista = allenamenti(dati, registrazioni);
        // si ridisegna solo se qualcosa è cambiato: così la pagina che si aggiorna da sola non azzera la scelta
        const firma = lista.map((x) => `${x.sett}${x.giorno.id}:${x.data}:${x.esercizi}`).join(",");
        if (firma !== stato.firma) {
          const prima = stato.lista[stato.scelto];
          stato.lista = lista;
          stato.firma = firma;
          const rimasto = prima ? lista.findIndex((x) => x.sett === prima.sett && x.giorno.id === prima.giorno.id) : -1;
          stato.scelto = rimasto >= 0 ? rimasto : 0;
          if (lista.length) disegna();
        }
        return stato.lista.length > 0;
      },
    };
  }

  return { LIVELLI, conteggi, allenamenti, livelli, muscoliVisibili, figura, riepilogo };
});
