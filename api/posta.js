// Spedire email (per ora solo il recupero della password). Stessa soluzione di Loadout: si usa Brevo tramite la sua API
// (indirizzo https, porta 443: funziona anche su Render gratuito, che blocca le porte SMTP). Il mittente è un indirizzo
// Gmail verificato su Brevo; Gmail non spedisce niente, è solo il nome che compare come mittente.
//
// In api/.env (e, online, nelle variabili d'ambiente di Render: mai nel repository):
//   BREVO_API_KEY=la chiave creata in Brevo (SMTP e API → Chiavi API)
//   EMAIL_MITTENTE=l'indirizzo verificato in Brevo come mittente
//   EMAIL_ASSISTENZA=facoltativa: dove arrivano le risposte delle persone (se manca, si usa EMAIL_MITTENTE)
//
// Senza BREVO_API_KEY (sul PC, in sviluppo) l'email NON parte: il testo, con il link, viene scritto nella finestra del server,
// così si prova tutto senza account esterni. In produzione (NODE_ENV=production) senza chiave il link non viene scritto da nessuna parte.
const URL_BREVO = "https://api.brevo.com/v3/smtp/email";

let invioDiProva = null;   // i test mettono qui una funzione al posto dell'invio vero

const configurata = (env = process.env) => !!(String(env.BREVO_API_KEY || "").trim() && String(env.EMAIL_MITTENTE || "").trim());
const indirizzoAssistenza = (env = process.env) => String(env.EMAIL_ASSISTENZA || env.EMAIL_MITTENTE || "").trim();

// Restituisce { inviata: true } se è partita davvero, { inviata: false, motivo } altrimenti. Non lancia: chi chiama non deve
// dire alla persona se l'invio è riuscito (altrimenti si scoprirebbe quali email hanno un account), ma noi lo scriviamo nel log.
async function inviaEmail({ a, oggetto, testo }, env = process.env, chiamaFetch = fetch) {
  if (invioDiProva) return invioDiProva({ a, oggetto, testo });
  if (!configurata(env)) {
    if (env.NODE_ENV === "production") {
      console.error("# [posta] Email NON inviata: mancano BREVO_API_KEY ed EMAIL_MITTENTE");
      return { inviata: false, motivo: "non configurata" };
    }
    console.log(`\n# [posta] Email non configurata (manca BREVO_API_KEY): ecco cosa sarebbe partito.\n# A: ${a}\n# Oggetto: ${oggetto}\n\n${testo}\n`);
    return { inviata: false, motivo: "non configurata" };
  }
  try {
    const assistenza = indirizzoAssistenza(env);
    const risposta = await chiamaFetch(URL_BREVO, {
      method: "POST",
      // trim(): il copia-incolla di una chiave può aggiungere spazi o a capo, e Brevo risponde «Key not found»
      headers: { "api-key": String(env.BREVO_API_KEY).trim(), "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Lena", email: String(env.EMAIL_MITTENTE).trim() },
        to: [{ email: a }],
        ...(assistenza ? { replyTo: { email: assistenza } } : {}),
        subject: oggetto,
        textContent: testo,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!risposta.ok) {
      console.error(`# [posta] Brevo ha risposto ${risposta.status}: ${(await risposta.text()).slice(0, 300)}`);
      return { inviata: false, motivo: "errore" };
    }
    return { inviata: true };
  } catch (err) {
    console.error("# [posta] Invio non riuscito:", err.name === "TimeoutError" ? "Brevo non ha risposto in tempo" : err.message);
    return { inviata: false, motivo: "errore" };
  }
}

function usaInvio(funzione) { invioDiProva = funzione; }

module.exports = { inviaEmail, configurata, usaInvio };
