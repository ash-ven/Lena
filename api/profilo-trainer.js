// Il profilo del trainer: nome, breve presentazione, contatto e foto.
// Lo modifica solo il trainer; lo vedono lui e i SUOI clienti (le rotte del cliente sono in me.js).
const express = require("express");
const db = require("./db");
const { richiediLogin, richiediRuolo } = require("./auth");
const { richiediCondizioniPt } = require("./consensi");

const MAX_NOME = 100, MAX_BIO = 500, MAX_CONTATTO = 100;
const MAX_FOTO = 400 * 1024;   // il browser la riduce a ~512 px: di solito sono 30-80 KB

// Un testo libero di una riga o più: niente caratteri di controllo (tranne a capo e tab), spazi ai bordi tolti.
// Restituisce la stringa pulita, oppure null se è troppo lunga o contiene caratteri non ammessi.
function testoPulito(valore, massimo, { multilinea = false } = {}) {
  if (valore == null) return "";
  if (typeof valore !== "string") return null;
  const t = valore.replace(/\r\n/g, "\n").trim();
  if ([...t].length > massimo) return null;
  const vietati = multilinea ? /[\u0000-\u0008\u000B-\u001F\u007F]/ : /[\u0000-\u001F\u007F]/;
  return vietati.test(t) ? null : t;
}

// Un JPEG vero inizia con FF D8 FF e finisce con FF D9. Non basta fidarsi del Content-Type.
const èJpeg = (b) => Buffer.isBuffer(b) && b.length >= 100 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9;

// Cosa si mostra del profilo (a lui e ai suoi clienti): mai la foto stessa, solo se c'è e quando è cambiata
const vista = (r) => ({ nome: r.nome, bio: r.bio || "", contatto: r.contatto || "", haFoto: !!r.ha_foto, fotoAggiornataIl: r.foto_aggiornata_il });
const COLONNE = "nome, bio, contatto, (foto IS NOT NULL) AS ha_foto, foto_aggiornata_il";

const router = express.Router();
router.use(richiediLogin, richiediRuolo("pt"), richiediCondizioniPt);
router.use(async (req, res, next) => {
  const r = await db.query("SELECT id FROM pt WHERE utente_id = $1", [req.utente.id]);
  if (!r.rows[0]) return res.status(403).json({ errore: "Non hai il permesso" });
  req.ptId = r.rows[0].id;
  next();
});

// GET /api/pt/profilo
router.get("/profilo", async (req, res) => {
  const r = await db.query(`SELECT ${COLONNE} FROM pt WHERE id = $1`, [req.ptId]);
  res.json(vista(r.rows[0]));
});

// PUT /api/pt/profilo  { nome, bio, contatto }
router.put("/profilo", async (req, res) => {
  const c = req.body || {};
  const nome = testoPulito(c.nome, MAX_NOME);
  const bio = testoPulito(c.bio, MAX_BIO, { multilinea: true });
  const contatto = testoPulito(c.contatto, MAX_CONTATTO);
  if (!nome) return res.status(400).json({ errore: `Scrivi il tuo nome (al massimo ${MAX_NOME} caratteri)` });
  if (bio === null) return res.status(400).json({ errore: `La presentazione può avere al massimo ${MAX_BIO} caratteri` });
  if (contatto === null) return res.status(400).json({ errore: `Il contatto può avere al massimo ${MAX_CONTATTO} caratteri, su una riga` });
  const r = await db.query(
    `UPDATE pt SET nome = $2, bio = NULLIF($3, ''), contatto = NULLIF($4, '') WHERE id = $1 RETURNING ${COLONNE}`,
    [req.ptId, nome, bio, contatto]
  );
  res.json(vista(r.rows[0]));
});

// PUT /api/pt/foto  (corpo = i byte di un JPEG)
router.put("/foto", express.raw({ type: "image/jpeg", limit: MAX_FOTO }), async (req, res) => {
  if (!èJpeg(req.body)) return res.status(415).json({ errore: "La foto deve essere un'immagine JPEG" });
  const r = await db.query(
    `UPDATE pt SET foto = $2, foto_aggiornata_il = now() WHERE id = $1 RETURNING ${COLONNE}`,
    [req.ptId, req.body]
  );
  res.json(vista(r.rows[0]));
});

// DELETE /api/pt/foto
router.delete("/foto", async (req, res) => {
  const r = await db.query(`UPDATE pt SET foto = NULL, foto_aggiornata_il = NULL WHERE id = $1 RETURNING ${COLONNE}`, [req.ptId]);
  res.json(vista(r.rows[0]));
});

// GET /api/pt/foto: la mia foto
router.get("/foto", async (req, res) => {
  const r = await db.query("SELECT foto FROM pt WHERE id = $1", [req.ptId]);
  if (!r.rows[0].foto) return res.status(404).json({ errore: "Nessuna foto" });
  res.type("image/jpeg").send(r.rows[0].foto);
});

module.exports = { router, vista, COLONNE, èJpeg, MAX_FOTO };
