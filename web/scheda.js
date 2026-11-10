/* La scheda di allenamento: l'UNICA fonte della sua logica.
   La usano due pagine:
     - web/scheda.html (la scheda del cliente, letta dal server), tramite web/scheda-server.js;
     - la scheda scaricabile del convertitore, che incorpora questo file dentro un unico .html.
   Prima di caricarlo servono due variabili globali:
     DATI           l'oggetto della scheda (quello prodotto dal convertitore)
     IN_ANTEPRIMA   true solo dentro l'anteprima del convertitore
   e, solo per la scheda del sito, una terza: LENA_ARCHIVIO (dove salvare kg e spunte).
   Il file non deve mai contenere la sequenza che chiude un tag script, o la scheda scaricata si rompe. */
(function () {

// ---------- struttura della pagina (generata qui: così non esiste in due copie) ----------
const SCHELETRO = `
<div class="wrap">
  <header>
    <div class="sopra"><span>Scheda di allenamento</span><span class="stato-salv"></span></div>
    <h1 id="titolo"></h1>
    <div class="chi" id="chi"></div>
    <div class="settimana-oggi" id="oggi"></div>
  </header>
</div>
<div class="barra"><div class="wrap">
  <div class="giorni" id="giorni" role="group" aria-label="Giorno di allenamento"></div>
  <div class="sett" id="sett" role="group" aria-label="Settimana"></div>
</div></div>
<main class="wrap" id="contenuto"></main>
<div class="wrap" id="zona-salvataggio"></div>
<div class="wrap"><footer id="piede"></footer></div>

<div class="focus" id="focus" role="dialog" aria-modal="true" aria-label="Modalità allenamento">
  <div class="focus-testa">
    <div class="dove" id="f-dove"></div>
    <span class="stato-salv" aria-hidden="true"></span>
    <button type="button" class="btn piccolo" id="f-esci">Chiudi</button>
  </div>
  <div class="focus-passi" id="f-passi"></div>
  <div class="focus-corpo" id="f-corpo"></div>
  <div class="schermo" id="f-schermo"></div>
  <div class="focus-piede">
    <button type="button" id="f-indietro">‹ Indietro</button>
    <button type="button" class="avanti" id="f-avanti">Avanti ›</button>
  </div>
</div>

<div class="timer" id="timer" aria-live="polite">
  <div class="info"><div class="cosa" id="t-cosa"></div><div class="tempo" id="t-tempo">0:00</div><div class="barra-t"><i id="t-barra"></i></div></div>
  <span class="luci" aria-hidden="true"><i></i><i></i><i></i></span>
  <button type="button" id="t-piu">+15"</button>
  <button type="button" id="t-stop">Chiudi</button>
</div>
<input type="file" id="file-ripristino" accept="application/json,.json" hidden>
`;
if (!document.getElementById("contenuto")) document.body.insertAdjacentHTML("afterbegin", SCHELETRO);

const SVG = {
  play:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>',
  clock:'<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 5.5v3.2l2 1.3M6.5 1.5h3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  check:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  undo:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 4L2 7l3 3M2.5 7H10a3.5 3.5 0 010 7H7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // i «gradi» del logo, per l'allenamento completato (colori dal mood)
  gradi:'<svg class="gradi" viewBox="0 0 48 48" aria-hidden="true"><path class="basso" d="M6 42 L24 30 L42 42" fill="none" stroke-width="6"/><path class="basso" d="M6 30 L24 18 L42 30" fill="none" stroke-width="6"/><path class="alto" d="M6 18 L24 6 L42 18" fill="none" stroke-width="6"/></svg>',
  // un fiore classico (centro tondo e petali attaccati), per l'allenamento completato di Botanico (colori dal mood)
  fiore:'<svg class="fiore" viewBox="0 0 100 100" aria-hidden="true"><ellipse class="petalo" cx="50" cy="24" rx="11" ry="18" transform="rotate(0 50 50)"/><ellipse class="petalo" cx="50" cy="24" rx="11" ry="18" transform="rotate(45 50 50)"/><ellipse class="petalo" cx="50" cy="24" rx="11" ry="18" transform="rotate(90 50 50)"/><ellipse class="petalo" cx="50" cy="24" rx="11" ry="18" transform="rotate(135 50 50)"/><ellipse class="petalo" cx="50" cy="24" rx="11" ry="18" transform="rotate(180 50 50)"/><ellipse class="petalo" cx="50" cy="24" rx="11" ry="18" transform="rotate(225 50 50)"/><ellipse class="petalo" cx="50" cy="24" rx="11" ry="18" transform="rotate(270 50 50)"/><ellipse class="petalo" cx="50" cy="24" rx="11" ry="18" transform="rotate(315 50 50)"/><circle class="centro" cx="50" cy="50" r="13"/></svg>',
  // il cerchio zen (ensō) dipinto con una pennellata, per l'allenamento completato del Dojo (colore dal mood)
  enso:'<svg class="enso" viewBox="0 0 150 150" aria-hidden="true"><path d="M118 40 C100 14 54 12 32 40 C10 68 22 112 60 124 C96 136 132 110 128 72 C126 56 118 46 108 42"/></svg>'
};
// Il mood (l'estetica della scheda) lo sceglie chi carica questo file, con data-mood su <html> (vedi web/mood/).
// Senza mood (la scheda scaricabile) la scheda resta com'era: colori dei giorni presi dai dati, niente extra.
const MOOD = document.documentElement.getAttribute("data-mood");
const MESI = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
const inizio = new Date(DATI.inizio + "T00:00:00");
function giornoSett(n){ const d = new Date(inizio); d.setDate(d.getDate() + 7*(n-1)); return d; }
function fmt(d){ return d.getDate() + " " + MESI[d.getMonth()]; }
function settimanaDiOggi(){ const o = new Date(); o.setHours(0,0,0,0); return Math.floor((o - inizio) / 864e5 / 7) + 1; }

// ---------- salvataggio ----------
// Due modi di lavorare, scelti da chi carica questo file:
//  - scheda scaricata (file singolo): kg e spunte restano nel localStorage di questo telefono;
//  - scheda del sito: la pagina definisce LENA_ARCHIVIO (vedi scheda-server.js) e i dati vanno nel database.
// Nell'anteprima del convertitore non si salva niente.
const ARCHIVIO = typeof LENA_ARCHIVIO !== "undefined" ? LENA_ARCHIVIO : null;
// Modalità "sola lettura" (la vista dei progressi per il PT): si vede tutto ma non si può cambiare niente
const LETTURA = typeof SOLA_LETTURA !== "undefined" && SOLA_LETTURA === true;
if (LETTURA) document.body.classList.add("sola-lettura");
function bloccaModifiche(){
  for (const i of document.querySelectorAll("#contenuto input, #f-corpo input")) i.readOnly = true;
  for (const b of document.querySelectorAll("#contenuto button, #f-corpo button")) b.disabled = true;
}
const CHIAVE = `scheda-${DATI.info.nome}-${DATI.info.cognome}-${DATI.inizio}`;
let mem = { kg:{}, rip:{}, fatti:{}, serie:{}, dal:null, ultimo:null };
let salvaOk = true;
if (ARCHIVIO) {
  mem = Object.assign(mem, ARCHIVIO.carica());
} else if (!IN_ANTEPRIMA) {
  try {
    const t = localStorage.getItem(CHIAVE);
    if (t) mem = Object.assign(mem, JSON.parse(t));
  } catch(e){ salvaOk = false; }
}
if (!mem.dal) mem.dal = new Date().toISOString();
function salva(){
  mem.ultimo = new Date().toISOString();
  if (ARCHIVIO) ARCHIVIO.cambiato(mem);
  else if (!IN_ANTEPRIMA) {
    try { localStorage.setItem(CHIAVE, JSON.stringify(mem)); salvaOk = true; } catch(e){ salvaOk = false; }
  }
  zonaSalvataggio();
}

const nOggi = settimanaDiOggi();
const stato = { giorno: 0, settimana: Math.min(Math.max(nOggi,1), DATI.settimane), passo: 0 };
const chiave = (...p) => p.join("|");          // es. "3|A|2|0" = settimana 3, giorno A, blocco 2, esercizio 0
const fatto = k => !!mem.fatti[chiave(stato.settimana, k)];

// Un colore dei dati entra in un attributo di stile: deve essere esattamente 6 cifre esadecimali, altrimenti grigio
const esa = c => /^[0-9A-Fa-f]{6}$/.test(String(c)) ? String(c) : "888888";
function el(tag, attrs = {}, ...figli){
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)){
    if (v == null) continue;
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;   // solo icone SVG fisse
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "value") e.value = v;
    // un indirizzo viene accettato solo se è web (http/https) o un file creato dal browser (blob): niente "javascript:" o "data:"
    else if (k === "href") { if (/^(https?:|blob:)/i.test(String(v))) e.setAttribute("href", v); }
    else e.setAttribute(k, v);
  }
  for (const f of figli.flat()) if (f != null) e.append(f.nodeType ? f : document.createTextNode(String(f)));
  return e;
}

