// Come si ordina l'elenco clienti del trainer. Una sola copia: la usano la pagina e i test.
//  cognome: Cognome Nome (come prima) · nome: Nome Cognome
//  scadenza: la scheda che finisce prima (o è già finita) per prima; senza scheda in fondo
//  fermi: chi non si allena da più tempo per primo (chi ha una scheda ma non ha mai segnato niente viene prima di tutti); senza scheda in fondo
// I clienti con il rapporto finito vanno sempre in fondo.
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.LenaOrdinaClienti = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  const OPZIONI = [
    { id: "cognome", testo: "Cognome" },
    { id: "nome", testo: "Nome" },
    { id: "scadenza", testo: "Scheda in scadenza" },
    { id: "fermi", testo: "Fermi da più tempo" },
  ];
  const conf = (a, b) => String(a || "").localeCompare(String(b || ""), "it", { sensitivity: "base" });
  const perCognome = (a, b) => conf(a.cognome, b.cognome) || conf(a.nome, b.nome) || a.id - b.id;
  const perNome = (a, b) => conf(a.nome, b.nome) || conf(a.cognome, b.cognome) || a.id - b.id;
  const finito = (c) => (c.rapporto_finito_il ? 1 : 0);

  function ordina(clienti, come) {
    const chiave = {
      cognome: () => 0,
      nome: () => 0,
      // più vicina la scadenza, prima si va; senza scheda: infinito
      scadenza: (c) => (c.giorni_alla_scadenza === null || c.giorni_alla_scadenza === undefined ? Infinity : Number(c.giorni_alla_scadenza)),
      // senza scheda: infinito; con scheda ma mai allenato: -infinito; altrimenti la data dell'ultimo progresso
      fermi: (c) => (!c.schede ? Infinity : c.ultimo_progresso ? Date.parse(c.ultimo_progresso) : -Infinity),
    }[come] || (() => 0);
    const secondo = come === "nome" ? perNome : perCognome;
    return [...clienti].sort((a, b) => {
      const d = finito(a) - finito(b);
      if (d) return d;
      const ka = chiave(a), kb = chiave(b);
      if (ka !== kb) return ka < kb ? -1 : 1;
      return secondo(a, b);
    });
  }

  return { OPZIONI, ordina };
});
