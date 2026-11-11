/* Traduce i progressi tra i DUE formati che si incontrano:
   - il database: righe { tipo, chiave, valore } con tipo "kg" | "rip" | "serie" | "fatto" | "sforzo";
   - la scheda: l'oggetto "mem" { kg:{}, rip:{}, fatti:{}, serie:{}, sforzo:{} } (nota: "fatto" lì si chiama "fatti").
   Per confrontare e inviare, ogni voce diventa una coppia in una Map: "tipo|chiave" → valore (sempre testo).
   Il file è fatto di sole funzioni semplici e gira sia nel browser sia in Node (per i test). */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.LenaRegistrazioni = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  // tipo del database → campo dell'oggetto "mem"
  const CAMPO_MEM = { kg: "kg", rip: "rip", fatto: "fatti", serie: "serie", sforzo: "sforzo" };
  const TIPI = Object.keys(CAMPO_MEM);

  const chiaveMappa = (tipo, chiave) => tipo + "|" + chiave;
  function spezza(k) { const i = k.indexOf("|"); return { tipo: k.slice(0, i), chiave: k.slice(i + 1) }; }

  // righe del database → Map
  function mappaDaVoci(voci) {
    const m = new Map();
    for (const v of voci || []) if (CAMPO_MEM[v.tipo]) m.set(chiaveMappa(v.tipo, v.chiave), String(v.valore));
    return m;
  }

  // Map → oggetto "mem" della scheda. Attenzione ai tipi: la scheda fa dei conti con "serie"
  // (serie + 1), quindi lì i valori devono tornare NUMERI, non testo ("3" + 1 darebbe "31").
  function memDaMappa(mappa) {
    const mem = { kg: {}, rip: {}, fatti: {}, serie: {}, sforzo: {} };
    for (const [k, valore] of mappa) {
      const { tipo, chiave } = spezza(k);
      if (tipo === "fatto") mem.fatti[chiave] = 1;
      else if (tipo === "serie") { const n = Number(valore); if (Number.isInteger(n) && n > 0) mem.serie[chiave] = n; }
      else if (tipo === "kg" || tipo === "rip") mem[tipo][chiave] = valore;
      else if (tipo === "sforzo" && ["1", "2", "3"].includes(valore)) mem.sforzo[chiave] = valore;
    }
    return mem;
  }

  // oggetto "mem" della scheda → Map (le voci vuote o a zero non esistono)
  function mappaDaMem(mem) {
    const m = new Map();
    for (const tipo of TIPI) {
      for (const [chiave, v] of Object.entries((mem && mem[CAMPO_MEM[tipo]]) || {})) {
        let valore;
        if (tipo === "fatto") valore = v ? "1" : "";
        else if (tipo === "serie") valore = Number(v) > 0 ? String(Math.trunc(Number(v))) : "";
        else valore = String(v == null ? "" : v).trim();
        if (valore) m.set(chiaveMappa(tipo, chiave), valore);
      }
    }
    return m;
  }

  // Cosa va mandato al server perché "confermato" diventi "attuale"?
  // Una Map: chiave → nuovo valore, oppure "" (testo vuoto) per le voci da cancellare.
  function differenze(attuale, confermato) {
    const d = new Map();
    for (const [k, v] of attuale) if (confermato.get(k) !== v) d.set(k, v);
    for (const k of confermato.keys()) if (!attuale.has(k)) d.set(k, "");
    return d;
  }

  // Map di differenze → lista di voci nel formato dell'API, a blocchi di al massimo "max" voci
  function inBlocchi(diff, max = 200) {
    const voci = [...diff].map(([k, valore]) => ({ ...spezza(k), valore }));
    const blocchi = [];
    for (let i = 0; i < voci.length; i += max) blocchi.push(voci.slice(i, i + max));
    return blocchi;
  }

  return { CAMPO_MEM, mappaDaVoci, memDaMappa, mappaDaMem, differenze, inBlocchi, chiaveMappa };
});