function testata(){
  document.getElementById("titolo").textContent = DATI.info.titolo;
  document.getElementById("chi").textContent = `${DATI.info.nome} ${DATI.info.cognome} · ${DATI.info.obiettivo} · ${DATI.info.sedute} sedute a settimana`;
  const o = document.getElementById("oggi");
  const fine = giornoSett(DATI.settimane); fine.setDate(fine.getDate()+6);
  if (nOggi < 1) o.append(el("span",{}, "La scheda inizia il "), el("strong",{}, fmt(inizio)));
  else if (nOggi > DATI.settimane) o.append(el("span",{}, "Scheda conclusa il "), el("strong",{}, fmt(fine)));
  else {
    const a = giornoSett(nOggi), b = new Date(a); b.setDate(b.getDate()+6);
    o.append(el("span",{}, "Oggi sei nella"), el("strong",{}, nOggi < DATI.settimane ? `${nOggi}ª settimana` : "settimana di scarico"),
             el("span",{style:"color:var(--colore-testo-tenue)"}, `${fmt(a)} – ${fmt(b)}`));
  }
  document.getElementById("piede").textContent = `${DATI.info.nota_durata} · dal ${fmt(inizio)} al ${fmt(fine)} ${fine.getFullYear()}`;
}

// Un giorno è «fatto» in una settimana quando ogni suo blocco ha la spunta (riscaldamento e stretching non contano); una settimana quando lo sono tutti i giorni
const giornoFatto = (g, n) => g.blocchi.length > 0 && g.blocchi.every((b,i) => mem.fatti[chiave(n, `${g.id}|${i+1}`)]);
const settimanaFatta = n => DATI.giorni.every(g => giornoFatto(g, n));
const segnoFatto = () => [el("span",{class:"fatto-segno","aria-hidden":"true"}, " ✓"), el("span",{class:"solo-lettori"}, ", fatto")];

