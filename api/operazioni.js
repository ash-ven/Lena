// Le due operazioni che sia le rotte dell'API sia gli script a riga di comando devono fare allo stesso modo.
// Sono qui, in un posto solo, così non possono mai comportarsi in modo diverso.
const crypto = require("crypto");
const db = require("./db");
const { hashCodice } = require("./aiuti");
const { erroreScheda } = require("./valida-scheda");

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
  return { id: r.rows[0].id };
}

module.exports = { creaInvito, creaScheda, DURATA_INVITO_GIORNI };
