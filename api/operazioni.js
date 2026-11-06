// Le due operazioni che sia le rotte dell'API sia gli script a riga di comando devono fare allo stesso modo.
// Sono qui, in un posto solo, così non possono mai comportarsi in modo diverso.
const crypto = require("crypto");
const db = require("./db");
const { hashCodice } = require("./aiuti");
const { erroreScheda } = require("../web/valida-scheda");

const DURATA_INVITO_GIORNI = 7;

// Crea un invito per il cliente e restituisce il codice (UNA volta sola: nel database resta solo la sua impronta).
// Un nuovo invito annulla quelli vecchi non ancora usati: resta valido un solo link alla volta.
async function creaInvito(clienteId) {
  const codice = crypto.randomBytes(32).toString("base64url");   // 43 caratteri, impossibile da indovinare
  const scadeIl = await db.transazione(async (client) => {
    await client.query("DELETE FROM invito WHERE cliente_id = $1 AND usato_il IS NULL", [clienteId]);
    const r = await client.query(
      `INSERT INTO invito (cliente_id, codice_hash, scade_il)
       VALUES ($1, $2, now() + make_interval(days => $3)) RETURNING scade_il`,
      [clienteId, hashCodice(codice), DURATA_INVITO_GIORNI]
    );
    return r.rows[0].scade_il;
  });
  return { codice, scadeIl };
}

// Controlla la scheda e la salva. Restituisce { id } oppure { errore } (con il motivo, in italiano).
async function creaScheda(clienteId, dati) {
  const errore = erroreScheda(dati);
  if (errore) return { errore };
  const r = await db.query(
    "INSERT INTO scheda (cliente_id, inizio, settimane, dati) VALUES ($1, $2, $3, $4) RETURNING id",
    [clienteId, dati.inizio, dati.settimane, dati]
  );
  // caricare una scheda è un'attività: serve a decidere dopo quanto tempo cancellare i dati (conservazione.js)
  await db.query("UPDATE cliente SET ultima_attivita = now() WHERE id = $1", [clienteId]);
  return { id: r.rows[0].id };
}

module.exports = { creaInvito, creaScheda, DURATA_INVITO_GIORNI };

// ---------- GDPR: esportare e cancellare i dati di un cliente ----------
// Le usano sia il professionista (dalla pagina del cliente) sia il cliente stesso (dalla pagina «Il mio account»):
// la logica è una sola, quindi i due non possono mai comportarsi in modo diverso.

// Tutti i dati di un cliente in un unico oggetto (per scaricarli: portabilità).
// Dei codici di invito ci sono solo le date: l'impronta del codice non è un dato del cliente.
async function esportaCliente(clienteId, conn = db) {
  const id = clienteId;
  const [anagrafica, schede, registrazioni, inviti] = await Promise.all([
    conn.query(
      `SELECT c.id, c.nome, c.cognome, c.creato_il, c.ultima_attivita, c.rapporto_finito_il, p.nome AS professionista,
              u.email, u.creato_il AS account_creato_il
         FROM cliente c JOIN pt p ON p.id = c.pt_id LEFT JOIN utente u ON u.id = c.utente_id
        WHERE c.id = $1`, [id]),
    conn.query("SELECT id, inizio, settimane, creata_il, aggiornata_il, dati FROM scheda WHERE cliente_id = $1 ORDER BY creata_il, id", [id]),
    conn.query(
      `SELECT g.scheda_id, g.tipo, g.chiave, g.valore, g.aggiornata_il
         FROM registrazione g JOIN scheda s ON s.id = g.scheda_id
        WHERE s.cliente_id = $1 ORDER BY g.scheda_id, g.tipo, g.chiave`, [id]),
    conn.query("SELECT creato_il, scade_il, usato_il FROM invito WHERE cliente_id = $1 ORDER BY creato_il", [id]),
  ]);
  if (!anagrafica.rows[0]) return null;
  // i consensi di chi ha l'account (informativa accettata, con versione e data)
  const consensi = await conn.query(
    `SELECT k.tipo, k.versione, k.accettato_il FROM consenso k JOIN cliente c ON c.utente_id = k.utente_id
      WHERE c.id = $1 ORDER BY k.accettato_il, k.id`, [id]);

  const perScheda = new Map(schede.rows.map((s) => [s.id, { ...s, registrazioni: [] }]));
  for (const g of registrazioni.rows) {
    const { scheda_id, ...resto } = g;
    perScheda.get(scheda_id).registrazioni.push(resto);
  }
  return {
    esportato_il: new Date().toISOString(),
    cliente: anagrafica.rows[0],
    schede: [...perScheda.values()],
    consensi: consensi.rows,
    inviti: inviti.rows,
  };
}

// Cancella il cliente e TUTTO ciò che lo riguarda, dentro la transazione "client".
// Schede, registrazioni e inviti se ne vanno a cascata con il cliente; l'account (utente) invece va cancellato a mano
// perché cliente.utente_id è "ON DELETE SET NULL"; i consensi se ne vanno a cascata con l'utente.
// "ptId" (facoltativo): se c'è, si cancella solo se il cliente è di quel professionista. Restituisce true se ha cancellato.
async function cancellaCliente(client, clienteId, ptId = null) {
  const r = await client.query(
    "DELETE FROM cliente WHERE id = $1 AND ($2::int IS NULL OR pt_id = $2) RETURNING utente_id", [clienteId, ptId]);
  if (!r.rows[0]) return false;
  if (r.rows[0].utente_id) await client.query("DELETE FROM utente WHERE id = $1 AND ruolo = 'cliente'", [r.rows[0].utente_id]);
  return true;
}

module.exports.esportaCliente = esportaCliente;
module.exports.cancellaCliente = cancellaCliente;
