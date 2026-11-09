// Spedire email (per ora solo il recupero della password).
//
// Si usa un qualsiasi servizio che offra SMTP: si imposta in api/.env (vedi README, «Recupero della password»):
//   SMTP_HOST=smtp.esempio.it   SMTP_PORT=587   SMTP_USER=...   SMTP_PASS=...   EMAIL_DA="Lena <nome@tuodominio.it>"
// Senza queste impostazioni, in sviluppo l'email NON parte: il testo (con il link) viene scritto nella finestra del server,
// così si può provare tutto senza un servizio di posta. In produzione (NODE_ENV=production) senza impostazioni non si scrive
// il link da nessuna parte: si segnala solo che manca la configurazione.
const nodemailer = require("nodemailer");

let invioDiProva = null;     // i test mettono qui una funzione al posto dell'invio vero
let trasportoCache = null;

function configurata(env = process.env) { return !!(env.SMTP_HOST && env.EMAIL_DA); }

function trasporto(env = process.env) {
  if (!trasportoCache) {
    const porta = Number(env.SMTP_PORT) || 587;
    trasportoCache = nodemailer.createTransport({
      host: env.SMTP_HOST, port: porta, secure: porta === 465,   // 465 = connessione cifrata subito; 587 = si passa a cifrata (STARTTLS)
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return trasportoCache;
}

// Restituisce { inviata: true } se è partita davvero, { inviata: false, motivo } altrimenti. Non lancia: chi chiama non deve
// dire alla persona se l'invio è riuscito (altrimenti si scoprirebbe quali email hanno un account), ma noi lo scriviamo nel log.
async function inviaEmail({ a, oggetto, testo }, env = process.env) {
  if (invioDiProva) return invioDiProva({ a, oggetto, testo });
  if (!configurata(env)) {
    if (env.NODE_ENV === "production") {
      console.error("# [posta] Email NON inviata: mancano SMTP_HOST ed EMAIL_DA in api/.env");
      return { inviata: false, motivo: "non configurata" };
    }
    console.log(`\n# [posta] Email non configurata: ecco cosa sarebbe partito.\n# A: ${a}\n# Oggetto: ${oggetto}\n\n${testo}\n`);
    return { inviata: false, motivo: "non configurata" };
  }
  try {
    await trasporto(env).sendMail({ from: env.EMAIL_DA, to: a, subject: oggetto, text: testo });
    return { inviata: true };
  } catch (err) {
    console.error("# [posta] Invio non riuscito:", err.code || err.message);
    return { inviata: false, motivo: "errore" };
  }
}

function usaInvio(funzione) { invioDiProva = funzione; }

module.exports = { inviaEmail, configurata, usaInvio };
