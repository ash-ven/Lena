// Conservazione dei dati: dopo quanto tempo un cliente va cancellato, e la cancellazione vera e propria.
// Il periodo (in mesi) è un parametro di configurazione: MESI_CONSERVAZIONE (vedi config.js e .env.example).
const db = require("./db");
const { cancellaCliente } = require("./operazioni");

// Sottrae dei mesi a una data. Se il giorno non esiste nel mese di arrivo si usa l'ultimo giorno di quel mese
// (31 marzo meno 1 mese = 28 febbraio, non 3 marzo).
function sottraiMesi(data, mesi) {
  const d = new Date(data);
  const primo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - mesi, 1));
  const ultimoGiorno = new Date(Date.UTC(primo.getUTCFullYear(), primo.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(primo.getUTCFullYear(), primo.getUTCMonth(), Math.min(d.getUTCDate(), ultimoGiorno),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
}

// La data limite: chi ha come riferimento una data PIÙ VECCHIA di questa va cancellato.
const limite = (adesso, mesi) => sottraiMesi(adesso, mesi);

// Quale data conta per un cliente?
//  - se il professionista ha segnato «rapporto concluso»: la data di conclusione;
//  - altrimenti: l'ultima attività (ha caricato una scheda o salvato un valore).
// Restituisce null se il cliente NON è scaduto, altrimenti { motivo, data }.
function motivoScadenza(cliente, dataLimite) {
  if (cliente.rapporto_finito_il) {
    const d = new Date(cliente.rapporto_finito_il);
    return d < dataLimite ? { motivo: "rapporto concluso", data: d } : null;
  }
  const d = new Date(cliente.ultima_attivita);
  return d < dataLimite ? { motivo: "nessuna attività", data: d } : null;
}

// I clienti da cancellare. "soloIds" (facoltativo) restringe la ricerca: serve ai test, per non toccare i dati degli altri.
async function trovaScaduti({ adesso = new Date(), mesi, soloIds = null, conn = db }) {
  const lim = limite(adesso, mesi);
  const r = await conn.query(
    `SELECT c.id, c.nome, c.cognome, c.utente_id, c.pt_id, p.nome AS professionista, c.ultima_attivita, c.rapporto_finito_il
       FROM cliente c JOIN pt p ON p.id = c.pt_id
      WHERE ($2::int[] IS NULL OR c.id = ANY($2))
        AND ((c.rapporto_finito_il IS NOT NULL AND c.rapporto_finito_il < $1)
          OR (c.rapporto_finito_il IS NULL AND c.ultima_attivita < $1))
      ORDER BY c.id`,
    [lim, soloIds]
  );
  return { limite: lim, scaduti: r.rows.map((c) => ({ ...c, ...motivoScadenza(c, lim) })) };
}

// Cancella davvero. Ogni cliente in una SUA transazione: se uno fallisce, gli altri restano com'erano (e il problema si vede).
async function eseguiPulizia({ adesso = new Date(), mesi, soloIds = null }) {
  const { limite: lim, scaduti } = await trovaScaduti({ adesso, mesi, soloIds });
  const cancellati = [], falliti = [];
  for (const c of scaduti) {
    try {
      await db.transazione((client) => cancellaCliente(client, c.id));
      cancellati.push(c);
    } catch (e) {
      falliti.push({ id: c.id, errore: e.code || e.name });   // niente messaggi: potrebbero contenere dati
    }
  }
  return { limite: lim, cancellati, falliti };
}

module.exports = { sottraiMesi, limite, motivoScadenza, trovaScaduti, eseguiPulizia };
