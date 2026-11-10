// Le impostazioni che riguardano la privacy, in UN solo posto.
//
// VERSIONI DEI TESTI. Quando cambi il testo dell'informativa o delle condizioni d'uso, cambia anche la versione qui:
// tutti dovranno accettare di nuovo (i clienti alla prossima registrazione, i PT al prossimo accesso).
// Le pagine mostrano questa versione e il sito la legge da qui: non va scritta altrove.
const VERSIONE_INFORMATIVA = "2026-11-bozza-3";       // informativa privacy per i clienti (web/privacy.html)
const VERSIONE_CONDIZIONI_PT = "2026-11-bozza-2";     // condizioni d'uso per i professionisti (web/condizioni-pt.html)

// CONSERVAZIONE. Dopo quanti mesi si cancellano i clienti con rapporto concluso o senza attività (vedi pulizia.js).
// Il valore giusto è ancora da decidere con il professionista: per questo si cambia in api/.env, senza toccare il codice.
const MESI_CONSERVAZIONE_DEFAULT = 24;
function mesiConservazione(env = process.env) {
  const grezzo = env.MESI_CONSERVAZIONE;
  if (grezzo === undefined || grezzo === "") return MESI_CONSERVAZIONE_DEFAULT;
  if (!/^\d{1,3}$/.test(String(grezzo).trim()) || Number(grezzo) < 1 || Number(grezzo) > 120) {
    throw new Error("MESI_CONSERVAZIONE deve essere un numero intero tra 1 e 120 (mesi).");
  }
  return Number(grezzo);
}

module.exports = { VERSIONE_INFORMATIVA, VERSIONE_CONDIZIONI_PT, MESI_CONSERVAZIONE_DEFAULT, mesiConservazione };