function barra(){
  const g = document.getElementById("giorni"); g.replaceChildren();
  DATI.giorni.forEach((d,i) => g.append(el("button",{type:"button", class:"giorno-btn", "data-giorno": String(i+1), "aria-pressed": String(i===stato.giorno),
    style:`--bc:#${esa(d.colore)}`, onclick:()=>{ stato.giorno=i; disegna(); window.scrollTo({top:0}); }},
    el("b",{}, d.titolo, giornoFatto(d, stato.settimana) ? segnoFatto() : null), el("span",{}, d.focus))));
  const s = document.getElementById("sett"); s.replaceChildren();
  for (let n=1; n<=DATI.settimane; n++){
    s.append(el("button",{type:"button", class: n===nOggi ? "oggi" : null, "aria-pressed": String(n===stato.settimana),
      title: fmt(giornoSett(n)), onclick:()=>{ stato.settimana=n; disegna(); }},
      n < DATI.settimane ? `Sett. ${n}` : "Scarico", settimanaFatta(n) ? segnoFatto() : null));
  }
  // Centra la settimana attiva scorrendo SOLO la barra delle settimane. (Non scrollIntoView: dentro una cornice
  // farebbe scorrere anche la pagina che la contiene, per esempio quella del PT.)
  const attivo = s.querySelector('[aria-pressed="true"]');
  if (attivo) s.scrollLeft = attivo.offsetLeft - (s.clientWidth - attivo.offsetWidth) / 2;
}

let appenaSpuntato = null;   // la spunta appena messa: solo lei fa l'animazione (il mood decide quale)
function spunta(k, classe){
  const ck = chiave(stato.settimana, k);
  const scatta = MOOD && appenaSpuntato === ck && fatto(k);
  return el("button",{type:"button", class: classe + (scatta ? " scatta" : ""), "aria-pressed": String(fatto(k)), "aria-label":"Segna come fatto",
    html:SVG.check, onclick:()=>{ const c = chiave(stato.settimana, k);
      if (mem.fatti[c]) delete mem.fatti[c]; else { mem.fatti[c] = 1; appenaSpuntato = c; } salva(); disegna(); }});
}

