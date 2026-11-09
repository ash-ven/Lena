/* Controllo "morbido" sui dati di salute nelle schede.
   Lena NON è pensata per contenere dati di salute (infortuni, patologie, farmaci...). Quando il professionista carica un Excel,
   se un testo contiene parole tipiche, compare un AVVISO (mai un blocco) con UN SOLO messaggio, lo stesso nell'editor e nel caricamento da Excel: «togli questa informazione».

   È solo un aiuto, non un medico: cerca parole italiane in una lista. Non capisce il senso delle frasi.
   Limiti, detti chiaramente:
   - FALSI NEGATIVI: non vede sinonimi, errori di battitura, altre lingue, giri di parole («ho sempre male alla spalla»);
   - FALSI POSITIVI: può scattare su frasi innocue che contengono una di queste parole (es. «operazione» in senso non medico).
   Nessuna decisione viene presa da sola: l'avviso si può ignorare con la spunta «ho letto gli avvisi».

   COME SI MODIFICA LA LISTA (qui sotto, in PAROLE):
   - una parola scritta così com'è si cerca come PAROLA INTERA («ernia» trova «ernia» ma non «paternia»);
   - una parola che finisce con * si cerca come INIZIO di parola («infortun*» trova infortunio, infortunato, infortuni...);
   - si possono usare più parole insieme («intervento chirurgico»);
   - maiuscole, accenti e apostrofi non contano.
   Per togliere un falso positivo: cancella la riga. Per aggiungere: aggiungi una riga. Poi rilancia npm test. */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.LenaParoleSalute = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {

  const PAROLE = [
    // infortuni e problemi fisici
    "infortun*", "frattur*", "lesion*", "tendinit*", "distors*", "strappo muscolare", "contrattura cronica",
    "ernia", "ernie", "ernia del disco", "protrusion*", "sciatica", "sciatalgia", "lombalgia", "cervicalgia", "scoliosi", "artrosi", "artrite", "diastasi",
    "mal di schiena", "mal di testa", "emicrania", "cefalea",
    // malattie e condizioni
    "patolog*", "diabet*", "ipertension*", "ipotension*", "colesterolo", "tiroid*", "celiachia", "anemia", "asma", "epilessi*", "depressione",
    "cardiopati*", "aritmi*", "infarto", "ictus", "tumor*", "cancro", "osteopor*", "menopausa",
    // gravidanza
    "gravidanz*", "incinta", "post parto", "postpartum",
    // allergie, farmaci, terapie
    "allergi*", "intolleranz*", "farmac*", "medicinal*", "antidolorific*", "antinfiammator*", "anticoagulant*", "insulina", "pillola", "terapia", "fisioterap*",
    // interventi
    "operazione", "operata", "operato", "intervento chirurgico", "chirurg*", "post operatorio",
  ];

  // minuscolo, senza accenti, solo lettere e numeri separati da uno spazio
  const normalizza = (t) => String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const esci = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Ogni voce della lista diventa un'espressione che cerca la parola (intera o come inizio) dentro il testo normalizzato
  const REGOLE = PAROLE.map((voce) => {
    const prefisso = voce.endsWith("*");
    const radice = normalizza(prefisso ? voce.slice(0, -1) : voce);
    return { voce, regola: new RegExp("(?:^| )" + esci(radice).replace(/ /g, " ") + (prefisso ? "[a-z0-9]*" : "") + "(?= |$)") };
  });

  // Le parole di salute trovate in un testo (lista vuota se non ce ne sono)
  function trova(testo) {
    const t = normalizza(testo);
    if (!t) return [];
    const trovate = [];
    for (const { regola } of REGOLE) { const m = t.match(regola); if (m) trovate.push(m[0].trim()); }
    return [...new Set(trovate)];
  }

  // Tutti i testi di una scheda che possono contenere note, con l'indicazione di DOVE si trovano
  function raccogli(dati) {
    const fuori = [];
    const aggiungi = (dove, t) => { if (typeof t === "string" && t.trim() && !/^https?:\/\//i.test(t)) fuori.push({ dove, testo: t }); };
    const i = (dati && dati.info) || {};
    aggiungi("titolo della scheda", i.titolo); aggiungi("obiettivo", i.obiettivo); aggiungi("durata", i.nota_durata);   // nome e cognome no: sono dati anagrafici
    const r = (dati && dati.riscaldamento) || {};
    aggiungi("riscaldamento", r.voce); aggiungi("riscaldamento", r.istruzione);
    for (const e of r.esercizi || []) aggiungi("riscaldamento", Array.isArray(e) ? e[0] : null);
    for (const g of (dati && dati.giorni) || []) {
      const giorno = `Giorno ${g.id}`;
      aggiungi(giorno, g.focus);
      if (Array.isArray(g.stretching)) aggiungi(`${giorno}, stretching`, g.stretching[0]);
      for (const b of g.blocchi || []) {
        if (b.tipo === "circuito") {
          aggiungi(`${giorno}, circuito`, b.formato);
          for (const e of b.esercizi || []) aggiungi(`${giorno}, «${e.nome}»`, e.nome);
        } else {
          const lab = `${giorno}, «${b.nome}»`;
          aggiungi(lab, b.nome); aggiungi(`${lab} (note)`, b.note); aggiungi(`${lab} (progressione)`, b.progressione); aggiungi(lab, b.rec);
          for (const s of b.schema || []) aggiungi(lab, s);
        }
      }
    }
    return fuori;
  }

  // L'unico messaggio sui dati di salute (pilota: nessun dato di salute in Lena). Cambiare la regola = cambiare solo questa riga.
  const MESSAGGIO = "In questa fase Lena non può contenere dati sulla salute: togli questa informazione.";

  // Gli avvisi (testi in italiano) per una scheda. Al massimo 8, poi una riga che dice quanti altri ce ne sono.
  function avvisi(dati, massimo = 8) {
    const tutti = [];
    for (const { dove, testo } of raccogli(dati)) {
      const parole = trova(testo);
      if (!parole.length) continue;
      const estratto = testo.length > 60 ? testo.slice(0, 57) + "…" : testo;
      tutti.push(`${MESSAGGIO} [${dove}] «${estratto}» (parola riconosciuta: ${parole.join(", ")})`);
    }
    if (tutti.length <= massimo) return tutti;
    return [...tutti.slice(0, massimo), `…e altri ${tutti.length - massimo} testi che sembrano contenere dati sulla salute: toglili.`];
  }

  return { PAROLE, MESSAGGIO, trova, avvisi, normalizza };
});