function secondi(t){ const m = t.match(/(\d+)'/), s = t.match(/(\d+)"/); return (m ? +m[1]*60 : 0) + (s ? +s[1] : 0); }
function video(url, testo="Video"){ return el("a",{class:"btn", href:url, target:"_blank", rel:"noopener", html:SVG.play}, ` ${testo}`); }

// ---------- kg e ripetizioni ----------
function ultimoValore(tipo, k){
  for (let n = stato.settimana - 1; n >= 1; n--){ const v = mem[tipo][chiave(n, k)]; if (v) return {n, v}; }
  return null;
}
function rip10(v, serie){
  const t = String(v || "").toUpperCase().replace(/\s/g,"");
  if (t === `${serie}X10`) return true;
  const p = t.split(/[-\/,.]+/).filter(Boolean);
  return p.length === serie && p.every(x => x === "10");
}
function campo(tipo, k, etichetta, segnaposto, serie){
  const c = chiave(stato.settimana, k);
  const wrap = el("label",{class:"campo"});
  const inp = el("input",{type:"text", inputmode: tipo==="kg" ? "decimal" : "text", autocomplete:"off", maxlength:"40", placeholder:segnaposto,
    value: mem[tipo][c] || "", "aria-label": etichetta});
  const verde = () => wrap.classList.toggle("ok", tipo==="rip" && rip10(inp.value, serie));
  inp.addEventListener("input", () => { const v = inp.value.trim(); if (v) mem[tipo][c] = v; else delete mem[tipo][c]; verde(); salva(); });
  verde();
  const prima = ultimoValore(tipo, k);
  wrap.append(el("small",{}, etichetta), inp);
  if (prima) wrap.append(el("span",{class:"prima"}, `Sett. ${prima.n}: ${prima.v}`));
  return wrap;
}

// ---------- serie fatte + recupero ----------
// Serie e ripetizioni DELLA SETTIMANA che si sta guardando. Se l'esercizio ha lo schema («4x10» per ogni settimana di lavoro) valgono
// quelle dello schema; altrimenti (nessuno schema, schema non leggibile, settimana di scarico) i valori base dell'esercizio.
function valoriSettimana(e, n){
  const m = e.schema && n >= 1 && n <= e.schema.length ? /^(\d{1,3})\s*[x×]\s*(\d{1,3})$/i.exec(String(e.schema[n-1]).trim()) : null;
  return m ? { serie: m[1], rip: m[2], daSchema: true } : { serie: e.serie, rip: e.rip, daSchema: false };
}

function rigaSerie(k, e, serie){
  const tot = /^\d{1,2}$/.test(String(serie).trim()) ? parseInt(serie, 10) : 0; if (!tot) return null;   // pallini solo se la serie è un numero (1-99)
  const c = chiave(stato.settimana, k), fatte = mem.serie[c] || 0;
  const pallini = el("span",{class:"puntini", "aria-label":`${fatte} serie su ${tot}`},
    Array.from({length:tot}, (_,i) => el("i",{class: i < fatte ? "on" : null})));
  const recs = (e.rec && e.rec !== "/") ? e.rec.split("/").map(x => x.trim()).filter(x => secondi(x) > 0) : [];
  const dopo = rec => {
    const n = Math.min(tot, (mem.serie[c] || 0) + 1); mem.serie[c] = n;
    if (n === tot) mem.fatti[c] = 1;
    salva(); disegna();
    if (rec) avviaTimer(secondi(rec), `${e.nome} · serie ${n}/${tot} · recupero ${rec}`);
    // il timer copre il fondo della pagina: la riga delle serie si porta sopra di lui, così il pulsante della serie dopo resta toccabile
    requestAnimationFrame(() => { const r = [...document.querySelectorAll("[data-serie]")].find((x) => x.getAttribute("data-serie") === c); if (r) r.scrollIntoView({ block: "nearest" }); });
  };
  const riga = el("div",{class:"serie-riga", "data-serie": c}, pallini);
  if (fatte < tot){
    if (recs.length === 0) riga.append(el("button",{type:"button", class:"btn pieno", onclick:()=>dopo(null)}, `Serie ${fatte+1} fatta`));
    recs.forEach(rec => riga.append(el("button",{type:"button", class:"btn pieno", html:SVG.clock, onclick:()=>dopo(rec)},
      ` Serie ${fatte+1} fatta · ${rec}`)));
  } else {
    riga.append(el("span",{style:"font-size:14px;color:var(--c-scuro)"}, "Tutte le serie fatte"));
    recs.forEach(rec => riga.append(el("button",{type:"button", class:"btn piccolo", html:SVG.clock,
      onclick:()=>avviaTimer(secondi(rec), `Recupero · ${e.nome}`)}, ` ${rec}`)));
  }
  if (fatte > 0) riga.append(el("button",{type:"button", class:"btn piccolo", html:SVG.undo, "aria-label":"Togli una serie",
    onclick:()=>{ mem.serie[c] = fatte - 1; delete mem.fatti[c]; if (!mem.serie[c]) delete mem.serie[c]; salva(); disegna(); }}));
  return riga;
}

// ---------- schede ----------
function cardRiscaldamento(g){
  const R = DATI.riscaldamento;
  const sez = [el("h3",{class:"sezione"}, "Riscaldamento", el("span",{}, `${R.voce} · ${R.durata}`))];
  const lista = el("ul",{class:"lista"});
  R.esercizi.forEach(([nome,url],i) => lista.append(el("li",{onclick:(ev)=>{ if (!ev.target.closest("a, button")) ev.currentTarget.querySelector("button.pallino").click(); }}, spunta(`${g.id}|R|${i}`,"pallino"), el("span",{class:"t"}, nome),
      url ? el("a",{class:"mini", href:url, target:"_blank", rel:"noopener"}, "Video") : null)));
  sez.push(el("section",{class:"card risc"},
    el("p",{class:"istr"}, R.istruzione), lista,
    el("div",{class:"azioni"},
      el("button",{type:"button", class:"btn pieno", html:SVG.clock, onclick:()=>avviaTimer(30,"Riscaldamento · 30\"")}, " 30\""),
      el("button",{type:"button", class:"btn", html:SVG.clock, onclick:()=>avviaTimer(10,"Recupero · 10\"")}, " 10\""))));
  return sez;
}

function cardEsercizio(g, i, e){
  const k = `${g.id}|${i}`, n = stato.settimana;
  const card = el("section",{class:"card" + (fatto(k) ? " fatto" : "")});
  card.append(el("div",{class:"testa"}, el("span",{class:"num"}, i), el("h4",{class:"nome"}, e.nome), spunta(k,"spunta")));
  const v = valoriSettimana(e, n);
  // Settimana di scarico (l'ultima, oltre lo schema): i numeri base non valgono, quindi non si mostrano in grande: resta il riquadro «Scarico»
  const scar = !!e.schema && !v.daSchema && n === DATI.settimane && n > e.schema.length;
  card.append(scar
    ? el("div",{class:"dati", style:"grid-template-columns:1fr"}, el("div",{class:"dato"}, el("small",{}, "Recupero"), el("b",{}, e.rec)))
    : el("div",{class:"dati"},
        el("div",{class:"dato"}, el("small",{}, "Serie"), el("b",{}, v.serie)),
        el("div",{class:"dato"}, el("small",{}, "Ripetizioni"), el("b",{}, v.rip)),
        el("div",{class:"dato"}, el("small",{}, "Recupero"), el("b",{}, e.rec))));
  if (scar) {
    card.append(el("div",{class:"questa scarico"}, el("small",{}, "Settimana di scarico"), el("b",{}, "Scarico")));
  } else if (e.schema && !v.daSchema && e.schema[n-1]) {   // schema scritto in un modo che non si legge come serie × ripetizioni: si mostra com'è
    card.append(el("div",{class:"questa"}, el("small",{}, `Schema · settimana ${n}`), el("b",{}, e.schema[n-1])));
  }
  const campi = el("div",{class:"campi"}, campo("kg", k, `Kg · sett. ${n}`, "—"));
  if (e.progressione) campi.append(campo("rip", k, "Rip. fatte", "es. 10-10-9-8", parseInt(v.serie,10)));
  card.append(campi);
  // Settimana di scarico: le serie base non valgono, quindi niente pallini; si chiude l'esercizio con la spunta in alto
  const rs = scar ? null : rigaSerie(k, e, v.serie); if (rs) card.append(rs);
  if (e.note) card.append(el("p",{class:"nota"}, e.note));
  if (e.progressione) card.append(el("details",{class:"prog", open: n===1 ? "" : null}, el("summary",{}, "Progressione"), el("p",{}, e.progressione)));
  if (e.schema){
    const tab = el("table",{class:"tutte"});
    e.schema.forEach((s,j) => tab.append(el("tr",{class: j+1===n ? "sel" : null}, el("td",{}, `Sett. ${j+1} · ${fmt(giornoSett(j+1))}`), el("td",{}, s))));
    tab.append(el("tr",{class: n===DATI.settimane ? "sel" : null}, el("td",{}, `Scarico · ${fmt(giornoSett(DATI.settimane))}`), el("td",{}, "Scarico")));
    card.append(el("details",{class:"prog"}, el("summary",{}, "Tutte le settimane"), tab));
  }
  if (e.video) card.append(el("div",{class:"azioni"}, video(e.video)));
  return card;
}

function cardCircuito(g, i, c){
  const k = `${g.id}|${i}`;
  const card = el("section",{class:"card circ" + (fatto(k) ? " fatto" : "")});
  card.append(el("div",{class:"testa"}, el("span",{class:"num"}, i), el("h4",{class:"formato nome"}, c.formato), spunta(k,"spunta")));
  if (c.rec && c.rec !== "/") card.append(el("div",{class:"dati", style:"grid-template-columns:1fr"}, el("div",{class:"dato"}, el("small",{}, "Recupero"), el("b",{}, c.rec))));
  const lista = el("ul",{class:"lista"});
  c.esercizi.forEach((e,j) => {
    const kk = `${k}|${j}`, cc = chiave(stato.settimana, kk);
    const inp = el("input",{type:"text", inputmode:"decimal", maxlength:"40", placeholder:"kg", value: mem.kg[cc] || "", "aria-label":`Kg ${e.nome}`});
    inp.addEventListener("input", () => { const v = inp.value.trim(); if (v) mem.kg[cc] = v; else delete mem.kg[cc]; salva(); });
    lista.append(el("li",{},
      el("span",{class:"t"}, e.nome, el("br"), el("span",{class:"rip", style:"font-size:14px"}, e.rip)),
      e.video ? el("a",{class:"mini", href:e.video, target:"_blank", rel:"noopener"}, "Video") : null, inp));
  });
  card.append(lista);
  const min = parseInt(c.formato.match(/(\d+)'/)[1], 10);
  const emom = c.formato.startsWith("EMOM");
  card.append(el("div",{class:"azioni"}, el("button",{type:"button", class:"btn pieno", html:SVG.clock,
    onclick:()=>avviaTimer(min*60, c.formato, emom)}, ` Timer ${c.formato}`)));
  return card;
}

function cardStretching(g){
  if (!g.stretching) return [];   // se l'Excel non ha lo stretching di questo giorno, non lo inventiamo
  const k = `${g.id}|S`;
  return [el("h3",{class:"sezione"}, g.stretching[0], el("span",{}, g.stretching[1])),
    el("section",{class:"card stretch" + (fatto(k) ? " fatto" : "")}, el("b",{class:"nome"}, "Fine allenamento"), spunta(k,"spunta"))];
}

// ---------- avanzamento e allenamento completato (solo con un mood) ----------
// Un allenamento è completato quando ogni blocco del giorno ha la spunta (riscaldamento e stretching non contano).
function contaFatti(g){ return g.blocchi.filter((b,i) => fatto(`${g.id}|${i+1}`)).length; }
const completo = g => g.blocchi.length > 0 && contaFatti(g) === g.blocchi.length;
let ultimoGiorno = null;
const statoFine = { dove: null, era: null, anima: false };   // per animare il completamento solo nel momento in cui avviene
function bannerCompletato(){
  return el("div",{class:"completato" + (statoFine.anima ? " appena" : ""), role:"status"},
    el("span",{html:SVG.gradi + SVG.fiore + SVG.enso}), el("p",{}, "Allenamento completato."));   // ogni mood mostra il suo disegno
}

// ---------- pagina ----------
function passi(g){
  return [() => cardRiscaldamento(g),
    ...g.blocchi.map((b,i) => () => [el("h3",{class:"sezione"}, i === 0 ? "Allenamento" : `Blocco ${i+1} di ${g.blocchi.length}`,
      el("span",{}, `${i+1}/${g.blocchi.length}`)), b.tipo === "esercizio" ? cardEsercizio(g, i+1, b) : cardCircuito(g, i+1, b)]),
    ...(g.stretching ? [() => cardStretching(g)] : [])];
}

function disegna(){
  const g = DATI.giorni[stato.giorno];
  if (MOOD) {
    // con un mood il colore del giorno dipende solo dalla posizione (1 = Giorno A … 7): lo decide il CSS del mood
    document.documentElement.setAttribute("data-giorno", String(stato.giorno + 1));
  } else {
    const r = document.documentElement.style;
    r.setProperty("--c", "#"+esa(g.colore)); r.setProperty("--c-chiaro", "#"+esa(g.chiaro)); r.setProperty("--c-scuro", "#"+esa(g.scuro));
  }
  const cambioGiorno = ultimoGiorno !== null && ultimoGiorno !== stato.giorno; ultimoGiorno = stato.giorno;
  if (MOOD && cambioGiorno) {   // gancio per l'animazione del cambio di giorno del mood (classe «cambia» su <html>, riavviata ogni volta)
    const h = document.documentElement; h.classList.remove("cambia"); void h.offsetWidth; h.classList.add("cambia");
  }
  const dove = `${stato.settimana}|${stato.giorno}`, ora = completo(g);
  statoFine.anima = !!MOOD && ora && statoFine.dove === dove && statoFine.era === false;
  statoFine.dove = dove; statoFine.era = ora;
  barra();
  const m = document.getElementById("contenuto"); m.replaceChildren();
  const n = stato.settimana;
  m.append(el("div",{class:"titolo-giorno" + (MOOD && cambioGiorno ? " entra" : "")}, el("h2",{}, g.titolo), el("small",{}, g.focus)));
  if (MOOD) {
    const fatti = contaFatti(g), tot = g.blocchi.length;
    m.append(el("div",{class:"avanzamento", role:"progressbar", "aria-label":"Esercizi fatti oggi",
      "aria-valuemin":"0", "aria-valuemax":String(tot), "aria-valuenow":String(fatti), "aria-valuetext":`${fatti} su ${tot}`},
      el("i",{style:`width:${tot ? Math.round(100*fatti/tot) : 0}%`}),
      // le tappe: una per blocco, «on» se fatto (il mood sceglie se mostrare la barra continua o le tappe, es. le perle di Velluto)
      el("span",{class:"tappe"}, g.blocchi.map((b,i) => {
        const k = `${g.id}|${i+1}`;   // «nuovo» = la tappa appena spuntata (per l'animazione del mood)
        return el("b",{class: fatto(k) ? "on" + (appenaSpuntato === chiave(stato.settimana, k) ? " nuovo" : "") : null});
      }))));
  }
  m.append(el("div",{style:"font-size:13px;color:var(--colore-testo-tenue)"},
    n < DATI.settimane ? `Stai guardando la settimana ${n} · dal ${fmt(giornoSett(n))}` : `Stai guardando la settimana di scarico · dal ${fmt(giornoSett(n))}`));
  m.append(el("button",{type:"button", class:"btn pieno inizia", html:SVG.play, onclick: apriAllenamento}, " Inizia allenamento"));
  m.append(...cardRiscaldamento(g));
  m.append(el("h3",{class:"sezione"}, "Allenamento", el("span",{}, `${g.blocchi.length} blocchi`)));
  g.blocchi.forEach((b,i) => m.append(b.tipo === "esercizio" ? cardEsercizio(g, i+1, b) : cardCircuito(g, i+1, b)));
  if (MOOD && ora) m.append(bannerCompletato());
  m.append(...cardStretching(g));
  if (LETTURA) bloccaModifiche();
  if (document.body.classList.contains("in-allenamento")) disegnaFocus();
  appenaSpuntato = null; statoFine.anima = false;   // le animazioni valgono per un solo disegno
}

function zonaSalvataggio(){
  const z = document.getElementById("zona-salvataggio");
  if (ARCHIVIO) {   // scheda del sito: il riquadro lo disegna la pagina (Esci, stato del salvataggio), una volta sola
    if (!z.firstChild && ARCHIVIO.riquadro) z.append(ARCHIVIO.riquadro(el));
    return;
  }
  z.replaceChildren();
  if (IN_ANTEPRIMA) return;   // nell'anteprima non serve il riquadro dei salvataggi
  const ora = mem.ultimo ? new Date(mem.ultimo) : null;
  const box = el("div",{class:"salvataggio"},
    el("div",{}, el("b",{}, "I tuoi kg restano su questo telefono"), ora ? ` · ultimo salvataggio ${fmt(ora)} alle ${ora.toTimeString().slice(0,5)}` : ""),
    el("div",{style:"margin-top:4px"}, "Ogni tanto scarica un backup e riporta i kg anche nell'Excel: se cancelli i dati del browser, qui si perdono."));
  if (!salvaOk) box.append(el("div",{class:"avviso"}, "Aperto così, il salvataggio non funziona. Prova ad aprire il file con un altro browser (es. Firefox)."));
  box.append(el("div",{class:"azioni"},
    el("button",{type:"button", class:"btn piccolo", onclick: scaricaBackup}, "Scarica backup"),
    el("button",{type:"button", class:"btn piccolo", onclick:()=>document.getElementById("file-ripristino").click()}, "Ripristina backup")));
  z.append(box);
}
function scaricaBackup(){
  const blob = new Blob([JSON.stringify(mem, null, 1)], {type:"application/json"});
  const a = el("a",{href: URL.createObjectURL(blob), download:`scheda-allenamento-backup-${new Date().toISOString().slice(0,10)}.json`});
  document.body.append(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
document.getElementById("file-ripristino").addEventListener("change", async ev => {
  const f = ev.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d || typeof d.kg !== "object") throw new Error("formato");
    mem = Object.assign({ kg:{}, rip:{}, fatti:{}, serie:{} }, d); salva(); disegna();
  } catch(e){
    const z = document.querySelector(".salvataggio");
    z.append(el("div",{class:"avviso"}, "Questo file non è un backup della scheda."));
  }
  ev.target.value = "";
});

// ---------- modalità allenamento ----------
let wake = null;
async function tieniAcceso(){
  const nota = document.getElementById("f-schermo");
  try {
    if (!("wakeLock" in navigator)) throw new Error("no");
    wake = await navigator.wakeLock.request("screen"); nota.textContent = "";
  } catch(e){ nota.textContent = "Lo schermo potrebbe spegnersi: se succede, alza il tempo di spegnimento nelle impostazioni del telefono."; }
}
function apriAllenamento(){
  stato.passo = 0; document.body.classList.add("in-allenamento"); disegnaFocus(); tieniAcceso();
}
function chiudiAllenamento(){
  document.body.classList.remove("in-allenamento");
  try { wake && wake.release(); } catch(e){} wake = null;
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && document.body.classList.contains("in-allenamento")) tieniAcceso();
});
function disegnaFocus(){
  const g = DATI.giorni[stato.giorno], p = passi(g), n = stato.settimana;
  stato.passo = Math.max(0, Math.min(stato.passo, p.length - 1));
  const corpo = document.getElementById("f-corpo"), su = corpo.scrollTop, stesso = corpo.dataset.passo === String(stato.passo);
  document.getElementById("f-dove").replaceChildren(el("b",{}, `${g.titolo} · ${g.focus}`),
    n < DATI.settimane ? `Settimana ${n} · dal ${fmt(giornoSett(n))}` : "Settimana di scarico");
  document.getElementById("f-passi").replaceChildren(...p.map((_,i) => el("i",{class: i < stato.passo ? "fatto" : i === stato.passo ? "ora" : null})));
  corpo.replaceChildren(...[p[stato.passo]()].flat());
  if (MOOD && completo(g) && stato.passo >= g.blocchi.length) corpo.append(bannerCompletato());   // dopo l'ultimo blocco
  corpo.dataset.passo = stato.passo; corpo.scrollTop = stesso ? su : 0;
  document.getElementById("f-indietro").disabled = stato.passo === 0;
  document.getElementById("f-avanti").textContent = stato.passo === p.length - 1 ? "Fine ✓" : "Avanti ›";
}
function muovi(d){
  const p = passi(DATI.giorni[stato.giorno]);
  if (d > 0 && stato.passo === p.length - 1){ chiudiAllenamento(); return; }
  stato.passo += d; disegnaFocus();
}
document.getElementById("f-avanti").onclick = () => muovi(1);
document.getElementById("f-indietro").onclick = () => muovi(-1);
document.getElementById("f-esci").onclick = chiudiAllenamento;
(() => { // scorrimento laterale per cambiare esercizio
  const c = document.getElementById("f-corpo"); let x0 = null, y0 = null;
  c.addEventListener("touchstart", e => { if (e.target.closest("input")) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, {passive:true});
  c.addEventListener("touchend", e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) muovi(dx < 0 ? 1 : -1);
  });
})();

// ---------- timer ----------
let tFine = 0, tTot = 0, tId = null, tMinuti = false, tUltimoMin = -1, audio = null;
const T = id => document.getElementById(id);
function suona(lungo){
  try { navigator.vibrate && navigator.vibrate(lungo ? [300,150,300,150,300] : 200); } catch(e){}
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), v = audio.createGain();
    o.frequency.value = 880; v.gain.value = .12; o.connect(v); v.connect(audio.destination);
    o.start(); o.stop(audio.currentTime + (lungo ? .6 : .2));
  } catch(e){}
}
function avviaTimer(sec, cosa, aMinuti=false){
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch(e){}
  clearInterval(tId); tTot = sec; tFine = Date.now() + sec*1000; tMinuti = aMinuti; tUltimoMin = Math.ceil(sec/60);
  T("t-cosa").textContent = cosa; T("timer").classList.add("on"); T("timer").classList.remove("finito"); T("timer").setAttribute("data-luci", "0");
  tick(); tId = setInterval(tick, 250);
}
function tick(){
  const resto = Math.max(0, Math.round((tFine - Date.now())/1000));
  T("t-tempo").textContent = `${Math.floor(resto/60)}:${String(resto%60).padStart(2,"0")}`;
  T("t-barra").style.width = `${100 * (1 - resto / tTot)}%`;
  if (tMinuti && resto > 0){ const mm = Math.ceil(resto/60); if (mm < tUltimoMin){ tUltimoMin = mm; suona(false); } }
  // a 3, 2, 1 secondi si accende una luce in più, al «Via!» sono tutte e tre (il mood decide se mostrarle: in Motori è il semaforo)
  T("timer").setAttribute("data-luci", String(resto > 3 ? 0 : resto === 0 ? 3 : 4 - resto));
  if (resto === 0){ clearInterval(tId); T("timer").classList.add("finito"); T("t-tempo").textContent = "Via!"; suona(true); }
}
T("t-piu").onclick = () => { if (!T("timer").classList.contains("on")) return;
  if (T("timer").classList.contains("finito")){ avviaTimer(15, T("t-cosa").textContent); return; }
  tFine += 15000; tTot += 15; };
T("t-stop").onclick = () => { clearInterval(tId); T("timer").classList.remove("on"); };

testata(); disegna(); zonaSalvataggio();

})();
